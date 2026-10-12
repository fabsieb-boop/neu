#!/usr/bin/env python3
"""Split TVF Controlling Cockpit into one workbook per sheet with external links."""

from __future__ import annotations

import json
import re
import shutil
from copy import copy
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.utils import get_column_letter, range_boundaries
from openpyxl.worksheet.table import Table, TableColumn, TableStyleInfo

SOURCE = Path(
    "/home/ubuntu/.cursor/projects/workspace/uploads/TVF_Controlling_Cockpit_Import1_db4a.xlsx"
)
OUT_DIR = Path(
    "/cursor/stores/bc-d9b5c533-1abd-48a4-a0b7-3919e592c358/docs/workbook-split/dateien"
)
MANIFEST = Path(
    "/cursor/stores/bc-d9b5c533-1abd-48a4-a0b7-3919e592c358/docs/workbook-split/manifest.json"
)

# SharePoint-safe filenames (no \ / : * ? " < > | # % { } ~)
SAFE_RE = re.compile(r'[\\/:*?"<>|#%{}~]+')

SHEET_REF_RE = re.compile(
    r"(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_ ]*))!"
)
TABLE_COL_RE = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\[([^\]]+)\]")
HYPERLINK_INTERNAL_RE = re.compile(
    r'HYPERLINK\("#\\?\'([^\']+)\\?\'!([^"]+)","([^"]*)"\)'
)


def safe_filename(sheet_name: str) -> str:
    name = SAFE_RE.sub("-", sheet_name).strip().rstrip(".")
    name = re.sub(r"\s+", " ", name)
    return f"{name}.xlsx"


def col_letter_range(start_col: int, end_col: int) -> list[str]:
    return [get_column_letter(c) for c in range(start_col, end_col + 1)]


def build_table_index(wb) -> dict:
    """table_name -> {sheet, ref, columns: {name: col_letter}, data_ref}"""
    index = {}
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        for tname in list(ws.tables):
            table = ws.tables[tname]
            min_col, min_row, max_col, max_row = range_boundaries(table.ref)
            columns = {}
            for i, col in enumerate(table.tableColumns):
                columns[col.name] = get_column_letter(min_col + i)
            data_start = min_row + (table.headerRowCount or 1)
            index[tname] = {
                "sheet": sheet_name,
                "file": safe_filename(sheet_name),
                "ref": table.ref,
                "columns": columns,
                "min_col": min_col,
                "min_row": min_row,
                "max_col": max_col,
                "max_row": max_row,
                "data_start": data_start,
                "data_end": max_row,
            }
    return index


def external_sheet_prefix(sheet_name: str, current_sheet: str) -> str | None:
    if sheet_name == current_sheet:
        return None
    fname = safe_filename(sheet_name)
    # Always quote sheet part for Excel external refs
    return f"'[{fname}]{sheet_name}'!"


