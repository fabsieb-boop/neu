"""Rechnet die Dashboard-Blätter aus den Quelltabellen. Keine zusätzlichen Beträge."""

from __future__ import annotations

import hashlib
import hmac
import json
import math
import os
import re
import secrets
import sqlite3
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from server.kontoauszug import KontoauszugError, format_amount_de, parse_statement

ROOT = Path(__file__).resolve().parents[1]
DB = Path(os.environ.get("TVF_DB", ROOT / "data" / "tvf.sqlite"))
MONATE = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
]
ROLLEN = ["ADMIN", "CONTROLLING", "GF", "PROJEKTLEITER", "LESEN"]
_ROLE_ALIAS = {
    "ADMIN": "ADMIN",
    "CONTROLLING": "CONTROLLING",
    "GF": "GF",
    "CHEF": "GF",
    "PROJEKTLEITER": "PROJEKTLEITER",
    "PROJEKTLEITUNG": "PROJEKTLEITER",
    "LESEN": "LESEN",
    "NEUTRAL": "LESEN",
    "SACHBEARBEITUNG": "LESEN",
    "FORECAST-PFLEGE": "CONTROLLING",
}
BENUTZER_DDL = """
CREATE TABLE IF NOT EXISTS benutzer (
    benutzer_id      INTEGER PRIMARY KEY,
    login            TEXT NOT NULL UNIQUE,
    anzeigename      TEXT NOT NULL,
    email            TEXT,
    passwort_hash    TEXT NOT NULL,
    aktiv            INTEGER NOT NULL DEFAULT 1 CHECK (aktiv IN (0, 1)),
    muss_pw_aendern  INTEGER NOT NULL DEFAULT 1 CHECK (muss_pw_aendern IN (0, 1)),
    angelegt_am      TEXT NOT NULL DEFAULT (datetime('now')),
    letzte_anmeldung TEXT
);
CREATE TABLE IF NOT EXISTS benutzer_rolle (
    benutzer_id INTEGER NOT NULL REFERENCES benutzer (benutzer_id) ON DELETE CASCADE,
    rolle_id INTEGER NOT NULL REFERENCES rolle (rolle_id),
    PRIMARY KEY (benutzer_id, rolle_id)
);
"""


class ForecastInputError(ValueError):
    pass


class SystemInputError(ValueError):
    pass


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con


def ensure_system_schema(path: Path | None = None) -> None:
    """Das Schema kommt aus dem Import. Hier entstehen keine zweiten Tabellen."""
    return None


def _json_array(raw: str | None) -> list[str]:
    try:
        value = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    return [str(item) for item in value] if isinstance(value, list) else []


def _password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    rounds = 260_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, rounds)
    return f"pbkdf2_sha256${rounds}${salt.hex()}${digest.hex()}"


def _password_matches(password: str, stored: str) -> bool:
    try:
        algorithm, rounds, salt, expected = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt), int(rounds)
        )
        return hmac.compare_digest(digest.hex(), expected)
    except (ValueError, TypeError):
        return False


def _role_code(name: str) -> str:
    return _ROLE_ALIAS.get(name, name)


def _split_name(anzeigename: str) -> tuple[str, str]:
    parts = (anzeigename or "").split(" ", 1)
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


def _table_exists(con: sqlite3.Connection, name: str) -> bool:
    return con.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (name,),
    ).fetchone() is not None


def _user_dict(con: sqlite3.Connection, row: sqlite3.Row, *, setup: bool = False) -> dict:
    rollen = [
        item["code"]
        for item in con.execute(
            """
            SELECT rolle.code
            FROM benutzer_rolle
            JOIN rolle ON rolle.rolle_id = benutzer_rolle.rolle_id
            WHERE benutzer_rolle.benutzer_id = ?
            ORDER BY rolle.rolle_id
            """,
            (row["benutzer_id"],),
        )
    ] if _table_exists(con, "benutzer_rolle") else []
    regionen = []
    if _table_exists(con, "benutzer_zugriff"):
        from server.facts import app_region
        regionen = [
            app_region(item["bezeichnung"])
            for item in con.execute(
                """
                SELECT region.bezeichnung
                FROM benutzer_zugriff
                JOIN region ON region.region_id = benutzer_zugriff.region_id
                WHERE benutzer_zugriff.benutzer_id = ? AND benutzer_zugriff.region_id IS NOT NULL
                """,
                (row["benutzer_id"],),
            )
        ]
    vorname, nachname = _split_name(row["anzeigename"] or "")
    return {
        "id": int(row["benutzer_id"]),
        "email": row["email"] or row["login"],
        "vorname": vorname,
        "nachname": nachname,
        "rollen": rollen,
        "regionen": regionen,
        "aktiv": bool(row["aktiv"]),
        "passwortOffen": bool(row["muss_pw_aendern"]),
        "letzterLogin": row["letzte_anmeldung"],
        "istAdmin": "ADMIN" in rollen,
        "regional": bool(regionen),
        "setup": setup,
    }


def bootstrap_user() -> dict:
    return {
        "id": 0,
        "email": "",
        "vorname": "System",
        "nachname": "Einrichtung",
        "rollen": ["ADMIN"],
        "regionen": [],
        "aktiv": True,
        "passwortOffen": False,
        "letzterLogin": None,
        "istAdmin": True,
        "regional": False,
        "setup": True,
    }


def user_count() -> int:
    ensure_system_schema()
    with connect() as con:
        if not _table_exists(con, "benutzer"):
            return 0
        return int(con.execute("SELECT COUNT(*) FROM benutzer").fetchone()[0])


def get_user(benutzer_id: int) -> dict | None:
    ensure_system_schema()
    with connect() as con:
        if not _table_exists(con, "benutzer"):
            return None
        row = con.execute(
            "SELECT * FROM benutzer WHERE benutzer_id = ? AND aktiv = 1",
            (benutzer_id,),
        ).fetchone()
        return _user_dict(con, row) if row else None


def authenticate(email: str, password: str) -> dict | None:
    ensure_system_schema()
    with connect() as con:
        if not _table_exists(con, "benutzer"):
            return None
        row = con.execute(
            "SELECT * FROM benutzer WHERE login = ? COLLATE NOCASE AND aktiv = 1",
            (email.strip(),),
        ).fetchone()
        if row is None or not _password_matches(password, row["passwort_hash"]):
            return None
        now = datetime.now(timezone.utc).isoformat()
        con.execute(
            "UPDATE benutzer SET letzte_anmeldung = ? WHERE benutzer_id = ?",
            (now, row["benutzer_id"]),
        )
        row = con.execute(
            "SELECT * FROM benutzer WHERE benutzer_id = ?", (row["benutzer_id"],)
        ).fetchone()
        return _user_dict(con, row)


def change_password(benutzer_id: int, current: str, new: str) -> dict:
    ensure_system_schema()
    _validate_password(new)
    with connect() as con:
        row = con.execute(
            "SELECT * FROM benutzer WHERE benutzer_id = ? AND aktiv = 1",
            (benutzer_id,),
        ).fetchone()
        if row is None or not _password_matches(current, row["passwort_hash"]):
            raise SystemInputError("Das bisherige Passwort ist falsch.")
        if _password_matches(new, row["passwort_hash"]):
            raise SystemInputError("Das neue Passwort muss sich vom bisherigen unterscheiden.")
        con.execute(
            """
            UPDATE benutzer
            SET passwort_hash = ?, muss_pw_aendern = 0
            WHERE benutzer_id = ?
            """,
            (_password_hash(new), benutzer_id),
        )
        changed = con.execute(
            "SELECT * FROM benutzer WHERE benutzer_id = ?", (benutzer_id,)
        ).fetchone()
        return _user_dict(con, changed)


