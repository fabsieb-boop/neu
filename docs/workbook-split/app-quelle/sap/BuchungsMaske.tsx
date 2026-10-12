'use client';

import Betragsfeld from '../components/Betragsfeld';
import { betragLesen } from '@/lib/format';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const SCHLUESSEL: Record<string, { seite: 'S' | 'H'; text: string }> = {
  '40': { seite: 'S', text: '40 · Sachkonto Soll' },
  '50': { seite: 'H', text: '50 · Sachkonto Haben' },
  '01': { seite: 'S', text: '01 · Rechnung Debitor' },
  '11': { seite: 'H', text: '11 · Gutschrift Debitor' },
  '21': { seite: 'S', text: '21 · Gutschrift Kreditor' },
  '31': { seite: 'H', text: '31 · Rechnung Kreditor' },
  '70': { seite: 'S', text: '70 · Anlagenzugang' },
  '75': { seite: 'H', text: '75 · Anlagenabgang' },
};

const eur = (v: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0) + ' €';

const heute = () => new Date().toISOString().slice(0, 10);

type Automatik = {
  einstellung: { kontoBestand: string; kontoGuv: string; automatik: boolean };
  umlageEinstellung: { konto: string; satz: number; kostenstelle: string };
  vorschlaege: {
    auftrag: string; projektname: string; richtung: 'AUFBAU' | 'ABBAU'; erklaerung: string;
    zeilen: { buchungsschluessel: string; konto: string; betrag: number;
              auftrag?: string; kostenstelle?: string; text?: string }[];
  }[];
  umlage: {
    auftrag: string; basis: number; satz: number; betrag: number;
    kostenstelle: string; erklaerung: string;
    zeilen: { buchungsschluessel: string; konto: string; betrag: number;
              auftrag?: string; kostenstelle?: string; text?: string }[];
  }[];
};

type Zeile = {
  buchungsschluessel: string; konto: string; betrag: string;
  steuerschluessel: string; kostenstelle: string; auftrag: string;
  profitcenter: string; text: string;
};

const LEERZEILE: Zeile = {
  buchungsschluessel: '40', konto: '', betrag: '',
  steuerschluessel: '', kostenstelle: '', auftrag: '', profitcenter: '', text: '',
};

