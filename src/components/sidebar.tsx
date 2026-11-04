import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import logo from "@/assets/tvf-logo.png";
import { useDash } from "@/data";
import { MENUE, type MenueGruppe, type MenuePunkt } from "@/menue";

function sichtbar(user: ReturnType<typeof useDash>["user"], punkt: MenuePunkt) {
  if (punkt.firma && user.regional) return false;
  if (punkt.admin && !user.istAdmin) return false;
  if (punkt.freigabe && (user.regional || !user.rollen.some((rolle) => ["ADMIN", "CONTROLLING", "GF"].includes(rolle)))) return false;
  if (punkt.forecast && !user.rollen.some((rolle) => ["ADMIN", "CONTROLLING", "GF", "PROJEKTLEITER", "FORECAST-PFLEGE"].includes(rolle))) return false;
  return true;
}

export function useGruppen(): MenueGruppe[] {
  const { user } = useDash();
  return MENUE
    .map((gruppe) => ({ ...gruppe, punkte: gruppe.punkte.filter((punkt) => sichtbar(user, punkt)) }))
    .filter((gruppe) => gruppe.punkte.length > 0);
}

function aktiveGruppe(gruppen: MenueGruppe[], pfad: string) {
  return gruppen.find((gruppe) => gruppe.punkte.some((punkt) => (punkt.to === "/" ? pfad === "/" : pfad === punkt.to))) ?? gruppen[0];
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${isActive ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;

export function Sidebar() {
  const { dash, user, logout } = useDash();
  const gruppen = useGruppen();
  const location = useLocation();
  const navigate = useNavigate();
  const aktiv = aktiveGruppe(gruppen, location.pathname);
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-primary text-primary-foreground md:flex">
      <div className="flex items-center gap-3 px-5 py-6">
        <img src={logo} alt="TVF Altwert" className="h-11 w-11 object-contain" />
        <div>
          <p className="font-display font-semibold leading-tight">TVF Altwert</p>
          <p className="text-xs opacity-60">Controlling</p>
        </div>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {gruppen.map((gruppe) => (
          <button
            key={gruppe.id}
            type="button"
            onClick={() => navigate(gruppe.punkte[0].to)}
            className={`flex w-full rounded-lg px-3 py-2 text-left text-sm ${aktiv?.id === gruppe.id ? "bg-primary-foreground/15 font-semibold" : "opacity-75 hover:bg-primary-foreground/10 hover:opacity-100"}`}
          >
            {gruppe.label}
          </button>
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

export function Unterband() {
  const gruppen = useGruppen();
  const location = useLocation();
  const navigate = useNavigate();
  const aktiv = aktiveGruppe(gruppen, location.pathname);
  if (!aktiv) return null;
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-card">
      <div className="flex gap-1 overflow-x-auto px-3 py-2 md:hidden">
        {gruppen.map((gruppe) => (
          <button
            key={gruppe.id}
            type="button"
            onClick={() => navigate(gruppe.punkte[0].to)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${aktiv.id === gruppe.id ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"}`}
          >
            {gruppe.label}
          </button>
        ))}
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 py-2" aria-label={aktiv.label}>
        {aktiv.punkte.map((punkt) => (
          <NavLink key={punkt.to} to={punkt.to} end={punkt.to === "/"} className={linkClass}>
            {punkt.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
