import { type ReactNode, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, FileUp, Mail as MailIcon, Search, Upload, UserPlus } from "lucide-react";
import { Berichte } from "@/pages/berichte";
import { useDash } from "@/data";
import { DataTable, eur, Kpi, PageHeader, Panel } from "@/components/dash";
import type { User } from "@/types";

export function System() {
  const { section } = useParams();
  if (section === "berichte") return <Berichte />;
  if (section === "unterlagen") return <AnnualClosing />;
  if (section === "import") return <ImportManager />;
  if (section === "benutzer") return <Users />;
  if (section === "mail") return <Mail />;
  if (section === "klr") return <Klr />;
  if (section === "gegenkontrolle") return <Countercheck />;
  return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Systemseite nicht vorhanden.</div>;
}

type UserData = { nutzer: User[]; rollen: string[]; regionen: string[] };

function Users() {
  const { user: currentUser, logout } = useDash();
  const [data, setData] = useState<UserData | null>(null);
  const [form, setForm] = useState({ email: "", passwort: "", vorname: "", nachname: "", rolle: currentUser.setup ? "ADMIN" : "NEUTRAL" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = () => fetch("/api/users").then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Benutzer konnten nicht geladen werden.");
    setData(result);
  }).catch((reason) => setError(reason.message));
  useEffect(() => { void load(); }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(""); setError("");
    const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Anlegen fehlgeschlagen."); return; }
    if (result.setupComplete) {
      await logout();
      return;
    }
    setMessage("Benutzer angelegt – Passwortwechsel bei erster Anmeldung ist gekennzeichnet.");
    setForm({ email: "", passwort: "", vorname: "", nachname: "", rolle: "NEUTRAL" });
    load();
  };
  const change = async (benutzerId: number, aktion: string, wert: string | undefined, an: boolean) => {
    setError("");
    const response = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ benutzerId, aktion, wert, an }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Änderung fehlgeschlagen."); return; }
    load();
  };

  return (
    <div>
      <PageHeader title="Benutzer & Rechte" subtitle="Rollen und Datenzugriff getrennt nach Regionen" />
      <main className="mx-auto max-w-[1500px] space-y-6 px-6 py-8">
        {currentUser.setup && <div className="rounded-xl border border-accent/40 bg-accent/10 p-5 text-sm"><p className="font-semibold">Ersten Administrator anlegen</p><p className="mt-1 text-muted-foreground">Die Datenbank enthält noch keinen Zugang. Der erste Benutzer erhält zwingend die Rolle ADMIN; danach erscheint die Anmeldung.</p></div>}
        {(message || error) && <p role="status" className={`rounded-lg px-4 py-3 text-sm ${error ? "bg-negative/10 text-negative" : "bg-positive/10 text-positive"}`}>{error || message}</p>}
        <Panel title="Benutzer anlegen" icon={<UserPlus className="h-4 w-4" />}>
          <form onSubmit={create} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
            <label className="text-xs font-medium text-muted-foreground">E-Mail<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="vorname.name@firma.de" className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground" /></label>
            <label className="text-xs font-medium text-muted-foreground">Startpasswort<input required type="password" minLength={12} value={form.passwort} onChange={(event) => setForm({ ...form, passwort: event.target.value })} placeholder="mindestens 12 Zeichen" className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground" /></label>
            <label className="text-xs font-medium text-muted-foreground">Vorname<input value={form.vorname} onChange={(event) => setForm({ ...form, vorname: event.target.value })} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground" /></label>
            <label className="text-xs font-medium text-muted-foreground">Nachname<input value={form.nachname} onChange={(event) => setForm({ ...form, nachname: event.target.value })} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground" /></label>
            <label className="text-xs font-medium text-muted-foreground">Rolle<select disabled={currentUser.setup} value={form.rolle} onChange={(event) => setForm({ ...form, rolle: event.target.value })} className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground">{(data?.rollen ?? ["ADMIN"]).map((role) => <option key={role}>{role}</option>)}</select></label>
            <button className="self-end rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Benutzer anlegen</button>
          </form>
        </Panel>
        <Panel title="Benutzer" subtitle={data ? `${data.nutzer.length} Zugänge` : "wird geladen"}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-3">E-Mail</th><th className="pb-3">Name</th><th className="pb-3">Rollen</th><th className="pb-3">Regionen</th><th className="pb-3">Status</th><th className="pb-3">Letzte Anmeldung</th></tr></thead>
              <tbody>{data?.nutzer.map((user) => <tr key={user.id} className="border-t border-border align-top">
                <td className="py-3 font-semibold">{user.email}</td>
                <td className="py-3">{`${user.vorname} ${user.nachname}`.trim() || "–"}</td>
                <td className="max-w-sm py-2">{data.rollen.map((role) => <Pill key={role} active={user.rollen.includes(role)} onClick={() => void change(user.id, "rolle", role, !user.rollen.includes(role))}>{role}</Pill>)}</td>
                <td className="max-w-sm py-2">{data.regionen.map((region) => <Pill key={region} active={user.regionen.includes(region)} onClick={() => void change(user.id, "region", region, !user.regionen.includes(region))}>{region}</Pill>)}{user.regionen.length === 0 && <p className="mt-1 text-xs text-muted-foreground">keine Einschränkung</p>}</td>
                <td className="py-2"><Pill active={user.aktiv} onClick={() => void change(user.id, "aktiv", undefined, !user.aktiv)}>{user.aktiv ? "aktiv" : "inaktiv"}</Pill>{user.passwortOffen && <span className="ml-1 inline-block rounded-full bg-accent/20 px-2 py-1 text-xs">Passwort offen</span>}</td>
                <td className="whitespace-nowrap py-3 text-muted-foreground">{user.letzterLogin ? new Date(user.letzterLogin).toLocaleString("de-DE") : "–"}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </Panel>
      </main>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`m-0.5 rounded-full border px-2.5 py-1 text-xs transition ${active ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border text-muted-foreground opacity-60"}`}>{children}</button>;
}

type ImportRun = { id: number; erstelltAt: string; dateiname: string; schritt: string; status: string; zeilen: number; detail: string };
type ImportAnalysis = { blaetter?: string[]; erkannt?: number; tabellen?: Record<string, number>; zeilen?: number; importiert?: number };

function ImportManager() {
  const { updateDash, updateJournal } = useDash();
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const loadRuns = () => fetch("/api/import/protokoll").then((response) => response.json()).then((data) => setRuns(data.laeufe ?? []));
  useEffect(() => { void loadRuns(); }, []);

  const execute = async (step: "analyse" | "testlauf" | "import") => {
    if (!file) return;
    setRunning(true); setError(""); setMessage(`${file.name} wird ${step === "analyse" ? "analysiert" : step === "testlauf" ? "getestet" : "importiert"} …`);
    try {
      const content = await fileBase64(file);
      const response = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schritt: step, dateiname: file.name, inhalt: content }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Import fehlgeschlagen.");
      setAnalysis(result);
      setMessage(step === "analyse" ? `${result.erkannt} benötigte Blätter erkannt.` : step === "testlauf" ? `${result.zeilen} Quellzeilen im isolierten Test verarbeitet.` : `${result.importiert} Quellzeilen importiert.`);
      if (step === "import") {
        const [dashboard, journal] = await Promise.all([fetch("/api/dashboard").then((item) => item.json()), fetch("/api/journal").then((item) => item.json())]);
        updateDash(dashboard); updateJournal(journal);
      }
      await loadRuns();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import fehlgeschlagen.");
      setMessage("");
    } finally {
      setRunning(false);
    }
  };
  const choose = (next: File | undefined) => {
    if (!next) return;
    setFile(next); setAnalysis(null); setError(""); setMessage("");
    setTimeout(() => void executeFile(next, setRunning, setAnalysis, setMessage, setError), 0);
  };
  return (
    <div>
      <PageHeader title="Datenimport" subtitle="Analyse, isolierter Testlauf und direkter Import der TVF-Excel-Datei" />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {(message || error) && <p className={`rounded-lg px-4 py-3 text-sm ${error ? "bg-negative/10 text-negative" : "bg-positive/10 text-positive"}`}>{error || message}</p>}
        <Panel title="SAP-Daten & Listen" subtitle="Excel-Quelldatei">
          <label className="grid min-h-48 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center hover:border-primary">
            <div><Upload className="mx-auto h-8 w-8 text-primary" /><p className="mt-3 font-semibold">{file ? file.name : "Datei hierher ziehen oder klicken"}</p><p className="mt-1 text-xs text-muted-foreground">tvf-dashboard-download.xlsx · Art und benötigte Blätter werden geprüft</p></div>
            <input type="file" accept=".xlsx" className="sr-only" onChange={(event) => choose(event.target.files?.[0])} />
          </label>
          {file && <div className="mt-4 flex flex-wrap gap-2"><button disabled={running} className={buttonClass} onClick={() => void execute("analyse")}>1 · Analysieren</button><button disabled={running || !analysis} className={buttonClass} onClick={() => void execute("testlauf")}>2 · Testlauf</button><button disabled={running || !analysis} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40" onClick={() => void execute("import")}>3 · Importieren</button></div>}
          {analysis?.blaetter && <div className="mt-5 flex flex-wrap gap-2">{analysis.blaetter.map((sheet) => <span key={sheet} className="rounded-full bg-muted px-3 py-1 text-xs">{sheet}</span>)}</div>}
          {analysis?.tabellen && <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(analysis.tabellen).map(([table, count]) => <div key={table} className="rounded-lg bg-muted p-3 text-sm"><p className="font-mono text-xs text-muted-foreground">{table}</p><p className="mt-1 font-semibold">{count.toLocaleString("de-DE")} Zeilen</p></div>)}</div>}
        </Panel>
        <Panel title="Bisherige Importläufe" subtitle="Systemprotokoll">
          <DataTable rows={runs} cols={[
            { key: "z", label: "Zeit", render: (run) => new Date(`${run.erstelltAt.replace(" ", "T")}Z`).toLocaleString("de-DE") },
            { key: "d", label: "Datei", render: (run) => run.dateiname },
            { key: "s", label: "Schritt", render: (run) => run.schritt },
            { key: "st", label: "Status", render: (run) => <span className="rounded-full bg-positive/10 px-2 py-1 text-xs font-semibold text-positive">{run.status}</span> },
            { key: "n", label: "Zeilen", right: true, render: (run) => run.zeilen.toLocaleString("de-DE") },
          ]} />
        </Panel>
      </main>
    </div>
  );
}

