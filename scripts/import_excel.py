#!/usr/bin/env python3
"""Lädt die eingegebenen Blätter aus der Excel-Datei in SQLite."""

from __future__ import annotations

import argparse
import calendar
import json
import posixpath
import re
import sqlite3
import zipfile
from datetime import date, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "data" / "tvf-dashboard-download.xlsx"
DB = ROOT / "data" / "tvf.sqlite"
SCHEMA = ROOT / "sql" / "schema.sql"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
DOCUMENT_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL_NS = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
EXCEL_EPOCH = date(1899, 12, 30)

SHEETS = (
    "GuV_Positionen",
    "Auftraege",
    "Kostenverfolgung",
    "Parameter",
    "Legende",
    "Auftrag_Journal",
    "Projektstamm",
    "Kostenarten",
    "Forecast_Plan",
    "EBITDA_Plan",
    "Verlust",
    "Liq_Monat",
    "Liq_Parameter",
    "Liq_Bestand",
    "Kontostand",
    "Regionen",
    "Auftrag",
)
_AUFTRAG_NR = re.compile(r"^[PW]\d{8,}$")
_AUFTRAG_PSP = re.compile(r"^[PW]4102(\d{5,6}(?:-\d{2})?)$")
_REGION_CODE = {
    "West": "WEST",
    "Süd-West": "SW",
    "Sued-West": "SW",
    "Ost": "OST",
    "Berlin": "BER",
    "Verwaltung": "VERW",
}
_PSP_REGION = {"15": "WEST", "30": "SW", "60": "OST", "65": "BER", "50": "VERW"}
_ROLE_CODE = {
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
_NEUTRAL_KONTEN = {"201000", "231500", "251000"}
_STEUER_KONTEN = {"401030", "430010", "430040"}
_ERTRAG = {"UMSATZ", "BESTANDSVERAENDERUNG", "SONST_ERTRAEGE"}
_POSITION = {
    "1": "UMSATZ",
    "2": "BESTANDSVERAENDERUNG",
    "3": "SONST_ERTRAEGE",
    "4": "MATERIAL_FREMD",
    "5": "MATERIAL_FREMD",
    "6": "PERSONAL",
    "7": "ABSCHREIBUNGEN",
    "8": "SONST_AUFWAND",
    "9": "NEUTRAL_ERGEBNIS",
    "10": "ZINSEN_STEUERN",
    "11": "ZINSEN_STEUERN",
    "12": "NEUTRAL_ERGEBNIS",
}

LIQ_POSTEN_DDL = """
CREATE TABLE IF NOT EXISTS liq_posten (
    posten_id        INTEGER PRIMARY KEY,
    szenario_id      INTEGER NOT NULL REFERENCES liq_szenario (szenario_id) ON DELETE CASCADE,
    projekt_id       INTEGER REFERENCES projekt (projekt_id),
    datum            TEXT NOT NULL,
    richtung         TEXT NOT NULL CHECK (richtung IN ('EIN', 'AUS')),
    kategorie        TEXT NOT NULL
                     CHECK (kategorie IN ('AUSGANGSRECHNUNG', 'ANZAHLUNG', 'EINGANGSRECHNUNG', 'PERSONAL', 'STEUER', 'SONSTIGE')),
    betrag           REAL NOT NULL CHECK (betrag >= 0),
    sicherheit       TEXT NOT NULL DEFAULT 'WAHRSCHEINLICH'
                     CHECK (sicherheit IN ('SICHER', 'WAHRSCHEINLICH', 'UNSICHER')),
    quelle           TEXT NOT NULL DEFAULT 'MANUELL'
                     CHECK (quelle IN ('FORECAST', 'UNTERAUFTRAG_KV', 'BESTELLUNG', 'MANUELL')),
    kv_position_id   INTEGER,
    forecast_wert_id INTEGER REFERENCES forecast_wert (forecast_wert_id),
    bemerkung        TEXT
);
CREATE INDEX IF NOT EXISTS ix_liq_posten_szenario_datum ON liq_posten (szenario_id, datum);
"""

BENUTZER_ZUGRIFF_DDL = """
CREATE TABLE IF NOT EXISTS benutzer_zugriff (
    zugriff_id     INTEGER PRIMARY KEY,
    benutzer_id    INTEGER NOT NULL REFERENCES benutzer (benutzer_id) ON DELETE CASCADE,
    region_id      INTEGER REFERENCES region (region_id),
    projekt_id     INTEGER REFERENCES projekt (projekt_id) ON DELETE CASCADE,
    darf_schreiben INTEGER NOT NULL DEFAULT 0 CHECK (darf_schreiben IN (0, 1)),
    CHECK (region_id IS NOT NULL OR projekt_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_benutzer_zugriff_benutzer ON benutzer_zugriff (benutzer_id);
"""


def col_row(ref: str) -> tuple[int, int]:
    col = "".join(c for c in ref if c.isalpha())
    row = int("".join(c for c in ref if c.isdigit()) or 0)
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n, row


def cell_value(cell: ET.Element, shared_strings: list[str] | None = None):
    kind = cell.attrib.get("t")
    if kind == "inlineStr":
        return "".join(cell.find("m:is", NS).itertext()) if cell.find("m:is", NS) is not None else ""
    node = cell.find("m:v", NS)
    if node is None or node.text is None:
        return None
    raw = node.text
    if kind == "b":
        return raw == "1"
    if kind == "s":
        try:
            return (shared_strings or [])[int(raw)]
        except (IndexError, ValueError) as error:
            raise ValueError("Ungültiger Verweis auf eine Excel-Zeichenkette.") from error
    return float(raw) if any(c in raw for c in ".eE") else int(raw) if raw.lstrip("-").isdigit() else raw


def cell_formula(cell: ET.Element) -> str | None:
    node = cell.find("m:f", NS)
    return node.text if node is not None and node.text else None


def workbook_sheet_paths(xlsx: zipfile.ZipFile) -> dict[str, str]:
    workbook = ET.fromstring(xlsx.read("xl/workbook.xml"))
    relationships = ET.fromstring(xlsx.read("xl/_rels/workbook.xml.rels"))
    targets = {
        node.attrib["Id"]: node.attrib["Target"]
        for node in relationships.findall("r:Relationship", PACKAGE_REL_NS)
    }
    paths: dict[str, str] = {}
    for sheet in workbook.findall(".//m:sheets/m:sheet", NS):
        relation = sheet.attrib.get(f"{{{DOCUMENT_REL_NS}}}id", "")
        target = targets.get(relation)
        if not target:
            raise KeyError(f"Beziehung für Excel-Blatt {sheet.attrib.get('name', '')} fehlt.")
        path = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join("xl", target))
        if path not in xlsx.namelist():
            raise KeyError(f"Excel-Blattdatei {path} fehlt.")
        paths[sheet.attrib["name"]] = path
    return paths


