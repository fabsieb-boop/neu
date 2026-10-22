#!/usr/bin/env python3
"""HTTP-API für Excel-Daten, regionale Zugänge und den Systembereich."""

from __future__ import annotations

import base64
import gzip
import hashlib
import hmac
import io
import json
import mimetypes
import os
import secrets
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import zipfile
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import parse_qs, urlparse
from xml.etree import ElementTree as ET

from model import (
    DB,
    ForecastInputError,
    SystemInputError,
    add_forecast_plan,
    annual_document,
    annual_entries,
    authenticate,
    bootstrap_user,
    build,
    change_password,
    create_user,
    delete_report_template,
    ensure_system_schema,
    get_user,
    import_log,
    journal_rows,
    list_users,
    log_import,
    report_templates,
    save_annual_entry,
    save_report_template,
    update_user,
    user_count,
    user_regions,
)

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "data" / "tvf-dashboard-download.xlsx"
HOST = os.environ.get("TVF_API_HOST", "127.0.0.1")
PORT = int(os.environ.get("TVF_API_PORT", "8787"))
COOKIE = "tvf_session"
SESSION_SECRET = os.environ.get("TVF_SESSION_SECRET", "").encode() or secrets.token_bytes(32)
SYSTEM_TABLES = ("benutzer", "bericht_vorlage", "ja_stand", "import_protokoll")
SOURCE_TABLES = (
    "parameter",
    "projekt",
    "kostenart",
    "buchung",
    "forecast_plan",
    "ebitda_plan",
    "verlust",
    "liq_parameter",
    "liq_monat",
    "liq_bestand",
    "kontostand",
    "guv_position",
    "guv_wert",
    "kosten_meldung",
    "auftrag_liste",
    "region_liste",
    "legende",
)
def _session_token(user_id: int) -> str:
    expires = int(time.time()) + 12 * 60 * 60
    payload = f"{user_id}.{expires}"
    signature = hmac.new(SESSION_SECRET, payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"


def _session_user(token: str) -> dict | None:
    try:
        raw_id, raw_expiry, signature = token.split(".", 2)
        payload = f"{raw_id}.{raw_expiry}"
        expected = hmac.new(SESSION_SECRET, payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected) or int(raw_expiry) < int(time.time()):
            return None
        return get_user(int(raw_id))
    except (ValueError, TypeError):
        return None


def _analyse_workbook(content: bytes) -> dict:
    from scripts.import_excel import SHEETS, workbook_sheet_names

    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            names = workbook_sheet_names(archive)
    except (zipfile.BadZipFile, KeyError, ET.ParseError, ValueError) as error:
        raise SystemInputError("Die Datei ist keine lesbare Excel-Mappe.") from error
    missing = [name for name in SHEETS if name not in names]
    if missing:
        raise SystemInputError(
            "In der Mappe fehlen benötigte Blätter: " + ", ".join(missing)
        )
    return {"blaetter": names, "erkannt": len(SHEETS), "fehlend": missing}


def _run_import(content: bytes) -> tuple[tempfile.TemporaryDirectory, Path, dict[str, int]]:
    temp = tempfile.TemporaryDirectory()
    folder = Path(temp.name)
    workbook = folder / "tvf-dashboard-download.xlsx"
    database = folder / "tvf.sqlite"
    workbook.write_bytes(content)
    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "import_excel.py"),
            "--xlsx",
            str(workbook),
            "--db",
            str(database),
        ],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode:
        temp.cleanup()
        detail = (result.stderr or result.stdout or "Import fehlgeschlagen.").strip()
        raise SystemInputError(detail[-1000:])
    with sqlite3.connect(database) as con:
        counts = {
            table: int(con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0])
            for table in SOURCE_TABLES
        }
    validation = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "from server.model import build, journal_rows; "
                "data = build(); journal_rows(); "
                "assert data['guv'] and data['months']"
            ),
        ],
        cwd=ROOT,
        env={**os.environ, "TVF_DB": str(database)},
        check=False,
        capture_output=True,
        text=True,
        timeout=120,
    )
    if validation.returncode:
        temp.cleanup()
        detail = (
            validation.stderr or validation.stdout or "Validierung fehlgeschlagen."
        ).strip()
        raise SystemInputError(detail[-1000:])
    return temp, database, counts


