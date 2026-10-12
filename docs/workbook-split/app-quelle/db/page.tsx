import Link from 'next/link';
import Shell, { RechtLink } from '../components/Shell';
import { nurErlaubteRegionen } from '@/lib/regionsschutz';
import RegionsHinweis from '../components/RegionsHinweis';
import PeriodenWahl from '../components/PeriodenWahl';
import { LinienChart } from '../components/Charts';
import { requireRecht, regionErzwingen } from '@/lib/guard';
import { geschaeftsjahre, dbMonate, dbRegionMonate, brueckeZumEbitda,
         regionenStamm } from '@/lib/queries';
import { eur0, pct, vz, monatKurz, num } from '@/lib/format';
import { zeitraum } from '@/lib/zeitraum';

export const dynamic = 'force-dynamic';

type Zeile = {
  bez: string;
  formel?: string;
  werte: number[];
  jahr: number;
  art: 'leistung' | 'abzug' | 'stufe' | 'ergebnis';
  hinweis?: string;
};

/** Mehrere Regionsreihen zu einer Monatsreihe addieren. */
function verdichten(reihen: Record<string, unknown>[]): Record<string, unknown>[] {
  const je = new Map<number, Record<string, unknown>>();
  for (const r of reihen) {
    const monat = num(r.monat);
    const vorhanden = je.get(monat);
    if (!vorhanden) { je.set(monat, { ...r }); continue; }
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v))) {
        if (k !== 'monat' && k !== 'jahr') vorhanden[k] = num(vorhanden[k]) + num(v);
      }
    }
  }
  return [...je.values()].sort((a, b) => num(a.monat) - num(b.monat));
}

