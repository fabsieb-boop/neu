import { NavLink, Route, Routes } from "react-router-dom";
import { Sidebar, MobileNav } from "@/components/sidebar";
import { Uebersicht } from "@/pages/uebersicht";
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

export function App() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileNav />
        <Routes>
          <Route path="/" element={<Uebersicht />} />
          <Route path="/guv" element={<GuV />} />
          <Route path="/ebitda" element={<Ebitda />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/forecast-regionen" element={<ForecastRegionen />} />
          <Route path="/forecast-plan" element={<ForecastPlan />} />
          <Route path="/forecast-eingabe" element={<ForecastEingabe />} />
          <Route path="/auftraege" element={<Auftraege />} />
          <Route path="/auftrag" element={<Auftrag />} />
          <Route path="/regionen" element={<Regionen />} />
          <Route path="/kostenverfolgung" element={<Kosten />} />
          <Route path="/buchungen" element={<Buchungen />} />
          <Route path="/liquiditaet" element={<Liquiditaet />} />
          <Route path="/stammdaten" element={<Stammdaten />} />
          <Route path="/einstellungen" element={<Einstellungen />} />
          <Route path="*" element={<Fehlt />} />
        </Routes>
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
