import React from 'react';

/**
 * Ein Hinweis als Aufklapper statt als Absatz.
 *
 * Die Erlaeuterungen zu Abstimmung und offenem Bestand standen als breite
 * Kaesten ueber den Kopfzahlen und schoben das eigentliche Ergebnis nach
 * unten.  Wer die Lage kennt, will sie nicht jeden Tag lesen; wer sie nicht
 * kennt, braucht sie vollstaendig.  Beides geht nur, wenn der Text auf
 * Abruf erscheint.
 *
 * Umgesetzt mit dem Popover-Verhalten des Browsers, nicht mit eigenem
 * JavaScript: der Kasten liegt in der obersten Ebene, Escape schliesst ihn,
 * ein Klick daneben ebenfalls, und ohne JavaScript bleibt er als Text
 * lesbar.
 */
export default function Hinweis({
  id, ton = 'info', kurz, titel, children,
}: {
  id: string;
  ton?: 'info' | 'warn' | 'pos' | 'neg';
  /** Was auf dem Knopf steht – die Aussage, nicht das Wort „Hinweis“. */
  kurz: React.ReactNode;
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <button type="button" className={`hinweischip ${ton}`} popoverTarget={id} title={titel}>
        <i className="punkt" />
        <span>{kurz}</span>
        <span className="mehr">ansehen</span>
      </button>
      <div id={id} popover="auto" className={`hinweispopup ${ton}`}>
        <div className="kopf">
          <b>{titel}</b>
          <button type="button" className="zu" popoverTarget={id} popoverTargetAction="hide"
                  aria-label="Schließen">×</button>
        </div>
        <div className="text">{children}</div>
      </div>
    </>
  );
}

/** Nimmt mehrere Hinweise in einer Zeile auf. */
export function Hinweisleiste({ children }: { children: React.ReactNode }) {
  return <div className="hinweisleiste">{children}</div>;
}
