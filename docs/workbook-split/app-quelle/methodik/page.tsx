import Link from 'next/link';
import Shell from '../components/Shell';
import { requireRecht } from '@/lib/guard';

export const dynamic = 'force-dynamic';

export default async function MethodikSeite() {
  const benutzer = await requireRecht('system.read');

  return (
    <Shell titel="Rechenwege" bereich="Nachvollziehbarkeit der Auswertungen" aktiv="methodik" benutzer={benutzer}>
      <p className="page-intro">
        Diese Seite beschreibt vollständig, wie jede Zahl der Anwendung zustande kommt: welche Buchungszeilen
        einfließen, wie Vorzeichen behandelt werden und nach welcher Formel die Deckungsbeitragsstufen gerechnet werden.
        Alle Regeln stehen als SQL in <span className="mono">db/01_modell.sql</span> und <span className="mono">db/02_views.sql</span>.
      </p>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Schritt 1</div><h2>Vorzeichen</h2></div>
        </div>
        <div className="card-body">
          <p style={{ marginTop: 0 }}>
            Der SAP-Export liefert Beträge in der Kostenrechnungslogik: <b>Kosten positiv (Soll)</b>,
            <b> Erlöse negativ (Haben)</b>. Für die Darstellung wird umgerechnet:
          </p>
          <div className="deflist">
            <div><b>Leistung</b><span><span className="mono">leistung = −wert</span> für Konten der DB-Stufe 0, damit Erlöse positiv erscheinen</span></div>
            <div><b>Kosten</b><span><span className="mono">k_var / k_fix = +wert</span> – Kosten bleiben positiv und werden als Abzug dargestellt</span></div>
            <div><b>Ergebnis</b><span>Da die Summe aller Zeilen das negative Ergebnis ist, gilt <span className="mono">Ergebnis = −Σ wert</span></span></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Herkunft der Zuordnung</div><h2>Kontenstamm</h2>
          <p>Die Klassifizierung eines Sachkontos entscheidet über jede Zahl. Sie stammt aus zwei
             Quellen, die sich gegenseitig bestätigen.</p></div>
        </div>
        <div className="card-body">
          <div className="deflist">
            <div><b>GuV-Kontenstamm</b>
              <span>106 Konten der TVF ALTWERT GmbH aus <span className="mono">GuV_FC_Eingabe</span> (IST 2025).
                    Liefert Kontoart, Planungsgruppe, EBITDA-Kennzeichen und Kostenblock – Angaben,
                    die sich aus der Kontonummer nicht ableiten lassen.</span></div>
            <div><b>Ableitung aus dem Nummernkreis</b>
              <span>Deckt die übrigen 39 Konten ab, überwiegend CO-interne Konten: Lohn- und
                    Geräteverrechnung, Gemeinkostenzuschlag, kalkulatorische Kosten. Regeln in
                    <span className="mono"> db/01_modell.sql</span>.</span></div>
            <div><b>Abgleich</b>
              <span>69 Konten kommen in beiden Quellen vor. Für alle 69 stimmen die Zuordnungen
                    vollständig überein. Der <Link href="/kostenarten" style={{ color: 'var(--accent)' }}>Kostenartenstamm</Link> weist
                    je Konto aus, woher die Zuordnung stammt.</span></div>
            <div><b>Neue Konten</b>
              <span>Der Import legt unbekannte Sachkonten an und klassifiziert sie sofort über
                    <span className="mono"> controlling.kostenarten_klassifizieren()</span>.
                    Die Bezeichnung bleibt als Platzhalter erkennbar und ist zu pflegen.</span></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Schritt 2</div><h2>Belegkreise</h2>
          <p>Abgeleitet aus der Belegnummer. Nur die ersten drei Kreise gehen in Ergebnisrechnungen ein.</p></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data">
              <thead><tr><th>Belegnummer</th><th>Belegkreis</th><th>Bedeutung</th><th>Ergebnisrelevant</th></tr></thead>
              <tbody>
                <tr><td className="mono">68…, 69…</td><td><b>PRIMAER</b></td>
                    <td>Eingangsrechnung, Faktura, Sachbeleg – Vorgänge mit Außenwirkung</td>
                    <td><span className="chip pos">ja</span></td></tr>
                <tr><td className="mono">9028…, 9029…, 9030…</td><td><b>VERRECHNUNG</b></td>
                    <td>Innerbetriebliche Leistungsverrechnung: Lohn- und Gerätestunden</td>
                    <td><span className="chip pos">ja</span></td></tr>
                <tr><td className="mono">9900…</td><td><b>UMLAGE</b></td>
                    <td>Gemeinkostenzuschlag Konto 7801020: entlastet den Innenauftrag der Region, belastet das Projekt</td>
                    <td><span className="chip pos">ja</span></td></tr>
                <tr><td className="mono">80…</td><td><b>ABRECHNUNG</b></td>
                    <td>Auftragsabrechnung auf eine Ergebnis-Kostenstelle. Reine Umbuchung; der Empfänger liegt außerhalb des Berichts.</td>
                    <td><span className="chip warn">nein</span></td></tr>
              </tbody>
            </table>
          </div>
          <div className="card-body">
            <span className="muted" style={{ fontSize: 12.5 }}>
              Ohne diese Trennung ergibt jedes Projekt exakt null: die Abrechnung setzt den Auftragssaldo je
              Kostenart auf den Monat genau zurück. Nachweis unter <Link href="/abstimmung" style={{ color: 'var(--accent)' }}>Abstimmung</Link>.
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Schritt 3</div><h2>Kostenträger aus der Auftragsnummer</h2>
          <p>Aufbau: <span className="mono">&lt;Typ&gt;&lt;Buchungskreis 4102&gt;&lt;Region 2-stellig&gt;&lt;laufende Nummer&gt;</span>,
             Beispiel <span className="mono">P4102157208</span>.</p></div>
        </div>
        <div className="card-body">
          <div className="deflist">
            <div><b>P… → Projekt</b><span>Kostenträger der Leistungserstellung. Trägt Erlöse, Einzelkosten und den Gemeinkostenzuschlag.</span></div>
            <div><b>W… Region 15/30/60/65</b><span>Innenauftrag einer operativen Region: Vertrieb, Lager, Werkstatt, Fuhrpark → Bereichsgemeinkosten</span></div>
            <div><b>W… Region 50</b><span>Innenauftrag der Zentrale: Geschäftsführung, Rechnungswesen, EDV, Betriebsrat, Steuern → Unternehmensgemeinkosten</span></div>
            <div><b>Regionscodes</b><span>15 West · 30 Süd-West · 60 Ost · 65 Berlin · 50 Zentrale</span></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Schritt 4</div><h2>Die Stufenrechnung</h2>
          <p>Stufenweise Fixkostendeckungsrechnung. Jede Zeile ist eine Summe über gefilterte Buchungszeilen.</p></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data staffel">
              <thead><tr><th>Stufe</th><th>Formel</th><th>Datenbasis</th></tr></thead>
              <tbody>
                <tr><td><b>Betriebsleistung</b></td>
                    <td className="mono">Σ −wert</td>
                    <td>Kostenträger Projekt, DB-Stufe 0</td></tr>
                <tr><td className="indent">− variable Einzelkosten</td>
                    <td className="mono">Σ wert</td>
                    <td>Kostenträger Projekt, DB-Stufe 1</td></tr>
                <tr className="step"><td><b>= DB I</b></td>
                    <td className="mono">Leistung − variable Einzelkosten</td>
                    <td>Bruttoergebnis der Leistungserstellung</td></tr>
                <tr><td className="indent">− fixe Projektkosten</td>
                    <td className="mono">Σ wert</td>
                    <td>Kostenträger Projekt, DB-Stufe 2, ohne Belegkreis UMLAGE</td></tr>
                <tr className="step"><td><b>= DB II</b></td>
                    <td className="mono">DB I − fixe Projektkosten</td>
                    <td>Ergebnis nach allen direkt zurechenbaren Kosten</td></tr>
                <tr><td className="indent">− verrechnete Bereichsgemeinkosten</td>
                    <td className="mono">Σ wert</td>
                    <td>Kostenträger Projekt, Belegkreis UMLAGE</td></tr>
                <tr className="step"><td><b>= DB III</b></td>
                    <td className="mono">DB II − verrechnete Bereichsgemeinkosten</td>
                    <td>Ergebnisbeitrag des Projekts nach Gemeinkostenzuschlag</td></tr>
                <tr><td className="indent">− Über-/Unterdeckung Bereich</td>
                    <td className="mono">Ist-Kosten Innenaufträge Region + Entlastung</td>
                    <td>Kostenträger Bereich: <span className="mono">Σ(k_var + k_fix − leistung + umlage)</span></td></tr>
                <tr><td className="indent">− Unternehmensgemeinkosten</td>
                    <td className="mono">Ist-Kosten Innenaufträge Zentrale</td>
                    <td>Kostenträger Zentrale, Regionscode 50</td></tr>
                <tr className="step"><td><b>= DB IV · Betriebsergebnis</b></td>
                    <td className="mono">DB III − Deckungsdifferenz − Unternehmens-GK</td>
                    <td>Operatives Ergebnis</td></tr>
                <tr><td className="indent">− neutrales Ergebnis</td>
                    <td className="mono">Σ wert</td>
                    <td>DB-Stufe 9: Zinsen, Ertragsteuern, periodenfremd, kalkulatorisch</td></tr>
                <tr className="result"><td><b>= Ergebnis vor Steuern</b></td>
                    <td className="mono">DB IV − neutrales Ergebnis</td>
                    <td>entspricht <span className="mono">−Σ wert</span> über alle ergebnisrelevanten Zeilen</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Schritt 5</div><h2>Umlagen auf Projektebene</h2></div>
        </div>
        <div className="card-body">
          <p style={{ marginTop: 0 }}>
            DB I bis DB III eines Projekts sind vollständig verursachungsgerecht: jede Position steht als
            Buchungszeile auf dem Auftrag. Nur für DB IV ist eine Umlage nötig, weil Zentralkosten keinem
            einzelnen Projekt zuzuordnen sind.
          </p>
          <div className="deflist">
            <div><b>Umlageschlüssel</b><span>Anteil der Projektleistung an der Gesamtleistung aller Projekte des Geschäftsjahrs (Tragfähigkeitsprinzip)</span></div>
            <div><b>Formel</b><span className="mono">Umlage = Unternehmensgemeinkosten × max(Leistung, 0) / Σ max(Leistung, 0)</span></div>
            <div><b>Grenze der Aussagekraft</b><span>DB IV je Projekt ist damit eine Vollkostengröße mit Schlüsselcharakter. Für Steuerungsentscheidungen ist DB III die belastbarere Kennzahl.</span></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Entschieden</div><h2>Verrechnete Anzahlungen: Variante B ist belegt</h2>
          <p>Die Methodik nennt dies den größten Einzelfaktor des Modells — zum Jahresende trennen
             die beiden Varianten 6,58 Mio. €. Entschieden wird die Frage über die Gegenkonten der
             Anzahlungsbewegungen, und die liegen jetzt vor.</p></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead><tr><th>Gegenkonto zu 49972</th><th className="r">Bewegungen</th>
                <th className="r">Summe</th><th>Bedeutung</th></tr></thead>
              <tbody>
                <tr>
                  <td><b>140600</b> Nachbuchung Ford. L+L</td>
                  <td className="r num">71</td><td className="r num">−5.468.264 €</td>
                  <td className="muted">Verrechnung gegen Forderungen</td>
                </tr>
                <tr>
                  <td><b>830510</b> Erlöse Abrisse/Demontagen</td>
                  <td className="r num">42</td><td className="r num">2.283.402 €</td>
                  <td className="muted">Verrechnung gegen die Schlussrechnung</td>
                </tr>
                <tr>
                  <td><b>49951</b> Bestände unfertige Erzeugnisse</td>
                  <td className="r num">2</td><td className="r num">182.224 €</td>
                  <td className="muted">Umbuchung im Bestand</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="card-body">
            <span className="muted" style={{ fontSize: 12.5 }}>
              Unter den Gegenkonten ist <b>kein Bank- oder Cash-Pool-Konto</b>. Der Anzahlungsbestand
              wird also gegen Erlöse und Forderungen verrechnet und nicht an den Kunden zurückgezahlt.
              Damit gilt Variante B: eine verrechnete Anzahlung ist bereits geflossen und erzeugt
              keinen weiteren Zahlungseingang. Genau so rechnet das Modell.
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Geprüft und verworfen</div><h2>Umsatzsteuer im Liquiditätsmodell</h2>
          <p>Das Bestandssystem rechnete die Zahlungsströme brutto und führte die Umsatzsteuer-Zahllast
             mit zwei Monaten Verzug separat ab. Diese Rechnung ist im Modell vorhanden, aber
             abgeschaltet — und zwar aus einem geprüften Grund.</p></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead><tr><th>Rechnung</th><th className="r">Debitorenlaufzeit</th>
                <th className="r">Kreditorenlaufzeit</th><th className="r">systematischer Zufluss</th>
                <th className="r">Erklärungsgrad</th></tr></thead>
              <tbody>
                <tr className="step">
                  <td><b>netto, ohne Umsatzsteuer</b><span className="formula">so rechnet das Modell</span></td>
                  <td className="r num">119 Tage</td><td className="r num">45 Tage</td>
                  <td className="r num">209.820 €</td><td className="r num">96,8 %</td>
                </tr>
                <tr>
                  <td className="indent">brutto, mit Zahllast</td>
                  <td className="r num">138 Tage</td><td className="r num">25 Tage</td>
                  <td className="r num">561.093 €</td><td className="r num">92,5 %</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="card-body">
            <span className="muted" style={{ fontSize: 12.5 }}>
              Die Bruttorechnung verschlechtert die Anpassung und verschiebt die Laufzeiten ins
              Unplausible. Naheliegende Erklärung: die Steuerzahlungen laufen nicht über den Cash Pool,
              gegen den kalibriert wird, sondern über das Bankkonto. Der Schalter
              <span className="mono"> umsatzsteuer_aktiv</span> lässt sich setzen, sobald gegen einen
              Bestand kalibriert wird, der die Steuerzahlungen enthält.
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Datenstand</div><h2>Der Einzelpostenexport <code>neu-2</code></h2>
          <p>Die Einzelposten stammen jetzt nicht mehr aus der alten SQLite-Datei, sondern aus dem
             SAP-Export mit 38 Spalten. Er ist in zwei Punkten besser — und in einem entscheidenden
             Punkt weiterhin unvollständig.</p></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead><tr><th>Prüfung</th><th>Ergebnis</th><th>Bedeutung</th></tr></thead>
              <tbody>
                <tr><td>Zeilen geladen</td><td className="num">18.782</td>
                    <td className="muted">alle acht Monatssummen stimmen mit der Quelldatei exakt überein</td></tr>
                <tr><td>Korrekturen gegenüber der Altdatei</td><td className="num">+380.707 € im März</td>
                    <td className="muted">der neue Export enthält Nachbuchungen, die die Altdatei nicht kannte</td></tr>
                <tr><td>Valutadatum</td><td className="num">84,9 % gefüllt</td>
                    <td className="muted">macht die Ist-Zahlungsrechnung in der Liquiditätsplanung erst möglich</td></tr>
                <tr><td>Cash-Pool-Bewegungen gegen <code>liq_bestand</code></td>
                    <td className="num">Differenz 0,00 €</td>
                    <td className="muted">der neue Export bestätigt die gespeicherten Bestände für alle sechs vergleichbaren Monate</td></tr>
                <tr className="warn"><td><b>August</b></td><td className="num"><b>986 von rund 2.542 Zeilen</b></td>
                    <td className="muted"><b>weiterhin nur 39 % — dies ist nicht der neu gezogene Export</b></td></tr>
                <tr><td>Leer in der Quelle selbst</td>
                    <td className="num">PSP-Element, Belegstatus, Material, Bearbeiter, Text-ID</td>
                    <td className="muted">0,0 % gefüllt — kein Ladefehler, SAP liefert diese Felder hier nicht</td></tr>
              </tbody>
            </table>
          </div>
          <div className="card-body">
            <span className="muted" style={{ fontSize: 12.5 }}>
              Die Kalibrierung des Liquiditätsmodells läuft deshalb weiter über <b>sieben</b> Monatspunkte
              statt acht. Ein vollständig gezogener August ist die wirksamste einzelne Maßnahme, um die
              Zahlungsziele schärfer zu treffen.
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Korrigiert</div><h2>Die Ergebnisabgrenzung war falsch</h2>
          <p>Der Abgleich mit <code>guv.XLSX</code> und <code>bilNZ.XLSX</code> hat drei Fehler
             aufgedeckt. Sie sind behoben; die Zahlen dieses Systems haben sich dadurch
             erheblich verändert.</p></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead><tr><th>Fehler</th><th className="r">Wirkung</th><th>Behebung</th></tr></thead>
              <tbody>
                <tr>
                  <td><b>Sekundäre Kostenarten im Ergebnis</b><br />
                      <span className="muted">7611100, 7611200, 7612000 – Lohn- und Geräteverrechnung</span></td>
                  <td className="r num neg">+1.583.586 €</td>
                  <td className="muted">Diese Konten gibt es nur im CO, nicht in der Finanzbuchhaltung.
                      Soll und Haben heben sich auf, der Belegkreisfilter nahm aber nur die Sollseite.
                      Sie zählen jetzt nicht mehr zum Ergebnis.</td>
                </tr>
                <tr>
                  <td><b>Bilanzkonten im Ergebnis</b></td>
                  <td className="r num neg">+62.407 €</td>
                  <td className="muted">Bestands- und Forderungskonten gehören nicht in die GuV.</td>
                </tr>
                <tr>
                  <td><b>Zirkuläre Probe</b></td>
                  <td className="r num muted">—</td>
                  <td className="muted">Die alte Abstimmung verglich die Buchungstabelle mit sich selbst und
                      meldete deshalb immer „Differenz 0“. Sie belegt nur, dass zwei Auswertungen
                      dieselben Daten gleich verarbeiten – nicht die Übereinstimmung mit dem Abschluss.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="card-body">
            <span className="muted" style={{ fontSize: 12.5 }}>
              Die Zahl <b>1.215.026 €</b>, die früher als „Ergebnis vor Steuern“ auswies, ist
              das Ergebnis der <b>Auftragsrechnung</b> – nicht das des Unternehmens. Ihr fehlen
              rund 3,26 Mio. € Kosten, die auf Kostenstellen statt auf Aufträgen liegen, und sie
              enthielt 1,58 Mio. € sekundäre Kostenarten, die es in der Finanzbuchhaltung gar
              nicht gibt. Sie heißt deshalb überall im System jetzt „Auftragsergebnis“.
              <br /><br />
              Maßgeblich ist die geprüfte GuV aus <code>sap_einzelposten</code>. Sie trifft die
              mitgelieferte Referenz-GuV für Januar bis Juni auf den Cent:
              <b> 226.790,48 €</b> gegen 226.790,48 €, Differenz null – und zwar in jeder
              einzelnen Position, von den Umsatzerlösen bis zum Personalaufwand. Januar bis Juli
              ergibt <b>−305.063 €</b>, der aktuelle Abschluss <b>−823.603 €</b>.
              Nachweis auf der <Link href="/abstimmung" style={{ color: 'var(--accent)' }}>Abstimmungsseite</Link>.
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Auch der Abschluss stimmt nicht</div>
          <h2>Sieben Konten fallen aus der Berichtsgliederung</h2>
          <p>Die im SAP-Bericht gedruckte Zeile „Jahresüberschuß / Jahresfehlbetrag“ lautet
             689.066,87 €. Richtig sind 903.183,53 €. Die Differenz von 214.116,66 € sind sieben
             echte Aufwandskonten, denen die Berichtsstruktur keine Position zuweist; sie landen
             unter „Nicht zugeordnete Konten“ und fehlen deshalb im ausgewiesenen Ergebnis.</p></div>
        </div>
        <div className="card-body flush">
          <div className="tablewrap">
            <table className="data compact">
              <thead><tr><th>Konto</th><th>Bezeichnung</th><th className="r">Betrag</th></tr></thead>
              <tbody>
                <tr><td className="num">411021</td><td>Arbeitgeberanteil zur gesetzlichen Rentenversicherung</td><td className="r num">181.787,43 €</td></tr>
                <tr><td className="num">420022</td><td>Raumpflege fremde Gebäude</td><td className="r num">18.151,84 €</td></tr>
                <tr><td className="num">420015</td><td>Instandhaltungskosten fremde Gebäude</td><td className="r num">8.113,26 €</td></tr>
                <tr><td className="num">450081</td><td>Sponsoring</td><td className="r num">2.000,00 €</td></tr>
                <tr><td className="num">420021</td><td>Raumpflege eigene Gebäude</td><td className="r num">1.607,94 €</td></tr>
                <tr><td className="num">460081</td><td>Beiträge zu sonstigen Vereinigungen</td><td className="r num">1.600,00 €</td></tr>
                <tr><td className="num">401015</td><td>Alternative Antriebe (Strom, Wasserstoff)</td><td className="r num">856,19 €</td></tr>
                <tr className="total"><td /><td><b>Summe</b></td><td className="r num"><b>214.116,66 €</b></td></tr>
              </tbody>
            </table>
          </div>
          <div className="card-body">
            <span className="muted" style={{ fontSize: 12.5 }}>
              Nimmt man sie hinzu, schließen Bilanz und GuV exakt: Bilanzkonten −903.183,53 €
              gegen GuV +903.183,53 €, Probe 0,00 €. Ohne sie geht die Rechnung nicht auf –
              das ist der Grund, warum GuV und Bilanz sich bisher nicht abstimmen ließen.
              Der Punkt gehört an die Fachabteilung: die Bilanz/GuV-Struktur im SAP-Bericht
              ist um diese sieben Konten zu ergänzen.
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div><div className="eyebrow">Grenzen</div><h2>Was diese Daten nicht hergeben</h2></div>
        </div>
        <div className="card-body">
          <div className="deflist">
            <div><b>Die Auftragssicht ist keine GuV</b>
              <span>Die Deckungsbeitragsrechnung wertet nur auftragsbezogene Buchungen aus. Für die GuV
                    ist sie deshalb nicht maßgeblich – dafür stehen die Einzelposten, die gegen den
                    Abschluss geprüft sind.</span></div>
            <div><b>Keine Plan- und Budgetwerte</b>
              <span>Die Felder <span className="mono">budget_umsatz</span> und <span className="mono">budget_kosten</span> im
                    Projektstamm sind leer. Plan-Ist-Vergleiche sind erst nach Pflege dieser Werte oder nach Erfassung
                    im <Link href="/forecast" style={{ color: 'var(--accent)' }}>Forecast</Link> möglich.</span></div>
            <div><b>Kein vollständiger August</b>
              <span>Der SAP-Export enthält für August nur 986 statt rund 2.542 Zeilen (39 %). Für den
                    Jahresforecast wird August deshalb aus dem Rolling Forecast genommen, nicht aus SAP.
                    Ein neu gezogener Export bleibt die wirksamste einzelne Maßnahme.</span></div>
            <div><b>Kein Plan für Kostenstellen</b>
              <span>Der 12-Monats-Forecast der Regionalleiter umfasst nur Aufträge. Die auf Kostenstellen
                    gebuchten Gemeinkosten – Januar bis August 3,25 Mio. € – sind darin nicht enthalten.
                    Deshalb führt der Rolling Forecast das Jahresergebnis, nicht der Bottom-up.</span></div>
            <div><b>Keine Projektlaufzeiten</b>
              <span>Start- und Enddatum sind im Projektstamm nicht gefüllt; als Zeitraum wird die erste und letzte
                    Buchung angezeigt.</span></div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