export default async function DbSeite({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const benutzer = await requireRecht('klr.read');
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || new Date().getFullYear();
  /* Aus der frueheren Einzelperiode ist eine Spanne geworden: ein einzelner
     Monat ist jetzt der Fall von = bis.  Die alte Adresse ?monat=7 wird
     weiter verstanden, damit gespeicherte Links nicht ins Leere laufen. */
  const einzel = Number(sp.monat) || null;
  const z = zeitraum(einzel ? { von: String(einzel), bis: String(einzel) } : sp);

  /* Eine Region waehlbar: dann rechnet die Staffel nur deren Auftraege.
     Die Zentralgemeinkosten liegen bewusst allein auf der Verwaltung – so
     sieht jede Region ihr eigenes Ergebnis, ohne fremde Umlage. */
  const [gesamtMonate, regionMonateRoh, regionenRoh] = await Promise.all([
    dbMonate(jahr, z.von, z.bis), dbRegionMonate(jahr, z.von, z.bis),
    regionenStamm(),
  ]);
  const regionen = nurErlaubteRegionen(regionenRoh, benutzer);
  const region = regionErzwingen(benutzer, sp.region || '');
  const regionMonate = nurErlaubteRegionen(regionMonateRoh, benutzer);

  /* Ohne Regionswahl die Gesamtreihe; mit Wahl die Monatsreihe dieser Region.
     Ist der Benutzer auf Regionen beschraenkt, wird auch "alle" auf seine
     Freigaben zusammengezogen statt heimlich das Gesamtunternehmen zu zeigen. */
  const alleMonate = (region
    ? regionMonate.filter(m => m.regionscode === region)
    : (benutzer.regionen.length
        ? verdichten(regionMonate as unknown as Record<string, unknown>[])
        : gesamtMonate)) as typeof gesamtMonate;

  const monate = alleMonate;   // bereits auf den Zeitraum eingegrenzt

  /* Die Bruecke zum EBITDA: ohne sie stehen auf zwei Seiten zwei Zahlen fuer
     denselben Monat, und niemand sieht den Weg dazwischen. */
  const bruecke = await brueckeZumEbitda(jahr, z.von, z.bis).catch(() => []);
  const regionsname = region
    ? regionen.find(r => r.regionscode === region)?.region ?? `Region ${region}`
    : null;

  const s = (f: (m: typeof alleMonate[number]) => unknown) =>
    monate.reduce((a, m) => a + num(f(m)), 0);
  const sp_ = (f: (m: typeof alleMonate[number]) => unknown) => monate.map(m => num(f(m)));

  const leistung   = s(m => m.leistung);
  const varKosten  = s(m => m.variable_kosten);
  const projFix    = s(m => m.fixe_projektkosten);
  const gkUmlage   = s(m => m.verrechnete_gk);
  const bereichIst = s(m => m.bereichskosten_ist);
  const bereichEnt = s(m => m.bereichsentlastung);
  const bereichDif = s(m => m.bereichs_deckungsdifferenz);
  const zentralGk  = s(m => m.unternehmensgemeinkosten);
  const zentralEnt = s(m => m.zentralentlastung);
  const zentralDif = s(m => m.zentral_deckungsdifferenz);
  const neutral    = s(m => m.neutrales_ergebnis);

  const db1 = leistung - varKosten;
  const db2 = db1 - projFix;
  const db3 = db2 - gkUmlage;
  const db4 = db3 - bereichDif - zentralDif;
  const evst = db4 - neutral;

  const zeilen: Zeile[] = [
    { bez: 'Betriebsleistung', art: 'leistung', jahr: leistung, werte: sp_(m => m.leistung),
      formel: 'Erlöse + Bestandsveränderung der Projektaufträge (Konten 83xxxx–89xxxx, 392000)',
      hinweis: 'Vorzeichen gedreht: im SAP-Export stehen Erlöse im Haben, also negativ.' },
    { bez: '− variable Einzelkosten', art: 'abzug', jahr: varKosten, werte: sp_(m => m.variable_kosten),
      formel: 'Material, Hilfs-/Betriebsstoffe, Fremdleistungen, Diesel, Entsorgung, Transport, Lohn- und Geräteverrechnung' },
    { bez: '= Deckungsbeitrag I', art: 'stufe', jahr: db1, werte: sp_(m => m.db1),
      formel: 'Betriebsleistung − variable Einzelkosten' },

    { bez: '− fixe Projektkosten', art: 'abzug', jahr: projFix, werte: sp_(m => m.fixe_projektkosten),
      formel: 'Übrige direkt auf dem Projektauftrag gebuchte Kosten (Personal, Miete, Versicherung, Abschreibung …)' },
    { bez: '= Deckungsbeitrag II', art: 'stufe', jahr: db2, werte: sp_(m => m.db2),
      formel: 'DB I − fixe Projektkosten' },

    { bez: '− verrechnete Bereichsgemeinkosten', art: 'abzug', jahr: gkUmlage, werte: sp_(m => m.verrechnete_gk),
      formel: 'Gemeinkostenzuschlag der Region auf das Projekt (Belegkreis 9900, Konto 7801020)' },
    { bez: '= Deckungsbeitrag III', art: 'stufe', jahr: db3, werte: sp_(m => m.db3),
      formel: 'DB II − verrechnete Bereichsgemeinkosten · Ergebnisbeitrag der Projekte' },

    { bez: '− Über-/Unterdeckung Bereich', art: 'abzug', jahr: bereichDif, werte: sp_(m => m.bereichs_deckungsdifferenz),
      formel: 'Ist-Kosten der Innenaufträge der Region − an Projekte verrechnete Zuschläge',
      hinweis: 'Negativer Wert = Überdeckung: es wurde mehr verrechnet als tatsächlich angefallen ist.' },
    { bez: '− Unternehmensgemeinkosten', art: 'abzug', jahr: zentralDif, werte: sp_(m => m.zentral_deckungsdifferenz),
      formel: 'Innenaufträge der Zentrale (Regionscode 50): Geschäftsführung, Rechnungswesen, EDV, Betriebsrat' },
    { bez: '= Deckungsbeitrag IV · Betriebsergebnis', art: 'stufe', jahr: db4, werte: sp_(m => m.db4),
      formel: 'DB III − Über-/Unterdeckung Bereich − Unternehmensgemeinkosten' },

    { bez: '− neutrales Ergebnis', art: 'abzug', jahr: neutral, werte: sp_(m => m.neutrales_ergebnis),
      formel: 'Zinsen, Ertragsteuern, periodenfremde Posten, kalkulatorische Kosten und deren Verrechnung' },
    { bez: '= Ergebnis der Auftragsrechnung', art: 'ergebnis', jahr: evst,
      werte: sp_(m => num(m.db4) - num(m.neutrales_ergebnis)),
      formel: 'Betriebsergebnis − neutrales Ergebnis' },
  ];

  const mListe = monate.map(m => m.monat);

  /* Darstellung: Betraege oder Anteil an der Betriebsleistung.
     ---------------------------------------------------------------------
     Die Prozentzahl bezieht sich immer auf die Leistung DERSELBEN Spalte.
     Vorher stand eine einzige Prozentspalte zwischen den Monaten und dem
     Jahr; sie zeigte die Jahresquote, wurde neben dem letzten Monat aber
     als dessen Quote gelesen.  Im Juli 2026 etwa 83,3 % statt der
     tatsaechlichen 108,7 %.  Deshalb gibt es jetzt keine Mischung mehr:
     entweder alles in Euro oder alles in Prozent. */
  const prozent = sp.ansicht === 'prozent';
  const leistungJeMonat = sp_(m => m.leistung);

  /* Bezugsgroesse einer Spalte.  Ist die Leistung eines Monats null,
     bleibt die Zelle leer statt eine Zahl zu erfinden. */
  const alsAnteil = (wert: number, bezug: number) =>
    bezug === 0 ? null : (wert / bezug) * 100;

  const zelle = (wert: number, bezug: number) => {
    if (!prozent) return eur0(wert);
    const a = alsAnteil(wert, bezug);
    return a === null ? '–' : pct(a);
  };

  /* Ueberschrift der Summenspalte: bei gewaehlter Periode ist es nicht
     das Geschaeftsjahr, sondern genau dieser Monat. */
  const summeKopf = z.gewaehlt ? z.text : `Geschäftsjahr ${jahr}`;
  /* Bei einer einzelnen Periode waere die Summenspalte eine Kopie der
     Monatsspalte – sie entfaellt dann. */
  const summeZeigen = mListe.length > 1;

  return (
    <Shell titel="Deckungsbeitragsrechnung DB1 – DB4"
           bereich={`${z.text} ${jahr}${regionsname ? ` · ${regionsname}` : ''}`}
           aktiv="db" benutzer={benutzer}>
      <RegionsHinweis benutzer={benutzer} />
      <div className="card">
        <PeriodenWahl pfad="/db" jahre={jahre} jahr={jahr} zeitraum={z}
                      kinder={<>
                        <div className="field">
                          <label htmlFor="region">Region</label>
                          <select id="region" name="region" defaultValue={region}>
                            {!benutzer.regionen.length && <option value="">alle Regionen</option>}
                            {benutzer.regionen.length > 1 && <option value="">meine Regionen</option>}
                            {regionen.map(r => (
                              <option key={r.regionscode} value={r.regionscode}>{r.region}</option>
                            ))}
                          </select>
                        </div>
                        {/* Gehoert in dieselbe Zeile wie die uebrigen Filter –
                            als Auswahlfeld, damit es sich wie sie bedient. */}
                        <div className="field">
                          <label htmlFor="ansicht">Darstellung</label>
                          <select id="ansicht" name="ansicht" defaultValue={prozent ? 'prozent' : ''}>
                            <option value="">Beträge in Euro</option>
                            <option value="prozent">% der Betriebsleistung</option>
                          </select>
                        </div>
                      </>} />
      </div>
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Stufenrechnung</div>
            <h2>Ergebnisstaffel {jahr}{z.gewaehlt ? ` · ${z.text}` : ''}
                {regionsname ? ` · ${regionsname}` : ''}</h2>
          </div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data staffel">
              <thead>
                <tr>
                  <th>Position</th>
                  {mListe.map(m => <th key={m} className="r">{monatKurz(m)}</th>)}
                  {summeZeigen && <th className="r fix-r">{summeKopf}</th>}
                </tr>
              </thead>
              <tbody>
                {zeilen.map(z => (
                  <tr key={z.bez} className={z.art === 'stufe' ? 'step' : z.art === 'ergebnis' ? 'result' : ''}>
                    <td className={z.art === 'abzug' ? 'indent' : ''}>
                      {z.bez}
                      {z.formel && <span className="formula">{z.formel}</span>}
                      {z.hinweis && <span className="formula">↳ {z.hinweis}</span>}
                    </td>
                    {z.werte.map((v, i) => (
                      <td key={i} className={`r num ${z.art === 'stufe' || z.art === 'ergebnis' ? vz(v) : ''}`}>
                        {zelle(v, leistungJeMonat[i])}
                      </td>
                    ))}
                    {summeZeigen && (
                      <td className={`r num fix-r ${z.art === 'stufe' || z.art === 'ergebnis' ? vz(z.jahr) : ''}`}>
                        <b>{zelle(z.jahr, leistung)}</b>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Verlauf</div><h2>Deckungsbeitragsstufen je Periode</h2></div>
          </div>
          <div className="legend">
            <span><i style={{ background: '#2563eb' }} />DB1</span>
            <span><i style={{ background: '#0d9488' }} />DB2</span>
            <span><i style={{ background: '#7c3aed' }} />DB3</span>
            <span><i style={{ background: '#0f172a' }} />DB4</span>
          </div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            <LinienChart monate={mListe} hoehe={230} serien={[
              { label: 'DB1', farbe: '#2563eb', werte: sp_(m => m.db1) },
              { label: 'DB2', farbe: '#0d9488', werte: sp_(m => m.db2) },
              { label: 'DB3', farbe: '#7c3aed', werte: sp_(m => m.db3) },
              { label: 'DB4', farbe: '#0f172a', werte: sp_(m => m.db4) },
            ]} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Gemeinkostenkontrolle</div>
              <h2>Deckung der Gemeinkosten</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data">
                <thead><tr><th>Position</th><th className="r">Ist-Kosten</th><th className="r">verrechnet</th><th className="r">Differenz</th></tr></thead>
                <tbody>
                  <tr>
                    <td><b>Bereichsgemeinkosten</b>
                      <span className="formula">Innenaufträge der operativen Regionen</span></td>
                    <td className="r num">{eur0(bereichIst)}</td>
                    <td className="r num">{eur0(-bereichEnt)}</td>
                    <td className={`r num ${vz(-bereichDif)}`}>{eur0(bereichDif)}</td>
                  </tr>
                  <tr>
                    <td><b>Unternehmensgemeinkosten</b>
                      <span className="formula">Innenaufträge der Zentrale (Regionscode 50)</span></td>
                    <td className="r num">{eur0(zentralGk)}</td>
                    <td className="r num">{eur0(-zentralEnt)}</td>
                    <td className={`r num ${vz(-zentralDif)}`}>{eur0(zentralDif)}</td>
                  </tr>
                  <tr>
                    <td><b>an Projekte verrechnet</b>
                      <span className="formula">Gemeinkostenzuschlag, Belastung der Projekte</span></td>
                    <td className="r num muted">–</td>
                    <td className="r num">{eur0(gkUmlage)}</td>
                    <td className="r num muted">–</td>
                  </tr>
                  <tr className="total">
                    <td>Gemeinkosten gesamt</td>
                    <td className="r num">{eur0(bereichIst + zentralGk)}</td>
                    <td className="r num">{eur0(-(bereichEnt + zentralEnt))}</td>
                    <td className={`r num ${vz(-(bereichDif + zentralDif))}`}>{eur0(bereichDif + zentralDif)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="card-body" style={{ paddingTop: 12 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>
                Eine negative Differenz bedeutet Überdeckung – die verrechneten Zuschläge übersteigen die
                tatsächlichen Gemeinkosten und verbessern das Betriebsergebnis.
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* -------------------------------------- Bruecke zum EBITDA
          "Es stimmt kein Monat" – das stimmte, weil die Staffel oben nur
          Auftragsbuchungen kennt.  Statt das zu behaupten, steht der Weg hier
          Monat fuer Monat neben derselben Spaltenteilung. */}
      {!!bruecke.length && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="eyebrow">Überleitung</div>
              <h2>Vom Auftragsergebnis zum EBITDA, Monat für Monat</h2>
            </div>
          </div>
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data staffel">
                <thead>
                  <tr><th>Position</th>
                      {bruecke.map(b => <th key={b.monat} className="r">{monatKurz(b.monat)}</th>)}
                      <th className="r fix-r">{z.gewaehlt ? z.text : `Jahr ${jahr}`}</th></tr>
                </thead>
                <tbody>
                  {([
                    ['Ergebnis der Auftragsrechnung', 'auftragsergebnis',
                     'was die Staffel oben ausweist', ''],
                    ['− Kosten ohne Auftragsbezug', 'ohne_auftrag',
                     'Verwaltung, Fuhrpark, Miete, Versicherungen – auf Kostenstellen gebucht', 'indent'],
                    ['= Ergebnis laut Einzelposten', 'guv',
                     'die vollständige GuV der Gesellschaft', 'step'],
                    ['+ Zinsen und Finanzergebnis heraus', 'finanzergebnis', 'das I in EBITDA', 'indent'],
                    ['+ Abschreibungen heraus', 'abschreibungen', 'das D und A in EBITDA', 'indent'],
                    ['+ neutrales Ergebnis und sonstige Steuern heraus', 'neutral_steuern',
                     'periodenfremde Posten, Grund- und Gewerbesteuer', 'indent'],
                    ['± Abgrenzung der Kontenzuordnung', 'abgrenzung',
                     'Rest zwischen GuV-Kontenstamm und dem Kontenmapping der Präsentation', 'indent'],
                    ['= EBITDA', 'ebitda',
                     'dieselbe Zahl wie im Cockpit und auf Folie 12', 'result'],
                  ] as const).map(([bez, feld, formel, art]) => (
                    <tr key={feld} className={art || undefined}>
                      <td className={art === 'indent' ? 'indent' : undefined}>
                        {art === 'step' || art === 'result' ? <b>{bez}</b> : bez}
                        <span className="formula">{formel}</span>
                      </td>
                      {bruecke.map(b => (
                        <td key={b.monat} className={`r num ${vz(num(b[feld]))}`}>
                          {art === 'step' || art === 'result'
                            ? <b>{eur0(b[feld])}</b> : eur0(b[feld])}
                        </td>
                      ))}
                      <td className="r num fix-r">
                        <b>{eur0(bruecke.map(b => num(b[feld])).reduce((a, b) => a + b, 0))}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </Shell>
  );
}
