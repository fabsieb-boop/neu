'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect } from 'react';

/* Vor dem Zeichnen, nicht danach – sonst stehen die Zahlen fuer einen
   Moment schwarz da und werden erst dann rot. */
const useVorDemZeichnen = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/* ---------------------------------------------------------------------------
   Negative Zahlen sind rot
   ---------------------------------------------------------------------------
   Die Regel gilt im ganzen Haus: was unter null steht, ist rot; was darüber
   steht, bleibt schwarz oder ist grün, wo es eine Aussage trägt.

   Umgesetzt wird sie hier und nicht in den Seiten.  Rund dreihundert
   Tabellenzellen tragen `className="r num"` ohne Vorzeichenfarbe, verteilt
   über zwanzig Dateien; jede einzelne von Hand nachzuziehen hiesse
   dreihundert Gelegenheiten, eine zu vergessen – und die nächste neue Tabelle
   wäre wieder schwarz.

   Gelesen wird das Vorzeichen aus dem, was tatsächlich dasteht.  Genau das
   ist hier richtig: massgeblich ist die angezeigte Zahl, nicht der Rohwert.
   Eine auf null gerundete Zahl steht als "0 €" da und ist damit nicht
   negativ, auch wenn sie es vor dem Runden war.

   Zellen, die schon eine Farbe gesetzt haben, bleiben unangetastet – die
   Seite weiss mehr über ihre Zahl als dieser Durchlauf.
--------------------------------------------------------------------------- */

/* Minuszeichen und Bindestrich-Minus.  Ein alleinstehender Gedankenstrich
   ("–") ist keine Zahl, sondern der Platzhalter für "nicht vorhanden". */
const NEGATIV = /^\s*[-−]\s*\d/;

/* Nicht überall bedeutet ein Minus einen Verlust.  Im SAP-Export stehen
   Erlöse im Haben und damit negativ – dort ist eine Zahl mit Minus ein
   Ertrag und gehört keinesfalls rot.  Seiten, die die SAP-Vorzeichen
   unverändert zeigen, tragen `.sap` an der Tabelle oder
   `data-vorzeichen="sap"` am Abschnitt; alles darin bleibt unangetastet.
   Zellen, die ihre Farbe selbst setzen, ohnehin. */
const AUSGENOMMEN = '.sap, [data-vorzeichen="sap"]';

export default function Vorzeichen() {
  const pfad = usePathname();

  useVorDemZeichnen(() => {
    const zellen = document.querySelectorAll<HTMLElement>('.num');
    zellen.forEach(z => {
      if (z.classList.contains('pos') || z.classList.contains('neg')) return;
      if (z.closest(AUSGENOMMEN)) return;
      if (NEGATIV.test(z.textContent ?? '')) z.classList.add('neg', 'auto-neg');
    });

    return () => {
      document.querySelectorAll<HTMLElement>('.auto-neg')
        .forEach(z => z.classList.remove('neg', 'auto-neg'));
    };
  }, [pfad]);

  return null;
}
