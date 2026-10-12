'use client';

/**
 * Klicktour — geführter Rundgang durch das Cockpit.
 *
 * Der Vorgänger im Altsystem konnte innerhalb einer einzigen Seite Abschnitte
 * umschalten.  Das Cockpit besteht aus echten Seiten, deshalb muss die Tour
 * einen Seitenwechsel überstehen: Der Stand liegt im sessionStorage, nach dem
 * Laden meldet sich die Tour von selbst zurück und sucht ihr Ziel.
 *
 * Ein Schritt beschreibt, wo er hingehört (pfad), was er hervorhebt (sel) und
 * was er erklärt (text).  Findet er sein Element nicht — weil eine Auswertung
 * für das Jahr keine Daten hat —, erklärt er trotzdem weiter, nur ohne
 * Scheinwerfer.  Eine Tour bricht nie ab, weil eine Tabelle leer ist.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { TOUREN, type Schritt } from '@/lib/touren';

const SPEICHER = 'cockpit.klicktour';

type Stand = { tour: string; schritt: number };

const lies = (): Stand | null => {
  try {
    const r = sessionStorage.getItem(SPEICHER);
    return r ? JSON.parse(r) as Stand : null;
  } catch { return null; }
};
const schreib = (s: Stand | null) => {
  try {
    if (s) sessionStorage.setItem(SPEICHER, JSON.stringify(s));
    else sessionStorage.removeItem(SPEICHER);
  } catch { /* Sitzungsspeicher gesperrt – Tour läuft dann nur auf dieser Seite */ }
};

/** Nur der Pfad ohne Abfrageteil, für den Vergleich mit dem Schritt. */
const nurPfad = (p: string) => p.split('?')[0].replace(/\/$/, '') || '/';

