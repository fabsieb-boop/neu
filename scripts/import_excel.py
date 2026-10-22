#!/usr/bin/env python3
"""Lädt die eingegebenen Blätter aus der Excel-Datei in SQLite."""

from __future__ import annotations

import json
import sqlite3
import time
import zipfile
from datetime import date, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "data" / "tvf-dashboard-download.xlsx"
DB = ROOT / "data" / "tvf.sqlite"
SCHEMA = ROOT / "sql" / "schema.sql"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
EXCEL_EPOCH = date(1899, 12, 30)

# workbook.xml sheet order
SHEETS = {
    "GuV_Positionen": "xl/worksheets/sheet4.xml",
    "Auftraege": "xl/worksheets/sheet8.xml",
    "Kostenverfolgung": "xl/worksheets/sheet10.xml",
    "Parameter": "xl/worksheets/sheet12.xml",
    "Legende": "xl/worksheets/sheet13.xml",
    "Auftrag_Journal": "xl/worksheets/sheet14.xml",
    "Projektstamm": "xl/worksheets/sheet15.xml",
    "Kostenarten": "xl/worksheets/sheet16.xml",
    "Forecast_Plan": "xl/worksheets/sheet17.xml",
    "EBITDA_Plan": "xl/worksheets/sheet18.xml",
    "Verlust": "xl/worksheets/sheet19.xml",
    "Liq_Monat": "xl/worksheets/sheet20.xml",
    "Liq_Parameter": "xl/worksheets/sheet21.xml",
    "Liq_Bestand": "xl/worksheets/sheet22.xml",
    "Kontostand": "xl/worksheets/sheet23.xml",
    "Regionen": "xl/worksheets/sheet7.xml",
    "Auftrag": "xl/worksheets/sheet9.xml",
}


def col_row(ref: str) -> tuple[int, int]:
    col = "".join(c for c in ref if c.isalpha())
    row = int("".join(c for c in ref if c.isdigit()) or 0)
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n, row


def cell_value(cell: ET.Element):
    kind = cell.attrib.get("t")
    if kind == "inlineStr":
        return "".join(cell.find("m:is", NS).itertext()) if cell.find("m:is", NS) is not None else ""
    node = cell.find("m:v", NS)
    if node is None or node.text is None:
        return None
    raw = node.text
    if kind == "b":
        return raw == "1"
    return float(raw) if any(c in raw for c in ".eE") else int(raw) if raw.lstrip("-").isdigit() else raw


def cell_formula(cell: ET.Element) -> str | None:
    node = cell.find("m:f", NS)
    return node.text if node is not None and node.text else None


def read_sheet(xlsx: zipfile.ZipFile, name: str) -> dict[int, dict[int, tuple[object, str | None]]]:
    root = ET.fromstring(xlsx.read(SHEETS[name]))
    rows: dict[int, dict[int, tuple[object, str | None]]] = {}
    for cell in root.findall(".//m:c", NS):
        ref = cell.attrib.get("r")
        if not ref:
            continue
        ci, ri = col_row(ref)
        rows.setdefault(ri, {})[ci] = (cell_value(cell), cell_formula(cell))
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


