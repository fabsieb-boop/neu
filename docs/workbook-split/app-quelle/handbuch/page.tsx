import Link from 'next/link';
import Shell from '../components/Shell';
import { TourKnopf } from '../components/Klicktour';
import { requireUser } from '@/lib/guard';
import { TOUREN } from '@/lib/touren';

export const dynamic = 'force-dynamic';

type Abschnitt = { frage: string; antwort: React.ReactNode };
type Kapitel = {
  id: string;
  titel: string;
  wofuer: string;
  seite?: string;
  tour?: string;
  recht?: string;
  abschnitte: Abschnitt[];
};

const mono = (t: string) => <span className="mono">{t}</span>;

const KAPITEL: Kapitel[] = [

  {
    id: 'einstieg', titel: 'Einstieg und Aufbau', seite: '/', tour: 'einstieg',
    wofuer: 'Wie das Cockpit aufgebaut ist und wo Sie was finden.',
    abschnitte: [
      { frage: 'Wie melde ich mich an?',
        antwort: <>Mit Ihrer Firmen-E-Mail und Ihrem Passwort. Beim ersten Mal gilt das Passwort aus dem
          alten Dashboard – es ist unverändert übernommen worden. Ändern können Sie es jederzeit
          unter <Link href="/passwort">Passwort ändern</Link>.</> },
      { frage: 'Warum sehe ich weniger Einträge als ein Kollege?',
        antwort: <>Die Navigation zeigt nur, was Ihre Rolle freigibt. Zusätzlich kann Ihr Zugang auf
          einzelne Regionen begrenzt sein – dann sind alle Auswertungen im ganzen Cockpit auf
          diese Regionen beschränkt, nicht nur die Übersicht.</> },
      { frage: 'Was bedeuten die Vorzeichen?',
        antwort: <>Überall dort, wo Buchungen gezeigt werden, gilt die SAP-Schreibweise:
          <b> Kosten positiv, Erlöse negativ</b>. In den Auswertungen ist es umgekehrt herum
          gedreht, damit ein Gewinn positiv dasteht. An jeder Tabelle steht, was gilt.</> },
      { frage: 'Wo kommen die Zahlen her?',
        antwort: <>Aus den Buchungszeilen des SAP-Exports. Keine Zahl ist eingetippt. Der vollständige
          Rechenweg jeder Kennzahl steht unter <i>Rechenwege</i>.</> },
    ],
  },

  {
    id: 'ergebnis', titel: 'Ergebnisrechnung', seite: '/guv', tour: 'ergebnis', recht: 'finance.read',
    wofuer: 'GuV, Regionen und der Weg bis zur einzelnen Buchung.',
    abschnitte: [
      { frage: 'Warum zeigt das Cockpit zwei verschiedene Ergebnisse?',
        antwort: <>Weil es zwei Datenbestände gibt, die Verschiedenes messen. Die <b>GuV-Staffel</b> rechnet
          aus den Buchungszeilen – das ist das operative Bild je Auftrag und Region. Der
          <b> Jahresabschluss</b> rechnet aus den Sachkontensalden, enthält die Abschlussbuchungen
          und lässt die innerbetriebliche Verrechnung außen vor. Gegenüber SAP verbindlich ist der
          Abschluss. Beide Zahlen sind richtig; sie beantworten nur verschiedene Fragen.
          Die Überleitung steht Konto für Konto unter <Link href="/abstimmung">Abstimmung</Link>.</> },
      { frage: 'Wie sehe ich die GuV so, wie SAP sie druckt?',
        antwort: <>Unter <Link href="/guv/sap">GuV wie in SAP</Link>. Dort steht die Auswertung
          Bilanz/GuV Zeile für Zeile im Original – gleiche Reihenfolge, gleiche Einrückung, gleiche
          Positionsnummern, Berichts- und Vergleichsperiode nebeneinander. Zum Gegenlesen mit der
          Fachabteilung.</> },
      { frage: 'Kann ich die SAP-Gliederung je Niederlassung sehen?',
        antwort: <>Ja, über den Aufriss oben auf derselben Seite. Dasselbe Gerüst, aber eine Spalte je
          Region, gefüllt aus unseren Buchungen. Am Ende steht ein Block <i>Ohne Zeile im
          SAP-Gerüst</i> – dort stehen die innerbetriebliche Verrechnung und die Ertragsteuern,
          für die SAP keine Position vorsieht. Firmenweit heben sich die Verrechnungen auf, je
          Niederlassung nicht.</> },
      { frage: 'Wie finde ich eine einzelne Buchung?',
        antwort: <>Im <Link href="/buchungen">Belegjournal</Link>. Filtern nach Jahr, Periode, Region,
          Konto, Belegkreis und Auftrag, oder Volltext über Objektbezeichnung, Belegnummer und
          Konto. Die Wertspalte bleibt beim Querscrollen rechts stehen.</> },
      { frage: 'Was ist der Unterschied zwischen DB1 und DB4?',
        antwort: <>Die Deckungsbeitragsstufen unter <Link href="/db">DB1 – DB4</Link>: DB1 nach Einzelkosten,
          DB2 nach variablen Gemeinkosten, DB3 nach Projektfixkosten, DB4 nach Regionsumlage.
          Welche Kostenart auf welcher Stufe abgezogen wird, steht
          im <Link href="/kostenarten">Kostenartenstamm</Link>.</> },
    ],
  },

  {
    id: 'forecast', titel: 'Forecast und Planung', seite: '/forecast', tour: 'forecast', recht: 'forecast.read',
    wofuer: 'Forecast-Runde, Eingabe und Mehrjahresplanung.',
    abschnitte: [
      { frage: 'Wie grenze ich auf meine Region ein?',
        antwort: <>Über die Filterleiste oben – Region und Auftrag. Die Auswahl bleibt beim Blättern
          erhalten. Wer regionsbeschränkt ist, sieht ohnehin nur die eigenen.</> },
      { frage: 'Warum kann ich manche Monate nicht ändern?',
        antwort: <>Weil sie Ist-Monate sind. Die Anwendung sperrt sie nicht nur in der Anzeige – auch
          der Server weist eine Änderung an einem Ist-Monat ab. Bis wohin Ist gilt, entscheidet
          der letzte belastbare Monat: ein Monat gilt als belastbar, wenn er mindestens
          70 Prozent der üblichen Buchungsmenge erreicht hat.</> },
      { frage: 'Wo trage ich den Forecast ein?',
        antwort: <>Unter <Link href="/forecast/planung">Forecast-Planung</Link> am Rechner, oder in der
          Handy-App unterwegs. Beide schreiben in dieselbe Tabelle; wer zuletzt speichert, gewinnt.</> },
      { frage: 'Woher kommen die Zahlen der Mehrjahresplanung?',
        antwort: <>Aus <Link href="/planung/konten">Mehrjahresplanung</Link>, je Region und Konto für 2027
          bis 2031. Die Werte stimmen mit dem Prämissenblatt überein – 2027 zum Beispiel
          993.792 €, 2031 dann 2.171.333 €.</> },
    ],
  },

  {
    id: 'kv', titel: 'Kostenverfolgung', seite: '/kv', tour: 'kostenverfolgung', recht: 'projects.read',
    wofuer: 'Die Liste der Kollegen neben unseren SAP-Zahlen.',
    abschnitte: [
      { frage: 'Wofür ist die Kostenverfolgung da?',
        antwort: <><b>Ausschließlich als Vergleich.</b> Keine dieser Zahlen fließt in GuV,
          Deckungsbeitrag, Projektsicht oder Forecast ein. Sie liegen in einer eigenen Tabelle,
          die keine Ergebnisrechnung liest – das Ergebnis kann sich dadurch nicht verschieben,
          auch nicht versehentlich.</> },
      { frage: 'Was heißt „vergleichbar"?',
        antwort: <>Ein Projekt gilt als vergleichbar, wenn zu ihm im laufenden Jahr auch SAP-Buchungen
          vorliegen. Mehrjährige Projekte bringen in der Fremdliste Vorjahre mit, die im
          SAP-Auszug fehlen – deren Abweichung sagt wenig. Die Kennzahl oben bezieht sich deshalb
          nur auf die vergleichbaren Projekte.</> },
      { frage: 'Wie lade ich eine neue Kostenverfolgung hoch?',
        antwort: <>Über <Link href="/import">Datenimport</Link> mit der Ablage <i>Vergleichswerte</i>.
          Siehe das Kapitel <a href="#import">Daten einlesen</a>.</> },
    ],
  },

  {
    id: 'import', titel: 'Daten einlesen', seite: '/import', tour: 'import', recht: 'import.write',
    wofuer: 'SAP-Exporte und Fremdlisten aufnehmen – und was das bewirkt.',
    abschnitte: [
      { frage: 'Welche Dateien kann ich einlesen?',
        antwort: <>CSV und TXT. Semikolon, Tabulator und Komma werden selbst erkannt, die Spalten
          automatisch vorbelegt. Heißen die Spalten anders, ordnen Sie sie von Hand zu.</> },
      { frage: 'Was ist der Unterschied zwischen den beiden Ablagen?',
        antwort: <><b>Buchungen</b> gehen nach {mono('controlling.buchungen')} und verändern das
          Ergebnis sofort – GuV, Deckungsbeitrag, Projektsicht und Forecast.
          <b> Vergleichswerte</b> gehen nach {mono('controlling.vergleichswert')}, einer eigenen
          Tabelle. Keine Ergebnisrechnung liest sie. Für Listen aus fremder Hand – Kostenverfolgung,
          Aufmaße, Bautagebücher – ist immer die zweite Ablage richtig.</> },
      { frage: 'Meine Datei führt Kosten und Erlöse beide positiv. Was nun?',
        antwort: <>Unter <i>Beträge lesen als</i> sagen Sie, wie die Spalte gemeint ist: als Kosten oder
          als Erlöse. Das Vorzeichen setzt die Anwendung dann selbst, passend zur Buchhaltung –
          Aufwand positiv, Ertrag negativ.</> },
      { frage: 'Meine Datei hat gar kein Sachkonto.',
        antwort: <>Dann tragen Sie in der Spalte <i>oder fester Wert</i> eines ein. Es gilt für alle
          Zeilen des Imports. Dasselbe geht für Jahr, Periode und jedes andere Feld, das die
          Datei nicht mitbringt.</> },
      { frage: 'Wie prüfe ich, bevor etwas passiert?',
        antwort: <><b>Immer zuerst „Prüfen ohne zu speichern".</b> Der Lauf wird vollständig
          durchgerechnet – Zeilenzahl, Summe, übersprungene Zeilen, unbekannte Aufträge und
          Konten – ohne dass eine einzige Zeile geschrieben wird.</> },
      { frage: 'Wird festgehalten, wer was eingelesen hat?',
        antwort: <>Ja. Jeder Lauf steht mit Datei, Zeilenzahl und Zeitpunkt in {mono('import_lauefe')} und
          zusätzlich im <Link href="/audit">Audit-Protokoll</Link> mit Benutzer.</> },
    ],
  },

  {
    id: 'bericht', titel: 'Berichte', seite: '/bericht', tour: 'bericht', recht: 'bericht.read',
    wofuer: 'Fertige Berichte drucken und eigene zusammenstellen.',
    abschnitte: [
      { frage: 'Welche fertigen Berichte gibt es?',
        antwort: <>Forecast, Liquidität und Rentabilität, jeweils für ein Geschäftsjahr und wahlweise
          eine Region. Der Ausdruck ist auf A4 eingerichtet – Navigation und Knöpfe fallen weg,
          Tabellenköpfe wiederholen sich auf jeder Seite.</> },
      { frage: 'Wie kommt unser Regionslogo in den Bericht?',
        antwort: <>Über <Link href="/einstellungen">Einstellungen</Link>: je Region Logo, Anschrift,
          Leitung und Hausfarbe. Wählen Sie im Bericht eine Region, trägt der Kopf deren Angaben;
          ohne Auswahl steht das Firmenlogo dort.</> },
      { frage: 'Ich brauche einen Bericht, den es nicht gibt.',
        antwort: <>Dafür ist der <Link href="/bericht/baukasten">Berichtsbaukasten</Link> da: Quelle aus
          der Datenbank wählen, Spalten ein- und ausblenden, eigene Berechnungen ergänzen und die
          Zusammenstellung als Vorlage sichern. Achtzehn geprüfte Quellen stehen bereit.</> },
      { frage: 'Sind eigene Formeln gefährlich?',
        antwort: <>Nein. Jede Formel wird gegen die echten Spalten der Quelle geprüft, bevor sie läuft;
          erlaubt sind nur Spaltennamen, Zahlen und Grundrechenarten. Eine Division durch Null
          ergibt eine leere Zelle statt eines Fehlers.</> },
      { frage: 'Muss ich die Vorstandspräsentation jeden Monat neu bauen?',
        antwort: <>Nein. Der <Link href="/bericht/vorstand">Vorstandsbericht</Link> ist die Präsentation:
          vierzehn Fragen, die der Vorstand ohnehin jeden Monat stellt, beantwortet aus denselben
          geprüften Sichten, aus denen das Cockpit rechnet. Seite öffnen, oben rechts als PowerPoint
          laden – Aufbau und Gestaltung bleiben, nur der Text kommt aus dem System.</> },
      { frage: 'Warum kann ich beim Vorstandsbericht keinen Monat wählen?',
        antwort: <>Weil der Zeitraum in der Referenz-GuV steht: nur bis dorthin ist der Abschluss
          festgeschrieben, und jede Kennzahl des Berichts bezieht sich darauf. Ein frei gewählter
          Monat würde Zahlen aus verschiedenen Ständen mischen – genau der Fehler, den die
          Präsentation aufdecken soll.</> },
      { frage: 'Was passiert, wenn für eine Frage die Daten fehlen?',
        antwort: <>Dann sagt die Folie das offen als Datenlücke und nennt, welche Quelle fehlt.
          Geschätzt wird nichts. Sobald die Quelle gepflegt ist – etwa Angebote unter
          <Link href="/pipeline"> Pipeline</Link> – füllt sich die Folie beim nächsten Aufbau von
          selbst.</> },
    ],
  },

  {
    id: 'liquiditaet', titel: 'Liquidität', seite: '/liquiditaet', tour: 'liquiditaet', recht: 'finance.read',
    wofuer: 'Zahlungsstrom, Reichweite und Szenarien.',
    abschnitte: [
      { frage: 'Wie wird geplant?',
        antwort: <>Direkt: Ein- und Auszahlungen werden modelliert, nicht aus dem Ergebnis abgeleitet.
          Die beiden Zahlungsziele sind keine Annahme, sondern aus den tatsächlichen
          Bestandsbewegungen zurückgerechnet.</> },
      { frage: 'Wochen oder Monate?',
        antwort: <>Beides. Die Wochensicht ist gegen die Tagesbestände geprüft und weicht über
          einundneunzig Tage um drei Cent ab.</> },
      { frage: 'Wo ist der druckbare Bericht?',
        antwort: <>Über den Knopf <i>Bericht erzeugen</i> oben rechts – er führt in den Berichtsgenerator
          zum Liquiditätsbericht mit Zahlungsplan, Reichweite und Szenarien.</> },
    ],
  },

  {
    id: 'risiken', titel: 'Risiken und Nachträge', seite: '/risiken', tour: 'risiken',
    wofuer: 'Risiken bewerten, Maßnahmen verfolgen, Nachträge führen.',
    abschnitte: [
      { frage: 'Wie wird ein Risiko bewertet?',
        antwort: <>Mit einer Dreipunktschätzung: bester Fall, wahrscheinlicher Fall, schlechtester Fall.
          Daraus entsteht der Erwartungswert. Ein einzelner Schätzwert fällt erfahrungsgemäß zu
          optimistisch aus, drei Werte fangen das ab.</> },
      { frage: 'Was zeigt die Matrix?',
        antwort: <>Eintrittswahrscheinlichkeit gegen Auswirkung. Oben rechts steht, was zuerst
          Aufmerksamkeit braucht. Dieselbe Matrix gibt es je Auftrag – Projekt öffnen, dann steht
          sie dort samt Vorschlägen für Gegenmaßnahmen.</> },
      { frage: 'Wofür sind Nachträge?',
        antwort: <>Unter <Link href="/nachtraege">Nachträge</Link> stehen die offenen und anerkannten
          Nachtragsforderungen je Auftrag mit ihrem Wahrscheinlichkeitsgrad.</> },
    ],
  },

  {
    id: 'app', titel: 'App aufs Telefon', seite: '/app', tour: 'app',
    wofuer: 'Installation und was unterwegs geht.',
    abschnitte: [
      { frage: 'Wie bekomme ich die App?',
        antwort: <>Den QR-Code unter <Link href="/app">App aufs Telefon</Link> mit der Handykamera
          abfotografieren. Die App öffnet sich im Browser und lässt sich über das Teilen-Menü auf
          den Startbildschirm legen – danach startet sie wie eine gewöhnliche App.</> },
      { frage: 'Was kann ich unterwegs tun?',
        antwort: <>Die Kennzahlen ansehen, den Forecast je Region durchgehen und ihn auch erfassen:
          Auftrag aufklappen, Planmonate eintippen, speichern. Umsatz geben Sie positiv ein, das
          Vorzeichen setzt die App. Dazu die Kostenverfolgung gegen SAP.</> },
      { frage: 'Ist die Verbindung sicher?',
        antwort: <>Derzeit läuft die App über eine ungesicherte Verbindung – im Firmennetz vertretbar,
          unterwegs nicht. Eine verschlüsselte Adresse steht bereit und kann jederzeit hinterlegt
          werden.</> },
    ],
  },

  {
    id: 'konto', titel: 'Konto und Rechte', seite: '/passwort',
    wofuer: 'Passwort, Rollen und Regionsfreigaben.',
    abschnitte: [
      { frage: 'Wie ändere ich mein Passwort?',
        antwort: <>Unter <Link href="/passwort">Passwort ändern</Link>: altes Passwort, neues Passwort,
          Wiederholung. Die Änderung wird im Audit-Protokoll vermerkt.</> },
      { frage: 'Ich sehe eine Seite nicht, die ich brauche.',
        antwort: <>Dann fehlt Ihrer Rolle das Recht. Wer eine Seite ohne Berechtigung aufruft, landet
          auf dem Cockpit mit einem Hinweis, welches Recht fehlt – dieses Recht nennen Sie
          der Administration.</> },
      { frage: 'Warum sehe ich nur meine Region?',
        antwort: <>Weil Ihr Zugang so eingerichtet ist. Die Beschränkung gilt durchgängig: Auswertungen,
          Auswahllisten und Berichte zeigen ausschließlich freigegebene Regionen. Ein Umschreiben
          der Adresse hilft nicht – die Prüfung läuft auf dem Server.</> },
    ],
  },
];