export default function Klicktour() {
  const pfad = usePathname();
  const router = useRouter();
  const [stand, setStand] = useState<Stand | null>(null);
  const [rahmen, setRahmen] = useState<DOMRect | null>(null);
  const [suchend, setSuchend] = useState(false);
  const abbruch = useRef<number | null>(null);

  const tour = stand ? TOUREN[stand.tour] : null;
  const schritt: Schritt | null = tour ? tour.schritte[stand!.schritt] ?? null : null;

  /* Beim Laden – und nach jedem Seitenwechsel – den Stand aufnehmen. */
  useEffect(() => { setStand(lies()); }, [pfad]);

  const beenden = useCallback(() => {
    schreib(null); setStand(null); setRahmen(null);
    if (abbruch.current) { window.clearTimeout(abbruch.current); abbruch.current = null; }
  }, []);

  const springe = useCallback((zu: number) => {
    if (!tour) return;
    if (zu < 0) return;
    if (zu >= tour.schritte.length) { beenden(); return; }
    const neu = { tour: stand!.tour, schritt: zu };
    schreib(neu); setStand(neu); setRahmen(null);
    const ziel = tour.schritte[zu];
    if (ziel.pfad && nurPfad(ziel.pfad) !== nurPfad(pfad)) router.push(ziel.pfad);
  }, [tour, stand, pfad, router, beenden]);

  /* Element suchen.  Nach einem Seitenwechsel steht es nicht sofort im
     Dokument, deshalb wird eine Weile lang nachgesehen statt einmal geraten. */
  useEffect(() => {
    if (!schritt) { setRahmen(null); return; }
    if (schritt.pfad && nurPfad(schritt.pfad) !== nurPfad(pfad)) return;
    if (!schritt.sel) { setRahmen(null); setSuchend(false); return; }

    let lauf = 0;
    let weg = false;
    setSuchend(true);
    const suche = () => {
      if (weg) return;
      let el: Element | null = null;
      try { el = document.querySelector(schritt.sel!); } catch { el = null; }
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        window.setTimeout(() => {
          if (weg) return;
          const r = el!.getBoundingClientRect();
          setRahmen(r.width > 2 && r.height > 2 ? r : null);
          setSuchend(false);
        }, 320);
        return;
      }
      if (++lauf < 24) abbruch.current = window.setTimeout(suche, 120);
      else { setRahmen(null); setSuchend(false); }   // nicht da – Text steht trotzdem
    };
    suche();
    return () => { weg = true; if (abbruch.current) window.clearTimeout(abbruch.current); };
  }, [schritt, pfad]);

  /* Tastatur: Pfeile blättern, Escape beendet.
     ---------------------------------------------------------------------
     Die Pfeiltasten gehören zuerst dem Bedienelement, in dem der Cursor
     steht.  Ohne diese Ausnahme blättert die Tour weiter, waehrend jemand
     in einem Auswahlfeld die Region sucht – die Seite wechselt, und es
     sieht aus, als spraenge die Auswahl von selbst zurueck.
     Escape beendet die Tour trotzdem, aus jedem Feld heraus. */
  useEffect(() => {
    if (!stand) return;
    const imFeld = (z: EventTarget | null) => {
      const e = z as HTMLElement | null;
      if (!e || !e.tagName) return false;
      return ['INPUT', 'SELECT', 'TEXTAREA', 'OPTION'].includes(e.tagName)
          || e.isContentEditable;
    };
    const auf = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { beenden(); return; }
      if (imFeld(e.target)) return;                 // Feld hat Vorrang
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') springe(stand.schritt + 1);
      else if (e.key === 'ArrowLeft') springe(stand.schritt - 1);
    };
    document.addEventListener('keydown', auf);
    return () => document.removeEventListener('keydown', auf);
  }, [stand, springe, beenden]);

  /* Rahmen mitführen, wenn der Benutzer scrollt oder das Fenster ändert. */
  useEffect(() => {
    if (!rahmen || !schritt?.sel) return;
    const nach = () => {
      let el: Element | null = null;
      try { el = document.querySelector(schritt.sel!); } catch { el = null; }
      if (el) { const r = el.getBoundingClientRect(); setRahmen(r.width > 2 ? r : null); }
    };
    window.addEventListener('scroll', nach, true);
    window.addEventListener('resize', nach);
    return () => { window.removeEventListener('scroll', nach, true); window.removeEventListener('resize', nach); };
  }, [rahmen, schritt]);

  if (!stand || !tour || !schritt) return null;

  const wartetAufSeite = !!schritt.pfad && nurPfad(schritt.pfad) !== nurPfad(pfad);
  const letzter = stand.schritt === tour.schritte.length - 1;

  /* Sprechblase neben den Rahmen, sonst mittig. */
  const blase: React.CSSProperties = rahmen
    ? (() => {
        const platzUnten = window.innerHeight - rahmen.bottom;
        const oben = platzUnten > 220 ? rahmen.bottom + 14 : Math.max(14, rahmen.top - 234);
        const links = Math.min(Math.max(14, rahmen.left), window.innerWidth - 396);
        return { top: oben, left: links };
      })()
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="kt" role="dialog" aria-label={`Klicktour ${tour.titel}`}>
      {rahmen ? (
        <div className="kt-rahmen" style={{
          top: rahmen.top - 6, left: rahmen.left - 6,
          width: rahmen.width + 12, height: rahmen.height + 12,
        }} />
      ) : (
        <div className="kt-schleier" />
      )}

      <div className="kt-blase" style={blase}>
        <div className="kt-kopf">
          <span className="kt-titel">{tour.titel}</span>
          <button type="button" className="kt-schliessen" onClick={beenden} aria-label="Klicktour beenden">×</button>
        </div>

        {schritt.ort && <div className="kt-ort">{schritt.ort}</div>}
        <p className="kt-text">{schritt.text}</p>

        {wartetAufSeite && <p className="kt-warte">Seite wird geöffnet …</p>}
        {!wartetAufSeite && suchend && <p className="kt-warte">Stelle wird gesucht …</p>}
        {!wartetAufSeite && !suchend && !rahmen && schritt.sel && (
          <p className="kt-warte">
            Diese Stelle ist gerade nicht sichtbar – meist, weil für die Auswahl keine Daten vorliegen.
          </p>
        )}

        <div className="kt-fuss">
          <span className="kt-zaehler">Schritt {stand.schritt + 1} von {tour.schritte.length}</span>
          <span className="kt-knoepfe">
            <button type="button" className="btn klein" disabled={stand.schritt === 0}
                    onClick={() => springe(stand.schritt - 1)}>Zurück</button>
            <button type="button" className="btn primary klein"
                    onClick={() => springe(stand.schritt + 1)}>
              {letzter ? 'Fertig' : 'Weiter'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Startknopf für das Handbuch. */
export function TourKnopf({ tour, klasse }: { tour: string; klasse?: string }) {
  const router = useRouter();
  const t = TOUREN[tour];
  if (!t) return null;
  return (
    <button type="button" className={klasse ?? 'btn klein'}
            onClick={() => {
              schreib({ tour, schritt: 0 });
              const erster = t.schritte[0];
              if (erster.pfad) router.push(erster.pfad);
              else router.refresh();
            }}>
      ▶ Klicktour · {t.schritte.length} Schritte
    </button>
  );
}
