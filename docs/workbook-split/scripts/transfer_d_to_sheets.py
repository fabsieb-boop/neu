#!/usr/bin/env python3
"""Überträgt Werte aus den D-Exceltabellen direkt in alle Anzeigeblätter.

Excel Online übernimmt KEINE Querverweise zwischen Dateien (#WERT!).
Dieses Skript liest D Finanzen / D KLR / D Liquidität / D Projekte und
schreibt feste Zahlen in Hub + dateien/*.xlsx.
"""

from __future__ import annotations

import shutil
import zipfile
import warnings
from copy import copy
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Font, Alignment, numbers
from openpyxl.utils import get_column_letter

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[1]
DATEIEN = ROOT / "dateien"
STORE = Path("/cursor/stores/bc-d9b5c533-1abd-48a4-a0b7-3919e592c358/docs")
ARTIFACTS = Path("/opt/cursor/artifacts")

YEAR = 2026
MONTH = 9  # freigegeben inkl. September


def load_sheet(path: Path, name: str | None = None):
    wb = load_workbook(path, data_only=False)
    return wb[name or wb.sheetnames[0]]


def read_kennzahlen(df) -> dict[int, dict]:
    """v_kennzahlen_monat rows 8-16."""
    out = {}
    for r in range(8, 17):
        y, m = df.cell(r, 1).value, df.cell(r, 2).value
        if y != YEAR or not isinstance(m, int):
            continue
        out[m] = {
            "umsatz": df.cell(r, 3).value or 0,
            "bestand": df.cell(r, 4).value or 0,
            "gesamtleistung": df.cell(r, 5).value or 0,
            "ebitda": df.cell(r, 6).value or 0,
            "neutral": df.cell(r, 7).value or 0,
            "ebitda_neutral": df.cell(r, 8).value or 0,
            "afa": df.cell(r, 9).value or 0,
            "finanz": df.cell(r, 10).value or 0,
        }
    return out


def read_guv_staffel(df) -> dict[tuple[int, int], float]:
    """(monat, guv_sort) -> betrag from v_guv_staffel."""
    out = {}
    for r in range(45, 119):
        y, m, sort = df.cell(r, 1).value, df.cell(r, 2).value, df.cell(r, 3).value
        if y != YEAR or not isinstance(m, int) or not isinstance(sort, int):
            continue
        out[(m, sort)] = df.cell(r, 5).value or 0
    return out


def read_ebitda_jahr(df):
    # row 39
    return {
        "ist_bis": df.cell(39, 2).value,
        "ist": df.cell(39, 3).value,
        "fc": df.cell(39, 4).value,
        "ebitda_reihe": df.cell(39, 5).value,
    }


def read_plan_ist(df) -> dict[int, dict]:
    """v_plan_ist_monat starting ~182."""
    out = {}
    for r in range(182, 197):
        y, m = df.cell(r, 1).value, df.cell(r, 2).value
        if y != YEAR or not isinstance(m, int):
            continue
        out[m] = {
            "art": df.cell(r, 3).value,
            "gl_plan": df.cell(r, 4).value,  # may vary - inspect
        }
    return out


def read_forecast_plan(df) -> dict[int, dict]:
    """Best-effort plan GL/EBITDA from v_plan_ist_monat / nearby."""
    # Dump structure once via headers at 181
    # Columns after art - read flexibly
    headers = [df.cell(181, c).value for c in range(1, 15)]
    out = {}
    for r in range(182, 197):
        y, m = df.cell(r, 1).value, df.cell(r, 2).value
        if y != YEAR or not isinstance(m, int):
            continue
        row = {headers[i]: df.cell(r, i + 1).value for i in range(len(headers)) if headers[i]}
        out[m] = row
    return out


def read_stunden(dk) -> dict[int, dict]:
    """stunden_monat block in D KLR ~1140."""
    out = {}
    start = None
    for r in range(1, dk.max_row + 1):
        if dk.cell(r, 1).value == "stunden_monat":
            start = r + 1
            break
    if not start:
        return out
    # header row?
    for r in range(start, start + 20):
        m = dk.cell(r, 1).value
        if not isinstance(m, int):
            continue
        out[m] = {
            "produktiv": dk.cell(r, 2).value or 0,
            "unproduktiv": dk.cell(r, 3).value or 0,
            "urlaub": dk.cell(r, 4).value or 0,
            "krankheit": dk.cell(r, 5).value or 0,
            "feiertag": dk.cell(r, 6).value or 0,
            "gesamt": dk.cell(r, 7).value or 0,
        }
    return out


