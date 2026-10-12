#!/usr/bin/env python3
"""Zwei wichtige Tabellen aus D Finanzen:

1) Forecast je Auftrag
2) Abgleich Forecast ↔ Rechnungstellung (Plan-Umsatz vs. Ist-Rechnung/SAP)
"""

from __future__ import annotations

import shutil
import zipfile
import warnings
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[1]
DATEIEN = ROOT / "dateien"
D_FINANZEN = DATEIEN / "D Finanzen.xlsx"
STORE = Path("/cursor/stores/bc-d9b5c533-1abd-48a4-a0b7-3919e592c358/docs")
ARTIFACTS = Path("/opt/cursor/artifacts")

HDR_FONT = Font(bold=True, color="FFFFFF", name="Calibri", size=11)
HDR_FILL = PatternFill("solid", fgColor="1F4E79")
TITLE = Font(bold=True, size=16, color="1F4E79", name="Calibri")
SUB = Font(size=10, color="444444", name="Calibri")
MONEY = '#,##0.00'
PCT = '0.0%'
THIN = Border(
    left=Side(style="thin", color="D0D7DE"),
    right=Side(style="thin", color="D0D7DE"),
    top=Side(style="thin", color="D0D7DE"),
    bottom=Side(style="thin", color="D0D7DE"),
)
NEG = Font(color="C00000", name="Calibri")


def find_block(ws, marker: str):
    start = None
    for r in range(1, (ws.max_row or 1) + 1):
        if ws.cell(r, 1).value == marker:
            start = r
            break
    if start is None:
        raise KeyError(marker)
    headers = []
    for c in range(1, 30):
        v = ws.cell(start + 1, c).value
        if v is None and c > 3:
            break
        headers.append(v)
    while headers and headers[-1] is None:
        headers.pop()
    rows = []
    for r in range(start + 2, (ws.max_row or 1) + 1):
        a = ws.cell(r, 1).value
        if isinstance(a, str) and a.startswith("v_"):
            break
        if a is None and all(ws.cell(r, c).value is None for c in range(1, len(headers) + 1)):
            # allow one blank then stop if next is marker-ish
            continue
        if a is None and not any(ws.cell(r, c).value is not None for c in range(1, len(headers) + 1)):
            break
        row = {headers[i]: ws.cell(r, i + 1).value for i in range(len(headers))}
        # stop if jahr-like header repeated
        if row.get(headers[0]) == headers[0]:
            break
        if all(v is None for v in row.values()):
            break
        rows.append(row)
    return headers, rows


def style_header(ws, row: int, cols: int):
    for c in range(1, cols + 1):
        cell = ws.cell(row, c)
        cell.font = HDR_FONT
        cell.fill = HDR_FILL
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        cell.border = THIN


def autosize(ws, max_width=42):
    for col in ws.columns:
        letter = get_column_letter(col[0].column)
        width = 12
        for cell in col[:100]:
            if cell.value is not None:
                width = min(max_width, max(width, len(str(cell.value)) + 2))
        ws.column_dimensions[letter].width = width


def money_cells(ws, row: int, cols: list[int]):
    for c in cols:
        cell = ws.cell(row, c)
        if isinstance(cell.value, (int, float)):
            cell.number_format = MONEY
            cell.border = THIN
            if cell.value < 0:
                cell.font = NEG


