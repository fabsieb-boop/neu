#!/usr/bin/env python3
"""Eine Excel-Projektakte je Projekt: Forecast, Kosten, Rechnungen, SAP-Infos."""
from __future__ import annotations

import re
import zipfile
from collections import defaultdict
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "projektakten"
D_PROJEKTE = ROOT / "dateien" / "D Projekte.xlsx"
KV_XLSX = ROOT / "dateien" / "Kostenverfolgung.xlsx"
DB_SQL = ROOT / "db" / "database.sql"
INDEX_NAME = "00_Projektakten_Uebersicht.xlsx"

HDR = Font(bold=True, color="FFFFFF")
HDR_FILL = PatternFill("solid", fgColor="1F4E79")
TITLE = Font(bold=True, size=14, color="1F4E79")
MONEY = '#,##0.00'
THIN = Border(
    left=Side(style="thin", color="D0D7DE"),
    right=Side(style="thin", color="D0D7DE"),
    top=Side(style="thin", color="D0D7DE"),
    bottom=Side(style="thin", color="D0D7DE"),
)


def style_header(ws, row: int, cols: int):
    for c in range(1, cols + 1):
        cell = ws.cell(row, c)
        cell.font = HDR
        cell.fill = HDR_FILL
        cell.alignment = Alignment(wrap_text=True)


def autosize(ws, max_width=40):
    for col in ws.columns:
        letter = get_column_letter(col[0].column)
        width = 10
        for cell in col[:80]:
            if cell.value is not None:
                width = min(max_width, max(width, len(str(cell.value)) + 2))
        ws.column_dimensions[letter].width = width


def safe_name(nr: str, name: str) -> str:
    base = f"{nr}_{name or 'Projekt'}"
    base = re.sub(r"[^\w\-äöüÄÖÜß]+", "_", base, flags=re.U)
    return base[:80].strip("_")


def load_d_projekte():
    wb = load_workbook(D_PROJEKTE, data_only=True, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    # locate sections by marker in col A
    def find_marker(text):
        for i, r in enumerate(rows):
            if r and r[0] == text:
                return i
        return None

    i_db = find_marker("v_projekt_db")
    i_prj = find_marker("projekte")
    i_std = find_marker("v_stunden_projekt")
    i_sap = find_marker("sap_projekt_kostenart")

    def table_after(marker_idx, stop_markers):
        if marker_idx is None:
            return [], []
        hdr = list(rows[marker_idx + 1])
        # trim trailing Nones in header
        while hdr and hdr[-1] is None:
            hdr.pop()
        data = []
        for r in rows[marker_idx + 2 :]:
            if not r or all(x is None for x in r):
                # allow blank within? stop on new section marker
                if r and r[0] in stop_markers:
                    break
                continue
            if r[0] in stop_markers:
                break
            # new named section
            if isinstance(r[0], str) and r[0] and not str(r[0]).replace(".", "").replace("-", "").isdigit() and r[1] is None and marker_idx:
                # could be next section name
                if r[0] in stop_markers or (len(str(r[0])) < 40 and "_" in str(r[0]) and r[2] is None):
                    # heuristic: section titles like v_* or plain names without many cols
                    nonnull = sum(1 for x in r if x is not None)
                    if nonnull <= 2:
                        break
            data.append(r)
        return hdr, data

    stop = {
        "v_projekt_db", "projekte", "v_stunden_projekt", "sap_projekt_kostenart",
        "v_projekt_monat", "forecast", "risiken",
    }

    hdr_db, data_db = table_after(i_db, stop - {"v_projekt_db"})
    hdr_prj, data_prj = table_after(i_prj, stop - {"projekte"})
    hdr_std, data_std = table_after(i_std, stop - {"v_stunden_projekt"})
    hdr_sap, data_sap = table_after(i_sap, stop - {"sap_projekt_kostenart"})

    def as_dicts(hdr, data):
        keys = [str(h) if h is not None else f"c{i}" for i, h in enumerate(hdr)]
        out = []
        for r in data:
            d = {}
            for i, k in enumerate(keys):
                d[k] = r[i] if i < len(r) else None
            out.append(d)
        return out

    return {
        "db": as_dicts(hdr_db, data_db),
        "stamm": as_dicts(hdr_prj, data_prj),
        "stunden": as_dicts(hdr_std, data_std),
        "sap_ka": as_dicts(hdr_sap, data_sap),
    }


def load_kv():
    if not KV_XLSX.exists():
        return []
    wb = load_workbook(KV_XLSX, data_only=True, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=6, values_only=True))
    wb.close()
    # C=PSP D=Auftrag E=Region F=Titel G=Stand H=UmsatzKV I=UmsatzSAP K=KostenKV L=KostenSAP N=ErgebnisKV?
    out = []
    for r in rows[1:]:
        if not r or r[3] is None:
            continue
        out.append({
            "psp": r[2],
            "auftrag": str(r[3]).strip(),
            "region": r[4],
            "titel": r[5],
            "stand": r[6],
            "umsatz_kv": r[7],
            "umsatz_sap": r[8],
            "kosten_kv": r[10],
            "kosten_sap": r[11],
            "ergebnis_kv": r[13] if len(r) > 13 else None,
        })
    return out