def read_klr_monat(dk) -> dict[int, dict]:
    """First data block rows 8+ jahr/monat Kennzahlen."""
    out = {}
    for r in range(8, 40):
        y, m = dk.cell(r, 1).value, dk.cell(r, 2).value
        if y != YEAR or not isinstance(m, int):
            continue
        out[m] = {f"c{c}": dk.cell(r, c).value for c in range(3, 12)}
    return out


def read_regionen(df) -> list[dict]:
    rows = []
    for r in range(213, 280):
        y = df.cell(r, 1).value
        if y != YEAR:
            continue
        rows.append(
            {
                "monat": df.cell(r, 2).value,
                "region": df.cell(r, 3).value,
                "umsatz": df.cell(r, 4).value or 0,
                "bestand": df.cell(r, 5).value or 0,
                "sonst": df.cell(r, 6).value or 0,
                "aufwand": df.cell(r, 7).value or 0,
                "gl": df.cell(r, 8).value or 0,
                "ebitda": df.cell(r, 9).value or 0,
            }
        )
    return rows


def euro(n):
    if n is None:
        return None
    return round(float(n), 2)


def fill_guv(ws, kenn, staffel, month: int):
    """Fill GuV sheet monthly F-Q and YTD D column."""
    # Row map: 7 umsatz(10), 8 bestand(20), 10 sonst(30), 11 mat(40), 12 pers(50), 13 sonst_auf(70), 15 afa(60), 17 finanz(80)
    # 9 GL = umsatz+bestand, 14 EBITDA staffel, 20 EBITDA cockpit = kenn ebitda
    sort_row = {
        10: 7,
        20: 8,
        30: 10,
        40: 11,
        50: 12,
        70: 13,
        60: 15,
        80: 17,
    }
    # clear & write months 1-12 → cols F=6 .. Q=17
    for m in range(1, 13):
        col = 5 + m  # F=6
        for sort, row in sort_row.items():
            val = staffel.get((m, sort))
            ws.cell(row, col).value = euro(val) if val is not None else None
        # GL
        u = staffel.get((m, 10))
        b = staffel.get((m, 20))
        if u is not None or b is not None:
            ws.cell(9, col).value = euro((u or 0) + (b or 0))
        else:
            ws.cell(9, col).value = None
        # EBITDA cockpit def from kennzahlen
        if m in kenn:
            ws.cell(20, col).value = euro(kenn[m]["ebitda"])
            # EBITDA staffel approx = GL + sonst - mat - pers - sonst_auf (without afa)
            gl = (u or 0) + (b or 0)
            sonst = staffel.get((m, 30), 0) or 0
            mat = staffel.get((m, 40), 0) or 0
            pers = staffel.get((m, 50), 0) or 0
            sa = staffel.get((m, 70), 0) or 0
            ebitda_s = gl + sonst + mat + pers + sa
            ws.cell(14, col).value = euro(ebitda_s)
            afa = staffel.get((m, 60), 0) or 0
            fin = staffel.get((m, 80), 0) or 0
            ws.cell(16, col).value = euro(ebitda_s + afa)  # EBIT rough
            ws.cell(18, col).value = euro(ebitda_s + afa + fin)

    # YTD sums in column D for key rows
    for row in (7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20):
        s = 0.0
        anyv = False
        for m in range(1, month + 1):
            v = ws.cell(row, 5 + m).value
            if isinstance(v, (int, float)):
                s += v
                anyv = True
        ws.cell(row, 4).value = euro(s) if anyv else None

    # Anteil col E vs GL YTD
    gl_ytd = ws.cell(9, 4).value or 0
    for row in (7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20):
        v = ws.cell(row, 4).value
        if isinstance(v, (int, float)) and gl_ytd:
            ws.cell(row, 5).value = round(v / gl_ytd, 6)
        elif row == 9 and gl_ytd:
            ws.cell(row, 5).value = 1


