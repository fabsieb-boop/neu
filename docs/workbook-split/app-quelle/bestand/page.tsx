import Link from 'next/link';
import Shell from '../components/Shell';
import RegionsHinweis from '../components/RegionsHinweis';
import { requireRecht } from '@/lib/guard';
import { nurErlaubteRegionen } from '@/lib/regionsschutz';
import { bestandDeckungAlle, bestandGrenzen, regionenStamm } from '@/lib/queries';
import { eur0, eurKurz, pct, zahl, datum, num } from '@/lib/format';
import { RingChart } from '../components/Charts';

export const dynamic = 'force-dynamic';

/* ---------------------------------------------------------------------------
   Bestandsprüfung
   ---------------------------------------------------------------------------
   Die Sicht v_bestand_deckung prüft je Auftrag die Gleichung

       Kosten = berechnet + Bestandsveränderung + Ergebnis

   und war bisher nur als Hinweiszeile im Cockpit und als eine Zeile in der
   Selbstprüfung zu sehen.  Millionen unabgerechneter Leistung standen damit
   an einer Stelle, an der niemand morgens hinschaut.

   Aufgebaut wie eine Einhaltungsquote: eine Zahl oben, die vier Befunde
   daneben, der Aufriss je Region, und darunter die Liste, auf der man
   arbeitet.
--------------------------------------------------------------------------- */

/* Jeder Befund hat eine Richtung, und die entscheidet, welcher Betrag zu
   ihm gehoert.  Vorher stand ueberall derselbe Betrag ohne Vorzeichen –
   damit landeten ungedeckte Kosten und Ueberdeckung in einer Summe, und die
   Seite wies 3.593.331 EUR "ungeprüfte Leistung" aus, von denen nur
   619.931 EUR ungedeckt waren. */
const BEFUNDE = [
  { key: 'OK',                   label: 'Gedeckt',              farbe: '#047857', ton: 'good',
    feld: 'ungedeckt' as const, },
  { key: 'LANGE_OHNE_RECHNUNG',  label: 'Lange ohne Rechnung',  farbe: '#b45309', ton: '',
    feld: 'ungedeckt' as const, },
  { key: 'VORAUSBERECHNET',      label: 'Vorausberechnet',      farbe: '#2563eb', ton: '',
    feld: 'ueberdeckt' as const, },
  { key: 'UEBERAKTIVIERT',       label: 'Überaktiviert',        farbe: '#be123c', ton: 'bad',
    feld: 'ueberdeckt' as const, },
  { key: 'OHNE_BESTANDSBUCHUNG', label: 'Ohne Bestandsbuchung', farbe: '#7c3aed', ton: 'bad',
    feld: 'ungedeckt' as const, },
];

const BEFUND = new Map(BEFUNDE.map(b => [b.key, b]));

