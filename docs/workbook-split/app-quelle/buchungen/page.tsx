import Link from 'next/link';
import Shell from '../components/Shell';
import { requireRecht, regionErzwingen, hatRecht } from '@/lib/guard';
import { nurErlaubteRegionen } from '@/lib/regionsschutz';
import RegionsHinweis from '../components/RegionsHinweis';
import { geschaeftsjahre, perioden, belege, regionenStamm, kostenartenStamm,
         primaerOhneTraeger, projekteWahl } from '@/lib/queries';
import { eur0, vz, zahl, datum, MONATE, num } from '@/lib/format';
import Zuordnen, { StammListe } from './Zuordnen';

export const dynamic = 'force-dynamic';

const KREISE = [
  ['PRIMAER', 'Primärbuchung (Rechnung, Faktura, Sachbeleg)'],
  ['VERRECHNUNG', 'Innerbetriebliche Leistungsverrechnung (Lohn, Geräte)'],
  ['UMLAGE', 'Gemeinkostenzuschlag Region → Projekt'],
  ['ABRECHNUNG', 'Auftragsabrechnung (nicht ergebnisrelevant)'],
];

const TRAEGER = [
  ['PROJEKT', 'Projekt'],
  ['BEREICH', 'Innenauftrag Region'],
  ['ZENTRALE', 'Zentrale'],
  ['NICHT_ZUGEORDNET', 'ohne Kostenträger'],
];

function stammVorschlag(auftrag: string, nummern: Set<string>) {
  if (auftrag.length < 2) return '';
  const kopf = auftrag[0] === 'P' ? 'W' : auftrag[0] === 'W' ? 'P' : '';
  if (!kopf) return '';
  const nr = kopf + auftrag.slice(1);
  return nummern.has(nr) ? nr : '';
}