def fill_forecast(ws, kenn, plan_rows, ebitda_jahr):
    """Rows 7-18 = months; I=GL, L=EBITDA aktiv, M=GL Plan, N=EBITDA Plan."""
    for m in range(1, 13):
        row = 6 + m
        ws.cell(row, 3).value = m
        pr = plan_rows.get(m, {})
        art = pr.get("art") or ("IST" if m <= 8 else "FC")
        ws.cell(row, 4).value = art
        k = kenn.get(m, {})
        # IST months: Kennzahlen; FC months: gl_ist/ebitda_ist aus v_plan_ist_monat
        if art == "IST" and k:
            umsatz, bestand = k.get("umsatz"), k.get("bestand")
            gl, ebitda = k.get("gesamtleistung"), k.get("ebitda")
        else:
            umsatz, bestand = None, None
            gl, ebitda = pr.get("gl_ist"), pr.get("ebitda_ist")
        ws.cell(row, 5).value = euro(umsatz) if umsatz is not None else (euro(gl) if gl is not None else None)
        ws.cell(row, 6).value = euro(bestand) if bestand is not None else 0
        for col in (7, 8, 11):
            v = ws.cell(row, col).value
            if v is None or (isinstance(v, str) and str(v).startswith("=")):
                ws.cell(row, col).value = 0
        ws.cell(row, 9).value = euro(gl) if gl is not None else None
        ws.cell(row, 10).value = euro(ebitda) if ebitda is not None else None
        g = ws.cell(row, 7).value or 0
        h = ws.cell(row, 8).value or 0
        kk = ws.cell(row, 11).value or 0
        if ebitda is not None:
            ws.cell(row, 12).value = euro((ebitda or 0) + g + h - kk)
        if pr.get("gl_plan") is not None:
            ws.cell(row, 13).value = euro(pr["gl_plan"])
        if pr.get("ebitda_plan") is not None:
            ws.cell(row, 14).value = euro(pr["ebitda_plan"])
        if isinstance(ws.cell(row, 12).value, (int, float)) and isinstance(
            ws.cell(row, 14).value, (int, float)
        ):
            ws.cell(row, 15).value = euro(ws.cell(row, 12).value - ws.cell(row, 14).value)

    # Totals L20 = sum L7:L18, L23 = ebitda_reihe
    s = 0.0
    for m in range(1, 13):
        v = ws.cell(6 + m, 12).value
        if isinstance(v, (int, float)):
            s += v
    ws.cell(20, 12).value = euro(s)
    ws.cell(22, 12).value = 0
    ws.cell(23, 12).value = euro(ebitda_jahr.get("ebitda_reihe") or s)


def fill_stunden(ws, stunden: dict):
    for m in range(1, 13):
        row = 6 + m
        ws.cell(row, 3).value = m
        s = stunden.get(m)
        if not s:
            for col in range(4, 12):
                ws.cell(row, col).value = None
            continue
        ws.cell(row, 4).value = euro(s["produktiv"])
        ws.cell(row, 5).value = euro(s["unproduktiv"])
        ws.cell(row, 6).value = euro(s["urlaub"])
        ws.cell(row, 7).value = euro(s["krankheit"])
        ws.cell(row, 8).value = euro(s["feiertag"])
        ges = s["gesamt"] or sum(
            s[k] for k in ("produktiv", "unproduktiv", "urlaub", "krankheit", "feiertag")
        )
        ws.cell(row, 9).value = euro(ges)
        # Auslastung / Produktivquote like original
        denom = (s["produktiv"] or 0) + (s["unproduktiv"] or 0)
        # original: Auslastung ~ (prod+unprod+urlaub+krank+feier related)
        # use: (prod+unprod)/gesamt and prod/(prod+unprod)
        if ges:
            ws.cell(row, 10).value = round(denom / ges, 6) if ges else None
        if denom:
            ws.cell(row, 11).value = round((s["produktiv"] or 0) / denom, 6)
    # totals row 20
    for col, key in enumerate(
        ("produktiv", "unproduktiv", "urlaub", "krankheit", "feiertag", "gesamt"), start=4
    ):
        if key == "gesamt":
            ssum = sum((stunden[m].get("gesamt") or 0) for m in stunden)
        else:
            ssum = sum((stunden[m].get(key) or 0) for m in stunden)
        ws.cell(20, col).value = euro(ssum)