def main() -> None:
    if DB.exists():
        DB.unlink()
    con = sqlite3.connect(DB)
    con.executescript(SCHEMA.read_text())
    xlsx = zipfile.ZipFile(XLSX)

    parameter = read_sheet(xlsx, "Parameter")
    auftrag = read_sheet(xlsx, "Auftrag")
    con.execute(
        "INSERT INTO parameter (jahr, letzter_ist_monat, stichtag, auftragsnummer) VALUES (?,?,?,?)",
        (
            int(num(parameter, 1, 2)),
            int(num(parameter, 2, 2)),
            excel_date(int(num(parameter, 3, 2))),
            text(auftrag, 3, 2),
        ),
    )

    projekt = read_sheet(xlsx, "Projektstamm")
    for r in sorted(k for k in projekt if k > 1):
        if value(projekt, r, 1) is None:
            continue
        con.execute(
            "INSERT INTO projekt VALUES (?,?,?,?,?,?,?,?,?)",
            (
                int(num(projekt, r, 1)),
                text(projekt, r, 2),
                text(projekt, r, 3),
                text(projekt, r, 4),
                text(projekt, r, 5),
                text(projekt, r, 6),
                text(projekt, r, 7),
                num(projekt, r, 8),
                num(projekt, r, 9),
            ),
        )

    kosten = read_sheet(xlsx, "Kostenarten")
    for r in sorted(k for k in kosten if k > 1):
        if value(kosten, r, 1) is None:
            continue
        con.execute(
            "INSERT INTO kostenart VALUES (?,?,?,?,?,?,?)",
            (
                int(num(kosten, r, 1)),
                text(kosten, r, 2),
                text(kosten, r, 3),
                int(num(kosten, r, 4)),
                text(kosten, r, 5),
                int(num(kosten, r, 6)),
                text(kosten, r, 7),
            ),
        )

    journal = read_sheet(xlsx, "Auftrag_Journal")
    buchungen = []
    for r in sorted(k for k in journal if k > 1):
        if value(journal, r, 1) is None:
            continue
        projekt_id = value(journal, r, 8)
        kostenart_id = value(journal, r, 9)
        buchungen.append(
            (
                int(num(journal, r, 1)),
                excel_date(int(num(journal, r, 2))),
                int(num(journal, r, 3)),
                int(num(journal, r, 4)),
                text(journal, r, 5),
                text(journal, r, 6),
                text(journal, r, 7),
                int(projekt_id) if isinstance(projekt_id, (int, float)) and projekt_id != "" else None,
                int(kostenart_id) if isinstance(kostenart_id, (int, float)) and kostenart_id != "" else None,
                text(journal, r, 10),
                num(journal, r, 11),
                text(journal, r, 12),
            )
        )
    con.executemany("INSERT INTO buchung VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", buchungen)

    plan = read_sheet(xlsx, "Forecast_Plan")
    con.executemany(
        "INSERT INTO forecast_plan VALUES (?,?,?,?,?,?,?,?)",
        [
            (
                int(num(plan, r, 1)),
                text(plan, r, 2),
                text(plan, r, 3),
                text(plan, r, 4),
                text(plan, r, 5),
                text(plan, r, 6),
                int(num(plan, r, 7)),
                num(plan, r, 8),
            )
            for r in sorted(plan)
            if r > 1 and value(plan, r, 1) is not None
        ],
    )

    ebitda = read_sheet(xlsx, "EBITDA_Plan")
    con.executemany(
        "INSERT INTO ebitda_plan VALUES (?,?,?,?,?)",
        [
            (int(num(ebitda, r, 1)), int(num(ebitda, r, 2)), num(ebitda, r, 3), num(ebitda, r, 4), num(ebitda, r, 5))
            for r in sorted(ebitda)
            if r > 1 and value(ebitda, r, 1) is not None
        ],
    )

    verlust = read_sheet(xlsx, "Verlust")
    con.executemany(
        "INSERT INTO verlust VALUES (?,?,?,?,?,?,?,?,?)",
        [
            (
                int(num(verlust, r, 1)),
                int(num(verlust, r, 2)),
                text(verlust, r, 3),
                text(verlust, r, 4),
                num(verlust, r, 5),
                flag(value(verlust, r, 6)),
                flag(value(verlust, r, 7)),
                flag(value(verlust, r, 8)),
                text(verlust, r, 9),
            )
            for r in sorted(verlust)
            if r > 1 and value(verlust, r, 1) is not None
        ],
    )

    liq_p = read_sheet(xlsx, "Liq_Parameter")
    con.executemany(
        "INSERT INTO liq_parameter VALUES (?,?,?,?,?)",
        [
            (int(num(liq_p, r, 1)), text(liq_p, r, 2), num(liq_p, r, 3), text(liq_p, r, 4), text(liq_p, r, 5))
            for r in sorted(liq_p)
            if r > 1 and value(liq_p, r, 1) is not None
        ],
    )

    liq_m = read_sheet(xlsx, "Liq_Monat")
    con.executemany(
        "INSERT INTO liq_monat VALUES (?,?,?,?,?,?)",
        [
            (int(num(liq_m, r, 1)), int(num(liq_m, r, 2)), num(liq_m, r, 3), num(liq_m, r, 4), num(liq_m, r, 5), flag(value(liq_m, r, 6)))
            for r in sorted(liq_m)
            if r > 1 and value(liq_m, r, 1) is not None
        ],
    )

    bestand = read_sheet(xlsx, "Liq_Bestand")
    con.executemany(
        "INSERT INTO liq_bestand VALUES (?,?,?,?)",
        [
            (int(num(bestand, r, 1)), int(num(bestand, r, 2)), num(bestand, r, 3), text(bestand, r, 4))
            for r in sorted(bestand)
            if r > 1 and value(bestand, r, 1) is not None
        ],
    )

    konto = read_sheet(xlsx, "Kontostand")
    for r in sorted(k for k in konto if k > 1):
        if value(konto, r, 1) is None:
            continue
        con.execute(
            "INSERT INTO kontostand VALUES (?,?,?)",
            (excel_date(int(num(konto, r, 1))), text(konto, r, 2), num(konto, r, 3)),
        )

    guv = read_sheet(xlsx, "GuV_Positionen")
    # region agent log
    formula_cells = [
        (r, month, formula(guv, r, col), value(guv, r, col))
        for r in range(5, 91)
        for month, col in enumerate(range(3, 12), start=1)
        if formula(guv, r, col)
    ]
    with open("/opt/cursor/logs/debug.log", "a", encoding="utf-8") as debug:
        debug.write(json.dumps({
            "hypothesisId": "D",
            "location": "scripts/import_excel.py:GuV-source",
            "message": "Excel GuV formula/cache inventory",
            "data": {
                "formulaCells": len(formula_cells),
                "formulaCellsWithCachedValue": sum(cached is not None for _, _, _, cached in formula_cells),
                "keyRows": [
                    {
                        "row": r,
                        "name": text(guv, r, 2),
                        "formulas": [formula(guv, r, c) for c in range(3, 12)],
                        "cachedValues": [value(guv, r, c) for c in range(3, 12)],
                    }
                    for r in (28, 61, 73, 74, 77, 89, 90)
                ],
            },
            "timestamp": int(time.time() * 1000),
        }, ensure_ascii=False) + "\n")
    # endregion
    for r in range(5, 91):
        f = formula(guv, r, 3)
        con.execute(
            "INSERT INTO guv_position VALUES (?,?,?,?)",
            (r, int(num(guv, r, 1)), text(guv, r, 2), sum_rows(f) if f else ""),
        )
        if f:
            # Dieselbe Struktur muss in jeder Monatsspalte stehen.
            for month, col in enumerate(range(3, 12), start=1):
                other = formula(guv, r, col)
                if other is None or sum_rows(other) != sum_rows(f):
                    raise SystemExit(f"GuV-Formel weicht ab: Zeile {r} Monat {month}: {other}")
            continue
        for month, col in enumerate(range(3, 12), start=1):
            if formula(guv, r, col):
                raise SystemExit(f"Blattwert erwartet, Formel gefunden: Zeile {r} Monat {month}")
            if value(guv, r, col) is None:
                continue
            con.execute("INSERT INTO guv_wert VALUES (?,?,?)", (r, month, num(guv, r, col)))

    # region agent log
    source_leaf = {
        (r, month): num(guv, r, col)
        for r in range(5, 91)
        for month, col in enumerate(range(3, 12), start=1)
        if not formula(guv, r, col) and value(guv, r, col) is not None
    }
    db_leaf = {(r, month): wert for r, month, wert in con.execute("SELECT zeile, monat, wert FROM guv_wert")}
    formula_structure_mismatches = [
        r for r, stored in con.execute("SELECT zeile, formel FROM guv_position WHERE formel <> ''")
        if stored != sum_rows(formula(guv, r, 3) or "")
    ]
    duplicate_formula_refs = [
        r for r, stored in con.execute("SELECT zeile, formel FROM guv_position WHERE formel <> ''")
        if len(stored.split("+")) != len(set(stored.split("+")))
    ]
    with open("/opt/cursor/logs/debug.log", "a", encoding="utf-8") as debug:
        debug.write(json.dumps({
            "hypothesisId": "C",
            "location": "scripts/import_excel.py:GuV-database",
            "message": "Excel leaf values and formula structure after SQLite import",
            "data": {
                "sourceLeafCells": len(source_leaf),
                "databaseLeafCells": len(db_leaf),
                "leafMismatches": [
                    {"row": key[0], "month": key[1], "excel": expected, "sqlite": db_leaf.get(key)}
                    for key, expected in source_leaf.items()
                    if db_leaf.get(key) != expected
                ][:20],
                "unexpectedDatabaseLeaves": len(set(db_leaf) - set(source_leaf)),
                "formulaStructureMismatches": formula_structure_mismatches,
                "duplicateFormulaReferences": duplicate_formula_refs,
            },
            "timestamp": int(time.time() * 1000),
        }, ensure_ascii=False) + "\n")
    # endregion

    kosten_v = read_sheet(xlsx, "Kostenverfolgung")
    for r in sorted(k for k in kosten_v if k >= 5):
        if value(kosten_v, r, 2) is None:
            continue
        con.execute(
            "INSERT INTO kosten_meldung VALUES (?,?,?,?,?,?,?,?,?)",
            (
                r,
                text(kosten_v, r, 1),
                text(kosten_v, r, 2),
                text(kosten_v, r, 3),
                text(kosten_v, r, 4),
                num(kosten_v, r, 5),
                num(kosten_v, r, 6),
                num(kosten_v, r, 7),
                num(kosten_v, r, 12),
            ),
        )

    auftraege = read_sheet(xlsx, "Auftraege")
    for r in range(5, 101):
        nr = text(auftraege, r, 1)
        if nr:
            con.execute("INSERT INTO auftrag_liste VALUES (?,?)", (r, nr))

    regionen = read_sheet(xlsx, "Regionen")
    for r in range(5, 9):
        con.execute("INSERT INTO region_liste VALUES (?,?)", (r, text(regionen, r, 1)))

    legende = read_sheet(xlsx, "Legende")
    for r in sorted(k for k in legende if k >= 4):
        punkt = text(legende, r, 1)
        if not punkt:
            continue
        con.execute("INSERT INTO legende VALUES (?,?,?)", (r, punkt, text(legende, r, 2)))

    con.commit()
    counts = {
        name: con.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
        for name in (
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
    }
    print(DB)
    for name, count in counts.items():
        print(f"{name}: {count}")


if __name__ == "__main__":
    main()
