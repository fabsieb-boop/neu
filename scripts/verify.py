#!/usr/bin/env python3
"""Prüft die SQL-Rechnung gegen die Formeln der Mappe."""

from __future__ import annotations

import re
import sqlite3
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server.model import build  # noqa: E402
from scripts.import_excel import XLSX, formula, num, read_sheet, text, value  # noqa: E402

DB = ROOT / "data" / "tvf.sqlite"
CELL_REF = re.compile(r"([A-Z]+)(\d+)")


def close(a, b, tol=0.02):
    if abs(a - b) > tol:
        raise SystemExit(f"Abweichung {a} != {b}")


def excel_column(number: int) -> str:
    result = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        result = chr(65 + remainder) + result
    return result


def formula_rows(formula_text: str, expected_column: str) -> list[int]:
    body = formula_text.replace(" ", "")
    if body.upper().startswith("SUM(") and body.endswith(")") and ":" in body:
        start, end = body[4:-1].split(":")
        start_match, end_match = CELL_REF.fullmatch(start), CELL_REF.fullmatch(end)
        if not start_match or not end_match or start_match.group(1) != end_match.group(1):
            raise SystemExit(f"Unbekannte Excel-Summenformel: {formula_text}")
        references = [
            f"{start_match.group(1)}{row}"
            for row in range(int(start_match.group(2)), int(end_match.group(2)) + 1)
        ]
    else:
        references = body.split("+")

    rows = []
    for reference in references:
        match = CELL_REF.fullmatch(reference)
        if not match or match.group(1) != expected_column:
            raise SystemExit(f"Unbekannte Excel-GuV-Formel: {formula_text}")
        rows.append(int(match.group(2)))
    return rows