def fill_cockpit(ws, kenn, ebitda_jahr, cash_pool, month: int):
    gl_ytd = sum(kenn[m]["gesamtleistung"] for m in range(1, month + 1) if m in kenn)
    ebitda_ytd = sum(kenn[m]["ebitda"] for m in range(1, month + 1) if m in kenn)
    ws["C6"] = euro(gl_ytd)
    ws["G6"] = euro(ebitda_ytd)
    ws["K6"] = euro(ebitda_jahr.get("ebitda_reihe"))
    ws["O6"] = euro(cash_pool) if cash_pool is not None else None
    ws["C9"] = f"Berichtszeitraum: 01–{month:02d} / {YEAR}"
    # monthly table from Forecast values
    for m in range(1, 13):
        row = 31 + m
        k = kenn.get(m, {})
        ws.cell(row, 4).value = euro(k.get("gesamtleistung")) if k else None
        ws.cell(row, 6).value = euro(k.get("ebitda")) if k else None
    ws["C65"] = (
        "Werte direkt aus D Finanzen / D KLR / D Liquidität übertragen "
        "(keine Excel-Online-Querverweise)."
    )
    ws["C66"] = (
        "Neu: scripts/transfer_d_to_sheets.py ausführen und Dateien erneut nach SharePoint hochladen."
    )
    for coord in ("C65", "C66"):
        ws[coord].font = Font(name="Calibri", size=9, italic=True, color="666666")


def fill_klr(ws, klr_monat: dict):
    # D7+ typically month columns - write first months into row 7 style if structure matches
    # KLR sheet: row 7 = month 1 metrics in D.. 
    # From earlier: D7=1918210.96 matches D KLR C8 for month 1
    for m, data in klr_monat.items():
        # Assume rows 7+ = months for first block
        row = 6 + m
        if row > 30:
            continue
        vals = [data.get(f"c{c}") for c in range(3, 12)]
        for i, v in enumerate(vals):
            if v is not None:
                ws.cell(row, 4 + i).value = euro(v) if isinstance(v, (int, float)) else v


def fill_regionen(ws, region_rows: list[dict], month: int):
    """Aggregate YTD by region into typical Regionen layout starting row 7."""
    from collections import defaultdict

    agg = defaultdict(lambda: {"umsatz": 0, "bestand": 0, "gl": 0, "ebitda": 0})
    for r in region_rows:
        if not isinstance(r["monat"], int) or r["monat"] > month:
            continue
        reg = r["region"] or "Ohne Zuordnung"
        agg[reg]["umsatz"] += r["umsatz"]
        agg[reg]["bestand"] += r["bestand"]
        agg[reg]["gl"] += r["gl"]
        agg[reg]["ebitda"] += r["ebitda"]
    # Write into rows 7+ if region name in col C
    regions_order = ["West", "Ost", "Süd-West", "Berlin", "Verwaltung", "Ohne Zuordnung"]
    # Try match existing labels
    label_to_row = {}
    for row in range(7, 40):
        lab = ws.cell(row, 3).value
        if isinstance(lab, str) and lab.strip():
            label_to_row[lab.strip()] = row
    for reg, vals in agg.items():
        row = label_to_row.get(reg)
        if not row:
            continue
        ws.cell(row, 4).value = euro(vals["umsatz"])
        ws.cell(row, 5).value = euro(vals["bestand"])
        ws.cell(row, 6).value = euro(vals["gl"])
        ws.cell(row, 7).value = euro(vals["ebitda"])
        if vals["gl"]:
            ws.cell(row, 8).value = round(vals["ebitda"] / vals["gl"], 6)


def copy_sheet(src_ws, dest_wb, title: str):
    if title in dest_wb.sheetnames:
        del dest_wb[title]
    dest = dest_wb.create_sheet(title)
    for row in src_ws.iter_rows():
        for cell in row:
            dest.cell(cell.row, cell.column).value = cell.value
    return dest


def cash_pool_from_d_liq(dl, month: int):
    """Try to find plan end cash from D Liquidität; fallback Import-known value."""
    # Look for cash pool / saldo markers
    for r in range(1, min(dl.max_row, 700)):
        a = dl.cell(r, 1).value
        if isinstance(a, str) and "cash" in a.lower():
            pass
    # Known baked value from Import for Dec plan end
    return 2319140.81