def _preserve_system_tables(new_database: Path) -> None:
    ensure_system_schema()
    old = sqlite3.connect(DB)
    old.row_factory = sqlite3.Row
    new = sqlite3.connect(new_database)
    try:
        for table in SYSTEM_TABLES:
            columns = [
                row[1] for row in old.execute(f'PRAGMA table_info("{table}")')
            ]
            if not columns:
                continue
            rows = old.execute(f'SELECT * FROM "{table}"').fetchall()
            if not rows:
                continue
            names = ", ".join(f'"{name}"' for name in columns)
            marks = ", ".join("?" for _ in columns)
            new.executemany(
                f'INSERT INTO "{table}" ({names}) VALUES ({marks})',
                [tuple(row[name] for name in columns) for row in rows],
            )
        new.commit()
    finally:
        old.close()
        new.close()


def _activate_import(
    folder: Path,
    new_database: Path,
    filename: str,
    total: int,
) -> dict:
    previous_database = folder / "previous.sqlite"
    previous_workbook = folder / "previous.xlsx"
    incoming_database = DB.with_name(f".{DB.name}.{secrets.token_hex(8)}.tmp")
    incoming_workbook = XLSX.with_name(f".{XLSX.name}.{secrets.token_hex(8)}.tmp")
    database_replaced = False
    workbook_replaced = False
    shutil.copy2(DB, previous_database)
    shutil.copy2(XLSX, previous_workbook)
    try:
        shutil.copy2(new_database, incoming_database)
        shutil.copy2(folder / "tvf-dashboard-download.xlsx", incoming_workbook)
        os.replace(incoming_workbook, XLSX)
        workbook_replaced = True
        os.replace(incoming_database, DB)
        database_replaced = True
        log_import(filename, "import", "ERFOLGREICH", total)
        return build()
    except Exception:
        if workbook_replaced:
            shutil.copy2(previous_workbook, incoming_workbook)
            os.replace(incoming_workbook, XLSX)
        if database_replaced:
            shutil.copy2(previous_database, incoming_database)
            os.replace(incoming_database, DB)
        raise
    finally:
        incoming_database.unlink(missing_ok=True)
        incoming_workbook.unlink(missing_ok=True)


