import { useDash } from "@/data";
import { Panel, PageHeader, num, eur } from "@/components/dash";

export function Einstellungen() {
  const { dash } = useDash();
  return (
    <div>
      <PageHeader title="Parameter und Legende" subtitle="Stellschrauben und Rechenwege aus der Mappe" />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dash.parameter.map((p) => (
            <div key={p.name} className="rounded-xl border border-border bg-card p-5 shadow-card">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{p.name}</p>
              <p className="mt-2 font-display text-2xl font-semibold">{typeof p.wert === "number" ? eur(p.wert, true) : p.wert}</p>
            </div>
          ))}
        </section>
        <Panel title="Liquiditätsparameter">
          <div className="grid gap-3 md:grid-cols-2">
            {dash.liqParameter.map((p) => (
              <div key={p.key} className="rounded-lg bg-muted p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-mono text-xs text-muted-foreground">{p.key}</p>
                  <p className="font-display text-lg font-semibold">{num(p.wert, Number.isInteger(p.wert) ? 0 : 2)} <span className="text-xs font-normal text-muted-foreground">{p.einheit}</span></p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Legende">
          <dl className="divide-y divide-border">
            {dash.legende.map((l) => (
              <div key={l.punkt} className="grid gap-1 py-3 md:grid-cols-4">
                <dt className="font-semibold">{l.punkt}</dt>
                <dd className="text-sm text-muted-foreground md:col-span-3">{l.formel}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </main>
    </div>
  );
}
