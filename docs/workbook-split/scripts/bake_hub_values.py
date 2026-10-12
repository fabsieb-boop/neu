#!/usr/bin/env python3
"""Bake calculated KPI values into the SharePoint Hub.

SharePoint File Viewer does not recalculate Excel formulas. openpyxl-written
hubs also ship without formula caches, so KPI cells appear blank until Excel
desktop calculates once. This script copies last-known values from the
original Import workbook into the hub (literals), so published pages show numbers.
"""

from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Font

ROOT = Path(__file__).resolve().parents[1]
STORE_DOCS = Path(
    "/cursor/stores/bc-d9b5c533-1abd-48a4-a0b7-3919e592c358/docs"
)

# Prefer Import workbook with Excel formula caches
IMPORT_CANDIDATES = [
    STORE_DOCS / "TVF_Controlling_Cockpit_Import.xlsx",
    ROOT.parent / "TVF_Controlling_Cockpit_Import.xlsx",
    Path("/cursor/stores/bc-d9b5c533-1abd-48a4-a0b7-3919e592c358/docs/TVF_Controlling_Cockpit_Import.xlsx"),
]

HUB_PATHS = [
    ROOT / "Cockpit-Hub-SharePoint.xlsx",
    ROOT / "Cockpit.xlsx",
    ROOT / "dateien" / "Cockpit.xlsx",
    ROOT.parent / "Cockpit-Hub-SharePoint.xlsx",
    ROOT.parent / "Cockpit.xlsx",
    STORE_DOCS / "workbook-split" / "Cockpit-Hub-SharePoint.xlsx",
    STORE_DOCS / "workbook-split" / "Cockpit.xlsx",
    STORE_DOCS / "Cockpit-Hub-SharePoint.xlsx",
    STORE_DOCS / "Cockpit.xlsx",
]

BAKE_SHEETS = ("Cockpit", "Steuerung", "GuV", "Forecast", "Monatsroll")
KEEP_FORMULA_MARKERS = ("HYPERLINK",)


def _is_hyperlink_formula(value: object) -> bool:
    if not isinstance(value, str) or not value.startswith("="):
        return False
    upper = value.upper()
    return any(m in upper for m in KEEP_FORMULA_MARKERS)


def _find_import() -> Path:
    for p in IMPORT_CANDIDATES:
        if p.exists():
            return p
    raise FileNotFoundError("TVF_Controlling_Cockpit_Import.xlsx nicht gefunden")