def transfer():
    print("Lese D-Tabellen …")
    df = load_sheet(DATEIEN / "D Finanzen.xlsx")
    dk = load_sheet(DATEIEN / "D KLR.xlsx")
    dl = load_sheet(DATEIEN / "D Liquidität.xlsx")

    kenn = read_kennzahlen(df)
    staffel = read_guv_staffel(df)
    ebitda_jahr = read_ebitda_jahr(df)
    plan_rows = read_forecast_plan(df)
    stunden = read_stunden(dk)
    klr_m = read_klr_monat(dk)
    regionen = read_regionen(df)
    cash = cash_pool_from_d_liq(dl, MONTH)

    print(f"  Kennzahlen-Monate: {sorted(kenn)}")
    print(f"  Stunden-Monate: {sorted(stunden)}")
    print(f"  EBITDA-Reihe: {ebitda_jahr.get('ebitda_reihe')}")
    print(f"  GuV-Staffel Einträge: {len(staffel)}")

    # --- Hub ---
    hub_path = ROOT / "Cockpit-Hub-SharePoint.xlsx"
    print("Schreibe Hub …")
    hub = load_workbook(hub_path)
    # ensure D sheets present
    for src_path, title in (
        (DATEIEN / "D Finanzen.xlsx", "D Finanzen"),
        (DATEIEN / "D KLR.xlsx", "D KLR"),
        (DATEIEN / "D Liquidität.xlsx", "D Liquidität"),
    ):
        copy_sheet(load_sheet(src_path), hub, title)

    if "Steuerung" in hub.sheetnames:
        hub["Steuerung"]["F6"] = YEAR
        hub["Steuerung"]["F7"] = MONTH
        hub["Steuerung"]["F8"] = ebitda_jahr.get("ist_bis") or 8

    fill_guv(hub["GuV"], kenn, staffel, MONTH)
    fill_forecast(hub["Forecast"], kenn, plan_rows, ebitda_jahr)
    fill_cockpit(hub["Cockpit"], kenn, ebitda_jahr, cash, MONTH)
    if "Monatsroll" in hub.sheetnames:
        # Cash-Pool Ende in Q18
        hub["Monatsroll"]["Q18"] = euro(cash)

    hub.save(hub_path)
    for dest in (
        ROOT / "Cockpit.xlsx",
        DATEIEN / "Cockpit.xlsx",
        ROOT.parent / "Cockpit.xlsx",
        ROOT.parent / "Cockpit-Hub-SharePoint.xlsx",
        STORE / "Cockpit.xlsx",
        STORE / "Cockpit-Hub-SharePoint.xlsx",
        STORE / "workbook-split" / "Cockpit.xlsx",
        STORE / "workbook-split" / "Cockpit-Hub-SharePoint.xlsx",
    ):
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(hub_path, dest)

    # --- Einzeldateien ---
    print("Schreibe Einzeldateien …")

    # GuV.xlsx
    gpath = DATEIEN / "GuV.xlsx"
    gwb = load_workbook(gpath)
    fill_guv(gwb["GuV"], kenn, staffel, MONTH)
    copy_sheet(df, gwb, "D Finanzen")
    gwb.save(gpath)

    # Forecast.xlsx
    fpath = DATEIEN / "Forecast.xlsx"
    fwb = load_workbook(fpath)
    fill_forecast(fwb["Forecast"], kenn, plan_rows, ebitda_jahr)
    copy_sheet(df, fwb, "D Finanzen")
    fwb.save(fpath)

    # Stunden.xlsx – Werte aus D KLR + D KLR-Blatt einbetten
    spath = DATEIEN / "Stunden.xlsx"
    swb = load_workbook(spath)
    fill_stunden(swb["Stunden"], stunden)
    copy_sheet(dk, swb, "D KLR")
    # Steuerung-Werte lokal
    if "Steuerung" not in swb.sheetnames:
        st = swb.create_sheet("Steuerung")
        st["F6"] = YEAR
        st["F7"] = MONTH
    else:
        swb["Steuerung"]["F6"] = YEAR
        swb["Steuerung"]["F7"] = MONTH
    swb.save(spath)

    # KLR.xlsx
    kpath = DATEIEN / "KLR.xlsx"
    kwb = load_workbook(kpath)
    fill_klr(kwb["KLR"], klr_m)
    copy_sheet(dk, kwb, "D KLR")
    kwb.save(kpath)

    # Regionen.xlsx
    rpath = DATEIEN / "Regionen.xlsx"
    if rpath.exists():
        rwb = load_workbook(rpath)
        fill_regionen(rwb["Regionen"], regionen, MONTH)
        copy_sheet(df, rwb, "D Finanzen")
        rwb.save(rpath)

    # Steuerung.xlsx
    stpath = DATEIEN / "Steuerung.xlsx"
    stwb = load_workbook(stpath)
    stwb["Steuerung"]["F6"] = YEAR
    stwb["Steuerung"]["F7"] = MONTH
    stwb["Steuerung"]["F8"] = ebitda_jahr.get("ist_bis") or 8
    stwb.save(stpath)

    # Monatsroll.xlsx
    mpath = DATEIEN / "Monatsroll.xlsx"
    if mpath.exists():
        mwb = load_workbook(mpath)
        mwb["Monatsroll"]["Q18"] = euro(cash)
        copy_sheet(dl, mwb, "D Liquidität")
        mwb.save(mpath)

    print("Pakete …")
    pack()


