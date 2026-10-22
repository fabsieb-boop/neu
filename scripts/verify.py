#!/usr/bin/env python3
"""Prüft die SQL-Rechnung gegen die Formeln der Mappe."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server.model import build  # noqa: E402

DB = ROOT / "data" / "tvf.sqlite"


def close(a, b, tol=0.02):
    if abs(a - b) > tol:
        raise SystemExit(f"Abweichung {a} != {b}")


def main() -> None:
    con = sqlite3.connect(DB)
    tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    erwartet = {
        "auftrag_liste", "buchung", "ebitda_plan", "forecast_plan", "guv_position", "guv_wert",
        "kontostand", "kosten_meldung", "kostenart", "legende", "liq_bestand", "liq_monat",
        "liq_parameter", "parameter", "projekt", "region_liste", "verlust",
    }
    if set(tables) != erwartet:
        raise SystemExit(f"Tabellen weichen ab: {tables}")

    bruch = con.execute(
        """
        SELECT COUNT(*) FROM v_zeile
        WHERE ergebnisrelevant = 1 AND db_stufe = 0 AND ABS(leistung + wert) > 0.001
        """
    ).fetchone()[0]
    if bruch:
        raise SystemExit(f"Leistung stimmt nicht: {bruch}")
    bruch = con.execute(
        """
        SELECT COUNT(*) FROM v_zeile
        WHERE ergebnisrelevant = 0 AND (leistung != 0 OR kvar != 0 OR kfix != 0 OR umlage != 0 OR beitrag != 0)
        """
    ).fetchone()[0]
    if bruch:
        raise SystemExit(f"Nicht relevante Zeilen tragen bei: {bruch}")
    bruch = con.execute(
        """
        SELECT COUNT(*) FROM v_zeile
        WHERE ergebnisrelevant = 1 AND ABS(beitrag - (leistung - kvar - kfix - umlage)) > 0.001
        """
    ).fetchone()[0]
    if bruch:
        raise SystemExit(f"Beitrag stimmt nicht: {bruch}")

    data = build()
    januar = next(g for g in data["guv"] if g["zeile"] == 5)
    close(januar["values"][0], 606817.78)
    summe = next(g for g in data["guv"] if g["zeile"] == 8)
    close(summe["values"][0], 606817.78 + 32792.74 - 45.07)
    ebitda = next(g for g in data["guv"] if g["name"] == "EBITDA")
    operativ = next(g for g in data["guv"] if g["name"] == "EBITDA (Operatives Ergebnis)")
    neutral = next(g for g in data["guv"] if g["name"] == "Neutrales Ergebnis")
    for i in range(9):
        close(ebitda["values"][i], operativ["values"][i] + neutral["values"][i])

    m1 = data["months"][0]
    close(m1["umsatz"], summe["values"][0])
    close(m1["ebitda"], ebitda["values"][0])
    close(data["months"][9]["umsatz"], 0)
    close(data["months"][9]["ebitda"], 420750 + -142558 + 0)

    if data["liquidity"]["weeks"][0]["datum"] != "2026-10-19":
        raise SystemExit(data["liquidity"]["weeks"][0])
    if len(data["liquidity"]["weeks"]) != 26:
        raise SystemExit("keine 26 Wochen")
    lauf = data["liquidity"]["start"]
    for w in data["liquidity"]["weeks"]:
        lauf += w["ein"] - w["aus"]
        close(lauf, w["bestand"])

    ist_leistung = data["forecast"][0]["angezeigt"]
    if ist_leistung == 0:
        raise SystemExit("Forecast-Ist Januar ist 0")
    print("GuV Umsatz Januar", round(summe["values"][0], 2))
    print("EBITDA Januar", round(m1["ebitda"], 2))
    print("EBITDA Jahr", round(sum(m["ebitda"] for m in data["months"]), 2))
    print("Forecast Januar", round(ist_leistung, 2))
    print("Aufträge", len(data["orders"]), "Summe Akte", round(sum(o["akte"] for o in data["orders"]), 2))
    print("26-Wochen-Endbestand", round(data["liquidity"]["weeks"][-1]["bestand"], 2))
    print("Buchungen im Jahr", sum(1 for _ in __import__("server.model", fromlist=["journal_rows"]).journal_rows()))
    print("ok")


if __name__ == "__main__":
    main()
