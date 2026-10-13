"""Dashboard, Cashflow, Liquidität, Forecast, BWA, Soll-Ist."""

from datetime import date, timedelta

from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.chart.series import SeriesLabel
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter
from openpyxl.workbook.workbook import Workbook
from openpyxl.worksheet.worksheet import Worksheet

from baucontrolling import sample_data as sd
from baucontrolling.layout import new_sheet, write_headers
from baucontrolling.styles import (
    ALIGN_C,
    ALIGN_L,
    FILL_AMBER_SOFT,
    FILL_NAVY,
    FONT_BODY,
    FONT_H3,
    FONT_HEAD,
    FONT_WHITE,
    header_bar,
    kpi_box,
    paint_sheet,
    section_label as section_label_safe,
    set_widths,
    style_calc,
    style_header_row,
    style_input,
)


def add_cashflow(wb: Workbook) -> None:
    ws = new_sheet(
        wb,
        "19_Cashflow",
        "Cashflow-Rechnung",
        "Operativer, investiver und finanzieller Cashflow aus Zahlungen — Monatsscheiben für das Geschäftsjahr",
        15,
        {i: 14 for i in range(1, 16)} | {1: 36},
    )
    ws["A4"] = "Position"
    ws["A4"].font = FONT_WHITE
    ws["A4"].fill = FILL_NAVY
    for i, m in enumerate(sd.MONATE, start=2):
        cell = ws.cell(4, i, m)
        cell.font = FONT_HEAD
        cell.fill = FILL_NAVY
        cell.alignment = ALIGN_C
    ws.cell(4, 14, "GJ " + str(sd.FIRMA["gj"])).font = FONT_HEAD
    ws.cell(4, 14).fill = FILL_NAVY
    rows = [
        (5, "Einzahlungen Kunden", 'Eingang', 'AR'),
        (6, "sonstige Einzahlungen", 'Eingang', 'SONST'),
        (7, "Auszahlungen Lieferanten / NU", 'Ausgang', 'ER'),
        (8, "Löhne / Gehälter", 'Ausgang', 'Personal'),
        (9, "Steuern / SV / Soka", 'Ausgang', 'Steuer'),
        (10, "sonstige Auszahlungen", 'Ausgang', 'SONST_OUT'),
    ]
    # We'll use SUMIFS on payments: month + art + partner contains
    for row, label, art, kind in rows:
        ws.cell(row, 1, label).font = FONT_BODY
        for m in range(1, 13):
            col = m + 1
            if kind == "AR":
                f = f'=SUMIFS(\'15_Zahlungen\'!$F:$F,\'15_Zahlungen\'!$C:$C,"Eingang",\'15_Zahlungen\'!$I:$I,{m},\'15_Zahlungen\'!$J:$J,GJ)'
            elif kind == "SONST":
                f = f'=SUMIFS(\'15_Zahlungen\'!$F:$F,\'15_Zahlungen\'!$C:$C,"Eingang",\'15_Zahlungen\'!$I:$I,{m},\'15_Zahlungen\'!$J:$J,GJ)-B{row-1}' if False else (
                    f'=MAX(0,SUMIFS(\'15_Zahlungen\'!$F:$F,\'15_Zahlungen\'!$C:$C,"Eingang",\'15_Zahlungen\'!$I:$I,{m},\'15_Zahlungen\'!$J:$J,GJ)'
                    f'-SUMIFS(\'15_Zahlungen\'!$F:$F,\'15_Zahlungen\'!$C:$C,"Eingang",\'15_Zahlungen\'!$I:$I,{m},\'15_Zahlungen\'!$J:$J,GJ,\'15_Zahlungen\'!$D:$D,"<>"))'
                )
                # simpler: all incoming already in row 5; row 6 = 0 unless partner blank... skip complexity
                f = f'=SUMIFS(\'15_Zahlungen\'!$F:$F,\'15_Zahlungen\'!$C:$C,"Eingang",\'15_Zahlungen\'!$I:$I,{m},\'15_Zahlungen\'!$J:$J,GJ,\'15_Zahlungen\'!$D:$D,"")'
            elif kind == "ER":
                f = (
                    f'=SUMIFS(\'15_Zahlungen\'!$F:$F,\'15_Zahlungen\'!$C:$C,"Ausgang",\'15_Zahlungen\'!$I:$I,{m},\'15_Zahlungen\'!$J:$J,GJ)'
                    f'-SUMIFS(\'15_Zahlungen\'!$F:$F,\'15_Zahlungen\'!$C:$C,"Ausgang",\'15_Zahlungen\'!$I:$I,{m},\'15_Zahlungen\'!$J:$J,GJ,\'15_Zahlungen\'!$E:$E,"Personal")'
                    f'-SUMIFS(\'15_Zahlungen\'!$F:$F,\'15_Zahlungen\'!$C:$C,"Ausgang",\'15_Zahlungen\'!$I:$I,{m},\'15_Zahlungen\'!$J:$J,GJ,\'15_Zahlungen\'!$E:$E,"Finanzamt")'
                    f'-SUMIFS(\'15_Zahlungen\'!$F:$F,\'15_Zahlungen\'!$C:$C,"Ausgang",\'15_Zahlungen\'!$I:$I,{m},\'15_Zahlungen\'!$J:$J,GJ,\'15_Zahlungen\'!$E:$E,"Sozialkasse")'
                )
            elif kind == "Personal":
                f = f'=SUMIFS(\'15_Zahlungen\'!$F:$F,\'15_Zahlungen\'!$C:$C,"Ausgang",\'15_Zahlungen\'!$I:$I,{m},\'15_Zahlungen\'!$J:$J,GJ,\'15_Zahlungen\'!$E:$E,"Personal")'
            elif kind == "Steuer":
                f = (
                    f'=SUMIFS(\'15_Zahlungen\'!$F:$F,\'15_Zahlungen\'!$C:$C,"Ausgang",\'15_Zahlungen\'!$I:$I,{m},\'15_Zahlungen\'!$J:$J,GJ,\'15_Zahlungen\'!$E:$E,"Finanzamt")'
                    f'+SUMIFS(\'15_Zahlungen\'!$F:$F,\'15_Zahlungen\'!$C:$C,"Ausgang",\'15_Zahlungen\'!$I:$I,{m},\'15_Zahlungen\'!$J:$J,GJ,\'15_Zahlungen\'!$E:$E,"Sozialkasse")'
                )
            else:
                f = "0"
            cell = ws.cell(row, col, f)
            style_calc(cell, "eur")
        ws.cell(row, 14, f"=SUM(B{row}:M{row})")
        style_calc(ws.cell(row, 14), "eur")

    ws["A12"] = "Cashflow operativ"
    ws["A12"].font = FONT_H3
    for col in range(2, 15):
        letter = get_column_letter(col)
        ws.cell(12, col, f"={letter}5+{letter}6-{letter}7-{letter}8-{letter}9-{letter}10")
        style_calc(ws.cell(12, col), "eur")
        ws.cell(12, col).fill = FILL_AMBER_SOFT

    ws["A14"] = "Investitionen Geräte (manuell)"
    ws["A15"] = "Kreditaufnahme / Tilgung (manuell)"
    ws["A16"] = "Cashflow gesamt"
    ws["A16"].font = FONT_H3
    for col in range(2, 14):
        style_input(ws.cell(14, col), "eur")
        style_input(ws.cell(15, col), "eur")
        letter = get_column_letter(col)
        ws.cell(16, col, f"={letter}12-{letter}14+{letter}15")
        style_calc(ws.cell(16, col), "eur")
    ws.cell(14, 14, "=SUM(B14:M14)")
    ws.cell(15, 14, "=SUM(B15:M15)")
    ws.cell(16, 14, "=SUM(B16:M16)")
    style_calc(ws.cell(14, 14), "eur")
    style_calc(ws.cell(15, 14), "eur")
    style_calc(ws.cell(16, 14), "eur")

    ws["A18"] = "Endbestand Bank (kumuliert aus Anfangsbestand)"
    ws["B18"] = "=AnfangsBank+B16"
    style_calc(ws.cell(18, 2), "eur")
    for col in range(3, 15):
        prev = get_column_letter(col - 1)
        letter = get_column_letter(col)
        if col == 14:
            ws.cell(18, col, "=M18")
        else:
            ws.cell(18, col, f"={prev}18+{letter}16")
        style_calc(ws.cell(18, col), "eur")
    ws.freeze_panes = "B5"