export default function BuchungsMaske({ konten, auftraege }: {
  konten: { nr: string; bez: string }[];
  auftraege: { nr: string; name: string }[];
}) {
  const router = useRouter();
  const [kopf, setKopf] = useState({
    buchungskreis: '4102', belegdatum: heute(), buchungsdatum: heute(),
    belegart: 'SA', waehrung: 'EUR', referenz: '', belegtext: '',
  });
  const [zeilen, setZeilen] = useState<Zeile[]>([
    { ...LEERZEILE, buchungsschluessel: '40' },
    { ...LEERZEILE, buchungsschluessel: '50' },
  ]);
  const [status, setStatus] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  /* ---------------------------------------------------------------- *
   * Automatik: Bestandsveraenderung und Gemeinkostenumlage
   * ----------------------------------------------------------------
   * Gerechnet wird ueber dieselbe Schnittstelle wie im Testcenter, damit
   * beide nie auseinanderlaufen.  Uebernommen wird nur, was hier
   * ausdruecklich angehakt ist – die Maske ergaenzt nichts hinter dem
   * Ruecken dessen, der bucht.
   * ---------------------------------------------------------------- */
  const [automatik, setAutomatik] = useState<Automatik | null>(null);
  const [bvMit, setBvMit] = useState(true);
  const [umlageMit, setUmlageMit] = useState(true);
  const [umlagesatz, setUmlagesatz] = useState('');

  const rechnen = useCallback(async (zs: Zeile[], satz: string, an: boolean) => {
    const gefuellt = zs.filter(z => z.konto && Number(String(z.betrag).replace(',', '.')) > 0);
    if (!gefuellt.length) { setAutomatik(null); return; }
    try {
      const r = await fetch('/api/bestandsveraenderung', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kopf,
          zeilen: gefuellt.map(z => ({ ...z, betrag: Number(String(z.betrag).replace(',', '.')) })),
          umlagesatz: satz, umlage: an,
        }),
      });
      setAutomatik(r.ok ? await r.json() : null);
    } catch { setAutomatik(null); }
    // kopf bewusst nicht in den Abhaengigkeiten: der Vorschlag haengt an den
    // Zeilen, nicht am Belegdatum – sonst rechnete jede Tastatureingabe neu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => rechnen(zeilen, umlagesatz, umlageMit), 250);
    return () => clearTimeout(t);
  }, [zeilen, umlagesatz, umlageMit, rechnen]);

  /** Zeilen, die zusaetzlich in den Beleg gehen. */
  const zusatzzeilen = useMemo(() => [
    ...(bvMit ? (automatik?.vorschlaege ?? []).flatMap(v => v.zeilen) : []),
    ...(umlageMit ? (automatik?.umlage ?? []).flatMap(v => v.zeilen) : []),
  ], [automatik, bvMit, umlageMit]);

  const { soll, haben, differenz } = useMemo(() => {
    let s = 0, h = 0;
    for (const z of zeilen) {
      const b = Number(String(z.betrag).replace(',', '.')) || 0;
      if (SCHLUESSEL[z.buchungsschluessel]?.seite === 'S') s += b; else h += b;
    }
    return { soll: s, haben: h, differenz: Math.round((s - h) * 100) / 100 };
  }, [zeilen]);

  const vollstaendig = zeilen.every(z => z.konto && Number(String(z.betrag).replace(',', '.')) > 0);
  const buchbar = vollstaendig && differenz === 0 && zeilen.length >= 2;

  const setzeZeile = (i: number, k: keyof Zeile, v: string) =>
    setZeilen(zs => zs.map((z, j) => j === i ? { ...z, [k]: v } : z));

  async function buchen() {
    setLaeuft(true); setStatus(null);
    try {
      const r = await fetch('/api/sap/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kopf,
          zeilen: [
            ...zeilen.map(z => ({ ...z, betrag: Number(String(z.betrag).replace(',', '.')) })),
            /* Die ergaenzten Saetze gehen als vollwertige Belegzeilen mit –
               fehlende Felder bewusst leer und nicht geraten. */
            ...zusatzzeilen.map(z => ({
              buchungsschluessel: z.buchungsschluessel, konto: z.konto,
              betrag: Number(z.betrag) || 0, steuerschluessel: '',
              kostenstelle: z.kostenstelle ?? '', auftrag: z.auftrag ?? '',
              profitcenter: '', text: z.text ?? '',
            })),
          ],
        }),
      });

      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        const texte: Record<string, string> = {
          PFLICHTFELDER_FEHLEN: `Pflichtfelder im Belegkopf fehlen: ${(d.felder ?? []).join(', ')}`,
          ZU_WENIG_ZEILEN: 'Ein Beleg braucht mindestens zwei Zeilen.',
          BELEG_NICHT_AUSGEGLICHEN: `Soll ${eur(d.soll)} und Haben ${eur(d.haben)} stimmen nicht überein.`,
          BUCHUNGSSCHLUESSEL_UNGUELTIG: `Unzulässiger Buchungsschlüssel in Zeile ${d.zeile}.`,
          KONTO_FEHLT: `In Zeile ${d.zeile} fehlt das Konto.`,
          BETRAG_UNGUELTIG: `Der Betrag in Zeile ${d.zeile} muss größer als null sein.`,
        };
        setStatus({ art: 'fehler', text: texte[d.error] ?? 'Der Beleg konnte nicht gebucht werden.' });
        return;
      }

      const blob = await r.blob();
      const belegId = r.headers.get('X-Beleg-Id');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SAP_FI_${kopf.buchungsdatum}_${belegId ?? 'beleg'}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);

      setStatus({ art: 'ok', text: `Beleg ${belegId} gespeichert. Die CSV-Datei wurde heruntergeladen.` });
      setZeilen([{ ...LEERZEILE, buchungsschluessel: '40' }, { ...LEERZEILE, buchungsschluessel: '50' }]);
      setKopf(k => ({ ...k, referenz: '', belegtext: '' }));
      router.refresh();
    } catch {
      setStatus({ art: 'fehler', text: 'Der Server ist nicht erreichbar.' });
    } finally { setLaeuft(false); }
  }

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Schritt 1</div><h2>Belegkopf</h2></div>
        </div>
        <div className="toolbar">
          <div className="field"><label>Buchungskreis</label>
            <input value={kopf.buchungskreis} onChange={e => setKopf({ ...kopf, buchungskreis: e.target.value })} /></div>
          <div className="field"><label>Belegdatum</label>
            <input type="date" value={kopf.belegdatum} onChange={e => setKopf({ ...kopf, belegdatum: e.target.value })} /></div>
          <div className="field"><label>Buchungsdatum</label>
            <input type="date" value={kopf.buchungsdatum} onChange={e => setKopf({ ...kopf, buchungsdatum: e.target.value })} /></div>
          <div className="field"><label>Belegart</label>
            <select value={kopf.belegart} onChange={e => setKopf({ ...kopf, belegart: e.target.value })}>
              {['SA', 'KR', 'DR', 'KG', 'DG', 'AB'].map(a => <option key={a} value={a}>{a}</option>)}
            </select></div>
          <div className="field"><label>Währung</label>
            <select value={kopf.waehrung} onChange={e => setKopf({ ...kopf, waehrung: e.target.value })}>
              {['EUR', 'USD', 'CHF', 'GBP', 'PLN'].map(w => <option key={w} value={w}>{w}</option>)}
            </select></div>
          <div className="field"><label>Referenz</label>
            <input value={kopf.referenz} onChange={e => setKopf({ ...kopf, referenz: e.target.value })} /></div>
          <div className="field" style={{ flex: 1, minWidth: 220 }}><label>Belegkopftext</label>
            <input value={kopf.belegtext} style={{ width: '100%' }}
                   onChange={e => setKopf({ ...kopf, belegtext: e.target.value })} /></div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Schritt 2</div>
            <h2>Buchungszeilen</h2>
            <p>Beträge immer positiv erfassen – die Seite ergibt sich aus dem Buchungsschlüssel.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="chip">Soll {eur(soll)}</span>
            <span className="chip">Haben {eur(haben)}</span>
            <span className={`chip ${differenz === 0 ? 'pos' : 'neg'}`}>
              {differenz === 0 ? 'ausgeglichen' : `Differenz ${eur(differenz)}`}
            </span>
          </div>
        </div>

        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr><th>#</th><th>Buchungsschlüssel</th><th>Konto</th><th className="r">Betrag</th>
                    <th>Steuer</th><th>Kostenstelle</th><th>Auftrag</th><th>Profitcenter</th><th>Text</th><th /></tr>
              </thead>
              <tbody>
                {zeilen.map((z, i) => (
                  <tr key={i}>
                    <td className="num muted">{i + 1}</td>
                    <td>
                      <select value={z.buchungsschluessel} style={{ minWidth: 170 }}
                              onChange={e => setzeZeile(i, 'buchungsschluessel', e.target.value)}>
                        {Object.entries(SCHLUESSEL).map(([k, v]) => <option key={k} value={k}>{v.text}</option>)}
                      </select>
                    </td>
                    <td>
                      <input list="konten" value={z.konto} style={{ minWidth: 130 }}
                             onChange={e => setzeZeile(i, 'konto', e.target.value)} placeholder="Sachkonto" />
                      <div className="muted" style={{ fontSize: 11 }}>
                        {konten.find(k => k.nr === z.konto)?.bez ?? ''}
                      </div>
                    </td>
                    <td className="r">
                      <Betragsfeld wert={betragLesen(String(z.betrag ?? ''))}
                                   ariaLabel={`Betrag Zeile ${i + 1}`}
                                   style={{ minWidth: 110 }}
                                   onWert={n => setzeZeile(i, 'betrag',
                                     n === null ? '' : String(n))} />
                    </td>
                    <td><input value={z.steuerschluessel} style={{ minWidth: 70 }}
                               onChange={e => setzeZeile(i, 'steuerschluessel', e.target.value)} /></td>
                    <td><input value={z.kostenstelle} style={{ minWidth: 110 }}
                               onChange={e => setzeZeile(i, 'kostenstelle', e.target.value)} /></td>
                    <td>
                      <input list="auftraege" value={z.auftrag} style={{ minWidth: 130 }}
                             onChange={e => setzeZeile(i, 'auftrag', e.target.value)} />
                      <div className="muted" style={{ fontSize: 11 }}>
                        {auftraege.find(a => a.nr === z.auftrag)?.name ?? ''}
                      </div>
                    </td>
                    <td><input value={z.profitcenter} style={{ minWidth: 100 }}
                               onChange={e => setzeZeile(i, 'profitcenter', e.target.value)} /></td>
                    <td><input value={z.text} style={{ minWidth: 160 }}
                               onChange={e => setzeZeile(i, 'text', e.target.value)} /></td>
                    <td className="r">
                      <button className="btn" disabled={zeilen.length <= 2}
                              onClick={() => setZeilen(zs => zs.filter((_, j) => j !== i))}>Entfernen</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <datalist id="konten">
            {konten.map(k => <option key={k.nr} value={k.nr}>{k.bez}</option>)}
          </datalist>
          <datalist id="auftraege">
            {auftraege.map(a => <option key={a.nr} value={a.nr}>{a.name}</option>)}
          </datalist>

          {/* ------------------------------------ was die Maske ergänzt */}
          {(automatik?.vorschlaege.length || automatik?.umlage.length) ? (
            <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="card-head" style={{ padding: 0, marginBottom: 8 }}>
                <div>
                  <div className="eyebrow">Automatik</div>
                  <h3 style={{ fontSize: 14, margin: 0 }}>Diese Sätze kommen dazu</h3>
                </div>
                <span className="chip info">{zusatzzeilen.length} Zeilen</span>
              </div>

              {automatik.vorschlaege.length > 0 && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                  <input type="checkbox" checked={bvMit} onChange={e => setBvMit(e.target.checked)} />
                  <span>
                    <b>Bestandsveränderung</b>{' '}
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      {automatik.vorschlaege.map(v =>
                        `${v.auftrag} ${v.richtung === 'AUFBAU' ? 'Aufbau' : 'Abbau'} `
                        + `${eur(v.zeilen[0]?.betrag ?? 0)}`).join(' · ')}
                      {' '}— Konto {automatik.einstellung.kontoGuv} gegen {automatik.einstellung.kontoBestand}
                    </span>
                  </span>
                </label>
              )}

              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <input type="checkbox" checked={umlageMit} onChange={e => setUmlageMit(e.target.checked)} />
                <span>
                  <b>Gemeinkostenumlage</b>{' '}
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {automatik.umlage.length
                      ? automatik.umlage.map(v =>
                          `${v.auftrag}: ${eur(v.basis)} × ${v.satz.toLocaleString('de-DE')} % `
                          + `= ${eur(v.betrag)} auf ${v.kostenstelle}`).join(' · ')
                      : 'kein Zuschlag — der Beleg trägt auf keinem Auftrag Kosten'}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
                  <span className="muted" style={{ fontSize: 12 }}>Satz %</span>
                  <input value={umlagesatz} disabled={!umlageMit} style={{ width: 70 }}
                         placeholder={String(automatik.umlageEinstellung.satz)}
                         onChange={e => setUmlagesatz(e.target.value.replace(/[^0-9,.]/g, ''))} />
                </span>
              </label>

              <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                Die Umlage ist ein geschlossener Kreis: Belastung des Auftrags und Entlastung
                der Kostenstelle heben sich auf. Beide Ergänzungen sind ausgeglichen — die
                Belegprobe oben ändert sich dadurch nicht.
              </p>
            </div>
          ) : null}

          <div className="pager">
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setZeilen(zs => [...zs, { ...LEERZEILE }])}>Zeile hinzufügen</button>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {!buchbar && (
                <span className="muted">
                  {!vollstaendig ? 'Jede Zeile braucht Konto und Betrag.'
                    : differenz !== 0 ? 'Soll und Haben müssen ausgeglichen sein.' : ''}
                </span>
              )}
              <button className="btn primary" onClick={buchen} disabled={!buchbar || laeuft}>
                {laeuft ? 'Wird gebucht …'
                  : zusatzzeilen.length
                    ? `${zeilen.length + zusatzzeilen.length} Zeilen buchen und CSV erzeugen`
                    : 'Buchen und CSV erzeugen'}
              </button>
            </div>
          </div>

          {status && (
            <div className="card-body" style={{ paddingTop: 0 }}>
              <span className={`chip ${status.art === 'ok' ? 'pos' : 'neg'}`}>{status.text}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