class Handler(BaseHTTPRequestHandler):
    dashboard = None
    scoped_dashboards: dict[tuple[str, ...], dict] = {}
    data_lock = Lock()

    def log_message(self, fmt: str, *args) -> None:
        print(f"[api] {self.address_string()} {fmt % args}")

    def _current_user(self) -> dict | None:
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get(COOKIE)
        return _session_user(morsel.value) if morsel else None

    def _require_user(self) -> dict | None:
        user = self._current_user()
        if user is None:
            self._json({"error": "Bitte anmelden."}, status=401)
        return user

    def _require_admin(self) -> dict | None:
        user = self._require_user()
        if user is not None and not user["istAdmin"]:
            self._json({"error": "Nur für Administratoren."}, status=403)
            return None
        return user

    def _dashboard_for(self, user: dict) -> dict:
        regions = user_regions(user)
        if regions is None:
            return Handler.dashboard
        key = tuple(sorted(regions))
        if key not in Handler.scoped_dashboards:
            Handler.scoped_dashboards[key] = build(set(key))
        return Handler.scoped_dashboards[key]

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/auth/me":
            if user_count() == 0:
                user = bootstrap_user()
                self._json(
                    {
                        "authenticated": False,
                        "setup": True,
                        "user": user,
                    }
                )
                return
            user = self._current_user()
            if user is None:
                self._json({"authenticated": False}, status=401)
            else:
                self._json({"authenticated": not user["setup"], "setup": user["setup"], "user": user})
            return

        user = self._require_user()
        if user is None:
            return
        if path == "/api/dashboard":
            self._json(self._dashboard_for(user))
            return
        if path == "/api/journal":
            self._json(journal_rows(user_regions(user)))
            return
        if path == "/api/users":
            if self._require_admin() is not None:
                self._json(list_users())
            return
        if path == "/api/report-templates":
            self._json({"vorlagen": report_templates(user["id"]) if user["id"] else []})
            return
        if path == "/api/import/protokoll":
            if self._require_admin() is not None:
                self._json({"laeufe": import_log()})
            return
        if path == "/api/jahresabschluss":
            if self._require_admin() is None:
                return
            query = parse_qs(parsed.query)
            key = (query.get("datei") or [""])[0]
            if key:
                document = annual_document(key)
                if document is None:
                    self._json({"error": "Kein Dokument hinterlegt."}, status=404)
                    return
                filename, content = document
                self._bytes(
                    content,
                    mimetypes.guess_type(filename)[0] or "application/octet-stream",
                    filename,
                )
                return
            self._json({"eintraege": annual_entries(), "schreibrecht": True})
            return
        if path == "/api/mail":
            if self._require_admin() is None:
                return
            data = list_users()
            self._json(
                {
                    "modus": "probe",
                    "benutzer": [user for user in data["nutzer"] if user["aktiv"]],
                }
            )
            return
        self.send_error(404)

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/")
        try:
            if path == "/api/auth/login":
                payload = self._read_json()
                user = authenticate(str(payload.get("email", "")), str(payload.get("passwort", "")))
                if user is None:
                    self._json({"error": "E-Mail oder Passwort ist falsch."}, status=401)
                    return
                self._json(
                    {"user": user},
                    headers={"Set-Cookie": self._session_cookie(_session_token(user["id"]))},
                )
                return
            if path == "/api/auth/logout":
                self._json(
                    {"ok": True},
                    headers={"Set-Cookie": self._session_cookie("", max_age=0)},
                )
                return
            if path == "/api/users" and user_count() == 0:
                payload = self._read_json()
                with self.data_lock:
                    if user_count() != 0:
                        raise SystemInputError(
                            "Die Ersteinrichtung wurde bereits abgeschlossen."
                        )
                    created = create_user(
                        str(payload.get("email", "")),
                        str(payload.get("passwort", "")),
                        str(payload.get("vorname", "")),
                        str(payload.get("nachname", "")),
                        "ADMIN",
                    )
                self._json(
                    {"user": created, "setupComplete": True},
                    status=201,
                )
                return

            user = self._require_user()
            if user is None:
                return
            if path == "/api/auth/password":
                payload = self._read_json()
                changed = change_password(
                    user["id"],
                    str(payload.get("bisher", "")),
                    str(payload.get("neu", "")),
                )
                self._json({"user": changed})
                return
            if path == "/api/users":
                if self._require_admin() is None:
                    return
                payload = self._read_json()
                created = create_user(
                    str(payload.get("email", "")),
                    str(payload.get("passwort", "")),
                    str(payload.get("vorname", "")),
                    str(payload.get("nachname", "")),
                    str(payload.get("rolle", "NEUTRAL")),
                )
                self._json({"user": created, "setupComplete": False}, status=201)
                return
            if path == "/api/forecast":
                roles = set(user["rollen"])
                if not roles & {"ADMIN", "CONTROLLING", "FORECAST-PFLEGE"}:
                    self._json({"error": "Keine Berechtigung für Forecast-Eingaben."}, status=403)
                    return
                payload = self._read_json()
                with self.data_lock:
                    saved = add_forecast_plan(
                        payload.get("projektNr"),
                        payload.get("groesse"),
                        payload.get("werte"),
                        user_regions(user),
                    )
                    Handler.dashboard = build()
                    Handler.scoped_dashboards.clear()
                    dashboard = self._dashboard_for(user)
                self._json(
                    {
                        "saved": len(saved),
                        "entries": saved,
                        "dashboard": dashboard,
                    },
                    status=201,
                )
                return
            if path == "/api/report-templates":
                payload = self._read_json()
                template_id = save_report_template(
                    user["id"],
                    str(payload.get("name", "")),
                    str(payload.get("quelle", "")),
                    payload.get("aufbau"),
                )
                self._json({"id": template_id}, status=201)
                return
            if path == "/api/jahresabschluss":
                if self._require_admin() is None:
                    return
                payload = self._read_json(max_size=56 * 1024 * 1024)
                document = None
                filename = payload.get("dateiname")
                if payload.get("inhalt"):
                    try:
                        document = base64.b64decode(payload["inhalt"], validate=True)
                    except (ValueError, TypeError) as error:
                        raise SystemInputError("Das Dokument ist ungültig.") from error
                    if len(document) > 40 * 1024 * 1024:
                        raise SystemInputError("Das Dokument ist größer als 40 MB.")
                save_annual_entry(
                    str(payload.get("schluessel", "")),
                    status=str(payload.get("status", "offen")),
                    datum=str(payload.get("datum") or "") or None,
                    filename=str(filename) if filename is not None else None,
                    document=document,
                )
                self._json({"ok": True})
                return
            if path == "/api/import":
                if self._require_admin() is None:
                    return
                payload = self._read_json(max_size=48 * 1024 * 1024)
                try:
                    content = base64.b64decode(payload.get("inhalt", ""), validate=True)
                except (ValueError, TypeError) as error:
                    raise SystemInputError("Die Excel-Datei ist ungültig.") from error
                if not content or len(content) > 32 * 1024 * 1024:
                    raise SystemInputError("Die Excel-Datei fehlt oder ist zu groß.")
                filename = Path(str(payload.get("dateiname", "dashboard.xlsx"))).name
                step = str(payload.get("schritt", "analyse"))
                analysis = _analyse_workbook(content)
                if step == "analyse":
                    self._json({"art": "TVF-Dashboard", **analysis})
                    return
                temp, database, counts = _run_import(content)
                total = sum(counts.values())
                try:
                    if step == "testlauf":
                        log_import(filename, step, "ERFOLGREICH", total)
                        self._json({"zeilen": total, "tabellen": counts, **analysis})
                        return
                    if step != "import":
                        raise SystemInputError("Der Importschritt ist ungültig.")
                    with self.data_lock:
                        _preserve_system_tables(database)
                        Handler.dashboard = _activate_import(
                            Path(temp.name),
                            database,
                            filename,
                            total,
                        )
                        Handler.scoped_dashboards.clear()
                    self._json({"importiert": total, "tabellen": counts, **analysis})
                    return
                finally:
                    temp.cleanup()
            self.send_error(404)
        except (ForecastInputError, SystemInputError) as error:
            self._json({"error": str(error)}, status=400)
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
            self._json({"error": "Die Eingabe ist ungültig."}, status=400)
        except Exception as error:
            print(f"[api] POST {path} fehlgeschlagen: {error}")
            self._json({"error": "Die Anfrage konnte nicht verarbeitet werden."}, status=500)

    def do_PATCH(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/")
        if path != "/api/users":
            self.send_error(404)
            return
        try:
            if self._require_admin() is None:
                return
            payload = self._read_json()
            changed = update_user(
                int(payload.get("benutzerId")),
                str(payload.get("aktion", "")),
                payload.get("wert"),
                bool(payload.get("an")),
            )
            Handler.scoped_dashboards.clear()
            self._json({"user": changed})
        except (SystemInputError, TypeError, ValueError) as error:
            self._json({"error": str(error)}, status=400)

    def do_DELETE(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path.rstrip("/") != "/api/report-templates":
            self.send_error(404)
            return
        try:
            user = self._require_user()
            if user is None:
                return
            template_id = int((parse_qs(parsed.query).get("id") or [""])[0])
            delete_report_template(user["id"], template_id)
            self._json({"ok": True})
        except (SystemInputError, TypeError, ValueError) as error:
            self._json({"error": str(error)}, status=400)

    def _read_json(self, max_size: int = 128 * 1024) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > max_size:
            raise SystemInputError("Die Eingabe fehlt oder ist zu groß.")
        payload = json.loads(self.rfile.read(length))
        if not isinstance(payload, dict):
            raise SystemInputError("Die Eingabe ist ungültig.")
        return payload

    @staticmethod
    def _session_cookie(value: str, max_age: int = 12 * 60 * 60) -> str:
        secure = "; Secure" if os.environ.get("TVF_COOKIE_SECURE") == "1" else ""
        return (
            f"{COOKIE}={value}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}{secure}"
        )

    def _json(self, payload, status: int = 200, headers: dict | None = None) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
        response_headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            **(headers or {}),
        }
        if "gzip" in self.headers.get("Accept-Encoding", ""):
            body = gzip.compress(body)
            response_headers["Content-Encoding"] = "gzip"
        response_headers["Content-Length"] = str(len(body))
        self.send_response(status)
        for key, value in response_headers.items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _bytes(self, body: bytes, content_type: str, filename: str) -> None:
        safe_name = filename.replace('"', "").replace("\r", "").replace("\n", "")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Disposition", f'attachment; filename="{safe_name}"')
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    ensure_system_schema()
    print("rechne Dashboard …")
    Handler.dashboard = build()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