def add_liquiditaet(wb: Workbook) -> None:
    start = date(2026, 10, 6)
    weeks = [start + timedelta(days=7 * i) for i in range(13)]
    ws = new_sheet(
        wb,
        "20_Liquiditaet",
        "Liquiditätsplanung 13 Wochen + 12 Monate",
        "Gelbe Zellen = Disposition ( savis, bekannte Zahlungen, Lohnlauf ). Ampel gegen Mindestliquidität aus den Stammdaten.",
        16,
        {1: 34} | {i: 12 for i in range(2, 17)},
    )
    section_label_safe(ws, 4, 1, "13-Wochen-Liquidität (rollierend)", 14)
    ws["A5"] = "Woche ab"
    ws["A5"].font = FONT_WHITE
    ws["A5"].fill = FILL_NAVY
    for i, d in enumerate(weeks, start=2):
        cell = ws.cell(5, i, d)
        cell.number_format = "DD.MM."
        cell.font = FONT_HEAD
        cell.fill = FILL_NAVY
        cell.alignment = ALIGN_C

    plan_rows = [
        (6, "Einzahlungen Kunden erwartet", sd.LIQ_WOCHEN_IN, True),
        (7, "Löhne / Soka / SV", sd.LIQ_WOCHEN_OUT_LOHN, True),
        (8, "Nachunternehmer / Kreditoren", sd.LIQ_WOCHEN_OUT_NU, True),
        (9, "Material / Baustoffe", sd.LIQ_WOCHEN_OUT_MAT, True),
        (10, "Steuer / USt", sd.LIQ_WOCHEN_OUT_STEUER, True),
        (11, "Miete, Leasing, Sonstiges", sd.LIQ_WOCHEN_OUT_SONST, True),
    ]
    for row, label, values, _ in plan_rows:
        ws.cell(row, 1, label).font = FONT_BODY
        for i, val in enumerate(values, start=2):
            ws.cell(row, i, val)
            style_input(ws.cell(row, i), "eur")
        ws.cell(row, 15, f"=SUM(B{row}:N{row})")
        style_calc(ws.cell(row, 15), "eur")

    ws["A13"] = "Anfangsbestand"
    ws["B13"] = "=AnfangsBank+N18"
    # Better: start from current bank = stammdaten + ytd cashflow approx
    ws["B13"] = "=AnfangsBank+'19_Cashflow'!I18"
    style_calc(ws.cell(13, 2), "eur")
    for col in range(3, 15):
        prev = get_column_letter(col - 1)
        ws.cell(13, col, f"={prev}14")
        style_calc(ws.cell(13, col), "eur")

    ws["A14"] = "Endbestand"
    ws["A14"].font = FONT_H3
    for col in range(2, 15):
        letter = get_column_letter(col)
        ws.cell(14, col, f"={letter}13+{letter}6-{letter}7-{letter}8-{letter}9-{letter}10-{letter}11")
        style_calc(ws.cell(14, col), "eur")
        ws.cell(14, col).fill = FILL_AMBER_SOFT

    ws["A15"] = "vs. Mindestliquidität"
    for col in range(2, 15):
        letter = get_column_letter(col)
        ws.cell(15, col, f"={letter}14-MindestLiq")
        style_calc(ws.cell(15, col), "eur")
    ws["A16"] = "Status"
    for col in range(2, 15):
        letter = get_column_letter(col)
        ws.cell(16, col, f'=IF({letter}14<MindestLiq,"ENGPASS",IF({letter}14<MindestLiq*1.25,"ENG","OK"))')
        style_calc(ws.cell(16, col), "text")

    # 12 months
    section_label_safe(ws, 18, 1, "12-Monats-Liquidität", 14)
    ws["A19"] = "Monat"
    ws["A19"].fill = FILL_NAVY
    ws["A19"].font = FONT_WHITE
    for i, m in enumerate(sd.MONATE, start=2):
        cell = ws.cell(19, i, m)
        cell.fill = FILL_NAVY
        cell.font = FONT_HEAD
        cell.alignment = ALIGN_C
    ws["A20"] = "Einzahlungen (Forecast brutto ca.)"
    ws["A21"] = "Auszahlungen gesamt"
    ws["A22"] = "Saldo Monat"
    ws["A23"] = "Bestand kumuliert"
    for m in range(1, 13):
        col = m + 1
        letter = get_column_letter(col)
        ws.cell(20, col, f"='21_Forecast'!{letter}20*1.19")
        ws.cell(21, col, f"='21_Forecast'!{letter}21+'21_Forecast'!{letter}22+'21_Forecast'!{letter}23+'21_Forecast'!{letter}24+'21_Forecast'!{letter}25")
        ws.cell(22, col, f"={letter}20-{letter}21")
        if m == 1:
            ws.cell(23, col, f"=AnfangsBank+{letter}22")
        else:
            prev = get_column_letter(col - 1)
            ws.cell(23, col, f"={prev}23+{letter}22")
        for r in range(20, 24):
            style_calc(ws.cell(r, col), "eur")
    ws.freeze_panes = "B6"

    chart = LineChart()
    chart.title = "13-Wochen-Endbestand vs. Mindestliquidität"
    chart.y_axis.title = "EUR"
    chart.x_axis.title = "Woche"
    chart.height = 8
    chart.width = 18
    chart.style = 10
    data = Reference(ws, min_col=2, max_col=14, min_row=14, max_row=14)
    cats = Reference(ws, min_col=2, max_col=14, min_row=5, max_row=5)
    chart.add_data(data, from_rows=True, titles_from_data=False)
    chart.set_categories(cats)
    chart.legend = None
    ws.add_chart(chart, "A25")