def available_regions(con: sqlite3.Connection | None = None) -> list[str]:
    own = con is None
    con = con or connect()
    try:
        from server.facts import app_region
        rows = con.execute("SELECT bezeichnung FROM region ORDER BY bezeichnung")
        return [app_region(row["bezeichnung"]) for row in rows]
    finally:
        if own:
            con.close()


def list_users() -> dict:
    ensure_system_schema()
    with connect() as con:
        if _table_exists(con, "benutzer"):
            users = [_user_dict(con, row) for row in con.execute("SELECT * FROM benutzer ORDER BY login")]
        else:
            users = []
        regions = available_regions(con)
    return {"nutzer": users, "rollen": ROLLEN, "regionen": regions}


def _validate_password(password: str) -> None:
    if len(password) < 12 or not re.search(r"[A-Za-zÄÖÜäöüß]", password) or not re.search(r"\d", password):
        raise SystemInputError(
            "Das Passwort braucht mindestens 12 Zeichen, einen Buchstaben und eine Ziffer."
        )


def create_user(
    email: str,
    password: str,
    vorname: str = "",
    nachname: str = "",
    rolle: str = "NEUTRAL",
) -> dict:
    ensure_system_schema()
    email = email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise SystemInputError("Bitte eine gültige E-Mail-Adresse eingeben.")
    _validate_password(password)
    first = user_count() == 0
    selected_role = "ADMIN" if first else _role_code(rolle)
    if selected_role not in ROLLEN:
        raise SystemInputError("Die Rolle ist ungültig.")
    anzeigename = f"{vorname.strip()} {nachname.strip()}".strip() or email
    try:
        with connect() as con:
            con.executescript(BENUTZER_DDL)
            cursor = con.execute(
                """
                INSERT INTO benutzer
                  (login, anzeigename, email, passwort_hash, muss_pw_aendern)
                VALUES (?, ?, ?, ?, 1)
                """,
                (email, anzeigename, email, _password_hash(password)),
            )
            rolle_id = con.execute(
                "SELECT rolle_id FROM rolle WHERE code = ?",
                (selected_role,),
            ).fetchone()[0]
            con.execute(
                "INSERT INTO benutzer_rolle (benutzer_id, rolle_id) VALUES (?, ?)",
                (cursor.lastrowid, rolle_id),
            )
            row = con.execute(
                "SELECT * FROM benutzer WHERE benutzer_id = ?", (cursor.lastrowid,)
            ).fetchone()
            return _user_dict(con, row)
    except sqlite3.IntegrityError as error:
        raise SystemInputError("Diese E-Mail-Adresse ist bereits angelegt.") from error


def update_user(benutzer_id: int, action: str, value, enabled: bool) -> dict:
    ensure_system_schema()
    with connect() as con:
        row = con.execute(
            "SELECT * FROM benutzer WHERE benutzer_id = ?", (benutzer_id,)
        ).fetchone()
        if row is None:
            raise SystemInputError("Der Benutzer wurde nicht gefunden.")
        current = _user_dict(con, row)
        roles = list(current["rollen"])
        regions = list(current["regionen"])
        if action == "rolle":
            role = _role_code(str(value))
            if role not in ROLLEN:
                raise SystemInputError("Die Rolle ist ungültig.")
            if enabled and role not in roles:
                con.executescript(BENUTZER_DDL)
                rolle_id = con.execute("SELECT rolle_id FROM rolle WHERE code = ?", (role,)).fetchone()[0]
                con.execute(
                    "INSERT OR IGNORE INTO benutzer_rolle (benutzer_id, rolle_id) VALUES (?, ?)",
                    (benutzer_id, rolle_id),
                )
            if not enabled and role in roles:
                if role == "ADMIN" and bool(row["aktiv"]):
                    others = con.execute(
                        """
                        SELECT COUNT(*) FROM benutzer_rolle
                        JOIN rolle ON rolle.rolle_id = benutzer_rolle.rolle_id
                        JOIN benutzer ON benutzer.benutzer_id = benutzer_rolle.benutzer_id
                        WHERE rolle.code = 'ADMIN' AND benutzer.aktiv = 1 AND benutzer.benutzer_id <> ?
                        """,
                        (benutzer_id,),
                    ).fetchone()[0]
                    if not others:
                        raise SystemInputError("Der letzte aktive ADMIN kann nicht entfernt werden.")
                con.execute(
                    """
                    DELETE FROM benutzer_rolle
                    WHERE benutzer_id = ? AND rolle_id = (SELECT rolle_id FROM rolle WHERE code = ?)
                    """,
                    (benutzer_id, role),
                )
                if not con.execute(
                    "SELECT 1 FROM benutzer_rolle WHERE benutzer_id = ?",
                    (benutzer_id,),
                ).fetchone():
                    lese = con.execute("SELECT rolle_id FROM rolle WHERE code = 'LESEN'").fetchone()[0]
                    con.execute(
                        "INSERT INTO benutzer_rolle (benutzer_id, rolle_id) VALUES (?, ?)",
                        (benutzer_id, lese),
                    )
        elif action == "region":
            from scripts.import_excel import BENUTZER_ZUGRIFF_DDL
            from server.facts import APP_REGION
            region = str(value)
            if region not in available_regions(con):
                raise SystemInputError("Die Region ist ungültig.")
            stored = {label: code for code, label in APP_REGION.items()}
            bezeichnung = stored.get(region, region)
            region_row = con.execute(
                "SELECT region_id FROM region WHERE bezeichnung = ?",
                (bezeichnung,),
            ).fetchone()
            if region_row is None:
                raise SystemInputError("Die Region ist ungültig.")
            con.executescript(BENUTZER_ZUGRIFF_DDL)
            if enabled and region not in regions:
                con.execute(
                    """
                    INSERT INTO benutzer_zugriff (benutzer_id, region_id, darf_schreiben)
                    VALUES (?, ?, 0)
                    """,
                    (benutzer_id, region_row["region_id"]),
                )
            if not enabled and region in regions:
                con.execute(
                    """
                    DELETE FROM benutzer_zugriff
                    WHERE benutzer_id = ? AND region_id = ?
                    """,
                    (benutzer_id, region_row["region_id"]),
                )
        elif action == "aktiv":
            if not enabled and "ADMIN" in roles:
                others = con.execute(
                    """
                    SELECT COUNT(*) FROM benutzer_rolle
                    JOIN rolle ON rolle.rolle_id = benutzer_rolle.rolle_id
                    JOIN benutzer ON benutzer.benutzer_id = benutzer_rolle.benutzer_id
                    WHERE rolle.code = 'ADMIN' AND benutzer.aktiv = 1 AND benutzer.benutzer_id <> ?
                    """,
                    (benutzer_id,),
                ).fetchone()[0]
                if not others:
                    raise SystemInputError("Der letzte aktive ADMIN kann nicht deaktiviert werden.")
            con.execute(
                "UPDATE benutzer SET aktiv = ? WHERE benutzer_id = ?",
                (int(enabled), benutzer_id),
            )
        else:
            raise SystemInputError("Die Änderung ist ungültig.")
        changed = con.execute(
            "SELECT * FROM benutzer WHERE benutzer_id = ?", (benutzer_id,)
        ).fetchone()
        return _user_dict(con, changed)


def user_regions(user: dict) -> set[str] | None:
    regions = {str(region) for region in user.get("regionen") or []}
    return regions or None


_AUFTRAG_NR = re.compile(r"^[PW]\d{8,}$")
_AUFTRAG_PSP = re.compile(r"^[PW]4102(\d{5,6}(?:-\d{2})?)$")
_OHNE_STAMM = "Ohne Zuordnung"
_REGION_CODE = {"West": "15", "Süd-West": "30", "Ost": "60", "Berlin": "65", "Verwaltung": "50"}
_PSP_REGION = {code: name for name, code in _REGION_CODE.items()}
_KV_REGION = {
    "West": "Dortmund",
    "Süd-West": "Region Südwest",
    "Ost": "Region Ost",
    "Berlin": "Region Berlin",
    "Verwaltung": "Verwaltung",
}


