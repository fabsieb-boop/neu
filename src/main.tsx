import { type FormEvent, StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { App } from "@/App";
import { DataProvider } from "@/data";
import logo from "@/assets/tvf-logo.png";
import type { Dash, JournalRow, User } from "@/types";
import "@/styles.css";

function Root() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [dash, setDash] = useState<Dash | null>(null);
  const [journal, setJournal] = useState<JournalRow[] | null>(null);
  const [fehler, setFehler] = useState("");

  const loadData = useCallback(async (activeUser: User) => {
    const responses = await Promise.all([
      fetch("/api/dashboard"),
      fetch("/api/journal"),
    ]);
    if (responses.some((response) => response.status === 401)) {
      setUser(null);
      setDash(null);
      setJournal(null);
      return;
    }
    if (responses.some((response) => !response.ok)) {
      throw new Error("Die Zahlen konnten nicht geladen werden.");
    }
    const [nextDash, nextJournal] = await Promise.all(responses.map((response) => response.json()));
    setUser(activeUser);
    setDash(nextDash);
    setJournal(nextJournal);
  }, []);

  const loadSession = useCallback(async () => {
    setFehler("");
    try {
      const response = await fetch("/api/auth/me");
      if (response.status === 401) {
        setUser(null);
        return;
      }
      if (!response.ok) throw new Error("Die Anmeldung konnte nicht geprüft werden.");
      const result = await response.json() as { user: User };
      if (result.user.setup || result.user.passwortOffen) {
        setUser(result.user);
        setDash(null);
        setJournal(null);
        return;
      }
      await loadData(result.user);
    } catch (error) {
      setFehler(error instanceof Error ? error.message : "Die Anwendung konnte nicht geladen werden.");
    }
  }, [loadData]);

  useEffect(() => { void loadSession(); }, [loadSession]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setDash(null);
    setJournal(null);
  };

  if (fehler) return <p className="grid min-h-screen place-items-center px-6 text-center text-sm text-negative">{fehler}</p>;
  if (user === null) return <Login onLogin={loadSession} />;
  if (user?.setup) return <InitialSetup onComplete={() => setUser(null)} />;
  if (user?.passwortOffen) return <PasswordChange onChanged={loadSession} />;
  if (!user || !dash || !journal) return <p className="grid min-h-screen place-items-center text-sm text-muted-foreground">Zahlen werden geladen …</p>;
  return (
    <DataProvider value={{ dash, journal, user, updateDash: setDash, updateJournal: setJournal, logout }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </DataProvider>
  );
}

function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLaeuft(true);
    setFehler("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, passwort }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Die Anmeldung ist fehlgeschlagen.");
      await onLogin();
    } catch (error) {
      setFehler(error instanceof Error ? error.message : "Die Anmeldung ist fehlgeschlagen.");
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-primary px-6 py-12 text-primary-foreground">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-8 text-foreground shadow-2xl">
        <div className="mb-8 flex items-center gap-4">
          <img src={logo} alt="TVF Altwert" className="h-14 w-14 object-contain" />
          <div>
            <p className="font-display text-xl font-semibold">TVF Altwert</p>
            <p className="text-sm text-muted-foreground">Controlling-Cockpit</p>
          </div>
        </div>
        <div className="mb-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent"><LockKeyhole className="h-4 w-4" /> Anmeldung</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Willkommen zurück</h1>
        </div>
        <label className="mb-4 block text-sm font-medium">
          E-Mail
          <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-input px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <label className="block text-sm font-medium">
          Passwort
          <input type="password" autoComplete="current-password" required value={passwort} onChange={(event) => setPasswort(event.target.value)} className="mt-1.5 w-full rounded-lg border border-input px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
        </label>
        {fehler && <p role="alert" className="mt-4 rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">{fehler}</p>}
        <button disabled={laeuft} className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{laeuft ? "Anmeldung läuft …" : "Anmelden"}</button>
      </form>
    </main>
  );
}

