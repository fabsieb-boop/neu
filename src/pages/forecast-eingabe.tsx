import { useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { useDash } from "@/data";
import { eur, num, Kpi, Panel, PageHeader } from "@/components/dash";
import type { Dash } from "@/types";

const ARTEN = {
  umsatz: "Umsatz",
  kosten: "Kosten",
  ba: "Bestandsänderung",
} as const;

type Art = keyof typeof ARTEN;
type Project = Dash["projektstamm"][number];

const parseAmount = (raw: string) => {
  const normalized = raw.trim().replace(/[ €]/g, "").replace(/\./g, "").replace(",", ".");
  return normalized === "" ? 0 : Number(normalized);
};

const shownValue = (groesse: string, wert: number) => groesse === "umsatz" ? -wert : wert;

export function ForecastEingabe() {
  const { dash, updateDash, updateJournal } = useDash();
  const [projektNr, setProjektNr] = useState("");
  const [groesse, setGroesse] = useState<Art>("umsatz");
  const [werte, setWerte] = useState<string[]>(Array(12).fill(""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const projects = useMemo(() => {
    const active = dash.projektstamm.filter((project) => project.status === "AKTIV");
    const known = new Set(dash.projektstamm.map((project) => project.nr));
    const fromJournal = dash.forecastOrders
      .filter((order) => order.nr && !known.has(order.nr))
      .map((order) => ({
        id: 0,
        nr: order.nr,
        name: order.name,
        typ: "Journal",
        region: order.region || "Ohne Zuordnung",
        status: "OHNE STAMM",
        budgetUmsatz: 0,
        budgetKosten: 0,
      }));
    return [...active, ...fromJournal].sort((a, b) => `${a.region} ${a.name} ${a.nr}`.localeCompare(`${b.region} ${b.name} ${b.nr}`, "de"));
  }, [dash.forecastOrders, dash.projektstamm]);
  const selected = projects.find((project) => project.nr === projektNr);
  const selectedOrder = dash.forecastOrders.find((order) => order.nr === projektNr);
  const existing = dash.forecastPlan.filter((entry) => entry.nr === projektNr);
  const existingPlan = existing.filter((entry) => entry.art === "plan");
  const sumExisting = (art: Art) => existingPlan
    .filter((entry) => entry.groesse === art)
    .reduce((sum, entry) => sum + shownValue(entry.groesse, entry.wert), 0);
  const parsed = werte.map(parseAmount);
  const inputSum = parsed.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selected) {
      setError("Bitte einen Auftrag aus der Liste wählen.");
      return;
    }
    if (parsed.some((value) => !Number.isFinite(value))) {
      setError("Mindestens ein Betrag ist ungültig.");
      return;
    }
    const rows = parsed
      .map((wert, index) => ({ monat: index + 1, wert }))
      .filter((entry) => entry.wert !== 0);
    if (!rows.length) {
      setError("Bitte mindestens einen Monatswert eingeben.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projektNr: selected.nr, groesse, werte: rows }),
      });
      const result = await response.json() as { error?: string; saved?: number; dashboard?: Dash };
      if (!response.ok || !result.dashboard) {
        throw new Error(result.error || "Der Forecast konnte nicht gespeichert werden.");
      }
      updateDash(result.dashboard);
      setWerte(Array(12).fill(""));
      setSuccess(`${result.saved} ${result.saved === 1 ? "Planzeile" : "Planzeilen"} gespeichert.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Der Forecast konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Forecast-Eingabe" subtitle="Planwerte je Auftrag und Monat direkt erfassen" />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <Panel title="Forecast je Projekt eingeben" subtitle={`${projects.length} Aufträge, inklusive Journal ohne Projektstamm`}>
          <form onSubmit={submit} className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Auftrag / Projekt</label>
                <ProjectSearch projects={projects} value={projektNr} onSelect={(nr) => {
                  setProjektNr(nr);
                  setError("");
                  setSuccess("");
                }} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Art</label>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                  {(Object.keys(ARTEN) as Art[]).map((art) => (
                    <button
                      type="button"
                      key={art}
                      onClick={() => setGroesse(art)}
                      className={`whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-medium transition ${groesse === art ? "bg-card shadow-card" : "text-muted-foreground"}`}
                    >
                      {ARTEN[art]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {selected && (
              <div className="rounded-lg bg-muted px-4 py-3 text-sm">
                <span className="font-semibold">{selected.name || selected.nr}</span>
                <span className="ml-2 text-muted-foreground">{selected.nr} · {selected.region} · {selected.typ}</span>
                {selected.status === "OHNE STAMM" && (
                  <p className="mt-1 text-muted-foreground">PSP {selectedOrder?.psp || "–"}. Das ist der Teil hinter P4102. Die Belege hängen noch nicht an einer Projektakte.</p>
                )}
              </div>
            )}

            <div>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <label className="text-xs font-medium text-muted-foreground">Betrag je Monat (€), so wie er im Dashboard erscheinen soll</label>
                <button type="button" onClick={() => setWerte(Array(12).fill(""))} className="text-xs text-muted-foreground hover:text-foreground">Alle leeren</button>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-12">
                {dash.monate.map((monat, index) => {
                  const plan = index + 1 > dash.letzterIst;
                  return (
                    <div key={monat} className={`rounded-lg border p-2 ${plan ? "border-plan bg-plan/10" : "border-border"}`}>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {monat.slice(0, 3)}{plan && " · FC"}
                      </p>
                      <input
                        aria-label={`Betrag ${monat}`}
                        disabled={!plan}
                        inputMode="decimal"
                        placeholder={plan ? "0" : "Ist"}
                        value={werte[index]}
                        onChange={(event) => setWerte((current) => current.map((value, i) => i === index ? event.target.value : value))}
                        className="w-full bg-transparent text-right text-sm font-medium outline-none disabled:cursor-not-allowed disabled:text-muted-foreground"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
              <div className="max-w-2xl text-xs text-muted-foreground">
                {groesse === "umsatz"
                  ? "Umsatz wird wie in der Excel-Mappe intern mit umgekehrtem Vorzeichen gespeichert."
                  : "Der eingegebene Betrag wird unverändert in Forecast_Plan gespeichert."}
              </div>
              <div className="flex items-end gap-5">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Summe Eingabe</p>
                  <p className="font-display text-xl font-semibold">{eur(inputSum)}</p>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                >
                  {saving ? "Wird gespeichert …" : "Planwerte speichern"}
                </button>
              </div>
            </div>

            {(error || success) && (
              <p role="status" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${error ? "bg-negative/10 text-negative" : "bg-positive/10 text-positive"}`}>
                {!error && <Check className="h-4 w-4" />}
                {error || success}
              </p>
            )}
          </form>
        </Panel>

        {selected?.status === "OHNE STAMM" && (
          <AkteAnlegen
            nr={selected.nr}
            psp={selectedOrder?.psp || ""}
            onCreated={async (dashboard) => {
              updateDash(dashboard);
              const response = await fetch("/api/journal");
              if (response.ok) updateJournal(await response.json());
              setSuccess(`Projektakte angelegt. PSP ${selectedOrder?.psp}.`);
            }}
          />
        )}

        {selected && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Umsatz Plan" value={sumExisting("umsatz")} hint="angezeigtes Vorzeichen" />
              <Kpi label="Kosten Plan" value={sumExisting("kosten")} hint="gespeicherte Planzeilen" />
              <Kpi label="Bestand Plan" value={sumExisting("ba")} hint="gespeicherte Planzeilen" signed />
              <Kpi
                label="Ergebnis Plan"
                value={sumExisting("umsatz") + sumExisting("ba") - sumExisting("kosten")}
                hint="Umsatz + Bestand − Kosten"
                signed
              />
            </section>

            {existing.length > 0 && (
              <Panel title={`Vorhandene Zeilen · ${selected.name || selected.nr}`} subtitle={`${existing.length} Einträge`}>
                <div className="max-h-[440px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="pb-3 font-medium">Art</th>
                        <th className="pb-3 font-medium">Monat</th>
                        <th className="pb-3 font-medium">Quelle</th>
                        <th className="pb-3 text-right font-medium">Gespeichert</th>
                        <th className="pb-3 text-right font-medium">Angezeigt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existing.map((entry, index) => (
                        <tr key={`${entry.art}-${entry.groesse}-${entry.monat}-${entry.wert}-${index}`} className="border-t border-border">
                          <td className="py-2.5 font-medium">{ARTEN[entry.groesse as Art] ?? entry.groesse}</td>
                          <td>{dash.monate[entry.monat - 1]}</td>
                          <td className="text-muted-foreground">{entry.art}</td>
                          <td className="text-right text-muted-foreground">{eur(entry.wert)}</td>
                          <td className="text-right font-semibold">{eur(shownValue(entry.groesse, entry.wert))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const PSP_REGION: Record<string, string> = { "15": "West", "30": "Süd-West", "60": "Ost", "65": "Berlin" };

function AkteAnlegen({ nr, psp, onCreated }: { nr: string; psp: string; onCreated: (dash: Dash) => Promise<void> }) {
  const { dash, journal } = useDash();
  const belege = journal.filter((row) => row.nr === nr);
  const summe = belege.reduce((sum, row) => sum + row.wert, 0);
  const [name, setName] = useState("");
  const [region, setRegion] = useState(PSP_REGION[psp.slice(0, 2)] || dash.regions[0]?.region || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch("/api/projektakte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auftrag: nr, name, region }),
      });
      const result = await response.json() as { error?: string; dashboard?: Dash };
      if (!response.ok || !result.dashboard) throw new Error(result.error || "Die Projektakte konnte nicht angelegt werden.");
      await onCreated(result.dashboard);
      setName("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Die Projektakte konnte nicht angelegt werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Projektakte anlegen" subtitle={psp ? `PSP ${psp}` : "PSP fehlt"}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Die PSP-Nummer ist {psp || "nicht ableitbar"}. Sie steht hinter P4102 in der Auftragsnummer {nr}.
          Im Journal liegen {belege.length.toLocaleString("de-DE")} Belege über {num(summe, 2)} €. Nach dem Anlegen zählt die Akte diese Belege.
        </p>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
          <label className="text-xs font-medium text-muted-foreground">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Region
            <select value={region} onChange={(event) => setRegion(event.target.value)} className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground">
              {dash.regions.map((entry) => <option key={entry.region} value={entry.region}>{entry.region}</option>)}
            </select>
          </label>
        </div>
        <button type="submit" disabled={saving || !psp} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {saving ? "Wird angelegt …" : "Projektakte anlegen"}
        </button>
        {error && <p role="status" className="rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p>}
      </form>
    </Panel>
  );
}

function ProjectSearch({ projects, value, onSelect }: { projects: Project[]; value: string; onSelect: (nr: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const selected = projects.find((project) => project.nr === value);
  const words = query.toLocaleLowerCase("de").split(/\s+/).filter(Boolean);
  const hits = projects.filter((project) => {
    const haystack = `${project.nr} ${project.name} ${project.region} ${project.typ}`.toLocaleLowerCase("de");
    return words.every((word) => haystack.includes(word));
  }).slice(0, 10);

  const choose = (nr: string) => {
    onSelect(nr);
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="relative">
      <label className="flex items-center gap-3 rounded-xl border border-input bg-card px-4 py-3 shadow-card focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          ref={input}
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          placeholder={selected ? `${selected.nr} · ${selected.name}` : "Nummer, Name oder Region suchen …"}
          className="w-full bg-transparent text-sm outline-none placeholder:text-foreground/70"
        />
        {query && <button type="button" aria-label="Suche leeren" onClick={() => setQuery("")}><X className="h-4 w-4 text-muted-foreground" /></button>}
      </label>
      {open && (
        <ul className="absolute z-20 mt-2 max-h-96 w-full overflow-auto rounded-xl border border-border bg-popover p-1 shadow-card">
          {hits.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Kein Auftrag gefunden</li>}
          {hits.map((project) => (
            <li key={project.nr}>
              <button
                type="button"
                onMouseDown={(event) => { event.preventDefault(); choose(project.nr); }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span>
                  <span className="block font-medium">{project.name || project.nr}</span>
                  <span className="block text-xs text-muted-foreground">{project.nr} · {project.region}</span>
                </span>
                <span className="text-xs text-muted-foreground">{project.typ}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