async function executeFile(file: File, setRunning: (value: boolean) => void, setAnalysis: (value: ImportAnalysis) => void, setMessage: (value: string) => void, setError: (value: string) => void) {
  setRunning(true);
  try {
    const response = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schritt: "analyse", dateiname: file.name, inhalt: await fileBase64(file) }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Analyse fehlgeschlagen.");
    setAnalysis(result); setMessage(`${result.erkannt} benötigte Blätter erkannt.`);
  } catch (reason) { setError(reason instanceof Error ? reason.message : "Analyse fehlgeschlagen."); } finally { setRunning(false); }
}

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Die Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

const buttonClass = "rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:opacity-40";

function Mail() {
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [subject, setSubject] = useState("Controlling-Cockpit: Zugang");
  const [text, setText] = useState(`{anrede},

das Controlling-Cockpit ist unter {adresse} erreichbar.
Benutzer: {mail}

Mit freundlichen Grüßen
TVF ALTWERT GmbH, Controlling`);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    fetch("/api/mail").then((response) => response.json()).then((data) => {
      setUsers(data.benutzer ?? []);
      const recipients = (data.benutzer ?? []) as User[];
      setSelected(recipients.find((item) => item.passwortOffen)?.id ?? recipients[0]?.id ?? null);
    });
  }, []);
  const chosen = users.find((user) => user.id === selected) ?? null;
  const render = (user: User) => text
    .replaceAll("{anrede}", `${user.vorname || user.nachname ? `Guten Tag ${user.vorname} ${user.nachname}`.trim() : "Guten Tag"}`)
    .replaceAll("{mail}", user.email)
    .replaceAll("{adresse}", window.location.origin);
  const openDraft = () => {
    if (!chosen) return;
    window.location.href = `mailto:${chosen.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(render(chosen))}`;
  };
  return (
    <div>
      <PageHeader title="Mailversand" subtitle="Mitteilungen an aktive Benutzer vorbereiten" />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm"><p className="font-semibold">Probelauf</p><p className="mt-1 text-muted-foreground">Das Cockpit erzeugt einen Entwurf im lokalen Mailprogramm. Es versendet keine Nachricht und ändert keine Passwörter.</p></div>
        <section className="grid gap-6 lg:grid-cols-2">
          <Panel title="Mailtext" subtitle={chosen?.email ?? "kein Empfänger"}>
            <label className="text-xs font-medium text-muted-foreground">Betreff<input value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground" /></label>
            <label className="mt-4 block text-xs font-medium text-muted-foreground">Text<textarea value={text} onChange={(event) => setText(event.target.value)} rows={12} className="mt-1 w-full rounded-lg border border-input px-3 py-2 font-mono text-sm text-foreground" /></label>
            <p className="mt-2 text-xs text-muted-foreground">Platzhalter: {"{anrede}"}, {"{mail}"}, {"{adresse}"}</p>
            <div className="mt-4 flex gap-2"><button className={buttonClass} onClick={() => setPreview(chosen ? render(chosen) : "")}>Vorschau</button><button disabled={!chosen} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40" onClick={openDraft}><MailIcon className="mr-2 inline h-4 w-4" />Entwurf öffnen</button></div>
          </Panel>
          <Panel title="Empfänger" subtitle="aktive Benutzer">
            <p className="mb-3 text-xs text-muted-foreground">Jeder Entwurf wird einzeln und mit der passenden Anrede geöffnet.</p>
            <div className="max-h-[480px] overflow-auto">{users.map((user) => <label key={user.id} className="flex items-center gap-3 border-t border-border py-3 text-sm"><input type="radio" name="mail-recipient" checked={selected === user.id} onChange={() => setSelected(user.id)} /><span className="flex-1"><span className="block font-medium">{user.email}</span><span className="text-xs text-muted-foreground">{`${user.vorname} ${user.nachname}`.trim()}</span></span>{user.passwortOffen && <span className="rounded-full bg-accent/10 px-2 py-1 text-xs">Passwort offen</span>}</label>)}</div>
          </Panel>
        </section>
        {preview && <Panel title="Vorschau" subtitle={chosen?.email}><pre className="whitespace-pre-wrap text-sm leading-6">{preview}</pre></Panel>}
      </main>
    </div>
  );
}