def load_buchungen_by_auftrag():
    """Stream database.sql buchungen → per auftrag lists & aggregates."""
    if not DB_SQL.exists():
        return {}, {}
    re_buch = re.compile(
        r"INSERT INTO controlling\.buchungen\s*\([^)]+\)\s*VALUES\s*\("
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"([0-9.]+|NULL)\s*,\s*"
        r"([0-9.]+|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"('(?:[^']|'')*'|NULL)\s*,\s*"
        r"([0-9.]+|NULL)\s*,\s*"
        r"(-?[0-9.]+|NULL)\s*,",
    )

    def unq(s):
        if s is None or s == "NULL":
            return None
        if s.startswith("'"):
            return s[1:-1].replace("''", "'")
        return s

    by_auftrag = defaultdict(list)
    n = 0
    with DB_SQL.open(encoding="utf-8", errors="replace") as f:
        for line in f:
            if "INSERT INTO controlling.buchungen" not in line:
                continue
            m = re_buch.search(line)
            if not m:
                continue
            auftrag = unq(m.group(1)) or ""
            objekt = unq(m.group(2))
            periode = None if m.group(3) == "NULL" else int(float(m.group(3)))
            jahr = None if m.group(4) == "NULL" else int(float(m.group(4)))
            kostenart = unq(m.group(7))
            belegart = unq(m.group(8))
            belegnummer = unq(m.group(9))
            buchungsdatum = unq(m.group(10))
            wert = None if m.group(13) == "NULL" else float(m.group(13))
            if not auftrag or wert is None:
                continue
            # classify
            ka = (kostenart or "").split(".")[0]
            is_erloes = ka.startswith("8") or belegart in ("DB", "DG", "DR")
            is_rechnung = belegart in ("DB", "DG", "DR", "RD", "RV") or is_erloes
            rec = {
                "auftrag": auftrag,
                "objekt": objekt,
                "periode": periode,
                "jahr": jahr,
                "kostenart": kostenart,
                "belegart": belegart,
                "belegnummer": belegnummer,
                "buchungsdatum": buchungsdatum,
                "wert": wert,
                "ist_rechnung": is_rechnung,
                "ist_erloes": is_erloes,
            }
            by_auftrag[auftrag].append(rec)
            n += 1
            # keep detail capped later when writing
    print(f"  buchungen geladen: {n} Zeilen, {len(by_auftrag)} Aufträge")
    return by_auftrag


def write_sheet_table(ws, title, headers, rows, start_row=1):
    ws.cell(start_row, 1, title).font = TITLE
    hr = start_row + 2
    for j, h in enumerate(headers, 1):
        ws.cell(hr, j, h)
    style_header(ws, hr, len(headers))
    for i, row in enumerate(rows, hr + 1):
        for j, v in enumerate(row, 1):
            cell = ws.cell(i, j, v)
            cell.border = THIN
            if isinstance(v, float):
                cell.number_format = MONEY
    autosize(ws)
    return hr + 1 + len(rows)


