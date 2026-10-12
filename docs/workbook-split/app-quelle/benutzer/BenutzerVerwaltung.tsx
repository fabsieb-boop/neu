'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  benutzer_id: number; email: string; vorname: string; nachname: string;
  aktiv: boolean; letzter_login: string | null; fehlversuche: number;
  passwort_aendern?: boolean; regionen?: string[] | null;
  gesperrt_bis: string | null; rollen: string[];
};
type Rolle = { rollen_id: number; rollenname: string; beschreibung: string };
type Recht = { berechtigung_id: number; code: string; beschreibung: string };

const zeit = (v: unknown) => v ? new Date(String(v)).toLocaleString('de-DE') : '–';

/** Farbe je Rolle – dieselbe Zuordnung wie im Stylesheet, hier nur fuer die Legende. */
const ROLLENFARBE: Record<string, string> = {
  ADMIN: 'var(--neg)', CHEF: 'var(--warn)', CONTROLLING: 'var(--accent)',
  PROJEKTLEITUNG: 'var(--pos)', SACHBEARBEITUNG: '#6d28d9', NEUTRAL: 'var(--ink-3)',
};
const huebsch = (n: string) => n.charAt(0) + n.slice(1).toLowerCase();

export default function BenutzerVerwaltung({ benutzer, rollen, rechte, matrix, regionen = [], ich }: {
  benutzer: User[]; rollen: Rolle[]; rechte: Recht[];
  matrix: { rollen_id: number; code: string }[]; regionen?: string[]; ich?: number | string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'benutzer' | 'rechte'>('benutzer');
  const [neu, setNeu] = useState({ email: '', password: '', vorname: '', nachname: '', role: 'LESEN' });
  const [rechteStand, setRechteStand] = useState<Record<number, Set<string>>>(() => {
    const m: Record<number, Set<string>> = {};
    rollen.forEach(r => { m[r.rollen_id] = new Set(matrix.filter(x => x.rollen_id === r.rollen_id).map(x => x.code)); });
    return m;
  });
  const [status, setStatus] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function ruf(pfad: string, methode: string, body: unknown, erfolg: string) {
    setLaeuft(true); setStatus(null);
    try {
      const r = await fetch(pfad, { method: methode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) { setStatus({ art: 'ok', text: erfolg }); router.refresh(); return true; }
      const d = await r.json().catch(() => ({}));
      setStatus({ art: 'fehler', text:
          d.error === 'FORBIDDEN' ? 'Keine Berechtigung für diese Änderung.'
        : d.error === 'EMAIL_PASSWORD_REQUIRED' ? 'E-Mail und Passwort sind Pflichtfelder.'
        : d.error === 'SELBSTAUSSPERRUNG' ? 'Sie können sich den Vollzugriff nicht selbst entziehen – sonst kommen Sie hier nicht mehr herein. Ein anderer Admin kann es tun.'
        : d.error === 'SELBSTSPERRE' ? 'Sie können sich nicht selbst deaktivieren.'
        : d.error === 'LETZTER_ADMIN' ? 'Das ist der letzte aktive Admin. Vergeben Sie den Vollzugriff erst an jemand anderen.'
        : 'Die Änderung ist fehlgeschlagen.' });
    } catch { setStatus({ art: 'fehler', text: 'Der Server ist nicht erreichbar.' }); }
    finally { setLaeuft(false); }
    return false;
  }

  const anlegen = async () => {
    if (await ruf('/api/users', 'POST', neu, 'Benutzer angelegt.'))
      setNeu({ email: '', password: '', vorname: '', nachname: '', role: 'LESEN' });
  };

  const umschalten = (u: User) =>
    ruf('/api/users', 'PUT', { ...u, roles: u.rollen, aktiv: !u.aktiv },
        u.aktiv ? 'Benutzer deaktiviert.' : 'Benutzer aktiviert.');

  /**
   * Regionsfreigabe umschalten. Eine leere Liste heisst ausdruecklich
   * "alle Regionen" – deshalb wird beim Abwaehlen der letzten Region
   * nicht etwa alles gesperrt, sondern alles freigegeben.
   */
  const regionUmschalten = (u: User, region: string) => {
    const aktuell = new Set(u.regionen ?? []);
    aktuell.has(region) ? aktuell.delete(region) : aktuell.add(region);
    const liste = [...aktuell];
    return ruf('/api/users', 'PUT', { ...u, roles: u.rollen, regionen: liste },
      liste.length
        ? `${u.email}: ${liste.join(', ')}`
        : `${u.email}: alle Regionen`);
  };

  /**
   * Rolle eines Benutzers anhaken oder abwaehlen.
   *
   * Dieselbe Bedienung wie bei den Regionen, weil es dieselbe Frage ist:
   * darf dieser Mensch das?  Vorher standen die Rollen nur als Text da und
   * liessen sich ausschliesslich beim Anlegen setzen – wer sie aendern
   * wollte, musste den Benutzer neu erfassen.
   */
  const rolleUmschalten = (u: User, rolle: string) => {
    const aktuell = new Set(u.rollen ?? []);
    aktuell.has(rolle) ? aktuell.delete(rolle) : aktuell.add(rolle);
    const liste = [...aktuell];
    return ruf('/api/users', 'PUT', { ...u, roles: liste },
      liste.length ? `${u.email}: ${liste.join(', ')}` : `${u.email}: keine Rolle mehr`);
  };

  const rolleSpeichern = (r: Rolle) =>
    ruf('/api/permissions', 'PUT', { roleId: r.rollen_id, codes: [...(rechteStand[r.rollen_id] ?? [])] },
        `Berechtigungen der Rolle ${r.rollenname} gespeichert.`);

  const toggleRecht = (rollenId: number, code: string) =>
    setRechteStand(s => {
      const menge = new Set(s[rollenId] ?? []);
      menge.has(code) ? menge.delete(code) : menge.add(code);
      return { ...s, [rollenId]: menge };
    });

  return (
    <>
      <div className="card">
        <div className="tabs">
          <a className={tab === 'benutzer' ? 'active' : ''} onClick={() => setTab('benutzer')} style={{ cursor: 'pointer' }}>
            Benutzer ({benutzer.length})
          </a>
          <a className={tab === 'rechte' ? 'active' : ''} onClick={() => setTab('rechte')} style={{ cursor: 'pointer' }}>
            Rollen und Berechtigungen ({rollen.length})
          </a>
        </div>

        {status && (
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <span className={`chip ${status.art === 'ok' ? 'pos' : 'neg'}`}>{status.text}</span>
          </div>
        )}

        {tab === 'benutzer' && (
          <>
            {/* Legende und Admin-Uebersicht.  Vollzugriff ist das Recht, das
                wehtut, wenn es jemand hat, der es nicht braucht – deshalb steht
                es hier oben namentlich und nicht nur als Farbe in der Tabelle. */}
            <div className="card-body" style={{ paddingBottom: 10 }}>
              <div className="rechtelegende">
                {rollen.map(r => (
                  <span key={r.rollen_id} title={r.beschreibung}>
                    <i className="punkt" style={{ background: ROLLENFARBE[r.rollenname] ?? 'var(--ink-3)' }} />
                    {huebsch(r.rollenname)}
                  </span>
                ))}
                <span className="muted">— ausgefüllt heißt vergeben, blass heißt nicht vergeben.</span>
              </div>
              {(() => {
                const admins = benutzer.filter(u => u.rollen.includes('ADMIN') && u.aktiv);
                return (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    <span className={`chip ${admins.length > 2 ? 'warn' : 'pos'}`}>
                      {admins.length} {admins.length === 1 ? 'Admin' : 'Admins'} mit Vollzugriff
                    </span>{' '}
                    <span className="muted">
                      {admins.map(u => [u.vorname, u.nachname].filter(Boolean).join(' ') || u.email).join(' · ')}
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="toolbar">
              <div className="field"><label>E-Mail</label>
                <input value={neu.email} onChange={e => setNeu({ ...neu, email: e.target.value })} placeholder="vorname.name@firma.de" /></div>
              <div className="field"><label>Passwort</label>
                <input type="password" value={neu.password} onChange={e => setNeu({ ...neu, password: e.target.value })} /></div>
              <div className="field"><label>Vorname</label>
                <input value={neu.vorname} onChange={e => setNeu({ ...neu, vorname: e.target.value })} /></div>
              <div className="field"><label>Nachname</label>
                <input value={neu.nachname} onChange={e => setNeu({ ...neu, nachname: e.target.value })} /></div>
              <div className="field"><label>Rolle</label>
                <select value={neu.role} onChange={e => setNeu({ ...neu, role: e.target.value })}>
                  {rollen.map(r => <option key={r.rollen_id} value={r.rollenname}>{r.rollenname}</option>)}
                </select></div>
              <button className="btn primary" onClick={anlegen} disabled={laeuft}>Benutzer anlegen</button>
            </div>

            <div className="card-body flush">
              <div className="tablewrap">
                <table className="data">
                  <thead>
                    <tr><th>E-Mail</th><th>Name</th><th>Rollen</th><th>Regionen</th><th>Status</th>
                        <th>Letzte Anmeldung</th><th className="r">Fehlversuche</th><th /></tr>
                  </thead>
                  <tbody>
                    {benutzer.map(u => (
                      <tr key={u.benutzer_id} className={Number(u.benutzer_id) === Number(ich) ? 'ichselbst' : ''}>
                        <td><b>{u.email}</b>{Number(u.benutzer_id) === Number(ich) && <span className="selbstmarke">Sie</span>}</td>
                        <td>{[u.vorname, u.nachname].filter(Boolean).join(' ') || <span className="muted">–</span>}</td>
                        <td className="rollenzelle">
                          <div className="regionswahl">
                            {rollen.map(r => {
                              const an = u.rollen.includes(r.rollenname);
                              const selbstschutz = an && r.rollenname === 'ADMIN' && Number(u.benutzer_id) === Number(ich);
                              return (
                                <button key={r.rollen_id} type="button" disabled={laeuft || selbstschutz}
                                        className={`regionschip rollenchip ${an ? 'an' : ''}`}
                                        data-rolle={r.rollenname}
                                        title={selbstschutz
                                          ? 'Ihr eigener Vollzugriff – lässt sich hier nicht entziehen, sonst sperren Sie sich aus.'
                                          : `${r.beschreibung} — ${an ? 'entziehen' : 'vergeben'}`}
                                        onClick={() => rolleUmschalten(u, r.rollenname)}>
                                  {huebsch(r.rollenname)}
                                </button>
                              );
                            })}
                          </div>
                          {!u.rollen.length && (
                            <div className="muted" style={{ fontSize: 11 }}>keine Rolle – sieht nichts</div>
                          )}
                        </td>
                        <td className="regionenzelle">
                          <div className="regionswahl">
                            {regionen.map(r => {
                              const alle = !u.regionen?.length;
                              const an = alle || u.regionen!.includes(r);
                              return (
                                <button key={r} type="button" disabled={laeuft}
                                        className={`regionschip ${an ? 'an' : ''} ${alle ? 'implizit' : ''}`}
                                        title={alle
                                          ? 'Keine Einschränkung gesetzt – alle Regionen sichtbar. Klicken schränkt auf diese Region ein.'
                                          : an ? `${r} entziehen` : `${r} freigeben`}
                                        onClick={() => regionUmschalten(u, r)}>
                                  {r}
                                </button>
                              );
                            })}
                          </div>
                          {!u.regionen?.length && (
                            <div className="muted" style={{ fontSize: 11 }}>keine Einschränkung</div>
                          )}
                        </td>
                        <td>
                          <span className={`chip ${u.aktiv ? 'pos' : 'neg'}`}>{u.aktiv ? 'aktiv' : 'gesperrt'}</span>
                          {u.passwort_aendern && (
                            <span className="chip warn" style={{ marginLeft: 6 }}
                                  title="Aus dem Altsystem übernommen: das Passwort war zum Wechsel vorgemerkt. Der Login erzwingt das noch nicht – Konto zurücksetzen.">
                              Passwort offen
                            </span>
                          )}
                          {u.gesperrt_bis && new Date(u.gesperrt_bis) > new Date() &&
                            <span className="chip warn" style={{ marginLeft: 4 }}>zeitweise gesperrt</span>}
                        </td>
                        <td className="muted">{zeit(u.letzter_login)}</td>
                        <td className="r num">{u.fehlversuche}</td>
                        <td className="r">
                          <button className="btn" onClick={() => umschalten(u)} disabled={laeuft}>
                            {u.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === 'rechte' && (
          <div className="card-body flush">
            <div className="tablewrap">
              <table className="data compact">
                <thead>
                  <tr>
                    <th>Berechtigung</th>
                    {rollen.map(r => <th key={r.rollen_id} className="r">{r.rollenname}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rechte.map(b => (
                    <tr key={b.berechtigung_id}>
                      <td><b className="mono">{b.code}</b><div className="muted">{b.beschreibung}</div></td>
                      {rollen.map(r => (
                        <td key={r.rollen_id} className="r">
                          <input type="checkbox" checked={rechteStand[r.rollen_id]?.has(b.code) ?? false}
                                 onChange={() => toggleRecht(r.rollen_id, b.code)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Änderungen je Rolle speichern</td>
                    {rollen.map(r => (
                      <td key={r.rollen_id} className="r">
                        <button className="btn primary" onClick={() => rolleSpeichern(r)} disabled={laeuft}>Speichern</button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
