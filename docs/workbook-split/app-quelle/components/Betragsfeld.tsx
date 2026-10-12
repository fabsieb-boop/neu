'use client';

import { useState } from 'react';
import { betragLesen } from '@/lib/format';

/* ---------------------------------------------------------------------------
   Eingabefeld für Beträge
   ---------------------------------------------------------------------------
   Ein Textfeld, kein `type="number"`.  Beim Tippen bleibt stehen, was
   getippt wird; beim Verlassen wird auf deutsche Schreibweise gebracht.
   Damit lässt sich eine abgelesene Zahl wieder eintippen – mit Punkt, mit
   Komma, oder ganz ohne.
--------------------------------------------------------------------------- */

const zeigen = (n: number | null) =>
  n === null ? '' : n.toLocaleString('de-DE',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Betragsfeld({
  wert, onWert, id, placeholder = '0,00', style, ariaLabel,
}: {
  /** Der Wert als Zahl; null heisst leer. */
  wert: number | null;
  onWert: (n: number | null) => void;
  id?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const angezeigt = text ?? zeigen(wert);
  const ungueltig = text !== null && text.trim() !== '' && betragLesen(text) === null;

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={angezeigt}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={ungueltig || undefined}
      className={ungueltig ? 'feld-fehler' : undefined}
      style={{ textAlign: 'right', ...style }}
      onChange={e => { setText(e.target.value); onWert(betragLesen(e.target.value)); }}
      onBlur={() => setText(null)}
    />
  );
}
