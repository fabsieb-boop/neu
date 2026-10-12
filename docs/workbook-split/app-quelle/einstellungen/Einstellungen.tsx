'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type AppEintrag = { schluessel: string; wert: string | null; beschreibung: string | null };
type Region = {
  region: string; codes: string[]; langname: string | null; anschrift: string | null;
  leitung: string | null; telefon: string | null; email: string | null;
  farbe: string | null; sharepoint_url: string | null; sortierung: number; aktiv: boolean;
  hat_logo: boolean; logo_name: string | null; logo_bytes: number | null;
};
type Firma = { hat_logo: boolean; logo_name: string | null; logo_bytes: number | null };

const MAX_BYTES = 2 * 1024 * 1024;

/** Bild als data:-URL einlesen, damit es per JSON an die API geht. */
function alsDataUrl(datei: File): Promise<string> {
  return new Promise((ok, fehler) => {
    const leser = new FileReader();
    leser.onload = () => ok(String(leser.result));
    leser.onerror = () => fehler(new Error('Die Datei konnte nicht gelesen werden.'));
    leser.readAsDataURL(datei);
  });
}

function kb(bytes: number | null) {
  return bytes ? `${Math.round(bytes / 1024)} kB` : '';
}

export default function Einstellungen({ app, regionen, firma }:
  { app: AppEintrag[]; regionen: Region[]; firma: Firma }) {

  const router = useRouter();
  const [werte, setWerte] = useState<Record<string, string>>(
    Object.fromEntries(app.map(a => [a.schluessel, a.wert ?? ''])));
  const [reg, setReg] = useState<Region[]>(regionen);
  const [meldung, setMeldung] = useState<{ text: string; fehler?: boolean } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  // Cache-Schluessel: nach einem Logo-Wechsel muss das <img> neu laden
  const [stand, setStand] = useState(0);

  const setzeRegion = (name: string, feld: keyof Region, wert: unknown) =>
    setReg(rs => rs.map(r => (r.region === name ? { ...r, [feld]: wert } : r)));

  async function ruf(pfad: string, methode: string, koerper: unknown, erfolg: string) {
    setLaeuft(true); setMeldung(null);
    try {
      const a = await fetch(pfad, {
        method: methode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(koerper),
      });
      const d = await a.json().catch(() => ({}));
      if (!a.ok) throw new Error(d.fehler || d.error || `Fehler ${a.status}`);
      setMeldung({ text: erfolg });
      setStand(s => s + 1);
      router.refresh();
    } catch (e) {
      setMeldung({ text: (e as Error).message, fehler: true });
    } finally {
      setLaeuft(false);
    }
  }

  const speichereApp = () =>
    ruf('/api/einstellungen', 'PUT',
        { eintraege: Object.entries(werte).map(([schluessel, wert]) => ({ schluessel, wert })) },
        'Berichtskopf gespeichert.');

  const speichereRegion = (r: Region, zusatz: Record<string, unknown> = {}) =>
    ruf('/api/einstellungen', 'POST', { ...r, ...zusatz }, `${r.region} gespeichert.`);

  async function logoWaehlen(r: Region, datei: File | null) {
    if (!datei) return;
    if (datei.size > MAX_BYTES) {
      setMeldung({ text: `Das Bild ist ${kb(datei.size)} groß, erlaubt sind 2048 kB.`, fehler: true });
      return;
    }
    const url = await alsDataUrl(datei);
    await speichereRegion(r, { logo_data_url: url, logo_name: datei.name });
  }

  const feld = (schluessel: string, label: string, mehrzeilig = false) => {
    const e = app.find(a => a.schluessel === schluessel);
    return (
      <div className="form-group" key={schluessel}>
        <label htmlFor={schluessel}>{label}</label>
        {mehrzeilig
          ? <textarea id={schluessel} rows={2} value={werte[schluessel] ?? ''}
                      onChange={ev => setWerte(w => ({ ...w, [schluessel]: ev.target.value }))} />
          : <input id={schluessel} value={werte[schluessel] ?? ''}
                   onChange={ev => setWerte(w => ({ ...w, [schluessel]: ev.target.value }))} />}
        {e?.beschreibung && <span className="hilfe">{e.beschreibung}</span>}
      </div>
    );
  };

  return (
    <>
      {meldung && (
        <div className={meldung.fehler ? 'note warn' : 'note'}>{meldung.text}</div>
      )}

      {/* ------------------------------------------------- Firma */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Kopf und Fuß jedes Berichts</div>
            <h2>Firma</h2>
            <p>Diese Angaben stehen auf jedem Bericht. Das Firmenlogo gilt überall dort,
               wo die gewählte Region kein eigenes hinterlegt hat.</p>
          </div>
        </div>
        <div className="card-body">
          <div className="form-row form-row--2">
            {feld('firma_name', 'Firmierung')}
            {feld('firma_zusatz', 'Zusatz unter der Firmierung')}
          </div>
          <div className="form-row form-row--2">
            {feld('bericht_untertitel', 'Untertitel auf Berichten')}
            {feld('bericht_fusszeile', 'Fußzeile beim Drucken')}
          </div>
          <div className="form-row form-row--2">
            {feld('bericht_datum_zeigen', 'Erstellungsdatum drucken (ja/nein)')}
            {feld('bericht_rand_cm', 'Seitenrand beim Drucken in cm')}
          </div>
          <div className="btn-group" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={speichereApp} disabled={laeuft}>
              Firma speichern
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------- Firmenlogo */}
      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Rückfallebene</div><h2>Firmenlogo</h2></div>
        </div>
        <div className="card-body">
          <div className="logo-zeile">
            <div className="logo-feld">
              {firma.hat_logo
                ? <img src={`/api/logo/${encodeURIComponent('*')}?v=${stand}`} alt="Firmenlogo" />
                : <span className="muted">kein Logo hinterlegt</span>}
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {firma.hat_logo
                  ? <>{firma.logo_name} · {kb(firma.logo_bytes)}</>
                  : 'PNG, JPG, GIF, SVG oder WebP, höchstens 2 MB.'}
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                Das Firmenlogo wird über <code>npm run db:logo</code> gesetzt – so wandert es
                reproduzierbar mit jedem Neuaufbau mit.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------- Regionen */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Je Region</div>
            <h2>Regionen und ihre Logos</h2>
            <p>Wählst du im Bericht eine Region, trägt dieser deren Logo, Anschrift und Farbe.
               Ohne Regionsauswahl gilt der Firmeneintrag oben. Die Codes sind die Stellen 6–7
               der Auftragsnummer und stimmen mit der Auswertung überein.</p>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gap: 18 }}>
          {reg.map(r => (
            <div className="region-block" key={r.region}
                 style={{ borderLeft: `4px solid ${r.farbe || '#334155'}` }}>
              <div className="region-kopf">
                <div className="logo-feld klein">
                  {r.hat_logo
                    ? <img src={`/api/logo/${encodeURIComponent(r.region)}?v=${stand}`}
                           alt={`Logo ${r.region}`} />
                    : <span className="muted">Firmenlogo</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <h3>{r.region}
                    <span className="muted" style={{ fontWeight: 400, fontSize: 12.5, marginLeft: 8 }}>
                      Codes {r.codes?.join(', ') || '–'}
                    </span>
                  </h3>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {r.hat_logo
                      ? <>eigenes Logo: {r.logo_name} · {kb(r.logo_bytes)}</>
                      : 'kein eigenes Logo – Berichte zeigen das Firmenlogo'}
                  </div>
                </div>
                <div className="btn-group">
                  <label className="btn" style={{ cursor: 'pointer' }}>
                    Logo wählen
                    <input type="file" hidden accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
                           onChange={ev => logoWaehlen(r, ev.target.files?.[0] ?? null)} />
                  </label>
                  {r.hat_logo && (
                    <button className="btn" disabled={laeuft}
                            onClick={() => speichereRegion(r, { logo_loeschen: true })}>
                      Logo entfernen
                    </button>
                  )}
                </div>
              </div>

              <div className="form-row form-row--3">
                <div className="form-group">
                  <label htmlFor={`ln-${r.region}`}>Langname im Berichtskopf</label>
                  <input id={`ln-${r.region}`} value={r.langname ?? ''}
                         onChange={e => setzeRegion(r.region, 'langname', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor={`lt-${r.region}`}>Regionalleitung</label>
                  <input id={`lt-${r.region}`} value={r.leitung ?? ''}
                         onChange={e => setzeRegion(r.region, 'leitung', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor={`fb-${r.region}`}>Farbe</label>
                  <input id={`fb-${r.region}`} type="color" value={r.farbe || '#334155'}
                         onChange={e => setzeRegion(r.region, 'farbe', e.target.value)} />
                </div>
              </div>

              <div className="form-row form-row--3">
                <div className="form-group">
                  <label htmlFor={`an-${r.region}`}>Anschrift</label>
                  <textarea id={`an-${r.region}`} rows={2} value={r.anschrift ?? ''}
                            onChange={e => setzeRegion(r.region, 'anschrift', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor={`tl-${r.region}`}>Telefon</label>
                  <input id={`tl-${r.region}`} value={r.telefon ?? ''}
                         onChange={e => setzeRegion(r.region, 'telefon', e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor={`em-${r.region}`}>E-Mail</label>
                  <input id={`em-${r.region}`} type="email" value={r.email ?? ''}
                         onChange={e => setzeRegion(r.region, 'email', e.target.value)} />
                </div>
              </div>

              <div className="form-row form-row--2">
                <div className="form-group">
                  <label htmlFor={`sp-${r.region}`}>SharePoint-Ordner</label>
                  <input id={`sp-${r.region}`} value={r.sharepoint_url ?? ''}
                         onChange={e => setzeRegion(r.region, 'sharepoint_url', e.target.value)} />
                </div>
                <div className="form-group form-group--actions">
                  <label className="toggle-check">
                    <input type="checkbox" checked={r.aktiv}
                           onChange={e => setzeRegion(r.region, 'aktiv', e.target.checked)} />
                    <span>Region aktiv</span>
                  </label>
                  <button className="btn primary" disabled={laeuft}
                          onClick={() => speichereRegion(r)}>
                    {r.region} speichern
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
