import Link from 'next/link';

/**
 * Unternavigation einer Seitengruppe.
 *
 * Volle Seiten sind in mehrere echte Unterseiten geteilt – jede mit eigener
 * Adresse, damit sich ein Verweis darauf setzen laesst und jede fuer sich
 * gedruckt und ausgegeben werden kann.  Diese Leiste haelt sie zusammen.
 *
 * Bewusst Links und keine Umschalter im Browser: der Server liefert nur den
 * Teil, den man sehen will, statt alles zu bauen und das meiste zu verbergen.
 */

export type Unterseite = {
  key: string;
  label: string;
  href: string;
  /** Kurzer Hinweis, was auf der Unterseite steht. */
  hinweis?: string;
};

export default function Unterseiten({ seiten, aktiv }: {
  seiten: Unterseite[];
  aktiv: string;
}) {
  const hier = seiten.find(s => s.key === aktiv);
  return (
    <nav className="unterseiten" aria-label="Bereiche dieser Seite">
      <div className="unterseiten-leiste">
        {seiten.map(s => (
          <Link key={s.key} href={s.href}
                className={`unterseite ${s.key === aktiv ? 'active' : ''}`}
                aria-current={s.key === aktiv ? 'page' : undefined}>
            {s.label}
          </Link>
        ))}
      </div>
      {hier?.hinweis && <p className="unterseiten-hinweis">{hier.hinweis}</p>}
    </nav>
  );
}