function Klr() {
  const { dash, journal } = useDash();
  const groups = Array.from(new Set(journal.map((row) => row.guvGruppe))).sort();
  const costRows = groups.map((group) => {
    const rows = journal.filter((row) => row.guvGruppe === group);
    return { group, values: dash.monate.map((_, index) => rows.filter((row) => row.monat === index + 1).reduce((sum, row) => sum + row.wert, 0)), count: rows.length };
  });
  const regionRows = aggregateKlrRegions(dash);
  const reconciliations = Array.from(new Set(journal.map((row) => `${row.belegkreis}|${row.kostentraeger}`))).map((key) => {
    const [belegkreis, kostentraeger] = key.split("|");
    const rows = journal.filter((row) => row.belegkreis === belegkreis && row.kostentraeger === kostentraeger);
    return { belegkreis, kostentraeger, belege: rows.length, saldo: sum(rows, "wert"), leistung: sum(rows, "leistung"), kvar: sum(rows, "kvar"), kfix: sum(rows, "kfix"), umlage: sum(rows, "umlage"), beitrag: sum(rows, "beitrag") };
  });
  return (
    <div>
      <PageHeader title="KLR und Deckungsbeiträge" subtitle="Kostenarten-, Kostenträgerrechnung und Abstimmung" />
      <main className="mx-auto max-w-[1500px] space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Leistung Kostenträger" value={regionRows.reduce((total, row) => total + row.leistung, 0)} hint="Projektaufträge" />
          <Kpi label="DB I" value={regionRows.reduce((total, row) => total + row.db1, 0)} hint="Leistung − variable Kosten" signed />
          <Kpi label="Fixe Projektkosten" value={regionRows.reduce((total, row) => total + row.kfix, 0)} hint="Auftrag_Journal" />
          <Kpi label="Ergebnis Akte" value={regionRows.reduce((total, row) => total + row.akte, 0)} hint="nach Umlage" signed />
        </section>
        <Panel title="Kostenartenrechnung" subtitle="GuV-Gruppen je Monat, SAP-Vorzeichen">
          <div className="overflow-auto"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-3 text-left">GuV-Gruppe</th>{dash.monate.map((month) => <th key={month} className="px-2 pb-3 text-right">{month.slice(0, 3)}</th>)}<th className="pb-3 text-right">Summe</th><th className="pb-3 text-right">Belege</th></tr></thead><tbody>{costRows.map((row) => <tr key={row.group} className="border-t border-border"><td className="py-2 font-medium">{row.group}</td>{row.values.map((value, index) => <td key={index} className="px-2 text-right">{eur(value)}</td>)}<td className="text-right font-semibold">{eur(row.values.reduce((total, value) => total + value, 0))}</td><td className="text-right">{row.count.toLocaleString("de-DE")}</td></tr>)}</tbody></table></div>
        </Panel>
        <Panel title="Kostenträgerrechnung" subtitle="DB-Staffel je Region">
          <DataTable rows={regionRows} cols={[
            { key: "r", label: "Region", render: (row) => row.region },
            { key: "l", label: "Leistung", right: true, render: (row) => eur(row.leistung) },
            { key: "v", label: "variable Kosten", right: true, render: (row) => eur(row.kvar) },
            { key: "d1", label: "DB I", right: true, render: (row) => eur(row.db1) },
            { key: "f", label: "fixe Kosten", right: true, render: (row) => eur(row.kfix) },
            { key: "d2", label: "DB II", right: true, render: (row) => eur(row.db2) },
            { key: "u", label: "Umlage", right: true, render: (row) => eur(row.umlage) },
            { key: "e", label: "Ergebnis Akte", right: true, render: (row) => eur(row.akte) },
          ]} />
        </Panel>
        <Panel title="Abstimmung" subtitle="Belegkreise gegen Kostenträger">
          <DataTable rows={reconciliations} cols={[
            { key: "b", label: "Belegkreis", render: (row) => row.belegkreis },
            { key: "k", label: "Kostenträger", render: (row) => row.kostentraeger },
            { key: "n", label: "Belege", right: true, render: (row) => row.belege.toLocaleString("de-DE") },
            { key: "s", label: "Saldo", right: true, render: (row) => eur(row.saldo) },
            { key: "l", label: "Leistung", right: true, render: (row) => eur(row.leistung) },
            { key: "v", label: "k_var", right: true, render: (row) => eur(row.kvar) },
            { key: "f", label: "k_fix", right: true, render: (row) => eur(row.kfix) },
            { key: "u", label: "Umlage", right: true, render: (row) => eur(row.umlage) },
            { key: "p", label: "Beitrag", right: true, render: (row) => eur(row.beitrag) },
          ]} />
        </Panel>
      </main>
    </div>
  );
}

