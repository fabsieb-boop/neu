import Link from 'next/link';
import Shell from '../components/Shell';
import ErfassungsForm from '../planung/ErfassungsForm';
import { requireRecht, regionErzwingen } from '@/lib/guard';
import { geschaeftsjahre, nachtraege, dbMonate, projektErgebnisse } from '@/lib/queries';
import RegionsFilter, { filterLesen } from '../components/RegionsFilter';
import { passtZuFilter } from '@/lib/filter';
import { eur0, eurKurz, pct, anteil, vz, datum, monat as monatName, monatKurz, num } from '@/lib/format';
import { RangChart, RingChart, StapelChart, FARBEN } from '../components/Charts';

export const dynamic = 'force-dynamic';

const STATUS = ['ANGEMELDET', 'EINGEREICHT', 'VERHANDLUNG', 'ANGENOMMEN', 'ABGELEHNT'];
const ARTEN = ['MEHRMENGE', 'BAUZEIT', 'STOERUNG', 'ZUSATZLEISTUNG', 'SONSTIGES'];

export default async function NachtraegeSeite({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const benutzer = await requireRecht('risk.read');
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || 2026;

  const { region: roheRegion, auftrag } = filterLesen(sp);
  const region = regionErzwingen(benutzer, roheRegion);
  const [alle, monate, projekte] = await Promise.all([
    nachtraege(jahr), dbMonate(jahr), projektErgebnisse(jahr),
  ]);
  const liste = alle.filter(n => passtZuFilter(n, region, auftrag));

  const leistung = monate.reduce((a, m) => a + num(m.leistung), 0);
  const db4 = monate.reduce((a, m) => a + num(m.db4), 0);

  const offen = liste.filter(n => !['ANGENOMMEN', 'ABGELEHNT'].includes(n.status));
  const angenommen = liste.filter(n => n.status === 'ANGENOMMEN');

  const s = (rows: typeof liste, f: (n: typeof liste[number]) => unknown) =>
    rows.reduce((a, n) => a + num(f(n)), 0);

  const erwartetGesamt = s(angenommen, n => n.betrag) + s(offen, n => n.erwartungswert);
  const ergebnisGesamt = s(angenommen, n => n.betrag) - s(angenommen, n => n.kosten)
    + s(offen, n => n.erwartetes_ergebnis);

  return (
    <Shell titel="Nachträge" bereich={`Geschäftsjahr ${jahr}`} aktiv="nachtraege" benutzer={benutzer}
           aktion={<span className="chip info">{liste.length} erfasst</span>}>

      <div className="card">
        <RegionsFilter erlaubt={benutzer.regionen} pfad="/nachtraege" region={region} auftrag={auftrag}
                       felder={{ jahr }} />
        {(region || auftrag) && (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {liste.length} von {alle.length} Nachträgen
              {region && <> · Region <b>{region}</b></>}
              {auftrag && <> · Suche <b>{auftrag}</b></>}
            </span>
          </div>
        )}
      </div>
      <div className="kpis">
        <div className="kpi accent">
          <div className="label">Erwarteter Zusatzumsatz</div>
          <div className="value num">{eurKurz(erwartetGesamt)}</div>
          <div className="sub">{pct(anteil(erwartetGesamt, leistung) ?? 0)} der Betriebsleistung</div>
        </div>
        <div className={`kpi ${ergebnisGesamt >= 0 ? 'good' : 'bad'}`}>
          <div className="label">Erwartetes Zusatzergebnis</div>
          <div className="value num">{eurKurz(ergebnisGesamt)}</div>
          <div className="sub">nach erwarteten Kosten</div>
        </div>
        <div className="kpi good">
          <div className="label">Angenommen</div>
          <div className="value num">{eurKurz(s(angenommen, n => n.betrag))}</div>
          <div className="sub">{angenommen.length} Nachträge, voll gezählt</div>
        </div>
        <div className="kpi">
          <div className="label">Noch offen</div>
          <div className="value num">{eurKurz(s(offen, n => n.betrag))}</div>
          <div className="sub">{offen.length} Nachträge, gewichtet {eurKurz(s(offen, n => n.erwartungswert))}</div>
        </div>
        <div className="kpi">
          <div className="label">Ergebnis mit Nachträgen</div>
          <div className="value num">{eurKurz(db4 + ergebnisGesamt)}</div>
          <div className="sub">Betriebsergebnis {eurKurz(db4)} plus Erwartung</div>
        </div>
      </div>

      {/* ---------------------------------------------- Bilder zu den Nachträgen
          Ein Nachtragsregister lebt von zwei Fragen: was steht wo, und was
          davon ist schon gesichert.  Beides sind Verhaeltnisse und die liest
          man in einem Bild schneller als in einer Statusspalte. */}
      {!!liste.length && (() => {
        const jeStatus = STATUS.map((st, i) => ({
          label: st.charAt(0) + st.slice(1).toLowerCase(),
          wert: s(liste.filter(n => n.status === st), n => n.betrag),
          farbe: st === 'ANGENOMMEN' ? '#0d9488' : st === 'ABGELEHNT' ? '#be123c' : FARBEN[i % FARBEN.length],
        })).filter(x => x.wert > 0);

        const jeArt = ARTEN.map((a, i) => ({
          label: a.charAt(0) + a.slice(1).toLowerCase(),
          wert: s(liste.filter(n => n.art === a), n => n.betrag),
          farbe: FARBEN[i % FARBEN.length],
        })).filter(x => x.wert > 0);

        const monateNr = [...new Set(liste.map(n => num(n.monat)))].filter(Boolean).sort((a, b) => a - b);

        return (
          <>
            <div className="grid-2">
              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Zusammensetzung</div>
                       <h2>Nachtragsvolumen je Status</h2></div>
                </div>
                <div className="card-body">
                  <RingChart scheiben={jeStatus} summenLabel="angemeldet" />
                </div>
              </div>

              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Zusammensetzung</div>
                       <h2>Volumen je Art</h2></div>
                </div>
                <div className="card-body">
                  <RingChart scheiben={jeArt} summenLabel="angemeldet" />
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-head">
                  <div><div className="eyebrow">Rangfolge</div>
                       <h2>Die größten Nachträge</h2></div>
                </div>
                <div className="card-body">
                  <RangChart zweifarbig={false}
                    zeilen={[...liste].sort((a, b) => num(b.betrag) - num(a.betrag)).slice(0, 12)
                      .map(n => ({
                        label: `${n.projekt_nr ?? '–'} ${n.bezeichnung ?? ''}`.trim(),
                        wert: num(n.betrag),
                        hinweis: `${n.status} · ${pct(num(n.wahrscheinlichkeit) * 100, 0)} Wahrscheinlichkeit`,
                      }))} />
                </div>
              </div>

              {!!monateNr.length && (
                <div className="card">
                  <div className="card-head">
                    <div><div className="eyebrow">Verlauf</div>
                         <h2>Anmeldungen je Monat</h2></div>
                  </div>
                  <div className="legend">
                    <span><i style={{ background: '#0d9488' }} />angenommen</span>
                    <span><i style={{ background: '#b45309' }} />noch offen</span>
                    <span><i style={{ background: '#cbd5e1' }} />abgelehnt</span>
                  </div>
                  <div className="card-body">
                    <StapelChart
                      kategorien={monateNr.map(m => monatKurz(m))}
                      serien={[
                        { label: 'angenommen', farbe: '#0d9488',
                          werte: monateNr.map(m => s(liste.filter(n => num(n.monat) === m && n.status === 'ANGENOMMEN'), n => n.betrag)) },
                        { label: 'noch offen', farbe: '#b45309',
                          werte: monateNr.map(m => s(liste.filter(n => num(n.monat) === m && !['ANGENOMMEN', 'ABGELEHNT'].includes(n.status)), n => n.betrag)) },
                        { label: 'abgelehnt', farbe: '#cbd5e1',
                          werte: monateNr.map(m => s(liste.filter(n => num(n.monat) === m && n.status === 'ABGELEHNT'), n => n.betrag)) },
                      ]} />
                  </div>
                </div>
              )}
            </div>
          </>
        );
      })()}


      <ErfassungsForm
        modul="nachtrag"
        titel="Nachtrag anmelden"
        beschreibung="Die Wahrscheinlichkeit steuert, mit welchem Anteil der Nachtrag in die Erwartung eingeht."
        knopf="Nachtrag speichern"
        zusatz={{ jahr }}
        felder={[
          { name: 'projekt_nr', label: 'Projekt', typ: 'select', pflicht: true, breite: 240,
            optionen: [{ wert: '', text: '– wählen –' },
              ...projekte.map(p => ({ wert: p.projekt_nr, text: `${p.projekt_nr} · ${p.projektname ?? ''}` }))] },
          { name: 'bezeichnung', label: 'Bezeichnung', pflicht: true, breite: 260 },
          { name: 'art', label: 'Art', typ: 'select', vorgabe: 'MEHRMENGE',
            optionen: ARTEN.map(a => ({ wert: a, text: a })) },
          { name: 'rechtsgrundlage', label: 'Grundlage', typ: 'select', vorgabe: 'VOB/B',
            optionen: [{ wert: 'VOB/B', text: 'VOB/B' }, { wert: 'BGB', text: 'BGB' },
                       { wert: 'SONSTIGE', text: 'sonstige' }] },
          { name: 'betrag', label: 'Betrag €', typ: 'number', pflicht: true },
          { name: 'kosten', label: 'Kosten €', typ: 'number', hinweis: 'für das Ergebnis' },
          { name: 'wahrscheinlichkeit', label: 'Eintritt %', typ: 'prozent', vorgabe: 50 },
          { name: 'monat', label: 'Monat', typ: 'number' },
          { name: 'status', label: 'Status', typ: 'select', vorgabe: 'ANGEMELDET',
            optionen: STATUS.map(x => ({ wert: x, text: x })) },
          { name: 'begruendung', label: 'Begründung', typ: 'textarea', breite: 260 },
        ]}
      />

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Register</div><h2>Erfasste Nachträge</h2></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Nachtrag</th><th>Projekt</th><th>Art</th><th>Grundlage</th>
                  <th className="r">Betrag</th><th className="r">Kosten</th><th className="r">Eintritt</th>
                  <th className="r">Erwartungswert</th><th className="r">Erw. Ergebnis</th>
                  <th>Status</th><th>Gemeldet</th>
                </tr>
              </thead>
              <tbody>
                {liste.map(n => (
                  <tr key={n.nachtrag_id}>
                    <td><b>{n.bezeichnung}</b>
                      {n.begruendung && <div className="muted" style={{ fontSize: 11.5 }}>{n.begruendung}</div>}</td>
                    <td>{n.projektname}<div className="muted mono">{n.projekt_nr}</div></td>
                    <td className="muted">{n.art}</td>
                    <td className="muted">{n.rechtsgrundlage}</td>
                    <td className="r num">{eur0(n.betrag)}</td>
                    <td className="r num">{eur0(n.kosten)}</td>
                    <td className="r num">{pct(num(n.wahrscheinlichkeit) * 100, 0)}</td>
                    <td className="r num"><b>{eur0(n.erwartungswert)}</b></td>
                    <td className={`r num ${vz(n.erwartetes_ergebnis)}`}>{eur0(n.erwartetes_ergebnis)}</td>
                    <td>
                      <span className={`chip ${n.status === 'ANGENOMMEN' ? 'pos'
                        : n.status === 'ABGELEHNT' ? 'neg' : 'warn'}`}>{n.status}</span>
                    </td>
                    <td className="muted">{datum(n.gemeldet_am)}</td>
                  </tr>
                ))}
                {!liste.length && (
                  <tr><td colSpan={11}><div className="empty">Noch kein Nachtrag erfasst.</div></td></tr>
                )}
                {!!liste.length && (
                  <tr className="total">
                    <td colSpan={4}>Summe</td>
                    <td className="r num">{eur0(s(liste, n => n.betrag))}</td>
                    <td className="r num">{eur0(s(liste, n => n.kosten))}</td>
                    <td />
                    <td className="r num">{eur0(erwartetGesamt)}</td>
                    <td className={`r num ${vz(ergebnisGesamt)}`}>{eur0(ergebnisGesamt)}</td>
                    <td colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