def psp_from_auftrag(auftrag: str) -> str:
    """PSP ist der Teil hinter P4102 oder W4102, wie 307452 bei P4102307452."""
    match = _AUFTRAG_PSP.fullmatch(auftrag.strip())
    return match.group(1) if match else ""


def region_for_psp(psp: str) -> str:
    return _PSP_REGION.get(psp[:2], "")


def order_region(nr: str, stamm_row: dict | None, plan_row: dict | None, *, ohne_stamm: bool) -> str:
    """Region aus dem Projektstamm, sonst aus der PSP in der Auftragsnummer."""
    if stamm_row and stamm_row.get("region"):
        return str(stamm_row["region"])
    derived = region_for_psp(psp_from_auftrag(nr))
    if derived:
        return derived
    if plan_row and plan_row.get("region") and plan_row["region"] != _OHNE_STAMM:
        return str(plan_row["region"])
    if ohne_stamm:
        return _OHNE_STAMM
    return str(plan_row["region"]) if plan_row and plan_row.get("region") else ""


def journal_title(rows: list[dict], nr: str) -> str:
    counts: dict[str, int] = {}
    for row in rows:
        if row.get("projekt_nr") != nr:
            continue
        text = str(row.get("text") or "").strip()
        if not text or text.lower().startswith("zu erw"):
            continue
        counts[text] = counts.get(text, 0) + 1
    if not counts:
        return ""
    return max(counts, key=lambda item: (counts[item], len(item)))[:120]


def journal_orders_without_master(con: sqlite3.Connection) -> list[str]:
    """Journal-Aufträge, die erst beim Import zur Akte geworden sind."""
    rows = con.execute(
        """
        SELECT auftragsnr FROM projekt
        WHERE bemerkung = 'Journal'
        ORDER BY auftragsnr
        """
    )
    return [row["auftragsnr"] for row in rows]


def _forecast_target(con: sqlite3.Connection, projekt_nr: str) -> dict | None:
    from server.facts import app_region
    row = con.execute(
        """
        SELECT p.projekt_id, p.auftragsnr, p.bezeichnung, p.phase, r.bezeichnung AS region_name
        FROM projekt p
        JOIN region r ON r.region_id = p.region_id
        WHERE p.auftragsnr = ?
        """,
        (projekt_nr,),
    ).fetchone()
    if row is None or row["phase"] != "LAUFEND" or row["auftragsnr"] in {"OVERHEAD", "BEWERTUNG"}:
        return None
    return {
        "projekt_id": row["projekt_id"],
        "projekt_nr": row["auftragsnr"],
        "name": row["bezeichnung"],
        "region": app_region(row["region_name"]),
    }


def add_forecast_plan(
    projekt_nr: str,
    groesse: str,
    werte: list[dict],
    allowed_regions: set[str] | None = None,
) -> list[dict]:
    projekt_nr = projekt_nr.strip() if isinstance(projekt_nr, str) else ""
    if not projekt_nr:
        raise ForecastInputError("Bitte einen aktiven Auftrag wählen.")
    if groesse not in {"umsatz", "kosten", "ba"}:
        raise ForecastInputError("Die Forecast-Art ist ungültig.")
    if not isinstance(werte, list) or not werte or len(werte) > 12:
        raise ForecastInputError("Bitte mindestens einen Monatswert eingeben.")

    prepared: list[tuple[int, float]] = []
    monate: set[int] = set()
    for item in werte:
        if not isinstance(item, dict):
            raise ForecastInputError("Ein Monatswert ist ungültig.")
        monat = item.get("monat")
        wert = item.get("wert")
        if isinstance(monat, bool) or not isinstance(monat, int) or monat < 1 or monat > 12:
            raise ForecastInputError("Der Monat ist ungültig.")
        if monat in monate:
            raise ForecastInputError("Ein Monat darf nur einmal gespeichert werden.")
        if isinstance(wert, bool) or not isinstance(wert, (int, float)) or not math.isfinite(wert) or wert == 0:
            raise ForecastInputError("Der Betrag ist ungültig.")
        monate.add(monat)
        prepared.append((monat, float(wert)))

    ensure_system_schema()
    con = connect()
    try:
        version = con.execute(
            """
            SELECT version_id, geschaeftsjahr, ist_bis_periode
            FROM forecast_version
            WHERE typ = 'ROLLING_FORECAST' AND ist_aktiv = 1
            """
        ).fetchone()
        projekt = _forecast_target(con, projekt_nr) if version is not None else None
        if version is None or projekt is None:
            raise ForecastInputError("Der aktive Auftrag wurde nicht gefunden.")
        letzter = int(version["ist_bis_periode"])
        if any(monat <= letzter for monat, _ in prepared):
            raise ForecastInputError(
                "Forecast-Werte sind nur für Monate nach dem letzten Ist-Monat zulässig."
            )
        if allowed_regions is not None and projekt["region"] not in allowed_regions:
            raise ForecastInputError("Der Auftrag gehört nicht zu Ihrer Region.")
        con.execute(
            """
            INSERT OR IGNORE INTO forecast_projekt (version_id, projekt_id)
            VALUES (?, ?)
            """,
            (version["version_id"], projekt["projekt_id"]),
        )
        wertart = {"umsatz": "UMSATZ", "kosten": "KOSTEN", "ba": "BESTANDSVERAENDERUNG"}[groesse]
        saved = []
        for monat, angezeigt in prepared:
            monat_iso = f"{int(version['geschaeftsjahr'])}-{monat:02d}-01"
            con.execute(
                """
                INSERT INTO forecast_wert
                  (version_id, projekt_id, monat, wertart, betrag_plan)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (version_id, projekt_id, monat, wertart, COALESCE(kostenart_id, 0))
                DO UPDATE SET betrag_plan = excluded.betrag_plan
                """,
                (version["version_id"], projekt["projekt_id"], monat_iso, wertart, angezeigt),
            )
            saved.append(
                {
                    "jahr": int(version["geschaeftsjahr"]),
                    "region": projekt["region"],
                    "nr": projekt["projekt_nr"],
                    "name": projekt["name"],
                    "groesse": groesse,
                    "art": "plan",
                    "monat": monat,
                    "wert": angezeigt,
                }
            )
        con.commit()
        return saved
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def create_projektakte(
    auftrag: str,
    name: str,
    region: str,
    allowed_regions: set[str] | None = None,
) -> dict:
    """Legt die Projektakte für einen Journal-Auftrag an und hängt die Belege an."""
    auftrag = auftrag.strip() if isinstance(auftrag, str) else ""
    name = name.strip() if isinstance(name, str) else ""
    region = region.strip() if isinstance(region, str) else ""
    psp = psp_from_auftrag(auftrag)
    if not psp:
        raise ForecastInputError(
            "Aus dieser Auftragsnummer ergibt sich keine PSP-Nummer. "
            "Bei den Projektakten steht sie hinter P4102 oder W4102, zum Beispiel 307452 bei P4102307452."
        )
    if not name:
        raise ForecastInputError("Bitte einen Namen für die Projektakte eintragen.")
    if len(name) > 200:
        raise ForecastInputError("Der Name ist zu lang.")
    if not region:
        region = region_for_psp(psp)
    if region not in _REGION_CODE:
        raise ForecastInputError("Die Region ist unbekannt.")
    if allowed_regions is not None and region not in allowed_regions:
        raise ForecastInputError("Der Auftrag gehört nicht zu Ihrer Region.")

    con = connect()
    try:
        existing = con.execute(
            "SELECT auftragsnr FROM projekt WHERE auftragsnr = ?",
            (auftrag,),
        ).fetchone()
        if existing is not None:
            raise ForecastInputError("Die Projektakte steht schon im Projektstamm.")
        other = con.execute(
            "SELECT auftragsnr FROM projekt WHERE psp = ? AND auftragsnr <> ?",
            (psp, auftrag),
        ).fetchone()
        if other is not None:
            raise ForecastInputError(
                f"Die PSP-Nummer {psp} gehört bereits zur Akte {other['auftragsnr']}."
            )
        from server.facts import APP_REGION
        bezeichnung = {label: code for code, label in APP_REGION.items()}.get(region, region)
        region_row = con.execute(
            "SELECT region_id, code FROM region WHERE bezeichnung = ?",
            (bezeichnung,),
        ).fetchone()
        if region_row is None:
            raise ForecastInputError("Die Region ist unbekannt.")
        stelle = con.execute(
            """
            SELECT kostenstelle_id FROM kostenstelle
            WHERE region_id = ? AND typ = 'PROJEKT'
            """,
            (region_row["region_id"],),
        ).fetchone()
        if stelle is None:
            cursor = con.execute(
                """
                INSERT INTO kostenstelle (nummer, bezeichnung, region_id, typ)
                VALUES (?, ?, ?, 'PROJEKT')
                """,
                (f"{region_row['code']}-PROJEKT", f"{bezeichnung} PROJEKT", region_row["region_id"]),
            )
            stelle_id = cursor.lastrowid
        else:
            stelle_id = stelle["kostenstelle_id"]
        cursor = con.execute(
            """
            INSERT INTO projekt
              (auftragsnr, psp, bezeichnung, region_id, kostenstelle_id, phase, vertragsumsatz)
            VALUES (?, ?, ?, ?, ?, 'LAUFEND', 0)
            """,
            (auftrag, psp, name, region_row["region_id"], stelle_id),
        )
        con.commit()
        return {
            "nr": auftrag,
            "name": name,
            "region": region,
            "psp": psp,
            "belege": 0,
        }
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def read_ist_cutoff(con: sqlite3.Connection) -> tuple[int, int, bool]:
    rolling = con.execute(
        """
        SELECT geschaeftsjahr, ist_bis_periode
        FROM forecast_version
        WHERE typ = 'ROLLING_FORECAST' AND ist_aktiv = 1
        """
    ).fetchone()
    sheet_row = con.execute(
        """
        SELECT ist_bis_periode FROM forecast_version
        WHERE typ = 'PLAN' AND geschaeftsjahr = ?
        """,
        (rolling["geschaeftsjahr"],),
    ).fetchone()
    letzter = int(rolling["ist_bis_periode"])
    sheet = int(sheet_row["ist_bis_periode"])
    return letzter, sheet, letzter != sheet


