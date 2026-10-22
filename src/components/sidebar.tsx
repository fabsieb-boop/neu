import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Briefcase,
  Calculator,
  Database,
  FileCheck2,
  FileSearch,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Map,
  PenLine,
  Receipt,
  ScanSearch,
  Settings,
  ShieldCheck,
  Table2,
  TrendingUp,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import logo from "@/assets/tvf-logo.png";
import { useDash } from "@/data";

type Item = { to: string; label: string; icon: typeof LayoutDashboard };
type Group = { label: string; items: Item[] };

function useGroups(): Group[] {
  const { user } = useDash();
  const regional = user.regional;
  const canForecast = user.rollen.some((role) => ["ADMIN", "CONTROLLING", "FORECAST-PFLEGE"].includes(role));
  const groups: Group[] = [
    {
      label: "Start",
      items: [
        { to: "/", label: regional ? "Meine Übersicht" : "Übersicht", icon: LayoutDashboard },
        ...(!regional ? [
          { to: "/guv", label: "GuV", icon: FileSpreadsheet },
          { to: "/ebitda", label: "EBITDA", icon: BarChart3 },
          { to: "/management-bericht", label: "Management-Bericht", icon: FileText },
        ] : []),
      ],
    },
    {
      label: "Meine Region",
      items: [
        { to: "/regionen", label: "Regionen", icon: Map },
        { to: "/forecast", label: "Forecast & Plan", icon: TrendingUp },
        { to: "/forecast-regionen", label: "Forecast je Auftrag", icon: Map },
        { to: "/forecast-plan", label: "Forecast-Plan", icon: Table2 },
        ...(canForecast ? [{ to: "/forecast-eingabe", label: "Forecast eingeben", icon: PenLine }] : []),
      ],
    },
    {
      label: "Projekte",
      items: [
        { to: "/auftraege", label: "Aufträge", icon: Briefcase },
        { to: "/auftrag", label: "Einzelauftrag", icon: FileSearch },
        { to: "/kostenverfolgung", label: "Kostenverfolgung", icon: ScanSearch },
        { to: "/buchungen", label: "Buchungen", icon: Receipt },
      ],
    },
  ];
  if (!regional) {
    groups.push(
      { label: "Liquidität", items: [{ to: "/liquiditaet", label: "Liquiditätsplan", icon: Wallet }] },
      {
        label: "Datenbasis",
        items: [
          { to: "/stammdaten", label: "Stammdaten", icon: Database },
          { to: "/einstellungen", label: "Parameter & Legende", icon: Settings },
        ],
      },
    );
  }
  if (user.istAdmin) {
    groups.push({
      label: "System",
      items: [
        { to: "/system/unterlagen", label: "Jahresabschluss", icon: FileCheck2 },
        { to: "/system/import", label: "Import", icon: Upload },
        { to: "/system/benutzer", label: "Benutzer", icon: Users },
        { to: "/system/mail", label: "Mailversand", icon: Mail },
        { to: "/system/berichte", label: "Berichtsgenerator", icon: FileText },
        { to: "/system/klr", label: "KLR und Deckungsbeiträge", icon: Calculator },
        { to: "/system/gegenkontrolle", label: "Gegenkontrolle", icon: ShieldCheck },
      ],
    });
  }
  return groups;
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-primary-foreground/10 hover:opacity-100 ${isActive ? "bg-primary-foreground/15 font-semibold opacity-100" : "opacity-75"}`;

export function Sidebar() {
  const { dash, user, logout } = useDash();
  const groups = useGroups();
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
      <div className="border-t border-white/10 px-4 py-4 text-xs">
        <div className="mb-3 px-2">
          <p className="font-semibold opacity-90">{user.vorname || user.nachname ? `${user.vorname} ${user.nachname}`.trim() : user.setup ? "System-Einrichtung" : user.email}</p>
          <p className="mt-0.5 opacity-50">{user.regional ? user.regionen.join(", ") : "alle Regionen"} · {user.rollen.join(", ")}</p>
          <p className="mt-1 opacity-50">Geschäftsjahr {dash.jahr} · Ist bis {dash.letzterIstName}</p>
        </div>
        {!user.setup && <button onClick={() => void logout()} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 opacity-70 hover:bg-white/10 hover:opacity-100"><LogOut className="h-4 w-4" />Abmelden</button>}
      </div>
    </aside>
  );
}

export function MobileNav() {
  const groups = useGroups();
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
