#!/usr/bin/env python3
"""Hängt CSV-Daten an die Baucontrolling-Mappe an.

Beispiele:
  python scripts/import_csv.py --workbook Baucontrolling_Kaufmann.xlsx --typ bank --datei templates/bankumsatz.csv
  python scripts/import_csv.py --workbook Baucontrolling_Kaufmann.xlsx --typ ar --datei templates/ausgangsrechnungen.csv
"""

from __future__ import annotations

import argparse
import csv
import re
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook

SHEETS = {
    "kunden": ("02_Kunden", 14, 1),
    "lieferanten": ("03_Lieferanten", 11, 1),
    "personal": ("04_Personal", 10, 1),
    "projekte": ("05_Projekte", 20, 1),
    "stunden": ("10_Stunden", 8, 1),
    "material": ("11_Material", 11, 1),
    "ar": ("13_Ausgangsrechnungen", 13, 1),
    "er": ("14_Eingangsrechnungen", 11, 1),
    "zahlungen": ("15_Zahlungen", 8, 1),
}

PREFIX = {
    "kunden": "K-",
    "lieferanten": "L-",
    "personal": "MA-",
    "projekte": "P-",
    "stunden": "ST-",
    "material": "MAT-",
    "ar": "AR-",
    "er": "ER-",
    "zahlungen": "Z-",
    "bank": "Z-",
    "datev": "Z-",
}

BELEG_RE = re.compile(r"\b((?:AR|ER)-\d+)\b", re.I)


def parse_date(value: str):
    value = (value or "").strip()
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d.%m.%y", "%Y/%m/%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return value


def parse_number(value: str):
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return value
    text = str(value).strip().replace("€", "").replace(" ", "")
    if text.count(",") == 1 and text.count(".") >= 1:
        text = text.replace(".", "").replace(",", ".")
    elif text.count(",") == 1 and text.count(".") == 0:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return value


def first_empty(ws, col: int = 1, start: int = 4) -> int:
    row = start
    while ws.cell(row, col).value not in (None, ""):
        row += 1
        if row > 20000:
            raise RuntimeError("Keine freie Zeile gefunden.")
    return row


def next_number(ws, prefix: str, col: int = 1) -> str:
    highest = 0
    for row in ws.iter_rows(min_col=col, max_col=col, min_row=4, max_row=5000, values_only=True):
        value = row[0]
        if not value:
            continue
        digits = re.sub(r"\D", "", str(value))
        if digits.isdigit():
            highest = max(highest, int(digits))
    width = 3 if highest < 1000 else 4
    return f"{prefix}{highest + 1:0{width}d}"


def read_csv(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        sample = fh.read(4096)
        fh.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=";,\t")
        reader = csv.DictReader(fh, dialect=dialect)
        return [dict(row) for row in reader]


def write_values(ws, row: int, values: list, max_cols: int) -> None:
    for col, value in enumerate(values[:max_cols], start=1):
        if value in ("", None):
            continue
        current = ws.cell(row, col)
        # Formelzellen nicht überschreiben, wenn der Import kürzer ist als die Tabelle
        if isinstance(current.value, str) and current.value.startswith("="):
            continue
        ws.cell(row, col, value)


def import_standard(ws, typ: str, rows: list[dict], max_cols: int) -> int:
    count = 0
    for raw in rows:
        values = list(raw.values())
        if not any(str(v).strip() for v in values if v is not None):
            continue
        target = first_empty(ws)
        if not values or not str(values[0]).strip():
            values = [next_number(ws, PREFIX[typ])] + values[1:]
        parsed = []
        for value in values:
            if isinstance(value, str) and (re.match(r"\d{4}-\d{2}-\d{2}", value) or re.match(r"\d{2}\.\d{2}\.\d{4}", value)):
                parsed.append(parse_date(value))
            else:
                parsed.append(parse_number(value) if _looks_number(value) else value)
        write_values(ws, target, parsed, max_cols)
        count += 1
    return count


def _looks_number(value) -> bool:
    if value is None:
        return False
    text = str(value).strip().replace("€", "").replace(" ", "").replace(".", "").replace(",", "").replace("-", "")
    return text.isdigit()


def import_bank(ws, rows: list[dict]) -> int:
    count = 0
    for raw in rows:
        amount = parse_number(raw.get("Betrag") or raw.get("Umsatz") or raw.get("amount") or 0) or 0
        if amount == 0:
            continue
        art = "Eingang" if float(amount) > 0 else "Ausgang"
        purpose = raw.get("Verwendungszweck") or raw.get("Buchungstext") or raw.get("Text") or ""
        match = BELEG_RE.search(str(purpose))
        beleg = match.group(1).upper() if match else ""
        partner = raw.get("Partner") or raw.get("Auftraggeber") or raw.get("Empfänger") or ""
        datum = parse_date(raw.get("Buchungstag") or raw.get("Valuta") or raw.get("Datum") or "")
        target = first_empty(ws)
        write_values(
            ws,
            target,
            [next_number(ws, "Z-"), datum, art, beleg, partner, abs(float(amount)), raw.get("Bank") or "Bank", purpose],
            8,
        )
        count += 1
    return count


def import_datev(ws, rows: list[dict]) -> int:
    mapped = []
    for raw in rows:
        amount = parse_number(raw.get("Umsatz") or raw.get("Betrag") or 0) or 0
        sh = (raw.get("SollHaben") or raw.get("Soll/Haben-KZ") or "").strip().upper()
        konto = str(raw.get("Konto") or "")
        text = raw.get("Buchungstext") or raw.get("Text") or ""
        beleg = raw.get("Belegfeld1") or raw.get("Beleg") or ""
        datum = raw.get("Belegdatum") or raw.get("Datum") or ""
        signed = -abs(float(amount)) if sh == "S" else abs(float(amount))
        if konto.startswith("8") or "AR-" in str(beleg).upper():
            signed = abs(float(amount))
        mapped.append(
            {
                "Buchungstag": datum,
                "Betrag": signed,
                "Partner": konto,
                "Verwendungszweck": f"{beleg} {text}".strip(),
                "Bank": "DATEV",
            }
        )
    return import_bank(ws, mapped)


def main() -> int:
    parser = argparse.ArgumentParser(description="CSV in die Baucontrolling-Mappe importieren")
    parser.add_argument("--workbook", required=True, type=Path)
    parser.add_argument("--typ", required=True, choices=list(SHEETS) + ["bank", "datev"])
    parser.add_argument("--datei", required=True, type=Path)
    args = parser.parse_args()

    if not args.workbook.exists():
        raise SystemExit(f"Workbook fehlt: {args.workbook}")
    if not args.datei.exists():
        raise SystemExit(f"CSV fehlt: {args.datei}")

    rows = read_csv(args.datei)
    wb = load_workbook(args.workbook)
    if args.typ in ("bank", "datev"):
        ws = wb["15_Zahlungen"]
        n = import_bank(ws, rows) if args.typ == "bank" else import_datev(ws, rows)
    else:
        sheet, max_cols, _ = SHEETS[args.typ]
        ws = wb[sheet]
        n = import_standard(ws, args.typ, rows, max_cols)
    wb.save(args.workbook)
    print(f"{n} Zeilen nach {ws.title} importiert.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
