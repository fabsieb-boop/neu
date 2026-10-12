'use client';

/**
 * Ausgabeleiste – Drucken (PDF) und Excel, auf jeder Seite.
 *
 * Die Zeilen sind genau das, was auf dem Bildschirm steht, mit allen
 * gesetzten Filtern. Gestaltet wird die Datei auf dem Server. Fällt der
 * Aufruf aus, schreibt der Browser eine schlichte Mappe als Ersatz.
 *
 * Drucken nutzt die Druckregeln der Anwendung: Navigation und Bedienelemente
 * fallen weg, Tabellenköpfe wiederholen sich auf jeder Seite.  Breite
 * Tabellen bekommen Querformat, sonst wird rechts abgeschnitten.
 */

import { useState } from 'react';

/* Deutsche Zahl aus einer Tabellenzelle lesen: "1.918.211 €" -> 1918211,
   "-8,7 %" -> -8.7.  Alles andere bleibt Text. */
function alsZahl(text: string): number | null {
  // Intl setzt je nach Umgebung das typografische Minus (U+2212) statt des
  // Bindestrichs; ohne diese Umschrift kaeme jeder negative Betrag als Text an.
  const t = text.trim().replace(/\u2212/g, '-').replace(/\u00a0/g, ' ');
  if (!t || t === '–' || t === '-') return null;
  if (!/^[-+]?[\d.,\s]+\s*(€|%)?$/.test(t)) return null;
  const roh = t.replace(/[€%\s]/g, '').replace(/\./g, '').replace(',', '.');
  if (roh === '' || roh === '-' || roh === '+') return null;
  const z = Number(roh);
  return Number.isFinite(z) ? z : null;
}

/** Zellen einer Zeile einlesen und dabei Spaltenverbünde auffüllen. */
function zeileLesen(tr: HTMLTableRowElement): (string | number)[] {
  const aus: (string | number)[] = [];
  for (const z of Array.from(tr.cells)) {
    // Der Rechenweg unter einer Position gehoert nicht in die Tabelle
    const kopie = z.cloneNode(true) as HTMLElement;
    kopie.querySelectorAll('.formula, .kt-blase').forEach(e => e.remove());
    const text = (kopie.innerText || '').replace(/\s+/g, ' ').trim();
    const zahl = z.classList.contains('num') ? alsZahl(text) : null;
    aus.push(zahl === null ? text : zahl);
    for (let i = 1; i < (z.colSpan || 1); i++) aus.push('');
  }
  return aus;
}

function blattname(tabelle: HTMLTableElement, nr: number): string {
  const karte = tabelle.closest('.card');
  const h = karte?.querySelector('.card-head h2, h2');
  const roh = (h?.textContent || `Tabelle ${nr}`).replace(/\s+/g, ' ').trim();
  // Excel erlaubt 31 Zeichen und diese Zeichen nicht: : \ / ? * [ ]
  return (roh.replace(/[:\\/?*[\]]/g, '-').slice(0, 31)) || `Tabelle ${nr}`;
}

export default function Ausgabe({ titel }: { titel: string }) {
  const [laeuft, setLaeuft] = useState<null | 'excel'>(null);

  const stempel = () => {
    const d = new Date();
    const z = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}`;
  };

  function drucken() {
    /* Breite Tabellen im Querformat drucken.  Die Regel muss zum
       Druckzeitpunkt im Dokument stehen; @page laesst sich nicht ueber
       eine Klasse steuern. */
    const breit = Array.from(document.querySelectorAll('table'))
      .some(t => t.scrollWidth > 720);
    let stil: HTMLStyleElement | null = null;
    if (breit) {
      stil = document.createElement('style');
      stil.textContent = '@page { size: A4 landscape; margin: 12mm 10mm; }';
      document.head.appendChild(stil);
    }
    window.print();
    // Nach dem Druckdialog wieder entfernen, sonst gilt Querformat weiter.
    window.setTimeout(() => stil?.remove(), 1000);
  }

  async function excel() {
    setLaeuft('excel');
    try {
      const bereich = document.querySelector('.content') ?? document.body;
      const tabellen = Array.from(bereich.querySelectorAll('table')) as HTMLTableElement[];
      const vergeben = new Set<string>();
      const blaetter: { name: string; titel: string; zeilen: (string | number)[][] }[] = [];
      let n = 0;

      for (const t of tabellen) {
        const zeilen = Array.from(t.rows).map(zeileLesen).filter(z => z.some(v => v !== ''));
        if (zeilen.length < 2) continue;                  // leere oder Ein-Zeilen-Tabelle
        n++;
        let name = blattname(t, n);
        let lauf = 2;
        while (vergeben.has(name)) name = `${blattname(t, n).slice(0, 27)} (${lauf++})`;
        vergeben.add(name);
        blaetter.push({ name, titel: name, zeilen });
      }

      if (!blaetter.length) { alert('Auf dieser Seite steht keine Tabelle zum Ausgeben.'); return; }

      const datei = `${titel.replace(/[^\wÄÖÜäöüß -]/g, '').trim().replace(/\s+/g, '-')}_${stempel()}.xlsx`;
      const stand = new Date().toLocaleDateString('de-DE');
      let gestaltet = false;
      try {
        const res = await fetch('/api/export/excel', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titel, untertitel: `Stand ${stand}`, dateiname: datei, blaetter }),
        });
        if (!res.ok) throw new Error('export');
        const blob = await res.blob();
        if (blob.size < 64) throw new Error('leer');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = datei;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
        gestaltet = true;
      } catch { /* schlichte Mappe als Ersatz */ }

      if (gestaltet) return;

      const XLSX = await import('xlsx');
      const mappe = XLSX.utils.book_new();
      for (const blattDaten of blaetter) {
        const blatt = XLSX.utils.aoa_to_sheet(blattDaten.zeilen);
        const breiten = blattDaten.zeilen[0].map((_, i) =>
          ({ wch: Math.min(46, Math.max(10, ...blattDaten.zeilen.map(z => String(z[i] ?? '').length + 2))) }));
        (blatt as { [k: string]: unknown })['!cols'] = breiten;
        XLSX.utils.book_append_sheet(mappe, blatt, blattDaten.name);
      }
      XLSX.writeFile(mappe, datei, { compression: true });
    } catch {
      alert('Der Export ist fehlgeschlagen. Bitte die Seite neu laden und erneut versuchen.');
    } finally {
      setLaeuft(null);
    }
  }

  return (
    <span className="ausgabe">
      <button type="button" className="btn klein" onClick={drucken}
              title="Druckansicht öffnen – dort lässt sich „Als PDF sichern“ wählen">
        Drucken / PDF
      </button>
      <button type="button" className="btn klein" onClick={excel} disabled={laeuft === 'excel'}>
        {laeuft === 'excel' ? 'Erzeuge …' : 'Excel'}
      </button>
    </span>
  );
}
