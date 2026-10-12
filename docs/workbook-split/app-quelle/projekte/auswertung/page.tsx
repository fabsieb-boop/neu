import Link from 'next/link';
import Shell from '../../components/Shell';
import Unterseiten from '../../components/Unterseiten';
import RegionsHinweis from '../../components/RegionsHinweis';
import { requireRecht } from '@/lib/guard';
import { nurErlaubteRegionen } from '@/lib/regionsschutz';
import { geschaeftsjahre, projektErgebnisse, regionenStamm, bestandDeckungAlle, stundenProjekte, letzterBelastbarerMonat } from '@/lib/queries';
import { eur0, eurKurz, pct, vz, zahl, datum, num, MONATE } from '@/lib/format';
import { RingChart, RangChart } from '../../components/Charts';
import { zeitraum, mitZeitraum } from '@/lib/zeitraum';

export const dynamic = 'force-dynamic';

export const UNTERSEITEN = [
  { key: 'liste', label: 'Liste', href: '/projekte',
    hinweis: 'Alle Aufträge mit Ergebnis, sortierbar und durchsuchbar.' },
  { key: 'auswertung', label: 'Auswertung', href: '/projekte/auswertung',
    hinweis: 'Wie die Aufträge im Ganzen stehen – Ergebnislage, Regionen, Träger und Zehrer.' },
];

const MONATSLISTE = Array.from({ length: 12 }, (_, i) => i + 1);

/* ---------------------------------------------------------------------------
   Auftragsauswertung
   ---------------------------------------------------------------------------
   Die Liste beantwortet "was macht dieser Auftrag".  Diese Seite beantwortet
   die Frage davor: wie stehen sie im Ganzen, wo sitzt das Ergebnis, und wer
   zehrt daran.

   Der Aufbau folgt derselben Ordnung wie die Bestandsprüfung: eine Quote
   oben, die Lage in Klassen daneben, der Aufriss je Region, dann die
   Arbeitsliste.  Wer die eine Seite lesen kann, kann auch die andere.

   Die Klassen sind bewusst grob.  Eine Marge auf zwei Nachkommastellen sagt
   bei einem Auftrag, der noch läuft, weniger als die Frage, ob er trägt.
--------------------------------------------------------------------------- */

const KLASSEN = [
  { key: 'traegt',  label: 'Trägt',        farbe: '#047857', ton: 'good',
    text: 'DB III über 10 % der Leistung.' },
  { key: 'knapp',   label: 'Knapp',        farbe: '#b45309', ton: '',
    text: 'DB III positiv, aber unter 10 %.' },
  { key: 'zehrt',   label: 'Zehrt',        farbe: '#be123c', ton: 'bad',
    text: 'DB III negativ – der Auftrag kostet mehr, als er einbringt.' },
  { key: 'ruhend',  label: 'Ohne Leistung', farbe: '#64748b', ton: '',
    text: 'Kosten gebucht, aber keine Leistung – meist noch nicht abgerechnet.' },
];
const KLASSE = new Map(KLASSEN.map(k => [k.key, k]));

const klasseVon = (leistung: number, db3: number) => {
  if (leistung <= 0) return 'ruhend';
  const m = (db3 / leistung) * 100;
  return m < 0 ? 'zehrt' : m < 10 ? 'knapp' : 'traegt';
};

