'use client';

/**
 * Seitenspalte zuklappen.
 *
 * Der Zustand steht als `data-nav` am <html>-Element und nicht in React:
 * ein Inline-Skript im Layout setzt ihn aus dem Speicher des Browsers,
 * bevor das erste Bild gezeichnet wird.  Ohne das blitzt bei jedem
 * Seitenwechsel kurz die offene Leiste auf, bevor sie zuklappt.
 *
 * Zugeklappt bleiben nur die Symbole stehen.  Die Gruppenueberschriften
 * verschwinden dabei – deshalb werden alle <details> geoeffnet, sonst
 * waere aus der Symbolspalte nur noch die Gruppe der aktuellen Seite
 * erreichbar.  Beim Aufklappen bleibt offen, was offen war; zuklappen
 * nach Gruppen macht die Anwendung, nicht dieser Schalter.
 */

import { useEffect, useState } from 'react';

function gruppenOeffnen() {
  document.querySelectorAll<HTMLDetailsElement>('details.nav-gruppe')
    .forEach(d => { d.open = true; });
}

export default function NavKlappen() {
  const [zu, setZu] = useState(false);

  // Beim ersten Bild ist der Zustand nur am <html>-Element bekannt.  Der
  // Knopf holt ihn sich von dort, damit sein Titel und sein Zeichen stimmen.
  useEffect(() => {
    const jetzt = document.documentElement.dataset.nav === 'zu';
    setZu(jetzt);
    if (jetzt) gruppenOeffnen();
  }, []);

  const umschalten = () => {
    const neu = !zu;
    setZu(neu);
    document.documentElement.dataset.nav = neu ? 'zu' : 'auf';
    if (neu) gruppenOeffnen();
    try { localStorage.setItem('nav', neu ? 'zu' : 'auf'); } catch { /* Privatmodus */ }
  };

  return (
    <button type="button" className="navklapp" onClick={umschalten}
            aria-expanded={!zu}
            title={zu ? 'Menü aufklappen' : 'Menü zuklappen'}
            aria-label={zu ? 'Menü aufklappen' : 'Menü zuklappen'}>
      {zu ? '»' : '«'}
    </button>
  );
}
