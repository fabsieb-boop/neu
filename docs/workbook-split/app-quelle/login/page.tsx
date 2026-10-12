'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('fehler');
    if (f === 'gesperrt') setFehler('Das Konto ist nach mehreren Fehlversuchen für 15 Minuten gesperrt.');
    else if (f) setFehler('E-Mail-Adresse oder Passwort ist falsch.');
  }, []);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setLaeuft(true); setFehler('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: passwort }),
      });
      const d = await r.json();
      if (d.ok) { router.push(d.passwort_aendern ? '/passwort' : '/'); router.refresh(); }
      else setFehler(d.error === 'ACCOUNT_LOCKED'
        ? 'Das Konto ist nach mehreren Fehlversuchen für 15 Minuten gesperrt.'
        : 'E-Mail-Adresse oder Passwort ist falsch.');
    } catch {
      setFehler('Der Anmeldedienst ist nicht erreichbar.');
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <main className="login-wrap">
      <div className="login-card">
        <img className="login-marke" src="/api/pwa/icon-192.png" width="84" height="84" alt="TVF Altwert" />

        <h1>Anmelden</h1>
        <p>TVF Altwert Controlling. Bitte mit dem Firmenkonto anmelden.</p>

        {fehler && <div className="login-err">{fehler}</div>}

        <form method="post" action="/api/auth/login" onSubmit={absenden}>
          <div className="field">
            <label htmlFor="email">E-Mail-Adresse</label>
            <input id="email" name="email" type="email" value={email} autoComplete="username" required
                   onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pw">Passwort</label>
            <input id="pw" name="password" type="password" value={passwort} autoComplete="current-password" required
                   onChange={e => setPasswort(e.target.value)} />
          </div>
          <button className="btn primary" type="submit" disabled={laeuft}>
            {laeuft ? 'Anmeldung läuft …' : 'Anmelden'}
          </button>
        </form>
      </div>
    </main>
  );
}
