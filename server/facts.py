"""Liest Dashboard-Zahlen aus dem Controlling-Schema. Keine zweite GuV-Tabelle."""

from __future__ import annotations

import json
import sqlite3
from datetime import date

APP_REGION = {"Sued-West": "Süd-West"}
INTERNAL = {"OVERHEAD", "BEWERTUNG"}
EBITDA_CODES = {
    "UMSATZ",
    "BESTANDSVERAENDERUNG",
    "SONST_ERTRAEGE",
    "MATERIAL_FREMD",
    "PERSONAL",
    "SONST_AUFWAND",
    "SONST_STEUERN",
}
LEAVES = [
    ("UMSATZ", "Umsatzerloese", 10),
    ("BESTANDSVERAENDERUNG", "Bestandsveraenderung", 20),
    ("SONST_ERTRAEGE", "Sonstige betriebliche Ertraege", 30),
    ("MATERIAL_FREMD", "Material und Fremdleistungen", 40),
    ("PERSONAL", "Personalaufwand", 50),
    ("SONST_AUFWAND", "Sonstige betriebliche Aufwendungen", 60),
    ("SONST_STEUERN", "Sonstige Steuern", 70),
    ("NEUTRAL_ERGEBNIS", "Neutrales Ergebnis", 80),
    ("ABSCHREIBUNGEN", "Abschreibungen", 90),
    ("ZINSEN_STEUERN", "Zinsen und Steuern", 100),
]
WERTART = {"UMSATZ": "umsatz", "KOSTEN": "kosten", "BESTANDSVERAENDERUNG": "ba"}


def app_region(name: str | None) -> str:
    if not name:
        return "Ohne Zuordnung"
    return APP_REGION.get(name, name)


def settings(con: sqlite3.Connection) -> dict:
    rolling = con.execute(
        """
        SELECT geschaeftsjahr, ist_bis_periode
        FROM forecast_version
        WHERE typ = 'ROLLING_FORECAST' AND ist_aktiv = 1
        """
    ).fetchone()
    plan = con.execute(
        """
        SELECT ist_bis_periode FROM forecast_version
        WHERE typ = 'PLAN' AND geschaeftsjahr = ?
        """,
        (rolling["geschaeftsjahr"],),
    ).fetchone()
    szenario = con.execute(
        """
        SELECT startdatum, enddatum, startsaldo, dso_tage, dpo_tage
        FROM liq_szenario
        WHERE bezeichnung = 'Liquidität'
        """
    ).fetchone()
    note = con.execute(
        """
        SELECT bemerkung FROM import_lauf
        WHERE quelle = 'FI_EINZELPOSTEN'
        ORDER BY import_id
        LIMIT 1
        """
    ).fetchone()
    auftrag = ""
    if note and note["bemerkung"] and "auftrag=" in note["bemerkung"]:
        auftrag = note["bemerkung"].split("auftrag=", 1)[1].split(";", 1)[0]
    letzter = int(rolling["ist_bis_periode"])
    sheet = int(plan["ist_bis_periode"])
    return {
        "jahr": int(rolling["geschaeftsjahr"]),
        "letzter": letzter,
        "sheet": sheet,
        "gesetzt": letzter != sheet,
        "stichtag": szenario["startdatum"],
        "auftrag": auftrag,
        "dso": float(szenario["dso_tage"]),
        "dpo": float(szenario["dpo_tage"]),
        "start": float(szenario["startsaldo"]),
    }


