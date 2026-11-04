import { useDash } from "@/data";
import { Kpi, PageHeader } from "@/components/dash";
import { Orders } from "@/components/orders";

export function Auftraege() {
  const { dash } = useDash();
  const leistung = dash.orders.reduce((s, o) => s + o.leistung, 0);
  const akte = dash.orders.reduce((s, o) => s + o.akte, 0);
  const ohneStamm = dash.orders.filter((order) => order.status === "OHNE STAMM").length;
  const inListe = dash.orders.length - ohneStamm;
  return (
    <div>
      <PageHeader title="Projektsuche / Akte" subtitle="Liste aus dem Projektstamm, Summen aus dem Journal" />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Projekte</p>
            <p className="mt-3 font-display text-2xl font-semibold">{dash.orders.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{inListe.toLocaleString("de-DE")} aus der Auftragsliste{ohneStamm > 0 ? `, ${ohneStamm.toLocaleString("de-DE")} nur im Journal` : ""}</p>
          </div>
          <Kpi label="Leistung" value={leistung} hint="ohne Belegart CA" />
          <Kpi label="Ergebnis Akte" value={akte} hint="Leistung minus Kosten" signed />
        </section>
        <Orders />
      </main>
    </div>
  );
}