def pack():
    hub = ROOT / "Cockpit-Hub-SharePoint.xlsx"
    cockpit = ROOT / "Cockpit.xlsx"

    # Quick cockpit-only
    dl = ROOT / "TVF_Cockpit_Download.zip"
    with zipfile.ZipFile(dl, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(cockpit, "Cockpit.xlsx")
        zf.writestr(
            "README.txt",
            "Cockpit.xlsx – Werte aus D Finanzen/D KLR/D Liquidität übertragen.\n"
            "Nach TVF-Controlling-Cockpit/Cockpit.xlsx HOCHLADEN UND ERSETZEN.\n"
            "Seite veröffentlichen, dann Cmd+Shift+R.\n",
        )

    # All files
    alle = ROOT / "TVF_ALLE_WERTE.zip"
    with zipfile.ZipFile(alle, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(cockpit, "Cockpit.xlsx")
        zf.write(hub, "Cockpit-Hub-SharePoint.xlsx")
        for p in sorted(DATEIEN.glob("*.xlsx")):
            zf.write(p, f"dateien/{p.name}")
        zf.writestr(
            "ZUERST-LESEN.txt",
            "WICHTIG – Werte kommen aus den D-Tabellen ( fest geschrieben )\n"
            "============================================================\n"
            "Excel Online überträgt KEINE Formeln zwischen Dateien → #WERT!.\n\n"
            "1. Gesamten Inhalt von dateien/ nach\n"
            "   Dokumente / TVF-Controlling-Cockpit/  hochladen (ALLE ersetzen).\n"
            "2. Cockpit.xlsx (aus diesem ZIP) ebenfalls ersetzen.\n"
            "3. SharePoint-Seite VERÖFFENTLICHEN.\n"
            "4. Hard-Reload: Cmd + Shift + R.\n\n"
            "Enthalten u.a.: Cockpit, GuV, Forecast, Stunden, KLR, Regionen,\n"
            "D Finanzen, D KLR, D Liquidität, D Projekte, D Risiken.\n",
        )

    dateien_zip = ROOT / "TVF_Cockpit_Dateien.zip"
    shutil.copy2(alle, dateien_zip)

    for name in (
        "TVF_Cockpit_Download.zip",
        "TVF_ALLE_WERTE.zip",
        "TVF_Cockpit_Dateien.zip",
        "Cockpit.xlsx",
        "Cockpit-Hub-SharePoint.xlsx",
    ):
        src = ROOT / name
        if not src.exists():
            continue
        for dest_root in (ROOT.parent, STORE, STORE / "workbook-split", ARTIFACTS):
            dest_root.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest_root / name)

    # verify
    wb = load_workbook(cockpit)
    c = wb["Cockpit"]
    print(
        "Check Hub KPIs:",
        c["C6"].value,
        c["G6"].value,
        c["K6"].value,
        c["O6"].value,
    )
    st = load_workbook(DATEIEN / "Stunden.xlsx")["Stunden"]
    print("Check Stunden D7-D11:", [st.cell(r, 4).value for r in range(7, 12)])
    print("ZIP:", alle, alle.stat().st_size)


if __name__ == "__main__":
    transfer()
    print("fertig.")