def lines(con: sqlite3.Connection, jahr: int) -> list[dict]:
    query = """
        SELECT b.buchung_id, b.buchungsdatum, b.periode, b.belegnr, b.betrag_sap, b.buchungstext,
               b.konto_nr, k.kaufm_faktor, p.auftragsnr, p.bezeichnung AS projektname,
               p.bemerkung, p.phase, r.bezeichnung AS region_name, ks.typ AS ks_typ,
               bp.code AS position_code, bp.bezeichnung AS position_name
        FROM buchung b
        JOIN konto k ON k.konto_nr = b.konto_nr
        LEFT JOIN projekt p ON p.projekt_id = b.projekt_id
        LEFT JOIN region r ON r.region_id = p.region_id
        LEFT JOIN kostenstelle ks ON ks.kostenstelle_id = p.kostenstelle_id
        LEFT JOIN konto_mapping km ON km.konto_nr = k.konto_nr
        LEFT JOIN berichtsposition bp ON bp.position_id = km.position_id AND bp.bericht = 'GUV'
        WHERE b.geschaeftsjahr = ?
        ORDER BY b.buchungsdatum, b.buchung_id
    """
    out = []
    for row in con.execute(query, (jahr,)):
        beleg = row["belegnr"] or ""
        relevant = bool(beleg) and not beleg.startswith("80") and not beleg.startswith("OHNE-")
        code = row["position_code"] or ""
        if code in {"UMSATZ", "BESTANDSVERAENDERUNG"}:
            stufe = 0
        elif code == "MATERIAL_FREMD":
            stufe = 1
        elif code in {"PERSONAL", "SONST_AUFWAND"}:
            stufe = 2
        else:
            stufe = 9
        wert = float(row["betrag_sap"])
        faktor = int(row["kaufm_faktor"])
        umlage_beleg = beleg.startswith("9900")
        leistung = wert * faktor if relevant and stufe == 0 else 0.0
        kvar = wert if relevant and stufe == 1 else 0.0
        kfix = wert if relevant and stufe == 2 and not umlage_beleg else 0.0
        umlage = wert if relevant and umlage_beleg else 0.0
        ks = row["ks_typ"]
        if ks == "PROJEKT":
            traeger = "Projekt"
        elif ks == "NIEDERLASSUNG":
            traeger = "Bereich"
        elif ks == "OVERHEAD":
            traeger = "Zentrale"
        else:
            traeger = "Offen"
        if beleg.startswith("9900"):
            kreis = "Umlage"
        elif beleg.startswith("80"):
            kreis = "Abrechnung"
        elif beleg.startswith("9"):
            kreis = "Verrechnung"
        else:
            kreis = "Primaer"
        beitrag = leistung - (kvar + kfix + umlage) if relevant else 0.0
        ergebnis = beitrag if relevant and traeger == "Projekt" else 0.0
        out.append({
            "id": row["buchung_id"],
            "datum": row["buchungsdatum"],
            "jahr": jahr,
            "monat": int(row["periode"]),
            "belegart": "",
            "belegnummer": beleg,
            "projekt_nr": row["auftragsnr"] or "",
            "projektname": row["projektname"] or "",
            "text": row["buchungstext"] or "",
            "konto": row["konto_nr"],
            "wert": wert,
            "region": app_region(row["region_name"]) if row["auftragsnr"] else "Ohne Zuordnung",
            "db_stufe": stufe,
            "guv_gruppe": row["position_name"] or "",
            "position_code": code,
            "belegkreis": kreis,
            "kostentraeger": traeger,
            "ergebnisrelevant": relevant,
            "leistung": leistung,
            "kvar": kvar,
            "kfix": kfix,
            "umlage": umlage,
            "beitrag": beitrag,
            "ergebnis_db": ergebnis,
            "ergebnis_akte": ergebnis,
            "phase": row["phase"] or "",
            "bemerkung": row["bemerkung"] or "",
        })
    return out


def plans(con: sqlite3.Connection, jahr: int) -> list[dict]:
    """Projekt-Forecast, kaufmännisch positiv. Overhead und Bewertung bleiben draussen."""
    rows = []
    query = """
        SELECT p.auftragsnr, p.bezeichnung, p.bemerkung, r.bezeichnung AS region_name,
               fw.monat, fw.wertart, fw.betrag_plan, fw.betrag_forecast
        FROM forecast_wert fw
        JOIN projekt p ON p.projekt_id = fw.projekt_id
        JOIN region r ON r.region_id = p.region_id
        JOIN forecast_version v ON v.version_id = fw.version_id
        WHERE v.typ = 'ROLLING_FORECAST' AND v.ist_aktiv = 1 AND v.geschaeftsjahr = ?
          AND p.auftragsnr NOT IN ('OVERHEAD', 'BEWERTUNG')
    """
    for row in con.execute(query, (jahr,)):
        month = int(row["monat"][5:7])
        groesse = WERTART[row["wertart"]]
        base = {
            "auftrag": row["auftragsnr"],
            "auftragname": row["bezeichnung"],
            "region": app_region(row["region_name"]),
            "monat": month,
            "groesse": groesse,
            "bemerkung": row["bemerkung"] or "",
        }
        if row["betrag_plan"] is not None:
            rows.append({**base, "art": "plan", "wert": float(row["betrag_plan"])})
        if row["betrag_forecast"] is not None:
            rows.append({**base, "art": "korrektur", "wert": float(row["betrag_forecast"])})
    return rows


