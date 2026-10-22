import { useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useDash } from "@/data";
import { eur } from "@/components/dash";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function OrderSearch({ value, onSelect, placeholder = "Auftrag suchen – Nummer, Name oder Region…" }: { value?: string; onSelect: (nr: string) => void; placeholder?: string }) {
  const { dash } = useDash();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const selected = dash.orders.find((o) => o.nr === value);

  const hits = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return dash.orders.filter((o) => {
      const hay = norm(`${o.nr} ${o.name} ${o.region}`);
      return words.every((w) => hay.includes(w));
    }).slice(0, 8);
  }, [dash.orders, q]);

  const pick = (nr: string) => { onSelect(nr); setQ(""); setOpen(false); ref.current?.blur(); };
  const mark = (text: string) => {
    const w = norm(q).split(/\s+/).filter(Boolean)[0];
    if (!w) return text;
    const i = norm(text).indexOf(w);
    if (i < 0) return text;
    return <>{text.slice(0, i)}<mark className="rounded bg-accent/30 text-foreground">{text.slice(i, i + w.length)}</mark>{text.slice(i + w.length)}</>;
  };

  return (
    <div className="relative w-full">
      <label className="flex items-center gap-3 rounded-xl border border-input bg-card px-4 py-3 shadow-card focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          ref={ref}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, Math.max(hits.length - 1, 0))); }
            if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter" && hits[idx]) { e.preventDefault(); pick(hits[idx].nr); }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={selected ? `${selected.nr} · ${selected.name}` : placeholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-foreground/70"
        />
        {q && <button type="button" aria-label="Leeren" onClick={() => setQ("")}><X className="h-4 w-4 text-muted-foreground" /></button>}
      </label>
      {open && (
        <ul className="absolute z-20 mt-2 max-h-96 w-full overflow-auto rounded-xl border border-border bg-popover p-1 shadow-card">
          {hits.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Kein Auftrag gefunden</li>}
          {hits.map((o, i) => (
            <li key={o.nr}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(o.nr); }} onMouseEnter={() => setIdx(i)} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === idx ? "bg-muted" : ""}`}>
                <span>
                  <span className="block font-medium">{mark(o.name || o.nr)}</span>
                  <span className="block text-xs text-muted-foreground">{mark(o.nr)} · {mark(o.region)}</span>
                </span>
                <span className={`text-xs font-semibold ${o.akte < 0 ? "text-negative" : "text-positive"}`}>{eur(o.akte, true)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