export default async function HandbuchSeite() {
  const benutzer = await requireUser();
  const rechte = benutzer?.rechte;
  const darf = (r?: string) => !r || !rechte || rechte.includes(r);
  const kapitel = KAPITEL.filter(k => darf(k.recht));
  const touren = kapitel.filter(k => k.tour && TOUREN[k.tour]).length;

  return (
    <Shell titel="Handbuch" bereich="Bedienung des Cockpits" aktiv="handbuch" benutzer={benutzer}
           aktion={<span className="chip info">{kapitel.length} Kapitel · {touren} Klicktouren</span>}>
      {/* ------------------------------------------- Kaufmännisches Handbuch */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Zum Nachschlagen</div>
            <h2>Kaufmännisches Handbuch der TVF ALTWERT</h2>
            <p>Das Regelwerk hinter den Zahlen: Vertragsregime und Abrechnungsprozess,
               Kalkulationsmatrizen mit Beispielen, VOB/B und BGB in der Anwendung.
               73 Seiten, zum Herunterladen oder Ausdrucken.</p>
          </div>
          <div className="btn-group">
            <a className="btn primary klein"
               href="/dateien/TVF-Kaufmaennisches-Handbuch.pdf" download>
              PDF herunterladen
            </a>
            <a className="btn klein" href="/dateien/TVF-Kaufmaennisches-Handbuch.pdf"
               target="_blank" rel="noopener">Im Browser öffnen</a>
          </div>
        </div>
        <div className="card-body">
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            Dieses Handbuch beschreibt das <b>kaufmännische Regelwerk</b> – wonach abgerechnet
            wird und warum. Die Kapitel darunter beschreiben die <b>Bedienung des Cockpits</b> –
            wo welche Zahl steht und wie man sie prüft. Beides ergänzt sich.
          </p>
        </div>
      </div>

      {/* --------------------------------------------------- Inhalt */}
      <div className="card">
        <div className="card-head">
          <div>
            <div className="eyebrow">Inhalt</div>
            <h2>Wonach suchen Sie?</h2>
          </div>
        </div>
        <div className="card-body">
          <div className="handbuch-inhalt">
            {kapitel.map((k, i) => (
              <a key={k.id} href={`#${k.id}`} className="handbuch-kachel">
                <span className="nr">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <b>{k.titel}</b>
                  <span className="muted">{k.wofuer}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- Kapitel */}
      {kapitel.map((k, i) => (
        <div className="card" key={k.id} id={k.id}>
          <div className="card-head">
            <div>
              <div className="eyebrow">Kapitel {String(i + 1).padStart(2, '0')}</div>
              <h2>{k.titel}</h2>
              <p>{k.wofuer}</p>
            </div>
            <div className="btn-group">
              {k.tour && TOUREN[k.tour] && <TourKnopf tour={k.tour} klasse="btn primary klein" />}
              {k.seite && <Link className="btn klein" href={k.seite}>Seite öffnen</Link>}
            </div>
          </div>
          <div className="card-body">
            <dl className="handbuch-fragen">
              {k.abschnitte.map(a => (
                <div key={a.frage}>
                  <dt>{a.frage}</dt>
                  <dd>{a.antwort}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ))}

      <div className="card">
        <div className="card-body">
          <p className="muted" style={{ margin: 0 }}>
            Etwas fehlt oder stimmt nicht mehr? Sagen Sie kurz Bescheid – das Handbuch wird mit der
            Anwendung gepflegt, nicht nachträglich. Die Rechenwege hinter jeder Zahl stehen
            unter <i>Rechenwege</i>, der Vollständigkeitsnachweis
            unter <Link href="/abstimmung">Abstimmung</Link>.
          </p>
        </div>
      </div>
    </Shell>
  );
}
