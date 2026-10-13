"""Erzeugt die kaufmännische Baucontrolling-Excelmappe."""

from __future__ import annotations

import csv
from pathlib import Path

from openpyxl import Workbook
from openpyxl.workbook.properties import CalcProperties
from openpyxl.worksheet.worksheet import Worksheet

from baucontrolling import sample_data as sd
from baucontrolling.sheets_betrieb import add_all_betrieb
from baucontrolling.sheets_controlling import add_all_controlling
from baucontrolling.sheets_finanzen import add_all_finanzen
from baucontrolling.sheets_formulare import add_all_formulare
from baucontrolling.sheets_import import add_all_docs
from baucontrolling.sheets_projekte import add_all_projekte
from baucontrolling.sheets_stammdaten import add_all_stammdaten
from baucontrolling.styles import GOLD, GREEN, NAVY, STEEL, apply_workbook_defaults

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Baucontrolling_Kaufmann.xlsx"
TEMPLATE_DIR = ROOT / "templates"

TAB_COLORS = {
    "00_Navi": NAVY,
    "01_Stammdaten": NAVY,
    "02_Kunden": STEEL,
    "03_Lieferanten": STEEL,
    "04_Personal": STEEL,
    "05_Projekte": GOLD,
    "06_LV": GOLD,
    "07_Nachtraege": GOLD,
    "08_Angebote": GOLD,
    "09_Auftraege": GOLD,
    "10_Stunden": "5C4A1F",
    "11_Material": "5C4A1F",
    "12_Geraete": "5C4A1F",
    "13_Ausgangsrechnungen": GREEN,
    "14_Eingangsrechnungen": GREEN,
    "15_Zahlungen": GREEN,
    "16_OPOS": GREEN,
    "17_Mahnwesen": "8B2E2E",
    "18_Gewaehrleistung": GREEN,
    "19_Cashflow": "2C5282",
    "20_Liquiditaet": "2C5282",
    "21_Forecast": "2C5282",
    "22_BWA": "2C5282",
    "23_SollIst": "2C5282",
    "24_Dashboard": NAVY,
    "25_Form_Angebot": "4A5568",
    "26_Form_Rechnung": "4A5568",
    "27_Form_Abnahme": "4A5568",
    "28_Form_Bautage": "4A5568",
    "29_Form_Mahnung": "4A5568",
    "30_Import": "5C5C5C",
    "31_Anleitung": "5C5C5C",
}


