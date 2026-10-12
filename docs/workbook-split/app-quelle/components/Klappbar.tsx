'use client';

import { useEffect, useLayoutEffect } from 'react';

/* useLayoutEffect laeuft vor dem Zeichnen, useEffect danach.  Mit useEffect
   sah man beim Oeffnen einer Seite fuer einen Moment alle Tabellen offen,
   bevor sie zuklappten – ein sichtbares Aufblitzen.  Auf dem Server gibt es
   kein Layout, deshalb dort die gewoehnliche Fassung. */
const useVorDemZeichnen = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/* ---------------------------------------------------------------------------
   Tabellen zuklappen
   ---------------------------------------------------------------------------
   Manche Seiten tragen ein Dutzend Tabellen untereinander.  Wer eine davon
   sucht, scrollt an allen anderen vorbei.  Deshalb bekommt jede Karte, in der
   eine Tabelle steckt, einen Schalter in der Kopfzeile.

   Das passiert hier und nicht in den Seiten: es sind rund neunzig Tabellen in
   zwanzig Dateien, und jede einzelne von Hand in ein <details> zu haengen
   waere neunzig Gelegenheiten, eine Klammer zu verlieren.

   Ohne JavaScript bleibt alles aufgeklappt – also genau so, wie es vorher
   war.  Der Zustand haelt je Seite und Karte im Browser des Nutzers; er
   verlaesst dessen Rechner nicht.
--------------------------------------------------------------------------- */

const SCHLUESSEL = (pfad: string, nr: number) => `klapp:${pfad}:${nr}`;

export default function Klappbar() {
  useVorDemZeichnen(() => {
    const pfad = window.location.pathname;
    const karten = Array.from(document.querySelectorAll<HTMLElement>('.card'))
      .filter(k => k.querySelector('.tablewrap') && k.querySelector('.card-head'));

    const aufraeumen: (() => void)[] = [];

    karten.forEach((karte, nr) => {
      const kopf = karte.querySelector<HTMLElement>('.card-head');
      if (!kopf || kopf.querySelector('.klapp')) return;

      const knopf = document.createElement('button');
      knopf.type = 'button';
      knopf.className = 'klapp';
      knopf.setAttribute('aria-expanded', 'true');

      const setzen = (zu: boolean) => {
        karte.classList.toggle('card-zu', zu);
        knopf.setAttribute('aria-expanded', String(!zu));
        knopf.title = zu ? 'Tabelle aufklappen' : 'Tabelle zuklappen';
        knopf.textContent = zu ? 'Zeigen' : 'Zuklappen';
      };

      /* Zugeklappt ist der Ausgangszustand: eine Seite mit zwoelf Tabellen
         zeigt sonst zwoelf Tabellen, von denen elf gerade niemanden
         interessieren.  Wer eine aufklappt, findet sie beim naechsten Besuch
         offen vor – die Entscheidung haelt je Seite und Karte. */
      let zu = true;
      try { zu = localStorage.getItem(SCHLUESSEL(pfad, nr)) !== 'auf'; } catch { /* egal */ }
      setzen(zu);

      const klick = () => {
        zu = !zu;
        setzen(zu);
        try { localStorage.setItem(SCHLUESSEL(pfad, nr), zu ? 'zu' : 'auf'); } catch { /* egal */ }
      };
      knopf.addEventListener('click', klick);
      kopf.appendChild(knopf);

      aufraeumen.push(() => { knopf.removeEventListener('click', klick); knopf.remove(); });
    });

    return () => aufraeumen.forEach(f => f());
  }, []);

  return null;
}
