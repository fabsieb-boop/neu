"""Rechnet die Dashboard-Blätter aus den Quelltabellen. Keine zusätzlichen Beträge."""

from __future__ import annotations

import math
import os
import sqlite3
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = Path(os.environ.get("TVF_DB", ROOT / "data" / "tvf.sqlite"))
MONATE = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
]


class ForecastInputError(ValueError):
    pass


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con


def add_forecast_plan(projekt_nr: str, groesse: str, werte: list[dict]) -> list[dict]:
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


def build() -> dict:
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
    stamm = {r["projekt_nr"]: dict(r) for r in con.execute("SELECT * FROM projekt")}

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
        akte, fc = [], []
        for m in range(1, 13):
            akte.append(sum(z["ergebnis_akte"] for z in zeilen if z["monat"] == m and z["region"] == name))
            if m <= letzter:
                fc.append(None)
            else:
                fc.append(-sum(p["wert"] for p in plaene if p["region"] == name and p["groesse"] == "umsatz" and p["monat"] == m))
        regionen.append({"region": name, "akte": akte, "forecast": fc})

    nummern = []
    gesehen = set()
    for nr in [r["projekt_nr"] for r in con.execute("SELECT projekt_nr FROM auftrag_liste ORDER BY zeile")] + [p["auftrag"] for p in plaene] + [z["projekt_nr"] for z in zeilen if z["kostentraeger"] == "Projekt"]:
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

    kosten_rows = []
    for row in con.execute("SELECT * FROM kosten_meldung ORDER BY zeile"):
        nr = row["auftrag"]
        umsatz_sap = sum(z["leistung"] for z in zeilen if passt(z, nr, gruppe="1 Umsatzerlöse"))
        kosten_sap = sum(z["kvar"] + z["kfix"] + z["umlage"] for z in zeilen if passt(z, nr))
        ergebnis_sap = sum(z["ergebnis_akte"] for z in zeilen if z["projekt_nr"] == nr)
        kosten_rows.append({
            "psp": row["psp"], "nr": nr, "titel": row["titel"], "region": row["region"],
            "umsatzMeldung": row["umsatz_meldung"], "kostenMeldung": row["kosten_meldung"],
            "ergebnisMeldung": row["ergebnis_meldung"], "umsatzSap": umsatz_sap,
            "kostenSap": kosten_sap, "ergebnisSap": ergebnis_sap,
            "delta": ergebnis_sap - row["ergebnis_meldung"], "vertrag": row["vertrag_umsatz"],
        })

    liq_monate = [dict(r) for r in con.execute("SELECT * FROM liq_monat ORDER BY jahr, monat")]
    weeks = liquidity(liq_monate, stichtag, dso, dpo, start)
    details = {}
    for nr in {parameter["auftragsnummer"], *[o["nr"] for o in orders]}:
        details[nr] = auftrag_detail(nr)

    payload = {
        "jahr": jahr,
        "letzterIst": letzter,
        "letzterIstName": MONATE[letzter - 1],
        "stichtag": parameter["stichtag"],
        "auftragsnummer": parameter["auftragsnummer"],
        "monate": MONATE,
        "months": kenn,
        "forecast": forecast,
        "guv": guv,
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
        ],
        "konto": [dict(r) for r in con.execute("SELECT stichtag, konto, saldo FROM kontostand")],
        "kostenarten": [
            {"id": r["kostenart_id"], "konto": r["konto"], "bezeichnung": r["bezeichnung"], "stufe": r["db_stufe"], "gruppe": r["guv_gruppe"], "klr": r["klr_gruppe"]}
            for r in con.execute("SELECT * FROM kostenart ORDER BY sortierung, kostenart_id")
        ],
        "legende": [dict(r) for r in con.execute("SELECT punkt, formel FROM legende ORDER BY zeile")],
        "liqParameter": [
            {"key": r["schluessel"], "wert": r["wert"], "einheit": r["einheit"], "text": r["beschreibung"]}
            for r in con.execute("SELECT * FROM liq_parameter WHERE jahr = ? ORDER BY schluessel", (jahr,))
        ],
        "parameter": [
            {"name": "Jahr", "wert": str(jahr)},
            {"name": "Letzter Ist-Monat", "wert": MONATE[letzter - 1]},
            {"name": "Stichtag", "wert": stichtag.strftime("%d.%m.%Y")},
            {"name": "DSO", "wert": f"{dso:g} Tage"},
            {"name": "DPO", "wert": f"{dpo:g} Tage"},
            {"name": "Cash-Pool", "wert": start},
        ],
        "projektstamm": [
            {"id": r["projekt_id"], "nr": r["projekt_nr"], "name": r["name"], "typ": r["typ"], "region": r["region"], "status": r["status"], "budgetUmsatz": r["budget_umsatz"], "budgetKosten": r["budget_kosten"]}
            for r in con.execute("SELECT * FROM projekt ORDER BY projekt_id")
        ],
        "kostenverfolgung": kosten_rows,
        "liqBestand": [dict(r) for r in con.execute("SELECT monat, saldo, quelle FROM liq_bestand ORDER BY jahr, monat")],
        "forecastPlan": [
            {"region": r["region"], "nr": r["auftrag"], "name": r["auftragname"], "groesse": r["groesse"], "art": r["art"], "monat": r["monat"], "wert": r["wert"]}
            for r in con.execute(
                "SELECT region, auftrag, auftragname, groesse, art, monat, wert FROM forecast_plan WHERE jahr = ? ORDER BY art, region, auftrag, groesse, monat",
                (jahr,),
            )
        ],
        "liquidity": {"start": start, "dso": dso, "dpo": dpo, "weeks": weeks},
        "auftragDetail": details,
    }
    con.close()
    return payload


def journal_rows() -> list[dict]:
    con = connect()
    jahr = con.execute("SELECT jahr FROM parameter").fetchone()["jahr"]
    rows = [
        {
            "id": r["id"], "datum": r["datum"], "monat": r["monat"], "belegart": r["belegart"],
            "beleg": r["belegnummer"], "nr": r["projekt_nr"], "projekt": r["projektname"],
            "region": r["region"], "kostenart": r["konto"], "text": r["text"], "wert": r["wert"],
        }
        for r in con.execute("SELECT * FROM v_zeile WHERE jahr = ? ORDER BY datum, id", (jahr,))
    ]
    con.close()
    return rows