export default async function BestandSeite(
  { searchParams }: { searchParams: Promise<Record<string, string>> },
) {
  const benutzer = await requireRecht('projects.read');
  const sp = await searchParams;
  const filter = sp.befund && BEFUND.has(sp.befund) ? sp.befund : '';
  const region = sp.region || '';

  const [alleRoh, grenzen, regionen] = await Promise.all([
    bestandDeckungAlle().catch(() => []),
    bestandGrenzen().catch(() => ({ tage: 35, bagatelle: 1000, luecke: 25000 })),
    regionenStamm().catch(() => []),
  ]);

  /* Regionsfreigabe zuerst: wer nur seine Region sieht, sieht auch nur deren
     Quote – sonst stünde oben eine Zahl, die zur Liste darunter nicht passt. */
  /* Projekte ohne jede Bestandsbuchung sind kein Bestandsfall - sie werden
     hier ausgeblendet, sonst tragen sie die Quote nach unten, ohne dass es
     um Bestaende ginge. */
  const alleMitBestand = alleRoh.filter(p => num(p.bestandsbuchungen) > 0);
  const ausgeblendet = alleRoh.length - alleMitBestand.length;
  const alle = nurErlaubteRegionen(alleMitBestand, benutzer);

  if (!alle.length) {
    return (
      <Shell titel="Bestandsprüfung" bereich="Kosten gegen Rechnungen und Bestand"
             aktiv="bestand" benutzer={benutzer}>
        <div className="note warn">
          <b>Keine Projekte zu prüfen.</b> Die Bestandsprüfung braucht Buchungen mit
          Auftragsbezug. Sind gerade keine importiert, bleibt sie leer.
        </div>
      </Shell>
    );
  }

  const zahlJe = (k: string) => alle.filter(p => p.befund === k);
  const gedeckt = zahlJe('OK').length;
  const quote = (gedeckt / alle.length) * 100;
  const auffaellig = alle.filter(p => p.befund !== 'OK');
  const summeUngedeckt  = alle.reduce((a, p) => a + num(p.ungedeckt), 0);
  const summeUeberdeckt = alle.reduce((a, p) => a + num(p.ueberdeckt), 0);

  /* Aufriss je Region: dieselbe Quote noch einmal, aber dort, wo jemand
     etwas dagegen tun kann. */
  const jeRegion = [...new Set(alle.map(p => p.region))].map(r => {
    const teil = alle.filter(p => p.region === r);
    return {
      region: r, projekte: teil.length,
      quote: (teil.filter(p => p.befund === 'OK').length / teil.length) * 100,
      ungedeckt: teil.reduce((a, p) => a + num(p.ungedeckt), 0),
      teile: BEFUNDE.map(b => ({ ...b, anzahl: teil.filter(p => p.befund === b.key).length })),
    };
  }).sort((a, b) => a.quote - b.quote);

  const liste = alle
    .filter(p => (filter ? p.befund === filter : p.befund !== 'OK'))
    .filter(p => !region || p.regionscode === region);

  const ring = BEFUNDE
    .map(b => ({ label: b.label, wert: zahlJe(b.key).length, farbe: b.farbe }))
    .filter(s => s.wert > 0);

  return (
    <Shell titel="Bestandsprüfung" bereich={`${alle.length} Projekte · Stichtag heute`}
           aktiv="bestand" benutzer={benutzer}
           aktion={<span className={`chip ${quote >= 90 ? 'pos' : quote >= 75 ? 'warn' : 'neg'}`}>
                     {pct(quote)} gedeckt
                   </span>}>
      <RegionsHinweis benutzer={benutzer} />

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Kosten = berechnet + Bestandsveränderung + Ergebnis</div>
            <h2>Deckung der Bestände</h2>
          </div>
        </div>
      </div>

      <div className="kpis">
        <div className={`kpi ${quote >= 90 ? 'good' : quote >= 75 ? '' : 'bad'}`}>
          <div className="label">Deckungsquote</div>
          <div className="value num">{pct(quote)}</div>
          <div className="sub">{zahl(gedeckt)} von {zahl(alle.length)} Projekten gehen auf</div>
        </div>
        {BEFUNDE.filter(b => b.key !== 'OK').map(b => {
          const teil = zahlJe(b.key);
          const betrag = teil.reduce((a, p) => a + num(p[b.feld]), 0);
          return (
            <div key={b.key} className={`kpi ${b.ton}`}>
              <div className="label">{b.label}</div>
              <div className="value num">{zahl(teil.length)}</div>
              <div className="sub">
                {betrag > 0
                  ? `${eurKurz(betrag)} ${b.feld === 'ungedeckt' ? 'ungedeckt' : 'überdeckt'}`
                  : 'ohne Betrag'}
              </div>
            </div>
          );
        })}
      </div>

      {(summeUngedeckt > 0 || summeUeberdeckt > 0) && (
        <div className="note">
          <b>{eur0(summeUngedeckt)}</b> nicht gedeckt ·{' '}
          <b>{eur0(summeUeberdeckt)}</b> überdeckt ·{' '}
          {zahl(auffaellig.length)} auffällige Projekte
          {ausgeblendet > 0 && <> · {zahl(ausgeblendet)} ohne Bestand ausgeblendet</>}
        </div>
      )}

      <div className="grid-wide">
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Je Region</div>
                 <h2>Wo die Deckung fehlt</h2></div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead><tr><th>Region</th><th className="r">Projekte</th>
                           <th className="r">Quote</th><th className="r">ungedeckt</th>
                           <th style={{ width: '38%' }}>Zusammensetzung</th></tr></thead>
                <tbody>
                  {jeRegion.map(r => (
                    <tr key={r.region}>
                      <td><b>{r.region}</b></td>
                      <td className="r num muted">{zahl(r.projekte)}</td>
                      <td className={`r num ${r.quote >= 90 ? 'pos' : r.quote >= 75 ? '' : 'neg'}`}>
                        <b>{pct(r.quote)}</b>
                      </td>
                      <td className="r num">{r.ungedeckt > 0 ? eur0(r.ungedeckt) : '–'}</td>
                      <td>
                        <span className="stapel">
                          {r.teile.filter(t => t.anzahl > 0).map(t => (
                            <i key={t.key} style={{
                                 background: t.farbe,
                                 width: `${(t.anzahl / r.projekte) * 100}%`,
                               }}
                               title={`${t.label}: ${t.anzahl}`}>
                              {(t.anzahl / r.projekte) >= 0.12
                                ? `${Math.round((t.anzahl / r.projekte) * 100)} %` : ''}
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
            <div><div className="eyebrow">Zusammensetzung</div>
                 <h2>Befunde im Ganzen</h2></div>
          </div>
          <div className="card-body">
            <RingChart scheiben={ring} summenLabel="Projekte" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Arbeitsliste</div>
               <h2>{filter ? BEFUND.get(filter)!.label : 'Alle auffälligen Projekte'}</h2></div>
          <span className="chip info">{zahl(liste.length)} Projekte</span>
        </div>

        <form className="toolbar" method="get" action="/bestand">
          <div className="field">
            <label htmlFor="befund">Befund</label>
            <select id="befund" name="befund" defaultValue={filter}>
              <option value="">alle auffälligen</option>
              {BEFUNDE.map(b => (
                <option key={b.key} value={b.key}>{b.label}</option>
              ))}
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
          <button className="btn primary" type="submit">Anzeigen</button>
        </form>

        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr><th>Auftrag</th><th>Bezeichnung</th><th>Region</th><th>Befund</th>
                    <th className="r">Kosten</th><th className="r">berechnet</th>
                    <th className="r">Bestand</th><th className="r">ungedeckt</th>
                    <th className="r">überdeckt</th>
                    <th className="r">letzte Rechnung</th></tr>
              </thead>
              <tbody>
                {liste.map(p => {
                  const b = BEFUND.get(p.befund);
                  return (
                    <tr key={p.auftrag}>
                      <td className="mono">
                        <Link href={`/projekte/${p.auftrag}`} style={{ color: 'var(--accent)' }}>
                          {p.auftrag}
                        </Link>
                      </td>
                      <td>{p.projektname ?? '–'}</td>
                      <td className="muted">{p.region}</td>
                      <td>
                        <span className="chip" style={{ color: b?.farbe, borderColor: b?.farbe }}>
                          {b?.label ?? p.befund}
                        </span>
                      </td>
                      <td className="r num">{eur0(p.kosten)}</td>
                      <td className="r num">{eur0(p.erloes)}</td>
                      <td className="r num">{eur0(p.bestand)}</td>
                      <td className="r num">
                        {num(p.ungedeckt) > 0 ? <b>{eur0(p.ungedeckt)}</b> : '–'}
                      </td>
                      <td className="r num muted">
                        {num(p.ueberdeckt) > 0 ? eur0(p.ueberdeckt) : '–'}
                      </td>
                      <td className="r muted">
                        {p.letzte_rechnung
                          ? `${datum(p.letzte_rechnung)} · ${zahl(p.tage_ohne_rechnung)} T`
                          : 'keine'}
                      </td>
                    </tr>
                  );
                })}
                {!liste.length && (
                  <tr><td colSpan={10}>
                    <div className="empty">Kein Projekt mit diesem Befund.</div>
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
