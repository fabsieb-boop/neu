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

ROOT = Path(__file__).resolve().parents[1]
DB = Path(os.environ.get("TVF_DB", ROOT / "data" / "tvf.sqlite"))
MONATE = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
]
ROLLEN = [
    "ADMIN",
    "CONTROLLING",
    "PROJEKTLEITUNG",
    "NEUTRAL",
    "SACHBEARBEITUNG",
    "CHEF",
    "FORECAST-PFLEGE",
]
SYSTEM_SCHEMA = """
CREATE TABLE IF NOT EXISTS benutzer (
  benutzer_id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  passwort_hash TEXT NOT NULL,
  vorname TEXT NOT NULL DEFAULT '',
  nachname TEXT NOT NULL DEFAULT '',
  rollen TEXT NOT NULL DEFAULT '["NEUTRAL"]',
  regionen TEXT NOT NULL DEFAULT '[]',
  aktiv INTEGER NOT NULL DEFAULT 1,
  passwort_aendern INTEGER NOT NULL DEFAULT 1,
  letzter_login TEXT
);
CREATE TABLE IF NOT EXISTS bericht_vorlage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  benutzer_id INTEGER,
  name TEXT NOT NULL,
  quelle TEXT NOT NULL,
  aufbau TEXT NOT NULL DEFAULT '{}',
  geaendert_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (benutzer_id, name),
  FOREIGN KEY (benutzer_id) REFERENCES benutzer (benutzer_id)
);
CREATE TABLE IF NOT EXISTS ja_stand (
  schluessel TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'offen',
  datum TEXT,
  dateiname TEXT,
  dokument BLOB,
  geaendert_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS import_protokoll (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  erstellt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dateiname TEXT NOT NULL,
  schritt TEXT NOT NULL,
  status TEXT NOT NULL,
  zeilen INTEGER NOT NULL DEFAULT 0,
  detail TEXT NOT NULL DEFAULT ''
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
    with sqlite3.connect(path or DB) as con:
        con.executescript(SYSTEM_SCHEMA)


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


def _user_dict(row: sqlite3.Row, *, setup: bool = False) -> dict:
    rollen = _json_array(row["rollen"])
    regionen = _json_array(row["regionen"])
    return {
        "id": int(row["benutzer_id"]),
        "email": row["email"],
        "vorname": row["vorname"],
        "nachname": row["nachname"],
        "rollen": rollen,
        "regionen": regionen,
        "aktiv": bool(row["aktiv"]),
        "passwortOffen": bool(row["passwort_aendern"]),
        "letzterLogin": row["letzter_login"],
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
        return int(con.execute("SELECT COUNT(*) FROM benutzer").fetchone()[0])


def get_user(benutzer_id: int) -> dict | None:
    ensure_system_schema()
    with connect() as con:
        row = con.execute(
            "SELECT * FROM benutzer WHERE benutzer_id = ? AND aktiv = 1",
            (benutzer_id,),
        ).fetchone()
    return _user_dict(row) if row else None


def authenticate(email: str, password: str) -> dict | None:
    ensure_system_schema()
    with connect() as con:
        row = con.execute(
            "SELECT * FROM benutzer WHERE email = ? COLLATE NOCASE AND aktiv = 1",
            (email.strip(),),
        ).fetchone()
        if row is None or not _password_matches(password, row["passwort_hash"]):
            return None
        now = datetime.now(timezone.utc).isoformat()
        con.execute(
            "UPDATE benutzer SET letzter_login = ? WHERE benutzer_id = ?",
            (now, row["benutzer_id"]),
        )
        row = con.execute(
            "SELECT * FROM benutzer WHERE benutzer_id = ?", (row["benutzer_id"],)
        ).fetchone()
    return _user_dict(row)


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
            SET passwort_hash = ?, passwort_aendern = 0
            WHERE benutzer_id = ?
            """,
            (_password_hash(new), benutzer_id),
        )
        changed = con.execute(
            "SELECT * FROM benutzer WHERE benutzer_id = ?", (benutzer_id,)
        ).fetchone()
    return _user_dict(changed)