def set_ist_freigabe(monat: int | None) -> dict:
    if monat is not None and (
        isinstance(monat, bool) or not isinstance(monat, int) or monat < 1 or monat > 12
    ):
        raise SystemInputError("Der Monat ist ungültig.")
    ensure_system_schema()
    con = connect()
    try:
        rolling = con.execute(
            """
            SELECT version_id, geschaeftsjahr FROM forecast_version
            WHERE typ = 'ROLLING_FORECAST' AND ist_aktiv = 1
            """
        ).fetchone()
        jahr = int(rolling["geschaeftsjahr"])
        if monat is None:
            sheet = con.execute(
                """
                SELECT ist_bis_periode FROM forecast_version
                WHERE typ = 'PLAN' AND geschaeftsjahr = ?
                """,
                (jahr,),
            ).fetchone()["ist_bis_periode"]
            ziel = int(sheet)
        else:
            ziel = monat
        con.execute(
            "UPDATE forecast_version SET ist_bis_periode = ? WHERE version_id = ?",
            (ziel, rolling["version_id"]),
        )
        con.commit()
        letzter, sheet_monat, gesetzt = read_ist_cutoff(con)
        return {"jahr": jahr, "monat": letzter, "mappeMonat": sheet_monat, "gesetzt": gesetzt}
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def guv_matrix(con: sqlite3.Connection) -> list[dict]:
    from server.facts import adjustments, guv_matrix as matrix, plans, settings
    stand = settings(con)
    return matrix(con, stand["letzter"], plans(con, stand["jahr"]), adjustments(con, stand["jahr"]))


def row_values(guv: list[dict], zeile: int) -> list[float]:
    return next(g["values"] for g in guv if g["zeile"] == zeile)


def liquidity(monate: list[dict], stichtag: date, dso: float, dpo: float, start: float) -> list[dict]:
    prepared = []
    for row in monate:
        ein = date(row["jahr"], row["monat"], 1) + timedelta(days=dso)
        aus = date(row["jahr"], row["monat"], 1) + timedelta(days=dpo)
        prepared.append({**row, "kosten": row["umsatz"] - row["ebitda"], "ziel_ein": (ein.year, ein.month), "ziel_aus": (aus.year, aus.month)})
    monday = stichtag - timedelta(days=stichtag.weekday())
    weeks = [{"datum": (monday + timedelta(days=7 * i)).isoformat(), "jahr": (monday + timedelta(days=7 * i)).year, "monat": (monday + timedelta(days=7 * i)).month} for i in range(26)]
    counts: dict[tuple[int, int], int] = {}
    for week in weeks:
        key = (week["jahr"], week["monat"])
        counts[key] = counts.get(key, 0) + 1
    bestand = start
    for week in weeks:
        key = (week["jahr"], week["monat"])
        teiler = counts[key]
        ein = sum(r["umsatz"] for r in prepared if r["ziel_ein"] == key) / teiler
        aus = sum(r["kosten"] for r in prepared if r["ziel_aus"] == key) / teiler
        netto = ein - aus
        bestand += netto
        week.update({"ein": ein, "aus": aus, "netto": netto, "bestand": bestand})
    return weeks


def _guv_month(guv: list[dict], name: str, monat: int) -> float:
    row = next(item for item in guv if item["name"] == name)
    value = row["values"][monat - 1]
    return 0.0 if value is None else float(value)


def _guv_ist(guv: list[dict], name: str, monat: int) -> float:
    row = next(item for item in guv if item["name"] == name)
    value = row["ist"][monat - 1]
    return 0.0 if value is None else float(value)