export default async function BuchungenSeite({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const benutzer = await requireRecht('klr.read');
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || new Date().getFullYear();
  const seite = Math.max(1, Number(sp.seite) || 1);
  /* Zeilen je Seite waehlbar, damit sich auch der ganze Bestand ausgeben
     laesst.  Nach oben begrenzt, sonst baut der Server eine Seite mit
     zehntausend Zeilen auf und der Browser steht. */
  /* Mehr als 2.000 Zeilen zu zeichnen dauert spuerbar lange; fuer den
     ganzen Bestand gibt es den Excel-Weg ueber den Server. */
  const limit = Math.min(2000, Math.max(25, Number(sp.limit) || 100));

  /* Regionsfreigabe erzwingen: eine Region, die dem Benutzer nicht
     freigegeben ist, wird auf seine erste erlaubte gezogen. Ohne diesen
     Schritt genuegte es, die Adresse von Hand zu aendern. */
  const gewaehlteRegion = regionErzwingen(benutzer, sp.region || '');

  const filter = {
    jahr,
    monat: Number(sp.monat) || undefined,
    region: gewaehlteRegion || undefined,
    projekt: sp.projekt || undefined,
    kostenart: sp.kostenart || undefined,
    belegkreis: sp.belegkreis || undefined,
    kostentraeger: sp.traeger || undefined,
    suche: sp.q || undefined,
    limit, offset: (seite - 1) * limit,
  };

  const darfZuordnen = hatRecht(benutzer, 'admin.pruefliste') && sp.traeger === 'NICHT_ZUGEORDNET';
  const [journal, monate, regionenRoh, konten, offen, stamm] = await Promise.all([
    belege(filter), perioden(jahr), regionenStamm(), kostenartenStamm(),
    primaerOhneTraeger(jahr),
    darfZuordnen ? projekteWahl() : Promise.resolve([]),
  ]);
  const stammNummern = new Set(stamm.map(p => p.projekt_nr));
  // Auch die Auswahlliste zeigt nur, was der Benutzer sehen darf
  const regionen = nurErlaubteRegionen(regionenRoh, benutzer);

  const seiten = Math.max(1, Math.ceil(journal.anzahl / limit));
  const link = (s: number) => {
    const p = new URLSearchParams();
    Object.entries({ ...sp, jahr: String(jahr), seite: String(s) }).forEach(([k, v]) => v && p.set(k, String(v)));
    return `/buchungen?${p}`;
  };

  return (
    <Shell titel="Belegjournal" bereich={`Geschäftsjahr ${jahr}`} aktiv="buchungen" benutzer={benutzer}
           aktion={<>
             <a className="btn klein" href="/api/import/vorlage">Buchungsvorlage</a>
             <span className="chip info">{zahl(journal.anzahl)} Zeilen · Saldo {eur0(journal.summe)}</span>
           </>}>

      <RegionsHinweis benutzer={benutzer} />

      {Number(offen[0]?.anzahl) > 0 && (
        <div className="note warn">
          <b>{zahl(offen[0].anzahl)} Primärbuchungen ohne Kostenträger</b>, Summe {eur0(offen[0].summe)}.
          Jede Zeile einzeln, der Saldo ist nur die Summe.{' '}
          {sp.traeger === 'NICHT_ZUGEORDNET'
            ? 'Auftrag eintragen und zuordnen. Gespeichert wird ein Beleg KORR, das SAP-Original bleibt stehen.'
            : <Link href={`/buchungen?jahr=${jahr}&belegkreis=PRIMAER&traeger=NICHT_ZUGEORDNET`}>Zeilen anzeigen und zuordnen</Link>}
        </div>
      )}

      <div className="card">
        <form className="toolbar" method="get" action="/buchungen">
          <div className="field">
            <label htmlFor="jahr">Jahr</label>
            <select id="jahr" name="jahr" defaultValue={String(jahr)}>
              {jahre.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="monat">Periode</label>
            <select id="monat" name="monat" defaultValue={sp.monat || ''}>
              <option value="">alle</option>
              {monate.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')} – {MONATE[m]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="region">Region</label>
            <select id="region" name="region" defaultValue={sp.region || ''}>
              <option value="">alle</option>
              {regionen.map(r => <option key={r.regionscode} value={r.regionscode}>{r.region}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="kostenart">Konto</label>
            <select id="kostenart" name="kostenart" defaultValue={sp.kostenart || ''}>
              <option value="">alle</option>
              {konten.filter(k => k.belege > 0).map(k => (
                <option key={k.kostenart_nr} value={k.kostenart_nr}>
                  {k.kostenart_nr.replace(/\.0$/, '')} – {k.bezeichnung}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="belegkreis">Belegkreis</label>
            <select id="belegkreis" name="belegkreis" defaultValue={sp.belegkreis || ''}>
              <option value="">alle</option>
              {KREISE.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="traeger">Kostenträger</label>
            <select id="traeger" name="traeger" defaultValue={sp.traeger || ''}>
              <option value="">alle</option>
              {TRAEGER.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="projekt">Auftrag</label>
            <input id="projekt" name="projekt" defaultValue={sp.projekt || ''} placeholder="z. B. P4102157208" />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label htmlFor="q">Volltext</label>
            <input id="q" name="q" defaultValue={sp.q || ''} placeholder="Objekt, Belegnummer, Konto" style={{ width: '100%' }} />
          </div>
          <div className="field">
            <label htmlFor="limit">Zeilen je Seite</label>
            <select id="limit" name="limit" defaultValue={String(limit)}>
              {[100, 500, 2000].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="toolbar-aktionen">
            <button className="btn primary" type="submit">Filtern</button>
            <Link className="btn" href={`/buchungen?jahr=${jahr}`}>Zurücksetzen</Link>
            {/* Geht an der Darstellung vorbei und liefert alle gefilterten
                Zeilen, nicht nur die angezeigte Seite. */}
            <a className="btn" href={`/api/buchungen/excel?${new URLSearchParams(
                 Object.fromEntries(Object.entries({ ...sp, jahr: String(jahr) })
                   .filter(([k, v]) => v && k !== 'seite' && k !== 'limit')) as Record<string, string>)}`}>
              Alle {zahl(journal.anzahl)} Zeilen als Excel
            </a>
          </div>
        </form>

        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr>
                  <th>Datum</th><th>Per.</th><th>Beleg</th><th>Art</th><th>Belegkreis</th>
                  <th>Auftrag</th><th>Objekt</th><th>Region</th>
                  <th>Konto</th><th>Bezeichnung</th><th>Kostengruppe</th>
                  {darfZuordnen && <th>Zuordnen</th>}
                  <th className="r fix-r">Wert</th>
                </tr>
              </thead>
              <tbody>
                <StammListe projekte={stamm.map(p => ({ projekt_nr: p.projekt_nr, projektname: p.projektname }))}>
                {journal.rows.map((b: any) => (
                  <tr key={b.buchung_id}>
                    <td className="muted">{datum(b.buchungsdatum)}</td>
                    <td className="num muted">{b.monat}</td>
                    <td className="mono">{String(b.belegnummer ?? '').replace(/\.0$/, '')}</td>
                    <td className="muted">{b.belegart || '–'}</td>
                    <td>
                      <span className={`chip ${b.belegkreis === 'ABRECHNUNG' ? 'warn'
                        : b.belegkreis === 'PRIMAER' ? 'info' : ''}`}>{b.belegkreis}</span>
                    </td>
                    <td className="mono">
                      {b.auftragstyp === 'PROJEKT'
                        ? <Link href={`/projekte/${b.projekt_nr}?jahr=${jahr}`} style={{ color: 'var(--accent)' }}>{b.projekt_nr}</Link>
                        : b.projekt_nr}
                    </td>
                    <td>{b.projektname}</td>
                    <td className="muted">{b.region}</td>
                    <td className="mono">{String(b.kostenart_nr ?? '').replace(/\.0$/, '')}</td>
                    <td>{b.kostenart_bez}</td>
                    <td className="muted">{b.klr_gruppe}</td>
                    {darfZuordnen && (
                      <td>
                        <Zuordnen
                          buchungId={Number(b.buchung_id)}
                          wert={num(b.wert)}
                          konto={String(b.kostenart_nr ?? '').replace(/\.0$/, '')}
                          text={String(b.buchungstext ?? '')}
                          auftrag={String(b.auftrag ?? '')}
                          vorschlag={stammVorschlag(String(b.auftrag ?? ''), stammNummern)}
                        />
                      </td>
                    )}
                    <td className={`r num fix-r ${vz(-num(b.wert))}`}>{eur0(b.wert)}</td>
                  </tr>
                ))}
                {!journal.rows.length && (
                  <tr><td colSpan={darfZuordnen ? 13 : 12}><div className="empty">Keine Buchungen für diese Auswahl.</div></td></tr>
                )}
                </StammListe>
              </tbody>
            </table>
          </div>

          <div className="pager">
            <span>
              Zeilen {journal.offset + 1}–{Math.min(journal.offset + limit, journal.anzahl)} von {zahl(journal.anzahl)}
              &nbsp;·&nbsp; Saldo der Auswahl <b className="num">{eur0(journal.summe)}</b>
              &nbsp;<span className="muted">(Kosten positiv, Erlöse negativ – Originalvorzeichen des SAP-Exports)</span>
              {journal.anzahl > limit && (
                <>
                  <br /><span className="muted">
                    Drucken und Excel oben geben aus, was hier steht – derzeit {zahl(limit)} von{' '}
                    {zahl(journal.anzahl)} Zeilen.
                  </span>
                </>
              )}
            </span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {seite > 1 && <Link className="btn" href={link(seite - 1)}>Zurück</Link>}
              <span>Seite {seite} von {seiten}</span>
              {seite < seiten && <Link className="btn" href={link(seite + 1)}>Weiter</Link>}
            </span>
          </div>
          {darfZuordnen && (
            <datalist id="auftragStamm">
              {stamm.map(p => (
                <option key={p.projekt_nr} value={p.projekt_nr}>{p.projektname}</option>
              ))}
            </datalist>
          )}
        </div>
      </div>
    </Shell>
  );
}
