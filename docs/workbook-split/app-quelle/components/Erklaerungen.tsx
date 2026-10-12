import Link from 'next/link';

/**
 * Die Erlaeuterungen, die frueher ueber den Auswertungen standen.
 *
 * Sie sind hier unveraendert versammelt und nicht neu geschrieben: es ist
 * derselbe Text, nur an einem Ort statt auf zwanzig Seiten verteilt.  Wer
 * eine Auswertung oeffnet, sieht jetzt Zahlen; wer die Methodik braucht,
 * findet sie vollstaendig unter Grundsaetze.
 *
 * Gerendert wird das ausschliesslich dort – die Seite verlangt
 * `system.read`.
 */

export type Erklaerung = { name: string; seite: string; inhalt: React.ReactNode };

export const ERKLAERUNGEN: Erklaerung[] = [
  {
    name: "Deckungsbeitragsrechnung",
    seite: "/db",
    inhalt: (
        <div className="note">
        <b>Rechenweg.</b> Die Stufenrechnung folgt der stufenweisen Fixkostendeckungsrechnung.
        Jede Zeile ist eine Summe über Buchungszeilen aus <span className="mono">controlling.v_buchung</span> –
        es wird nichts geschätzt und nichts fortgeschrieben. Abrechnungsbelege (Belegnummer 80…) bleiben außen vor,
        weil sie das Projekt nur auf die Ergebnis-Kostenstelle entlasten und jedes Projektergebnis rechnerisch auf null setzen würden.
        Details unter <Link href="/methodik" style={{ color: 'var(--accent)' }}>Rechenwege</Link>.
        </div>
    ),
  },
  {
    name: "Forecast und EBITDA",
    seite: "/forecast",
    inhalt: (
        <div className="note warn">
        <b>Diese Seite zeigt nicht das EBITDA der Gesellschaft.</b> Sie rechnet aus den
        Buchungszeilen, und darin fehlen die primären Personalkosten – rund 2,45 Mio € bis Juli.
        Was hier steht, ist das <b>Auftragsergebnis</b>: was die Aufträge tragen, bevor
        Gemeinkosten und Verlustbewertungen abgezogen sind.
        Das belastbare EBITDA steht unter <Link href="/methodik#ebitda" style={{ color: 'var(--accent)' }}>Rechenwege</Link>
        und wird aus der SAP-Auswertung gerechnet.
        </div>
    ),
  },
  {
    name: "Eine Zahlenbasis für alles",
    seite: "/forecast",
    inhalt: (
        <div className="note">
        <b>Eine Zahlenbasis für alles.</b> Diese Monatsreihen speisen die GuV-Sicht, das
        Liquiditätsmodell und den Forecast-Bericht. Ist-Monate stammen aus dem Rolling Forecast
        und sind gegen die offizielle GuV geprüft; Planmonate sind der aktuelle Forecast.
        Quelle und Stand siehe <Link href="/abstimmung" style={{ color: 'var(--accent)' }}>Abstimmung</Link>.
        </div>
    ),
  },
  {
    name: "Kostenartenrechnung",
    seite: "/klr",
    inhalt: (
        <div className="note">
        <b>Aufbau.</b> Jede Zeile ist ein Sachkonto aus dem Kostenartenstamm mit seinen Monatswerten.
        Die Gliederung nach DB-Stufen entscheidet, in welche Stufe der Deckungsbeitragsrechnung das Konto einfließt.
        Ein Klick auf die Kontonummer öffnet die zugehörigen Belege.
        </div>
    ),
  },
  {
    name: "Kostenartenstamm",
    seite: "/kostenarten",
    inhalt: (
        <div className="note">
        <b>Warum diese Seite existiert.</b> Jede Zahl in der Deckungsbeitrags- und GuV-Rechnung hängt daran,
        in welche Stufe ein Sachkonto eingeordnet ist. Diese Zuordnung ist hier vollständig einsehbar.
        Konten ohne Buchungen sind grau dargestellt.
        </div>
    ),
  },
  {
    name: "Kostenverfolgung",
    seite: "/kv",
    inhalt: (
        <div className="note">
        <b>Wozu dieser Abgleich.</b> Die Regionen haben keinen SAP-Zugang und führen ihre
        Kostenverfolgung in Excel. Hier steht beides nebeneinander. <b>Delta = SAP minus
        Kostenverfolgung</b>: positiv heißt, in SAP ist mehr gebucht als in der Verfolgung
        erfasst.
        {' '}Die Kostenverfolgung führt Summen über die <b>gesamte Projektlaufzeit</b>, der
        SAP-Auszug nur das laufende Jahr. Bei mehrjährigen Projekten ist ein Delta deshalb
        <b> kein Fehler</b>, sondern der Vorjahresanteil. Unmittelbar vergleichbar sind nur
        Projekte, die {new Date().getFullYear()} begonnen haben – die sind markiert.
        </div>
    ),
  },
  {
    name: "Liquiditätsmodell",
    seite: "/liquiditaet",
    inhalt: (
        <div className="note">
        <b>Der Zahlungsstrom wird direkt modelliert</b>, nicht aus dem Ergebnis abgeleitet.
        Die beiden Zahlungsziele sind keine Annahme: sie werden aus den tatsächlichen Bestandsbewegungen
        zurückgerechnet. Jede Zeile unten lässt sich bis auf die Ausgangsgröße zurückverfolgen –
        der vollständige Rechenweg steht unter <Link href="#herleitung" style={{ color: 'var(--accent)' }}>Herleitung</Link>.
        </div>
    ),
  },
  {
    name: "Nachträge",
    seite: "/nachtraege",
    inhalt: (
        <div className="note">
        <b>Rechenweg.</b> Angenommene Nachträge zählen mit ihrem vollen Betrag. Noch offene gehen
        mit dem Erwartungswert ein: <span className="mono">Betrag × Eintrittswahrscheinlichkeit</span>.
        Das Ergebnis rechnet zusätzlich die erwarteten Kosten gegen. Nachträge stehen neben der
        Buchungsrechnung — sie verändern die Zahlen unter <Link href="/db" style={{ color: 'var(--accent)' }}>DB1 – DB4</Link> nicht,
        sondern zeigen, wohin sie sich bewegen könnten.
        </div>
    ),
  },
  {
    name: "Pipeline",
    seite: "/pipeline",
    inhalt: (
        <div className="note">
        <b>Gewichteter Auftragseingang.</b> Jede Chance zählt mit{' '}
        <span className="mono">Umsatz × Wahrscheinlichkeit</span>. Die Pipeline ist der Vorlauf zum{' '}
        <Link href="/forecast" style={{ color: 'var(--accent)' }}>Rolling Forecast</Link>: was hier
        gewonnen wird, taucht später dort als Projektumsatz auf.
        </div>
    ),
  },
  {
    name: "Regionszuordnung",
    seite: "/regionen",
    inhalt: (
        <div className="note">
        <b>Herkunft der Regionszuordnung.</b> Die Region steckt in Stelle 6–7 der Auftragsnummer:
        <span className="mono"> 15</span> West, <span className="mono">30</span> Süd-West,
        <span className="mono"> 60</span> Ost, <span className="mono">65</span> Berlin,
        <span className="mono"> 50</span> Zentrale. Aufträge mit <span className="mono">P</span> sind Projekte,
        Aufträge mit <span className="mono">W</span> sind Innenaufträge (Vertrieb, Lager, Werkstatt, Fuhrpark, Verwaltung).
        </div>
    ),
  },
  {
    name: "Risikobewertung",
    seite: "/risiken",
    inhalt: (
        <div className="note">
        <b>Bewertung.</b> Die Risikoprioritätszahl ist das Produkt aus Eintrittswahrscheinlichkeit,
        Auswirkung und Entdeckbarkeit – jeweils auf einer Skala von 1 bis 5, Wertebereich also 1 bis 125.
        Die Zahl wird von der Datenbank berechnet und lässt sich nicht manuell übersteuern.
        </div>
    ),
  },
  {
    name: "SAP-Buchungsmaske",
    seite: "/sap",
    inhalt: (
        <div className="note">
        <b>Was diese Maske tut.</b> Sie erfasst einen FI-Beleg mit Kopf und mindestens zwei Zeilen,
        prüft, dass Soll und Haben ausgeglichen sind, speichert ihn und erzeugt eine UTF-8-CSV im
        Feldlayout einer FI-Belegübernahme. Die Datei wird <b>nicht</b> automatisch nach SAP übertragen –
        das konkrete Übernahmeverfahren (BAPI, Batch-Input oder Migrationscockpit) ist mit der eigenen
        SAP-Basis abzustimmen.
        </div>
    ),
  },
  {
    name: "Testcenter Bestandsveränderung",
    seite: "/sap/test",
    inhalt: (
        <div className="note warn">
        <b>Was hier geprüft wird.</b> Wird ein Auftrag bebucht, der nach Fertigstellungsgrad
        bewertet wird, gehört zu jeder Kosten- und Erlösbuchung die Fortschreibung der
        unfertigen Erzeugnisse. Diese Seite zeigt, welchen Buchungssatz die Maske dafür
        automatisch ergänzt — und ob der Beleg danach noch ausgeglichen ist.
        </div>
    ),
  },
  {
    name: "Audit-Protokoll",
    seite: "/audit",
    inhalt: (
        <div className="note">
        Protokolliert werden Änderungen an Benutzern, Rollen und Berechtigungen sowie ausgeführte Importe.
        Auswertende Zugriffe werden nicht protokolliert.
        </div>
    ),
  },
  {
    name: "Handbuch",
    seite: "/handbuch",
    inhalt: (
        <div className="note">
        <b>Zwei Wege durch das Handbuch.</b> Lesen Sie das Kapitel – oder starten Sie die
        <b> Klicktour</b>: Sie springt auf die richtige Seite, leuchtet die Stelle an und erklärt
        sie dort, wo sie steht. Weiter mit <kbd>→</kbd>, zurück mit <kbd>←</kbd>,
        beenden mit <kbd>Esc</kbd>. Die Tour übersteht Seitenwechsel und läuft weiter,
        bis Sie sie beenden. Das <b>Kaufmännische Handbuch</b> steht gleich darunter
        als PDF bereit.
        </div>
    ),
  },
  {
    name: "Auslastung",
    seite: "/mitarbeiter",
    inhalt: (
        <div className="note">
        <b>Zwei Quoten, zwei Fragen.</b> Die <i>Auslastung</i> misst, wie gut eingesetzt wurde,
        wer da war — Urlaub, Krankheit und Feiertag zählen nicht dagegen. Die
        <i> Produktivquote</i> misst, was von der bezahlten Zeit beim Auftrag ankam; sie ist
        immer niedriger und die Zahl, nach der der Vorstand fragt. Aus{' '}
        die bezahlte Zeit bezahlter Zeit wurden die produktiven Stunden auf Aufträgen —
        {' '}der jeweilige Wert entfielen auf
        Urlaub, Krankheit und Feiertage, der Rest auf Anwesenheit ohne Auftrag.
        </div>
    ),
  },
  {
    name: "Auslastung: was fehlt",
    seite: "/mitarbeiter",
    inhalt: (
        <div className="note">
        <b>Was hier noch fehlt.</b> Ein Verrechnungssatz je Stunde macht aus der Auslastung
        einen Betrag. Sobald Geräte- und Mitarbeiterkosten über den{' '}
        <Link href="/import" style={{ color: 'var(--accent)' }}>Datenimport</Link> mit Menge und
        Satz eingelesen sind, lässt sich die Stunde bewerten und gegen den Deckungsbeitrag
        je Projekt halten. Bis dahin zeigt diese Seite Mengen, keine Euro.
        </div>
    ),
  },
  {
    name: "Mehrjahresplanung",
    seite: "/planung/konten",
    inhalt: (
        <div className="note">
        <b>Was hier verglichen wird.</b> Der Plan stammt aus der Jahresplanungsmappe und ist
        je Niederlassung auf einzelne Sachkonten heruntergebrochen. Das Ist kommt aus denselben
        SAP-Konten, die auch die <Link href="/guv" style={{ color: 'var(--accent)' }}>GuV</Link> tragen.
        Beide Seiten stehen kaufmännisch: Ertrag und Aufwand jeweils positiv.
        Beginnt der Plan in einem späteren Jahr als das jüngste Ist, zeigt der Vergleich,
        wie weit der Plan vom heutigen Stand entfernt liegt – und nicht eine
        Periodenabweichung.
        </div>
    ),
  },
  {
    name: "Datenimport: Dateiarten",
    seite: "/import",
    inhalt: (
        <div className="note">
        <b>Erst sagen, was die Datei ist.</b> Kontoauszug, Planung, Forecast, Rechnungen,
        Geräte- oder Mitarbeiterkosten – die Art entscheidet, welche Felder es gibt, wohin die
        Zeilen gehen und auf welcher Seite sie danach stehen. Vorgeschlagen wird sie, entschieden
        wird sie von Ihnen. Danach zuordnen, prüfen, schreiben.
        </div>
    ),
  },
  {
    name: "Datenimport: keine Pflichtfelder",
    seite: "/import",
    inhalt: (
        <div className="note">
        <b>Kein Feld ist Pflicht.</b> Fehlt einer Zeile eine Angabe, bleibt genau diese Zeile
        liegen und steht mit Grund im Bericht – die übrigen laufen durch. Eine ganze Datei wegen
        einer fehlenden Spalte abzulehnen, hat noch nie jemandem geholfen. Bringt die Liste ein
        Feld gar nicht mit, lässt sich stattdessen ein fester Wert für alle Zeilen setzen.
        </div>
    ),
  },
];