def adjustments(con: sqlite3.Connection, jahr: int) -> dict[int, dict[str, float]]:
    """Overhead als positive Kosten, Bewertung als vorzeichenbehafteter Ergebnisbeitrag."""
    found = {month: {"overhead": 0.0, "bewertung": 0.0} for month in range(1, 13)}
    query = """
        SELECT p.auftragsnr, fw.monat, fw.betrag_plan
        FROM forecast_wert fw
        JOIN projekt p ON p.projekt_id = fw.projekt_id
        JOIN forecast_version v ON v.version_id = fw.version_id
        WHERE v.typ = 'ROLLING_FORECAST' AND v.ist_aktiv = 1 AND v.geschaeftsjahr = ?
          AND p.auftragsnr IN ('OVERHEAD', 'BEWERTUNG')
          AND fw.wertart = 'KOSTEN' AND fw.betrag_plan IS NOT NULL
    """
    for row in con.execute(query, (jahr,)):
        month = int(row["monat"][5:7])
        amount = float(row["betrag_plan"])
        if row["auftragsnr"] == "OVERHEAD":
            found[month]["overhead"] += amount
        else:
            found[month]["bewertung"] += -amount
    return found


def guv_matrix(con: sqlite3.Connection, letzter: int, plan_rows: list[dict], company: dict[int, dict[str, float]]) -> list[dict]:
    ist = {
        (row["position_code"], int(row["periode"])): float(row["betrag_kaufm"])
        for row in con.execute(
            "SELECT position_code, periode, betrag_kaufm FROM v_guv_monat"
        )
    }
    plan_by_month: dict[int, dict[str, float]] = {}
    for month in range(1, 13):
        sums: dict[str, float] = {}
        for row in plan_rows:
            if row["monat"] == month and row["art"] == "plan":
                sums[row["groesse"]] = sums.get(row["groesse"], 0.0) + row["wert"]
        overhead = company[month]["overhead"]
        bewertung = company[month]["bewertung"]
        plan_by_month[month] = {
            "UMSATZ": sums.get("umsatz", 0.0),
            "BESTANDSVERAENDERUNG": sums.get("ba", 0.0),
            "MATERIAL_FREMD": -sums.get("kosten", 0.0),
            "SONST_AUFWAND": -overhead + bewertung,
        }
    leaves: dict[str, list[float]] = {}
    out = []
    zeile = 1
    for code, name, nr in LEAVES:
        values = []
        for month in range(1, 13):
            if month <= letzter:
                values.append(ist.get((code, month), 0.0))
            else:
                values.append(plan_by_month[month].get(code, 0.0))
        leaves[code] = values
        out.append({"zeile": zeile, "nr": nr, "name": name, "sum": False, "values": values})
        zeile += 1

    def add(name: str, nr: int, values: list[float]) -> None:
        nonlocal zeile
        out.append({"zeile": zeile, "nr": nr, "name": name, "sum": True, "values": values})
        zeile += 1

    rohertrag = [
        leaves["UMSATZ"][i] + leaves["BESTANDSVERAENDERUNG"][i] + leaves["MATERIAL_FREMD"][i]
        for i in range(12)
    ]
    ebitda = [sum(leaves[code][i] for code in EBITDA_CODES) for i in range(12)]
    ergebnis = [
        ebitda[i] + leaves["NEUTRAL_ERGEBNIS"][i] + leaves["ABSCHREIBUNGEN"][i] + leaves["ZINSEN_STEUERN"][i]
        for i in range(12)
    ]
    add("Rohertrag", 45, rohertrag)
    add("EBITDA", 85, ebitda)
    add("Ergebnis", 110, ergebnis)
    return out


def projects(con: sqlite3.Connection) -> list[dict]:
    query = """
        SELECT p.projekt_id, p.auftragsnr, p.bezeichnung, p.phase, p.psp, p.bemerkung,
               p.vertragsumsatz, r.bezeichnung AS region_name, ks.typ
        FROM projekt p
        JOIN region r ON r.region_id = p.region_id
        LEFT JOIN kostenstelle ks ON ks.kostenstelle_id = p.kostenstelle_id
        ORDER BY p.projekt_id
    """
    return [
        {
            "id": row["projekt_id"],
            "nr": row["auftragsnr"],
            "name": row["bezeichnung"],
            "typ": row["typ"] or "",
            "region": app_region(row["region_name"]),
            "status": row["phase"],
            "psp": row["psp"] or "",
            "bemerkung": row["bemerkung"] or "",
            "budgetUmsatz": float(row["vertragsumsatz"] or 0),
            "budgetKosten": 0.0,
        }
        for row in con.execute(query)
        if row["auftragsnr"] not in INTERNAL
    ]


