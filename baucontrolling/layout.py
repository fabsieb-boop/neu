"""Gemeinsame Blatt-Hilfen: Tabellen, Validierung, Druck."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Iterable, Sequence

from openpyxl.formatting.rule import FormulaRule
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.workbook.workbook import Workbook
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.worksheet.worksheet import Worksheet

from baucontrolling.styles import (
    AMBER_SOFT,
    FILL_AMBER_SOFT,
    FILL_GREEN_SOFT,
    FILL_RED_SOFT,
    GREEN_SOFT,
    RED_SOFT,
    header_bar,
    paint_sheet,
    set_widths,
    style_calc,
    style_header_row,
    style_input,
    zebra,
)

MAX_ROWS = 400


def new_sheet(wb: Workbook, title: str, headline: str, sub: str, cols: int, widths: dict[int, float]) -> Worksheet:
    ws = wb.create_sheet(title)
    paint_sheet(ws, rows=6, cols=max(cols, 16))
    header_bar(ws, headline, sub, last_col=cols)
    set_widths(ws, widths)
    return ws


def write_headers(ws: Worksheet, headers: Sequence[str], row: int = 3) -> None:
    for i, name in enumerate(headers, start=1):
        ws.cell(row, i, name)
    style_header_row(ws, row, len(headers))


def write_row(ws: Worksheet, row: int, values: Sequence[Any], kinds: Sequence[str]) -> None:
    for col, (value, kind) in enumerate(zip(values, kinds), start=1):
        cell = ws.cell(row, col, value)
        if kind.startswith("calc"):
            style_calc(cell, kind.split(":", 1)[1] if ":" in kind else "eur")
        else:
            style_input(cell, kind)


def fill_blank_rows(ws: Worksheet, start: int, end: int, kinds: Sequence[str]) -> None:
    for r in range(start, end + 1):
        for c, kind in enumerate(kinds, start=1):
            cell = ws.cell(r, c)
            if kind.startswith("calc"):
                style_calc(cell, kind.split(":", 1)[1] if ":" in kind else "eur")
            else:
                style_input(cell, kind)


def add_table(ws: Worksheet, name: str, ref: str) -> None:
    table = Table(displayName=name, ref=ref)
    table.tableStyleInfo = TableStyleInfo(
        name="TableStyleMedium2",
        showFirstColumn=False,
        showLastColumn=False,
        showRowStripes=True,
        showColumnStripes=False,
    )
    ws.add_table(table)


def named(wb: Workbook, name: str, ref: str) -> None:
    existing = [n for n in wb.defined_names.values() if n.name == name]
    for item in existing:
        wb.defined_names.delete(item.name)
    wb.defined_names.add(DefinedName(name, attr_text=ref))


def dropdown(ws: Worksheet, ref: str, formula: str, allow_blank: bool = True) -> None:
    if not formula.startswith("=") and not formula.startswith('"'):
        formula = f"={formula}"
    dv = DataValidation(type="list", formula1=formula, allow_blank=allow_blank, showDropDown=False)
    dv.error = "Bitte einen Wert aus der Liste wählen."
    dv.errorTitle = "Ungültige Auswahl"
    dv.prompt = "Auswahl"
    dv.promptTitle = "Liste"
    ws.add_data_validation(dv)
    dv.add(ref)


def status_colors(ws: Worksheet, col: int, start: int, end: int) -> None:
    letter = get_column_letter(col)
    rng = f"{letter}{start}:{letter}{end}"
    ws.conditional_formatting.add(
        rng,
        FormulaRule(formula=[f'OR({letter}{start}="bezahlt",{letter}{start}="abgeschlossen",{letter}{start}="angenommen")'], fill=FILL_GREEN_SOFT),
    )
    ws.conditional_formatting.add(
        rng,
        FormulaRule(formula=[f'OR({letter}{start}="überfällig",{letter}{start}="gemahnt",{letter}{start}="stopp",{letter}{start}="verlust")'], fill=FILL_RED_SOFT),
    )
    ws.conditional_formatting.add(
        rng,
        FormulaRule(formula=[f'OR({letter}{start}="offen",{letter}{start}="in Bau",{letter}{start}="geplant",{letter}{start}="teilbezahlt")'], fill=FILL_AMBER_SOFT),
    )


def as_date(value: str | date) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return date.fromisoformat(str(value))


def col_index(headers: Sequence[str], name: str) -> int:
    return headers.index(name) + 1


def kind_map(headers: Sequence[str], overrides: dict[str, str], default: str = "text") -> list[str]:
    return [overrides.get(h, default) for h in headers]


def iter_sample(rows: Iterable[Sequence[Any]]) -> list[list[Any]]:
    return [list(r) for r in rows]
