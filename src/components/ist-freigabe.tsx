import { useEffect, useState } from "react";
import { useDash } from "@/data";
import { Panel } from "@/components/dash";
import type { Dash } from "@/types";

export function IstFreigabe() {
  const { dash, user, updateDash } = useDash();
  const allowed = !user.regional && user.rollen.some((role) => role === "ADMIN" || role === "CONTROLLING" || role === "GF");
  const [monat, setMonat] = useState(dash.letzterIst);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setMonat(dash.letzterIst);
  }, [dash.letzterIst]);

  if (!allowed) return null;

  async function save(next: number | null) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/ist-freigabe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monat: next }),
      });
      const result = await response.json() as { error?: string; dashboard?: Dash };
      if (!response.ok || !result.dashboard) {
        throw new Error(result.error || "Die Freigabe konnte nicht gespeichert werden.");
      }
      updateDash(result.dashboard);
      const name = result.dashboard.letzterIstName;
      setSuccess(next == null ? `Ist folgt wieder der Mappe, bis ${name}.` : `${name} ist freigegeben.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Die Freigabe konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function clearMonth(target: number) {
    const label = `${dash.monate[target - 1]} ${dash.jahr}`;
    if (!window.confirm(`Alle Buchungen, der Forecast und die Bankstände von ${label} werden gelöscht. Das lässt sich nicht rückgängig machen.`)) {
      return;
    }
    setClearing(target);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/monat-loeschen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monat: target }),
      });
      const result = await response.json() as {
        error?: string;
        dashboard?: Dash;
        geloescht?: { buchungen: number; forecast: number; bank: number };
      };
      if (!response.ok || !result.dashboard || !result.geloescht) {
        throw new Error(result.error || "Der Monat konnte nicht gelöscht werden.");
      }
      updateDash(result.dashboard);
      const { buchungen, forecast, bank } = result.geloescht;
      const anzahl = (wert: number, einer: string, mehrere: string) => `${wert} ${wert === 1 ? einer : mehrere}`;
      setSuccess(`${label}: ${anzahl(buchungen, "Buchung", "Buchungen")}, ${anzahl(forecast, "Forecast-Zeile", "Forecast-Zeilen")} und ${anzahl(bank, "Bankstand", "Bankstände")} gelöscht.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Der Monat konnte nicht gelöscht werden.");
    } finally {
      setClearing(null);
    }
  }

  const name = dash.monate[monat - 1];
  const busy = saving || clearing != null;
  return (
    <Panel title="Ist freigeben" subtitle={dash.freigabeGesetzt ? "eigene Freigabe" : "Stand der Mappe"}>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Bis {dash.letzterIstName} gelten die gebuchten Werte als Ist. Die Excel-Mappe steht auf {dash.mappeMonatName}.
        Monate nach der Mappe übernehmen Umsatz, Bestand und EBITDA aus dem Journal. Der Forecast bleibt für jeden freigegebenen Monat geschlossen.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save(monat);
        }}
      >
        <label className="text-xs font-medium text-muted-foreground">
          Freigabe bis
          <select
            value={monat}
            onChange={(event) => setMonat(Number(event.target.value))}
            className="mt-1 block rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
          >
            {dash.monate.map((label, index) => (
              <option key={label} value={index + 1}>{label} {dash.jahr}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={busy || monat === dash.letzterIst}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Wird gespeichert …" : `${name} freigeben`}
        </button>
        {dash.freigabeGesetzt && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(null)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-60"
          >
            Wieder die Mappe verwenden
          </button>
        )}
      </form>
      <div className="mt-6 border-t border-border pt-4">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Jeder Monat lässt sich hier einzeln leeren. Weg sind die Buchungen, der Forecast und die Bankstände dieses Monats. Die Kostenverfolgung bleibt.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {dash.monate.map((label, index) => {
            const target = index + 1;
            return (
              <button
                key={label}
                type="button"
                disabled={busy}
                onClick={() => void clearMonth(target)}
                className="rounded-lg border border-border px-3 py-2 text-left text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clearing === target ? "Wird gelöscht …" : `${label} leeren`}
              </button>
            );
          })}
        </div>
      </div>
      {(error || success) && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${error ? "bg-negative/10 text-negative" : "bg-positive/10 text-positive"}`}>
          {error || success}
        </p>
      )}
    </Panel>
  );
}