def bake(hub_path: Path, import_path: Path) -> dict:
    wb_hub = load_workbook(hub_path, data_only=False)
    wb_val = load_workbook(import_path, data_only=True)
    wb_src = load_workbook(import_path, data_only=False)

    stats = {s: {"baked": 0, "kept_formula": 0, "skipped": 0} for s in BAKE_SHEETS}

    # Align Berichtsmonat with Import (published / freigegeben)
    if "Steuerung" in wb_hub.sheetnames and "Steuerung" in wb_val.sheetnames:
        month = wb_val["Steuerung"]["F7"].value
        year = wb_val["Steuerung"]["F6"].value
        if month is not None:
            wb_hub["Steuerung"]["F7"] = month
        if year is not None:
            wb_hub["Steuerung"]["F6"] = year

    for sheet_name in BAKE_SHEETS:
        if sheet_name not in wb_hub.sheetnames:
            continue
        if sheet_name not in wb_val.sheetnames:
            continue
        ws_h = wb_hub[sheet_name]
        ws_v = wb_val[sheet_name]
        ws_s = wb_src[sheet_name]

        max_row = max(ws_h.max_row or 1, ws_s.max_row or 1)
        max_col = max(ws_h.max_column or 1, ws_s.max_column or 1)

        for row in ws_h.iter_rows(min_row=1, max_row=max_row, max_col=max_col):
            for cell in row:
                src_val = ws_s[cell.coordinate].value
                hub_val = cell.value
                formula = None
                if isinstance(hub_val, str) and hub_val.startswith("="):
                    formula = hub_val
                elif isinstance(src_val, str) and src_val.startswith("="):
                    formula = src_val
                if formula is None:
                    continue
                if _is_hyperlink_formula(formula):
                    stats[sheet_name]["kept_formula"] += 1
                    continue
                cached = ws_v[cell.coordinate].value
                if cached is None:
                    # Empty cache → blank display value (still better than invisible formula)
                    cell.value = ""
                    stats[sheet_name]["skipped"] += 1
                    continue
                cell.value = cached
                stats[sheet_name]["baked"] += 1

    # Footer note on Cockpit
    if "Cockpit" in wb_hub.sheetnames:
        ws = wb_hub["Cockpit"]
        ws["C65"] = (
            "SharePoint-Hub mit fest geschriebenen Kennzahlen (Stand Import/Excel-Cache). "
            "Datei-Viewer rechnet Formeln nicht neu – Werte sind für die Anzeige eingebacken."
        )
        ws["C66"] = (
            "Zum Nachrechnen in Excel für Mac/Windows öffnen, Berichtsmonat auf Steuerung ändern, "
            "berechnen und speichern; danach erneut hochladen bzw. bake_hub_values.py ausführen."
        )
        for coord in ("C65", "C66"):
            ws[coord].font = Font(name="Calibri", size=9, italic=True, color="666666")

        # Berichtszeitraum text if still a formula leftover was baked; ensure readable
        st = wb_hub["Steuerung"]
        year = st["F6"].value
        month = st["F7"].value
        if isinstance(year, (int, float)) and isinstance(month, (int, float)):
            ws["C9"] = f"Berichtszeitraum: 01–{int(month):02d} / {int(year)}"

    wb_hub.save(hub_path)
    return stats


def refresh_download_zip() -> Path | None:
    zip_path = ROOT / "TVF_Cockpit_Download.zip"
    hub = ROOT / "Cockpit-Hub-SharePoint.xlsx"
    cockpit = ROOT / "Cockpit.xlsx"
    if not hub.exists():
        return None
    # Ensure download Cockpit.xlsx matches hub
    shutil.copy2(hub, cockpit)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(cockpit, arcname="Cockpit.xlsx")
        readme = (
            "Cockpit.xlsx = SharePoint-Hub mit eingebackenen Kennzahlen.\n"
            "Hochladen nach: Dokumente / TVF-Controlling-Cockpit / Cockpit.xlsx\n"
            "Ersetzen, Seite neu veröffentlichen, Hard-Reload.\n"
        )
        zf.writestr("README.txt", readme)
    # Mirror to store + docs root
    for dest in (
        ROOT.parent / "TVF_Cockpit_Download.zip",
        STORE_DOCS / "TVF_Cockpit_Download.zip",
        STORE_DOCS / "workbook-split" / "TVF_Cockpit_Download.zip",
        STORE_DOCS / "Cockpit.xlsx",
    ):
        if dest.suffix == ".xlsx":
            shutil.copy2(cockpit, dest)
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(zip_path, dest)
    return zip_path


def main() -> None:
    import_path = _find_import()
    print(f"Import-Quelle: {import_path}")

    # Primary hub
    primary = ROOT / "Cockpit-Hub-SharePoint.xlsx"
    if not primary.exists():
        raise SystemExit(f"Hub fehlt: {primary}")

    stats = bake(primary, import_path)
    for sheet, s in stats.items():
        print(f"  {sheet}: baked={s['baked']} hyperlinks={s['kept_formula']} empty={s['skipped']}")

    # Mirror hub to all Cockpit.xlsx locations
    for dest in HUB_PATHS:
        if dest.resolve() == primary.resolve():
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(primary, dest)
        print(f"kopiert → {dest}")

    z = refresh_download_zip()
    if z:
        print(f"Download-ZIP: {z}")
    print("fertig.")


if __name__ == "__main__":
    main()
