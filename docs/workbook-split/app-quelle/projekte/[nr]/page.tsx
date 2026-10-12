import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '../../components/Shell';
import { SaeulenChart, LinienChart, Balken } from '../../components/Charts';
import { requireRecht } from '@/lib/guard';
import {
  geschaeftsjahre, projektErgebnis, projektKostenarten, projektMonate, belege,
  kalkulationIst, kalkulationen, kalkulationPositionen,
} from '@/lib/queries';
import { eur0, eurKurz, pct, anteil, vz, zahl, datum, monatKurz, num } from '@/lib/format';
import PeriodenWahl from '../../components/PeriodenWahl';
import Unterseiten from '../../components/Unterseiten';
import { projektSeiten } from './seiten';
import { zeitraum } from '@/lib/zeitraum';
import { letzterBelastbarerMonat } from '@/lib/queries';
import Risikomatrix from './Risikomatrix';
import KalkulationPflegen from './KalkulationPflegen';
import { projektRisiken, massnahmenJeProjekt, massnahmenKatalog,
         bestandDeckungAlle, stundenProjekte } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const STUFE_NAME: Record<number, string> = {
  0: 'Betriebsleistung', 1: 'Variable Einzelkosten', 2: 'Fixe Projektkosten', 9: 'Neutrales Ergebnis',
};

