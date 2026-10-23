import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Landmark } from "lucide-react";
import { useDash } from "@/data";

export const num = (v: number, d = 0) =>
  v.toFixed(d).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const eur = (v: number, compact = false) => {
  if (compact) {
    const a = Math.abs(v);
    if (a >= 1e6) return `${num(v / 1e6, 2)} Mio. €`;
    if (a >= 1e3) return `${num(v / 1e3, 0)} Tsd. €`;
  }
  return `${num(Math.round(v))} €`;
};

export const short = (n: string) => n.slice(0, 3);
export const axis = { fill: "var(--muted-foreground)", fontSize: 12 };
export const money = (v: number) => <span className={v < 0 ? "text-negative" : ""}>{eur(v)}</span>;

export function Kpi({ label, value, hint, signed, icon, plain }: { label: string; value: number; hint: string; signed?: boolean; icon?: boolean; plain?: boolean }) {
  const neg = value < 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon ? <Landmark className="h-4 w-4 text-muted-foreground" /> : signed ? (neg ? <ArrowDownRight className="h-4 w-4 text-negative" /> : <ArrowUpRight className="h-4 w-4 text-positive" />) : null}
      </div>
      <p className={`mt-3 font-display text-2xl font-semibold tracking-tight ${signed && neg ? "text-negative" : ""}`}>{plain ? num(value) : eur(value, true)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function Panel({ title, subtitle, className = "", icon, children }: { title: string; subtitle?: string; className?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-6 shadow-card ${className}`}>
      <div className="mb-5 flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">{icon}{title}</h2>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

export function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-card">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex justify-between gap-6">
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-medium">{eur(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { dash } = useDash();
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-6 py-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Controlling {dash.jahr}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1"><span className="h-2 w-2 rounded-full bg-primary" /> Ist bis {dash.letzterIstName}</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1"><span className="h-2 w-2 rounded-full bg-plan" /> Plan danach</span>
        </div>
      </div>
    </header>
  );
}

export type Col<T> = { key: string; label: string; right?: boolean; render: (r: T) => ReactNode };
export function DataTable<T>({ rows, cols, max = 520 }: { rows: T[]; cols: Col<T>[]; max?: number }) {
  return (
    <div className="overflow-auto" style={{ maxHeight: max }}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            {cols.map((c) => <th key={c.key} className={`whitespace-nowrap px-2 pb-3 font-medium ${c.right ? "text-right" : ""}`}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border hover:bg-muted/60">
              {cols.map((c) => <td key={c.key} className={`whitespace-nowrap px-2 py-2.5 ${c.right ? "text-right" : ""}`}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
