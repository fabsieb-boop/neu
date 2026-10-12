/**
 * Office Script: TVF Controlling Cockpit – Startseite aufbauen
 *
 * Site: https://tvfaltwert.sharepoint.com/sites/03-Finance
 * Ordner: Dokumente/TVF-Controlling-Cockpit
 * Hub: Cockpit.xlsx (Dashboard-Seite TVF-ALTWERT-GMBH-Dashboard)
 *
 * In Excel für das Web: Automatisieren → Neues Script → Inhalt einfügen → Speichern als
 * "TVF_Cockpit_Startseite". In der Hub-Datei Cockpit.xlsx ausführen.
 *
 * Voraussetzung: Alle 48 Einzeldateien liegen im selben SharePoint-/OneDrive-Ordner
 * wie diese Arbeitsmappe. Die Formeln nutzen relative Verknüpfungen der Form
 * ='[GuV.xlsx]GuV'!D9
 */
function main(workbook: ExcelScript.Workbook) {
  const sheetName = "Cockpit";
  let sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    sheet = workbook.addWorksheet(sheetName);
  }

  // KPI-Zeile (externe Verknüpfungen)
  sheet.getRange("C2").setValue("TVF ALTWERT – Controlling Cockpit");
  sheet.getRange("C3").setValue(
    "Startseite. Gelbe Steuerung in Steuerung.xlsx. Beträge in EUR."
  );

  sheet.getRange("C5").setValue("Gesamtleistung YTD");
  sheet.getRange("G5").setValue("EBITDA YTD");
  sheet.getRange("K5").setValue("EBITDA Jahresforecast");
  sheet.getRange("O5").setValue("Cash-Pool Ende Plan");

  sheet.getRange("C6").setFormula("='[GuV.xlsx]GuV'!D9");
  sheet.getRange("G6").setFormula("='[GuV.xlsx]GuV'!D20");
  sheet.getRange("K6").setFormula("='[Forecast.xlsx]Forecast'!L23");
  sheet.getRange("O6").setFormula("='[Monatsroll.xlsx]Monatsroll'!Q18");

  sheet.getRange("C9").setFormula(
    '="Berichtszeitraum: 01–"&TEXT(\'[Steuerung.xlsx]Steuerung\'!$F$7,"00")&" / "&\'[Steuerung.xlsx]Steuerung\'!$F$6'
  );

  const links: { cell: string; file: string; sheet: string; label: string }[] = [
    { cell: "C48", file: "Steuerung.xlsx", sheet: "Steuerung", label: "Steuerung" },
    { cell: "G48", file: "GuV.xlsx", sheet: "GuV", label: "GuV" },
    { cell: "K48", file: "Forecast.xlsx", sheet: "Forecast", label: "Forecast" },
    { cell: "O48", file: "Regionen.xlsx", sheet: "Regionen", label: "Regionen" },
    { cell: "C50", file: "Projekte.xlsx", sheet: "Projekte", label: "Projekte" },
    { cell: "G50", file: "Projektakte.xlsx", sheet: "Projektakte", label: "Projektakte" },
    { cell: "K50", file: "Kostenverfolgung.xlsx", sheet: "Kostenverfolgung", label: "Kostenverfolgung" },
    { cell: "O50", file: "Bestände.xlsx", sheet: "Bestände", label: "Bestände" },
    { cell: "C52", file: "KLR.xlsx", sheet: "KLR", label: "KLR" },
    { cell: "G52", file: "Stunden.xlsx", sheet: "Stunden", label: "Stunden" },
    { cell: "K52", file: "Stundensätze.xlsx", sheet: "Stundensätze", label: "Stundensätze" },
    { cell: "O52", file: "Kalkulation.xlsx", sheet: "Kalkulation", label: "Kalkulation" },
    { cell: "C54", file: "Liquidität.xlsx", sheet: "Liquidität", label: "Liquidität" },
    { cell: "G54", file: "Bilanz.xlsx", sheet: "Bilanz", label: "Bilanz" },
    { cell: "K54", file: "Mehrjahresplan.xlsx", sheet: "Mehrjahresplan", label: "Mehrjahresplan" },
    { cell: "O54", file: "Risiken.xlsx", sheet: "Risiken", label: "Risiken" },
    { cell: "C56", file: "Monatsabschluss.xlsx", sheet: "Monatsabschluss", label: "Monatsabschluss" },
    { cell: "G56", file: "Berichte.xlsx", sheet: "Berichte", label: "Berichte" },
    { cell: "K56", file: "Jahresabschluss.xlsx", sheet: "Jahresabschluss", label: "Jahresabschluss" },
    { cell: "O56", file: "Prüfungen.xlsx", sheet: "Prüfungen", label: "Prüfungen" },
    { cell: "C58", file: "Daten.xlsx", sheet: "Daten", label: "Daten" },
    { cell: "G58", file: "Anleitung.xlsx", sheet: "Anleitung", label: "Anleitung" },
    { cell: "C60", file: "Import.xlsx", sheet: "Import", label: "Daten importieren" }
  ];

  sheet.getRange("C46").setValue("Direktzugriff");
  for (const link of links) {
    const formula =
      `=IFERROR(HYPERLINK("[${link.file}]${link.sheet}!C2","${link.label}"),"${link.label}")`;
    sheet.getRange(link.cell).setFormula(formula);
  }

  // Monatstabelle Forecast I/L/M/N
  const months = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  sheet.getRange("C31").setValue("Monat");
  sheet.getRange("D31").setValue("Gesamtleistung");
  sheet.getRange("E31").setValue("GL Plan");
  sheet.getRange("F31").setValue("EBITDA Ist/FC");
  sheet.getRange("G31").setValue("EBITDA Plan");
  for (let i = 0; i < 12; i++) {
    const row = 32 + i;
    const src = 7 + i;
    sheet.getRange(`C${row}`).setValue(months[i]);
    sheet.getRange(`D${row}`).setFormula(`='[Forecast.xlsx]Forecast'!I${src}`);
    sheet.getRange(`E${row}`).setFormula(`='[Forecast.xlsx]Forecast'!M${src}`);
    sheet.getRange(`F${row}`).setFormula(`='[Forecast.xlsx]Forecast'!L${src}`);
    sheet.getRange(`G${row}`).setFormula(`='[Forecast.xlsx]Forecast'!N${src}`);
  }

  sheet.getRange("C62").setValue(
    "Monats-GuV-Import aktualisiert die Gesellschaftswerte. Alle Dateien müssen im selben SharePoint-Ordner liegen."
  );

  workbook.getApplication().calculate(ExcelScript.CalculationType.full);
}
