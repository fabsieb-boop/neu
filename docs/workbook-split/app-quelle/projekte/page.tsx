import Link from 'next/link';
import Shell from '../components/Shell';
import { requireRecht } from '@/lib/guard';
import { nurErlaubteRegionen } from '@/lib/regionsschutz';
import RegionsHinweis from '../components/RegionsHinweis';
import Unterseiten from '../components/Unterseiten';
import { UNTERSEITEN } from './auswertung/page';
import { geschaeftsjahre, projektErgebnisse, regionenStamm, bestandOhneRechnung, bestandGrenzen, letzterBelastbarerMonat } from '@/lib/queries';
import { eur0, eurKurz, pct, vz, zahl, datum, num, MONATE } from '@/lib/format';
import { zeitraum } from '@/lib/zeitraum';

const MONATSLISTE = Array.from({ length: 12 }, (_, i) => i + 1);
import { Balken } from '../components/Charts';
import ErfassungsForm from '../planung/ErfassungsForm';

export const dynamic = 'force-dynamic';

const SORTIERUNGEN: Record<string, { label: string; cmp: (a: any, b: any) => number }> = {
  leistung: { label: 'Betriebsleistung', cmp: (a, b) => num(b.leistung) - num(a.leistung) },
  db3:      { label: 'DB III',           cmp: (a, b) => num(b.db3) - num(a.db3) },
  db3_asc:  { label: 'DB III aufsteigend', cmp: (a, b) => num(a.db3) - num(b.db3) },
  marge:    { label: 'DB III-Marge',     cmp: (a, b) => (num(b.db3_marge) || -1e9) - (num(a.db3_marge) || -1e9) },
  nummer:   { label: 'Projektnummer',    cmp: (a, b) => String(a.projekt_nr).localeCompare(String(b.projekt_nr)) },
};