def available_regions(con: sqlite3.Connection | None = None) -> list[str]:
    own = con is None
    con = con or connect()
    try:
        rows = con.execute(
            """
            SELECT name AS region FROM region_liste
            UNION
            SELECT DISTINCT region FROM projekt WHERE region <> ''
            ORDER BY region
            """
        )
        return [row["region"] for row in rows]
    finally:
        if own:
            con.close()


def list_users() -> dict:
    ensure_system_schema()
    with connect() as con:
        users = [_user_dict(row) for row in con.execute("SELECT * FROM benutzer ORDER BY email")]
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
    selected_role = "ADMIN" if first else rolle
    if selected_role not in ROLLEN:
        raise SystemInputError("Die Rolle ist ungültig.")
    try:
        with connect() as con:
            cursor = con.execute(
                """
                INSERT INTO benutzer
                  (email, passwort_hash, vorname, nachname, rollen, regionen)
                VALUES (?, ?, ?, ?, ?, '[]')
                """,
                (
                    email,
                    _password_hash(password),
                    vorname.strip(),
                    nachname.strip(),
                    json.dumps([selected_role], ensure_ascii=False),
                ),
            )
            row = con.execute(
                "SELECT * FROM benutzer WHERE benutzer_id = ?", (cursor.lastrowid,)
            ).fetchone()
    except sqlite3.IntegrityError as error:
        raise SystemInputError("Diese E-Mail-Adresse ist bereits angelegt.") from error
    return _user_dict(row)


def update_user(benutzer_id: int, action: str, value, enabled: bool) -> dict:
    ensure_system_schema()
    with connect() as con:
        row = con.execute(
            "SELECT * FROM benutzer WHERE benutzer_id = ?", (benutzer_id,)
        ).fetchone()
        if row is None:
            raise SystemInputError("Der Benutzer wurde nicht gefunden.")
        roles = _json_array(row["rollen"])
        regions = _json_array(row["regionen"])
        if action == "rolle":
            role = str(value)
            if role not in ROLLEN:
                raise SystemInputError("Die Rolle ist ungültig.")
            if enabled and role not in roles:
                roles.append(role)
            if not enabled and role in roles:
                if role == "ADMIN" and bool(row["aktiv"]):
                    other_active_admins = sum(
                        "ADMIN" in _json_array(candidate["rollen"])
                        for candidate in con.execute(
                            """
                            SELECT rollen
                            FROM benutzer
                            WHERE aktiv = 1 AND benutzer_id <> ?
                            """,
                            (benutzer_id,),
                        )
                    )
                    if not other_active_admins:
                        raise SystemInputError(
                            "Der letzte aktive ADMIN kann nicht entfernt werden."
                        )
                roles.remove(role)
            if not roles:
                roles = ["NEUTRAL"]
            con.execute(
                "UPDATE benutzer SET rollen = ? WHERE benutzer_id = ?",
                (json.dumps(roles, ensure_ascii=False), benutzer_id),
            )
        elif action == "region":
            region = str(value)
            if region not in available_regions(con):
                raise SystemInputError("Die Region ist ungültig.")
            if enabled and region not in regions:
                regions.append(region)
            if not enabled and region in regions:
                regions.remove(region)
            con.execute(
                "UPDATE benutzer SET regionen = ? WHERE benutzer_id = ?",
                (json.dumps(regions, ensure_ascii=False), benutzer_id),
            )
        elif action == "aktiv":
            if not enabled and "ADMIN" in roles:
                active_admins = sum(
                    "ADMIN" in _json_array(candidate["rollen"])
                    for candidate in con.execute(
                        "SELECT rollen FROM benutzer WHERE aktiv = 1 AND benutzer_id <> ?",
                        (benutzer_id,),
                    )
                )
                if not active_admins:
                    raise SystemInputError(
                        "Der letzte aktive ADMIN kann nicht deaktiviert werden."
                    )
            con.execute(
                "UPDATE benutzer SET aktiv = ? WHERE benutzer_id = ?",
                (int(enabled), benutzer_id),
            )
        else:
            raise SystemInputError("Die Änderung ist ungültig.")
        changed = con.execute(
            "SELECT * FROM benutzer WHERE benutzer_id = ?", (benutzer_id,)
        ).fetchone()
    return _user_dict(changed)