def build_forecast_je_auftrag(rows: list[dict]) -> Workbook:
    wb = Workbook()
    ws = wb.active
    ws.title = "Forecast je Auftrag"
    ws["C2"] = "Forecast je Auftrag"
    ws["C2"].font = TITLE
    ws["C3"] = (
        "Quelle: D Finanzen → v_forecast_auftrag. "
        "Plan = Forecast, Ist = gebuchte Umsätze/Kosten (SAP/Rechnung), "
        "Restplan = noch geplante Monate, Erwartet = Ist + Restplan."
    )
    ws["C3"].font = SUB
    ws.merge_cells("C3:N3")

    headers = [
        "Auftrag",
        "Name",
        "Region",
        "Jahr",
        "Umsatz Plan (Forecast)",
        "Umsatz Ist (Rechnung/SAP)",
        "Δ Umsatz (Ist−Plan)",
        "Umsatz Restplan",
        "Umsatz erwartet",
        "Kosten Plan",
        "Kosten Ist",
        "Δ Kosten (Ist−Plan)",
        "Kosten Restplan",
        "Kosten erwartet",
        "BA Plan",
        "BA Ist",
        "BA erwartet",
    ]
    start = 5
    for i, h in enumerate(headers, 1):
        ws.cell(start, i, h)
    style_header(ws, start, len(headers))

    # sort by abs umsatz erwartet desc
    def key(r):
        v = r.get("umsatz_erwartet") or 0
        try:
            return -abs(float(v))
        except (TypeError, ValueError):
            return 0

    for i, r in enumerate(sorted(rows, key=key), start=start + 1):
        up = r.get("umsatz_plan") or 0
        ui = r.get("umsatz_ist") or 0
        kp = r.get("kosten_plan") or 0
        ki = r.get("kosten_ist") or 0
        vals = [
            r.get("auftrag"),
            r.get("auftragname"),
            r.get("region"),
            r.get("jahr") or 2026,
            up,
            ui,
            (ui or 0) - (up or 0),
            r.get("umsatz_restplan") or 0,
            r.get("umsatz_erwartet") or 0,
            kp,
            ki,
            (ki or 0) - (kp or 0),
            r.get("kosten_restplan") or 0,
            r.get("kosten_erwartet") or 0,
            r.get("ba_plan") or 0,
            r.get("ba_ist") or 0,
            r.get("ba_erwartet") or 0,
        ]
        for c, v in enumerate(vals, 1):
            ws.cell(i, c, v)
            ws.cell(i, c).border = THIN
        money_cells(ws, i, list(range(5, 18)))

    # totals
    total_row = start + 1 + len(rows)
    ws.cell(total_row, 1, "SUMME").font = Font(bold=True)
    for c in range(5, 18):
        col = get_column_letter(c)
        ws.cell(total_row, c, f"=SUM({col}{start+1}:{col}{total_row-1})")
        ws.cell(total_row, c).font = Font(bold=True)
        ws.cell(total_row, c).number_format = MONEY

    autosize(ws)
    ws.auto_filter.ref = f"A{start}:{get_column_letter(len(headers))}{total_row-1}"
    ws.freeze_panes = f"A{start+1}"
    return wb


