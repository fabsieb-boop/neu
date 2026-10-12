import React from 'react';
import { eur0, eurKurz, eurSkala, monatKurz, num } from '@/lib/format';

/* Serverseitig gerenderte SVG-Diagramme – kein Client-JavaScript notwendig. */

export type Serie = { label: string; farbe: string; werte: number[] };

/** Gruppiertes Säulendiagramm mit Nulllinie, z. B. Leistung vs. Kosten je Monat. */
export function SaeulenChart({
  monate, serien, hoehe = 260, einheit, achse = monatKurz,
}: { monate: number[]; serien: Serie[]; hoehe?: number;
     einheit?: (v: unknown) => string; achse?: (v: unknown) => string }) {
  if (!monate.length) return <div className="empty">Keine Daten für diesen Zeitraum.</div>;

  const W = 900, H = hoehe, L = 78, R = 16, T = 14, B = 30;
  const PW = W - L - R, PH = H - T - B;
  const alle = serien.flatMap(s => s.werte.map(num));
  // Eine Einheit fuer das ganze Bild, sonst stehen Mio., T und Euro
  // nebeneinander und die Saeulen lassen sich nicht mehr vergleichen.
  const fmt = einheit ?? eurSkala(alle);
  const max = Math.max(...alle, 0), min = Math.min(...alle, 0);
  const span = max - min || 1;
  const y = (v: number) => T + PH - ((v - min) / span) * PH;
  const y0 = y(0);
  const gruppeB = PW / monate.length;
  const balkenB = Math.max(4, (gruppeB * 0.72) / serien.length);
  const ticks = 4;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const v = min + (span * i) / ticks;
        return (
          <g key={i}>
            <line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className="axis" x={L - 8} y={y(v) + 4} textAnchor="end">{fmt(v)}</text>
          </g>
        );
      })}
      <line className="zero" x1={L} x2={W - R} y1={y0} y2={y0} />
      {monate.map((m, i) => {
        const gx = L + i * gruppeB + (gruppeB - balkenB * serien.length) / 2;
        return (
          <g key={m}>
            {serien.map((s, j) => {
              const v = num(s.werte[i]);
              const yv = y(v);
              return (
                <rect key={s.label} x={gx + j * balkenB} width={balkenB - 2}
                      y={Math.min(yv, y0)} height={Math.max(1, Math.abs(y0 - yv))}
                      fill={s.farbe} rx="2">
                  <title>{`${achse(m)} · ${s.label}: ${fmt(v)}`}</title>
                </rect>
              );
            })}
            <text className="axis" x={L + i * gruppeB + gruppeB / 2} y={H - 10} textAnchor="middle">
              {achse(m)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Linienverlauf, z. B. Deckungsbeitrag je Monat. */
export function LinienChart({
  monate, serien, hoehe = 220, einheit, achse = monatKurz, abNull = false,
}: { monate: number[]; serien: Serie[]; hoehe?: number;
     einheit?: (v: unknown) => string; achse?: (v: unknown) => string; abNull?: boolean }) {
  if (!monate.length) return <div className="empty">Keine Daten für diesen Zeitraum.</div>;

  const W = 900, H = hoehe, L = 78, R = 16, T = 14, B = 30;
  const PW = W - L - R, PH = H - T - B;
  const alle = serien.flatMap(s => s.werte.map(num));
  // Quoten liest man an ihrem eigenen Band, nicht ab null - sonst liegen
  // 88 % und 94 % uebereinander und der Verlauf verschwindet.
  const max = abNull ? Math.max(...alle, 0) : Math.max(...alle);
  const min = abNull ? Math.min(...alle, 0) : Math.min(...alle);
  const span = max - min || 1;
  const fmt = einheit ?? eurSkala(alle);
  const x = (i: number) => L + (monate.length === 1 ? PW / 2 : (i / (monate.length - 1)) * PW);
  const y = (v: number) => T + PH - ((v - min) / span) * PH;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const v = min + span * t;
        return (
          <g key={i}>
            <line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
            <text className="axis" x={L - 8} y={y(v) + 4} textAnchor="end">{fmt(v)}</text>
          </g>
        );
      })}
      {min <= 0 && max >= 0 && <line className="zero" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />}
      {serien.map(s => (
        <g key={s.label}>
          <polyline fill="none" stroke={s.farbe} strokeWidth="2.5" strokeLinejoin="round"
                    points={s.werte.map((v, i) => `${x(i)},${y(num(v))}`).join(' ')} />
          {s.werte.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(num(v))} r="3.5" fill="#fff" stroke={s.farbe} strokeWidth="2">
              <title>{`${achse(monate[i])} · ${s.label}: ${fmt(v)}`}</title>
            </circle>
          ))}
        </g>
      ))}
      {monate.map((m, i) => (
        <text key={m} className="axis" x={x(i)} y={H - 10} textAnchor="middle">{achse(m)}</text>
      ))}
    </svg>
  );
}