export default async function ProjekteSeite({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const benutzer = await requireRecht('projects.read');
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || new Date().getFullYear();
  const region = sp.region || '';
  const sortKey = SORTIERUNGEN[sp.sort] ? sp.sort : 'leistung';
  const suche = (sp.q || '').trim().toLowerCase();

  /* Ohne ausdrueckliche Wahl endet die Auswertung beim letzten
     abgeschlossenen Monat – ein angebrochener Monat traegt Kosten,
     aber noch nicht die Erloese. */
  const z = zeitraum(sp, await letzterBelastbarerMonat(jahr));
  const [alleRoh, regionen, bestand, grenzen] = await Promise.all([
    projektErgebnisse(jahr, region || undefined, z.von, z.bis), regionenStamm(),
    bestandOhneRechnung().catch(() => []), bestandGrenzen().catch(() => ({ tage: 35, bagatelle: 1000 })),
  ]);

  /* Bestandskontrolle: nicht abgerechnete Leistung, die zu lange liegt.
     Regionsfreigabe gilt auch hier – wer nur seine Region sieht, sieht auch
     nur deren offene Bestaende. */
  const bestandMein = nurErlaubteRegionen(bestand, benutzer);
  const auffaellig = bestandMein.filter(b => b.auffaellig);
  const bestandSumme = auffaellig.reduce((a, b) => a + num(b.bestand), 0);
  // Regionsfreigabe durchsetzen, bevor gefiltert und summiert wird
  const alle = nurErlaubteRegionen(alleRoh, benutzer);

  const projekte = alle
    .filter(p => !suche || `${p.projekt_nr} ${p.projektname}`.toLowerCase().includes(suche))
    .sort(SORTIERUNGEN[sortKey].cmp);

  const sum = (f: (p: typeof projekte[number]) => unknown) => projekte.reduce((a, p) => a + num(f(p)), 0);
  const leistung = sum(p => p.leistung);
  const maxLeistung = Math.max(...projekte.map(p => Math.abs(num(p.leistung))), 1);

  return (
    <Shell titel="Projektergebnisse" bereich={`${z.text} ${jahr}`} aktiv="projekte" benutzer={benutzer}
           aktion={<span className="chip info">{projekte.length} Projekte</span>}>

      <Unterseiten seiten={UNTERSEITEN} aktiv="liste" />

      {/* ------------------------------------- Bestandskontrolle */}
      {auffaellig.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Kontrolle</div>
              <h2>Bestand ohne Rechnung</h2>
            </div>
            <span className="chip neg">{auffaellig.length} · {eur0(bestandSumme)}</span>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr><th>Projekt</th><th>Bezeichnung</th><th>Region</th>
                      <th className="r">Kosten</th><th className="r">Abgerechnet</th>
                      <th className="r">Bestand</th><th>Letzte Rechnung</th>
                      <th className="r">Tage</th></tr>
                </thead>
                <tbody>
                  {auffaellig.map(b => (
                    <tr key={b.auftrag}>
                      <td className="mono">
                        <Link href={`/projekte/${b.auftrag}`} style={{ color: 'var(--accent)' }}>
                          {b.auftrag}
                        </Link>
                      </td>
                      <td>{b.projektname ?? '–'}</td>
                      <td className="muted">{b.region}</td>
                      <td className="r num muted">{eur0(b.kosten)}</td>
                      <td className="r num muted">{eur0(b.erloes)}</td>
                      <td className="r num"><b>{eur0(b.bestand)}</b></td>
                      <td className="muted">
                        {b.rechnungen ? datum(b.letzte_rechnung) : 'nie berechnet'}
                      </td>
                      <td className="r num">
                        <span className={`chip ${num(b.tage_ohne_rechnung) > grenzen.tage * 2 ? 'neg' : 'warn'}`}>
                          {zahl(b.tage_ohne_rechnung)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ padding: '10px 16px', margin: 0, fontSize: 12 }}>
              Gemessen gegen den Stand der Daten ({datum(auffaellig[0]?.bezugstag)}), nicht gegen
              das heutige Datum — sonst wäre jedes Projekt auffällig, sobald der Import ein paar
              Wochen alt ist. Beträge unter {eur0(grenzen.bagatelle)} bleiben außen vor.
              {bestandMein.length > auffaellig.length && (
                <> Weitere {bestandMein.length - auffaellig.length} Projekte tragen Bestand,
                   sind aber innerhalb der Frist.</>
              )}
            </p>
          </div>
        </div>
      )}

      {benutzer.rechte.includes('projects.write') && (
        <ErfassungsForm
          modul="projekt"
          titel="Neues Projekt anlegen"
          beschreibung="Für ein Vorhaben, das noch keine Buchung hat. Die Region wird aus Stelle 6 und 7 der Auftragsnummer abgeleitet, wenn sie nicht gewählt wird."
          knopf="Projekt anlegen"
          felder={[
            { name: 'projekt_nr', label: 'Auftragsnummer', pflicht: true, breite: 170,
              hinweis: 'z. B. P4102157460' },
            { name: 'projektname', label: 'Bezeichnung', pflicht: true, breite: 260 },
            { name: 'regionscode', label: 'Region', typ: 'select',
              optionen: [{ wert: '', text: '– aus der Nummer –' },
                ...regionen.map(x => ({ wert: x.regionscode, text: x.region }))] },
            { name: 'projektart', label: 'Art', typ: 'select', vorgabe: 'SONSTIGES',
              optionen: [
                { wert: 'SONSTIGES', text: 'Sonstiges' },
                { wert: 'RUECKBAU', text: 'Rückbau' },
                { wert: 'SANIERUNG', text: 'Sanierung' },
                { wert: 'VERSCHROTTUNG', text: 'Verschrottung' },
                { wert: 'RAHMEN', text: 'Rahmenvertrag' },
              ] },
            { name: 'startdatum', label: 'Beginn', typ: 'date' },
            { name: 'enddatum', label: 'Ende', typ: 'date' },
            { name: 'budget_umsatz', label: 'Auftragswert €', typ: 'number' },
            { name: 'budget_kosten', label: 'Plankosten €', typ: 'number' },
          ]}
        />
      )}

      <div className="card">
        <form className="toolbar" method="get" action="/projekte">
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
              <option value="">Alle Regionen</option>
              {regionen.filter(r => r.projekte > 0).map(r =>
                <option key={r.regionscode} value={r.regionscode}>{r.region}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sort">Sortierung</label>
            <select id="sort" name="sort" defaultValue={sortKey}>
              {Object.entries(SORTIERUNGEN).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label htmlFor="q">Suche</label>
            {/* Vorschlaege beim Tippen: der Browser filtert die Liste selbst,
                sobald die ersten Zeichen stehen – ohne JavaScript. */}
            <input id="q" name="q" defaultValue={sp.q || ''} list="projektvorschlaege"
                   autoComplete="off" placeholder="Projektname oder -nummer" style={{ width: '100%' }} />
            <datalist id="projektvorschlaege">
              {alle.slice(0, 400).map(p => (
                <option key={p.projekt_nr} value={p.projekt_nr}>{p.projektname ?? ''}</option>
              ))}
              {[...new Set(alle.map(p => p.projektname).filter(Boolean))].slice(0, 200).map(n => (
                <option key={`n-${n}`} value={n as string} />
              ))}
            </datalist>
          </div>
          <button className="btn primary" type="submit">Anzeigen</button>
        </form>
      </div>

      <div className="kpis">
        <div className="kpi accent">
          <div className="label">Betriebsleistung</div>
          <div className="value num">{eurKurz(leistung)}</div>
          <div className="sub">{projekte.length} Projekte{region ? ` · ${regionen.find(r => r.regionscode === region)?.region}` : ''}</div>
        </div>
        <div className={`kpi ${sum(p => p.db1) >= 0 ? 'good' : 'bad'}`}>
          <div className="label">DB I</div>
          <div className="value num">{eurKurz(sum(p => p.db1))}</div>
          <div className="sub">{leistung ? pct((sum(p => p.db1) / leistung) * 100) : '–'} der Leistung</div>
        </div>
        <div className={`kpi ${sum(p => p.db3) >= 0 ? 'good' : 'bad'}`}>
          <div className="label">DB III</div>
          <div className="value num">{eurKurz(sum(p => p.db3))}</div>
          <div className="sub">nach verrechneten Gemeinkosten</div>
        </div>
        <div className="kpi bad">
          <div className="label">Projekte mit negativem DB III</div>
          <div className="value num">{projekte.filter(p => num(p.db3) < 0).length}</div>
          <div className="sub">von {projekte.length} Projekten</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Projektübersicht</div>
            <h2>Ergebnisrechnung je Projekt</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Projekt</th><th>Region</th>
                  <th className="r">Leistung</th><th className="r">var. EK</th><th className="r">DB I</th>
                  <th className="r">Proj.-Fix</th><th className="r">GK-Umlage</th>
                  <th className="r">DB III</th><th className="r">Marge</th>
                  <th className="r">Belege</th><th className="r">Letzte Buchung</th><th />
                </tr>
              </thead>
              <tbody>
                {projekte.map(p => (
                  <tr key={p.projekt_nr}>
                    <td>
                      <Link href={`/projekte/${p.projekt_nr}?jahr=${jahr}`} style={{ color: 'var(--accent)' }}>
                        <b>{p.projektname || '(ohne Bezeichnung)'}</b>
                      </Link>
                      <div className="muted mono">{p.projekt_nr}</div>
                    </td>
                    <td className="muted">{p.region}</td>
                    <td className="r num">{eur0(p.leistung)}</td>
                    <td className="r num">{eur0(p.variable_kosten)}</td>
                    <td className={`r num ${vz(p.db1)}`}>{eur0(p.db1)}</td>
                    <td className="r num">{eur0(p.fixe_projektkosten)}</td>
                    <td className="r num">{eur0(p.verrechnete_gk)}</td>
                    <td className={`r num ${vz(p.db3)}`}><b>{eur0(p.db3)}</b></td>
                    <td className={`r num ${vz(p.db3_marge)}`}>{p.db3_marge === null ? '–' : pct(p.db3_marge)}</td>
                    <td className="r num muted">{zahl(p.belege)}</td>
                    <td className="r muted">{datum(p.letzte_buchung)}</td>
                    <td className="r"><Balken wert={num(p.leistung)} max={maxLeistung} ton="pos" /></td>
                  </tr>
                ))}
                {!projekte.length && (
                  <tr><td colSpan={12}><div className="empty">Keine Projekte für diese Auswahl.</div></td></tr>
                )}
                <tr className="total">
                  <td colSpan={2}>Summe {projekte.length} Projekte</td>
                  <td className="r num">{eur0(leistung)}</td>
                  <td className="r num">{eur0(sum(p => p.variable_kosten))}</td>
                  <td className={`r num ${vz(sum(p => p.db1))}`}>{eur0(sum(p => p.db1))}</td>
                  <td className="r num">{eur0(sum(p => p.fixe_projektkosten))}</td>
                  <td className="r num">{eur0(sum(p => p.verrechnete_gk))}</td>
                  <td className={`r num ${vz(sum(p => p.db3))}`}>{eur0(sum(p => p.db3))}</td>
                  <td className="r num">{leistung ? pct((sum(p => p.db3) / leistung) * 100) : '–'}</td>
                  <td className="r num">{zahl(sum(p => p.belege))}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