def add_forecast(wb: Workbook) -> None:
    ws = new_sheet(
        wb,
        "21_Forecast",
        "Forecast Umsatz, Kosten, Ergebnis",
        "Plan (Budget) · Forecast (rollierend) · Ist aus Rechnungen und Kosten · Abweichung für die Geschäftsleitung",
        16,
        {1: 32} | {i: 12 for i in range(2, 17)},
    )
    ws["A4"] = "Umsatz netto Plan"
    for i, m in enumerate(sd.MONATE, start=2):
        cell = ws.cell(3, i, m)
        cell.fill = FILL_NAVY
        cell.font = FONT_HEAD
        cell.alignment = ALIGN_C
    ws.cell(3, 1, "Kennzahl").fill = FILL_NAVY
    ws.cell(3, 1).font = FONT_WHITE
    ws.cell(3, 14, "Jahr").fill = FILL_NAVY
    ws.cell(3, 14).font = FONT_HEAD

    plan_lines = [
        (4, "Umsatz Plan", sd.FORECAST_UMSATZ),
        (5, "Material Plan", sd.FORECAST_MATERIAL),
        (6, "Nachunternehmer Plan", sd.FORECAST_NU),
        (7, "Personal Plan", sd.FORECAST_LOHN),
        (8, "Gerät Plan", sd.FORECAST_GERAET),
        (9, "Gemeinkosten Plan", sd.FORECAST_GK),
    ]
    for row, label, values in plan_lines:
        ws.cell(row, 1, label).font = FONT_BODY
        for i, v in enumerate(values, start=2):
            ws.cell(row, i, v)
            style_input(ws.cell(row, i), "eur")
        ws.cell(row, 14, f"=SUM(B{row}:M{row})")
        style_calc(ws.cell(row, 14), "eur")

    ws["A10"] = "DB I Plan (Umsatz-Mat-NU)"
    ws["A11"] = "EBIT Plan"
    for col in range(2, 15):
        letter = get_column_letter(col)
        ws.cell(10, col, f"={letter}4-{letter}5-{letter}6")
        ws.cell(11, col, f"={letter}10-{letter}7-{letter}8-{letter}9")
        style_calc(ws.cell(10, col), "eur")
        style_calc(ws.cell(11, col), "eur")

    section_label_safe(ws, 13, 1, "Ist und rollierender Forecast (ab aktuellem Monat = Plan, davor Ist)", 14)
    ws["A14"] = "Umsatz Ist (AR-Netto im Monat)"
    ws["A15"] = "Material Ist"
    ws["A16"] = "NU Ist"
    ws["A17"] = "Personal Ist (Stundenkosten + Lohnzahlung Fallback)"
    for m in range(1, 13):
        col = m + 1
        letter = get_column_letter(col)
        ws.cell(14, col, f'=SUMIFS(\'13_Ausgangsrechnungen\'!$G:$G,\'13_Ausgangsrechnungen\'!$B:$B,">="&DATE(GJ,{m},1),\'13_Ausgangsrechnungen\'!$B:$B,"<"&DATE(GJ,{m}+1,1))' if m < 12 else f'=SUMIFS(\'13_Ausgangsrechnungen\'!$G:$G,\'13_Ausgangsrechnungen\'!$B:$B,">="&DATE(GJ,12,1),\'13_Ausgangsrechnungen\'!$B:$B,"<"&DATE(GJ+1,1,1))')
        ws.cell(15, col, f'=SUMIFS(\'11_Material\'!$L:$L,\'11_Material\'!$B:$B,">="&DATE(GJ,{m},1),\'11_Material\'!$B:$B,"<"&DATE(GJ,{m}+1,1))' if m < 12 else f'=SUMIFS(\'11_Material\'!$L:$L,\'11_Material\'!$B:$B,">="&DATE(GJ,12,1),\'11_Material\'!$B:$B,"<"&DATE(GJ+1,1,1))')
        ws.cell(16, col, f'=SUMIFS(\'14_Eingangsrechnungen\'!$F:$F,\'14_Eingangsrechnungen\'!$E:$E,"Nachunternehmer",\'14_Eingangsrechnungen\'!$B:$B,">="&DATE(GJ,{m},1),\'14_Eingangsrechnungen\'!$B:$B,"<"&DATE(GJ,{m}+1,1))' if m < 12 else f'=SUMIFS(\'14_Eingangsrechnungen\'!$F:$F,\'14_Eingangsrechnungen\'!$E:$E,"Nachunternehmer",\'14_Eingangsrechnungen\'!$B:$B,">="&DATE(GJ,12,1),\'14_Eingangsrechnungen\'!$B:$B,"<"&DATE(GJ+1,1,1))')
        ws.cell(17, col, f'=SUMIFS(\'10_Stunden\'!$K:$K,\'10_Stunden\'!$B:$B,">="&DATE(GJ,{m},1),\'10_Stunden\'!$B:$B,"<"&DATE(GJ,{m}+1,1))' if m < 12 else f'=SUMIFS(\'10_Stunden\'!$K:$K,\'10_Stunden\'!$B:$B,">="&DATE(GJ,12,1),\'10_Stunden\'!$B:$B,"<"&DATE(GJ+1,1,1))')
        for r in range(14, 18):
            style_calc(ws.cell(r, col), "eur")
        ws.cell(r if False else 14, 14, "=SUM(B14:M14)")
    for r in range(14, 18):
        ws.cell(r, 14, f"=SUM(B{r}:M{r})")
        style_calc(ws.cell(r, 14), "eur")

    ws["A19"] = "Umsatz Forecast (Ist wenn >0 sonst Plan)"
    ws["A20"] = "Umsatz Forecast"
    ws["A21"] = "Material Forecast"
    ws["A22"] = "NU Forecast"
    ws["A23"] = "Personal Forecast"
    ws["A24"] = "Gerät Forecast"
    ws["A25"] = "GK Forecast"
    ws["A26"] = "EBIT Forecast"
    ws["A27"] = "Abweichung EBIT vs Plan"
    for col in range(2, 14):
        letter = get_column_letter(col)
        ws.cell(20, col, f"=IF({letter}14>0,{letter}14,{letter}4)")
        ws.cell(21, col, f"=IF({letter}15>0,{letter}15,{letter}5)")
        ws.cell(22, col, f"=IF({letter}16>0,{letter}16,{letter}6)")
        ws.cell(23, col, f"=IF({letter}17>0,{letter}17,{letter}7)")
        ws.cell(24, col, f"={letter}8")
        ws.cell(25, col, f"={letter}9")
        ws.cell(26, col, f"={letter}20-{letter}21-{letter}22-{letter}23-{letter}24-{letter}25")
        ws.cell(27, col, f"={letter}26-{letter}11")
        for r in range(20, 28):
            style_calc(ws.cell(r, col), "eur")
    for r in range(20, 28):
        ws.cell(r, 14, f"=SUM(B{r}:M{r})")
        style_calc(ws.cell(r, 14), "eur")

    chart = BarChart()
    chart.type = "col"
    chart.grouping = "clustered"
    chart.title = "Umsatz Plan vs. Forecast 2026"
    chart.y_axis.title = "EUR netto"
    chart.x_axis.title = "Monat"
    chart.height = 8
    chart.width = 18
    data = Reference(ws, min_col=1, max_col=13, min_row=4, max_row=4)
    # better two series
    data = Reference(ws, min_col=1, min_row=4, max_col=13, max_row=4)
    cats = Reference(ws, min_col=2, max_col=13, min_row=3, max_row=3)
    chart.add_data(Reference(ws, min_col=1, min_row=4, max_col=13, max_row=4), from_rows=True, titles_from_data=True)
    chart.add_data(Reference(ws, min_col=1, min_row=20, max_col=13, max_row=20), from_rows=True, titles_from_data=True)
    chart.set_categories(cats)
    ws.add_chart(chart, "A29")
    ws.freeze_panes = "B4"


