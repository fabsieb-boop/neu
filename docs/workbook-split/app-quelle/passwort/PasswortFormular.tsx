'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Dieselben Regeln wie auf dem Server – hier nur, damit die Rückmeldung sofort kommt. */
function pruefen(passwort: string, email: string): string | null {
  if (passwort.length < 12) return 'Mindestens 12 Zeichen.';
  if (!/[a-zäöüß]/i.test(passwort)) return 'Mindestens ein Buchstabe.';
  if (!/[0-9]/.test(passwort)) return 'Mindestens eine Ziffer.';
  const name = email.split('@')[0]?.toLowerCase();
  if (name && name.length > 3 && passwort.toLowerCase().includes(name))
    return 'Der Benutzername darf nicht darin vorkommen.';
  return null;
}

export default function PasswortFormular({ email }: { email: string }) {
  const router = useRouter();
  const [alt, setAlt] = useState('');
  const [neu, setNeu] = useState('');
  const [wdh, setWdh] = useState('');
  const [zeigen, setZeigen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null);

  const regelfehler = neu ? pruefen(neu, email) : null;
  const passtNicht  = !!wdh && neu !== wdh;
  const bereit = !!alt && !!neu && !!wdh && !regelfehler && !passtNicht && !laeuft;

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    if (!bereit) return;
    setLaeuft(true); setMeldung(null);
    try {
      const a = await fetch('/api/passwort', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt, neu, wiederholung: wdh }),
      });
      const d = await a.json().catch(() => ({}));
      if (!a.ok) throw new Error(d.fehler || `Fehler ${a.status}`);
      setMeldung({ text: 'Das Passwort ist geändert. Es gilt ab der nächsten Anmeldung.' });
      setAlt(''); setNeu(''); setWdh('');
      router.refresh();
    } catch (err) {
      setMeldung({ text: (err as Error).message, fehler: true });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="card-head">
        <div>
          <div className="eyebrow">Eigenes Konto</div>
          <h2>Passwort ändern</h2>
          <p>Mindestens 12 Zeichen mit einer Ziffer. Länge zählt mehr als Sonderzeichen –
             ein langer Satz ist sicherer und leichter zu merken als <code>Xy7!q</code>.</p>
        </div>
      </div>
      <form className="card-body" onSubmit={absenden}>
        {meldung && (
          <div className={meldung.fehler ? 'note warn' : 'note'} style={{ marginBottom: 14 }}>
            {meldung.text}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="alt">Bisheriges Passwort</label>
          <input id="alt" type={zeigen ? 'text' : 'password'} value={alt} autoComplete="current-password"
                 onChange={e => setAlt(e.target.value)} required />
        </div>

        <div className="form-group">
          <label htmlFor="neu">Neues Passwort</label>
          <input id="neu" type={zeigen ? 'text' : 'password'} value={neu} autoComplete="new-password"
                 onChange={e => setNeu(e.target.value)} required
                 aria-invalid={!!regelfehler} aria-describedby="neu-hinweis" />
          <span id="neu-hinweis" className="hilfe" style={regelfehler ? { color: 'var(--warn)' } : undefined}>
            {regelfehler ?? (neu ? `${neu.length} Zeichen – in Ordnung.` : 'mindestens 12 Zeichen, davon eine Ziffer')}
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="wdh">Neues Passwort wiederholen</label>
          <input id="wdh" type={zeigen ? 'text' : 'password'} value={wdh} autoComplete="new-password"
                 onChange={e => setWdh(e.target.value)} required aria-invalid={passtNicht} />
          {passtNicht && (
            <span className="hilfe" style={{ color: 'var(--warn)' }}>
              Die beiden Eingaben stimmen nicht überein.
            </span>
          )}
        </div>

        <label className="toggle-check" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={zeigen} onChange={e => setZeigen(e.target.checked)} />
          <span>Passwörter anzeigen</span>
        </label>

        <div className="btn-group">
          <button type="submit" className="btn primary" disabled={!bereit}>
            {laeuft ? 'wird gespeichert …' : 'Passwort ändern'}
          </button>
        </div>
      </form>
    </div>
  );
}