def user_regions(user: dict) -> set[str] | None:
    regions = {str(region) for region in user.get("regionen") or []}
    return regions or None


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

    con = connect()
    try:
        parameter = con.execute("SELECT jahr FROM parameter").fetchone()
        projekt = con.execute(
            """
            SELECT projekt_nr, name, region
            FROM projekt
            WHERE projekt_nr = ? AND status = 'AKTIV'
            """,
            (projekt_nr,),
        ).fetchone()
        if parameter is None or projekt is None:
            raise ForecastInputError("Der aktive Auftrag wurde nicht gefunden.")
        if allowed_regions is not None and projekt["region"] not in allowed_regions:
            raise ForecastInputError("Der Auftrag gehört nicht zu Ihrer Region.")

        saved = []
        for monat, angezeigt in prepared:
            gespeichert = -angezeigt if groesse == "umsatz" else angezeigt
            con.execute(
                """
                INSERT INTO forecast_plan
                  (jahr, region, auftrag, auftragname, groesse, art, monat, wert)
                VALUES (?, ?, ?, ?, ?, 'plan', ?, ?)
                """,
                (
                    parameter["jahr"],
                    projekt["region"],
                    projekt["projekt_nr"],
                    projekt["name"],
                    groesse,
                    monat,
                    gespeichert,
                ),
            )
            saved.append(
                {
                    "jahr": parameter["jahr"],
                    "region": projekt["region"],
                    "nr": projekt["projekt_nr"],
                    "name": projekt["name"],
                    "groesse": groesse,
                    "art": "plan",
                    "monat": monat,
                    "wert": gespeichert,
                }
            )
        con.commit()
        return saved
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def guv_matrix(con: sqlite3.Connection) -> list[dict]:
    positionen = [dict(r) for r in con.execute("SELECT zeile, nr, position, formel FROM guv_position ORDER BY zeile")]
    werte = {(r["zeile"], r["monat"]): r["wert"] for r in con.execute("SELECT zeile, monat, wert FROM guv_wert")}
    matrix: dict[int, list[float]] = {}
    out = []
    for pos in positionen:
        if pos["formel"]:
            parts = [int(p) for p in pos["formel"].split("+")]
            values = [sum(matrix[p][m] for p in parts) for m in range(9)]
        else:
            values = [werte.get((pos["zeile"], m + 1), 0.0) for m in range(9)]
        matrix[pos["zeile"]] = values
        out.append({"zeile": pos["zeile"], "nr": pos["nr"], "name": pos["position"], "sum": bool(pos["formel"]), "values": values})
    return out


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