def build(allowed_regions: set[str] | None = None) -> dict:
    from server import facts
    ensure_system_schema()
    con = connect()
    stand = facts.settings(con)
    jahr = stand["jahr"]
    letzter = stand["letzter"]
    mappe_monat = stand["sheet"]
    freigabe_gesetzt = stand["gesetzt"]
    stichtag = date.fromisoformat(stand["stichtag"])
    zeilen = facts.lines(con, jahr)
    plaene = facts.plans(con, jahr)
    company = facts.adjustments(con, jahr)
    guv = facts.guv_matrix(con, letzter, plaene, company)
    stamm_liste = facts.projects(con)
    stamm = {row["nr"]: row for row in stamm_liste}
    journal_only = {row["nr"] for row in stamm_liste if row["bemerkung"] == "Journal"}
    if allowed_regions is not None:
        zeilen = [row for row in zeilen if row["region"] in allowed_regions]
        plaene = [row for row in plaene if row["region"] in allowed_regions]
        stamm = {nr: row for nr, row in stamm.items() if row["region"] in allowed_regions}
        journal_only = {nr for nr in journal_only if nr in stamm}

    def passt(z, nr, monat=None, gruppe=None):
        if z["projekt_nr"] != nr or not z["ergebnisrelevant"]:
            return False
        if z["kostentraeger"] != "Projekt":
            return False
        if monat is not None and z["monat"] != monat:
            return False
        if gruppe is not None and z["guv_gruppe"] != gruppe:
            return False
        return True

    kenn = []
    for m in range(1, 13):
        ist = m <= letzter
        umsatz = _guv_month(guv, "Umsatzerloese", m)
        bestand = _guv_month(guv, "Bestandsveraenderung", m)
        sonstige = _guv_month(guv, "Sonstige betriebliche Ertraege", m)
        ebitda_guv = _guv_month(guv, "EBITDA", m)
        abschr = _guv_month(guv, "Abschreibungen", m)
        finanz = _guv_month(guv, "Zinsen und Steuern", m)
        neutral = _guv_month(guv, "Neutrales Ergebnis", m)
        steuern = _guv_month(guv, "Sonstige Steuern", m)
        kenn.append({
            "m": m, "name": MONATE[m - 1], "ist": ist, "umsatz": umsatz, "bestand": bestand,
            "sonstige": sonstige, "leistung": umsatz + bestand, "ebitdaGuV": ebitda_guv,
            "abschreibungen": abschr, "finanzergebnis": finanz, "steuern": steuern, "neutral": neutral,
            "offen": m == letzter + 1,
            "auftragsergebnis": sum(z["ergebnis_akte"] for z in zeilen if z["monat"] == m) if ist or m == letzter + 1 else 0.0,
        })

    for row in kenn:
        plan_sums: dict[str, float] = {}
        for eintrag in plaene:
            if eintrag["monat"] == row["m"] and eintrag["art"] == "plan":
                plan_sums[eintrag["groesse"]] = plan_sums.get(eintrag["groesse"], 0.0) + eintrag["wert"]
        operativ = plan_sums.get("umsatz", 0.0) + plan_sums.get("ba", 0.0) - plan_sums.get("kosten", 0.0)
        overhead = -company[row["m"]]["overhead"]
        bewertet = company[row["m"]]["bewertung"]
        row["operativ"] = operativ
        row["overhead"] = overhead
        row["bewertungPlan"] = bewertet
        row["bewertungOffen"] = 0.0
        row["ebitda"] = row["ebitdaGuV"] if row["ist"] else operativ + overhead + bewertet
        row["umsatzIst"] = _guv_ist(guv, "Umsatzerloese", row["m"])
        row["bestandIst"] = _guv_ist(guv, "Bestandsveraenderung", row["m"])
        row["leistungIst"] = row["umsatzIst"] + row["bestandIst"]
        row["ebitdaIst"] = _guv_ist(guv, "EBITDA", row["m"])

    forecast = []
    for m in range(1, 13):
        ist = m <= letzter
        journal = sum(
            z["leistung"] for z in zeilen
            if z["monat"] == m and z["ergebnisrelevant"] and z["kostentraeger"] == "Projekt"
        )
        sums: dict[str, float] = {}
        for eintrag in plaene:
            if eintrag["monat"] == m and eintrag["art"] == "plan":
                sums[eintrag["groesse"]] = sums.get(eintrag["groesse"], 0.0) + eintrag["wert"]
        umsatz_plan = 0.0 if ist else sums.get("umsatz", 0.0)
        kosten_plan = 0.0 if ist else sums.get("kosten", 0.0)
        bestand_plan = 0.0 if ist else sums.get("ba", 0.0)
        forecast.append({
            "m": m, "name": MONATE[m - 1], "ist": ist, "leistungJournal": journal,
            "umsatzPlan": None if ist else umsatz_plan,
            "kostenPlan": None if ist else kosten_plan,
            "bestandPlan": None if ist else bestand_plan,
            "offen": m == letzter + 1,
            "angezeigt": journal if ist else umsatz_plan + bestand_plan - kosten_plan,
        })

    def planwert(nr: str, monat: int) -> float:
        sums: dict[str, float] = {}
        for eintrag in plaene:
            if eintrag["monat"] == monat and eintrag["auftrag"] == nr and eintrag["art"] == "plan":
                sums[eintrag["groesse"]] = sums.get(eintrag["groesse"], 0.0) + eintrag["wert"]
        return sums.get("umsatz", 0.0) + sums.get("ba", 0.0) - sums.get("kosten", 0.0)

    def leistung_und_kosten(nr: str, monat: int) -> tuple[float, float]:
        treffer = [z for z in zeilen if passt(z, nr, monat=monat)]
        return (
            sum(z["leistung"] for z in treffer),
            sum(z["kvar"] + z["kfix"] + z["umlage"] for z in treffer),
        )

    def gebucht(nr: str, monat: int) -> tuple[float, float, float]:
        if nr in journal_only:
            leistung, kosten = leistung_und_kosten(nr, monat)
            return leistung - kosten, leistung, kosten
        leistung = sum(
            z["leistung"] for z in zeilen
            if z["monat"] == monat and z["projekt_nr"] == nr and z["ergebnisrelevant"] and z["kostentraeger"] == "Projekt"
        )
        return leistung, leistung, 0.0

    def serie(nr: str) -> tuple[list[float], list[float], list[float], list[float]]:
        gezeigt: list[float] = []
        leistung_monate: list[float] = []
        kosten_monate: list[float] = []
        ist_monate: list[float] = []
        for m in range(1, 13):
            ist_wert, leistung, kosten = gebucht(nr, m)
            ist_monate.append(ist_wert)
            if m <= letzter:
                gezeigt.append(ist_wert)
                leistung_monate.append(leistung)
                kosten_monate.append(kosten)
            else:
                gezeigt.append(planwert(nr, m))
                leistung_monate.append(leistung if m == letzter + 1 else 0.0)
                kosten_monate.append(kosten if m == letzter + 1 else 0.0)
        return gezeigt, leistung_monate, kosten_monate, ist_monate

    def order_name(nr: str) -> str:
        row = stamm.get(nr)
        if row and row["name"]:
            return row["name"]
        return journal_title(zeilen, nr)

    orders = []
    for nr, row in stamm.items():
        if row["typ"] != "PROJEKT":
            continue
        if allowed_regions is not None and row["region"] not in allowed_regions:
            continue
        leistung = sum(z["leistung"] for z in zeilen if passt(z, nr))
        kvar = sum(z["kvar"] for z in zeilen if passt(z, nr))
        kfix = sum(z["kfix"] for z in zeilen if passt(z, nr))
        umlage = sum(z["umlage"] for z in zeilen if passt(z, nr))
        ergebnis_db = sum(z["ergebnis_db"] for z in zeilen if z["projekt_nr"] == nr)
        orders.append({
            "nr": nr,
            "name": order_name(nr),
            "region": row["region"],
            "status": row["status"],
            "leistung": leistung, "kvar": kvar, "kfix": kfix, "umlage": umlage,
            "db": ergebnis_db, "akte": leistung - (kvar + kfix + umlage), "abgrenzung": ergebnis_db - (leistung - (kvar + kfix + umlage)),
        })

    regionen = []
    for name in sorted({row["region"] for row in stamm.values()}):
        if allowed_regions is not None and name not in allowed_regions:
            continue
        akte, fc, umsatz = [], [], []
        for m in range(1, 13):
            akte.append(sum(z["ergebnis_akte"] for z in zeilen if z["monat"] == m and z["region"] == name))
            umsatz.append(sum(
                z["leistung"] for z in zeilen
                if z["monat"] == m and z["region"] == name and z["guv_gruppe"] == "Umsatzerloese"
            ))
            if m <= letzter:
                fc.append(None)
            else:
                fc.append(sum(
                    eintrag["wert"] for eintrag in plaene
                    if eintrag["region"] == name and eintrag["groesse"] == "umsatz" and eintrag["monat"] == m and eintrag["art"] == "plan"
                ))
        regionen.append({"region": name, "akte": akte, "forecast": fc, "umsatz": umsatz})

    nummern = []
    gesehen = set()
    for nr in [row["nr"] for row in stamm_liste if row["typ"] == "PROJEKT"] + [eintrag["auftrag"] for eintrag in plaene]:
        if nr and nr not in gesehen and (allowed_regions is None or stamm.get(nr, {}).get("region") in allowed_regions or nr in stamm):
            if allowed_regions is not None and nr not in stamm:
                continue
            gesehen.add(nr)
            nummern.append(nr)
    forecast_orders = []
    for nr in nummern:
        row = stamm.get(nr)
        gezeigt, leistung_monate, kosten_monate, ist_monate = serie(nr)
        forecast_orders.append({
            "nr": nr,
            "name": order_name(nr),
            "region": row["region"] if row else "",
            "status": row["status"] if row else "",
            "psp": (row["psp"] if row else "") or psp_from_auftrag(nr),
            "monate": gezeigt,
            "leistungMonate": leistung_monate,
            "kostenMonate": kosten_monate,
            "istMonate": ist_monate,
        })

    def auftrag_detail(nr: str) -> dict:
        umsatz = sum(z["leistung"] for z in zeilen if passt(z, nr, gruppe="Umsatzerloese"))
        bestand_a = sum(z["leistung"] for z in zeilen if passt(z, nr, gruppe="Bestandsveraenderung"))
        kvar = sum(z["kvar"] for z in zeilen if passt(z, nr))
        kfix = sum(z["kfix"] for z in zeilen if passt(z, nr))
        umlage = sum(z["umlage"] for z in zeilen if passt(z, nr))
        ergebnis_db = sum(z["ergebnis_db"] for z in zeilen if z["projekt_nr"] == nr)
        monate = []
        for m in range(1, 13):
            leistung = sum(z["leistung"] for z in zeilen if passt(z, nr, monat=m))
            kosten = sum(z["kvar"] + z["kfix"] + z["umlage"] for z in zeilen if passt(z, nr, monat=m))
            monate.append({"m": m, "name": MONATE[m - 1], "leistung": leistung, "kosten": kosten, "ergebnis": leistung - kosten})
        return {
            "umsatz": umsatz, "bestand": bestand_a, "leistung": umsatz + bestand_a,
            "kvar": kvar, "kfix": kfix, "umlage": umlage, "kosten": kvar + kfix + umlage,
            "db1": umsatz + bestand_a - kvar, "db2": umsatz + bestand_a - kvar - kfix,
            "akte": umsatz + bestand_a - (kvar + kfix + umlage), "ergebnisDb": ergebnis_db,
            "belege": sum(1 for z in zeilen if z["projekt_nr"] == nr),
            "monate": monate,
        }

    kosten_rows = []
    for row in facts.kv_rows(con):
        if allowed_regions is not None and row["region"] not in allowed_regions:
            continue
        nr = row["nr"]
        umsatz_sap = sum(z["leistung"] for z in zeilen if passt(z, nr, gruppe="Umsatzerloese"))
        kosten_sap = sum(z["kvar"] + z["kfix"] + z["umlage"] for z in zeilen if passt(z, nr))
        ergebnis_sap = sum(z["ergebnis_akte"] for z in zeilen if z["projekt_nr"] == nr)
        kosten_rows.append({
            **row,
            "umsatzSap": umsatz_sap,
            "kostenSap": kosten_sap,
            "ergebnisSap": ergebnis_sap,
            "delta": ergebnis_sap - row["ergebnisMeldung"],
        })

    dso, dpo, start = stand["dso"], stand["dpo"], stand["start"]
    weeks = liquidity(
        [{"jahr": jahr, "monat": row["m"], "umsatz": row["umsatz"], "ebitda": row["ebitda"]} for row in kenn],
        stichtag,
        dso,
        dpo,
        start,
    )
    details = {row["nr"]: auftrag_detail(row["nr"]) for row in orders}
    if allowed_regions is None or stand["auftrag"] in stamm:
        if stand["auftrag"]:
            details.setdefault(stand["auftrag"], auftrag_detail(stand["auftrag"]))

    regional_months = []
    if allowed_regions is not None:
        for m in range(1, 13):
            rows = [row for row in zeilen if row["monat"] == m]
            regional_months.append({
                "m": m,
                "name": MONATE[m - 1],
                "ist": m <= letzter,
                "umsatz": sum(row["leistung"] for row in rows if row["guv_gruppe"] == "Umsatzerloese"),
                "bestand": sum(row["leistung"] for row in rows if row["guv_gruppe"] == "Bestandsveraenderung"),
                "sonstige": sum(row["leistung"] for row in rows if row["guv_gruppe"] == "Sonstige betriebliche Ertraege"),
                "leistung": sum(row["leistung"] for row in rows),
                "ergebnis": sum(row["ergebnis_akte"] for row in rows),
            })

    cash, bank_accounts = facts.bank_balances(con)
    payload = {
        "jahr": jahr,
        "letzterIst": letzter,
        "letzterIstName": MONATE[letzter - 1],
        "aktuellerMonat": letzter + 1 if letzter < 12 else None,
        "aktuellerMonatName": MONATE[letzter] if letzter < 12 else None,
        "mappeMonat": mappe_monat,
        "mappeMonatName": MONATE[mappe_monat - 1],
        "freigabeGesetzt": freigabe_gesetzt,
        "stichtag": stand["stichtag"],
        "auftragsnummer": stand["auftrag"],
        "monate": MONATE,
        "months": kenn if allowed_regions is None else [],
        "regionalMonths": regional_months,
        "forecast": forecast,
        "guv": guv if allowed_regions is None else [],
        "orders": orders,
        "forecastOrders": forecast_orders,
        "regions": regionen,
        "verluste": [],
        "konto": bank_accounts if allowed_regions is None else [],
        "kostenarten": facts.accounts(con),
        "legende": [],
        "liqParameter": [
            {"key": row["key"], "wert": row["wert"], "einheit": row["einheit"], "text": row["text"]}
            for row in facts.parameters(con)
        ] if allowed_regions is None else [],
        "parameter": [
            {"name": "Jahr", "wert": str(jahr)},
            {"name": "Letzter Ist-Monat", "wert": MONATE[letzter - 1]},
            {"name": "Ist-Monat der Mappe", "wert": MONATE[mappe_monat - 1]},
            {"name": "Stichtag", "wert": stichtag.strftime("%d.%m.%Y")},
            {"name": "DSO", "wert": f"{dso:g} Tage"},
            {"name": "DPO", "wert": f"{dpo:g} Tage"},
            {"name": "Cash-Pool", "wert": start},
        ] if allowed_regions is None else [
            {"name": "Jahr", "wert": str(jahr)},
            {"name": "Letzter Ist-Monat", "wert": MONATE[letzter - 1]},
            {"name": "Ist-Monat der Mappe", "wert": MONATE[mappe_monat - 1]},
            {"name": "Stichtag", "wert": stichtag.strftime("%d.%m.%Y")},
        ],
        "projektstamm": [
            {
                "id": row["id"], "nr": row["nr"], "name": row["name"], "typ": row["typ"],
                "region": row["region"], "status": row["status"],
                "budgetUmsatz": row["budgetUmsatz"], "budgetKosten": row["budgetKosten"],
            }
            for row in stamm_liste
            if allowed_regions is None or row["region"] in allowed_regions
        ],
        "kostenverfolgung": kosten_rows,
        "liqBestand": cash if allowed_regions is None else [],
        "forecastPlan": [
            {
                "region": row["region"], "nr": row["auftrag"], "name": row["auftragname"],
                "groesse": row["groesse"], "art": row["art"], "monat": row["monat"], "wert": row["wert"],
            }
            for row in plaene
        ],
        "liquidity": {
            "start": start if allowed_regions is None else 0,
            "dso": dso if allowed_regions is None else 0,
            "dpo": dpo if allowed_regions is None else 0,
            "weeks": weeks if allowed_regions is None else [],
        },
        "bank": _bank_overview(con, allowed_regions is None),
        "auftragDetail": details,
        "scope": {
            "regional": allowed_regions is not None,
            "regions": sorted(allowed_regions) if allowed_regions is not None else [],
        },
    }
    con.close()
    return payload