def add_bwa(wb: Workbook) -> None:
    ws = new_sheet(
        wb,
        "22_BWA",
        "Kurz-BWA / GuV Baubetrieb",
        "Verdichtung aus Ausgangsrechnungen, Eingangsrechnungen, Stunden und Forecast-Gemeinkosten",
        8,
        {1: 36, 2: 16, 3: 16, 4: 14, 5: 16, 6: 16, 7: 16, 8: 16},
    )
    headers = ["Position", "Ist GJ", "Forecast GJ", "Abw.", "% vom Umsatz Ist", "Vormonat", "Hinweis"]
    write_headers(ws, headers)
    lines = [
        (4, "Umsatzerlöse (AR netto)", "='21_Forecast'!N14", "='21_Forecast'!N20"),
        (5, "Material / Baustoffe", "='21_Forecast'!N15", "='21_Forecast'!N21"),
        (6, "Nachunternehmer", "='21_Forecast'!N16", "='21_Forecast'!N22"),
        (7, "Rohertrag", "=B4-B5-B6", "=C4-C5-C6"),
        (8, "Personal (Stundenkosten)", "='21_Forecast'!N17", "='21_Forecast'!N23"),
        (9, "Geräte / Mieten", "=SUMIFS('14_Eingangsrechnungen'!F:F,'14_Eingangsrechnungen'!E:E,\"Gerät\")", "='21_Forecast'!N24"),
        (10, "Gemeinkosten (Plan/Forecast)", "='21_Forecast'!N9", "='21_Forecast'!N25"),
        (11, "Betriebsergebnis / EBIT", "=B7-B8-B9-B10", "=C7-C8-C9-C10"),
        (12, "Rohertragsmarge", "=IF(B4=0,0,B7/B4)", "=IF(C4=0,0,C7/C4)"),
        (13, "EBIT-Marge", "=IF(B4=0,0,B11/B4)", "=IF(C4=0,0,C11/C4)"),
        (14, "Offene Forderungen brutto", "=SUM('13_Ausgangsrechnungen'!S4:S400)", ""),
        (15, "Offene Verbindlichkeiten brutto", "=SUM('14_Eingangsrechnungen'!O4:O400)", ""),
        (16, "Einbehalte gebunden", "=SUM('18_Gewaehrleistung'!F4:F400)", ""),
        (17, "Working Capital (Ford.-Verb.)", "=B14-B15", ""),
    ]
    for row, label, ist, fc in lines:
        ws.cell(row, 1, label).font = FONT_BODY
        ws.cell(row, 2, ist)
        ws.cell(row, 3, fc if fc else "")
        if row in (12, 13):
            style_calc(ws.cell(row, 2), "pct")
            style_calc(ws.cell(row, 3), "pct")
            ws.cell(row, 4, f"=B{row}-C{row}")
            style_calc(ws.cell(row, 4), "pct")
            ws.cell(row, 5, "")
        else:
            style_calc(ws.cell(row, 2), "eur")
            if fc:
                style_calc(ws.cell(row, 3), "eur")
            ws.cell(row, 4, f"=IF(C{row}=\"\",\"\",B{row}-C{row})")
            style_calc(ws.cell(row, 4), "eur")
            ws.cell(row, 5, f"=IF($B$4=0,\"\",B{row}/$B$4)" if row not in (14, 15, 16, 17) else "")
            if row not in (14, 15, 16, 17):
                style_calc(ws.cell(row, 5), "pct")
    for r in (7, 11):
        ws.cell(r, 1).font = FONT_H3
        ws.cell(r, 2).fill = FILL_AMBER_SOFT
    ws.freeze_panes = "A4"