def build(allowed_regions: set[str] | None = None) -> dict:
    con = connect()
    parameter = dict(con.execute("SELECT * FROM parameter").fetchone())
    jahr = parameter["jahr"]
    letzter = parameter["letzter_ist_monat"]
    stichtag = date.fromisoformat(parameter["stichtag"])
    guv = guv_matrix(con)
    dso = con.execute("SELECT wert FROM liq_parameter WHERE jahr = ? AND schluessel = 'dso_tage'", (jahr,)).fetchone()["wert"]
    dpo = con.execute("SELECT wert FROM liq_parameter WHERE jahr = ? AND schluessel = 'dpo_tage'", (jahr,)).fetchone()["wert"]
    start = con.execute("SELECT saldo FROM liq_bestand ORDER BY rowid DESC LIMIT 1").fetchone()["saldo"]

    zeilen = [dict(r) for r in con.execute("SELECT * FROM v_zeile WHERE jahr = ?", (jahr,))]
    plaene = [dict(r) for r in con.execute("SELECT * FROM forecast_plan WHERE jahr = ? AND art = 'plan'", (jahr,))]
    all_stamm = {
        r["projekt_nr"]: dict(r) for r in con.execute("SELECT * FROM projekt")
    }
    stamm = all_stamm
    if allowed_regions is not None:
        zeilen = [row for row in zeilen if row["region"] in allowed_regions]
        plaene = [row for row in plaene if row["region"] in allowed_regions]
        stamm = {
            nr: row for nr, row in stamm.items() if row["region"] in allowed_regions
        }

    def passt(z, nr, monat=None, gruppe=None):
        if z["projekt_nr"] != nr or z["kostentraeger"] != "Projekt" or not z["ergebnisrelevant"] or z["belegart"] == "CA":
            return False
        if monat is not None and z["monat"] != monat:
            return False
        if gruppe is not None and z["guv_gruppe"] != gruppe:
            return False
        return True

    kenn = []
    for m in range(1, 13):
        ist = m <= letzter
        if m <= 9:
            umsatz, bestand, sonstige = row_values(guv, 8)[m - 1], row_values(guv, 10)[m - 1], row_values(guv, 28)[m - 1]
            ebitda_guv, abschr = row_values(guv, 74)[m - 1], row_values(guv, 77)[m - 1]
            finanz, steuern, neutral = row_values(guv, 89)[m - 1], row_values(guv, 57)[m - 1], row_values(guv, 73)[m - 1]
        else:
            umsatz = bestand = sonstige = ebitda_guv = abschr = finanz = steuern = neutral = 0.0
        kenn.append({
            "m": m, "name": MONATE[m - 1], "ist": ist, "umsatz": umsatz, "bestand": bestand,
            "sonstige": sonstige, "leistung": umsatz + bestand, "ebitdaGuV": ebitda_guv,
            "abschreibungen": abschr, "finanzergebnis": finanz, "steuern": steuern, "neutral": neutral,
            "auftragsergebnis": sum(z["ergebnis_akte"] for z in zeilen if z["monat"] == m),
        })

    plan = {r["monat"]: r for r in con.execute("SELECT monat, operativ, overhead, bewertung FROM ebitda_plan WHERE jahr = ?", (jahr,))}
    offen_rows = con.execute(
        "SELECT monat, betrag FROM verlust WHERE gebucht = 1 AND im_forecast = 1 AND nachrichtlich = 0"
    ).fetchall()
    offen: dict[int, float] = {}
    for r in offen_rows:
        offen[r["monat"]] = offen.get(r["monat"], 0.0) + r["betrag"]
    for row in kenn:
        p = plan.get(row["m"], {"operativ": 0.0, "overhead": 0.0, "bewertung": 0.0})
        bewertet = offen.get(row["m"], 0.0)
        row["operativ"] = p["operativ"]
        row["overhead"] = p["overhead"]
        row["bewertungPlan"] = p["bewertung"]
        row["bewertungOffen"] = bewertet
        row["ebitda"] = row["ebitdaGuV"] if row["ist"] else p["operativ"] + p["overhead"] + bewertet

    forecast = []
    for m in range(1, 13):
        ist = m <= letzter
        journal = sum(z["leistung"] for z in zeilen if z["monat"] == m and z["ergebnisrelevant"] and z["kostentraeger"] == "Projekt")
        sums: dict[str, float] = {}
        for p in plaene:
            if p["monat"] == m:
                sums[p["groesse"]] = sums.get(p["groesse"], 0.0) + p["wert"]
        umsatz_plan = 0.0 if ist else -sums.get("umsatz", 0.0)
        kosten_plan = 0.0 if ist else sums.get("kosten", 0.0)
        bestand_plan = 0.0 if ist else sums.get("ba", 0.0)
        forecast.append({
            "m": m, "name": MONATE[m - 1], "ist": ist, "leistungJournal": journal,
            "umsatzPlan": None if ist else umsatz_plan,
            "kostenPlan": None if ist else kosten_plan,
            "bestandPlan": None if ist else bestand_plan,
            "angezeigt": journal if ist else umsatz_plan + bestand_plan - kosten_plan,
        })

    def serie(nr: str) -> list[float]:
        werte = []
        for m in range(1, 13):
            if m <= letzter:
                werte.append(sum(z["leistung"] for z in zeilen if z["monat"] == m and z["projekt_nr"] == nr and z["ergebnisrelevant"] and z["kostentraeger"] == "Projekt"))
            else:
                sums: dict[str, float] = {}
                for p in plaene:
                    if p["monat"] == m and p["auftrag"] == nr:
                        sums[p["groesse"]] = sums.get(p["groesse"], 0.0) + p["wert"]
                werte.append(-sums.get("umsatz", 0.0) + sums.get("ba", 0.0) - sums.get("kosten", 0.0))
        return werte

    orders = []
    for nr in con.execute("SELECT projekt_nr FROM auftrag_liste ORDER BY zeile"):
        projekt_nr = nr["projekt_nr"]
        s = stamm.get(projekt_nr)
        if allowed_regions is not None and s is None:
            continue
        leistung = sum(z["leistung"] for z in zeilen if passt(z, projekt_nr))
        kvar = sum(z["kvar"] for z in zeilen if passt(z, projekt_nr))
        kfix = sum(z["kfix"] for z in zeilen if passt(z, projekt_nr))
        umlage = sum(z["umlage"] for z in zeilen if passt(z, projekt_nr))
        ergebnis_db = sum(z["ergebnis_db"] for z in zeilen if z["projekt_nr"] == projekt_nr)
        akte = leistung - (kvar + kfix + umlage)
        orders.append({
            "nr": projekt_nr,
            "name": s["name"] if s else "",
            "region": s["region"] if s else "",
            "status": s["status"] if s else "",
            "leistung": leistung, "kvar": kvar, "kfix": kfix, "umlage": umlage,
            "db": ergebnis_db, "akte": akte, "abgrenzung": ergebnis_db - akte,
        })

    regionen = []
    for region in con.execute("SELECT name FROM region_liste ORDER BY zeile"):
        name = region["name"]
        if allowed_regions is not None and name not in allowed_regions:
            continue
        akte, fc, umsatz = [], [], []
        for m in range(1, 13):
            akte.append(sum(z["ergebnis_akte"] for z in zeilen if z["monat"] == m and z["region"] == name))
            umsatz.append(
                sum(
                    z["leistung"]
                    for z in zeilen
                    if z["monat"] == m
                    and z["region"] == name
                    and z["guv_gruppe"] == "1 Umsatzerlöse"
                )
            )
            if m <= letzter:
                fc.append(None)
            else:
                fc.append(-sum(p["wert"] for p in plaene if p["region"] == name and p["groesse"] == "umsatz" and p["monat"] == m))
        regionen.append(
            {"region": name, "akte": akte, "forecast": fc, "umsatz": umsatz}
        )

    nummern = []
    gesehen = set()
    listen_nummern = [
        r["projekt_nr"]
        for r in con.execute("SELECT projekt_nr FROM auftrag_liste ORDER BY zeile")
        if allowed_regions is None or r["projekt_nr"] in stamm
    ]
    for nr in listen_nummern + [p["auftrag"] for p in plaene] + [z["projekt_nr"] for z in zeilen if z["kostentraeger"] == "Projekt"]:
        if nr and nr not in gesehen:
            gesehen.add(nr)
            nummern.append(nr)
    plan_name = {}
    for p in plaene:
        plan_name.setdefault(p["auftrag"], p)
    forecast_orders = []
    for nr in nummern:
        s = stamm.get(nr)
        p = plan_name.get(nr)
        forecast_orders.append({
            "nr": nr,
            "name": (s["name"] if s and s["name"] else p["auftragname"] if p else ""),
            "region": (s["region"] if s and s["region"] else p["region"] if p else ""),
            "status": s["status"] if s else "",
            "monate": serie(nr),
        })

    def auftrag_detail(nr: str) -> dict:
        umsatz = sum(z["leistung"] for z in zeilen if passt(z, nr, gruppe="1 Umsatzerlöse"))
        bestand_a = sum(z["leistung"] for z in zeilen if passt(z, nr, gruppe="2 Bestandsveränderungen"))
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

    source_regions: dict[str, set[str]] = {}
    for source in con.execute("SELECT region, auftrag FROM kosten_meldung"):
        project = all_stamm.get(source["auftrag"])
        if project and project["region"]:
            source_regions.setdefault(source["region"], set()).add(project["region"])
    region_aliases = {
        source: next(iter(regions))
        for source, regions in source_regions.items()
        if len(regions) == 1
    }

    kosten_rows = []
    for row in con.execute("SELECT * FROM kosten_meldung ORDER BY zeile"):
        nr = row["auftrag"]
        project = all_stamm.get(nr)
        region = (
            project["region"]
            if project and project["region"]
            else region_aliases.get(row["region"], row["region"])
        )
        if allowed_regions is not None and region not in allowed_regions:
            continue
        umsatz_sap = sum(z["leistung"] for z in zeilen if passt(z, nr, gruppe="1 Umsatzerlöse"))
        kosten_sap = sum(z["kvar"] + z["kfix"] + z["umlage"] for z in zeilen if passt(z, nr))
        ergebnis_sap = sum(z["ergebnis_akte"] for z in zeilen if z["projekt_nr"] == nr)
        kosten_rows.append({
            "psp": row["psp"], "nr": nr, "titel": row["titel"], "region": region,
            "umsatzMeldung": row["umsatz_meldung"], "kostenMeldung": row["kosten_meldung"],
            "ergebnisMeldung": row["ergebnis_meldung"], "umsatzSap": umsatz_sap,
            "kostenSap": kosten_sap, "ergebnisSap": ergebnis_sap,
            "delta": ergebnis_sap - row["ergebnis_meldung"], "vertrag": row["vertrag_umsatz"],
        })

    liq_monate = [dict(r) for r in con.execute("SELECT * FROM liq_monat ORDER BY jahr, monat")]
    weeks = liquidity(liq_monate, stichtag, dso, dpo, start)
    details = {}
    detail_nummern = {o["nr"] for o in orders}
    if allowed_regions is None or parameter["auftragsnummer"] in stamm:
        detail_nummern.add(parameter["auftragsnummer"])
    for nr in detail_nummern:
        details[nr] = auftrag_detail(nr)

    regional_months = []
    if allowed_regions is not None:
        for m in range(1, 13):
            rows = [row for row in zeilen if row["monat"] == m]
            regional_months.append(
                {
                    "m": m,
                    "name": MONATE[m - 1],
                    "ist": m <= letzter,
                    "umsatz": sum(
                        row["leistung"]
                        for row in rows
                        if row["guv_gruppe"] == "1 Umsatzerlöse"
                    ),
                    "bestand": sum(
                        row["leistung"]
                        for row in rows
                        if row["guv_gruppe"] == "2 Bestandsveränderungen"
                    ),
                    "sonstige": sum(
                        row["leistung"]
                        for row in rows
                        if row["guv_gruppe"] == "3 Sonstige betriebliche Erträge"
                    ),
                    "leistung": sum(row["leistung"] for row in rows),
                    "ergebnis": sum(row["ergebnis_akte"] for row in rows),
                }
            )

    payload = {
        "jahr": jahr,
        "letzterIst": letzter,
        "letzterIstName": MONATE[letzter - 1],
        "stichtag": parameter["stichtag"],
        "auftragsnummer": parameter["auftragsnummer"],
        "monate": MONATE,
        "months": kenn if allowed_regions is None else [],
        "regionalMonths": regional_months,
        "forecast": forecast,
        "guv": guv if allowed_regions is None else [],
        "orders": orders,
        "forecastOrders": forecast_orders,
        "regions": regionen,
        "verluste": [
            {
                "jahr": r["jahr"], "monat": r["monat"], "region": r["region"], "projekt": r["projekt"],
                "betrag": r["betrag"], "gebucht": bool(r["gebucht"]), "imForecast": bool(r["im_forecast"]),
                "nachrichtlich": bool(r["nachrichtlich"]), "notiz": r["notiz"],
            }
            for r in con.execute("SELECT * FROM verlust ORDER BY jahr, monat, rowid")
            if allowed_regions is None or r["region"] in allowed_regions
        ],
        "konto": [
            dict(r) for r in con.execute("SELECT stichtag, konto, saldo FROM kontostand")
        ] if allowed_regions is None else [],
        "kostenarten": [
            {"id": r["kostenart_id"], "konto": r["konto"], "bezeichnung": r["bezeichnung"], "stufe": r["db_stufe"], "gruppe": r["guv_gruppe"], "klr": r["klr_gruppe"]}
            for r in con.execute("SELECT * FROM kostenart ORDER BY sortierung, kostenart_id")
        ],
        "legende": [dict(r) for r in con.execute("SELECT punkt, formel FROM legende ORDER BY zeile")],
        "liqParameter": [
            {"key": r["schluessel"], "wert": r["wert"], "einheit": r["einheit"], "text": r["beschreibung"]}
            for r in con.execute("SELECT * FROM liq_parameter WHERE jahr = ? ORDER BY schluessel", (jahr,))
        ] if allowed_regions is None else [],
        "parameter": [
            {"name": "Jahr", "wert": str(jahr)},
            {"name": "Letzter Ist-Monat", "wert": MONATE[letzter - 1]},
            {"name": "Stichtag", "wert": stichtag.strftime("%d.%m.%Y")},
            {"name": "DSO", "wert": f"{dso:g} Tage"},
            {"name": "DPO", "wert": f"{dpo:g} Tage"},
            {"name": "Cash-Pool", "wert": start},
        ] if allowed_regions is None else [
            {"name": "Jahr", "wert": str(jahr)},
            {"name": "Letzter Ist-Monat", "wert": MONATE[letzter - 1]},
            {"name": "Stichtag", "wert": stichtag.strftime("%d.%m.%Y")},
        ],
        "projektstamm": [
            {"id": r["projekt_id"], "nr": r["projekt_nr"], "name": r["name"], "typ": r["typ"], "region": r["region"], "status": r["status"], "budgetUmsatz": r["budget_umsatz"], "budgetKosten": r["budget_kosten"]}
            for r in con.execute("SELECT * FROM projekt ORDER BY projekt_id")
            if allowed_regions is None or r["region"] in allowed_regions
        ],
        "kostenverfolgung": kosten_rows,
        "liqBestand": [
            dict(r) for r in con.execute(
                "SELECT monat, saldo, quelle FROM liq_bestand ORDER BY jahr, monat"
            )
        ] if allowed_regions is None else [],
        "forecastPlan": [
            {"region": r["region"], "nr": r["auftrag"], "name": r["auftragname"], "groesse": r["groesse"], "art": r["art"], "monat": r["monat"], "wert": r["wert"]}
            for r in con.execute(
                "SELECT region, auftrag, auftragname, groesse, art, monat, wert FROM forecast_plan WHERE jahr = ? ORDER BY art, region, auftrag, groesse, monat",
                (jahr,),
            )
            if allowed_regions is None or r["region"] in allowed_regions
        ],
        "liquidity": {
            "start": start if allowed_regions is None else 0,
            "dso": dso if allowed_regions is None else 0,
            "dpo": dpo if allowed_regions is None else 0,
            "weeks": weeks if allowed_regions is None else [],
        },
        "auftragDetail": details,
        "scope": {
            "regional": allowed_regions is not None,
            "regions": sorted(allowed_regions) if allowed_regions is not None else [],
        },
    }
    con.close()
    return payload