def build_one(projekt, dbrow, stunden, sap_ka, kv_rows, buchungen, out_path: Path):
    nr = str(projekt.get("projekt_nr") or "")
    name = str(projekt.get("projektname") or "")
    wb = Workbook()

    # --- Übersicht ---
    ws = wb.active
    ws.title = "Uebersicht"
    ws["A1"] = "TVF ALTWERT – Projektakte"
    ws["A1"].font = TITLE
    ws["A2"] = "Werte aus SAP-/Controlling-Export (D Projekte, Kostenverfolgung, Buchungen)"
    meta = [
        ("Projekt-Nr.", nr),
        ("Projektname", name),
        ("Projektart", projekt.get("projektart")),
        ("Status", projekt.get("status")),
        ("Region", projekt.get("region")),
        ("Regionscode", projekt.get("regionscode")),
        ("Hauptprojekt", projekt.get("hauptprojekt_nr")),
        ("Startdatum", projekt.get("startdatum")),
        ("Enddatum", projekt.get("enddatum")),
        ("Budget Umsatz", projekt.get("budget_umsatz")),
        ("Budget Kosten", projekt.get("budget_kosten")),
        ("Anteil Umsatz (Stamm)", projekt.get("anteil_umsatz")),
    ]
    for i, (k, v) in enumerate(meta, start=4):
        ws.cell(i, 1, k).font = Font(bold=True)
        cell = ws.cell(i, 2, v)
        if isinstance(v, (int, float)) and k.startswith("Budget"):
            cell.number_format = MONEY

    r0 = 18
    ws.cell(r0, 1, "Kennzahlen Geschäftsjahr (SAP/KLR)").font = TITLE
    kpis = [
        ("Jahr", dbrow.get("jahr") if dbrow else 2026),
        ("Leistung / Umsatz SAP", dbrow.get("leistung") if dbrow else None),
        ("Variable Kosten", dbrow.get("variable_kosten") if dbrow else None),
        ("Fixe Projektkosten", dbrow.get("fixe_projektkosten") if dbrow else None),
        ("Verrechnete Gemeinkosten", dbrow.get("verrechnete_gk") if dbrow else None),
        ("Neutral", dbrow.get("neutral") if dbrow else None),
        ("DB1", dbrow.get("db1") if dbrow else None),
        ("DB2", dbrow.get("db2") if dbrow else None),
        ("DB3", dbrow.get("db3") if dbrow else None),
        ("Umlage Zentrale", dbrow.get("umlage_zentrale") if dbrow else None),
        ("DB4", dbrow.get("db4") if dbrow else None),
        ("DB1-Marge %", dbrow.get("db1_marge") if dbrow else None),
        ("Belege", dbrow.get("belege") if dbrow else None),
        ("Erste Buchung", dbrow.get("erste_buchung") if dbrow else None),
        ("Letzte Buchung", dbrow.get("letzte_buchung") if dbrow else None),
    ]
    ws.cell(r0 + 1, 1, "Kennzahl").font = HDR
    ws.cell(r0 + 1, 1).fill = HDR_FILL
    ws.cell(r0 + 1, 2, "Wert").font = HDR
    ws.cell(r0 + 1, 2).fill = HDR_FILL
    for i, (k, v) in enumerate(kpis, start=r0 + 2):
        ws.cell(i, 1, k)
        cell = ws.cell(i, 2, v)
        if isinstance(v, float) and "Marge" not in k:
            cell.number_format = MONEY

    # KV block
    r1 = r0 + 2 + len(kpis) + 2
    ws.cell(r1, 1, "Kostenverfolgung vs SAP").font = TITLE
    headers = ["PSP", "Stand", "Umsatz KV", "Umsatz SAP", "Δ Umsatz", "Kosten KV", "Kosten SAP", "Δ Kosten", "Ergebnis KV", "Titel KV"]
    for j, h in enumerate(headers, 1):
        ws.cell(r1 + 1, j, h)
    style_header(ws, r1 + 1, len(headers))
    for i, kv in enumerate(kv_rows, r1 + 2):
        du = None
        dk = None
        if kv.get("umsatz_kv") is not None and kv.get("umsatz_sap") is not None:
            try:
                du = float(kv["umsatz_kv"]) - float(kv["umsatz_sap"])
            except (TypeError, ValueError):
                pass
        if kv.get("kosten_kv") is not None and kv.get("kosten_sap") is not None:
            try:
                dk = float(kv["kosten_kv"]) - float(kv["kosten_sap"])
            except (TypeError, ValueError):
                pass
        vals = [
            kv.get("psp"), kv.get("stand"), kv.get("umsatz_kv"), kv.get("umsatz_sap"), du,
            kv.get("kosten_kv"), kv.get("kosten_sap"), dk, kv.get("ergebnis_kv"), kv.get("titel"),
        ]
        for j, v in enumerate(vals, 1):
            cell = ws.cell(i, j, v)
            if isinstance(v, float):
                cell.number_format = MONEY
    autosize(ws)

    # --- Forecast / Monat ---
    ws = wb.create_sheet("Forecast_Monat")
    # aggregate sap_ka and stunden by month; add FC placeholder cols
    mon_kosten = defaultdict(float)
    mon_belege = defaultdict(int)
    for r in sap_ka:
        m = r.get("monat")
        if m is None:
            continue
        try:
            m = int(float(m))
        except (TypeError, ValueError):
            continue
        try:
            mon_kosten[m] += float(r.get("wert") or 0)
        except (TypeError, ValueError):
            pass
        try:
            mon_belege[m] += int(float(r.get("belege") or 0))
        except (TypeError, ValueError):
            pass
    mon_std = defaultdict(float)
    mon_tage = defaultdict(float)
    for r in stunden:
        m = r.get("monat")
        if m is None:
            continue
        try:
            m = int(float(m))
        except (TypeError, ValueError):
            continue
        try:
            mon_std[m] += float(r.get("stunden") or 0)
        except (TypeError, ValueError):
            pass
        try:
            mon_tage[m] += float(r.get("tage") or 0)
        except (TypeError, ValueError):
            pass

    # rechnungen / erlöse / kosten from buchungen by periode
    mon_erloes = defaultdict(float)
    mon_kosten_b = defaultdict(float)
    mon_rechnung = defaultdict(float)
    for b in buchungen:
        p = b.get("periode")
        if p is None:
            continue
        if b.get("ist_erloes"):
            mon_erloes[p] += b["wert"]
            if b.get("ist_rechnung"):
                mon_rechnung[p] += b["wert"]
        else:
            mon_kosten_b[p] += b["wert"]

    ws["A1"] = "Monatswerte SAP / Forecast-Gerüst"
    ws["A1"].font = TITLE
    ws["A2"] = "Ist aus SAP-Buchungen & Kostenarten. Forecast-Spalten für Eingabe (Sep–Dez bzw. Restjahr)."
    headers = [
        "Monat", "SAP Kostenarten-Saldo", "Stunden", "Tage",
        "Erlöse/Leistung (Buchungen)", "Kosten (Buchungen)", "Rechnungsbeträge",
        "Forecast Umsatz", "Forecast Kosten", "Forecast Bestand", "Kommentar FC",
    ]
    for j, h in enumerate(headers, 1):
        ws.cell(4, j, h)
    style_header(ws, 4, len(headers))
    for m in range(1, 13):
        row = [
            m,
            mon_kosten.get(m),
            mon_std.get(m),
            mon_tage.get(m),
            mon_erloes.get(m),
            mon_kosten_b.get(m),
            mon_rechnung.get(m),
            None, None, None, None,
        ]
        for j, v in enumerate(row, 1):
            cell = ws.cell(4 + m, j, v)
            cell.border = THIN
            if isinstance(v, float):
                cell.number_format = MONEY
    # totals
    tr = 18
    ws.cell(tr, 1, "Summe Ist").font = Font(bold=True)
    for col in range(2, 8):
        cell = ws.cell(tr, col, f"=SUM({get_column_letter(col)}5:{get_column_letter(col)}16)")
        cell.font = Font(bold=True)
        cell.number_format = MONEY
    autosize(ws)

    # --- Kostenarten ---
    ws = wb.create_sheet("Kostenarten_SAP")
    rows = []
    for r in sorted(sap_ka, key=lambda x: (x.get("monat") or 0, str(x.get("kostenart") or ""))):
        rows.append([
            r.get("monat"), r.get("kostenart"), r.get("bez"), r.get("gruppe"),
            r.get("klr_typ"), r.get("block"), r.get("wert"), r.get("belege"),
        ])
    write_sheet_table(
        ws, "SAP Kostenarten je Monat",
        ["Monat", "Kostenart", "Bezeichnung", "GuV-Gruppe", "KLR-Typ", "Block", "Wert", "Belege"],
        rows,
    )

    # --- Rechnungen ---
    ws = wb.create_sheet("Rechnungen")
    rechnungen = [b for b in buchungen if b.get("ist_rechnung") or b.get("ist_erloes")]
    rechnungen.sort(key=lambda x: (x.get("periode") or 0, x.get("buchungsdatum") or ""))
    rows = [[
        b.get("periode"), b.get("buchungsdatum"), b.get("belegart"), b.get("belegnummer"),
        b.get("kostenart"), b.get("wert"), b.get("objekt"),
    ] for b in rechnungen[:5000]]
    write_sheet_table(
        ws, "Rechnungs-/Erlösbuchungen aus SAP (Belegarten DB/Erlöskonten 8*)",
        ["Periode", "Buchungsdatum", "Belegart", "Belegnummer", "Kostenart", "Betrag", "Objekt"],
        rows,
    )
    # sum
    if rows:
        last = 5 + len(rows)
        ws.cell(last, 5, "Summe Betrag").font = Font(bold=True)
        ws.cell(last, 6, f"=SUM(F5:F{last-1})").number_format = MONEY

    # --- Alle Buchungen (gekürzt) ---
    ws = wb.create_sheet("Buchungen_SAP")
    detail = sorted(buchungen, key=lambda x: (x.get("periode") or 0, x.get("buchungsdatum") or ""))
    # if too many, keep summary note
    max_rows = 3000
    note = ""
    if len(detail) > max_rows:
        note = f"Hinweis: {len(detail)} Buchungen gesamt – erste {max_rows} exportiert."
        detail = detail[:max_rows]
    rows = [[
        b.get("jahr"), b.get("periode"), b.get("buchungsdatum"), b.get("belegart"),
        b.get("belegnummer"), b.get("kostenart"), b.get("wert"), b.get("objekt"),
    ] for b in detail]
    end = write_sheet_table(
        ws, "SAP-Buchungen (Export)",
        ["Jahr", "Periode", "Buchungsdatum", "Belegart", "Belegnummer", "Kostenart", "Wert", "Objekt"],
        rows,
    )
    if note:
        ws.cell(end + 2, 1, note)

    # --- Stunden ---
    ws = wb.create_sheet("Stunden")
    rows = [[
        r.get("jahr"), r.get("monat"), r.get("stunden"), r.get("mitarbeiter"), r.get("tage"), r.get("region"),
    ] for r in sorted(stunden, key=lambda x: (x.get("monat") or 0))]
    write_sheet_table(
        ws, "Projektstunden",
        ["Jahr", "Monat", "Stunden", "Mitarbeiter", "Tage", "Region"],
        rows,
    )

    wb.save(out_path)
    wb.close()


