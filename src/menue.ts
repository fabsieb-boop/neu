export type MenuePunkt = {
  to: string;
  label: string;
  firma?: boolean;
  admin?: boolean;
  freigabe?: boolean;
  forecast?: boolean;
};

export type MenueGruppe = {
  id: string;
  label: string;
  punkte: MenuePunkt[];
};

export const MENUE: MenueGruppe[] = [
  {
    id: "start",
    label: "Start",
    punkte: [
      { to: "/", label: "Übersicht" },
      { to: "/lagebild", label: "Lagebild", firma: true },
      { to: "/monatssicht", label: "Monatssicht" },
      { to: "/monatsanalyse", label: "Monatsanalyse", firma: true },
      { to: "/guv", label: "GuV & EBITDA", firma: true },
      { to: "/management-bericht", label: "Management-Bericht", firma: true },
    ],
  },
  {
    id: "controlling",
    label: "Controlling",
    punkte: [
      { to: "/abgrenzungen", label: "Abgrenzungen", firma: true },
      { to: "/bestaende", label: "Bestände", firma: true },
      { to: "/datenstatus", label: "Datenstatus", firma: true },
      { to: "/skonto", label: "Skonto", firma: true },
      { to: "/rueckstellungen", label: "Rückstellungsspiegel", firma: true },
      { to: "/umlagen", label: "Umlagen", firma: true },
      { to: "/plan", label: "Plan", firma: true },
    ],
  },
  {
    id: "region",
    label: "Meine Region",
    punkte: [
      { to: "/regionen", label: "Regionen" },
      { to: "/forecast", label: "Forecast & Plan" },
      { to: "/forecast-regionen", label: "Forecast je Auftrag" },
      { to: "/forecast-eingabe", label: "Forecast eingeben", forecast: true },
    ],
  },
  {
    id: "projekte",
    label: "Projekte",
    punkte: [
      { to: "/projektsuche", label: "Projektsuche / Akte" },
      { to: "/unterprojekte", label: "Unteraufträge" },
      { to: "/forecast-projekte", label: "Forecast je Projekt" },
      { to: "/kostenverfolgung", label: "Kostenverfolgung" },
      { to: "/stunden", label: "Stunden" },
      { to: "/risiken", label: "Risiken" },
      { to: "/kalkulation", label: "Kalkulation HK/SK" },
    ],
  },
  {
    id: "liquiditaet",
    label: "Liquidität",
    punkte: [
      { to: "/liquiditaet", label: "Liquiditätsplan", firma: true },
      { to: "/annahmen", label: "Annahmen", firma: true },
      { to: "/bilanz", label: "Bilanz", firma: true },
      { to: "/monatsroll", label: "Monatsroll", firma: true },
    ],
  },
  {
    id: "system",
    label: "System",
    punkte: [
      { to: "/unterlagen", label: "Jahresabschluss", admin: true },
      { to: "/import", label: "Import", admin: true },
      { to: "/freigaben", label: "Freigaben", freigabe: true },
      { to: "/benutzer", label: "Benutzer", admin: true },
      { to: "/mailversand", label: "Mailversand", admin: true },
      { to: "/bericht", label: "Berichtsgenerator", admin: true },
      { to: "/klr", label: "KLR und Deckungsbeiträge", admin: true },
      { to: "/gegenkontrolle", label: "Gegenkontrolle", admin: true },
    ],
  },
];