def journal_rows(allowed_regions: set[str] | None = None) -> list[dict]:
    con = connect()
    jahr = con.execute("SELECT jahr FROM parameter").fetchone()["jahr"]
    rows = [
        {
            "id": r["id"], "datum": r["datum"], "monat": r["monat"], "belegart": r["belegart"],
            "beleg": r["belegnummer"], "nr": r["projekt_nr"], "projekt": r["projektname"],
            "region": r["region"], "kostenart": r["konto"], "text": r["text"], "wert": r["wert"],
            "stufe": r["db_stufe"], "guvGruppe": r["guv_gruppe"],
            "belegkreis": r["belegkreis"], "kostentraeger": r["kostentraeger"],
            "ergebnisrelevant": bool(r["ergebnisrelevant"]), "leistung": r["leistung"],
            "kvar": r["kvar"], "kfix": r["kfix"], "umlage": r["umlage"],
            "beitrag": r["beitrag"],
        }
        for r in con.execute("SELECT * FROM v_zeile WHERE jahr = ? ORDER BY datum, id", (jahr,))
        if allowed_regions is None or r["region"] in allowed_regions
    ]
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
        rows = con.execute(
            """
            SELECT id, name, quelle, aufbau, geaendert_at
            FROM bericht_vorlage
            WHERE benutzer_id = ?
            ORDER BY name
            """,
            (benutzer_id,),
        )
        return [
            {
                "id": row["id"],
                "name": row["name"],
                "quelle": row["quelle"],
                "aufbau": json.loads(row["aufbau"]),
                "geaendertAt": row["geaendert_at"],
            }
            for row in rows
        ]


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
    with connect() as con:
        con.execute(
            """
            INSERT INTO bericht_vorlage
              (benutzer_id, name, quelle, aufbau, geaendert_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (benutzer_id, name) DO UPDATE SET
              quelle = excluded.quelle,
              aufbau = excluded.aufbau,
              geaendert_at = CURRENT_TIMESTAMP
            """,
            (benutzer_id, name, quelle, serialized),
        )
        row = con.execute(
            "SELECT id FROM bericht_vorlage WHERE benutzer_id = ? AND name = ?",
            (benutzer_id, name),
        ).fetchone()
    return int(row["id"])


