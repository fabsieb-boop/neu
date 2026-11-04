import { type ReactNode } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar, Unterband } from "@/components/sidebar";
import { RegionaleUebersicht, Uebersicht } from "@/pages/uebersicht";
import { GuV } from "@/pages/guv";
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
import { ManagementBericht } from "@/pages/berichte";
import { System } from "@/pages/system";
import {
  Abgrenzungen,
  Annahmen,
  Bestaende,
  Bilanz,
  Datenstatus,
  ForecastProjekte,
  Freigaben,
  Kalkulation,
  Lagebild,
  Monatsanalyse,
  Monatsroll,
  Risiken,
  Rueckstellungen,
  Skonto,
  Stunden,
  Umlagen,
  Unterprojekte,
} from "@/pages/cockpit-seiten";
import { useDash } from "@/data";

export function App() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Unterband />
        <Routes>
          <Route path="/" element={<Start />} />
          <Route path="/lagebild" element={<Vollzugriff><Lagebild /></Vollzugriff>} />
          <Route path="/monatssicht" element={<Buchungen />} />
          <Route path="/monatsanalyse" element={<Vollzugriff><Monatsanalyse /></Vollzugriff>} />
          <Route path="/guv" element={<Vollzugriff><GuV /></Vollzugriff>} />
          <Route path="/management-bericht" element={<Vollzugriff><ManagementBericht /></Vollzugriff>} />
          <Route path="/abgrenzungen" element={<Vollzugriff><Abgrenzungen /></Vollzugriff>} />
          <Route path="/bestaende" element={<Vollzugriff><Bestaende /></Vollzugriff>} />
          <Route path="/datenstatus" element={<Vollzugriff><Datenstatus /></Vollzugriff>} />
          <Route path="/skonto" element={<Vollzugriff><Skonto /></Vollzugriff>} />
          <Route path="/rueckstellungen" element={<Vollzugriff><Rueckstellungen /></Vollzugriff>} />
          <Route path="/umlagen" element={<Vollzugriff><Umlagen /></Vollzugriff>} />
          <Route path="/plan" element={<Vollzugriff><ForecastPlan /></Vollzugriff>} />
          <Route path="/regionen" element={<Regionen />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/forecast-regionen" element={<ForecastRegionen />} />
          <Route path="/forecast-eingabe" element={<ForecastEingabe />} />
          <Route path="/projektsuche" element={<Projektakte />} />
          <Route path="/unterprojekte" element={<Unterprojekte />} />
          <Route path="/forecast-projekte" element={<ForecastProjekte />} />
          <Route path="/kostenverfolgung" element={<Kosten />} />
          <Route path="/stunden" element={<Stunden />} />
          <Route path="/risiken" element={<Risiken />} />
          <Route path="/kalkulation" element={<Kalkulation />} />
          <Route path="/liquiditaet" element={<Vollzugriff><Liquiditaet /></Vollzugriff>} />
          <Route path="/annahmen" element={<Vollzugriff><Annahmen /></Vollzugriff>} />
          <Route path="/bilanz" element={<Vollzugriff><Bilanz /></Vollzugriff>} />
          <Route path="/monatsroll" element={<Vollzugriff><Monatsroll /></Vollzugriff>} />
          <Route path="/unterlagen" element={<NurAdmin><System bereich="unterlagen" /></NurAdmin>} />
          <Route path="/import" element={<NurAdmin><System bereich="import" /></NurAdmin>} />
          <Route path="/freigaben" element={<KannFreigeben><Freigaben /></KannFreigeben>} />
          <Route path="/benutzer" element={<NurAdmin><System bereich="benutzer" /></NurAdmin>} />
          <Route path="/mailversand" element={<NurAdmin><System bereich="mail" /></NurAdmin>} />
          <Route path="/bericht" element={<NurAdmin><System bereich="berichte" /></NurAdmin>} />
          <Route path="/klr" element={<NurAdmin><System bereich="klr" /></NurAdmin>} />
          <Route path="/gegenkontrolle" element={<NurAdmin><System bereich="gegenkontrolle" /></NurAdmin>} />
          <Route path="/ebitda" element={<Navigate to="/guv" replace />} />
          <Route path="/buchungen" element={<Navigate to="/monatssicht" replace />} />
          <Route path="/forecast-plan" element={<Navigate to="/plan" replace />} />
          <Route path="/auftraege" element={<Navigate to="/projektsuche" replace />} />
          <Route path="/auftrag" element={<WeiterAuftrag />} />
          <Route path="/stammdaten" element={<Navigate to="/datenstatus" replace />} />
          <Route path="/einstellungen" element={<Navigate to="/annahmen" replace />} />
          <Route path="/system/berichte" element={<Navigate to="/bericht" replace />} />
          <Route path="/system/unterlagen" element={<Navigate to="/unterlagen" replace />} />
          <Route path="/system/import" element={<Navigate to="/import" replace />} />
          <Route path="/system/benutzer" element={<Navigate to="/benutzer" replace />} />
          <Route path="/system/mail" element={<Navigate to="/mailversand" replace />} />
          <Route path="/system/klr" element={<Navigate to="/klr" replace />} />
          <Route path="/system/gegenkontrolle" element={<Navigate to="/gegenkontrolle" replace />} />
          <Route path="*" element={<Fehlt />} />
        </Routes>
      </div>
    </div>
  );
}

function Start() {
  const { user } = useDash();
  return user.regional ? <RegionaleUebersicht /> : <Uebersicht />;
}

function Projektakte() {
  const { search } = useLocation();
  return new URLSearchParams(search).get("nr") ? <Auftrag /> : <Auftraege />;
}

function WeiterAuftrag() {
  const { search } = useLocation();
  return <Navigate to={`/projektsuche${search}`} replace />;
}

function Vollzugriff({ children }: { children: ReactNode }) {
  const { user } = useDash();
  return user.regional ? <KeinZugriff /> : children;
}

function NurAdmin({ children }: { children: ReactNode }) {
  const { user } = useDash();
  return user.istAdmin ? children : <KeinZugriff />;
}

function KannFreigeben({ children }: { children: ReactNode }) {
  const { user } = useDash();
  const erlaubt = !user.regional && user.rollen.some((rolle) => ["ADMIN", "CONTROLLING", "GF"].includes(rolle));
  return erlaubt ? children : <KeinZugriff />;
}

function KeinZugriff() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6 text-center">
      <div>
        <p className="font-display text-3xl font-semibold">Für diesen Zugang nicht verfügbar</p>
        <p className="mt-2 text-sm text-muted-foreground">Die Ansicht enthält unternehmensweite Daten außerhalb Ihrer Regionen.</p>
        <NavLink to="/" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Zur Übersicht</NavLink>
      </div>
    </div>
  );
}

function Fehlt() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6 text-center">
      <div>
        <p className="font-display text-3xl font-semibold">Seite nicht vorhanden</p>
        <NavLink to="/" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Zur Übersicht</NavLink>
      </div>
    </div>
  );
}