def build_abgleich(auftrag_rows: list[dict], monat_rows: list[dict]) -> Workbook:
    wb = Workbook()

    # --- Sheet 1: Je Auftrag ---
    ws = wb.active
    ws.title = "Abgleich je Auftrag"
    ws["C2"] = "Abgleich Forecast ↔ Rechnungstellung"
    ws["C2"].font = TITLE
    ws["C3"] = (
        "Je Auftrag: Forecast-Umsatz (Plan) gegen Rechnung/Ist-Umsatz aus SAP. "
        "Offen = Plan − Ist (positiv = noch nicht berechnet / unter Plan)."
    )
    ws["C3"].font = SUB
    ws.merge_cells("C3:L3")

    headers = [
        "Auftrag",
        "Name",
        "Region",
        "Jahr",
        "Forecast Umsatz (Plan)",
        "Rechnung / Ist Umsatz (SAP)",
        "Offen (Plan−Ist)",
        "Erfüllungsquote",
        "Forecast Kosten (Plan)",
        "Kosten Ist (SAP)",
        "Δ Kosten",
        "Status",
    ]
    start = 5
    for i, h in enumerate(headers, 1):
        ws.cell(start, i, h)
    style_header(ws, start, len(headers))

    def akey(r):
        try:
            return -abs(float(r.get("umsatz_plan") or 0))
        except (TypeError, ValueError):
            return 0

    for i, r in enumerate(sorted(auftrag_rows, key=akey), start=start + 1):
        up = float(r.get("umsatz_plan") or 0)
        ui = float(r.get("umsatz_ist") or 0)
        offen = up - ui
        quote = (ui / up) if up else None
        kp = float(r.get("kosten_plan") or 0)
        ki = float(r.get("kosten_ist") or 0)
        if abs(offen) < 1:
            status = "ausgeglichen"
        elif offen > 0:
            status = "unter Plan / offen"
        else:
            status = "über Plan / überrechnet"
        vals = [
            r.get("auftrag"),
            r.get("auftragname"),
            r.get("region"),
            r.get("jahr") or 2026,
            up,
            ui,
            offen,
            quote,
            kp,
            ki,
            ki - kp,
            status,
        ]
        for c, v in enumerate(vals, 1):
            cell = ws.cell(i, c, v)
            cell.border = THIN
        money_cells(ws, i, [5, 6, 7, 9, 10, 11])
        if isinstance(ws.cell(i, 8).value, float):
            ws.cell(i, 8).number_format = PCT

    total_row = start + 1 + len(auftrag_rows)
    ws.cell(total_row, 1, "SUMME").font = Font(bold=True)
    for c in (5, 6, 7, 9, 10, 11):
        col = get_column_letter(c)
        ws.cell(total_row, c, f"=SUM({col}{start+1}:{col}{total_row-1})")
        ws.cell(total_row, c).font = Font(bold=True)
        ws.cell(total_row, c).number_format = MONEY
    autosize(ws)
    ws.auto_filter.ref = f"A{start}:{get_column_letter(len(headers))}{total_row-1}"
    ws.freeze_panes = f"A{start+1}"

    # --- Sheet 2: Je Region/Monat ---
    ws2 = wb.create_sheet("Abgleich Region Monat")
    ws2["C2"] = "Forecast ↔ Rechnung je Region und Monat"
    ws2["C2"].font = TITLE
    ws2["C3"] = (
        "Quelle: D Finanzen → v_forecast_monat. "
        "Plan = Forecast, Gemeldet = gemeldeter Ist, SAP = Rechnung/Buchung."
    )
    ws2["C3"].font = SUB
    ws2.merge_cells("C3:L3")

    h2 = [
        "Jahr",
        "Region",
        "Monat",
        "Umsatz Plan (Forecast)",
        "Umsatz gemeldet",
        "Umsatz SAP / Rechnung",
        "Δ Plan−SAP",
        "Δ Gemeldet−SAP",
        "Kosten Plan",
        "Kosten gemeldet",
        "Kosten SAP",
        "DB Plan",
        "DB SAP",
    ]
    start = 5
    for i, h in enumerate(h2, 1):
        ws2.cell(start, i, h)
    style_header(ws2, start, len(h2))

    def mkey(r):
        return (r.get("jahr") or 0, r.get("region") or "", r.get("monat") or 0)

    for i, r in enumerate(sorted(monat_rows, key=mkey), start=start + 1):
        up = float(r.get("umsatz_plan") or 0)
        ug = float(r.get("umsatz_gemeldet") or 0)
        us = float(r.get("umsatz_sap") or 0)
        vals = [
            r.get("jahr"),
            r.get("region"),
            r.get("monat"),
            up,
            ug,
            us,
            up - us,
            ug - us,
            r.get("kosten_plan") or 0,
            r.get("kosten_gemeldet") or 0,
            r.get("kosten_sap") or 0,
            r.get("db_plan") or 0,
            r.get("db_sap") or 0,
        ]
        for c, v in enumerate(vals, 1):
            ws2.cell(i, c, v).border = THIN
        money_cells(ws2, i, list(range(4, 14)))

    end = start + len(monat_rows)
    autosize(ws2)
    if monat_rows:
        ws2.auto_filter.ref = f"A{start}:{get_column_letter(len(h2))}{end}"
        ws2.freeze_panes = f"A{start+1}"

    # --- Sheet 3: Legende ---
    leg = wb.create_sheet("Legende")
    leg["A1"] = "Legende"
    leg["A1"].font = TITLE
    lines = [
        ("Forecast Umsatz (Plan)", "Geplanter Umsatz aus dem Rolling Forecast je Auftrag/Monat."),
        ("Rechnung / Ist Umsatz (SAP)", "Gebuchte Umsatzerlöse (Rechnungstellung) aus SAP je Auftrag."),
        ("Offen (Plan−Ist)", "Noch nicht durch Rechnungen gedeckter Forecast-Umsatz."),
        ("Erfüllungsquote", "Ist ÷ Plan. >100 % = über Forecast berechnet."),
        ("Abgleich Region Monat", "Dieselbe Logik aggregiert nach Region und Monat."),
        ("Quelle", "D Finanzen.xlsx – Sichten v_forecast_auftrag und v_forecast_monat."),
    ]
    leg["A3"] = "Begriff"
    leg["B3"] = "Bedeutung"
    style_header(leg, 3, 2)
    for i, (a, b) in enumerate(lines, 4):
        leg.cell(i, 1, a)
        leg.cell(i, 2, b)
    autosize(leg, 70)
    return wb


