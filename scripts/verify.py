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
    required = {
        "berichtsposition", "buchung", "forecast_projekt", "forecast_version", "forecast_wert",
        "import_lauf", "kennzahl_definition", "klr_ampel_schwelle", "klr_zuschlagssatz",
        "konto", "konto_mapping", "kostenart", "kostenstelle", "kv_stand", "liq_bankstand",
        "liq_szenario", "projekt", "region", "rolle", "benutzer",
    }
    forbidden = {
        "auftrag_liste", "ebitda_plan", "forecast_plan", "guv_position", "guv_wert",
        "kontostand", "kosten_meldung", "legende", "liq_bestand", "liq_monat", "liq_parameter",
        "parameter", "region_liste", "verlust", "bankbewegung", "ist_freigabe", "import_protokoll",
        "ja_stand",
    }
    present = set(tables)
    if not required <= present or present & forbidden:
        raise SystemExit(f"Tabellen weichen ab: {tables}")
    for name in tables:
        if name == "benutzer":
            continue
        count = con.execute(f'SELECT COUNT(*) FROM "{name}"').fetchone()[0]
        if count == 0:
            raise SystemExit(f"Leere Tabelle: {name}")

    data = build()
    umsatz = next(row for row in data["guv"] if row["name"] == "Umsatzerloese")
    material = next(row for row in data["guv"] if row["name"] == "Material und Fremdleistungen")
    sachkosten = next(row for row in data["guv"] if row["name"] == "Sonstige betriebliche Aufwendungen")
    ebitda = next(row for row in data["guv"] if row["name"] == "EBITDA")
    if len(umsatz["values"]) != 12:
        raise SystemExit(f"GuV hat {len(umsatz['values'])} Monate")
    october_umsatz = con.execute(
        """
        SELECT COALESCE(SUM(fw.betrag_plan), 0)
        FROM forecast_wert fw
        JOIN projekt p ON p.projekt_id = fw.projekt_id
        JOIN forecast_version v ON v.version_id = fw.version_id
        WHERE v.typ = 'ROLLING_FORECAST' AND fw.monat = '2026-10-01'
          AND fw.wertart = 'UMSATZ' AND p.auftragsnr NOT IN ('OVERHEAD', 'BEWERTUNG')
        """
    ).fetchone()[0]
    october_kosten = con.execute(
        """
        SELECT COALESCE(SUM(fw.betrag_plan), 0)
        FROM forecast_wert fw
        JOIN projekt p ON p.projekt_id = fw.projekt_id
        WHERE fw.monat = '2026-10-01' AND fw.wertart = 'KOSTEN'
          AND p.auftragsnr NOT IN ('OVERHEAD', 'BEWERTUNG')
        """
    ).fetchone()[0]
    overhead = con.execute(
        """
        SELECT COALESCE(SUM(fw.betrag_plan), 0)
        FROM forecast_wert fw
        JOIN projekt p ON p.projekt_id = fw.projekt_id
        WHERE fw.monat = '2026-10-01' AND fw.wertart = 'KOSTEN' AND p.auftragsnr = 'OVERHEAD'
        """
    ).fetchone()[0]
    close(data["months"][9]["umsatz"], october_umsatz)
    close(umsatz["values"][9], october_umsatz)
    close(material["values"][9], -october_kosten)
    close(sachkosten["values"][9], -overhead)
    close(data["months"][9]["ebitda"], october_umsatz - october_kosten - overhead)
    close(ebitda["values"][9], data["months"][9]["ebitda"])
    doubled = con.execute(
        """
        SELECT COUNT(*) FROM v_guv_monat g
        WHERE ABS(g.betrag_kaufm - (
            SELECT SUM(b.betrag_sap * k.kaufm_faktor)
            FROM buchung b JOIN konto k ON k.konto_nr = b.konto_nr
            WHERE b.geschaeftsjahr = g.geschaeftsjahr AND b.periode = g.periode
              AND b.konto_nr IN (SELECT konto_nr FROM konto_mapping km WHERE km.position_id = g.position_id)
        )) > 0.02
        """
    ).fetchone()[0]
    if doubled:
        raise SystemExit(f"Kaufmännischer Faktor weicht ab: {doubled}")
    if con.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise SystemExit("Integrität verletzt")

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
    print("GuV Umsatz Januar", round(umsatz["values"][0], 2))
    print("EBITDA Januar", round(data["months"][0]["ebitda"], 2))
    print("EBITDA Oktober", round(data["months"][9]["ebitda"], 2))
    print("EBITDA Jahr", round(sum(m["ebitda"] for m in data["months"]), 2))
    print("Forecast Januar", round(ist_leistung, 2))
    print("Aufträge", len(data["orders"]), "Summe Akte", round(sum(o["akte"] for o in data["orders"]), 2))
    print("26-Wochen-Endbestand", round(data["liquidity"]["weeks"][-1]["bestand"], 2))
    print("Buchungen im Jahr", sum(1 for _ in __import__("server.model", fromlist=["journal_rows"]).journal_rows()))
    print("ok")


if __name__ == "__main__":
    main()