def rewrite_quoted_and_bare(formula: str, current_sheet: str, known_sheets: set[str]) -> str:
    """Rewrite sheet refs, but leave text inside double-quoted strings untouched."""
    result: list[str] = []
    i = 0
    n = len(formula)
    bare_sheets = sorted(
        (s for s in known_sheets if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", s)),
        key=len,
        reverse=True,
    )
    in_dq = False
    while i < n:
        ch = formula[i]
        if ch == '"':
            # Excel strings use "" for escaped quotes
            if in_dq and i + 1 < n and formula[i + 1] == '"':
                result.append('""')
                i += 2
                continue
            in_dq = not in_dq
            result.append(ch)
            i += 1
            continue
        if in_dq:
            result.append(ch)
            i += 1
            continue
        if ch == "'":
            j = formula.find("'", i + 1)
            if j != -1 and j + 1 < n and formula[j + 1] == "!":
                sheet = formula[i + 1 : j]
                if sheet in known_sheets and sheet != current_sheet:
                    result.append(external_sheet_prefix(sheet, current_sheet) or "")
                else:
                    result.append(formula[i : j + 2])
                i = j + 2
                continue
        matched = False
        prev_ok = i == 0 or not (formula[i - 1].isalnum() or formula[i - 1] in "_'")
        if prev_ok:
            for sheet in bare_sheets:
                if sheet == current_sheet:
                    continue
                if formula.startswith(sheet + "!", i):
                    result.append(external_sheet_prefix(sheet, current_sheet) or "")
                    i += len(sheet) + 1
                    matched = True
                    break
        if matched:
            continue
        result.append(ch)
        i += 1
    return "".join(result)


def rewrite_table_refs(
    formula: str, current_sheet: str, table_index: dict
) -> str:
    def repl(m: re.Match) -> str:
        tname, colspec = m.group(1), m.group(2)
        info = table_index.get(tname)
        if not info:
            return m.group(0)
        # Only simple [Column] for now
        col = colspec.strip()
        if col.startswith("[") or "#" in col:
            # complex structured ref – leave; rare in this workbook
            return m.group(0)
        letter = info["columns"].get(col)
        if not letter:
            return m.group(0)
        data_range = f"${letter}${info['data_start']}:${letter}${info['data_end']}"
        if info["sheet"] == current_sheet:
            # Same workbook after split: keep plain range (table still exists locally)
            return m.group(0)
        prefix = external_sheet_prefix(info["sheet"], current_sheet)
        return f"{prefix}{data_range}"

    return TABLE_COL_RE.sub(repl, formula)


def rewrite_hyperlinks(formula: str, known_sheets: set[str]) -> str:
    def repl(m: re.Match) -> str:
        sheet, cell, label = m.group(1), m.group(2), m.group(3)
        if sheet not in known_sheets:
            return m.group(0)
        fname = safe_filename(sheet)
        # Relative workbook link – works when all files sit in the same SharePoint folder
        return f'HYPERLINK("[{fname}]{sheet}!{cell}","{label}")'

    return HYPERLINK_INTERNAL_RE.sub(repl, formula)


def rewrite_formula(
    formula: str,
    current_sheet: str,
    known_sheets: set[str],
    table_index: dict,
) -> str:
    if not isinstance(formula, str) or not formula.startswith("="):
        return formula
    out = formula
    # Hyperlinks first (still original internal #Sheet! form), then table/sheet refs
    # without touching double-quoted URL/label strings.
    out = rewrite_hyperlinks(out, known_sheets)
    out = rewrite_table_refs(out, current_sheet, table_index)
    out = rewrite_quoted_and_bare(out, current_sheet, known_sheets)
    return out


def copy_sheet_to_workbook(source_ws, target_ws, current_sheet, known_sheets, table_index):
    # dimensions
    for col, dim in source_ws.column_dimensions.items():
        target_ws.column_dimensions[col].width = dim.width
        target_ws.column_dimensions[col].hidden = dim.hidden
    for row, dim in source_ws.row_dimensions.items():
        target_ws.row_dimensions[row].height = dim.height
        target_ws.row_dimensions[row].hidden = dim.hidden

    max_row = source_ws.max_row or 1
    max_col = source_ws.max_column or 1
    for r in range(1, max_row + 1):
        for c in range(1, max_col + 1):
            src = source_ws.cell(r, c)
            dst = target_ws.cell(r, c)
            val = src.value
            if isinstance(val, str) and val.startswith("="):
                dst.value = rewrite_formula(val, current_sheet, known_sheets, table_index)
            else:
                dst.value = val
            if src.has_style:
                dst.font = copy(src.font)
                dst.border = copy(src.border)
                dst.fill = copy(src.fill)
                dst.number_format = src.number_format
                dst.protection = copy(src.protection)
                dst.alignment = copy(src.alignment)

    for merged in source_ws.merged_cells.ranges:
        target_ws.merge_cells(str(merged))

    # tables
    for tname in list(source_ws.tables):
        table = source_ws.tables[tname]
        style = None
        if table.tableStyleInfo is not None:
            style = TableStyleInfo(
                name=table.tableStyleInfo.name,
                showFirstColumn=table.tableStyleInfo.showFirstColumn,
                showLastColumn=table.tableStyleInfo.showLastColumn,
                showRowStripes=table.tableStyleInfo.showRowStripes,
                showColumnStripes=table.tableStyleInfo.showColumnStripes,
            )
        new_table = Table(displayName=table.displayName, ref=table.ref)
        new_table.tableStyleInfo = style
        # copy column names
        if table.tableColumns:
            new_table.tableColumns = [
                TableColumn(id=i + 1, name=col.name)
                for i, col in enumerate(table.tableColumns)
            ]
        try:
            target_ws.add_table(new_table)
        except Exception as exc:  # noqa: BLE001
            print(f"  warn table {tname}: {exc}")

    target_ws.sheet_view.showGridLines = source_ws.sheet_view.showGridLines
    if source_ws.freeze_panes:
        target_ws.freeze_panes = source_ws.freeze_panes


def add_link_legend(ws, sheet_name: str, known_sheets: set[str], deps: set[str]):
    """Append a small legend of linked workbooks at the bottom."""
    start = (ws.max_row or 1) + 3
    ws.cell(start, 3, "SharePoint-Verknüpfungen (Dateien im selben Ordner)")
    ws.cell(start + 1, 3, "Diese Datei")
    ws.cell(start + 1, 4, safe_filename(sheet_name))
    row = start + 2
    for dep in sorted(deps):
        ws.cell(row, 3, "Liest aus")
        ws.cell(row, 4, safe_filename(dep))
        ws.cell(row, 5, dep)
        row += 1


def collect_deps(ws, sheet_name: str, known_sheets: set[str], table_index: dict) -> set[str]:
    deps: set[str] = set()
    max_row = min(ws.max_row or 1, 500)
    max_col = min(ws.max_column or 1, 40)
    for r in range(1, max_row + 1):
        for c in range(1, max_col + 1):
            val = ws.cell(r, c).value
            if not isinstance(val, str) or not val.startswith("="):
                continue
            for m in re.finditer(r"'([^']+)'!", val):
                s = m.group(1)
                if s in known_sheets and s != sheet_name:
                    deps.add(s)
            for s in known_sheets:
                if s == sheet_name:
                    continue
                if re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", s) and re.search(
                    rf"(?<![A-Za-z0-9_']){re.escape(s)}!", val
                ):
                    deps.add(s)
            for m in TABLE_COL_RE.finditer(val):
                info = table_index.get(m.group(1))
                if info and info["sheet"] != sheet_name:
                    deps.add(info["sheet"])
    return deps