function InitialSetup({ onComplete }: { onComplete: () => void }) {
  const [form, setForm] = useState({ email: "", passwort: "", vorname: "", nachname: "" });
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLaeuft(true);
    setFehler("");
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, rolle: "ADMIN" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Die Einrichtung ist fehlgeschlagen.");
      onComplete();
    } catch (error) {
      setFehler(error instanceof Error ? error.message : "Die Einrichtung ist fehlgeschlagen.");
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <AccountShell eyebrow="Ersteinrichtung" title="Administrator anlegen">
      <p className="mb-6 text-sm text-muted-foreground">Vor der Einrichtung werden keine Unternehmensdaten ausgeliefert. Dieser erste Zugang erhält die Rolle ADMIN.</p>
      <form onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <AccountField label="Vorname" value={form.vorname} onChange={(vorname) => setForm({ ...form, vorname })} />
          <AccountField label="Nachname" value={form.nachname} onChange={(nachname) => setForm({ ...form, nachname })} />
        </div>
        <AccountField label="E-Mail" type="email" autoComplete="username" required value={form.email} onChange={(email) => setForm({ ...form, email })} />
        <AccountField label="Passwort" type="password" autoComplete="new-password" required minLength={12} value={form.passwort} onChange={(passwort) => setForm({ ...form, passwort })} hint="mindestens 12 Zeichen, ein Buchstabe und eine Ziffer" />
        {fehler && <p role="alert" className="mt-4 rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">{fehler}</p>}
        <button disabled={laeuft} className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{laeuft ? "Einrichtung läuft …" : "Administrator anlegen"}</button>
      </form>
    </AccountShell>
  );
}

function PasswordChange({ onChanged }: { onChanged: () => Promise<void> }) {
  const [bisher, setBisher] = useState("");
  const [neu, setNeu] = useState("");
  const [wiederholung, setWiederholung] = useState("");
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (neu !== wiederholung) {
      setFehler("Die beiden neuen Passwörter stimmen nicht überein.");
      return;
    }
    setLaeuft(true);
    setFehler("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bisher, neu }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Das Passwort konnte nicht geändert werden.");
      await onChanged();
    } catch (error) {
      setFehler(error instanceof Error ? error.message : "Das Passwort konnte nicht geändert werden.");
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <AccountShell eyebrow="Sicherheit" title="Eigenes Passwort vergeben">
      <p className="mb-6 text-sm text-muted-foreground">Der Startzugang bleibt gesperrt, bis das Passwort einmal geändert wurde.</p>
      <form onSubmit={submit}>
        <AccountField label="Bisheriges Passwort" type="password" autoComplete="current-password" required value={bisher} onChange={setBisher} />
        <AccountField label="Neues Passwort" type="password" autoComplete="new-password" required minLength={12} value={neu} onChange={setNeu} hint="mindestens 12 Zeichen, ein Buchstabe und eine Ziffer" />
        <AccountField label="Neues Passwort wiederholen" type="password" autoComplete="new-password" required minLength={12} value={wiederholung} onChange={setWiederholung} />
        {fehler && <p role="alert" className="mt-4 rounded-lg bg-negative/10 px-3 py-2 text-sm text-negative">{fehler}</p>}
        <button disabled={laeuft} className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{laeuft ? "Passwort wird geändert …" : "Passwort ändern"}</button>
      </form>
    </AccountShell>
  );
}

function AccountShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-primary px-6 py-12 text-primary-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-white p-8 text-foreground shadow-2xl">
        <div className="mb-8 flex items-center gap-4">
          <img src={logo} alt="TVF Altwert" className="h-14 w-14 object-contain" />
          <div><p className="font-display text-xl font-semibold">TVF Altwert</p><p className="text-sm text-muted-foreground">Controlling-Cockpit</p></div>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        <h1 className="mb-3 mt-2 font-display text-3xl font-bold">{title}</h1>
        {children}
      </section>
    </main>
  );
}

function AccountField({ label, hint, onChange, ...props }: {
  label: string;
  hint?: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  return (
    <label className="mt-4 block text-sm font-medium">
      {label}
      <input {...props} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-lg border border-input px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
      {hint && <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Root /></StrictMode>);
