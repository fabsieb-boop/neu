import Link from 'next/link';
import Klappbar from './Klappbar';
import Vorzeichen from './Vorzeichen';
import Klicktour from './Klicktour';
import Ausgabe from './Ausgabe';
import NavKlappen from './NavKlappen';
import React from 'react';

type Nav = { key: string; label: string; href: string; ico: string; recht?: string };

/* Die Leiste war mit sechsundzwanzig Eintraegen laenger als der Bildschirm.
   Jetzt sind die Gruppen zusammenklappbar: offen ist nur die, in der man
   gerade steht.  Umgesetzt mit <details>, damit es ohne JavaScript und ohne
   gespeicherten Zustand funktioniert – nach jedem Seitenwechsel oeffnet sich
   von selbst die richtige Gruppe.

   Was jeder taeglich braucht, steht ausserdem ganz oben und ohne Gruppe:
   Cockpit und Regionen. */
const SCHNELL: Nav[] = [
  { key: 'dashboard', label: 'Controlling-Dashboard 2026', href: '/dash',         ico: '◧' },
];

const NAV: { gruppe: string; items: Nav[] }[] = [
  {
    gruppe: 'Ergebnisrechnung',
    items: [
    ],
  },
  {
    gruppe: 'Planung',
    items: [
      { key: 'forecastplanung', label: 'Forecast-Planung',   href: '/dash#forecasteingabe', ico: '▦', recht: 'forecast.read' },
    ],
  },
  {
    gruppe: 'Berichte',
    items: [
    ],
  },
  {
    gruppe: 'Grundlagen',
    items: [
    ],
  },
  {
    gruppe: 'System',
    items: [
      { key: 'import',        label: 'Datenimport',       href: '/dash#importmanager', ico: '↧', recht: 'import.read' },
      { key: 'benutzer',      label: 'Benutzer & Rechte', href: '/benutzer',      ico: '◉', recht: 'users.read' },
      { key: 'einstellungen', label: 'Einstellungen',     href: '/einstellungen', ico: '⚙', recht: 'users.write' },
    ],
  },
];

/* Das Eigene steht unten beim Namen, nicht zwischen den Auswertungen. */
const PERSOENLICH: Nav[] = [
  { key: 'passwort', label: 'Passwort ändern',  href: '/passwort', ico: '⚿' },
  { key: 'app',      label: 'App aufs Telefon', href: '/app',      ico: '▢' },
];

export type ShellProps = {
  children: React.ReactNode;
  titel: string;
  bereich?: string;
  aktiv: string;
  aktion?: React.ReactNode;
  benutzer?: { email: string; vorname?: string; nachname?: string; rollen?: string[]; rechte?: string[] } | null;
};

export default function Shell({ children, titel, bereich, aktiv, aktion, benutzer }: ShellProps) {
  const name = benutzer
    ? [benutzer.vorname, benutzer.nachname].filter(Boolean).join(' ') || benutzer.email
    : null;
  // Sind keine Rechte bekannt, bleibt die Navigation vollständig sichtbar –
  // die Seite selbst prüft in jedem Fall.
  const rechte = benutzer?.rechte;
  const darf = (recht?: string) => !recht || !rechte || rechte.includes(recht);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div className="brand-text">
            <strong>CONTROLLING</strong>
            <span>Kosten- und Leistungsrechnung</span>
          </div>
          {/* Zuklappen auf eine Symbolspalte – die breiten Tabellen dieser
              Anwendung gewinnen dadurch 216 Pixel. */}
          <NavKlappen />
        </div>

        <nav className="nav">
          {/* Taeglich gebraucht – immer sichtbar, ohne Gruppe */}
          {SCHNELL.filter(i => darf(i.recht)).map(i => (
            <Link key={i.key} href={i.href} title={i.label}
                  className={`nav-item ${aktiv === i.key ? 'active' : ''}`}>
              <span className="ico">{i.ico}</span>
              <span className="nav-text">{i.label}</span>
            </Link>
          ))}

          {NAV.map(g => {
            const sichtbar = g.items.filter(i => darf(i.recht));
            if (!sichtbar.length) return null;
            // Offen ist die Gruppe, in der die aktuelle Seite steht.
            const hier = sichtbar.some(i => i.key === aktiv);
            return (
              <details key={g.gruppe} className="nav-gruppe" open={hier}>
                <summary className="nav-group">
                  <span>{g.gruppe}</span>
                  <span className="nav-zahl">{sichtbar.length}</span>
                </summary>
                {sichtbar.map(i => (
                  <Link key={i.key} href={i.href} title={i.label}
                        className={`nav-item ${aktiv === i.key ? 'active' : ''}`}>
                    <span className="ico">{i.ico}</span>
                    <span className="nav-text">{i.label}</span>
                  </Link>
                ))}
              </details>
            );
          })}
        </nav>

        <div className="nav-foot">
          {PERSOENLICH.filter(i => darf(i.recht)).map(i => (
            <Link key={i.key} href={i.href} title={i.label}
                  className={`nav-item klein ${aktiv === i.key ? 'active' : ''}`}>
              <span className="ico">{i.ico}</span>
              <span className="nav-text">{i.label}</span>
            </Link>
          ))}
        </div>
      </aside>

      {/* Der Kopf ist eine eigene Karte im Inhalt, keine angeheftete Leiste:
          Rubrik, Titel und darunter, wer angemeldet ist – rechts daneben die
          Schaltflaechen der Seite.  Der Name stand vorher unten in der
          Seitenspalte, wo ihn niemand suchte, und war beim Zuklappen weg. */}
      <div className="main">
        <div className="content">
          <header className="seitenkopf">
            <div className="seitenkopf-text">
              <span className="eyebrow">{bereich ?? 'Controlling'}</span>
              <h1>{titel}</h1>
              {name && (
                <p className="angemeldet">
                  Angemeldet als <b>{name}</b>
                  <span className="muted">
                    {' · '}{benutzer?.rollen?.length ? benutzer.rollen.join(', ') : 'Ohne Rolle'}
                  </span>
                </p>
              )}
            </div>
            <div className="kopf-aktionen">
              {aktion}
              {/* Auf jeder Seite verfuegbar – die Leiste liest die Tabellen,
                  die gerade angezeigt werden. */}
              <Ausgabe titel={titel} />
              <form action="/api/auth/logout" method="post">
                <button className="btn" type="submit">Abmelden</button>
              </form>
            </div>
          </header>
          {children}
        </div>
        <Klappbar />
        <Vorzeichen />
      </div>

      {/* Liegt ueber allem und meldet sich nur, wenn eine Tour laeuft. */}
      <Klicktour />
    </div>
  );
}

/**
 * Verweis auf eine Seite, die ein Recht verlangt.
 * Fehlt das Recht, bleibt der Text stehen, aber ohne Verweis – sonst
 * landen 28 von 32 Kollegen auf „kein Zugriff“.
 */
export function RechtLink({ benutzer, recht, href, children }: {
  benutzer?: { rechte?: string[] } | null;
  recht: string; href: string; children: React.ReactNode;
}) {
  const darf = !benutzer?.rechte || benutzer.rechte.includes(recht);
  if (!darf) return <span className="muted">{children}</span>;
  return <Link href={href} style={{ color: 'var(--accent)' }}>{children}</Link>;
}