def kv_rows(con: sqlite3.Connection) -> list[dict]:
    query = """
        SELECT p.auftragsnr, p.psp, p.bezeichnung, r.bezeichnung AS region_name,
               k.gesamtumsatz, k.projektkosten, k.umsatz_vertrag
        FROM kv_stand k
        JOIN projekt p ON p.projekt_id = k.projekt_id
        JOIN region r ON r.region_id = p.region_id
        ORDER BY k.kv_stand_id
    """
    return [
        {
            "psp": row["psp"] or "",
            "nr": row["auftragsnr"],
            "titel": row["bezeichnung"],
            "region": app_region(row["region_name"]),
            "umsatzMeldung": float(row["gesamtumsatz"]),
            "kostenMeldung": float(row["projektkosten"]),
            "ergebnisMeldung": float(row["gesamtumsatz"]) - float(row["projektkosten"]),
            "vertrag": float(row["umsatz_vertrag"] or 0),
        }
        for row in con.execute(query)
    ]


def accounts(con: sqlite3.Connection) -> list[dict]:
    query = """
        SELECT k.rowid AS id, k.konto_nr, k.bezeichnung, bp.bezeichnung AS gruppe,
               COALESCE(ka.code, '') AS klr
        FROM konto k
        LEFT JOIN konto_mapping km ON km.konto_nr = k.konto_nr
        LEFT JOIN berichtsposition bp ON bp.position_id = km.position_id
        LEFT JOIN kostenart ka ON ka.kostenart_id = k.kostenart_id
        WHERE k.kontoart IN ('ERTRAG', 'AUFWAND')
        ORDER BY k.konto_nr
    """
    out = []
    for row in con.execute(query):
        gruppe = row["gruppe"] or ""
        if gruppe in {"Umsatzerloese", "Bestandsveraenderung"}:
            stufe = 0
        elif gruppe == "Material und Fremdleistungen":
            stufe = 1
        elif gruppe in {"Personalaufwand", "Sonstige betriebliche Aufwendungen"}:
            stufe = 2
        else:
            stufe = 9
        out.append({
            "id": int(row["id"]),
            "konto": row["konto_nr"],
            "bezeichnung": row["bezeichnung"],
            "stufe": stufe,
            "gruppe": gruppe,
            "klr": row["klr"],
        })
    return out


def bank_balances(con: sqlite3.Connection) -> tuple[list[dict], list[dict]]:
    cash = []
    accounts_ = []
    for row in con.execute("SELECT datum, bankkonto, saldo FROM liq_bankstand ORDER BY datum"):
        if row["bankkonto"] == "Cash-Pool":
            cash.append({
                "monat": int(row["datum"][5:7]),
                "saldo": float(row["saldo"]),
                "quelle": "Cash-Pool",
            })
        else:
            accounts_.append({
                "stichtag": row["datum"],
                "konto": row["bankkonto"],
                "saldo": float(row["saldo"]),
            })
    return cash, accounts_


def parameters(con: sqlite3.Connection) -> list[dict]:
    rows = [
        {"key": "dso_tage", "wert": 0.0, "einheit": "Tage", "text": "Zahlungsziel Kunden"},
        {"key": "dpo_tage", "wert": 0.0, "einheit": "Tage", "text": "Zahlungsziel Lieferanten"},
    ]
    szenario = con.execute(
        "SELECT dso_tage, dpo_tage, startsaldo FROM liq_szenario WHERE bezeichnung = 'Liquidität'"
    ).fetchone()
    if szenario is not None:
        rows[0]["wert"] = float(szenario["dso_tage"])
        rows[1]["wert"] = float(szenario["dpo_tage"])
        rows.append({
            "key": "startbestand",
            "wert": float(szenario["startsaldo"]),
            "einheit": "EUR",
            "text": "Cash-Pool zum letzten gemeldeten Stand",
        })
    for row in con.execute("SELECT code, satz FROM klr_zuschlagssatz ORDER BY code"):
        rows.append({
            "key": row["code"],
            "wert": float(row["satz"]),
            "einheit": "Satz",
            "text": "KLR-Zuschlag",
        })
    return rows


def rolling_version(con: sqlite3.Connection) -> sqlite3.Row:
    return con.execute(
        """
        SELECT version_id, geschaeftsjahr, ist_bis_periode
        FROM forecast_version
        WHERE typ = 'ROLLING_FORECAST' AND ist_aktiv = 1
        """
    ).fetchone()


def parse_bank_note(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}