def booking_region(nr: str, region: str, offene: set[str]) -> str:
    """Region der Buchung. Fehlt der Stamm, gilt die PSP in der Auftragsnummer."""
    if region != _OHNE_STAMM or nr not in offene:
        return region
    return region_for_psp(psp_from_auftrag(nr)) or region


def journal_rows(allowed_regions: set[str] | None = None) -> list[dict]:
    from server.facts import lines, settings
    con = connect()
    jahr = settings(con)["jahr"]
    rows = []
    for row in lines(con, jahr):
        if allowed_regions is not None and row["region"] not in allowed_regions:
            continue
        rows.append({
            "id": row["id"], "datum": row["datum"], "monat": row["monat"], "belegart": row["belegart"],
            "beleg": row["belegnummer"], "nr": row["projekt_nr"], "projekt": row["projektname"],
            "region": row["region"], "kostenart": row["konto"], "text": row["text"], "wert": row["wert"],
            "stufe": row["db_stufe"], "guvGruppe": row["guv_gruppe"],
            "belegkreis": row["belegkreis"], "kostentraeger": row["kostentraeger"],
            "ergebnisrelevant": bool(row["ergebnisrelevant"]), "leistung": row["leistung"],
            "kvar": row["kvar"], "kfix": row["kfix"], "umlage": row["umlage"],
            "beitrag": row["beitrag"],
        })
    con.close()
    return rows


