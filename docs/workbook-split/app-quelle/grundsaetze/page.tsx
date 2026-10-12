import Link from 'next/link';
import Shell from '../components/Shell';
import { requireRecht } from '@/lib/guard';
import { nurErlaubteRegionen } from '@/lib/regionsschutz';
import { regionenStamm } from '@/lib/queries';
import { ERKLAERUNGEN } from '../components/Erklaerungen';

export const dynamic = 'force-dynamic';

/**
 * Grundsaetze der Auswertung – die Erlaeuterungen, die vorher auf den
 * Auswertungsseiten standen.
 *
 * Sie waren dort richtig gemeint und trotzdem im Weg: wer die GuV oeffnet,
 * will Zahlen sehen und nicht zuerst zwei Absaetze Methodik lesen.  Wer die
 * Methodik braucht, braucht sie ganz und an einer Stelle.
 *
 * Sichtbar nur mit `system.read` – dasselbe Recht, das schon die
 * Rechenwege und die Selbstpruefung schuetzt.  Das ist kein Geheimnis,
 * sondern eine Frage der Zustaendigkeit: wer diese Saetze liest, muss sie
 * auch vertreten koennen.
 */
export default async function GrundsaetzeSeite() {
  const benutzer = await requireRecht('system.read');
  const alle = await regionenStamm();
  const meine = nurErlaubteRegionen(alle, benutzer);
  const eingeschraenkt = benutzer.regionen.length > 0;

  const A = ({ href, children }: { href: string; children: React.ReactNode }) =>
    <Link href={href} style={{ color: 'var(--accent)' }}>{children}</Link>;

  return (
    <Shell titel="Grundsätze der Auswertung"
           bereich="Was die Zahlen bedeuten – und welche gilt"
           aktiv="grundsaetze" benutzer={benutzer}>

      <div className="note">
        <b>Diese Seite ist nicht öffentlich.</b> Sie sammelt die Erläuterungen, die früher über
        den Auswertungen standen. Dort waren sie im Weg: wer die GuV aufschlägt, will Zahlen
        sehen. Wer wissen will, wie sie zustande kommen, findet es hier vollständig — sichtbar
        mit dem Recht <span className="mono">system.read</span>, wie Rechenwege und Selbstprüfung.
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Umfang</div><h2>Welche Zahlen Sie sehen</h2></div>
          <span className={`chip ${eingeschraenkt ? 'warn' : 'pos'}`}>
            {eingeschraenkt ? 'eingeschränkte Sicht' : 'alle Regionen'}
          </span>
        </div>
        <div className="card-body">
          <p>
            {eingeschraenkt
              ? <>Ihre Sicht ist eingeschränkt. Sie sehen {meine.map(r => r.region).join(', ')} —
                  alle Summen im Cockpit beziehen sich ausschließlich darauf. Was anderen Regionen
                  zugeordnet ist, erscheint nirgends, auch nicht in Zwischensummen.</>
              : <>Sie sehen alle Regionen: {alle.map(r => r.region).join(', ')}. Summen umfassen
                  damit das gesamte Unternehmen. Benutzer mit Regionsbindung sehen dieselben
                  Seiten, aber nur ihre eigenen Zahlen — auch in jeder Zwischensumme.</>}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Darstellung</div><h2>Vorzeichen und Gliederung</h2></div>
        </div>
        <div className="card-body">
          <p>
            In der Anzeige stehen <b>Erträge positiv und Aufwendungen negativ</b>. Die Gliederung
            folgt § 275 Abs. 2 HGB, Gesamtkostenverfahren; jede Position ist die Summe der ihr
            zugeordneten Sachkonten. Welche Kontonummer in welche Position läuft, steht im{' '}
            <A href="/kostenarten">Kostenartenstamm</A>.
          </p>
          <p>
            Die Regionsstaffel ist <b>vollständig</b> — sie enthält auch die Kosten, die auf
            Kostenstellen und nicht auf Aufträge gebucht sind. Eine Region, die auf den ersten
            Blick zu gut aussieht, ist deshalb selten falsch zugeordnet, sondern trägt ihre
            Gemeinkosten schon.
          </p>
          <p className="muted">
            In den Daten selbst gilt die umgekehrte, SAP-eigene Konvention: Aufwand positiv,
            Ertrag negativ. Eine positive Summe ist dort ein Verlust. Die Umkehr passiert erst
            in der Anzeige — wer eine Sicht direkt abfragt, muss das wissen.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Der wichtigste Punkt</div><h2>Welche Zahl gilt?</h2></div>
          <span className="chip warn">zwei Ergebnisse</span>
        </div>
        <div className="card-body">
          <p>
            Es gibt <b>zwei Ergebnisse</b>, und beide sind richtig — sie messen Verschiedenes.
          </p>
          <div className="tablewrap">
            <table className="data compact">
              <thead>
                <tr><th style={{ width: '22%' }} /><th>Diese Auswertung</th><th>Jahresabschluss</th></tr>
              </thead>
              <tbody>
                <tr>
                  <th>Grundlage</th>
                  <td>Buchungszeilen (Einzelposten je Auftrag)</td>
                  <td>Sachkontensalden</td>
                </tr>
                <tr>
                  <th>Zeigt</th>
                  <td>das operative Bild je Auftrag und Region</td>
                  <td>das Ergebnis des Unternehmens</td>
                </tr>
                <tr>
                  <th>Enthält</th>
                  <td>die innerbetriebliche Verrechnung</td>
                  <td>die Abschlussbuchungen, klassifiziert nach TVF-Kontenkatalog,
                      ohne innerbetriebliche Verrechnung</td>
                </tr>
                <tr className="sub">
                  <th>Verbindlich gegenüber SAP</th>
                  <td className="muted">nein</td>
                  <td><b>ja</b></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 14 }}>
            Die Überleitung zwischen beiden steht Konto für Konto unter{' '}
            <A href="/abstimmung">Abstimmung</A>. Die SAP-Gliederung im Original — gleiche
            Reihenfolge, gleiche Positionsnummern — steht unter{' '}
            <A href="/guv/sap">GuV wie in SAP</A>.
          </p>
          <p className="muted">
            Praktische Folge für eine Vorstandsrunde: Wird nach dem <i>Ergebnis</i> gefragt, gilt
            der Abschluss. Wird gefragt, <i>woher</i> es kommt, gilt diese Auswertung. Wer beide
            Zahlen nebeneinanderstellt, ohne den Unterschied zu benennen, erzeugt genau die
            Rückfrage, die niemand beantworten kann.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Je Auswertung</div>
            <h2>Was auf den einzelnen Seiten gilt</h2>
            <p>Wortgleich die Texte, die früher über den Auswertungen standen.</p>
          </div>
          <span className="chip info">{ERKLAERUNGEN.length} Erläuterungen</span>
        </div>
        <div className="card-body">
          {ERKLAERUNGEN.map(e => (
            <div key={e.name + e.seite} style={{ marginBottom: 18 }}>
              <h3 style={{ fontSize: 13.5, margin: '0 0 6px' }}>
                {e.name}{' '}
                <A href={e.seite}><span className="mono" style={{ fontWeight: 400 }}>{e.seite}</span></A>
              </h3>
              {e.inhalt}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Weiterlesen</div><h2>Wo was steht</h2></div>
        </div>
        <div className="card-body">
          <div className="deflist">
            <div><b><A href="/methodik">Rechenwege</A></b>
              <span>Jede Formel offen: welche Konten in welche Position laufen, wie jede
                    Kennzahl entsteht.</span></div>
            <div><b><A href="/pruefung">Selbstprüfung</A></b>
              <span>Achtzehn Prüfungen, die zwei unabhängige Rechenwege gegeneinanderstellen.
                    Weicht einer ab, stimmt eine Annahme nicht mehr.</span></div>
            <div><b><A href="/abstimmung">Abstimmung</A></b>
              <span>Die Überleitung zwischen Einzelposten und Abschluss, Konto für Konto.</span></div>
            <div><b><A href="/bericht/vorstand">Vorstandsbericht</A></b>
              <span>Die vierzehn Fragen des Vorstands, beantwortet aus denselben Sichten.</span></div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