function aggregateKlrRegions(dash: ReturnType<typeof useDash>["dash"]) {
  return Array.from(new Set(dash.orders.map((order) => order.region))).map((region) => {
    const rows = dash.orders.filter((order) => order.region === region);
    const leistung = rows.reduce((total, row) => total + row.leistung, 0);
    const kvar = rows.reduce((total, row) => total + row.kvar, 0);
    const kfix = rows.reduce((total, row) => total + row.kfix, 0);
    const umlage = rows.reduce((total, row) => total + row.umlage, 0);
    return { region, leistung, kvar, kfix, umlage, db1: leistung - kvar, db2: leistung - kvar - kfix, akte: leistung - kvar - kfix - umlage };
  });
}

function sum<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

const ebitdaContributionGroups = new Set([
  "1 Umsatzerlöse",
  "2 Bestandsveränderungen",
  "3 Sonstige betriebliche Erträge",
  "4 Materialaufwand",
  "5 Aufwand für bezogene Leistungen",
  "6 Personalaufwand",
  "8 Sonstige betriebliche Aufwendungen",
]);
const counterRows = [
  ["1 Umsatzerlöse", "Summe Umsatzerlöse", "beitrag"],
  ["2 Bestandsveränderungen", "Bestandsveraend. UE und FE", "beitrag"],
  ["3 Sonstige betriebliche Erträge", "Andere sonstige betriebliche Ertraege", "beitrag"],
  ["4 Materialaufwand", "Aufwendungen für RHB", "beitrag"],
  ["5 Aufwand für bezogene Leistungen", "Fremdleistungen", "beitrag"],
  ["6 Personalaufwand", "Personalaufwand", "beitrag"],
  ["8 Sonstige betriebliche Aufwendungen", "Sachkosten", "beitrag"],
  ["12 Periodenfremdes Ergebnis", "Neutrales Ergebnis", "wert"],
  ["7 Abschreibungen", "Abschreibungen", "wert"],
  ["10 Zinsergebnis", "Finanzergebnis", "wert"],
] as const;

function Countercheck() {
  const { dash, journal } = useDash();
  const [month, setMonth] = useState(Math.min(dash.letzterIst, 9));
  const rows = counterRows.map(([group, position, source]) => {
    const guv = dash.guv.find((row) => row.name === position)?.values[month - 1] ?? 0;
    const matching = journal.filter((row) => row.monat === month && row.guvGruppe === group);
    const bookings = source === "beitrag"
      ? matching.reduce((total, row) => total + row.beitrag, 0)
      : -matching.reduce((total, row) => total + row.wert, 0);
    return { group, position, guv, bookings, delta: guv - bookings };
  });
  const ebitda = dash.guv.find((row) => row.name === "EBITDA")?.values[month - 1] ?? 0;
  const journalEbitda = journal
    .filter((row) => row.monat === month && ebitdaContributionGroups.has(row.guvGruppe))
    .reduce((total, row) => total + row.beitrag, 0);
  return (
    <div>
      <PageHeader title="Gegenkontrolle" subtitle="GuV gegen die nach Kontenstamm zugeordneten Buchungen" />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <label className="block w-fit text-xs font-medium text-muted-foreground">Monat<select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="mt-1 block rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground">{dash.monate.slice(0, 9).map((name, index) => <option key={name} value={index + 1}>{name} {dash.jahr}</option>)}</select></label>
        <section className="grid gap-4 sm:grid-cols-3">
          <Kpi label={`EBITDA ${dash.monate[month - 1]}`} value={ebitda} hint="GuV-Zeile EBITDA" signed />
          <Kpi label="Buchungsableitung" value={journalEbitda} hint="Beitrag der Gruppen 1–6 und 8" signed />
          <Kpi label="Differenz" value={ebitda - journalEbitda} hint="GuV minus Buchungsableitung" signed />
        </section>
        <Panel title="Abgleich" subtitle={`${dash.monate[month - 1]} ${dash.jahr}`}>
          <div className="mb-4 rounded-lg bg-muted p-4 text-sm text-muted-foreground">Die GuV-Datei ist die Basis. Die Gegenrechnung rollt jede Buchung über den Kostenartenstamm auf ihre GuV-Gruppe. Abweichungen bleiben sichtbar und werden nicht mit Ersatzwerten ausgeglichen.</div>
          <DataTable rows={rows} cols={[
            { key: "p", label: "GuV-Zeile", render: (row) => <><p className="font-medium">{row.position}</p><p className="text-xs text-muted-foreground">{row.group}</p></> },
            { key: "g", label: "GuV", right: true, render: (row) => eur(row.guv) },
            { key: "b", label: "Buchungen", right: true, render: (row) => eur(row.bookings) },
            { key: "d", label: "Differenz", right: true, render: (row) => <span className={Math.abs(row.delta) >= 0.01 ? "text-negative" : "text-positive"}>{eur(row.delta)}</span> },
          ]} />
        </Panel>
      </main>
    </div>
  );
}