def main() -> None:
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)

    print("Loading source…")
    wb = load_workbook(SOURCE, data_only=False)
    known = set(wb.sheetnames)
    table_index = build_table_index(wb)
    print(f"Sheets: {len(known)}, Tables: {len(table_index)}")

    manifest = {
        "quelle": str(SOURCE.name),
        "ordner_sharepoint": "TVF-Controlling-Cockpit",
        "dateien": [],
        "tabellen": {
            k: {"blatt": v["sheet"], "datei": v["file"], "bereich": v["ref"]}
            for k, v in table_index.items()
        },
    }

    dep_graph = {}
    for sheet_name in wb.sheetnames:
        deps = collect_deps(wb[sheet_name], sheet_name, known, table_index)
        dep_graph[sheet_name] = sorted(deps)

    for sheet_name in wb.sheetnames:
        fname = safe_filename(sheet_name)
        out_path = OUT_DIR / fname
        print(f"Writing {fname} …")
        new_wb = Workbook()
        default = new_wb.active
        new_wb.remove(default)
        target = new_wb.create_sheet(title=sheet_name)
        copy_sheet_to_workbook(
            wb[sheet_name], target, sheet_name, known, table_index
        )
        deps = set(dep_graph[sheet_name])
        add_link_legend(target, sheet_name, known, deps)
        # Cockpit: ensure title row notes SharePoint hub role
        if sheet_name == "Cockpit":
            note_row = (target.max_row or 1) + 2
            target.cell(
                note_row,
                3,
                "Startseite: Diese Datei als Hub in SharePoint öffnen. Kennzahlen und Hyperlinks zeigen auf die Einzeldateien im selben Ordner.",
            )
        new_wb.save(out_path)
        manifest["dateien"].append(
            {
                "blatt": sheet_name,
                "datei": fname,
                "abhaengigkeiten": dep_graph[sheet_name],
                "bytes": out_path.stat().st_size,
            }
        )

    manifest["abhaengigkeitsgraph"] = dep_graph
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Done. {len(manifest['dateien'])} files → {OUT_DIR}")
    print(f"Manifest → {MANIFEST}")


if __name__ == "__main__":
    main()