REPORT_SOURCES = {
    "guv",
    "projekte",
    "forecast_plan",
    "kostenverfolgung",
    "liquiditaet",
    "buchungen",
}


def report_templates(benutzer_id: int) -> list[dict]:
    ensure_system_schema()
    with connect() as con:
        if not _table_exists(con, "bericht_vorlage"):
            return []
        rows = con.execute(
            """
            SELECT bericht_vorlage.vorlage_id, bericht_vorlage.titel, bericht_vorlage.beschreibung,
                   bericht_vorlage.erstellt_am, bericht_abschnitt.parameter
            FROM bericht_vorlage
            JOIN bericht_abschnitt ON bericht_abschnitt.vorlage_id = bericht_vorlage.vorlage_id
            WHERE bericht_vorlage.erstellt_von = ?
            ORDER BY bericht_vorlage.titel
            """,
            (benutzer_id,),
        )
        result = []
        for row in rows:
            payload = json.loads(row["parameter"] or "{}")
            result.append({
                "id": row["vorlage_id"],
                "name": row["titel"],
                "quelle": payload.get("quelle") or row["beschreibung"] or "",
                "aufbau": payload.get("aufbau") or {},
                "geaendertAt": row["erstellt_am"],
            })
        return result


def save_report_template(
    benutzer_id: int, name: str, quelle: str, aufbau: dict
) -> int:
    ensure_system_schema()
    name = name.strip()
    if benutzer_id <= 0:
        raise SystemInputError("Bitte zuerst einen Administrator anlegen.")
    if not name or len(name) > 120:
        raise SystemInputError("Bitte einen Vorlagennamen mit höchstens 120 Zeichen eingeben.")
    if quelle not in REPORT_SOURCES:
        raise SystemInputError("Die Datenquelle ist ungültig.")
    if not isinstance(aufbau, dict):
        raise SystemInputError("Der Berichtsaufbau ist ungültig.")
    serialized = json.dumps(aufbau, ensure_ascii=False, separators=(",", ":"))
    if len(serialized) > 100_000:
        raise SystemInputError("Der Berichtsaufbau ist zu groß.")
    code = f"u{benutzer_id}-{re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')[:40]}"
    with connect() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS bericht_vorlage (
                vorlage_id INTEGER PRIMARY KEY,
                code TEXT NOT NULL UNIQUE,
                titel TEXT NOT NULL,
                beschreibung TEXT,
                ausgabeformat TEXT NOT NULL DEFAULT 'HTML'
                    CHECK (ausgabeformat IN ('XLSX', 'PPTX', 'DOCX', 'PDF', 'HTML')),
                aktiv INTEGER NOT NULL DEFAULT 1,
                erstellt_von INTEGER REFERENCES benutzer (benutzer_id),
                erstellt_am TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS bericht_abschnitt (
                abschnitt_id INTEGER PRIMARY KEY,
                vorlage_id INTEGER NOT NULL REFERENCES bericht_vorlage (vorlage_id) ON DELETE CASCADE,
                sortierung INTEGER NOT NULL,
                titel TEXT NOT NULL,
                typ TEXT NOT NULL CHECK (typ IN ('TEXT', 'TABELLE', 'KENNZAHL', 'DIAGRAMM')),
                kennzahl_id INTEGER,
                quelle_view TEXT,
                parameter TEXT NOT NULL DEFAULT '{}',
                textbaustein TEXT,
                UNIQUE (vorlage_id, sortierung)
            );
            """
        )
        payload = json.dumps({"quelle": quelle, "aufbau": aufbau}, ensure_ascii=False)
        con.execute(
            """
            INSERT INTO bericht_vorlage (code, titel, beschreibung, ausgabeformat, erstellt_von)
            VALUES (?, ?, ?, 'HTML', ?)
            ON CONFLICT (code) DO UPDATE SET
              titel = excluded.titel,
              beschreibung = excluded.beschreibung,
              erstellt_am = datetime('now')
            """,
            (code, name, quelle, benutzer_id),
        )
        vorlage_id = con.execute(
            "SELECT vorlage_id FROM bericht_vorlage WHERE code = ?",
            (code,),
        ).fetchone()["vorlage_id"]
        con.execute("DELETE FROM bericht_abschnitt WHERE vorlage_id = ?", (vorlage_id,))
        con.execute(
            """
            INSERT INTO bericht_abschnitt
              (vorlage_id, sortierung, titel, typ, parameter)
            VALUES (?, 1, ?, 'TEXT', ?)
            """,
            (vorlage_id, name, payload),
        )
    return int(vorlage_id)


def delete_report_template(benutzer_id: int, template_id: int) -> None:
    ensure_system_schema()
    with connect() as con:
        result = con.execute(
            "DELETE FROM bericht_vorlage WHERE vorlage_id = ? AND erstellt_von = ?",
            (template_id, benutzer_id),
        )
        if not result.rowcount:
            raise SystemInputError("Die Vorlage wurde nicht gefunden.")


JA_STATUS = {"offen", "in_arbeit", "erledigt", "entfaellt"}


def annual_entries() -> list[dict]:
    return []


def save_annual_entry(
    key: str,
    *,
    status: str = "offen",
    datum: str | None = None,
    filename: str | None = None,
    document: bytes | None = None,
) -> None:
    ensure_system_schema()
    if not re.fullmatch(r"[ua]-[a-z0-9]+", key):
        raise SystemInputError("Die Unterlagen-Kennung ist ungültig.")
    if status not in JA_STATUS:
        raise SystemInputError("Der Status ist ungültig.")
    if datum and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", datum):
        raise SystemInputError("Das Datum ist ungültig.")
    raise SystemInputError("Der Jahresabschluss hat in diesem Modell keine eigene Tabelle.")
    if filename is not None:
        filename = Path(filename).name[:240]
    with connect() as con:
        previous = con.execute(
            "SELECT dateiname, dokument FROM ja_stand WHERE schluessel = ?", (key,)
        ).fetchone()
        con.execute(
            """
            INSERT INTO ja_stand
              (schluessel, status, datum, dateiname, dokument, geaendert_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (schluessel) DO UPDATE SET
              status = excluded.status,
              datum = excluded.datum,
              dateiname = excluded.dateiname,
              dokument = excluded.dokument,
              geaendert_at = CURRENT_TIMESTAMP
            """,
            (
                key,
                status,
                datum or None,
                filename if filename is not None else (
                    previous["dateiname"] if previous else None
                ),
                document if document is not None else (
                    previous["dokument"] if previous else None
                ),
            ),
        )


def annual_document(key: str) -> tuple[str, bytes] | None:
    return None


def _bank_rows(con: sqlite3.Connection) -> list[dict]:
    from server.facts import parse_bank_note
    if not _table_exists(con, "liq_posten"):
        return []
    rows = []
    for row in con.execute(
        """
        SELECT liq_posten.posten_id, liq_posten.datum, liq_posten.richtung,
               liq_posten.betrag, liq_posten.bemerkung
        FROM liq_posten
        JOIN liq_szenario ON liq_szenario.szenario_id = liq_posten.szenario_id
        WHERE liq_szenario.bezeichnung = 'Kontoauszug'
        ORDER BY liq_posten.datum DESC, liq_posten.posten_id DESC
        """
    ):
        note = parse_bank_note(row["bemerkung"])
        signed = float(row["betrag"]) if row["richtung"] == "EIN" else -float(row["betrag"])
        rows.append({
            "id": row["posten_id"],
            "datum": row["datum"],
            "valuta": note.get("valuta"),
            "betrag": signed,
            "waehrung": note.get("waehrung") or "EUR",
            "text": note.get("text") or "",
            "zweck": note.get("zweck") or "",
            "gegenpartei": note.get("gegenpartei") or "",
            "iban": note.get("iban") or "",
            "konto": note.get("konto") or "",
            "fingerprint": note.get("fp") or "",
        })
    return rows


def _bank_overview(con: sqlite3.Connection, visible: bool) -> dict:
    empty = {"anzahl": 0, "summe": 0.0, "monate": [], "bewegungen": []}
    if not visible:
        return empty
    rows = _bank_rows(con)
    months: dict[str, dict] = {}
    for row in rows:
        key = row["datum"][:7]
        bucket = months.setdefault(key, {"monat": key, "ein": 0.0, "aus": 0.0, "anzahl": 0})
        if row["betrag"] > 0:
            bucket["ein"] += row["betrag"]
        elif row["betrag"] < 0:
            bucket["aus"] += -row["betrag"]
        bucket["anzahl"] += 1
    return {
        "anzahl": len(rows),
        "summe": float(sum(row["betrag"] for row in rows)),
        "monate": [months[key] for key in sorted(months)],
        "bewegungen": [
            {key: row[key] for key in ("datum", "valuta", "betrag", "waehrung", "text", "zweck", "gegenpartei", "iban", "konto")}
            for row in rows[:200]
        ],
    }


def bank_statement_import(filename: str, content: bytes, *, write: bool) -> dict:
    """Prüft einen Kontoauszug und übernimmt neue Buchungen auf Wunsch."""
    ensure_system_schema()
    try:
        statement = parse_statement(content, filename)
    except KontoauszugError as error:
        raise SystemInputError(str(error)) from error
    name = Path(filename).name[:240] or "kontoauszug"
    with connect() as con:
        known = {row["fingerprint"] for row in _bank_rows(con)}
        fresh = [row for row in statement.movements if row.fingerprint not in known]
        if write and fresh:
            from scripts.import_excel import LIQ_POSTEN_DDL, _restore_bank
            con.executescript(LIQ_POSTEN_DDL)
            _restore_bank(con, [
                {
                    "fingerprint": row.fingerprint,
                    "datum": row.buchungsdatum,
                    "valuta": row.valuta,
                    "betrag": row.betrag,
                    "waehrung": row.waehrung,
                    "text": row.buchungstext,
                    "zweck": row.verwendungszweck,
                    "gegenpartei": row.gegenpartei,
                    "iban": row.gegen_iban,
                    "konto": row.eigenkonto,
                    "dateiname": name,
                }
                for row in fresh
            ])
    incoming = sum(row.betrag for row in statement.movements if row.betrag > 0)
    outgoing = sum(-row.betrag for row in statement.movements if row.betrag < 0)
    dates = [row.buchungsdatum for row in statement.movements]
    return {
        "art": "Kontoauszug",
        "format": statement.format,
        "konto": statement.konto,
        "von": min(dates),
        "bis": max(dates),
        "zeilen": len(statement.movements),
        "uebersprungen": statement.skipped,
        "summe": round(sum(row.betrag for row in statement.movements), 2),
        "summeText": format_amount_de(sum(row.betrag for row in statement.movements)),
        "eingang": round(incoming, 2),
        "eingangText": format_amount_de(incoming),
        "ausgang": round(outgoing, 2),
        "ausgangText": format_amount_de(outgoing),
        "neu": len(fresh),
        "bereits": len(statement.movements) - len(fresh),
        "schlussSaldo": statement.closing_balance,
        "schlussSaldoText": format_amount_de(statement.closing_balance) if statement.closing_balance is not None else None,
        "schlussDatum": statement.closing_date,
        "vorschau": [
            {
                "datum": row.buchungsdatum,
                "betrag": row.betrag,
                "betragText": format_amount_de(row.betrag),
                "text": row.verwendungszweck or row.buchungstext,
                "gegenpartei": row.gegenpartei,
            }
            for row in statement.movements[:8]
        ],
        "importiert": len(fresh) if write else 0,
    }


# Protokoll-Kennzeichen passen in character varying(6). Die Anzeige
# setzt sie wieder in die bisherigen Wörter um.
_STEP_DB = {"analyse": "sicht", "testlauf": "test", "import": "import"}
_STATUS_DB = {"ERFOLGREICH": "fertig", "OK": "fertig"}
_STEP_LABEL = {"sicht": "analyse", "test": "testlauf", "import": "import"}
_STATUS_LABEL = {"fertig": "ERFOLGREICH"}


def _protocol_code(value: str, mapping: dict[str, str]) -> str:
    return mapping.get(value, value)[:6]


def log_import(
    filename: str, step: str, status: str, rows: int = 0, detail: str = ""
) -> None:
    ensure_system_schema()
    with connect() as con:
        schritt = _protocol_code(step, _STEP_DB)
        zustand = _protocol_code(status, _STATUS_DB)
        con.execute(
            """
            INSERT INTO import_lauf (quelle, dateiname, zeilen, bemerkung)
            VALUES ('MANUELL', ?, ?, ?)
            """,
            (
                Path(filename).name[:240],
                int(rows),
                f"schritt={schritt};status={zustand};detail={detail[:1000]}",
            ),
        )


def import_log() -> list[dict]:
    ensure_system_schema()
    with connect() as con:
        result = []
        query = """
            SELECT import_id, importiert_am, dateiname, zeilen, bemerkung
            FROM import_lauf
            WHERE quelle = 'MANUELL'
            ORDER BY import_id DESC
            LIMIT 50
        """
        for row in con.execute(query):
            fields = {}
            for part in (row["bemerkung"] or "").split(";"):
                if "=" in part:
                    key, value = part.split("=", 1)
                    fields[key] = value
            schritt = fields.get("schritt", "")
            zustand = fields.get("status", "")
            result.append({
                "id": row["import_id"],
                "erstelltAt": row["importiert_am"],
                "dateiname": row["dateiname"],
                "schritt": _STEP_LABEL.get(schritt, schritt),
                "status": _STATUS_LABEL.get(zustand, zustand),
                "zeilen": row["zeilen"],
                "detail": fields.get("detail", ""),
            })
        return result
