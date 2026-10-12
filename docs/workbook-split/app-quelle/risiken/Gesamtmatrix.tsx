import Link from 'next/link';
import { eur0, zahl, num } from '@/lib/format';

type Risiko = {
  id: string; projekt_nr: string; projektname: string | null; region: string;
  bezeichnung: string; kategorie: string; wahrscheinlichkeit: number;
  kosten_wahrsch: number; brutto: number; ziel: number; netto: number;
  massnahmen: number; massnahmen_offen: number;
};

/* Dieselben Achsen wie auf der Auftragsseite – eine Matrix, die je nach
   Ansicht anders schneidet, wäre wertlos. */
const WAHRSCHEINLICHKEIT = [
  { bis: 0.10, text: 'sehr gering', kurz: '≤10 %' },
  { bis: 0.25, text: 'gering',      kurz: '≤25 %' },
  { bis: 0.50, text: 'mittel',      kurz: '≤50 %' },
  { bis: 0.75, text: 'hoch',        kurz: '≤75 %' },
  { bis: 1.01, text: 'sehr hoch',   kurz: '>75 %' },
];
const AUSWIRKUNG = [
  { bis: 25_000,   text: 'gering',    kurz: '≤25 T€' },
  { bis: 100_000,  text: 'spürbar',   kurz: '≤100 T€' },
  { bis: 250_000,  text: 'erheblich', kurz: '≤250 T€' },
  { bis: 500_000,  text: 'schwer',    kurz: '≤500 T€' },
  { bis: Infinity, text: 'kritisch',  kurz: '>500 T€' },
];
const stufe = (w: number, skala: { bis: number }[]) =>
  Math.max(0, skala.findIndex(s => w <= s.bis));
function ton(w: number, a: number) {
  const s = (w + 1) * (a + 1);
  return s >= 16 ? 'kritisch' : s >= 9 ? 'hoch' : s >= 4 ? 'mittel' : 'gering';
}

export default function Gesamtmatrix({ risiken, umfang }: {
  risiken: Risiko[];
  /** Worauf sich die Matrix bezieht – ohne das las man „Alle Projekte“
   *  auch dann, wenn nur eine Region gewaehlt war. */
  umfang?: string;
}) {
  if (!risiken.length) return null;

  const platziert = risiken.map(r => ({
    r,
    w: stufe(num(r.wahrscheinlichkeit), WAHRSCHEINLICHKEIT),
    a: stufe(num(r.kosten_wahrsch), AUSWIRKUNG),
  }));

  const brutto = risiken.reduce((s, r) => s + num(r.brutto), 0);
  const ziel   = risiken.reduce((s, r) => s + num(r.ziel), 0);
  const netto  = risiken.reduce((s, r) => s + num(r.netto), 0);
  const ohneMassnahme = risiken.filter(r => !num(r.massnahmen)).length;

  /* Die schwersten Felder zuerst: was oben rechts liegt, entscheidet. */
  const kritisch = platziert
    .filter(p => ton(p.w, p.a) === 'kritisch' || ton(p.w, p.a) === 'hoch')
    .sort((x, y) => num(y.r.netto) - num(x.r.netto))
    .slice(0, 10);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="eyebrow">{umfang ?? 'Alle Projekte'}</div>
          <h2>Risikomatrix</h2>
        </div>
      </div>

      <div className="card-body">
        <div className="risiko-kpis">
          <div><span className="l">Brutto-Risiko</span><span className="v num">{eur0(brutto)}</span></div>
          <div><span className="l">Geplante Minderung</span><span className="v num">{eur0(ziel)}</span></div>
          <div><span className="l">Netto-Risiko</span>
               <span className={`v num ${netto > 0 ? 'neg' : 'pos'}`}>{eur0(netto)}</span></div>
          <div><span className="l">Ohne Maßnahme</span>
               <span className="v num">{zahl(ohneMassnahme)}</span></div>
        </div>

        <div className="matrixwrap">
          <table className="matrix">
            <thead>
              <tr>
                <th className="ecke">Auswirkung ↓ / Eintritt →</th>
                {WAHRSCHEINLICHKEIT.map(w => (
                  <th key={w.text}>{w.text}<div className="kurz">{w.kurz}</div></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AUSWIRKUNG.map((_, ai) => ai).reverse().map(ai => (
                <tr key={ai}>
                  <th className="zeile">{AUSWIRKUNG[ai].text}
                    <div className="kurz">{AUSWIRKUNG[ai].kurz}</div></th>
                  {WAHRSCHEINLICHKEIT.map((_, wi) => {
                    const drin = platziert.filter(p => p.w === wi && p.a === ai);
                    const summe = drin.reduce((s, p) => s + num(p.r.netto), 0);
                    return (
                      <td key={wi} className={`feld ${ton(wi, ai)} ${drin.length ? 'belegt' : ''}`}>
                        {!!drin.length && (
                          <>
                            <div className="anzahl">{drin.length}</div>
                            <div className="betrag num">{eur0(summe)}</div>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!!kritisch.length && (
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr><th>Risiko</th><th>Projekt</th><th>Region</th><th>Kategorie</th>
                    <th className="r">Eintritt</th><th className="r">Netto</th>
                    <th>Maßnahmen</th></tr>
              </thead>
              <tbody>
                {kritisch.map(({ r }) => (
                  <tr key={r.id}>
                    <td>{r.bezeichnung}</td>
                    <td>
                      <Link href={`/projekte/${r.projekt_nr}`}>{r.projekt_nr}</Link>
                      {r.projektname && (
                        <div className="muted" style={{ fontSize: 11.5 }}>{r.projektname}</div>
                      )}
                    </td>
                    <td className="muted">{r.region}</td>
                    <td className="muted">{r.kategorie}</td>
                    <td className="r num">{(num(r.wahrscheinlichkeit) * 100).toFixed(0)} %</td>
                    <td className="r num neg"><b>{eur0(r.netto)}</b></td>
                    <td>
                      {num(r.massnahmen)
                        ? <span className="chip pos">{r.massnahmen} erfasst</span>
                        : <span className="chip warn">keine</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-body">
            <span className="muted" style={{ fontSize: 12.5 }}>
              Die zehn schwersten Risiken aus den Feldern <b>hoch</b> und <b>kritisch</b>.
              Maßnahmen werden auf der Auftragsseite erfasst – ein Klick auf die
              Projektnummer führt dorthin.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
