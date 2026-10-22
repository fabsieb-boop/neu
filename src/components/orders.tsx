import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { Search } from "lucide-react";
import { useDash } from "@/data";
import { eur, Panel } from "@/components/dash";
import type { Order } from "@/types";

export function Orders() {
  const { dash } = useDash();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("Alle");
  const [sort, setSort] = useState<keyof Order>("leistung");
  const regions = ["Alle", ...Array.from(new Set(dash.orders.map((o) => o.region)))];
  const rows = useMemo(
    () => dash.orders
      .filter((o) => (region === "Alle" || o.region === region) && `${o.nr} ${o.name}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => Number(b[sort]) - Number(a[sort])),
    [dash.orders, q, region, sort],
  );
  const top = rows.slice(0, 10).map((o) => ({ name: o.name || o.nr, akte: o.akte }));
  const th = (k: keyof Order, l: string) => (
    <th className="pb-3 text-right font-medium">
      <button onClick={() => setSort(k)} className={sort === k ? "text-foreground" : "hover:text-foreground"}>{l}</button>
    </th>
  );

  return (
    <Panel title="Aufträge" subtitle={`${rows.length} Projekte der Liste`}>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Auftrag oder Projekt suchen…" className="w-full bg-transparent outline-none" />
        </label>
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {regions.map((r) => (
            <button key={r} onClick={() => setRegion(r)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${region === r ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"}`}>{r || "ohne Region"}</button>
          ))}
        </div>
      </div>
      <div className="mb-6 h-56">
        <ResponsiveContainer>
          <BarChart data={top} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={200} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => eur(v)} cursor={{ fill: "var(--muted)" }} />
            <ReferenceLine x={0} stroke="var(--border)" />
            <Bar dataKey="akte" name="Ergebnis Akte" radius={4}>
              {top.map((t, i) => <Cell key={i} fill={t.akte < 0 ? "var(--negative)" : "var(--positive)"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="pb-3 font-medium">Projekt</th>
              <th className="pb-3 font-medium">Region</th>
              {th("leistung", "Leistung")}
              {th("kvar", "Var. Kosten")}
              {th("kfix", "Fixe Kosten")}
              {th("umlage", "Gemeinkosten")}
              {th("akte", "Ergebnis")}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const marge = o.leistung ? (o.akte / o.leistung) * 100 : 0;
              return (
                <tr key={o.nr} className="border-t border-border">
                  <td className="py-2.5"><p className="font-medium">{o.name || "—"}</p><p className="text-xs text-muted-foreground">{o.nr}</p></td>
                  <td className="text-muted-foreground">{o.region}</td>
                  <td className="text-right">{eur(o.leistung)}</td>
                  <td className="text-right text-muted-foreground">{eur(o.kvar)}</td>
                  <td className="text-right text-muted-foreground">{eur(o.kfix)}</td>
                  <td className="text-right text-muted-foreground">{eur(o.umlage)}</td>
                  <td className="text-right">
                    <p className={`font-semibold ${o.akte < 0 ? "text-negative" : "text-positive"}`}>{eur(o.akte)}</p>
                    {o.leistung !== 0 && <p className="text-xs text-muted-foreground">{marge.toFixed(1)} %</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