def add_sollist(wb: Workbook) -> None:
    ws = new_sheet(
        wb,
        "23_SollIst",
        "Projekt-Soll-Ist",
        "Eine Zeile je Projekt — Werte kommen aus dem Projektstamm, Nachträgen und Ist-Kosten",
        14,
        {1: 14, 2: 26, 3: 14, 4: 14, 5: 14, 6: 14, 7: 14, 8: 14, 9: 12, 10: 12, 11: 14, 12: 12, 13: 14, 14: 18},
    )
    headers = [
        "Projekt", "Name", "Auftrag aktuell", "Ist Leistung", "Budget Kosten", "Ist Kosten",
        "Δ Kosten", "DB Soll", "DB Ist", "Marge Ist", "Fertigstellung", "Restleistung", "OP Debitor", "Ampel",
    ]
    write_headers(ws, headers)
    for r in range(4, 54):
        src = r
        vals = [
            f"=IF('05_Projekte'!A{src}=\"\",\"\",'05_Projekte'!A{src})",
            f"=IF(A{r}=\"\",\"\",'05_Projekte'!B{src})",
            f"=IF(A{r}=\"\",\"\",'05_Projekte'!V{src})",
            f"=IF(A{r}=\"\",\"\",'05_Projekte'!W{src})",
            f"=IF(A{r}=\"\",\"\",'05_Projekte'!K{src}+'05_Projekte'!L{src}+'05_Projekte'!M{src}+'05_Projekte'!N{src}+'05_Projekte'!O{src})",
            f"=IF(A{r}=\"\",\"\",'05_Projekte'!AA{src})",
            f"=IF(A{r}=\"\",\"\",F{r}-E{r})",
            f"=IF(A{r}=\"\",\"\",C{r}-E{r})",
            f"=IF(A{r}=\"\",\"\",'05_Projekte'!AB{src})",
            f"=IF(A{r}=\"\",\"\",'05_Projekte'!AD{src})",
            f"=IF(A{r}=\"\",\"\",'05_Projekte'!AE{src})",
            f"=IF(A{r}=\"\",\"\",'05_Projekte'!AF{src})",
            f"=IF(A{r}=\"\",\"\",'05_Projekte'!AG{src})",
            f'=IF(A{r}="","",IF(OR(J{r}<0.08,G{r}>0,M{r}>50000),"PRÜFEN","OK"))',
        ]
        kinds = ["calc:text", "calc:text", "calc:eur", "calc:eur", "calc:eur", "calc:eur", "calc:eur", "calc:eur", "calc:eur", "calc:pct", "calc:pct", "calc:eur", "calc:eur", "calc:text"]
        from baucontrolling.layout import write_row

        write_row(ws, r, vals, kinds)
    ws.freeze_panes = "A4"

    chart = BarChart()
    chart.type = "bar"
    chart.title = "Deckungsbeitrag Ist je Projekt"
    chart.y_axis.title = "Projekt"
    chart.x_axis.title = "EUR"
    chart.height = 8
    chart.width = 15
    data = Reference(ws, min_col=9, min_row=3, max_row=9)
    cats = Reference(ws, min_col=2, min_row=4, max_row=9)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    ws.add_chart(chart, "A56")


