import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileSpreadsheet, Briefcase, Map, TrendingUp, Wallet, BarChart3, FileSearch, ScanSearch, Receipt, Database, Settings, Table2 } from "lucide-react";
import logo from "@/assets/tvf-logo.png";
import { useDash } from "@/data";

const groups = [
  { label: "Überblick", items: [{ to: "/", label: "Übersicht", icon: LayoutDashboard }] },
  {
    label: "Ergebnis",
    items: [
      { to: "/guv", label: "GuV", icon: FileSpreadsheet },
      { to: "/ebitda", label: "EBITDA", icon: BarChart3 },
      { to: "/forecast", label: "Forecast", icon: TrendingUp },
      { to: "/forecast-regionen", label: "Forecast je Region", icon: Map },
      { to: "/forecast-plan", label: "Forecast-Plan", icon: Table2 },
    ],
  },
  {
    label: "Projekte",
    items: [
      { to: "/auftraege", label: "Aufträge", icon: Briefcase },
      { to: "/auftrag", label: "Einzelauftrag", icon: FileSearch },
      { to: "/regionen", label: "Regionen", icon: Map },
      { to: "/kostenverfolgung", label: "Kostenverfolgung", icon: ScanSearch },
      { to: "/buchungen", label: "Buchungen", icon: Receipt },
    ],
  },
  { label: "Finanzen", items: [{ to: "/liquiditaet", label: "Liquidität", icon: Wallet }] },
  {
    label: "Verwaltung",
    items: [
      { to: "/stammdaten", label: "Stammdaten", icon: Database },
      { to: "/einstellungen", label: "Parameter & Legende", icon: Settings },
    ],
  },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-primary-foreground/10 hover:opacity-100 ${isActive ? "bg-primary-foreground/15 font-semibold opacity-100" : "opacity-75"}`;

export function Sidebar() {
  const { dash } = useDash();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-primary text-primary-foreground md:flex">
      <div className="flex items-center gap-3 px-6 py-6">
        <img src={logo} alt="TVF Altwert" className="h-11 w-11 object-contain" />
        <div>
          <p className="font-display font-semibold leading-tight">TVF Altwert</p>
          <p className="text-xs opacity-60">Controlling</p>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-50">{g.label}</p>
            <ul className="space-y-1">
              {g.items.map((i) => (
                <li key={i.to}>
                  <NavLink to={i.to} end={i.to === "/"} className={linkClass}>
                    <i.icon className="h-4 w-4" />
                    {i.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <p className="px-6 py-4 text-xs opacity-50">Geschäftsjahr {dash.jahr} · Ist bis {dash.letzterIstName}</p>
    </aside>
  );
}

export function MobileNav() {
  const all = groups.flatMap((g) => g.items);
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
      {all.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.to === "/"} className={({ isActive }) => `whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${isActive ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"}`}>
          {i.label}
        </NavLink>
      ))}
    </nav>
  );
}