def workbook_sheet_names(xlsx: zipfile.ZipFile) -> list[str]:
    return list(workbook_sheet_paths(xlsx))


def _shared_strings(xlsx: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in xlsx.namelist():
        return []
    root = ET.fromstring(xlsx.read("xl/sharedStrings.xml"))
    return ["".join(node.itertext()) for node in root.findall("m:si", NS)]


def read_sheet(xlsx: zipfile.ZipFile, name: str) -> dict[int, dict[int, tuple[object, str | None]]]:
    paths = workbook_sheet_paths(xlsx)
    if name not in paths:
        raise KeyError(f"Excel-Blatt {name} fehlt.")
    root = ET.fromstring(xlsx.read(paths[name]))
    shared_strings = _shared_strings(xlsx)
    rows: dict[int, dict[int, tuple[object, str | None]]] = {}
    for cell in root.findall(".//m:c", NS):
        ref = cell.attrib.get("r")
        if not ref:
            continue
        ci, ri = col_row(ref)
        rows.setdefault(ri, {})[ci] = (cell_value(cell, shared_strings), cell_formula(cell))
    return rows


def value(rows, r, c, default=None):
    item = rows.get(r, {}).get(c)
    if item is None or item[0] is None:
        return default
    return item[0]


def formula(rows, r, c) -> str | None:
    item = rows.get(r, {}).get(c)
    return item[1] if item else None


def text(rows, r, c, default=""):
    v = value(rows, r, c, default)
    if v is None:
        return default
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    if isinstance(v, bool):
        return "1" if v else "0"
    return str(v)


def num(rows, r, c, default=0.0) -> float:
    v = value(rows, r, c, None)
    if v is None or v == "":
        return default
    return float(v)


def excel_date(serial: int) -> str:
    return (EXCEL_EPOCH + timedelta(days=int(serial))).isoformat()


def flag(v) -> int:
    if isinstance(v, bool):
        return 1 if v else 0
    return 1 if v in (1, "1", "TRUE") else 0


def sum_rows(formula_text: str) -> str:
    """C5+C6+C7 oder SUM(C12:C13) wird zu '5+6+7'. Die Spalte muss einheitlich sein."""
    body = formula_text.replace(" ", "")
    if body.upper().startswith("SUM(") and ":" in body:
        inside = body[4:-1]
        start, end = inside.split(":")
        start_row = int("".join(ch for ch in start if ch.isdigit()))
        end_row = int("".join(ch for ch in end if ch.isdigit()))
        start_col = "".join(ch for ch in start if ch.isalpha())
        end_col = "".join(ch for ch in end if ch.isalpha())
        if start_col != end_col:
            raise SystemExit(f"unerwartete Summenformel: {formula_text}")
        return "+".join(str(i) for i in range(start_row, end_row + 1))
    parts = body.split("+")
    rows = []
    col = None
    for part in parts:
        letter = "".join(ch for ch in part if ch.isalpha())
        number = "".join(ch for ch in part if ch.isdigit())
        if not letter or not number or letter + number != part:
            raise SystemExit(f"unerwartete GuV-Formel: {formula_text}")
        if col is None:
            col = letter
        elif letter != col:
            raise SystemExit(f"unerwartete GuV-Formel: {formula_text}")
        rows.append(number)
    return "+".join(rows)


def _columns(connection: sqlite3.Connection, table: str) -> list[str]:
    exists = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    if not exists:
        return []
    return [row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')]


def _roles_from_json(raw: str | None) -> list[str]:
    try:
        value = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return ["LESEN"]
    if not isinstance(value, list):
        return ["LESEN"]
    codes = []
    for item in value:
        code = _ROLE_CODE.get(str(item))
        if code and code not in codes:
            codes.append(code)
    return codes or ["LESEN"]


def snapshot_preserved(db_path: Path) -> dict:
    """Benutzer, Kontoauszug und eine abweichende Ist-Freigabe vor dem Neuaufbau."""
    empty = {"users": [], "bank": [], "logs": [], "ist_bis": None}
    if not db_path.exists():
        return empty
    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        users = _snapshot_users(connection)
        bank = _snapshot_bank(connection)
        logs = _snapshot_logs(connection)
        ist_bis = _snapshot_cutoff(connection)
    return {"users": users, "bank": bank, "logs": logs, "ist_bis": ist_bis}


def _snapshot_users(connection: sqlite3.Connection) -> list[dict]:
    columns = _columns(connection, "benutzer")
    if not columns:
        return []
    users = []
    if "login" in columns:
        role_table = "benutzer_rolle" in {
            row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        access_table = "benutzer_zugriff" in {
            row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
        for row in connection.execute("SELECT * FROM benutzer"):
            rollen = []
            regionen = []
            if role_table:
                rollen = [
                    item["code"]
                    for item in connection.execute(
                        """
                        SELECT rolle.code
                        FROM benutzer_rolle
                        JOIN rolle ON rolle.rolle_id = benutzer_rolle.rolle_id
                        WHERE benutzer_rolle.benutzer_id = ?
                        """,
                        (row["benutzer_id"],),
                    )
                ]
            if access_table:
                regionen = [
                    item["bezeichnung"]
                    for item in connection.execute(
                        """
                        SELECT region.bezeichnung
                        FROM benutzer_zugriff
                        JOIN region ON region.region_id = benutzer_zugriff.region_id
                        WHERE benutzer_zugriff.benutzer_id = ? AND benutzer_zugriff.region_id IS NOT NULL
                        """,
                        (row["benutzer_id"],),
                    )
                ]
            users.append({
                "login": row["login"],
                "anzeigename": row["anzeigename"],
                "email": row["email"],
                "passwort_hash": row["passwort_hash"],
                "aktiv": int(row["aktiv"]),
                "muss_pw_aendern": int(row["muss_pw_aendern"]),
                "letzte_anmeldung": row["letzte_anmeldung"],
                "rollen": rollen or ["LESEN"],
                "regionen": regionen,
            })
        return users
    for row in connection.execute("SELECT * FROM benutzer"):
        vorname = str(row["vorname"] or "").strip()
        nachname = str(row["nachname"] or "").strip()
        users.append({
            "login": row["email"],
            "anzeigename": f"{vorname} {nachname}".strip() or row["email"],
            "email": row["email"],
            "passwort_hash": row["passwort_hash"],
            "aktiv": int(row["aktiv"]),
            "muss_pw_aendern": int(row["passwort_aendern"]),
            "letzte_anmeldung": row["letzter_login"],
            "rollen": _roles_from_json(row["rollen"]),
            "regionen": json.loads(row["regionen"] or "[]"),
        })
    return users


def _snapshot_bank(connection: sqlite3.Connection) -> list[dict]:
    if _columns(connection, "bankbewegung"):
        return [
            {
                "fingerprint": row["fingerprint"],
                "datum": row["buchungsdatum"],
                "valuta": row["valuta"],
                "betrag": row["betrag"],
                "waehrung": row["waehrung"],
                "text": row["buchungstext"],
                "zweck": row["verwendungszweck"],
                "gegenpartei": row["gegenpartei"],
                "iban": row["gegen_iban"],
                "konto": row["eigenkonto"],
                "dateiname": row["dateiname"],
            }
            for row in connection.execute("SELECT * FROM bankbewegung")
        ]
    if not _columns(connection, "liq_posten"):
        return []
    rows = []
    for row in connection.execute(
        """
        SELECT liq_posten.*
        FROM liq_posten
        JOIN liq_szenario ON liq_szenario.szenario_id = liq_posten.szenario_id
        WHERE liq_szenario.bezeichnung = 'Kontoauszug'
        """
    ):
        payload = {}
        bemerkung = row["bemerkung"] or ""
        if bemerkung.startswith("{"):
            try:
                payload = json.loads(bemerkung)
            except json.JSONDecodeError:
                payload = {}
        signed = row["betrag"] if row["richtung"] == "EIN" else -row["betrag"]
        rows.append({
            "fingerprint": payload.get("fp", ""),
            "datum": row["datum"],
            "valuta": payload.get("valuta"),
            "betrag": signed,
            "waehrung": payload.get("waehrung", "EUR"),
            "text": payload.get("text", ""),
            "zweck": payload.get("zweck", ""),
            "gegenpartei": payload.get("gegenpartei", ""),
            "iban": payload.get("iban", ""),
            "konto": payload.get("konto", ""),
            "dateiname": payload.get("dateiname", ""),
        })
    return [row for row in rows if row["fingerprint"]]


def _snapshot_logs(connection: sqlite3.Connection) -> list[dict]:
    if _columns(connection, "import_protokoll"):
        return [
            {
                "dateiname": row["dateiname"],
                "bemerkung": f"schritt={row['schritt']};status={row['status']};detail={row['detail']}",
                "zeilen": row["zeilen"],
            }
            for row in connection.execute("SELECT * FROM import_protokoll")
        ]
    if not _columns(connection, "import_lauf"):
        return []
    return [
        {"dateiname": row["dateiname"], "bemerkung": row["bemerkung"], "zeilen": row["zeilen"]}
        for row in connection.execute("SELECT * FROM import_lauf WHERE quelle = 'MANUELL'")
    ]


def _snapshot_cutoff(connection: sqlite3.Connection) -> int | None:
    if _columns(connection, "ist_freigabe"):
        row = connection.execute("SELECT monat FROM ist_freigabe").fetchone()
        return int(row["monat"]) if row else None
    if not _columns(connection, "forecast_version"):
        return None
    plan = connection.execute(
        "SELECT ist_bis_periode FROM forecast_version WHERE typ = 'PLAN' ORDER BY version_id LIMIT 1"
    ).fetchone()
    rolling = connection.execute(
        """
        SELECT ist_bis_periode FROM forecast_version
        WHERE typ = 'ROLLING_FORECAST' AND ist_aktiv = 1
        ORDER BY version_id LIMIT 1
        """
    ).fetchone()
    if plan is None or rolling is None:
        return None
    if int(rolling["ist_bis_periode"]) == int(plan["ist_bis_periode"]):
        return None
    return int(rolling["ist_bis_periode"])


def restore_preserved(connection: sqlite3.Connection, snapshot: dict) -> None:
    for user in snapshot.get("users") or []:
        cursor = connection.execute(
            """
            INSERT INTO benutzer
              (login, anzeigename, email, passwort_hash, aktiv, muss_pw_aendern, letzte_anmeldung)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user["login"],
                user["anzeigename"],
                user["email"],
                user["passwort_hash"],
                user["aktiv"],
                user["muss_pw_aendern"],
                user["letzte_anmeldung"],
            ),
        )
        benutzer_id = cursor.lastrowid
        for code in user.get("rollen") or ["LESEN"]:
            rolle = connection.execute("SELECT rolle_id FROM rolle WHERE code = ?", (code,)).fetchone()
            if rolle is None:
                continue
            connection.execute(
                "INSERT INTO benutzer_rolle (benutzer_id, rolle_id) VALUES (?, ?)",
                (benutzer_id, rolle[0]),
            )
        regions = [name for name in user.get("regionen") or [] if name]
        if regions:
            connection.executescript(BENUTZER_ZUGRIFF_DDL)
            for name in regions:
                code = _REGION_CODE.get(name, _REGION_CODE.get(name.replace("Sued-West", "Süd-West")))
                if name == "Sued-West":
                    code = "SW"
                region = connection.execute(
                    "SELECT region_id FROM region WHERE code = ? OR bezeichnung = ?",
                    (code, name),
                ).fetchone()
                if region is None:
                    continue
                connection.execute(
                    """
                    INSERT INTO benutzer_zugriff (benutzer_id, region_id, darf_schreiben)
                    VALUES (?, ?, 0)
                    """,
                    (benutzer_id, region[0]),
                )
    if snapshot.get("bank"):
        _restore_bank(connection, snapshot["bank"])
    for entry in snapshot.get("logs") or []:
        connection.execute(
            """
            INSERT INTO import_lauf (quelle, dateiname, zeilen, bemerkung)
            VALUES ('MANUELL', ?, ?, ?)
            """,
            (entry.get("dateiname"), entry.get("zeilen") or 0, entry.get("bemerkung") or ""),
        )
    ist_bis = snapshot.get("ist_bis")
    if ist_bis is not None:
        connection.execute(
            """
            UPDATE forecast_version
            SET ist_bis_periode = ?
            WHERE typ = 'ROLLING_FORECAST' AND ist_aktiv = 1
            """,
            (int(ist_bis),),
        )


def _restore_bank(connection: sqlite3.Connection, rows: list[dict]) -> None:
    connection.executescript(LIQ_POSTEN_DDL)
    scenario = connection.execute(
        "SELECT szenario_id FROM liq_szenario WHERE bezeichnung = 'Kontoauszug'"
    ).fetchone()
    if scenario is None:
        liquid = connection.execute(
            "SELECT startdatum, enddatum FROM liq_szenario WHERE bezeichnung = 'Liquidität'"
        ).fetchone()
        start, end = liquid if liquid else ("2026-01-01", "2026-12-31")
        cursor = connection.execute(
            """
            INSERT INTO liq_szenario
              (bezeichnung, startdatum, enddatum, startsaldo, dso_tage, dpo_tage)
            VALUES ('Kontoauszug', ?, ?, 0, 0, 0)
            """,
            (start, end),
        )
        scenario_id = cursor.lastrowid
    else:
        scenario_id = scenario[0]
    for row in rows:
        amount = float(row["betrag"])
        payload = json.dumps({
            "fp": row["fingerprint"],
            "valuta": row.get("valuta"),
            "waehrung": row.get("waehrung") or "EUR",
            "text": row.get("text") or "",
            "zweck": row.get("zweck") or "",
            "gegenpartei": row.get("gegenpartei") or "",
            "iban": row.get("iban") or "",
            "konto": row.get("konto") or "",
            "dateiname": row.get("dateiname") or "",
        }, ensure_ascii=False)
        connection.execute(
            """
            INSERT INTO liq_posten
              (szenario_id, datum, richtung, kategorie, betrag, sicherheit, quelle, bemerkung)
            VALUES (?, ?, ?, 'SONSTIGE', ?, 'SICHER', 'MANUELL', ?)
            """,
            (
                scenario_id,
                row["datum"],
                "EIN" if amount >= 0 else "AUS",
                abs(amount),
                payload,
            ),
        )


def _position_code(konto: str, gruppe: str) -> str:
    if konto in _NEUTRAL_KONTEN:
        return "NEUTRAL_ERGEBNIS"
    if konto in _STEUER_KONTEN:
        return "SONST_STEUERN"
    return _POSITION.get(gruppe.split(" ", 1)[0], "SONST_AUFWAND")


def _kostenart_code(art: str, gruppe: str, klr: str, name: str) -> str | None:
    if art == "ERTRAG":
        return None
    blob = f"{gruppe} {klr} {name}".lower()
    if "entsorg" in blob:
        return "ENTSORGUNG"
    if gruppe.startswith("6") or "personal" in klr.lower():
        return "PERSONAL"
    if gruppe.startswith("5") or "fremd" in blob:
        return "FREMDLEISTUNG"
    if gruppe.startswith("4") or "material" in klr.lower():
        return "MATERIAL"
    if "fuhrpark" in blob or "gerät" in blob or "geraet" in blob:
        return "GERAET"
    return "SONSTIGE"


def _psp(auftrag: str) -> str:
    match = _AUFTRAG_PSP.fullmatch(auftrag.strip())
    return match.group(1) if match else ""


def _region_code(name: str, regionscode: str, auftrag: str) -> str:
    digits = "".join(ch for ch in str(regionscode) if ch.isdigit())
    if digits in _PSP_REGION:
        return _PSP_REGION[digits]
    if name in _REGION_CODE:
        return _REGION_CODE[name]
    psp = _psp(auftrag)
    return _PSP_REGION.get(psp[:2], "VERW")


def _month_end(year: int, month: int) -> str:
    return date(year, month, calendar.monthrange(year, month)[1]).isoformat()


def _drop_if_empty(connection: sqlite3.Connection, table: str) -> None:
    count = connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
    if count == 0 and table != "benutzer":
        connection.execute(f'DROP TABLE "{table}"')


def import_workbook(xlsx_path: Path = XLSX, db_path: Path = DB) -> dict[str, int]:
    """Baut die Datenbank aus der Mappe neu auf.

    Benutzer, Kontoauszüge und eine vom Blatt abweichende Ist-Freigabe
    bleiben erhalten. Jede Zahl steht nur einmal.
    """
    preserved = snapshot_preserved(db_path)
    if db_path.exists():
        db_path.unlink()
    connection = sqlite3.connect(db_path)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(SCHEMA.read_text())
    xlsx = zipfile.ZipFile(xlsx_path)
    try:
        _load_workbook(connection, xlsx, xlsx_path.name)
    finally:
        xlsx.close()
    restore_preserved(connection, preserved)
    for table in ("benutzer_rolle",):
        if _columns(connection, table):
            _drop_if_empty(connection, table)
    connection.commit()
    names = [
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
    ]
    counts = {name: connection.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0] for name in names}
    print(db_path)
    for name, count in counts.items():
        print(f"{name}: {count}")
    connection.close()
    return counts


def _load_workbook(connection: sqlite3.Connection, xlsx: zipfile.ZipFile, filename: str) -> None:
    parameter = read_sheet(xlsx, "Parameter")
    jahr = int(num(parameter, 1, 2))
    letzter = int(num(parameter, 2, 2))
    stichtag = excel_date(int(num(parameter, 3, 2)))
    auftrag_focus = text(read_sheet(xlsx, "Auftrag"), 3, 2)

    region_id = {row[0]: row[1] for row in connection.execute("SELECT code, region_id FROM region")}
    kostenart_id = {row[0]: row[1] for row in connection.execute("SELECT code, kostenart_id FROM kostenart")}
    position_id = {
        row[0]: row[1]
        for row in connection.execute("SELECT code, position_id FROM berichtsposition")
    }
    stellen: dict[tuple[str, str], int] = {}

    def stelle(code: str, typ: str) -> int:
        key = (code, typ)
        if key in stellen:
            return stellen[key]
        label = connection.execute("SELECT bezeichnung FROM region WHERE code = ?", (code,)).fetchone()[0]
        cursor = connection.execute(
            """
            INSERT INTO kostenstelle (nummer, bezeichnung, region_id, typ)
            VALUES (?, ?, ?, ?)
            """,
            (f"{code}-{typ}", f"{label} {typ}", region_id[code], typ),
        )
        stellen[key] = int(cursor.lastrowid)
        return stellen[key]

    for code in region_id:
        stelle(code, "PROJEKT")
        stelle(code, "NIEDERLASSUNG")
    stelle("VERW", "OVERHEAD")

    projects: dict[str, int] = {}
    stamm = read_sheet(xlsx, "Projektstamm")
    for row_number in sorted(key for key in stamm if key > 1):
        auftrag = text(stamm, row_number, 2).strip()
        if not auftrag or auftrag.startswith("'"):
            continue
        name = text(stamm, row_number, 3).strip() or auftrag
        typ = text(stamm, row_number, 4).strip()
        code = _region_code(text(stamm, row_number, 6).strip(), text(stamm, row_number, 5).strip(), auftrag)
        status = text(stamm, row_number, 7).strip()
        phase = "ABGESCHLOSSEN" if status == "ABGESCHLOSSEN" else "LAUFEND"
        ks_typ = "PROJEKT" if typ == "PROJEKT" else "NIEDERLASSUNG" if typ == "INNENAUFTRAG" else "OVERHEAD"
        if ks_typ == "OVERHEAD":
            code_for_stelle = "VERW"
        else:
            code_for_stelle = code
        cursor = connection.execute(
            """
            INSERT INTO projekt
              (auftragsnr, psp, bezeichnung, region_id, kostenstelle_id, phase, vertragsumsatz, bemerkung)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
            """,
            (
                auftrag,
                _psp(auftrag),
                name,
                region_id[code],
                stelle(code_for_stelle, ks_typ),
                phase,
                num(stamm, row_number, 8),
            ),
        )
        projects[auftrag] = int(cursor.lastrowid)

    journal = read_sheet(xlsx, "Auftrag_Journal")
    bookings = []
    titles: dict[str, dict[str, int]] = {}
    for row_number in sorted(key for key in journal if key > 1):
        if value(journal, row_number, 1) is None:
            continue
        konto = text(journal, row_number, 10).strip()
        jahr_zeile = int(num(journal, row_number, 3))
        monat = int(num(journal, row_number, 4))
        if not konto or konto.startswith("'") or jahr_zeile <= 0 or not 1 <= monat <= 16:
            continue
        auftrag = text(journal, row_number, 7).strip()
        titel = text(journal, row_number, 12).strip()
        if _AUFTRAG_NR.fullmatch(auftrag) and titel and not titel.lower().startswith("zu erw"):
            titles.setdefault(auftrag, {})
            titles[auftrag][titel] = titles[auftrag].get(titel, 0) + 1
        bookings.append((row_number, jahr_zeile, monat, auftrag, konto, num(journal, row_number, 11), titel))

    for auftrag in sorted({row[3] for row in bookings} | set(titles)):
        if auftrag in projects or not _AUFTRAG_NR.fullmatch(auftrag):
            continue
        code = _PSP_REGION.get(_psp(auftrag)[:2], "VERW")
        counted = titles.get(auftrag) or {}
        name = max(counted, key=lambda item: (counted[item], len(item)))[:120] if counted else auftrag
        cursor = connection.execute(
            """
            INSERT INTO projekt
              (auftragsnr, psp, bezeichnung, region_id, kostenstelle_id, phase, vertragsumsatz, bemerkung)
            VALUES (?, ?, ?, ?, ?, 'LAUFEND', 0, 'Journal')
            """,
            (auftrag, _psp(auftrag), name, region_id[code], stelle(code, "PROJEKT")),
        )
        projects[auftrag] = int(cursor.lastrowid)

    def internal(auftrag: str, name: str) -> int:
        if auftrag in projects:
            return projects[auftrag]
        cursor = connection.execute(
            """
            INSERT INTO projekt
              (auftragsnr, psp, bezeichnung, region_id, kostenstelle_id, phase, bemerkung)
            VALUES (?, '', ?, ?, ?, 'LAUFEND', 'Intern')
            """,
            (auftrag, name, region_id["VERW"], stelle("VERW", "OVERHEAD")),
        )
        projects[auftrag] = int(cursor.lastrowid)
        return projects[auftrag]

    overhead_id = internal("OVERHEAD", "Overhead")
    bewertung_id = internal("BEWERTUNG", "Offene Bewertung")

    kosten = read_sheet(xlsx, "Kostenarten")
    for row_number in sorted(key for key in kosten if key > 1):
        konto = text(kosten, row_number, 2).strip()
        if not konto or konto.startswith("'"):
            continue
        gruppe = text(kosten, row_number, 5).strip()
        klr = text(kosten, row_number, 7).strip()
        name = text(kosten, row_number, 3).strip() or konto
        code = _position_code(konto, gruppe)
        art = "ERTRAG" if code in _ERTRAG else "AUFWAND"
        art_code = _kostenart_code(art, gruppe, klr, name)
        connection.execute(
            """
            INSERT INTO konto (konto_nr, bezeichnung, kontoart, kaufm_faktor, kostenart_id)
            VALUES (?, ?, ?, -1, ?)
            ON CONFLICT (konto_nr) DO UPDATE SET
              bezeichnung = excluded.bezeichnung,
              kontoart = excluded.kontoart,
              kaufm_faktor = excluded.kaufm_faktor,
              kostenart_id = excluded.kostenart_id
            """,
            (konto, name, art, kostenart_id.get(art_code) if art_code else None),
        )
        connection.execute("DELETE FROM konto_mapping WHERE konto_nr = ?", (konto,))
        connection.execute(
            "INSERT INTO konto_mapping (konto_nr, position_id) VALUES (?, ?)",
            (konto, position_id[code]),
        )

    known_accounts = {row[0] for row in connection.execute("SELECT konto_nr FROM konto")}
    import_cursor = connection.execute(
        """
        INSERT INTO import_lauf (quelle, dateiname, bemerkung)
        VALUES ('FI_EINZELPOSTEN', ?, ?)
        """,
        (filename, f"auftrag={auftrag_focus}"),
    )
    import_id = import_cursor.lastrowid
    zeile_nr: dict[tuple[int, str], int] = {}
    buchung_rows = []
    for row_number, jahr_zeile, monat, auftrag, konto, betrag, titel in bookings:
        if konto not in known_accounts:
            continue
        beleg = text(journal, row_number, 6).strip() or f"OHNE-{int(num(journal, row_number, 1))}"
        key = (jahr_zeile, beleg)
        zeile_nr[key] = zeile_nr.get(key, 0) + 1
        projekt_id = projects.get(auftrag)
        ks = None
        if projekt_id is not None:
            ks = connection.execute(
                "SELECT kostenstelle_id FROM projekt WHERE projekt_id = ?",
                (projekt_id,),
            ).fetchone()[0]
        buchung_rows.append((
            import_id,
            jahr_zeile,
            monat,
            beleg,
            zeile_nr[key],
            excel_date(int(num(journal, row_number, 2))),
            konto,
            ks,
            projekt_id,
            round(betrag, 2),
            titel,
        ))
    connection.executemany(
        """
        INSERT INTO buchung (
          import_id, quelle, geschaeftsjahr, periode, belegnr, zeile, buchungsdatum,
          konto_nr, kostenstelle_id, projekt_id, betrag_sap, buchungstext
        ) VALUES (?, 'FI_EINZELPOSTEN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        buchung_rows,
    )
    connection.execute("UPDATE import_lauf SET zeilen = ? WHERE import_id = ?", (len(buchung_rows), import_id))

    plan_version = connection.execute(
        """
        INSERT INTO forecast_version
          (bezeichnung, geschaeftsjahr, typ, ist_bis_periode, status, ist_aktiv)
        VALUES ('Mappe', ?, 'PLAN', ?, 'FREIGEGEBEN', 0)
        """,
        (jahr, letzter),
    ).lastrowid
    rolling = connection.execute(
        """
        INSERT INTO forecast_version
          (bezeichnung, geschaeftsjahr, typ, ist_bis_periode, status, ist_aktiv)
        VALUES ('Rolling Forecast', ?, 'ROLLING_FORECAST', ?, 'FREIGEGEBEN', 1)
        """,
        (jahr, letzter),
    ).lastrowid

    forecast_import = connection.execute(
        """
        INSERT INTO import_lauf (quelle, dateiname, bemerkung)
        VALUES ('FORECAST_IMPORT', ?, 'Forecast_Plan und EBITDA_Plan')
        """,
        (filename,),
    ).lastrowid
    plan = read_sheet(xlsx, "Forecast_Plan")
    aggregated: dict[tuple[int, str, str], list[float | None]] = {}

    def add_value(projekt: int, month: int, wertart: str, plan_amount: float | None, forecast_amount: float | None) -> None:
        key = (projekt, f"{jahr}-{month:02d}-01", wertart)
        current = aggregated.get(key, [None, None])
        if plan_amount is not None:
            current[0] = (current[0] or 0.0) + plan_amount
        if forecast_amount is not None:
            current[1] = (current[1] or 0.0) + forecast_amount
        aggregated[key] = current

    for row_number in sorted(key for key in plan if key > 1):
        if value(plan, row_number, 1) is None:
            continue
        auftrag = text(plan, row_number, 3).strip()
        if auftrag not in projects:
            if not _AUFTRAG_NR.fullmatch(auftrag):
                continue
            code = _PSP_REGION.get(_psp(auftrag)[:2], "VERW")
            cursor = connection.execute(
                """
                INSERT INTO projekt
                  (auftragsnr, psp, bezeichnung, region_id, kostenstelle_id, phase, bemerkung)
                VALUES (?, ?, ?, ?, ?, 'LAUFEND', 'Journal')
                """,
                (
                    auftrag,
                    _psp(auftrag),
                    text(plan, row_number, 4).strip() or auftrag,
                    region_id[code],
                    stelle(code, "PROJEKT"),
                ),
            )
            projects[auftrag] = int(cursor.lastrowid)
        groesse = text(plan, row_number, 5).strip()
        art = text(plan, row_number, 6).strip()
        amount = num(plan, row_number, 8)
        if groesse == "umsatz":
            wertart, commercial = "UMSATZ", -amount
        elif groesse == "ba":
            wertart, commercial = "BESTANDSVERAENDERUNG", amount
        else:
            wertart, commercial = "KOSTEN", amount
        if art == "korrektur":
            add_value(projects[auftrag], int(num(plan, row_number, 7)), wertart, None, commercial)
        else:
            add_value(projects[auftrag], int(num(plan, row_number, 7)), wertart, commercial, None)

    ebitda = read_sheet(xlsx, "EBITDA_Plan")
    for row_number in sorted(key for key in ebitda if key > 1):
        if value(ebitda, row_number, 1) is None:
            continue
        month = int(num(ebitda, row_number, 2))
        overhead = num(ebitda, row_number, 4)
        bewertung = num(ebitda, row_number, 5)
        if overhead:
            add_value(overhead_id, month, "KOSTEN", -overhead, None)
        if bewertung:
            add_value(bewertung_id, month, "KOSTEN", -bewertung, None)

    linked: set[int] = set()
    for (projekt, monat, wertart), (plan_amount, forecast_amount) in aggregated.items():
        if projekt not in linked:
            connection.execute(
                "INSERT INTO forecast_projekt (version_id, projekt_id) VALUES (?, ?)",
                (rolling, projekt),
            )
            linked.add(projekt)
        connection.execute(
            """
            INSERT INTO forecast_wert
              (version_id, projekt_id, monat, wertart, betrag_plan, betrag_forecast)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (rolling, projekt, monat, wertart, plan_amount, forecast_amount),
        )
    connection.execute(
        "UPDATE import_lauf SET zeilen = ? WHERE import_id = ?",
        (len(aggregated), forecast_import),
    )

    kv_import = connection.execute(
        """
        INSERT INTO import_lauf (quelle, dateiname, bemerkung)
        VALUES ('KOSTENVERFOLGUNG', ?, 'Kostenverfolgung')
        """,
        (filename,),
    ).lastrowid
    kosten_v = read_sheet(xlsx, "Kostenverfolgung")
    kv: dict[str, list[float]] = {}
    for row_number in sorted(key for key in kosten_v if key >= 5):
        auftrag = text(kosten_v, row_number, 2).strip()
        if not auftrag or auftrag not in projects:
            continue
        current = kv.setdefault(auftrag, [0.0, 0.0, 0.0])
        current[0] += num(kosten_v, row_number, 5)
        current[1] += num(kosten_v, row_number, 6)
        current[2] += num(kosten_v, row_number, 12)
    for auftrag, (umsatz, kosten_sum, vertrag) in kv.items():
        connection.execute(
            """
            INSERT INTO kv_stand
              (projekt_id, stand_datum, umsatz_vertrag, gesamtumsatz, projektkosten, quelle_datei)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (projects[auftrag], stichtag, vertrag, umsatz, kosten_sum, filename),
        )
    connection.execute("UPDATE import_lauf SET zeilen = ? WHERE import_id = ?", (len(kv), kv_import))

    dso = dpo = None
    liq_p = read_sheet(xlsx, "Liq_Parameter")
    for row_number in sorted(key for key in liq_p if key > 1):
        key_name = text(liq_p, row_number, 2).strip()
        if key_name == "dso_tage":
            dso = int(num(liq_p, row_number, 3))
        elif key_name == "dpo_tage":
            dpo = int(num(liq_p, row_number, 3))
    bestand = read_sheet(xlsx, "Liq_Bestand")
    startsaldo = 0.0
    for row_number in sorted(key for key in bestand if key > 1):
        if value(bestand, row_number, 1) is None:
            continue
        month = int(num(bestand, row_number, 2))
        saldo = num(bestand, row_number, 3)
        connection.execute(
            "INSERT INTO liq_bankstand (datum, bankkonto, saldo) VALUES (?, 'Cash-Pool', ?)",
            (_month_end(int(num(bestand, row_number, 1)), month), saldo),
        )
        startsaldo = saldo
    konto_sheet = read_sheet(xlsx, "Kontostand")
    for row_number in sorted(key for key in konto_sheet if key > 1):
        if value(konto_sheet, row_number, 1) is None:
            continue
        connection.execute(
            "INSERT INTO liq_bankstand (datum, bankkonto, saldo) VALUES (?, ?, ?)",
            (excel_date(int(num(konto_sheet, row_number, 1))), text(konto_sheet, row_number, 2), num(konto_sheet, row_number, 3)),
        )
    enddatum = (date.fromisoformat(stichtag) + timedelta(days=26 * 7)).isoformat()
    connection.execute(
        """
        INSERT INTO liq_szenario
          (bezeichnung, forecast_version_id, startdatum, enddatum, startsaldo, dso_tage, dpo_tage)
        VALUES ('Liquidität', ?, ?, ?, ?, ?, ?)
        """,
        (rolling, stichtag, enddatum, startsaldo, dso or 60, dpo or 30),
    )
    # plan_version bleibt als Stichtag der Mappe stehen und trägt keine Werte.
    connection.execute("SELECT ?", (plan_version,))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--xlsx", type=Path, default=XLSX)
    parser.add_argument("--db", type=Path, default=DB)
    args = parser.parse_args()
    import_workbook(args.xlsx, args.db)