def write_csv(path: Path, headers: list[str], rows: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.writer(fh, delimiter=";")
        writer.writerow(headers)
        for row in rows:
            out = []
            for value in row:
                if hasattr(value, "isoformat"):
                    out.append(value.isoformat())
                elif value is None:
                    out.append("")
                elif isinstance(value, bool):
                    out.append("JA" if value else "NEIN")
                else:
                    out.append(value)
            writer.writerow(out)


def export_templates() -> None:
    write_csv(
        TEMPLATE_DIR / "kunden.csv",
        ["Nr", "Name", "Typ", "Ansprechpartner", "Straße", "PLZ", "Ort", "Telefon", "E-Mail", "Zahlungsziel", "Skonto", "ABC", "Status", "Notiz"],
        sd.KUNDEN,
    )
    write_csv(
        TEMPLATE_DIR / "lieferanten.csv",
        ["Nr", "Name", "Art", "Ansprechpartner", "IBAN", "Skonto Tage", "Skonto %", "Zahlungsziel", "E-Mail", "Status", "Notiz"],
        sd.LIEFERANTEN,
    )
    write_csv(
        TEMPLATE_DIR / "personal.csv",
        ["Nr", "Name", "Funktion", "Kolonne", "Soll-h/Monat", "Verrechnung", "Kosten/h", "Eintritt", "Status", "Notiz"],
        sd.PERSONAL,
    )
    write_csv(
        TEMPLATE_DIR / "projekte.csv",
        [
            "Nr", "Name", "Kunde", "Art", "Vertrag", "Status", "Start", "Ende Plan", "Ende Ist",
            "Auftrag netto", "Budget Material", "Budget NU", "Budget Lohn", "Budget Gerät", "Budget GK",
            "Einbehalt %", "Bauleiter", "Polier", "Ort", "Notiz",
        ],
        sd.PROJEKTE,
    )
    write_csv(
        TEMPLATE_DIR / "stunden.csv",
        ["Nr", "Datum", "Projekt", "Mitarbeiter", "Stunden", "Gewerk", "Tätigkeit", "Verrechenbar"],
        sd.STUNDEN,
    )
    write_csv(
        TEMPLATE_DIR / "material.csv",
        ["Nr", "Datum", "Projekt", "Lieferant", "ER-Nr", "Bezeichnung", "ME", "Menge", "EP netto", "Kategorie", "Status"],
        sd.MATERIAL,
    )
    write_csv(
        TEMPLATE_DIR / "ausgangsrechnungen.csv",
        ["Nr", "Datum", "Projekt", "Kunde", "Typ", "Abschlag-Nr", "Netto", "Einbehalt %", "USt %", "Fällig", "Bezahlt am", "Status", "Text"],
        sd.AR,
    )
    write_csv(
        TEMPLATE_DIR / "eingangsrechnungen.csv",
        ["Nr", "Datum", "Projekt", "Lieferant", "Typ", "Netto", "USt %", "Fällig", "Bezahlt am", "Status", "Text"],
        sd.ER,
    )
    write_csv(
        TEMPLATE_DIR / "zahlungen.csv",
        ["Nr", "Datum", "Art", "Beleg", "Partner", "Betrag", "Weg", "Text"],
        sd.ZAHLUNGEN,
    )
    write_csv(
        TEMPLATE_DIR / "bankumsatz.csv",
        ["Buchungstag", "Valuta", "Betrag", "Partner", "Verwendungszweck", "Bank"],
        [
            ["2026-10-06", "2026-10-06", 185000.00, "Wohnbau Alpenland AG", "AR-26004 Wohnquartier Abschlag 4", "Sparkasse Freising"],
            ["2026-10-06", "2026-10-06", -26412.00, "Holz & Stahl Süd AG", "ER-5602 Stahlträger Halle", "Sparkasse Freising"],
            ["2026-10-07", "2026-10-07", -69110.00, "Personal", "Lohn Oktober Abschlag", "Sparkasse Freising"],
            ["2026-10-08", "2026-10-08", 0.00, "Kita Träger Freising e.V.", "AR-26006 Kita — noch offen / Test 0", "Sparkasse Freising"],
        ],
    )
    write_csv(
        TEMPLATE_DIR / "datev_buchungen.csv",
        ["Umsatz", "SollHaben", "Konto", "Gegenkonto", "Belegdatum", "Buchungstext", "Belegfeld1"],
        [
            [310000.00, "H", 8400, 14000, "2026-09-30", "Abschlag Wohnquartier 4", "AR-26004"],
            [26412.00, "S", 5000, 16000, "2026-09-02", "Stahlträger Halle", "ER-5602"],
            [69110.00, "S", 4100, 18000, "2026-09-30", "Löhne September", "LOHN-09"],
        ],
    )


def color_tabs(wb: Workbook) -> None:
    for ws in wb.worksheets:
        color = TAB_COLORS.get(ws.title)
        if color:
            ws.sheet_properties.tabColor = color


def protect_calc_hint(ws: Worksheet) -> None:
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def build() -> Path:
    export_templates()
    wb = Workbook()
    default = wb.active
    wb.remove(default)
    apply_workbook_defaults(wb)
    wb.calculation = CalcProperties(calcMode="auto", fullCalcOnLoad=True)

    add_all_stammdaten(wb)
    add_all_projekte(wb)
    add_all_betrieb(wb)
    add_all_finanzen(wb)
    add_all_controlling(wb)
    add_all_formulare(wb)
    add_all_docs(wb)
    color_tabs(wb)

    wb.properties.title = "Kaufmännisches Baucontrolling"
    wb.properties.creator = "Bergmann Hoch- und Tiefbau GmbH"
    wb.properties.subject = "KPI, Liquidität, Forecast, Projekte, Formulare, Import"
    wb.properties.description = (
        "Steuerungsmappe für das Baugewerbe: Dashboard, Cashflow, 13-Wochen-Liquidität, "
        "BWA, Soll-Ist, VOB-Formulare und CSV/DATEV-Import."
    )

    # Dashboard nach vorne, Navi als zweites
    order = [
        "24_Dashboard",
        "00_Navi",
        "01_Stammdaten",
        "05_Projekte",
        "23_SollIst",
        "20_Liquiditaet",
        "19_Cashflow",
        "21_Forecast",
        "22_BWA",
        "16_OPOS",
        "13_Ausgangsrechnungen",
        "14_Eingangsrechnungen",
        "15_Zahlungen",
        "17_Mahnwesen",
        "18_Gewaehrleistung",
        "08_Angebote",
        "09_Auftraege",
        "07_Nachtraege",
        "06_LV",
        "10_Stunden",
        "11_Material",
        "12_Geraete",
        "02_Kunden",
        "03_Lieferanten",
        "04_Personal",
        "25_Form_Angebot",
        "26_Form_Rechnung",
        "27_Form_Abnahme",
        "28_Form_Bautage",
        "29_Form_Mahnung",
        "30_Import",
        "31_Anleitung",
    ]
    for idx, name in enumerate(order):
        wb.move_sheet(name, offset=idx - wb.sheetnames.index(name))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)
    return OUT


if __name__ == "__main__":
    path = build()
    print(f"geschrieben: {path} ({path.stat().st_size / 1024:.0f} KB)")