def add_dashboard(wb: Workbook) -> None:
    ws = wb.create_sheet("24_Dashboard", 0)
    paint_sheet(ws, rows=55, cols=16)
    header_bar(ws, "KPI-Dashboard Bau · Geschäftsleitung", "Live aus Bewegungsdaten · Bergmann Hoch- und Tiefbau GmbH · GJ 2026", 14)
    set_widths(ws, {i: 14 for i in range(1, 15)} | {1: 16})

    kpis = [
        (4, 1, "Umsatz Ist GJ", "='22_BWA'!B4", "eur"),
        (4, 3, "Forecast Umsatz", "='21_Forecast'!N20", "eur"),
        (4, 5, "Auftragsbestand", "=SUMIF('05_Projekte'!F:F,\"in Bau\",'05_Projekte'!AF:AF)+SUMIF('05_Projekte'!F:F,\"beauftragt\",'05_Projekte'!AF:AF)+SUMIF('05_Projekte'!F:F,\"geplant\",'05_Projekte'!AF:AF)", "eur"),
        (4, 7, "EBIT Forecast", "='22_BWA'!C11", "eur"),
        (4, 9, "Rohertragsmarge", "='22_BWA'!B12", "pct"),
        (4, 11, "EBIT-Marge Ist", "='22_BWA'!B13", "pct"),
        (8, 1, "OP Debitoren", "='22_BWA'!B14", "eur"),
        (8, 3, "OP Kreditoren", "='22_BWA'!B15", "eur"),
        (8, 5, "Einbehalte", "='22_BWA'!B16", "eur"),
        (8, 7, "Liquidität 13W", "='20_Liquiditaet'!B14", "eur"),
        (8, 9, "Überfällige AR", '=COUNTIFS(\'13_Ausgangsrechnungen\'!T:T,">0",\'13_Ausgangsrechnungen\'!S:S,">0")', "int"),
        (8, 11, "Hit-Rate Angebote", '=IF(COUNTA(\'08_Angebote\'!A4:A400)=0,0,COUNTIF(\'08_Angebote\'!I:I,"angenommen")/COUNTA(\'08_Angebote\'!A4:A400))', "pct"),
    ]
    for row, col, label, formula, kind in kpis:
        kpi_box(ws, row, col, label, formula, kind, span=2)

    section_label_safe(ws, 12, 1, "Frühwarnung", 12)
    alerts = [
        (13, "Liquiditätsengpass in 13 Wochen", '=IF(COUNTIF(\'20_Liquiditaet\'!B16:N16,"ENGPASS")>0,"JA — Disposition prüfen","nein")'),
        (14, "Mahnungen offen", '=COUNTIF(\'17_Mahnwesen\'!H:H,"offen")&" offene Mahnfälle"'),
        (15, "Nachträge in Prüfung", '=COUNTIF(\'07_Nachtraege\'!F:F,"in Prüfung")&" Claims ohne Freigabe"'),
        (16, "Projekte Ampel PRÜFEN", '=COUNTIF(\'23_SollIst\'!N:N,"PRÜFEN")&" Projekte unter Marge / über Budget / hohe OP"'),
        (17, "Bindefrist Angebote", '=COUNTIF(\'08_Angebote\'!M:M,"Bindefrist!")&" Angebote über Bindefrist"'),
    ]
    for row, label, formula in alerts:
        ws.cell(row, 1, label).font = FONT_BODY
        ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=6)
        cell = ws.cell(row, 2, formula)
        style_calc(cell, "text")
        cell.alignment = ALIGN_L

    section_label_safe(ws, 19, 1, "Monatswerte Umsatz / EBIT Forecast", 12)
    ws["A20"] = "Monat"
    for i, m in enumerate(sd.MONATE, start=2):
        ws.cell(20, i, f"='21_Forecast'!{get_column_letter(i)}3")
        style_calc(ws.cell(20, i), "text")
        ws.cell(20, i).fill = FILL_NAVY
        ws.cell(20, i).font = FONT_HEAD
    ws["A21"] = "Umsatz FC"
    ws["A22"] = "EBIT FC"
    for col in range(2, 14):
        letter = get_column_letter(col)
        ws.cell(21, col, f"='21_Forecast'!{letter}20")
        ws.cell(22, col, f"='21_Forecast'!{letter}26")
        style_calc(ws.cell(21, col), "eur")
        style_calc(ws.cell(22, col), "eur")

    chart = BarChart()
    chart.type = "col"
    chart.title = "Forecast Umsatz und EBIT je Monat"
    chart.y_axis.title = "EUR"
    chart.x_axis.title = "Monat 2026"
    chart.height = 7
    chart.width = 16
    chart.add_data(Reference(ws, min_col=1, min_row=21, max_col=13, max_row=22), from_rows=True, titles_from_data=True)
    chart.set_categories(Reference(ws, min_col=2, max_col=13, min_row=20, max_row=20))
    ws.add_chart(chart, "A24")

    section_label_safe(ws, 40, 1, "Top-Projekte nach Auftragswert", 8)
    headers = ["Projekt", "Name", "Auftrag aktuell", "Fertigstellung", "Marge", "OP"]
    for i, h in enumerate(headers, start=1):
        ws.cell(41, i, h)
    style_header_row(ws, 41, 6)
    for i in range(6):
        r = 42 + i
        src = 4 + i
        ws.cell(r, 1, f"=IF('05_Projekte'!A{src}=\"\",\"\",'05_Projekte'!A{src})")
        ws.cell(r, 2, f"=IF(A{r}=\"\",\"\",'05_Projekte'!B{src})")
        ws.cell(r, 3, f"=IF(A{r}=\"\",\"\",'05_Projekte'!V{src})")
        ws.cell(r, 4, f"=IF(A{r}=\"\",\"\",'05_Projekte'!AE{src})")
        ws.cell(r, 5, f"=IF(A{r}=\"\",\"\",'05_Projekte'!AD{src})")
        ws.cell(r, 6, f"=IF(A{r}=\"\",\"\",'05_Projekte'!AG{src})")
        style_calc(ws.cell(r, 1), "text")
        style_calc(ws.cell(r, 2), "text")
        style_calc(ws.cell(r, 3), "eur")
        style_calc(ws.cell(r, 4), "pct")
        style_calc(ws.cell(r, 5), "pct")
        style_calc(ws.cell(r, 6), "eur")

    ws["J40"] = "Liquiditätsstatus"
    ws["J40"].font = FONT_H3
    ws["J41"] = "='20_Liquiditaet'!B16"
    style_calc(ws.cell(41, 10), "text")
    ws.merge_cells("J41:K41")
    ws["J42"] = "Kreditlinie"
    ws["K42"] = "=Kreditlinie"
    style_calc(ws.cell(42, 11), "eur")
    ws["J43"] = "Mindestliquidität"
    ws["K43"] = "=MindestLiq"
    style_calc(ws.cell(43, 11), "eur")
    ws.freeze_panes = "A4"
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.paperSize = ws.PAPERSIZE_A4


def add_all_controlling(wb: Workbook) -> None:
    add_cashflow(wb)
    add_liquiditaet(wb)
    add_forecast(wb)
    add_bwa(wb)
    add_sollist(wb)
    add_dashboard(wb)