type AnnualItem = { title: string; for: string; source: string };
type AnnualGroup = { id: string; title: string; text?: string; items: AnnualItem[] };
const annualGroups: AnnualGroup[] = [
  { id: "recht", title: "Allgemeine und rechtliche Unterlagen", items: [
    ["Aktueller Handelsregisterauszug (HRB 3506 CB) und Gesellschaftsvertrag in gültiger Fassung", "S, W", "Geschäftsführung"],
    ["Gesellschafterliste und Gesellschafterbeschlüsse 2026 (Feststellung Vorjahresabschluss, Gewinnverwendung, Entlastung, Prüferwahl)", "S, W", "Geschäftsführung"],
    ["Protokolle von Gesellschafterversammlung und gegebenenfalls Aufsichts- oder Beirat", "W", "Geschäftsführung"],
    ["Geprüfter und festgestellter Jahresabschluss 2025 mit Prüfungsbericht", "S, W", "Kaufmännische Leitung"],
    ["Geschäftsführerverträge, Prokuren, Vollmachten, Delegation of Authority (DoA)", "W", "Geschäftsführung"],
    ["Verträge mit der Muttergesellschaft (Darlehensvertrag, gekündigter Cash-Pool-Vertrag, Konzernumlagen, Dienstleistungsverträge)", "S, W", "Kaufmännische Leitung"],
    ["Wesentliche Kunden- und Bauverträge mit Nachträgen (z. B. Currenta G22 LEV)", "W", "Projektleitung, Vertrieb"],
    ["Miet-, Leasing- und Wartungsverträge, Versicherungspolicen", "S, W", "Einkauf, Verwaltung"],
    ["Liste laufender Rechtsstreitigkeiten und strittiger Abrechnungen (z. B. Markgrafenbrücke)", "S, W", "Geschäftsführung, Rechtsberatung"],
    ["Organigramm und Kontenplan mit Änderungen 2026", "W", "Kaufmännische Leitung"],
  ].map(item) },
  { id: "sap", title: "Buchhaltung und Abschlussdaten aus SAP", items: [
    ["Summen- und Saldenliste Sachkonten zum 31.12.2026 (vorläufig und final)", "S, W", "Finanzbuchhaltung"],
    ["Debitoren- und Kreditoren-OP-Listen zum Stichtag mit Altersstruktur", "S, W", "Finanzbuchhaltung"],
    ["Journal bzw. FI-Einzelposten des Geschäftsjahres als Datenexport (GDPdU/GoBD-Format)", "W", "Finanzbuchhaltung, IT"],
    ["Kontennachweise mit Abstimmung jedes Bilanzkontos auf Nebenbücher und Belege", "S, W", "Finanzbuchhaltung"],
    ["Liste der manuellen Abschlussbuchungen mit Begründung und Freigabe", "W", "Finanzbuchhaltung, Controlling"],
    ["Abstimmung Hauptbuch zu Nebenbüchern (Debitoren, Kreditoren, Anlagen) und Verrechnungskonten auf null", "S, W", "Finanzbuchhaltung"],
    ["GuV und Bilanz nach Monaten sowie Vorjahresvergleich mit Erläuterung wesentlicher Abweichungen", "W", "Controlling"],
    ["Periodenabgrenzung Eingangsrechnungen Januar/Februar 2027 für Leistungen 2026", "S, W", "Finanzbuchhaltung, Einkauf"],
    ["Verfahrensdokumentation SAP und Berechtigungskonzept", "W", "IT, Kaufmännische Leitung"],
  ].map(item) },
  { id: "anlage", title: "Anlagevermögen und Inventur", text: "Die Inventur läuft zum Stichtag 15.10.2026 und ist bis 10.12.2026 kontrolliert abzuschließen. Bei einem vorverlegten Stichtag ist die wertmäßige Fortschreibung auf den 31.12.2026 nachzuweisen.", items: [
    ["Anlagenspiegel 2026 (Anschaffungskosten, Zugänge, Abgänge, Umbuchungen, AfA, Buchwerte)", "S, W", "Anlagenbuchhaltung"],
    ["Rechnungen zu Zugängen über der Wesentlichkeitsgrenze sowie Nachweise zu Abgängen (Verkaufsbelege, Verschrottung)", "S, W", "Anlagenbuchhaltung"],
    ["Liste der GWG und Sammelposten", "S", "Anlagenbuchhaltung"],
    ["Inventurrichtlinie (kaufmännische Dienstanweisung) mit Anlagen", "W", "Kaufmännische Leitung"],
    ["Unterschriebene Zähllisten und Inventurprotokolle je Region", "S, W", "Regionalleiter"],
    ["Abgleich Inventur zu Anlagenbuchhaltung mit Klärung der Differenzen, inklusive bisher voll als Aufwand gebuchter Maschinen", "S, W", "Anlagenbuchhaltung, Controlling"],
    ["Fortschreibungsrechnung 15.10. bis 31.12.2026", "S, W", "Controlling"],
    ["Vorräte Roh-, Hilfs- und Betriebsstoffe mit Bewertung und Gängigkeitsabschlägen", "S, W", "Einkauf, Controlling"],
    ["Nachweise zu außerplanmäßigen Abschreibungen (Wertminderung, Stilllegung)", "S, W", "Controlling"],
    ["Termin für die Inventurbeobachtung durch den Wirtschaftsprüfer", "W", "Kaufmännische Leitung"],
  ].map(item) },
  { id: "ul", title: "Unfertige Leistungen, Forderungen und Anzahlungen", text: "Das ist der Prüfungsschwerpunkt im Projektgeschäft, weil Erlösrealisierung und Bewertung der unfertigen Leistungen das Ergebnis direkt bestimmen.", items: [
    ["Auftragsliste zum Stichtag je Projekt (Auftragswert, Nachträge, angefallene Kosten, Leistungsstand, erwartete Gesamtkosten)", "S, W", "Controlling, Projektleitung"],
    ["Bewertung der unfertigen Leistungen (Konto 392000) mit Herstellungskostenschema und Nachweis der Gemeinkostenzuschläge", "S, W", "Controlling"],
    ["Verlustfreie Bewertung und Drohverlustrückstellungen je Verlustprojekt", "S, W", "Controlling, Projektleitung"],
    ["Abnahmeprotokolle für Projekte, die 2026 als Umsatz realisiert wurden", "W", "Projektleitung"],
    ["Schlussrechnungen, Aufmaße und Teilabnahmen zu Projekten mit Ende rund um den Stichtag", "W", "Projektleitung, Abrechnung"],
    ["Aufstellung erhaltener und angeforderter Anzahlungen je Projekt mit Abgrenzung zur unfertigen Leistung", "S, W", "Finanzbuchhaltung"],
    ["Forderungsliste mit Einzelwertberichtigungen, Pauschalwertberichtigung und Begründung", "S, W", "Finanzbuchhaltung, Controlling"],
    ["Nachweis der Zahlungseingänge nach dem Stichtag (Januar/Februar 2027)", "W", "Finanzbuchhaltung"],
    ["Factoring-Vertrag und Abrechnungen zum Stichtag, falls vorhanden", "S, W", "Finanzbuchhaltung"],
    ["Offene Gutschriftsverfahren (z. B. BASF) mit Stand der Bearbeitung", "S, W", "Abrechnung"],
    ["Strittige Forderungen und Nachträge mit Einschätzung zur Durchsetzbarkeit", "S, W", "Geschäftsführung, Rechtsberatung"],
  ].map(item) },
  { id: "liq", title: "Liquide Mittel, Finanzierung und Konzernverrechnung", text: "Durch die Umstellung vom Cash-Pool auf ein Darlehen zum 01.08.2026 braucht der Prüfer eine saubere Trennung beider Zeiträume.", items: [
    ["Kontoauszüge aller Bankkonten zum 31.12.2026 und Kassenprotokoll", "S, W", "Finanzbuchhaltung"],
    ["Bankbestätigungen (werden vom Prüfer direkt angefordert, Bankverbindungen und Ansprechpartner liefern)", "W", "Finanzbuchhaltung"],
    ["Abrechnung und Schlusssaldo Cash-Pool bis 31.07.2026", "S, W", "Finanzbuchhaltung"],
    ["Darlehensvertrag Muttergesellschaft, Tilgungs- und Zinsplan, Zinsabgrenzung zum Stichtag", "S, W", "Kaufmännische Leitung"],
    ["Nachweis der Wandlung Cash-Pool 0,8 Mio. EUR und des Liquiditätsdarlehens 1,5 Mio. EUR", "S, W", "Finanzbuchhaltung"],
    ["Saldenabstimmung aller Konzernverrechnungskonten mit der Muttergesellschaft (Intercompany)", "S, W", "Finanzbuchhaltung"],
    ["Sicherheiten, Bürgschaften, Avale und Patronatserklärungen", "S, W", "Kaufmännische Leitung"],
    ["Liquiditätsplanung und Unternehmensplanung 2027 als Nachweis für die Going-Concern-Annahme", "W", "Controlling"],
  ].map(item) },
  { id: "verb", title: "Verbindlichkeiten, Rückstellungen und Rechnungsabgrenzung", items: [
    ["Kreditoren-OP-Liste mit Abstimmung auf das Hauptbuch", "S, W", "Finanzbuchhaltung"],
    ["Saldenbestätigungen ausgewählter Lieferanten und Nachunternehmer (Auswahl trifft der Prüfer)", "W", "Finanzbuchhaltung"],
    ["Liste ausstehender Eingangsrechnungen für Leistungen 2026 (Nachunternehmer, Entsorgung, Gerätemiete)", "S, W", "Einkauf, Projektleitung"],
    ["Rückstellungsspiegel mit Anfangsbestand, Verbrauch, Auflösung, Zuführung und Berechnung je Position", "S, W", "Controlling"],
    ["Gewährleistungsrückstellung mit Herleitung (Einzelfälle und pauschaler Satz)", "S, W", "Controlling, Projektleitung"],
    ["Rückstellungen für Resturlaub, Überstunden, Tantiemen und Prämien", "S, W", "Personal"],
    ["Rückstellungen für Prozesskosten, Abschluss- und Prüfungskosten, Archivierung", "S, W", "Kaufmännische Leitung"],
    ["Entsorgungs- und Rückbauverpflichtungen aus laufenden Projekten", "S, W", "Projektleitung"],
    ["Aktive und passive Rechnungsabgrenzung mit Einzelnachweis (Versicherungen, Leasing, Wartung)", "S", "Finanzbuchhaltung"],
    ["Haftungsverhältnisse und sonstige finanzielle Verpflichtungen für den Anhang (Miet- und Leasingverpflichtungen, Bestellobligo)", "S, W", "Kaufmännische Leitung, Einkauf"],
  ].map(item) },
  { id: "personal", title: "Personal und Lohn", items: [
    ["Lohnjournal Januar bis Dezember 2026 mit Abstimmung auf die Personalaufwandskonten", "S, W", "Personal, Lohnbuchhaltung"],
    ["Abstimmung Lohnsteuer- und Sozialversicherungsverbindlichkeiten zum Stichtag", "S, W", "Lohnbuchhaltung"],
    ["Durchschnittliche Mitarbeiterzahl nach Gruppen für den Anhang", "S, W", "Personal"],
    ["Resturlaubs- und Überstundenliste zum 31.12.2026 je Mitarbeiter", "S, W", "Personal"],
    ["Vereinbarungen zu Tantiemen, Boni, Abfindungen und Altersteilzeit", "S, W", "Personal, Geschäftsführung"],
    ["Pensionszusagen mit versicherungsmathematischem Gutachten, falls vorhanden", "S, W", "Personal"],
    ["SOKA-BAU-Meldungen und Beitragsabrechnung, falls Bauhauptgewerbe", "S, W", "Lohnbuchhaltung"],
    ["Bezüge der Geschäftsführung für die Anhangangaben", "S, W", "Geschäftsführung"],
  ].map(item) },
  { id: "steuer", title: "Steuern", items: [
    ["Umsatzsteuer-Voranmeldungen 2026 und Abstimmung auf die Umsatzsteuerkonten", "S, W", "Finanzbuchhaltung"],
    ["Aufstellung der Umsatzsteuer nach § 13b UStG (Bauleistungen) als Leistender und Leistungsempfänger", "S", "Finanzbuchhaltung"],
    ["Freistellungsbescheinigungen der Nachunternehmer nach § 48b EStG (Bauabzugssteuer)", "S, W", "Einkauf, Finanzbuchhaltung"],
    ["Steuerbescheide und Vorauszahlungsbescheide 2026 (Körperschaftsteuer, Gewerbesteuer)", "S, W", "Kaufmännische Leitung"],
    ["Nachweise zu nicht abzugsfähigen Betriebsausgaben (Bewirtung, Geschenke, Bußgelder)", "S", "Finanzbuchhaltung"],
    ["Unterlagen zu Organschaft oder Steuerumlagevertrag mit der Muttergesellschaft, falls vorhanden", "S, W", "Kaufmännische Leitung"],
    ["Verrechnungspreisdokumentation für Konzernleistungen und Darlehenszins", "S, W", "Kaufmännische Leitung"],
    ["Ermittlung laufender und latenter Steuern (Differenzen Handels- zu Steuerbilanz)", "S, W", "Steuerberater, Controlling"],
    ["Stand laufender Betriebsprüfungen und offener Einsprüche", "S, W", "Kaufmännische Leitung"],
  ].map(item) },
  { id: "wp", title: "Zusätzlich für den Wirtschaftsprüfer", items: [
    ["Beschreibung des internen Kontrollsystems für Einkauf, Projektabrechnung, Zahlungsverkehr und Abschluss (Vier-Augen-Prinzip, Freigabegrenzen)", "W", "Kaufmännische Leitung"],
    ["Kaufmännisches Handbuch und Prozessbeschreibungen", "W", "Kaufmännische Leitung"],
    ["Risikomanagement- und Risikofrüherkennungssystem mit Risikobericht", "W", "Controlling"],
    ["Liste nahestehender Personen und Unternehmen mit Geschäftsvorfällen 2026", "W", "Geschäftsführung"],
    ["Adressen für Saldenbestätigungen von Banken, Kunden, Lieferanten und Rechtsanwälten", "W", "Finanzbuchhaltung"],
    ["Lagebericht (Wirtschaftsbericht, Prognose-, Chancen- und Risikobericht), falls pflichtig", "W", "Kaufmännische Leitung, Geschäftsführung"],
    ["Angaben zu Ereignissen nach dem Stichtag bis zur Aufstellung", "W", "Geschäftsführung"],
    ["Unterzeichnete Vollständigkeitserklärung der Geschäftsführung (Vordruck kommt vom Prüfer)", "W", "Geschäftsführung"],
    ["Konzern-Reporting-Package, falls die Muttergesellschaft ein Package verlangt", "W", "Controlling"],
  ].map(item) },
];