/**
 * Bricht eine Beschriftung auf hoechstens zwei Zeilen um, statt sie zu
 * kappen.  Vorher stand unter den Balken "Aufwand fuer bezoge" und
 * "Steuern vom Einkon" – und weil die Reste trotzdem zu breit waren,
 * liefen sie ineinander.
 */
function umbrechen(text: string, zeichen: number): string[] {
  if (text.length <= zeichen) return [text];
  const woerter = text.split(' ');
  const zeilen: string[] = [];
  let zeile = '';
  for (const w of woerter) {
    if (zeile && (zeile + ' ' + w).length > zeichen) { zeilen.push(zeile); zeile = w; }
    else zeile = zeile ? zeile + ' ' + w : w;
  }
  if (zeile) zeilen.push(zeile);
  if (zeilen.length <= 2) return zeilen;
  // Mehr als zwei Zeilen wuerden in die Balken laufen – der Rest wird gekuerzt.
  return [zeilen[0], zeilen.slice(1).join(' ').slice(0, zeichen - 1) + '…'];
}

/** Wasserfall über die Deckungsbeitragsstufen. */
export function WasserfallChart({
  schritte, hoehe = 300, einheit,
}: { schritte: { label: string; wert: number; typ: 'start' | 'ab' | 'zwischen' | 'ergebnis' }[];
     hoehe?: number; einheit?: (v: unknown) => string }) {
  if (!schritte.length) return <div className="empty">Keine Daten.</div>;
  const fmt = einheit ?? eurSkala(schritte.map(s => s.wert));

  const W = 900, H = hoehe, L = 78, R = 16, T = 16, B = 64;
  const PW = W - L - R, PH = H - T - B;

  let lauf = 0;
  const balken = schritte.map(s => {
    if (s.typ === 'start') { const von = 0, bis = s.wert; lauf = s.wert; return { ...s, von, bis }; }
    if (s.typ === 'ab')    { const von = lauf; lauf -= s.wert; return { ...s, von, bis: lauf }; }
    return { ...s, von: 0, bis: s.wert };
  });

  const werte = balken.flatMap(b => [b.von, b.bis, 0]);
  const max = Math.max(...werte), min = Math.min(...werte);
  const span = max - min || 1;
  const y = (v: number) => T + PH - ((v - min) / span) * PH;
  const bw = PW / balken.length;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const v = min + span * t;
        return <g key={i}>
          <line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text className="axis" x={L - 8} y={y(v) + 4} textAnchor="end">{fmt(v)}</text>
        </g>;
      })}
      <line className="zero" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
      {balken.slice(0, -1).map((b, i) => (
        <line key={`v${b.label}`} className="grid" strokeDasharray="3 3"
              x1={L + i * bw + bw * 0.16} x2={L + (i + 1) * bw + bw * 0.84}
              y1={y(b.bis)} y2={y(b.bis)} />
      ))}
      {balken.map((b, i) => {
        // Ein Abzug mit negativem Wert ist eine Entlastung und verbessert das Ergebnis.
        const fill = b.typ === 'start' ? '#2563eb'
                   : b.typ === 'ergebnis' ? '#0f172a'
                   : b.typ === 'ab' ? (b.wert < 0 ? '#0d9488' : '#e11d48')
                   : '#0d9488';
        const top = Math.min(y(b.von), y(b.bis));
        const h = Math.max(2, Math.abs(y(b.von) - y(b.bis)));
        return (
          <g key={b.label}>
            <rect x={L + i * bw + bw * 0.16} width={bw * 0.68} y={top} height={h} fill={fill} rx="2">
              <title>{`${b.label}: ${eur0(b.wert)}`}</title>
            </rect>
            {umbrechen(b.label, Math.floor(bw / 6.2)).map((zeile, k, alle) => (
              <text key={k} className="axis" x={L + i * bw + bw / 2}
                    y={H - 32 - (alle.length - 1 - k) * 12} textAnchor="middle">{zeile}</text>
            ))}
            <text className="axis" x={L + i * bw + bw / 2} y={H - 16} textAnchor="middle"
                  style={{ fill: fill, fontWeight: 600 }}>{fmt(b.wert)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Balken in einer Tabellenzelle. */
export function Balken({ wert, max, ton }: { wert: number; max: number; ton?: 'pos' | 'neg' }) {
  const p = max > 0 ? Math.min(100, (Math.abs(num(wert)) / max) * 100) : 0;
  const klasse = ton ?? (num(wert) < 0 ? 'neg' : 'pos');
  return <span className="bartrack"><i className={klasse} style={{ width: `${p}%` }} /></span>;
}

/* ==========================================================================
   Zweite Staffel: Anteile, Zusammensetzung, Rangfolgen, Streuung.

   Die vier Diagramme oben beantworten nur Fragen nach dem Verlauf.  Fuer die
   Auswertungsseiten fehlten die anderen drei Fragen: Woraus besteht es?
   Wer ist gross und wer klein?  Und wo liegt etwas gefaehrlich beieinander?
   ========================================================================== */

export type Scheibe = { label: string; wert: number; farbe: string };

/** Eine ruhige Farbreihe fuer Zusammensetzungen – erst kraeftig, dann leiser. */
export const FARBEN = ['#2563eb', '#0d9488', '#b45309', '#7c3aed', '#be123c',
                       '#0284c7', '#65a30d', '#c2410c', '#4f46e5', '#64748b'];

/**
 * Ringdiagramm fuer Anteile an einem Ganzen.  In der Mitte steht die Summe,
 * damit man nicht raten muss, worauf sich die Prozente beziehen.
 */
export function RingChart({
  scheiben, summenLabel, hoehe = 240, einheit,
}: { scheiben: Scheibe[]; summenLabel?: string; hoehe?: number; einheit?: (v: unknown) => string }) {
  const teile = scheiben.filter(s => num(s.wert) > 0);
  if (!teile.length) return <div className="empty">Keine Daten.</div>;

  const summe = teile.reduce((a, s) => a + num(s.wert), 0);
  // Die Einheit richtet sich nach der Summe in der Mitte, damit Mitte und
  // Beschriftung dieselbe Sprache sprechen.
  const fmt = einheit ?? eurSkala([summe]);
  const W = 900, H = hoehe;
  const cx = 160, cy = H / 2, r = Math.min(cy - 12, 104), dicke = 34;

  let winkel = -Math.PI / 2;
  const bogen = teile.map(s => {
    const anteilTeil = num(s.wert) / summe;
    const von = winkel, bis = winkel + anteilTeil * Math.PI * 2;
    winkel = bis;
    const gross = bis - von > Math.PI ? 1 : 0;
    const p = (rad: number, w: number) => `${cx + rad * Math.cos(w)},${cy + rad * Math.sin(w)}`;
    const ra = r, ri = r - dicke;
    // Ein voller Kreis laesst sich nicht als einzelner Bogen zeichnen.
    const d = anteilTeil > 0.999
      ? `M ${p(ra, 0)} A ${ra} ${ra} 0 1 1 ${p(ra, Math.PI)} A ${ra} ${ra} 0 1 1 ${p(ra, 0)} Z`
      : `M ${p(ra, von)} A ${ra} ${ra} 0 ${gross} 1 ${p(ra, bis)} L ${p(ri, bis)} A ${ri} ${ri} 0 ${gross} 0 ${p(ri, von)} Z`;
    return { ...s, d, anteilTeil };
  });

  const zeilenH = Math.min(22, (H - 20) / teile.length);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {bogen.map(b => (
        <path key={b.label} d={b.d} fill={b.farbe}>
          <title>{`${b.label}: ${fmt(b.wert)} (${(b.anteilTeil * 100).toFixed(1)} %)`}</title>
        </path>
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 19, fontWeight: 700, fill: '#0f172a' }}>
        {fmt(summe)}
      </text>
      {summenLabel && (
        <text x={cx} y={cy + 15} textAnchor="middle" className="axis">{summenLabel}</text>
      )}
      {bogen.map((b, i) => {
        const ty = (H - teile.length * zeilenH) / 2 + i * zeilenH + zeilenH / 2;
        return (
          <g key={`l${b.label}`}>
            <rect x={310} y={ty - 6} width={10} height={10} rx="2" fill={b.farbe} />
            <text x={330} y={ty + 3} style={{ fontSize: 12.5, fill: '#0f172a' }}>{b.label}</text>
            <text x={760} y={ty + 3} textAnchor="end" className="axis"
                  style={{ fill: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{fmt(b.wert)}</text>
            <text x={870} y={ty + 3} textAnchor="end" className="axis"
                  style={{ fontVariantNumeric: 'tabular-nums' }}>{(b.anteilTeil * 100).toFixed(1)} %</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Gestapelte Saeulen – zeigt Zusammensetzung und Summe in einem Bild.
 * Nur fuer Groessen gleichen Vorzeichens gedacht.
 */
export function StapelChart({
  kategorien, serien, hoehe = 280, einheit,
}: { kategorien: string[]; serien: Serie[]; hoehe?: number; einheit?: (v: unknown) => string }) {
  if (!kategorien.length) return <div className="empty">Keine Daten für diesen Zeitraum.</div>;

  const W = 900, H = hoehe, L = 78, R = 16, T = 14, B = 46;
  const PW = W - L - R, PH = H - T - B;
  const summen = kategorien.map((_, i) => serien.reduce((a, s) => a + Math.abs(num(s.werte[i])), 0));
  const max = Math.max(...summen, 0) || 1;
  const fmt = einheit ?? eurSkala(summen);
  const y = (v: number) => T + PH - (v / max) * PH;
  const bw = PW / kategorien.length;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <g key={i}>
          <line className="grid" x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} />
          <text className="axis" x={L - 8} y={y(max * t) + 4} textAnchor="end">{fmt(max * t)}</text>
        </g>
      ))}
      {kategorien.map((k, i) => {
        let unten = 0;
        return (
          <g key={k}>
            {serien.map(s => {
              const v = Math.abs(num(s.werte[i]));
              const oben = unten + v; const yo = y(oben), yu = y(unten); unten = oben;
              if (v <= 0) return null;
              return (
                <rect key={s.label} x={L + i * bw + bw * 0.16} width={bw * 0.68}
                      y={yo} height={Math.max(1, yu - yo)} fill={s.farbe}>
                  <title>{`${k} · ${s.label}: ${fmt(v)}`}</title>
                </rect>
              );
            })}
            <text className="axis" x={L + i * bw + bw / 2} y={H - 28} textAnchor="middle">{k}</text>
            <text className="axis" x={L + i * bw + bw / 2} y={H - 12} textAnchor="middle"
                  style={{ fill: '#0f172a', fontWeight: 600 }}>{fmt(summen[i])}</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Waagerechte Rangfolge.  Fuer Top- und Flopplisten lesbarer als eine Tabelle,
 * weil die Laenge den Abstand zeigt und nicht nur die Reihenfolge.
 */
export function RangChart({
  zeilen, hoehe, einheit, zweifarbig = true, farben,
}: { zeilen: { label: string; wert: number; hinweis?: string }[]; hoehe?: number;
     einheit?: (v: unknown) => string; zweifarbig?: boolean;
     /** Eigene Farben, wenn beide Richtungen ein Befund sind und Gruen taeuschen wuerde. */
     farben?: { positiv: string; negativ: string } }) {
  if (!zeilen.length) return <div className="empty">Keine Daten.</div>;

  const zh = 26, W = 900;
  const H = hoehe ?? zeilen.length * zh + 16;
  const L = 250, R = 96;
  const PW = W - L - R;
  const grenze = Math.max(...zeilen.map(z => Math.abs(num(z.wert))), 1);
  const fmt = einheit ?? eurSkala(zeilen.map(z => z.wert));
  const hatNegativ = zeilen.some(z => num(z.wert) < 0);
  const null_ = hatNegativ ? L + PW / 2 : L;
  const skala = hatNegativ ? PW / 2 / grenze : PW / grenze;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {hatNegativ && <line className="zero" x1={null_} x2={null_} y1={4} y2={H - 4} />}
      {zeilen.map((z, i) => {
        const v = num(z.wert);
        const b = Math.abs(v) * skala;
        const x = v < 0 ? null_ - b : null_;
        const y = 8 + i * zh;
        const farbe = !zweifarbig ? '#2563eb'
                    : farben ? (v < 0 ? farben.negativ : farben.positiv)
                    : v < 0 ? '#be123c' : '#0d9488';
        return (
          <g key={z.label + i}>
            <text x={L - 10} y={y + 13} textAnchor="end" style={{ fontSize: 12.5, fill: '#0f172a' }}>
              {z.label.length > 34 ? z.label.slice(0, 33) + '…' : z.label}
              <title>{z.label}</title>
            </text>
            <rect x={x} y={y + 3} width={Math.max(1, b)} height={zh - 12} fill={farbe} rx="2">
              <title>{`${z.label}: ${fmt(v)}${z.hinweis ? ' · ' + z.hinweis : ''}`}</title>
            </rect>
            <text x={W - 6} y={y + 13} textAnchor="end" className="axis"
                  style={{ fill: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Streubild, etwa Eintrittswahrscheinlichkeit gegen Schadenshoehe.  Die
 * Blasengroesse traegt den Betrag, damit drei Groessen in ein Bild passen.
 */
export function StreuChart({
  punkte, xLabel, yLabel, hoehe = 300, xEinheit = (v: number) => `${v}`, yEinheit,
}: { punkte: { x: number; y: number; groesse?: number; label: string; farbe?: string }[];
     xLabel: string; yLabel: string; hoehe?: number;
     xEinheit?: (v: number) => string; yEinheit?: (v: unknown) => string }) {
  if (!punkte.length) return <div className="empty">Keine Daten.</div>;

  const W = 900, H = hoehe, L = 78, R = 20, T = 16, B = 44;
  const PW = W - L - R, PH = H - T - B;
  const xMax = Math.max(...punkte.map(p => p.x), 1);
  const yMax = Math.max(...punkte.map(p => p.y), 1);
  const gMax = Math.max(...punkte.map(p => p.groesse ?? 1), 1);
  const yFmt = yEinheit ?? eurSkala(punkte.map(p => p.y));
  const px = (v: number) => L + (v / xMax) * PW;
  const py = (v: number) => T + PH - (v / yMax) * PH;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {/* Das obere rechte Viertel ist der Bereich, der wehtut. */}
      <rect x={px(xMax / 2)} y={T} width={PW / 2} height={PH / 2} fill="#be123c" opacity="0.05" />
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <g key={i}>
          <line className="grid" x1={L} x2={W - R} y1={py(yMax * t)} y2={py(yMax * t)} />
          <text className="axis" x={L - 8} y={py(yMax * t) + 4} textAnchor="end">{yFmt(yMax * t)}</text>
          <line className="grid" x1={px(xMax * t)} x2={px(xMax * t)} y1={T} y2={T + PH} />
          <text className="axis" x={px(xMax * t)} y={H - 26} textAnchor="middle">{xEinheit(xMax * t)}</text>
        </g>
      ))}
      {punkte.map((p, i) => (
        <circle key={i} cx={px(p.x)} cy={py(p.y)} r={6 + 12 * Math.sqrt((p.groesse ?? 1) / gMax)}
                fill={p.farbe ?? '#2563eb'} fillOpacity="0.55" stroke={p.farbe ?? '#2563eb'} strokeWidth="1.5">
          <title>{`${p.label}\n${xLabel}: ${xEinheit(p.x)}\n${yLabel}: ${yFmt(p.y)}`}</title>
        </circle>
      ))}
      <text className="axis" x={L + PW / 2} y={H - 8} textAnchor="middle" style={{ fontWeight: 600 }}>{xLabel}</text>
      <text className="axis" x={14} y={T + PH / 2} textAnchor="middle" style={{ fontWeight: 600 }}
            transform={`rotate(-90 14 ${T + PH / 2})`}>{yLabel}</text>
    </svg>
  );
}

/**
 * Kachelbild ueber zwei Achsen, etwa Region gegen Monat.  Zeigt auf einen
 * Blick, welche Zelle das Jahr traegt und welche es kostet.
 */
export function HeatmapChart({
  zeilen, spalten, werte, hoehe, einheit, mitte = 0, leerWert = null, beschriftung,
}: { zeilen: string[]; spalten: string[]; werte: (number | null)[][]; hoehe?: number;
     einheit?: (v: unknown) => string; mitte?: number; leerWert?: number | null;
     beschriftung?: number }) {
  if (!zeilen.length || !spalten.length) return <div className="empty">Keine Daten.</div>;

  // Die Beschriftungsspalte richtet sich nach dem laengsten Namen, sonst
  // werden "Aufwand fuer bezogene Leistungen" und Konsorten abgeschnitten.
  const W = 900;
  const L = beschriftung ?? Math.min(340, Math.max(120,
    Math.round(Math.max(...zeilen.map(z => z.length)) * 6.4) + 18));
  const R = 12, T = 26, B = 10;
  const zh = 30;
  const H = hoehe ?? T + zeilen.length * zh + B;
  const bw = (W - L - R) / spalten.length;
  // Die Farbe richtet sich nach dem Abstand zur Mitte, der angezeigte Wert
  // bleibt der echte.  Bei Quoten liegt die Mitte nicht bei null, sondern
  // dort, wo "gut" anfaengt.
  const abstand = (v: number) => v - mitte;
  const alle = werte.flat().filter(v => v !== null && v !== leerWert).map(v => abstand(num(v)));
  const grenze = Math.max(...alle.map(Math.abs), 1);
  // Ein Kachelbild lebt vom Vergleich der Kacheln untereinander.  Stehen in
  // einer Zeile "2,78 Mio. €" und in der naechsten "3.828 €", vergleicht
  // niemand mehr etwas – deshalb gilt fuer das ganze Gitter eine Einheit.
  const fmt = einheit ?? eurSkala(werte.flat().filter(v => v !== null));

  const farbe = (v: number) => {
    const d = abstand(v);
    const t = Math.min(1, Math.abs(d) / grenze);
    // Gruen fuer Beitrag, Rot fuer Verlust; die Saettigung traegt den Betrag.
    return d >= 0 ? `rgba(13,148,136,${0.10 + t * 0.78})` : `rgba(190,18,60,${0.10 + t * 0.78})`;
  };

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {spalten.map((s, j) => (
        <text key={s} className="axis" x={L + j * bw + bw / 2} y={T - 10} textAnchor="middle">{s}</text>
      ))}
      {zeilen.map((z, i) => (
        <g key={z}>
          <text x={L - 10} y={T + i * zh + zh / 2 + 4} textAnchor="end" style={{ fontSize: 12.5, fill: '#0f172a' }}>
            {z}<title>{z}</title>
          </text>
          {spalten.map((s, j) => {
            const roh = werte[i]?.[j];
            const leer = roh === null || roh === undefined || roh === leerWert;
            const v = num(roh);
            const hell = !leer && Math.abs(abstand(v)) / grenze > 0.55;
            return (
              <g key={s}>
                <rect x={L + j * bw + 1} y={T + i * zh + 2} width={bw - 2} height={zh - 4}
                      fill={leer ? '#f1f5f9' : farbe(v)} rx="3">
                  <title>{`${z} · ${s}: ${leer ? 'keine Daten' : eur0(v)}`}</title>
                </rect>
                {bw > 46 && !leer && (
                  <text x={L + j * bw + bw / 2} y={T + i * zh + zh / 2 + 4} textAnchor="middle"
                        style={{ fontSize: 10.5, fill: hell ? '#fff' : '#334155',
                                 fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(v)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

/** Winzige Verlaufslinie fuer eine Tabellenzelle. */
export function Sparkline({ werte, breite = 84, hoehe = 22 }: { werte: number[]; breite?: number; hoehe?: number }) {
  const w = werte.map(num);
  if (w.length < 2) return <span className="muted">–</span>;
  const max = Math.max(...w), min = Math.min(...w), span = max - min || 1;
  const x = (i: number) => (i / (w.length - 1)) * (breite - 2) + 1;
  const y = (v: number) => hoehe - 2 - ((v - min) / span) * (hoehe - 4);
  const letzter = w[w.length - 1];
  return (
    <svg width={breite} height={hoehe} viewBox={`0 0 ${breite} ${hoehe}`} style={{ verticalAlign: 'middle' }}>
      <line x1="1" x2={breite - 1} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeWidth="1"
            strokeDasharray="2 2" opacity={min < 0 && max > 0 ? 1 : 0} />
      <polyline fill="none" stroke={letzter < 0 ? '#be123c' : '#0d9488'} strokeWidth="1.6"
                strokeLinejoin="round" points={w.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
      <circle cx={x(w.length - 1)} cy={y(letzter)} r="2.2" fill={letzter < 0 ? '#be123c' : '#0d9488'} />
    </svg>
  );
}
