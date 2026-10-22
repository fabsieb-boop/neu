import { type ReactNode } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { Sidebar, MobileNav } from "@/components/sidebar";
import { RegionaleUebersicht, Uebersicht } from "@/pages/uebersicht";
import { GuV } from "@/pages/guv";
import { Ebitda } from "@/pages/ebitda";
import { Forecast } from "@/pages/forecast";
import { ForecastRegionen } from "@/pages/forecast-regionen";
import { ForecastPlan } from "@/pages/forecast-plan";
import { ForecastEingabe } from "@/pages/forecast-eingabe";
import { Auftraege } from "@/pages/auftraege";
import { Auftrag } from "@/pages/auftrag";
import { Regionen } from "@/pages/regionen";
import { Kosten } from "@/pages/kosten";
import { Buchungen } from "@/pages/buchungen";
import { Liquiditaet } from "@/pages/liquiditaet";
import { Stammdaten } from "@/pages/stammdaten";
import { Einstellungen } from "@/pages/einstellungen";
import { ManagementBericht } from "@/pages/berichte";
import { System } from "@/pages/system";
import { useDash } from "@/data";

export function App() {
  const { user } = useDash();
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileNav />
        <Routes>
          <Route path="/" element={user.regional ? <RegionaleUebersicht /> : <Uebersicht />} />
          <Route path="/guv" element={<Vollzugriff><GuV /></Vollzugriff>} />
          <Route path="/ebitda" element={<Vollzugriff><Ebitda /></Vollzugriff>} />
          <Route path="/management-bericht" element={<Vollzugriff><ManagementBericht /></Vollzugriff>} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/forecast-regionen" element={<ForecastRegionen />} />
          <Route path="/forecast-plan" element={<ForecastPlan />} />
          <Route path="/forecast-eingabe" element={<ForecastEingabe />} />
          <Route path="/auftraege" element={<Auftraege />} />
          <Route path="/auftrag" element={<Auftrag />} />
          <Route path="/regionen" element={<Regionen />} />
          <Route path="/kostenverfolgung" element={<Kosten />} />
          <Route path="/buchungen" element={<Buchungen />} />
          <Route path="/liquiditaet" element={<Vollzugriff><Liquiditaet /></Vollzugriff>} />
          <Route path="/stammdaten" element={<Vollzugriff><Stammdaten /></Vollzugriff>} />
          <Route path="/einstellungen" element={<Vollzugriff><Einstellungen /></Vollzugriff>} />
          <Route path="/system/:section" element={<NurAdmin><System /></NurAdmin>} />
          <Route path="*" element={<Fehlt />} />
        </Routes>
      </div>
    </div>
  );
}

function Vollzugriff({ children }: { children: ReactNode }) {
  const { user } = useDash();
  return user.regional ? <KeinZugriff /> : children;
}

function NurAdmin({ children }: { children: ReactNode }) {
  const { user } = useDash();
  return user.istAdmin ? children : <KeinZugriff />;
}

function KeinZugriff() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-display text-3xl font-semibold">Für diesen Zugang nicht verfügbar</p>
        <p className="mt-2 text-sm text-muted-foreground">Die Ansicht enthält unternehmensweite Daten außerhalb Ihrer Regionen.</p>
        <NavLink to="/" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Zur regionalen Übersicht</NavLink>
      </div>
    </div>
  );
}

function Fehlt() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-display text-3xl font-semibold">Seite nicht vorhanden</p>
        <NavLink to="/" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Zur Übersicht</NavLink>
      </div>
    </div>
  );
}