def main():
    print("Lade D Projekte …")
    data = load_d_projekte()
    print(f"  stamm={len(data['stamm'])} db={len(data['db'])} stunden={len(data['stunden'])} sap_ka={len(data['sap_ka'])}")
    print("Lade Kostenverfolgung …")
    kv_all = load_kv()
    print(f"  kv={len(kv_all)}")
    print("Lade Buchungen aus database.sql …")
    buch_by = load_buchungen_by_auftrag()

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.xlsx"):
        old.unlink()

    # index maps
    db_by_nr = {str(r.get("projekt_nr")): r for r in data["db"] if r.get("projekt_nr")}
    stunden_by = defaultdict(list)
    for r in data["stunden"]:
        stunden_by[str(r.get("projekt_nr"))].append(r)
    sap_by = defaultdict(list)
    for r in data["sap_ka"]:
        sap_by[str(r.get("auftrag"))].append(r)
    kv_by = defaultdict(list)
    for r in kv_all:
        kv_by[r["auftrag"]].append(r)

    # union of project numbers
    nrs = set()
    for r in data["stamm"]:
        if r.get("projekt_nr"):
            nrs.add(str(r["projekt_nr"]))
    for r in data["db"]:
        if r.get("projekt_nr"):
            nrs.add(str(r["projekt_nr"]))
    for k in buch_by:
        if k.startswith("P") or k.startswith("W"):
            nrs.add(k)

    stamm_by = {str(r.get("projekt_nr")): r for r in data["stamm"] if r.get("projekt_nr")}

    index_rows = []
    created = 0
    for nr in sorted(nrs):
        stamm = stamm_by.get(nr) or {
            "projekt_nr": nr,
            "projektname": (db_by_nr.get(nr) or {}).get("projektname")
            or (buch_by.get(nr, [{}])[0].get("objekt") if buch_by.get(nr) else nr),
            "region": (db_by_nr.get(nr) or {}).get("region"),
            "status": "AKTIV",
        }
        name = stamm.get("projektname") or nr
        fname = f"Projekt_{safe_name(nr, name)}.xlsx"
        path = OUT / fname
        build_one(
            stamm,
            db_by_nr.get(nr),
            stunden_by.get(nr, []),
            sap_by.get(nr, []),
            kv_by.get(nr, []),
            buch_by.get(nr, []),
            path,
        )
        created += 1
        db = db_by_nr.get(nr) or {}
        index_rows.append([
            nr, name, stamm.get("region"), stamm.get("status"),
            db.get("leistung"), db.get("variable_kosten"), db.get("db4"),
            len(buch_by.get(nr, [])), fname,
        ])
        if created % 25 == 0:
            print(f"  … {created} Projektakten")

    # Übersicht
    wb = Workbook()
    ws = wb.active
    ws.title = "Uebersicht"
    ws["A1"] = "TVF ALTWERT – Projektakten Index"
    ws["A1"].font = TITLE
    ws["A2"] = f"{created} Einzeldateien im Ordner projektakten/ – je Projekt Forecast, Kosten, Rechnungen, SAP"
    headers = [
        "Projekt-Nr.", "Name", "Region", "Status", "Leistung SAP", "Var. Kosten", "DB4",
        "Buchungen", "Datei",
    ]
    for j, h in enumerate(headers, 1):
        ws.cell(4, j, h)
    style_header(ws, 4, len(headers))
    for i, row in enumerate(sorted(index_rows, key=lambda x: x[0]), 5):
        for j, v in enumerate(row, 1):
            cell = ws.cell(i, j, v)
            if isinstance(v, float):
                cell.number_format = MONEY
    autosize(ws)
    wb.save(OUT / INDEX_NAME)
    wb.close()

    # README
    (OUT / "README.md").write_text(
        f"""# Projektakten (eine Excel je Projekt)

Erzeugt aus `D Projekte.xlsx`, `Kostenverfolgung.xlsx` und `db/database.sql` (SAP-Buchungen).

## Inhalt je Datei
- **Uebersicht** – Stamm, DB1–DB4, Leistung, Kosten, KV vs SAP
- **Forecast_Monat** – Ist je Monat + leere Forecast-Spalten (Umsatz/Kosten/Bestand)
- **Kostenarten_SAP** – Kostenarten × Monat
- **Rechnungen** – Erlöse/Rechnungsbelege
- **Buchungen_SAP** – Belegjournal (Ausschnitt)
- **Stunden** – Projektstunden

## Anzahl
{created} Projekte + `{INDEX_NAME}`

ZIP: `TVF_Projektakten.zip` im übergeordneten Ordner.
""",
        encoding="utf-8",
    )

    zip_path = ROOT / "TVF_Projektakten.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(OUT.iterdir()):
            if f.is_file():
                zf.write(f, arcname=f"projektakten/{f.name}")
    print(f"OK: {created} Dateien → {OUT}")
    print(f"ZIP: {zip_path} ({zip_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