def main() -> None:
    con = sqlite3.connect(DB)
    tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    quellen = {
        "auftrag_liste", "buchung", "ebitda_plan", "forecast_plan", "guv_position", "guv_wert",
        "kontostand", "kosten_meldung", "kostenart", "legende", "liq_bestand", "liq_monat",
        "liq_parameter", "parameter", "projekt", "region_liste", "verlust",
    }
    system = {"benutzer", "bericht_vorlage", "ja_stand", "import_protokoll"}
    intern = {"sqlite_sequence"}
    if set(tables) != quellen | system | intern:
        raise SystemExit(f"Tabellen weichen ab: {tables}")

    with zipfile.ZipFile(XLSX) as archive:
        excel_guv = read_sheet(archive, "GuV_Positionen")
    database_positions = {
        row: (nr, position, stored_formula)
        for row, nr, position, stored_formula in con.execute(
            "SELECT zeile, nr, position, formel FROM guv_position ORDER BY zeile"
        )
    }
    database_leaves = {
        (row, month): amount
        for row, month, amount in con.execute("SELECT zeile, monat, wert FROM guv_wert")
    }
    source_leaves: dict[tuple[int, int], float] = {}
    expected_guv: dict[int, list[float]] = {}
    formula_cells = 0
    for row in range(5, 91):
        expected_values = []
        normalized_formulas = []
        for month, column in enumerate(range(3, 12), start=1):
            excel_formula = formula(excel_guv, row, column)
            if excel_formula:
                references = formula_rows(excel_formula, excel_column(column))
                normalized_formulas.append("+".join(str(reference) for reference in references))
                try:
                    expected = sum(expected_guv[reference][month - 1] for reference in references)
                except KeyError as error:
                    raise SystemExit(f"GuV-Formel verweist vorwärts: Zeile {row}") from error
                cached = value(excel_guv, row, column)
                if cached is not None:
                    close(expected, float(cached))
                formula_cells += 1
            else:
                raw = value(excel_guv, row, column)
                expected = float(raw) if raw is not None else 0.0
                if raw is not None:
                    source_leaves[(row, month)] = expected
            expected_values.append(expected)

        if normalized_formulas and len(normalized_formulas) != 9:
            raise SystemExit(f"GuV-Zeile mischt Formel und Blattwert: {row}")
        if normalized_formulas and len(set(normalized_formulas)) != 1:
            raise SystemExit(f"GuV-Monatsformeln unterscheiden sich: {row}")
        normalized_formula = normalized_formulas[0] if normalized_formulas else ""
        expected_position = (int(num(excel_guv, row, 1)), text(excel_guv, row, 2), normalized_formula)
        if database_positions.get(row) != expected_position:
            raise SystemExit(
                f"GuV-Position weicht von Excel ab: Zeile {row}: "
                f"{database_positions.get(row)} != {expected_position}"
            )
        expected_guv[row] = expected_values

    if set(database_leaves) != set(source_leaves):
        raise SystemExit(
            f"GuV-Blattwertschlüssel weichen ab: "
            f"Excel={len(source_leaves)} SQLite={len(database_leaves)}"
        )
    for key, expected in source_leaves.items():
        close(database_leaves[key], expected)

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
    model_guv = {row["zeile"]: row for row in data["guv"]}
    if set(model_guv) != set(expected_guv):
        raise SystemExit(f"GuV-Modellzeilen weichen von Excel ab: {sorted(model_guv)}")
    for row, expected_values in expected_guv.items():
        for month, expected in enumerate(expected_values):
            close(model_guv[row]["values"][month], expected)

    totals = {row["name"]: sum(row["values"]) for row in data["guv"]}
    waterfall_end = (
        totals["Summe Umsatzerlöse"]
        + totals["Rohertrag"] - totals["Summe Umsatzerlöse"]
        + totals["Andere sonstige betriebliche Ertraege"]
        + totals["Personalaufwand"]
        + totals["Sachkosten"]
        + totals["Neutrales Ergebnis"]
    )
    close(waterfall_end, totals["EBITDA"])

    summe = model_guv[8]
    ebitda = next(g for g in data["guv"] if g["name"] == "EBITDA")
    operativ = next(g for g in data["guv"] if g["name"] == "EBITDA (Operatives Ergebnis)")
    neutral = next(g for g in data["guv"] if g["name"] == "Neutrales Ergebnis")
    for i in range(9):
        close(ebitda["values"][i], operativ["values"][i] + neutral["values"][i])

    m1 = data["months"][0]
    close(m1["umsatz"], summe["values"][0])
    close(m1["ebitda"], ebitda["values"][0])
    close(data["months"][9]["umsatz"], 0)
    month_ten_plan = con.execute(
        "SELECT operativ + overhead FROM ebitda_plan WHERE jahr = ? AND monat = 10",
        (data["jahr"],),
    ).fetchone()[0]
    month_ten_open = con.execute(
        """
        SELECT COALESCE(SUM(betrag), 0) FROM verlust
        WHERE monat = 10 AND gebucht = 1 AND im_forecast = 1 AND nachrichtlich = 0
        """
    ).fetchone()[0]
    close(data["months"][9]["ebitda"], month_ten_plan + month_ten_open)

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
    print("GuV Excel-Identität", len(source_leaves), "Blattwerte", formula_cells, "Formelzellen")
    print("GuV Umsatz Januar", round(summe["values"][0], 2))
    print("EBITDA Januar", round(m1["ebitda"], 2))
    print("Wasserfall EBITDA", round(waterfall_end, 2))
    print("EBITDA Jahr", round(sum(m["ebitda"] for m in data["months"]), 2))
    print("Forecast Januar", round(ist_leistung, 2))
    print("Aufträge", len(data["orders"]), "Summe Akte", round(sum(o["akte"] for o in data["orders"]), 2))
    print("26-Wochen-Endbestand", round(data["liquidity"]["weeks"][-1]["bestand"], 2))
    print("Buchungen im Jahr", sum(1 for _ in __import__("server.model", fromlist=["journal_rows"]).journal_rows()))
    print("ok")


if __name__ == "__main__":
    main()