const annualDeadlines = [
  ["Inventurstichtag mit Inventurbeobachtung durch den Prüfer", "2026-10-15", "Kaufmännische Leitung"],
  ["Vorprüfung zu IKS, Anlagenzugängen und Projektbewertung", "2026-11-30", "Kaufmännische Leitung"],
  ["Inventur kontrolliert abgeschlossen", "2026-12-10", "Regionalleiter"],
  ["Adressen für Saldenbestätigungen an den Prüfer", "2026-12-15", "Finanzbuchhaltung"],
  ["Vorläufige Summen- und Saldenliste und OP-Listen", "2027-01-15", "Finanzbuchhaltung"],
  ["Projektbewertung, Rückstellungen und Abgrenzungen gebucht", "2027-01-31", "Controlling"],
  ["Vollständige Unterlagen an den Steuerberater", "2027-02-10", "Kaufmännische Leitung"],
  ["Hauptprüfung vor Ort", "2027-02-15", "Wirtschaftsprüfer"],
  ["Aufstellung von Jahresabschluss und Lagebericht", "2027-03-31", "Geschäftsführung"],
  ["Offenlegung im Unternehmensregister", "2027-12-31", "Kaufmännische Leitung"],
] as const;

function item(values: string[]): AnnualItem {
  return { title: values[0], for: values[1], source: values[2] };
}
type AnnualState = { schluessel: string; status: string; datum: string | null; dateiname: string | null };
const annualKey = (title: string) => {
  let hash = 2166136261;
  for (let index = 0; index < title.trim().length; index++) {
    hash ^= title.trim().charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `u-${(hash >>> 0).toString(36)}`;
};

function AnnualClosing() {
  const { dash } = useDash();
  const [entries, setEntries] = useState<Record<string, AnnualState>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"alle" | "offen" | "erledigt" | "ohne">("alle");
  const [message, setMessage] = useState("");
  const all = annualGroups.flatMap((group) => group.items);
  const load = () => fetch("/api/jahresabschluss").then((response) => response.json()).then((data) => setEntries(Object.fromEntries((data.eintraege ?? []).map((entry: AnnualState) => [entry.schluessel, entry]))));
  useEffect(() => { void load(); }, []);
  const save = async (target: AnnualItem, partial: Partial<AnnualState>, file?: File) => {
    const key = annualKey(target.title);
    const previous = entries[key] ?? { schluessel: key, status: "offen", datum: null, dateiname: null };
    const body: Record<string, unknown> = { ...previous, ...partial, schluessel: key };
    if (file) { body.dateiname = file.name; body.inhalt = await fileBase64(file); }
    const response = await fetch("/api/jahresabschluss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Speichern fehlgeschlagen."); return; }
    setMessage("Stand gespeichert.");
    await load();
  };
  const visible = (entry: AnnualItem) => {
    const state = entries[annualKey(entry.title)];
    if (filter === "offen" && (state?.status === "erledigt" || state?.status === "entfaellt")) return false;
    if (filter === "erledigt" && state?.status !== "erledigt") return false;
    if (filter === "ohne" && state?.dateiname) return false;
    return `${entry.title} ${entry.source} ${entry.for}`.toLocaleLowerCase("de").includes(search.toLocaleLowerCase("de"));
  };
  const done = all.filter((entry) => entries[annualKey(entry.title)]?.status === "erledigt").length;
  const docs = all.filter((entry) => entries[annualKey(entry.title)]?.dateiname).length;
  return (
    <div>
      <PageHeader title={`Jahresabschluss ${dash.jahr}`} subtitle="Unterlagenliste für Steuerberater und Wirtschaftsprüfer" />
      <main className="mx-auto max-w-[1500px] space-y-6 px-6 py-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Unterlagen" value={all.length} hint="vollständige Liste" plain />
          <Kpi label="Erledigt" value={done} hint={`von ${all.length}`} plain />
          <Kpi label="Dokumente hinterlegt" value={docs} hint={`${all.length - docs} ohne Dokument`} plain />
          <Kpi label="Unterlagenblöcke" value={annualGroups.length} hint="fachlich gegliedert" plain />
        </section>
        {message && <p className="rounded-lg bg-muted px-4 py-3 text-sm">{message}</p>}
        <div className="sticky top-0 z-10 flex flex-wrap gap-2 border-b border-border bg-background/95 py-4">
          {([["alle", "Alle"], ["offen", "Offen"], ["erledigt", "Erledigt"], ["ohne", "Ohne Dokument"]] as const).map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={`rounded-full border px-3 py-1.5 text-sm ${filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{label}</button>)}
          <label className="ml-auto flex min-w-64 items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm"><Search className="h-4 w-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Unterlage oder Quelle" className="w-full bg-transparent outline-none" /></label>
        </div>
        <Panel title="Terminplan" subtitle={`${annualDeadlines.length} Termine aus der Unterlagenliste`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-3">Termin</th><th className="pb-3">Datum</th><th className="pb-3">Verantwortlich</th></tr></thead>
              <tbody>{annualDeadlines.map(([title, date, source]) => <tr key={`${date}-${title}`} className="border-t border-border"><td className="py-3 font-medium">{title}</td><td className="whitespace-nowrap py-3">{new Date(`${date}T00:00:00`).toLocaleDateString("de-DE")}</td><td className="py-3 text-muted-foreground">{source}</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
        {annualGroups.map((group) => {
          const rows = group.items.filter(visible);
          if (!rows.length) return null;
          return <Panel key={group.id} title={group.title} subtitle={`${rows.length} Unterlagen`}>
            {group.text && <p className="mb-4 rounded-lg bg-muted p-4 text-sm text-muted-foreground">{group.text}</p>}
            <div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="pb-3">Unterlage</th><th className="pb-3">Für</th><th className="pb-3">Quelle</th><th className="pb-3">Status</th><th className="pb-3">Datum</th><th className="pb-3">Dokument</th></tr></thead><tbody>{rows.map((entry) => {
              const key = annualKey(entry.title), state = entries[key] ?? { schluessel: key, status: "offen", datum: null, dateiname: null };
              return <tr key={key} className="border-t border-border align-top"><td className="max-w-xl py-3 font-medium">{entry.title}</td><td className="py-3">{entry.for.split(",").map((value) => <span key={value} className="mr-1 rounded-full bg-muted px-2 py-1 text-xs">{value.trim()}</span>)}</td><td className="py-3 text-muted-foreground">{entry.source}</td><td className="py-2"><select value={state.status} onChange={(event) => void save(entry, { status: event.target.value })} className="rounded-lg border border-input bg-card px-2 py-1.5"><option value="offen">Offen</option><option value="in_arbeit">In Bearbeitung</option><option value="erledigt">Erledigt</option><option value="entfaellt">Entfällt</option></select></td><td className="py-2"><input type="date" value={state.datum ?? ""} onChange={(event) => void save(entry, { datum: event.target.value })} className="rounded-lg border border-input bg-card px-2 py-1.5" /></td><td className="py-2">{state.dateiname && <a className="mr-2 inline-flex items-center gap-1 font-medium text-primary" href={`/api/jahresabschluss?datei=${key}`}><Download className="h-3.5 w-3.5" />{state.dateiname}</a>}<label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs"><FileUp className="h-3.5 w-3.5" />{state.dateiname ? "Ersetzen" : "Dokument importieren"}<input type="file" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void save(entry, {}, file); }} /></label></td></tr>;
            })}</tbody></table></div>
          </Panel>;
        })}
      </main>
    </div>
  );
}