def delete_report_template(benutzer_id: int, template_id: int) -> None:
    ensure_system_schema()
    with connect() as con:
        result = con.execute(
            "DELETE FROM bericht_vorlage WHERE id = ? AND benutzer_id = ?",
            (template_id, benutzer_id),
        )
        if not result.rowcount:
            raise SystemInputError("Die Vorlage wurde nicht gefunden.")


JA_STATUS = {"offen", "in_arbeit", "erledigt", "entfaellt"}


def annual_entries() -> list[dict]:
    ensure_system_schema()
    with connect() as con:
        return [
            {
                "schluessel": row["schluessel"],
                "status": row["status"],
                "datum": row["datum"],
                "dateiname": row["dateiname"],
                "geaendertAt": row["geaendert_at"],
            }
            for row in con.execute(
                """
                SELECT schluessel, status, datum, dateiname, geaendert_at
                FROM ja_stand
                ORDER BY schluessel
                """
            )
        ]


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
    ensure_system_schema()
    with connect() as con:
        row = con.execute(
            "SELECT dateiname, dokument FROM ja_stand WHERE schluessel = ?", (key,)
        ).fetchone()
    if not row or not row["dateiname"] or row["dokument"] is None:
        return None
    return str(row["dateiname"]), bytes(row["dokument"])


def log_import(
    filename: str, step: str, status: str, rows: int = 0, detail: str = ""
) -> None:
    ensure_system_schema()
    with connect() as con:
        con.execute(
            """
            INSERT INTO import_protokoll
              (dateiname, schritt, status, zeilen, detail)
            VALUES (?, ?, ?, ?, ?)
            """,
            (Path(filename).name[:240], step[:30], status[:30], int(rows), detail[:1000]),
        )


def import_log() -> list[dict]:
    ensure_system_schema()
    with connect() as con:
        return [
            {
                "id": row["id"],
                "erstelltAt": row["erstellt_at"],
                "dateiname": row["dateiname"],
                "schritt": row["schritt"],
                "status": row["status"],
                "zeilen": row["zeilen"],
                "detail": row["detail"],
            }
            for row in con.execute(
                "SELECT * FROM import_protokoll ORDER BY id DESC LIMIT 50"
            )
        ]