def add_hub_links():
    """Add hyperlinks on Cockpit sheet if cells free near Direktzugriff."""
    for path in (ROOT / "Cockpit-Hub-SharePoint.xlsx", DATEIEN / "Cockpit.xlsx", ROOT / "Cockpit.xlsx"):
        if not path.exists():
            continue
        wb = load_workbook(path)
        if "Cockpit" not in wb.sheetnames:
            continue
        ws = wb["Cockpit"]
        # Free cells next to Daten/Anleitung
        ws["K58"] = (
            '=IFERROR(HYPERLINK("[Forecast je Auftrag.xlsx]'
            "'Forecast je Auftrag'!C2\",\"Forecast je Auftrag\"),\"Forecast je Auftrag\")"
        )
        ws["O58"] = (
            '=IFERROR(HYPERLINK("[Forecast Rechnung Abgleich.xlsx]'
            "'Abgleich je Auftrag'!C2\",\"Forecast ↔ Rechnung\"),\"Forecast ↔ Rechnung\")"
        )
        wb.save(path)


def update_seiten_json():
    import json

    p = ROOT / "seiten.json"
    if not p.exists():
        return
    data = json.loads(p.read_text(encoding="utf-8"))
    seiten = data.get("seiten", [])
    names = {s.get("seitenname") for s in seiten}
    additions = [
        {
            "reihenfolge": 36,
            "seitenname": "TVF-Forecast-je-Auftrag",
            "titel": "Forecast je Auftrag",
            "originalseite": "Forecast je Auftrag",
            "excel": "Forecast je Auftrag.xlsx",
            "blatt": "Forecast je Auftrag",
            "gruppe": "Projekte",
            "typ": "auswertung",
            "hinweis": "Plan/Ist/Restplan/Erwartet je Auftrag aus v_forecast_auftrag.",
        },
        {
            "reihenfolge": 37,
            "seitenname": "TVF-Forecast-Rechnung-Abgleich",
            "titel": "Forecast ↔ Rechnungstellung",
            "originalseite": "Forecast Rechnung Abgleich",
            "excel": "Forecast Rechnung Abgleich.xlsx",
            "blatt": "Abgleich je Auftrag",
            "gruppe": "Projekte",
            "typ": "auswertung",
            "hinweis": "Abgleich Forecast-Umsatz gegen Rechnung/Ist-Umsatz (SAP).",
        },
    ]
    for a in additions:
        if a["seitenname"] not in names:
            seiten.append(a)
    seiten.sort(key=lambda s: s.get("reihenfolge", 999))
    data["seiten"] = seiten
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def pack_zips():
    files = [
        DATEIEN / "Forecast je Auftrag.xlsx",
        DATEIEN / "Forecast Rechnung Abgleich.xlsx",
    ]
    # dedicated small zip
    z = ROOT / "TVF_Forecast_Tabellen.zip"
    with zipfile.ZipFile(z, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            zf.write(f, arcname=f.name)
        zf.writestr(
            "README.txt",
            "Forecast je Auftrag.xlsx\n"
            "Forecast Rechnung Abgleich.xlsx\n\n"
            "Nach TVF-Controlling-Cockpit/ hochladen.\n"
            "Quellen: D Finanzen (v_forecast_auftrag, v_forecast_monat).\n",
        )
    # refresh ALLE_WERTE if present
    alle = ROOT / "TVF_ALLE_WERTE.zip"
    if alle.exists() or True:
        with zipfile.ZipFile(alle, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            hub = ROOT / "Cockpit.xlsx"
            if hub.exists():
                zf.write(hub, "Cockpit.xlsx")
            h2 = ROOT / "Cockpit-Hub-SharePoint.xlsx"
            if h2.exists():
                zf.write(h2, "Cockpit-Hub-SharePoint.xlsx")
            for p in sorted(DATEIEN.glob("*.xlsx")):
                zf.write(p, f"dateien/{p.name}")
            zf.writestr(
                "ZUERST-LESEN.txt",
                "Enthält u.a. Forecast je Auftrag + Forecast Rechnung Abgleich.\n"
                "Alles nach TVF-Controlling-Cockpit ersetzen, veröffentlichen, Hard-Reload.\n",
            )
    for name in (
        "TVF_Forecast_Tabellen.zip",
        "TVF_ALLE_WERTE.zip",
        "Cockpit.xlsx",
        "Cockpit-Hub-SharePoint.xlsx",
    ):
        src = ROOT / name
        if not src.exists():
            continue
        for dest in (ROOT.parent, STORE, STORE / "workbook-split", ARTIFACTS):
            dest.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest / name)
        if name == "Cockpit.xlsx":
            shutil.copy2(src, DATEIEN / "Cockpit.xlsx")
        elif name == "Cockpit-Hub-SharePoint.xlsx":
            shutil.copy2(src, ROOT / "Cockpit-Hub-SharePoint.xlsx")


def main():
    print("Lese D Finanzen …")
    wb = load_workbook(D_FINANZEN, data_only=True)
    ws = wb["D Finanzen"]
    _, auftrag_rows = find_block(ws, "v_forecast_auftrag")
    _, monat_rows = find_block(ws, "v_forecast_monat")
    wb.close()
    print(f"  Forecast je Auftrag: {len(auftrag_rows)} Zeilen")
    print(f"  Forecast Monat: {len(monat_rows)} Zeilen")

    f1 = DATEIEN / "Forecast je Auftrag.xlsx"
    f2 = DATEIEN / "Forecast Rechnung Abgleich.xlsx"
    build_forecast_je_auftrag(auftrag_rows).save(f1)
    build_abgleich(auftrag_rows, monat_rows).save(f2)
    print("geschrieben:", f1.name, f2.name)

    add_hub_links()
    update_seiten_json()
    pack_zips()

    # mirrors
    for f in (f1, f2):
        for dest in (STORE / "workbook-split" / "dateien", ARTIFACTS):
            dest.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dest / f.name)

    readme = ROOT / "FORECAST-TABELLEN.md"
    readme.write_text(
        """# Forecast-Tabellen

Zwei Auswertungen aus **D Finanzen**:

| Datei | Inhalt |
|-------|--------|
| `dateien/Forecast je Auftrag.xlsx` | Plan / Ist / Restplan / Erwartet je Auftrag |
| `dateien/Forecast Rechnung Abgleich.xlsx` | Abgleich Forecast-Umsatz ↔ Rechnung/Ist (SAP), plus Region/Monat |

Download: `TVF_Forecast_Tabellen.zip` oder im Paket `TVF_ALLE_WERTE.zip`.

```bash
python3 scripts/build_forecast_tabellen.py
```
""",
        encoding="utf-8",
    )
    shutil.copy2(readme, STORE / "workbook-split" / readme.name)
    print("fertig.")


if __name__ == "__main__":
    main()