export default async function ProjektDetail({
  params, searchParams,
}: { params: Promise<{ nr: string }>; searchParams: Promise<Record<string, string>> }) {
  const benutzer = await requireRecht('projects.read');
  const { nr } = await params;
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || new Date().getFullYear();

  /* Der Zeitraum kommt aus der Adresse, wie ueberall sonst.  Ohne ihn zeigte
     diese Seite immer das ganze Jahr - wer aus der Auftragsauswertung mit
     "nur Maerz" hierher sprang, sah wieder Januar bis Dezember, ohne dass
     etwas darauf hingewiesen haette. */
  const z = zeitraum(sp, await letzterBelastbarerMonat(jahr));

  const projekt = await projektErgebnis(jahr, nr, z.von, z.bis);
  if (!projekt) notFound();

  const [kalk, fassungen] = await Promise.all([
    kalkulationIst(nr).catch(() => null),
    kalkulationen(nr).catch(() => []),
  ]);
  const positionen = kalk ? await kalkulationPositionen(kalk.kalkulation_id).catch(() => []) : [];
  const geltend = kalk ? fassungen.find(f => f.kalkulation_id === kalk.kalkulation_id) : null;

  const [kostenarten, monate, journal, risiken, massnahmen, katalog,
         bestandAlle, stundenAlle] = await Promise.all([
    projektKostenarten(jahr, nr, z.von, z.bis),
    projektMonate(jahr, nr, z.von, z.bis),
    belege({ jahr, projekt: nr, limit: 60 }),
    projektRisiken(nr),
    massnahmenJeProjekt(nr),
    massnahmenKatalog(),
    /* Beides beantwortet Fragen, die das Ergebnis allein offenlaesst: ist der
       Bestand gedeckt, und wie viel eigene Zeit steckt drin. */
    bestandDeckungAlle().catch(() => []),
    stundenProjekte(jahr, z.von, z.bis).catch(() => []),
  ]);

  const bestand = bestandAlle.find(b => b.auftrag === nr) ?? null;
  const stunden = stundenAlle.filter(s => s.projekt_nr === nr)
                             .reduce((a, s) => a + num(s.stunden), 0);
  const mitarbeiter = Math.max(0, ...stundenAlle.filter(s => s.projekt_nr === nr)
                                                .map(s => num(s.mitarbeiter)));

  /* Ergebnislage in denselben vier Klassen wie in der Auftragsauswertung –
     eine Marge auf zwei Nachkommastellen sagt bei einem laufenden Auftrag
     weniger als die Frage, ob er traegt. */
  const leistung = num(projekt.leistung);
  const marge = leistung > 0 ? (num(projekt.db3) / leistung) * 100 : null;
  const lage = leistung <= 0 ? { label: 'Ohne Leistung', farbe: '#64748b', ton: '' }
             : marge! < 0    ? { label: 'Zehrt',         farbe: '#be123c', ton: 'bad' }
             : marge! < 10   ? { label: 'Knapp',         farbe: '#b45309', ton: '' }
             :                 { label: 'Trägt',         farbe: '#047857', ton: 'good' };

  const BEFUNDTEXT: Record<string, string> = {
    OK: 'Kosten, Rechnungen und Bestand gehen auf.',
    LANGE_OHNE_RECHNUNG: 'Leistung liegt im Bestand, die letzte Rechnung ist alt.',
    VORAUSBERECHNET: 'Mehr berechnet als bisher gekostet – Ergebnis vorgezogen.',
    UEBERAKTIVIERT: 'Mehr aktiviert als gekostet; das Ergebnis steckt im Bestand.',
    OHNE_BESTANDSBUCHUNG: 'Kosten weder berechnet noch aktiviert.',
  };

  const mListe = monate.map(m => m.monat);
  const umlageAnteil = num(projekt.verrechnete_gk);

  const staffel = [
    { bez: 'Betriebsleistung', wert: num(projekt.leistung), art: 'leistung' as const,
      formel: 'Erlöse und Bestandsveränderung dieses Projekts' },
    { bez: '− variable Einzelkosten', wert: num(projekt.variable_kosten), art: 'abzug' as const,
      formel: 'Material, Fremdleistungen, Lohn- und Geräteverrechnung, Diesel, Entsorgung' },
    { bez: '= Deckungsbeitrag I', wert: num(projekt.db1), art: 'stufe' as const,
      formel: 'Betriebsleistung − variable Einzelkosten' },
    { bez: '− fixe Projektkosten', wert: num(projekt.fixe_projektkosten), art: 'abzug' as const,
      formel: 'übrige direkt gebuchte Kosten des Projekts' },
    { bez: '= Deckungsbeitrag II', wert: num(projekt.db2), art: 'stufe' as const,
      formel: 'DB I − fixe Projektkosten' },
    { bez: '− verrechnete Bereichsgemeinkosten', wert: umlageAnteil, art: 'abzug' as const,
      formel: 'Gemeinkostenzuschlag der Region, Konto 7801020' },
    { bez: '= Deckungsbeitrag III', wert: num(projekt.db3), art: 'stufe' as const,
      formel: 'DB II − verrechnete Bereichsgemeinkosten' },
    { bez: '− anteilige Unternehmensgemeinkosten', wert: num(projekt.umlage_zentrale), art: 'abzug' as const,
      formel: 'Umlage der Zentralkosten nach Leistungsanteil (Tragfähigkeitsprinzip)' },
    { bez: '= Deckungsbeitrag IV', wert: num(projekt.db4), art: 'ergebnis' as const,
      formel: 'DB III − anteilige Unternehmensgemeinkosten' },
  ];

  const maxKostenart = Math.max(...kostenarten.map(k => Math.abs(num(k.wert))), 1);

  return (
    <Shell titel={projekt.projektname || projekt.projekt_nr}
           bereich={`${projekt.projekt_nr} · Region ${projekt.region} · ${z.text} ${jahr}`}
           aktiv="projekte" benutzer={benutzer}
           aktion={<Link className="btn" href={`/projekte?jahr=${jahr}`}>Zurück zur Liste</Link>}>

      <Unterseiten seiten={projektSeiten(nr)} aktiv="uebersicht" />

      <div className="card">
        <PeriodenWahl pfad={`/projekte/${encodeURIComponent(nr)}`}
                      jahre={jahre} jahr={jahr} zeitraum={z} />
      </div>

      {/* -------------------------------------------- Kopf des Auftrags
          Wer eine Auftragsseite aufmacht, will zuerst wissen: worum geht es,
          wie steht er da, und sind die Zahlen belastbar.  Das steht jetzt
          oben statt verteilt ueber die Seite. */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Auftrag {projekt.projekt_nr}</div>
            <h2>{projekt.projektname || 'ohne Bezeichnung'}</h2>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <span className="chip" style={{ color: lage.farbe, borderColor: lage.farbe }}>
              {lage.label}{marge !== null ? ` · ${pct(marge)}` : ''}
            </span>
            {bestand && (
              <span className={`chip ${bestand.befund === 'OK' ? 'pos' : 'warn'}`}>
                Bestand {bestand.befund === 'OK' ? 'gedeckt' : bestand.befund.toLowerCase().replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi accent">
          <div className="label">Betriebsleistung</div>
          <div className="value num">{eurKurz(projekt.leistung)}</div>
          <div className="sub">Erlöse und Bestandsveränderung</div>
        </div>
        <div className={`kpi ${num(projekt.db1) >= 0 ? 'good' : 'bad'}`}>
          <div className="label">Deckungsbeitrag I</div>
          <div className="value num">{eurKurz(projekt.db1)}</div>
          <div className="sub">
            nach variablen Einzelkosten
            {leistung > 0 && <span className="zeile">{pct((num(projekt.db1) / leistung) * 100)} der Leistung</span>}
          </div>
        </div>
        <div className={`kpi ${lage.ton}`}>
          <div className="label">Deckungsbeitrag III</div>
          <div className="value num">{eurKurz(projekt.db3)}</div>
          <div className="sub">
            nach verrechneten Bereichsgemeinkosten
            {marge !== null && <span className="zeile">{pct(marge)} Marge</span>}
          </div>
        </div>
        {stunden > 0 && (
          <div className="kpi">
            <div className="label">Leistung je Stunde</div>
            <div className="value num">{eur0(leistung / stunden)}</div>
            <div className="sub">{zahl(Math.round(stunden))} Stunden auf dem Auftrag</div>
          </div>
        )}
        {bestand && (
          <div className={`kpi ${bestand.befund === 'OK' ? 'good' : 'bad'}`}>
            <div className="label">Nicht abgerechnet</div>
            <div className="value num">{eurKurz(bestand.bestand)}</div>
            <div className="sub">
              {bestand.letzte_rechnung
                ? `letzte Rechnung ${datum(bestand.letzte_rechnung)}`
                : 'noch keine Rechnung'}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------ Bestandsprüfung
          Die Gleichung, die sagt, ob das Ergebnis oben ueberhaupt eines ist. */}
      {bestand && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Bestandsprüfung</div>
              <h2>Kosten = berechnet + Bestandsveränderung + Ergebnis</h2>
            </div>
            <span className={`chip ${bestand.befund === 'OK' ? 'pos' : 'neg'}`}>
              {bestand.befund === 'OK' ? 'geht auf' : 'prüfen'}
            </span>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead><tr><th>Größe</th><th className="r">Betrag</th><th>Bedeutung</th></tr></thead>
                <tbody>
                  <tr><td>Kosten</td><td className="r num">{eur0(bestand.kosten)}</td>
                      <td className="muted">angefallen und gebucht</td></tr>
                  <tr><td>berechnet</td><td className="r num">{eur0(bestand.erloes)}</td>
                      <td className="muted">{zahl(bestand.rechnungen)} Rechnungen</td></tr>
                  <tr><td>Bestandsveränderung</td><td className="r num">{eur0(bestand.bestandsveraenderung)}</td>
                      <td className="muted">{zahl(bestand.bestandsbuchungen)} Buchungen</td></tr>
                  <tr className="total"><td><b>Lücke</b></td>
                      <td className={`r num ${vz(-num(bestand.luecke))}`}><b>{eur0(bestand.luecke)}</b></td>
                      <td className="muted">was weder berechnet noch aktiviert ist</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ Kalkulation */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Kalkulation gegen Ist</div>
            <h2>{kalk ? `${kalk.bezeichnung} · Fassung ${kalk.version}` : 'Noch keine Kalkulation'}</h2>
          </div>
          {kalk && kalk.verbraucht !== null && (
            <span className={`chip ${num(kalk.verbraucht) > 100 ? 'neg'
                              : num(kalk.verbraucht) > 90 ? 'warn' : 'pos'}`}>
              {pct(kalk.verbraucht)} der Kosten verbraucht
            </span>
          )}
        </div>

        {kalk ? (
          <>
            <div className="card-body flush">
              <div className="tablewrap">
                <table className="data compact">
                  <thead>
                    <tr><th /><th className="r">Kalkuliert</th><th className="r">Ist</th>
                        <th className="r">Abweichung</th><th className="r">Verbraucht</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th>Leistung</th>
                      <td className="r num">{eur0(kalk.kalk_erloes)}</td>
                      <td className="r num">{eur0(kalk.ist_leistung)}</td>
                      <td className={`r num ${vz(num(kalk.ist_leistung) - num(kalk.kalk_erloes))}`}>
                        {eur0(num(kalk.ist_leistung) - num(kalk.kalk_erloes))}
                      </td>
                      <td className="r num muted">
                        {kalk.abgearbeitet === null ? '–' : pct(kalk.abgearbeitet)}
                      </td>
                    </tr>
                    <tr>
                      <th>Kosten</th>
                      <td className="r num">{eur0(kalk.kalk_kosten)}</td>
                      <td className="r num">{eur0(kalk.ist_kosten)}</td>
                      {/* Mehr Kosten als kalkuliert ist schlecht – deshalb das
                          Vorzeichen hier umgedreht gefaerbt. */}
                      <td className={`r num ${vz(-num(kalk.kostenabweichung))}`}>
                        {eur0(kalk.kostenabweichung)}
                      </td>
                      <td className="r num muted">
                        {kalk.verbraucht === null ? '–' : pct(kalk.verbraucht)}
                      </td>
                    </tr>
                    <tr className="sub">
                      <th>Deckungsbeitrag</th>
                      <td className="r num"><b>{eur0(kalk.kalk_db)}</b>
                        {kalk.kalk_marge !== null && (
                          <div className="muted" style={{ fontSize: 11 }}>{pct(kalk.kalk_marge)} Marge</div>
                        )}
                      </td>
                      <td className="r num"><b>{eur0(kalk.ist_db)}</b></td>
                      <td className={`r num ${vz(num(kalk.ist_db) - num(kalk.kalk_db))}`}>
                        <b>{eur0(num(kalk.ist_db) - num(kalk.kalk_db))}</b>
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {positionen.length > 2 && (
              <div className="card-body flush">
                <div className="tablewrap">
                  <table className="data compact">
                    <thead>
                      <tr><th style={{ width: 60 }}>Pos.</th><th>Position</th><th>Konto</th>
                          <th className="r">Menge</th><th>Einheit</th>
                          <th className="r">Einheitspreis</th><th className="r">Betrag</th></tr>
                    </thead>
                    <tbody>
                      {positionen.map(z => (
                        <tr key={z.position_id} className={z.art === 'ERLOES' ? 'sub' : undefined}>
                          <td className="num muted">{z.lfd ?? ''}</td>
                          <td>{z.bezeichnung}
                            {z.art === 'ERLOES' && <span className="chip pos" style={{ marginLeft: 6 }}>Erlös</span>}
                          </td>
                          <td className="mono muted">{z.kostenart_nr ?? '–'}</td>
                          <td className="r num muted">{z.menge === null ? '–' : zahl(z.menge)}</td>
                          <td className="muted">{z.einheit ?? ''}</td>
                          <td className="r num muted">{z.satz === null ? '–' : eur0(z.satz)}</td>
                          <td className="r num">{eur0(z.betrag)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {fassungen.length > 1 && (
              <div className="pager">
                <span className="muted">
                  {fassungen.length} Fassungen:{' '}
                  {fassungen.map(f => `v${f.version} ${f.bezeichnung} (${f.status.toLowerCase()})`).join(' · ')}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="card-body">
            <p className="muted" style={{ marginTop: 0 }}>
              Zwei Wege: die kurze Form hier eintragen — Auftragssumme und Plankosten —, oder die
              vollständige Kalkulation mit Positionen unter{' '}
              <Link href="/import" style={{ color: 'var(--accent)' }}>Datenimport</Link> als
              Dateiart <i>Kalkulation</i> hochladen.
            </p>
          </div>
        )}
      </div>

      {benutzer.rechte.includes('projects.write') && (
        <KalkulationPflegen
          projektNr={nr}
          vorhanden={kalk && geltend ? {
            kalkulation_id: kalk.kalkulation_id,
            version: kalk.version,
            bezeichnung: kalk.bezeichnung,
            stand: kalk.stand,
            erloes: num(kalk.kalk_erloes),
            kosten: num(kalk.kalk_kosten),
            positionen: num(geltend.positionen),
            notiz: null,
          } : null}
        />
      )}

      {num(projekt.belege) === 0 && (
        <div className="note">
          <b>Auf dieses Projekt ist {jahr} noch nichts gebucht.</b> Die Staffel unten steht
          deshalb auf null — das ist kein Fehler, sondern der Anfang. Sobald die erste Buchung
          kommt, füllt sich die Seite von selbst. Erfassen lässt sie sich in der{' '}
          <Link href="/sap" style={{ color: 'var(--accent)' }}>Buchungsmaske</Link>, einlesen
          unter <Link href="/import" style={{ color: 'var(--accent)' }}>Datenimport</Link>.
        </div>
      )}

      <div className="kpis">
        <div className="kpi accent">
          <div className="label">Betriebsleistung</div>
          <div className="value num">{eurKurz(projekt.leistung)}</div>
          <div className="sub">{zahl(projekt.belege)} Buchungszeilen</div>
        </div>
        <div className={`kpi ${num(projekt.db1) >= 0 ? 'good' : 'bad'}`}>
          <div className="label">Deckungsbeitrag I</div>
          <div className="value num">{eurKurz(projekt.db1)}</div>
          <div className="sub">{projekt.db1_marge === null ? '–' : pct(projekt.db1_marge) + ' Marge'}</div>
        </div>
        <div className={`kpi ${num(projekt.db3) >= 0 ? 'good' : 'bad'}`}>
          <div className="label">Deckungsbeitrag III</div>
          <div className="value num">{eurKurz(projekt.db3)}</div>
          <div className="sub">{projekt.db3_marge === null ? '–' : pct(projekt.db3_marge) + ' Marge'}</div>
        </div>
        <div className="kpi">
          <div className="label">Buchungszeitraum</div>
          <div className="value" style={{ fontSize: 17 }}>{datum(projekt.erste_buchung)} – {datum(projekt.letzte_buchung)}</div>
          <div className="sub">{monate.length} Perioden bebucht</div>
        </div>
      </div>

      <div className="grid-wide">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Ergebnisrechnung</div>
              <h2>Deckungsbeitragsstaffel</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data staffel">
                <thead><tr><th>Position</th><th className="r">Betrag</th><th className="r">% Leistung</th></tr></thead>
                <tbody>
                  {staffel.map(z => (
                    <tr key={z.bez} className={z.art === 'stufe' ? 'step' : z.art === 'ergebnis' ? 'result' : ''}>
                      <td className={z.art === 'abzug' ? 'indent' : ''}>
                        {z.bez}<span className="formula">{z.formel}</span>
                      </td>
                      <td className={`r num ${z.art === 'stufe' ? vz(z.wert) : ''}`}><b>{eur0(z.wert)}</b></td>
                      <td className="r num muted">
                        {num(projekt.leistung) ? pct(anteil(z.wert, projekt.leistung) ?? 0) : '–'}
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
            <div><div className="eyebrow">Verlauf</div><h2>Leistung und Kosten je Periode</h2></div>
          </div>
          <div className="legend">
            <span><i style={{ background: '#2563eb' }} />Leistung</span>
            <span><i style={{ background: '#f59e0b' }} />var. Einzelkosten</span>
            <span><i style={{ background: '#94a3b8' }} />Fix + Umlage</span>
          </div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            <SaeulenChart monate={mListe} hoehe={220} serien={[
              { label: 'Leistung', farbe: '#2563eb', werte: monate.map(m => m.leistung) },
              { label: 'var. Einzelkosten', farbe: '#f59e0b', werte: monate.map(m => m.k_var) },
              { label: 'Fix + Umlage', farbe: '#94a3b8', werte: monate.map(m => num(m.k_fix) + num(m.umlage)) },
            ]} />
          </div>
          <div className="legend"><span><i style={{ background: '#7c3aed' }} />DB III je Periode</span></div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <LinienChart monate={mListe} hoehe={170} serien={[
              { label: 'DB III', farbe: '#7c3aed', werte: monate.map(m => m.db3) },
            ]} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Kostenartenaufriss</div>
            <h2>Womit das Ergebnis zustande kommt</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr>
                  <th>Konto</th><th>Bezeichnung</th><th>Kostengruppe</th><th>DB-Stufe</th>
                  <th className="r">Betrag</th><th className="r">Belege</th><th className="r">% Leistung</th><th />
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 9].filter(s => kostenarten.some(k => k.db_stufe === s)).map(stufe => {
                  const rows = kostenarten.filter(k => k.db_stufe === stufe);
                  const anz = (k: typeof rows[number]) => stufe === 0 ? -num(k.wert) : num(k.wert);
                  return [
                    <tr key={`h${stufe}`} className="head-row">
                      <td colSpan={4}>{STUFE_NAME[stufe]}</td>
                      <td className="r num">{eur0(rows.reduce((a, k) => a + anz(k), 0))}</td>
                      <td className="r num">{zahl(rows.reduce((a, k) => a + k.belege, 0))}</td>
                      <td colSpan={2} />
                    </tr>,
                    ...rows.map(k => (
                      <tr key={stufe + k.kostenart_nr}>
                        <td className="mono">
                          <Link href={`/buchungen?jahr=${jahr}&projekt=${nr}&kostenart=${encodeURIComponent(k.kostenart_nr)}`}
                                style={{ color: 'var(--accent)' }}>
                            {k.kostenart_nr.replace(/\.0$/, '')}
                          </Link>
                        </td>
                        <td>{k.kostenart_bez}</td>
                        <td className="muted">{k.klr_gruppe}</td>
                        <td className="muted">{stufe}</td>
                        <td className={`r num ${vz(anz(k))}`}>{eur0(anz(k))}</td>
                        <td className="r num muted">{zahl(k.belege)}</td>
                        <td className="r num muted">
                          {num(projekt.leistung) ? pct(anteil(anz(k), projekt.leistung) ?? 0) : '–'}
                        </td>
                        <td className="r"><Balken wert={num(k.wert)} max={maxKostenart} /></td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Belege</div>
            <h2>Buchungszeilen dieses Projekts</h2>
          </div>
          <Link className="btn" href={`/buchungen?jahr=${jahr}&projekt=${nr}`}>Vollständiges Journal</Link>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr>
                  <th>Datum</th><th>Beleg</th><th>Art</th><th>Belegkreis</th>
                  <th>Konto</th><th>Bezeichnung</th><th className="r">Wert</th>
                </tr>
              </thead>
              <tbody>
                {journal.rows.map((b: any) => (
                  <tr key={b.buchung_id}>
                    <td className="muted">{datum(b.buchungsdatum)}</td>
                    <td className="mono">{String(b.belegnummer ?? '').replace(/\.0$/, '')}</td>
                    <td className="muted">{b.belegart || '–'}</td>
                    <td><span className="chip">{b.belegkreis}</span></td>
                    <td className="mono">{String(b.kostenart_nr ?? '').replace(/\.0$/, '')}</td>
                    <td>{b.kostenart_bez}</td>
                    <td className={`r num ${vz(-num(b.wert))}`}>{eur0(b.wert)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Risikomatrix projektNr={nr} risiken={risiken} massnahmen={massnahmen}
                    katalog={katalog} schreibrecht={benutzer.rechte.includes('risk.write')} />
    </Shell>
  );
}