export default async function AuftragsauswertungSeite(
  { searchParams }: { searchParams: Promise<Record<string, string>> },
) {
  const benutzer = await requireRecht('projects.read');
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || new Date().getFullYear();
  const region = sp.region || '';
  const lage = KLASSE.has(sp.lage) ? sp.lage : '';
  const suche = (sp.q || '').trim().toLowerCase();
  /* Ohne ausdrueckliche Wahl endet die Auswertung beim letzten
     abgeschlossenen Monat – ein angebrochener Monat traegt Kosten,
     aber noch nicht die Erloese. */
  const z = zeitraum(sp, await letzterBelastbarerMonat(jahr));

  const [rohAlle, regionen, bestand, stunden] = await Promise.all([
    projektErgebnisse(jahr, region || undefined, z.von, z.bis).catch(() => []),
    regionenStamm().catch(() => []),
    bestandDeckungAlle().catch(() => []),
    stundenProjekte(jahr, z.von, z.bis).catch(() => []),
  ]);

  const alle = nurErlaubteRegionen(rohAlle, benutzer);

  if (!alle.length) {
    return (
      <Shell titel="Aufträge" bereich={`Geschäftsjahr ${jahr}`} aktiv="auftragsauswertung" benutzer={benutzer}>
        <Unterseiten seiten={UNTERSEITEN} aktiv="auswertung" />
        <div className="note warn">
          <b>Für {jahr} liegen keine Auftragsbuchungen vor.</b> Die Auswertung rechnet aus den
          Buchungszeilen mit Auftragsbezug.
        </div>
      </Shell>
    );
  }

  /* Bestandsbefund und Stunden je Auftrag danebenlegen – beides beantwortet
     Fragen, die das Ergebnis allein offenlässt. */
  const befundJe = new Map<string, string>(
    bestand.map((b): [string, string] => [b.auftrag, b.befund]),
  );
  const stundenJe = new Map<string, number>();
  for (const s of stunden) {
    stundenJe.set(s.projekt_nr, (stundenJe.get(s.projekt_nr) ?? 0) + num(s.stunden));
  }

  const mit = alle.map(p => {
    const leistung = num(p.leistung), db3 = num(p.db3);
    return {
      ...p, leistung, db3,
      klasse: klasseVon(leistung, db3),
      marge: leistung > 0 ? (db3 / leistung) * 100 : null,
      befund: befundJe.get(p.projekt_nr) ?? null,
      stunden: stundenJe.get(p.projekt_nr) ?? 0,
    };
  });

  const summe = (rows: typeof mit, f: (p: typeof mit[number]) => number) =>
    rows.reduce((a, p) => a + num(f(p)), 0);

  const leistungGesamt = summe(mit, p => p.leistung);
  const db3Gesamt = summe(mit, p => p.db3);
  const margeGesamt = leistungGesamt > 0 ? (db3Gesamt / leistungGesamt) * 100 : 0;
  const zehrer = mit.filter(p => p.klasse === 'zehrt');
  const zehrerBetrag = Math.abs(summe(zehrer, p => p.db3));
  const traeger = mit.filter(p => p.klasse === 'traegt');

  /* Konzentration: wie viele Auftraege tragen die Haelfte des Ergebnisses?
     Eine Zahl, die mehr sagt als jeder Durchschnitt. */
  const positiv = [...mit].filter(p => p.db3 > 0).sort((a, b) => b.db3 - a.db3);
  const db3Positiv = summe(positiv, p => p.db3);
  let lauf = 0, haelfte = 0;
  for (const p of positiv) { lauf += p.db3; haelfte++; if (lauf >= db3Positiv / 2) break; }

  const jeRegion = [...new Set(mit.map(p => p.region))].map(r => {
    const teil = mit.filter(p => p.region === r);
    return {
      region: r, projekte: teil.length,
      leistung: summe(teil, p => p.leistung),
      db3: summe(teil, p => p.db3),
      marge: summe(teil, p => p.leistung) > 0
        ? (summe(teil, p => p.db3) / summe(teil, p => p.leistung)) * 100 : null,
      teile: KLASSEN.map(k => ({ ...k, anzahl: teil.filter(p => p.klasse === k.key).length })),
    };
  }).sort((a, b) => (a.marge ?? 0) - (b.marge ?? 0));

  const liste = mit
    .filter(p => !lage || p.klasse === lage)
    .filter(p => !suche || `${p.projekt_nr} ${p.projektname ?? ''}`.toLowerCase().includes(suche))
    .sort((a, b) => b.leistung - a.leistung);

  const ring = KLASSEN
    .map(k => ({ label: k.label, wert: mit.filter(p => p.klasse === k.key).length, farbe: k.farbe }))
    .filter(s => s.wert > 0);

  return (
    <Shell titel="Aufträge" bereich={`${z.text} ${jahr}`}
           aktiv="auftragsauswertung" benutzer={benutzer}
           aktion={<span className={`chip ${margeGesamt >= 0 ? 'pos' : 'neg'}`}>
                     {pct(margeGesamt)} DB III-Marge
                   </span>}>
      <Unterseiten seiten={UNTERSEITEN} aktiv="auswertung" />
      <RegionsHinweis benutzer={benutzer} />

      <form className="toolbar" method="get" action="/projekte/auswertung">
        <div className="field">
          <label htmlFor="jahr">Geschäftsjahr</label>
          <select id="jahr" name="jahr" defaultValue={String(jahr)}>
            {jahre.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="von">Von</label>
          <select id="von" name="von" defaultValue={String(z.von)}>
            {MONATSLISTE.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')} – {MONATE[m]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bis">Bis</label>
          <select id="bis" name="bis" defaultValue={String(z.bis)}>
            {MONATSLISTE.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')} – {MONATE[m]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="region">Region</label>
          <select id="region" name="region" defaultValue={region}>
            <option value="">alle Regionen</option>
            {regionen.map(r => (
              <option key={r.regionscode} value={r.regionscode}>{r.region}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lage">Ergebnislage</label>
          <select id="lage" name="lage" defaultValue={lage}>
            <option value="">alle</option>
            {KLASSEN.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </div>
        {/* Vorschläge beim Tippen: eine echte Liste im Feld, kein JavaScript.
            Der Browser filtert selbst, sobald die ersten Zeichen stehen. */}
        <div className="field feld-breit">
          <label htmlFor="q">Suche</label>
          <input id="q" name="q" defaultValue={sp.q || ''} list="auftragsvorschlaege"
                 autoComplete="off" placeholder="Auftragsnummer oder Bezeichnung" />
          <datalist id="auftragsvorschlaege">
            {mit.slice(0, 400).map(p => (
              <option key={p.projekt_nr} value={p.projekt_nr}>
                {p.projektname ?? ''}
              </option>
            ))}
            {[...new Set(mit.map(p => p.projektname).filter(Boolean))].slice(0, 200).map(n => (
              <option key={`n-${n}`} value={n as string} />
            ))}
          </datalist>
        </div>
        <button className="btn primary" type="submit">Anzeigen</button>
      </form>

      <div className="kpis">
        <div className="kpi accent">
          <div className="label">Betriebsleistung</div>
          <div className="value num">{eurKurz(leistungGesamt)}</div>
          <div className="sub">{zahl(mit.length)} Aufträge mit Buchungen</div>
        </div>
        <div className={`kpi ${db3Gesamt >= 0 ? 'good' : 'bad'}`}>
          <div className="label">Deckungsbeitrag III</div>
          <div className="value num">{eurKurz(db3Gesamt)}</div>
          <div className="sub">{pct(margeGesamt)} der Leistung</div>
        </div>
        <div className="kpi good">
          <div className="label">Tragende Aufträge</div>
          <div className="value num">{zahl(traeger.length)}</div>
          <div className="sub">DB III über 10 % · zusammen {eurKurz(summe(traeger, p => p.db3))}</div>
        </div>
        <div className={`kpi ${zehrer.length ? 'bad' : ''}`}>
          <div className="label">Zehrende Aufträge</div>
          <div className="value num">{zahl(zehrer.length)}</div>
          <div className="sub">DB III negativ · zusammen {eurKurz(-zehrerBetrag)}</div>
        </div>
        <div className="kpi">
          <div className="label">Konzentration</div>
          <div className="value num">{zahl(haelfte)}</div>
          <div className="sub">
            Aufträge tragen die Hälfte des Deckungsbeitrags
            <span className="zeile">von {zahl(positiv.length)} mit positivem DB III</span>
          </div>
        </div>
      </div>

      <div className="grid-wide">
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Je Region</div>
                 <h2>Wo das Ergebnis entsteht</h2></div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead><tr><th>Region</th><th className="r">Aufträge</th>
                           <th className="r">Leistung</th><th className="r">DB III</th>
                           <th className="r">Marge</th>
                           <th style={{ width: '30%' }}>Zusammensetzung</th></tr></thead>
                <tbody>
                  {jeRegion.map(r => (
                    <tr key={r.region}>
                      <td><b>{r.region}</b></td>
                      <td className="r num muted">{zahl(r.projekte)}</td>
                      <td className="r num">{eur0(r.leistung)}</td>
                      <td className={`r num ${vz(r.db3)}`}><b>{eur0(r.db3)}</b></td>
                      <td className={`r num ${r.marge === null ? 'muted' : vz(r.marge)}`}>
                        {r.marge === null ? '–' : pct(r.marge)}
                      </td>
                      <td>
                        <span className="stapel">
                          {r.teile.filter(t => t.anzahl > 0).map(t => (
                            <i key={t.key} style={{ background: t.farbe,
                                                    width: `${(t.anzahl / r.projekte) * 100}%` }}
                               title={`${t.label}: ${t.anzahl}`}>
                              {(t.anzahl / r.projekte) >= 0.14 ? String(t.anzahl) : ''}
                            </i>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Ergebnislage</div>
                 <h2>Wie die Aufträge stehen</h2></div>
          </div>
          <div className="card-body">
            <RingChart scheiben={ring} summenLabel="Aufträge" />
            <div className="legend">
              {KLASSEN.filter(k => mit.some(p => p.klasse === k.key)).map(k => (
                <span key={k.key}><i style={{ background: k.farbe }} />{k.label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Träger</div>
                 <h2>Die größten Ergebnisbeiträge</h2></div>
          </div>
          <div className="card-body">
            <RangChart zeilen={[...mit].sort((a, b) => b.db3 - a.db3).slice(0, 12).map(p => ({
              label: `${p.projekt_nr} ${p.projektname ?? ''}`.trim(),
              wert: p.db3,
              hinweis: `Leistung ${eurKurz(p.leistung)}${p.marge !== null ? ` · ${pct(p.marge)}` : ''}`,
            }))} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Zehrer</div>
                 <h2>Wo das Ergebnis verloren geht</h2></div>
          </div>
          <div className="card-body">
            <RangChart zeilen={[...mit].sort((a, b) => a.db3 - b.db3).slice(0, 12).map(p => ({
              label: `${p.projekt_nr} ${p.projektname ?? ''}`.trim(),
              wert: p.db3,
              hinweis: `Leistung ${eurKurz(p.leistung)}${p.marge !== null ? ` · ${pct(p.marge)}` : ''}`,
            }))} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Arbeitsliste</div>
               <h2>{lage ? KLASSE.get(lage)!.label : 'Alle Aufträge'}</h2></div>
          <span className="chip info">{zahl(liste.length)} Aufträge</span>
        </div>


        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr><th>Auftrag</th><th>Region</th><th>Lage</th>
                    <th className="r">Leistung</th><th className="r">DB I</th>
                    <th className="r">DB III</th><th className="r">Marge</th>
                    <th className="r">Stunden</th><th>Bestand</th>
                    <th className="r">letzte Buchung</th></tr>
              </thead>
              <tbody>
                {liste.map(p => {
                  const k = KLASSE.get(p.klasse)!;
                  return (
                    <tr key={p.projekt_nr}>
                      <td>
                        <Link href={mitZeitraum(`/projekte/${p.projekt_nr}/auswertung`, jahr, z)} className="mono"
                              style={{ color: 'var(--accent)' }}>{p.projekt_nr}</Link>
                        {p.projektname && <span className="formula">{p.projektname}</span>}
                      </td>
                      <td className="muted">{p.region}</td>
                      <td>
                        <span className="chip" style={{ color: k.farbe, borderColor: k.farbe }}>
                          {k.label}
                        </span>
                      </td>
                      <td className="r num">{eur0(p.leistung)}</td>
                      <td className={`r num ${vz(p.db1)}`}>{eur0(p.db1)}</td>
                      <td className={`r num ${vz(p.db3)}`}><b>{eur0(p.db3)}</b></td>
                      <td className={`r num ${p.marge === null ? 'muted' : vz(p.marge)}`}>
                        {p.marge === null ? '–' : pct(p.marge)}
                      </td>
                      <td className="r num muted">{p.stunden ? zahl(Math.round(p.stunden)) : '–'}</td>
                      <td className="muted" style={{ fontSize: 11.5 }}>
                        {p.befund && p.befund !== 'OK' ? p.befund.toLowerCase().replace(/_/g, ' ') : '–'}
                      </td>
                      <td className="r muted">{p.letzte_buchung ? datum(p.letzte_buchung) : '–'}</td>
                    </tr>
                  );
                })}
                {!liste.length && (
                  <tr><td colSpan={10}>
                    <div className="empty">Kein Auftrag mit dieser Auswahl.</div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
