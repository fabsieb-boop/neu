import Link from 'next/link';
import Shell from '../../components/Shell';
import Unterseiten from '../../components/Unterseiten';
import { UNTERSEITEN } from '../unterseiten';
import { requireRecht } from '@/lib/guard';
import { geschaeftsjahre } from '@/lib/queries';
import { vorstandsbericht, type Ampel } from '@/lib/vorstandsfragen';
import { eur0, monat as monatName, datum } from '@/lib/format';

export const dynamic = 'force-dynamic';

const AMPEL: Record<Ampel, { text: string; klasse: string }> = {
  gut:      { text: 'unkritisch',  klasse: 'pos'  },
  achtung:  { text: 'beobachten',  klasse: 'warn' },
  kritisch: { text: 'kritisch',    klasse: 'neg'  },
  luecke:   { text: 'Datenlücke',  klasse: 'info' },
};

export default async function VorstandsberichtSeite(
  { searchParams }: { searchParams: Promise<Record<string, string>> },
) {
  const benutzer = await requireRecht('bericht.read');
  const sp = await searchParams;
  const jahre = await geschaeftsjahre();
  const jahr = Number(sp.jahr) || jahre[0] || new Date().getFullYear();

  const b = await vorstandsbericht(jahr);
  const kritisch = b.folien.filter(f => f.ampel === 'kritisch').length;
  const datei = `/api/vorstandsbericht?jahr=${jahr}`;

  return (
    <Shell titel="Vorstandsbericht" bereich={`${monatName(b.bis)} ${jahr} · ${b.folien.length} Fragen`}
           aktiv="vorstand" benutzer={benutzer}
           aktion={<span style={{ display: 'flex', gap: 8 }}>
             <a className="btn primary" href={`/api/ergebnisbericht?jahr=${jahr}`} download>
               Ergebnisbericht laden
             </a>
             <a className="btn" href={datei} download>Vorstandsfragen laden</a>
           </span>}>

      <Unterseiten seiten={UNTERSEITEN} aktiv="vorstand" />

      <div className="card">
        <div className="card-body">
          <form className="filter" method="get">
            <label>
              <span>Geschäftsjahr</span>
              <select name="jahr" defaultValue={String(jahr)}>
                {jahre.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </label>
            <label>
              <span>Berichtszeitraum</span>
              <input type="text" readOnly value={`Januar bis ${monatName(b.bis)}`} />
            </label>
            <button className="btn" type="submit">Anzeigen</button>
            <a className="btn" href={datei} download>Herunterladen</a>
          </form>
        </div>
      </div>

      {b.luecken.length > 0 && (
        <div className="note warn">
          <b>{b.luecken.length} Datenlücke{b.luecken.length > 1 ? 'n' : ''}.</b> Für diese Fragen
          fehlt dem System die Quelle. Die betroffenen Folien sagen das offen, statt zu schätzen:
          <ul>{b.luecken.map(l => <li key={l}>{l}</li>)}</ul>
        </div>
      )}

      <div className="kpis">
        <div className="kpi accent">
          <div className="label">Gesamtleistung</div>
          <div className="value num">{eur0(b.zahlen.gesamtleistung)}</div>
          <div className="sub">Januar bis {monatName(b.bis)}</div>
        </div>
        <div className={`kpi ${b.zahlen.ergebnisNachSteuern >= 0 ? 'good' : 'bad'}`}>
          <div className="label">Ergebnis nach Steuern</div>
          <div className="value num">{eur0(b.zahlen.ergebnisNachSteuern)}</div>
          <div className="sub">BCS-GuV, gegen SAP geprüft</div>
        </div>
        <div className={`kpi ${b.zahlen.ebitda >= 0 ? 'good' : 'bad'}`}>
          <div className="label">EBITDA {jahr}</div>
          <div className="value num">{eur0(b.zahlen.ebitda)}</div>
          <div className="sub">Ist und Forecast, nach Bewertung</div>
        </div>
        <div className={`kpi ${b.zahlen.pruefungenOffen ? 'bad' : 'good'}`}>
          <div className="label">Selbstprüfung</div>
          <div className="value num">
            {b.zahlen.pruefungenGesamt - b.zahlen.pruefungenOffen} / {b.zahlen.pruefungenGesamt}
          </div>
          <div className="sub">
            <Link href="/pruefung" style={{ color: 'var(--accent)' }}>bestandene Prüfungen</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Folie 1</div>
            <h2>{b.titel}</h2>
          </div>
          <span className={`chip ${kritisch ? 'neg' : 'pos'}`}>
            {kritisch ? `${kritisch} kritisch` : 'nichts Kritisches'}
          </span>
        </div>
        <div className="card-body">
          <p>{b.untertitel}</p>
          <p className="muted">{b.hinweis}</p>
        </div>
      </div>

      {b.folien.map(f => {
        const a = AMPEL[f.ampel];
        return (
          <div className="card" key={f.nr}>
            <div className="card-head">
              <div>
                <div className="eyebrow">Folie {f.nr + 1}</div>
                <h2>{f.titel}</h2>
              </div>
              <span className={`chip ${a.klasse}`}>{a.text}</span>
            </div>
            <div className="card-body">
              <div className="tablewrap">
                <table className="data compact">
                  <tbody>
                    <tr><th style={{ width: '18%' }}>Frage</th><td>{f.frage}</td></tr>
                    <tr><th>Antwort aus den Zahlen</th><td>{f.antwort}</td></tr>
                    <tr><th>Besser machen</th><td>{f.besser}</td></tr>
                    <tr><th>Worauf zu achten ist</th><td>{f.nachhaken}</td></tr>
                    <tr><th>Quelle</th><td className="mono">{f.quelle}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Folie {b.folien.length + 2}</div>
            <h2>Die {b.prioritaeten.length} Punkte für die Vorstandsrunde</h2>
          </div>
        </div>
        <div className="card-body">
          <ol>{b.prioritaeten.map(p => <li key={p}>{p.replace(/^\d+\.\s*/, '')}</li>)}</ol>
        </div>
      </div>

      <div className="note">
          Stand {datum(b.stand)} ·
          <span className="mono"> Vorstandsbericht_TVF_{String(b.bis).padStart(2, '0')}_{jahr}.pptx</span>
        </div>
    </Shell>
  );
}
