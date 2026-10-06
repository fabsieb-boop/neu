from __future__ import annotations

from collections import Counter
from datetime import date
from pathlib import Path

import xlsxwriter


OUTPUT = Path(__file__).with_name("Due_Diligence_Arbeitsmappe.xlsx")


def build_checklist() -> list[dict[str, str]]:
    sections: list[tuple[str, str, list[tuple[str, ...]]]] = [
        (
            "Transaktion & Scope",
            "TRX",
            [
                ("Deal Perimeter", "Sind Zielgesellschaften, Vermögenswerte, Schulden und ausgenommene Positionen eindeutig abgegrenzt?", "Strukturdiagramm, Term Sheet, Perimeter-Liste, Asset- und Beteiligungsverzeichnis", "Perimeter mit Abschlüssen, Verträgen und Bewertungsmodell abstimmen; Lückenliste erstellen.", "Nicht konsolidierte Einheiten, nicht übertragbare Assets, unklare Haftungszuordnung", "Kritisch", "Screening", "Perimeter verbindlich festlegen und Abweichungen im SPA sowie Kaufpreismodell abbilden.", "Bewertung/Kaufpreis", "Definitionen, Closing Accounts, Freistellung", "S03"),
                ("Transaktionsstruktur", "Ist Share Deal, Asset Deal oder Mischform wirtschaftlich, rechtlich und steuerlich belastbar?", "Term Sheet, Strukturmemorandum, Steuer- und Rechtsgutachten", "Alternativen nach Steuern, Haftungsübergang, Übertragbarkeit und Umsetzungsrisiko vergleichen.", "Struktur nur steuergetrieben, unerforderliche Zustimmungen, ungeklärte Gesamtrechtsnachfolge", "Kritisch", "Screening", "Strukturoptionen mit Entscheidungsmatrix dokumentieren und bevorzugte Struktur freigeben.", "Abbruch/No-go", "Closing-Bedingung, Struktur-Covenant", "S03"),
                ("Materialität", "Sind Materialitätsschwellen je Prüfungsbereich definiert und konsistent?", "DD-Scope, Bewertungsmodell, Risikotoleranz, Finanzierungsvorgaben", "Quantitative und qualitative Schwellen einschließlich No-go-Kriterien festlegen.", "Beliebige Einzelfallentscheidungen, kleine wiederkehrende Fehler werden unterschätzt", "Hoch", "Screening", "Materialitätsmatrix mit Eskalations- und Genehmigungsstufen beschließen.", "Integration/100-Tage-Plan", "Reporting-Covenant", "S01"),
                ("Stichtag & Zeitraum", "Decken Prüfungszeitraum und Stichtag die Werttreiber und aktuelle Entwicklung angemessen ab?", "Jahresabschlüsse, Monatsreporting, LTM-Daten, Ereignisse nach Stichtag", "Historie, LTM und aktuelle Monatsdaten überleiten; Subsequent Events prüfen.", "Veraltete Daten, starke Abweichung nach Stichtag, fehlende Monatsabschlüsse", "Hoch", "Vollprüfung", "Bring-down-Daten und Aktualisierung vor Signing/Closing vertraglich verlangen.", "SPA/Haftung", "Bring-down, Closing-Bedingung", "S05"),
                ("Datenraumqualität", "Sind Datenraum, Index, Versionierung und Vollständigkeit prüfbar?", "VDR-Index, Upload-Log, Berechtigungsmatrix, Vollständigkeitserklärung", "Index gegen Request List abgleichen; Dubletten, fehlende Versionen und späte Uploads markieren.", "Massen-Uploads kurz vor Deadline, widersprüchliche Versionen, gelöschte Dateien", "Kritisch", "Vollprüfung", "VDR-Governance, Cut-off und finale Datenraum-DVD/Archiv vereinbaren.", "SPA/Haftung", "Disclosure-Regeln, Vollständigkeitserklärung", "S02"),
                ("Management-Auskünfte", "Sind Management-Aussagen dokumentiert, konsistent und evidenzbasiert?", "Q&A-Protokolle, Management-Präsentation, Datenquellen, Representation Letter", "Aussagen triangulieren und wesentliche mündliche Zusagen schriftlich bestätigen lassen.", "Ausweichende Antworten, häufige Korrekturen, fehlende Evidenz", "Hoch", "Vollprüfung", "Offene Aussagen in Q&A nachverfolgen und als Garantie oder Closing Deliverable absichern.", "SPA/Haftung", "Garantie, Covenant, Closing Deliverable", "S03"),
                ("Interessenkonflikte", "Sind Management-Incentives, Verkäuferinteressen und Beraterabhängigkeiten transparent?", "Bonuspläne, MIP, Beraterverträge, Related-Party-Liste", "Anreize auf mögliche Ergebnissteuerung, Retention und Deal-Abhängigkeit analysieren.", "Transaktionsbonus nur bei hohem Kaufpreis, undisclosed related parties", "Hoch", "Screening", "Konflikte offenlegen, unabhängige Validierung und angepasste Incentives vorsehen.", "Bewertung/Kaufpreis", "Disclosure, Retention-Vereinbarung", "S01"),
                ("Regulatorischer Pfad", "Sind erforderliche Fusionskontroll-, Investitionskontroll- und Branchenfreigaben identifiziert?", "Umsatzdaten nach Land, Eigentümerstruktur, Lizenzen, Regulatory Memo", "Schwellenwerte, Zuständigkeiten, Long-stop Date und Vollzugsrisiko prüfen.", "Gun jumping, übersehene Anmeldung, kritische ausländische Beteiligung", "Kritisch", "Screening", "Anmeldestrategie, Verantwortlichkeiten und Long-stop-/Termination-Regelung festlegen.", "Closing-Bedingung", "Condition precedent, Long-stop Date", "S03"),
            ],
        ),
        (
            "Corporate & Governance",
            "COR",
            [
                ("Existenz & Vertretung", "Sind Gesellschaften wirksam errichtet und Vertretungsbefugnisse aktuell?", "Registerauszüge, Satzungen, Geschäftsführerlisten, Vollmachten", "Registerdaten mit internen Unterlagen und Signaturrechten abgleichen.", "Abweichende Geschäftsführer, abgelaufene Vollmachten, fehlende Eintragung", "Kritisch", "Vollprüfung", "Register und Vollmachten vor Closing bereinigen.", "Closing-Bedingung", "Closing Deliverable, Garantie", "S03"),
                ("Cap Table", "Ist die Eigentümerstruktur vollständig verwässert und frei von unbekannten Rechten?", "Gesellschafterliste, Aktienbuch, Optionen, Wandeldarlehen, VSOP/ESOP", "Fully diluted Cap Table rechnen und auf Abschlüsse sowie Verträge abstimmen.", "Nicht erfasste Optionen, Side Letters, strittige Anteile", "Kritisch", "Vollprüfung", "Alle Rechte ablösen oder in Kaufpreis und Closing-Mechanik integrieren.", "Bewertung/Kaufpreis", "Closing-Bedingung, Freistellung", "S03"),
                ("Belastungen", "Sind Anteile und wesentliche Assets frei von Pfandrechten oder sonstigen Belastungen?", "Pfandverträge, Register, Sicherheitenverzeichnis, Bankbestätigungen", "Sicherheiten auf Eigentümer, Rang, Freigabebedingung und Vollständigkeit prüfen.", "Nicht freigabefähige Sicherheiten, Cross-Collateral, negative pledge", "Kritisch", "Vollprüfung", "Payoff Letter und Freigaben als Closing Deliverables verlangen.", "Finanzierung", "Debt payoff, Release Condition", "S03"),
                ("Beschlusslage", "Sind wesentliche Organbeschlüsse und Transaktionen ordnungsgemäß genehmigt?", "Protokolle der letzten fünf Jahre, Geschäftsordnungen, Zustimmungslisten", "Beschlüsse auf Form, Quorum, Interessenkonflikte und Folgepflichten prüfen.", "Fehlende Genehmigung, rückdatierte Protokolle, dauerhafte Kompetenzverstöße", "Hoch", "Vollprüfung", "Heilungsbeschlüsse und aktualisierte Geschäftsordnung umsetzen.", "SPA/Haftung", "Garantie, Closing Deliverable", "S03"),
                ("Gesellschafterrechte", "Bestehen Vorkaufs-, Mitverkaufs-, Vetorechte oder Übertragungsbeschränkungen?", "Gesellschaftervereinbarungen, Side Letters, Beteiligungsverträge", "Rechte je Transaktionsschritt und benötigte Waiver dokumentieren.", "Unkündbare Vetorechte, fehlende Drag-Ausübung, Zustimmung Dritter", "Kritisch", "Vollprüfung", "Waiver/Zustimmungen vor Signing oder als Closing-Bedingung beschaffen.", "Closing-Bedingung", "Consent Condition", "S03"),
                ("Beteiligungen & JVs", "Sind Tochtergesellschaften, Joint Ventures und Minderheiten wirtschaftlich kontrollierbar?", "Beteiligungsliste, JV-Verträge, lokale Abschlüsse, Governance-Rechte", "Kontrolle, Ausschüttungen, Finanzierungspflichten und Exit-Rechte bewerten.", "Nachschusspflichten, Deadlock, Verlustgesellschaft ohne Exit", "Hoch", "Vollprüfung", "Risikobeteiligungen separieren, Garantien begrenzen oder Bewertung anpassen.", "Bewertung/Kaufpreis", "Carve-out, Freistellung", "S03"),
                ("Intra-Group", "Sind konzerninterne Verträge fremdüblich, vollständig und nach Closing fortführbar?", "Service-, Darlehens-, Cash-Pool-, Lizenz- und Steuerumlageverträge", "Leistungsumfang, Preis, Laufzeit, Kündigung und Stand-alone-Kosten prüfen.", "Kostenlose Leistungen, sofortige Kündigung, unklare IP-Nutzung", "Kritisch", "Vollprüfung", "TSA oder neue Stand-alone-Verträge mit marktgerechten Konditionen vereinbaren.", "Integration/100-Tage-Plan", "TSA, Covenant", "S03"),
                ("Ausschüttungen & Kapital", "Waren Kapitalmaßnahmen und Ausschüttungen gesellschafts- und insolvenzrechtlich zulässig?", "Kapitalbeschlüsse, Einzahlungsnachweise, Dividendendokumentation", "Kapitalerhaltung, Sacheinlagen und Rückzahlungen juristisch und bilanziell prüfen.", "Verdeckte Einlagenrückgewähr, nicht eingezahltes Kapital", "Hoch", "Vollprüfung", "Rückforderungsrisiko quantifizieren und Verkäuferfreistellung vereinbaren.", "SPA/Haftung", "Spezifische Freistellung", "S03"),
                ("Fördermittel", "Bestehen Bindungen, Rückzahlungsrisiken oder Change-of-Control-Folgen aus Fördermitteln?", "Zuwendungsbescheide, Förderverträge, Verwendungsnachweise", "Zweckbindung, Behaltefristen, Meldepflichten und Rückforderungstatbestände prüfen.", "Fehlender Verwendungsnachweis, CoC-Meldepflicht, nicht erfüllte Arbeitsplatzauflage", "Hoch", "Vollprüfung", "Behördliche Zustimmung einholen und Rückzahlung im Kaufpreis/SPA absichern.", "Bewertung/Kaufpreis", "Freistellung, Closing-Bedingung", "S03"),
            ],
        ),
        (
            "Financial",
            "FIN",
            [
                ("Abschlussqualität", "Sind geprüfte Abschlüsse, Management Accounts und Hauptbuch konsistent?", "Abschlüsse 3–5 Jahre, Prüfungsberichte, Summen-/Saldenlisten, Kontenpläne", "Trial Balance zu Abschluss und Management Reporting überleiten; Differenzen erklären.", "Ungeklärte Überleitungsdifferenzen, häufige Nachbuchungen, eingeschränkter Bestätigungsvermerk", "Kritisch", "Vollprüfung", "Datenbereinigung, Abschlussgarantie und belastbare Closing Accounts verlangen.", "Bewertung/Kaufpreis", "Closing Accounts, Garantie", "S03"),
                ("Bilanzierungsgrundsätze", "Sind Bilanzierungs- und Bewertungsmethoden angemessen und periodenstetig?", "Accounting Manual, Abschlussanhang, Methodenänderungen", "Methoden mit Standard, Peer Practice und Vorjahren vergleichen.", "Ergebniswirksame Methodenwechsel, aggressive Schätzungen", "Hoch", "Vollprüfung", "Normalisierung im QoE und spezifische Bilanzgarantien vorsehen.", "Bewertung/Kaufpreis", "Garantie, Kaufpreisanpassung", "S03"),
                ("Umsatzrealisierung", "Sind Umsatz, Cut-off und Leistungsfortschritt sachgerecht erfasst?", "Top-Rechnungen, Verträge, Lieferscheine, Gutschriften nach Stichtag", "Stichproben um Periodenende; Vertragsbedingungen und nachträgliche Gutschriften prüfen.", "Bill-and-hold, Side Letters, vorgezogener Umsatz, hohe Stornos", "Kritisch", "Vollprüfung", "Umsatz/EBITDA normalisieren und Garantie bzw. Escrow für Fehlbuchungen vereinbaren.", "Bewertung/Kaufpreis", "Kaufpreisanpassung, Garantie", "S03"),
                ("Quality of Earnings", "Wie hoch ist das nachhaltig wiederkehrende EBITDA?", "GuV monatlich, Kontendetails, Einmaleffekte, Management Adjustments", "Reported-to-adjusted EBITDA Bridge; Wiederkehr, Cash-Wirkung und Run-rate einzeln belegen.", "Synergien als Ist-EBITDA, wiederkehrende 'Einmaleffekte', unbelegte Adjustments", "Kritisch", "Vollprüfung", "Nur belegte, nachhaltige Adjustments akzeptieren und Bewertungsbasis anpassen.", "Bewertung/Kaufpreis", "Preisformel, Earn-out", "S03"),
                ("Umsatzqualität", "Wie stabil sind Umsatzmix, Wiederkehr, Churn und Preis/Menge?", "Umsatz nach Kunde, Produkt, Land, Kanal und Monat; Vertragsstatus", "Kohorten-, Churn-, Preis/Mengen- und Konzentrationsanalyse; Daten mit Hauptbuch abstimmen.", "Hohe Einmalumsätze, negative Net Revenue Retention, Abhängigkeit von Rabatten", "Kritisch", "Vollprüfung", "Bewertung nach belastbarem wiederkehrendem Umsatz staffeln; Retention-Maßnahmen einplanen.", "Bewertung/Kaufpreis", "Earn-out, Garantie", "S03"),
                ("Bruttomarge", "Sind Margenentwicklung und Abweichungen nach Segment erklärbar?", "Umsatz/COGS nach Produkt und Kunde, Standardkosten, Preislisten", "Marge nach Mix, Preis, Volumen und Kosten zerlegen; Ausreißer prüfen.", "Nicht allokierte Kosten, sinkende Marge trotz Preiserhöhung", "Hoch", "Vollprüfung", "Business Case korrigieren und Preis-/Beschaffungsmaßnahmen priorisieren.", "Bewertung/Kaufpreis", "Business-Plan-Covenant", "S03"),
                ("Kostenbasis", "Sind Opex vollständig, marktüblich und auf Stand-alone-Basis tragfähig?", "Kostenstellen, Personal-, Beratungs-, IT- und Mietkosten", "Run-rate, Owner Costs, fehlende Konzernumlagen und Inflationseffekte normalisieren.", "Unterdeckte Shared Services, kapitalisierte laufende Kosten", "Kritisch", "Vollprüfung", "Stand-alone-Kosten im Modell ergänzen und TSA/100-Tage-Maßnahmen budgetieren.", "Bewertung/Kaufpreis", "TSA, Kaufpreisanpassung", "S03"),
                ("Working Capital", "Wie hoch ist das normalisierte betriebliche Working Capital und seine Saisonalität?", "Monatsbilanzen 24–36 Monate, Altersstrukturen, Factoring, Deferred Revenue", "NWC monatlich, DSO/DIO/DPO, Ausreißer, Saisonalität und Accounting Changes analysieren.", "Stichtagssteuerung, überfällige Forderungen, obsoleter Bestand, gestreckte Lieferanten", "Kritisch", "Vollprüfung", "Normalisiertes NWC-Peg samt Definitionen und Beispielrechnung vereinbaren.", "Bewertung/Kaufpreis", "NWC-Mechanismus", "S03"),
                ("Net Debt", "Sind alle Finanzschulden und debt-like/cash-like Positionen erfasst?", "Darlehen, Leasing, Factoring, Cash Pool, Zinsen, Boni, Steuern, Rechtsfälle", "Positionen auf wirtschaftlichen Finanzierungscharakter und Doppelzählung prüfen.", "Reverse Factoring, gesperrtes Cash, aufgelaufene Boni, Capex-Kreditoren", "Kritisch", "Vollprüfung", "Net-Debt-Definition und beispielhafte Closing-Berechnung im SPA fixieren.", "Bewertung/Kaufpreis", "Net-Debt-Mechanismus", "S03"),
                ("Cashflow Conversion", "Konvertiert EBITDA nachhaltig in operativen freien Cashflow?", "Kapitalflussrechnung, Bankdaten, NWC, Capex, Steuern, Zinsen", "EBITDA-to-Cash Bridge über 3–5 Jahre und LTM erstellen.", "Dauerhaft geringe Conversion, Finanzierung durch Lieferanten/Steuerstundung", "Hoch", "Vollprüfung", "Bewertungsmultiplikator/Finanzierung anpassen und Cash-Programm definieren.", "Finanzierung", "Covenant, Kaufpreisanpassung", "S03"),
                ("Capex", "Sind Maintenance-, Growth- und Compliance-Capex korrekt getrennt?", "Anlagenzugänge, Investitionsplan, Instandhaltung, Projekte", "Capex nach Zweck, Alter, Verschiebung und Nutzen analysieren; Site Walk einbeziehen.", "Aufgeschobener Ersatz, Growth als Maintenance deklariert, aktivierte Opex", "Kritisch", "Vollprüfung", "Catch-up-Capex vom Wert abziehen und verbindlichen Investitionsplan erstellen.", "Bewertung/Kaufpreis", "Kaufpreisanpassung, Covenant", "S03"),
                ("Rückstellungen", "Sind Rückstellungen und Eventualverbindlichkeiten vollständig und realistisch?", "Rückstellungsspiegel, Rechts-, Garantie-, Umwelt- und Personalthemen", "Historische Inanspruchnahme, Best-/Worst-Case und Subsequent Events prüfen.", "Auflösung zur Ergebnissteigerung, fehlende Rechts-/Umweltrückstellung", "Hoch", "Vollprüfung", "Exposure quantifizieren und spezifische Freistellung/Escrow vorsehen.", "SPA/Haftung", "Freistellung, Escrow", "S03"),
                ("Off-Balance", "Bestehen nicht bilanzierte Verpflichtungen oder Zweckgesellschaften?", "Leasing, Abnahmeverpflichtungen, Garantien, SPVs, Side Letters", "Vertrags- und Zahlungsdaten nach Mindestabnahmen, Garantien und Finanzierung durchsuchen.", "Take-or-pay, Patronat, Rückkaufpflicht, undisclosed SPV", "Kritisch", "Vollprüfung", "In Net Debt/Business Plan aufnehmen oder Verkäuferfreistellung verlangen.", "Bewertung/Kaufpreis", "Freistellung, Net Debt", "S03"),
                ("Forecast-Qualität", "Wie belastbar waren Planung und Forecasts historisch?", "Budgets, Forecast-Versionen, Ist-Abweichungen, Annahmen", "Backtesting nach Umsatz, Marge, EBITDA, Cash und Capex; Bias messen.", "Systematisches Over-forecasting, häufige Reforecast-Änderungen", "Hoch", "Vollprüfung", "Base Case konservativ neu basieren und Sensitivitäten/Downside festlegen.", "Bewertung/Kaufpreis", "Earn-out, MAC-Analyse", "S03"),
                ("Liquidität & Covenants", "Ist Liquidität bis und nach Closing ausreichend und covenant-konform?", "13-Wochen-Cashflow, Kreditlinien, Covenants, Waiver, Bankkorrespondenz", "Headroom und Downside unter Zins-, Umsatz- und NWC-Stress rechnen.", "Covenant Breach, uncommitted Linie, kurzfristige Refinanzierung", "Kritisch", "Vollprüfung", "Refinanzierung/Equity Backstop und Waiver als Closing-Voraussetzung sichern.", "Finanzierung", "Financing Condition, Payoff", "S03"),
                ("Fraud Analytics", "Gibt es Hinweise auf Management Override oder ungewöhnliche Buchungen?", "Journal Entries, Benutzerrechte, manuelle Buchungen, Vendor Master", "Benford-/Ausreißer-, Wochenend-, Rundbetrags- und Related-Party-Tests durchführen.", "Buchungen durch Admin, ungewöhnliche Periodenendposten, doppelte Bankkonten", "Hoch", "Vollprüfung", "Forensische Vertiefung, Zugriffssperren und Garantie/Freistellung bei Befund.", "Abbruch/No-go", "Freistellung, Garantie", "S03"),
            ],
        ),
        (
            "Commercial",
            "COM",
            [
                ("Marktgröße", "Sind Marktgröße, Wachstum und adressierbarer Markt belastbar?", "Marktstudien, interne Planung, Kundendaten, Branchenstatistik", "Top-down und Bottom-up triangulieren; nominales vs. reales Wachstum trennen.", "Nur Managementquelle, überbreiter TAM, rückläufiger Kernmarkt", "Hoch", "Vollprüfung", "Business Case auf belegbaren SAM/SOM und Szenarien neu basieren.", "Bewertung/Kaufpreis", "Earn-out", "S03"),
                ("Wettbewerb", "Wie nachhaltig ist die Wettbewerbsposition?", "Wettbewerberliste, Win/Loss, Preisbenchmarks, Produktvergleich", "Positionierung, Eintrittsbarrieren, Differenzierung und Wechselkosten bewerten.", "Verlust zentraler Ausschreibungen, leicht kopierbares Angebot", "Hoch", "Vollprüfung", "Investitions- und Pricing-Roadmap in 100-Tage-Plan aufnehmen.", "Integration/100-Tage-Plan", "Business-Plan-Covenant", "S03"),
                ("Kundenkonzentration", "Wie hoch ist die Abhängigkeit von Top-Kunden und Endmärkten?", "Umsatz/DB je Kunde 36 Monate, Konzernzuordnung, Vertragsstatus", "Top-10/20, HHI, Churn und Downside je Kunde berechnen.", "Top-Kunde >20 %, sinkender Share of Wallet, mündliche Zusagen", "Kritisch", "Vollprüfung", "Kundenbestätigung/Retention und Konzentrationsabschlag bzw. Earn-out prüfen.", "Bewertung/Kaufpreis", "Earn-out, Closing-Bedingung", "S03"),
                ("Churn & Retention", "Sind Kundenbindung und Wiederkaufsraten korrekt gemessen?", "Kundenkohorten, Kündigungen, Reaktivierungen, ARR/MRR-Walk", "Logo-, Umsatz- und Gross-Revenue-Churn konsistent berechnen.", "Reaktivierungen als Neukunden, Downgrades nicht im Churn", "Hoch", "Vollprüfung", "KPI-Definitionen vereinheitlichen und Retention-Initiativen finanzieren.", "Bewertung/Kaufpreis", "KPI-Garantie, Earn-out", "S03"),
                ("Pipeline & Backlog", "Sind Pipeline, Auftragsbestand und Forecast konvertierbar?", "CRM-Export, Aufträge, Stornohistorie, Sales-Stages", "Stage-Aging, Conversion, Slippage, Backlog-Marge und Abnahmebedingungen prüfen.", "Manuelle Opportunities, lange überfällige Pipeline, kündbarer Backlog", "Kritisch", "Vollprüfung", "Nur risikogewichtete Pipeline berücksichtigen; CRM Governance verbessern.", "Bewertung/Kaufpreis", "Earn-out", "S03"),
                ("Pricing", "Sind Preisniveau, Rabatte und Preisdurchsetzung nachhaltig?", "Preislisten, Rabatte, Verträge, Deal Desk, Preiserhöhungen", "Preis-Wasserfall und Realisierung nach Kunde/Produkt analysieren.", "Unkontrollierte Sonderrabatte, rückwirkende Boni, negative Preisrealisierung", "Hoch", "Vollprüfung", "Pricing Governance und priorisierte Repricing-Wellen aufsetzen.", "Integration/100-Tage-Plan", "Covenant", "S03"),
                ("Unit Economics", "Sind Deckungsbeitrag, CAC, LTV und Payback nach Segment positiv?", "Segment-P&L, Marketing-/Sales-Kosten, Kohorten", "Vollkosten- und inkrementelle Sicht, Sensitivität für Churn und Marge.", "Wachstum vernichtet Wert, CAC ohne Personal, LTV mit unrealistischer Laufzeit", "Hoch", "Vollprüfung", "Unprofitable Segmente stoppen/repreisen und Modellannahmen korrigieren.", "Bewertung/Kaufpreis", "Business-Plan-Anpassung", "S03"),
                ("Produkt & Roadmap", "Passen Produktreife und Roadmap zu Kundenbedarf und Planung?", "Roadmap, Release-Historie, Kundenfeedback, R&D-Budget", "Commitments, Ressourcen, technische Abhängigkeiten und Monetarisierung abgleichen.", "Wiederholte Verzögerungen, kundenspezifische Forks, fehlende Product Ownership", "Hoch", "Vollprüfung", "Roadmap priorisieren, Ressourcen sichern und nicht belegte Umsätze entfernen.", "Integration/100-Tage-Plan", "Covenant", "S03"),
                ("Sales Productivity", "Sind Vertriebsproduktivität und Skalierbarkeit realistisch?", "Quota, Attainment, Ramp-up, Pipeline je Mitarbeiter, Fluktuation", "Kohorten nach Eintritt, Region und Kanal; Kapazitätsplan gegen Wachstum testen.", "Niedriges Attainment, steigender Ramp-up, Founder-led Sales ohne Übergabe", "Mittel", "Vollprüfung", "Kapazitäts- und Enablement-Plan mit realistischen Ramp-up-Annahmen erstellen.", "Integration/100-Tage-Plan", "Retention", "S03"),
                ("Externe Validierung", "Bestätigen Kunden und Marktpartner die zentrale Equity Story?", "Interviewleitfäden, Referenzen, NPS/CSAT, verlorene Deals", "Unabhängige Interviews unter Beachtung von Clean-Team und Vertraulichkeit.", "Management selektiert nur Promotoren, wiederkehrende Qualitätskritik", "Hoch", "Vollprüfung", "Kritische Hypothesen durch neutrale Referenzen validieren und Modell anpassen.", "Bewertung/Kaufpreis", "Closing-Bedingung bei Schlüsselkunde", "S03"),
            ],
        ),
        (
            "Tax",
            "TAX",
            [
                ("Ertragsteuern", "Sind Körperschaft-/Gewerbesteuererklärungen vollständig, fristgerecht und plausibel?", "Erklärungen, Bescheide, Überleitungen, Steuerkonten 5 Jahre", "Erklärung zu Abschluss überleiten; offene Jahre und Zinsen quantifizieren.", "Dauerhafte Vorbehalte, hohe Mehrsteuern, unerklärte Differenzen", "Kritisch", "Vollprüfung", "Exposure je Jahr quantifizieren und Steuerfreistellung vereinbaren.", "SPA/Haftung", "Tax Indemnity, Escrow", "S03"),
                ("Betriebsprüfungen", "Welche Prüfungen, Einsprüche und verbindlichen Auskünfte sind offen?", "Prüfungsberichte, Anordnungen, Einsprüche, Korrespondenz", "Status, Streitwert, Wahrscheinlichkeit und Verjährung juristisch würdigen.", "Wiederkehrende Feststellungen, aggressive Position ohne Gutachten", "Kritisch", "Vollprüfung", "Spezifische Steuerfreistellung und Verfahrenskontrolle des Käufers regeln.", "SPA/Haftung", "Tax Covenant, Indemnity", "S03"),
                ("Verlustvorträge", "Sind steuerliche Verlust- und Zinsvorträge werthaltig und transaktionsfest?", "Feststellungsbescheide, Organigramm, Beteiligungsänderungen", "Nutzbarkeit, Mindestbesteuerung und schädliche Ereignisse prüfen.", "Verfall durch Anteilseignerwechsel, nicht fortführbarer Geschäftsbetrieb", "Hoch", "Vollprüfung", "Wert nur bei belastbarer Nutzbarkeit berücksichtigen; Struktur anpassen.", "Bewertung/Kaufpreis", "Steuergarantie", "S03"),
                ("Umsatzsteuer", "Sind Leistungen, Steuersätze, Reverse Charge und Vorsteuer korrekt?", "USt-Voranmeldungen, Zusammenfassende Meldungen, Rechnungsstichproben", "Datenanalytische Tests nach Land/Steuercode und Rechnungskette.", "Fehlende Registrierung, falscher Steuersatz, formell fehlerhafte Rechnungen", "Kritisch", "Vollprüfung", "Selbstanzeige/Korrektur prüfen, Reserve und Freistellung vorsehen.", "SPA/Haftung", "Tax Indemnity", "S03"),
                ("Lohnsteuer & Sozialversicherung", "Sind Vergütung, Benefits und Statusfeststellungen korrekt behandelt?", "Lohnkonten, Prüfberichte, Firmenwagen, Reisekosten, Freelancer", "Stichproben und Statusanalyse; Brutto-/Netto- und Haftungswirkung rechnen.", "Scheinselbstständigkeit, steuerfreie Pauschalen ohne Nachweis", "Kritisch", "Vollprüfung", "Nachmeldung, Rückstellung und spezifische Freistellung umsetzen.", "SPA/Haftung", "Freistellung, Escrow", "S03"),
                ("Verrechnungspreise", "Sind konzerninterne Preise fremdüblich und dokumentiert?", "Master/Local File, Intercompany-Verträge, Benchmarking", "Funktions-/Risikoanalyse, Margen und Dokumentationsfristen prüfen.", "Keine Dokumentation, Dauerverluste, IP-/Finanzierungsentgelt ohne Benchmark", "Kritisch", "Vollprüfung", "Dokumentation nachholen, Exposure modellieren und Freistellung vereinbaren.", "SPA/Haftung", "Tax Indemnity", "S10"),
                ("Betriebsstätten", "Bestehen nicht registrierte Betriebsstätten oder lokale Steuerpflichten?", "Mitarbeiter-/Projektorte, Homeoffice, Vertretervollmachten, Reisen", "Nexus je Land anhand Tätigkeit, Dauer und Abschlussvollmacht analysieren.", "Dauerhafte Teams ohne Registrierung, abhängiger Vertreter", "Hoch", "Vollprüfung", "Registrieren, historische Risiken quantifizieren und Struktur bereinigen.", "SPA/Haftung", "Freistellung, Covenant", "S10"),
                ("Quellensteuern", "Wurden Quellensteuern auf Zinsen, Lizenzen und Dividenden korrekt behandelt?", "Zahlungsdaten, Verträge, Ansässigkeitsbescheinigungen", "Zahlungsströme, DBA-/Richtlinienentlastung und Beneficial Ownership prüfen.", "Net-of-tax-Klauseln, fehlende Bescheinigungen, Treaty Shopping", "Hoch", "Vollprüfung", "Gross-up-Risiko quantifizieren und Dokumentation/Klauseln korrigieren.", "Bewertung/Kaufpreis", "Tax Indemnity", "S10"),
                ("Umstrukturierungen", "Wurden frühere Umwandlungen und Übertragungen steuerneutral umgesetzt?", "Umwandlungsverträge, Bilanzen, Gutachten, Sperrfristakten", "Buchwerte, Gegenleistungen und Sperrfristen prüfen.", "Laufende Sperrfrist, fehlender Einbringungsnachweis", "Kritisch", "Vollprüfung", "Transaktion an Sperrfristen anpassen oder spezifische Freistellung verlangen.", "Closing-Bedingung", "Tax Indemnity, Covenant", "S03"),
                ("Tax Compliance", "Ist das Steuerkontrollsystem wirksam und sind Fristen/Verantwortungen klar?", "Tax CMS, Kalender, Richtlinien, Kontrollnachweise", "Design und Stichproben der Schlüsselkontrollen beurteilen.", "Ein-Personen-Abhängigkeit, Fristversäumnisse, keine Kontrolldokumentation", "Mittel", "Vollprüfung", "Tax-CMS-Remediation mit Verantwortlichen und Fristen in 100-Tage-Plan.", "Integration/100-Tage-Plan", "Covenant", "S03"),
                ("Transaktionssteuern", "Welche Grunderwerb-, Stempel-, Umsatz- oder Transfersteuern löst die Struktur aus?", "Immobilien-/Asset-Liste, Strukturplan, Jurisdiktionen", "Steuern und Meldepflichten je Schritt rechnen; Alternativen vergleichen.", "Unbudgetierte Grunderwerbsteuer, doppelte Belastung, Fristkritik", "Kritisch", "Screening", "Struktur optimieren und Kostentragung sowie Filing-Pflichten vertraglich regeln.", "Bewertung/Kaufpreis", "Tax Covenant", "S03"),
            ],
        ),
        (
            "Legal",
            "LEG",
            [
                ("Kundenverträge", "Sind wesentliche Kundenverträge wirksam, profitabel und nach Transaktion stabil?", "Top-Verträge, AGB, Bestellungen, Side Letters, Umsatzliste", "Vertrag zu Umsatz/Marge abstimmen; Laufzeit, Kündigung, SLA und Haftung extrahieren.", "Mündliche Verlängerung, jederzeitige Kündigung, Vertragsstrafe, negative Marge", "Kritisch", "Vollprüfung", "Zustimmung/Verlängerung sichern und problematische Klauseln in Preis/SPA berücksichtigen.", "Closing-Bedingung", "Consent, Earn-out", "S03"),
                ("Lieferantenverträge", "Sind Versorgung, Preise und Rechte aus wesentlichen Lieferverträgen gesichert?", "Top-Lieferantenverträge, Preislisten, Mindestabnahmen", "Laufzeit, Preisgleitung, Exklusivität, Lieferpflicht und Rechtsbehelfe prüfen.", "Kurzfristige Kündigung, Take-or-pay, fehlende Alternativquelle", "Hoch", "Vollprüfung", "Verlängerung/Alternativquelle verhandeln und Risiko im Business Case abbilden.", "Integration/100-Tage-Plan", "Consent, Covenant", "S03"),
                ("Change of Control", "Welche Verträge lösen Zustimmung, Kündigung oder Preisanpassung aus?", "Vertragsregister und alle wesentlichen Verträge", "Klauselsuche und juristische Einzelfallprüfung; kritischen Pfad erstellen.", "Kündigungsrecht bei Schlüsselkunde, Bank oder Lizenzgeber", "Kritisch", "Vollprüfung", "Consents vor Closing beschaffen und Ausfallfolgen absichern.", "Closing-Bedingung", "Consent Condition, Termination Right", "S03"),
                ("Finanzierungen", "Sind Finanzierungsverträge, Sicherheiten und Kündigungsfolgen vollständig erfasst?", "Kredit-, Leasing-, Factoring- und Sicherheitenverträge", "CoC, Covenants, Vorfälligkeit, Payoff und Sicherheitenfreigabe prüfen.", "Automatische Fälligkeit, Break Costs, Cross Default", "Kritisch", "Vollprüfung", "Payoff Letter, Refinanzierung und Releases verbindlich vorbereiten.", "Finanzierung", "Closing Deliverable", "S03"),
                ("Haftung & Gewährleistung", "Sind Haftungsregime, Garantien und Freistellungen wirtschaftlich tragbar?", "Verträge, AGB, Schadenshistorie, Garantieprogramme", "Caps, Baskets, Ausschlüsse, Laufzeiten und Back-to-back-Deckung analysieren.", "Unbegrenzte Haftung ohne Versicherung, lange Produktgarantie", "Kritisch", "Vollprüfung", "Exposure quantifizieren, Klauseln/Versicherung anpassen und Freistellung verlangen.", "SPA/Haftung", "Freistellung, Escrow", "S03"),
                ("Rechtsstreitigkeiten", "Sind aktuelle, drohende und historische Streitigkeiten vollständig bewertet?", "Anwaltsbriefe, Prozessliste, Vergleichsvereinbarungen, Rückstellungen", "Claim-by-claim Best/Base/Worst Case und Präzedenzwirkung analysieren.", "Nicht rückgestellter Massenfall, behördliche Ermittlung", "Kritisch", "Vollprüfung", "Spezifische Freistellung, Escrow und Verfahrensführung regeln.", "SPA/Haftung", "Indemnity, Escrow", "S03"),
                ("Genehmigungen", "Sind alle Betriebs-, Produkt- und Berufsgenehmigungen gültig und übertragbar?", "Genehmigungskataster, Bescheide, Auflagen, Korrespondenz", "Gültigkeit, Inhaber, Gebiet, Auflagen, CoC und Verlängerung prüfen.", "Betrieb ohne Genehmigung, wesentliche Auflage verletzt", "Kritisch", "Vollprüfung", "Genehmigung/Übertragung als Closing-Bedingung; Remediation budgetieren.", "Closing-Bedingung", "Condition precedent", "S03"),
                ("Kartell- & Vertriebsrecht", "Sind Vertriebssystem, Preisvorgaben und Wettbewerberkontakte compliant?", "Vertriebsverträge, Preisrichtlinien, Verbands-/Meeting-Unterlagen", "Klauseln und Kommunikation auf RPM, Gebietsschutz, Informationsaustausch prüfen.", "Preisbindung, Marktaufteilung, Dawn Raid", "Kritisch", "Vollprüfung", "Sofortige Legal Hold/Untersuchung und spezifische Freistellung bei Befund.", "Abbruch/No-go", "Indemnity, Closing Condition", "S03"),
                ("Handelsvertreter/Distributor", "Bestehen Ausgleichs-, Kündigungs- oder Exklusivitätsrisiken?", "Agentur-, Händler- und Franchiseverträge", "Kündigungsfolgen, Gebiet, Kundenstamm und zwingendes Recht prüfen.", "Hoher Ausgleichsanspruch, faktische Arbeitnehmerstellung", "Hoch", "Vollprüfung", "Rückstellung/Preisabschlag und geordnete Neuverhandlung planen.", "Bewertung/Kaufpreis", "Freistellung", "S03"),
                ("Öffentliche Aufträge", "Sind Vergabe-, Integritäts- und Kontrollwechselregeln eingehalten?", "Öffentliche Verträge, Ausschreibungsunterlagen, Eigenerklärungen", "Zuschlag, Nachunternehmer, Ausschlussgründe und CoC prüfen.", "Falsche Eigenerklärung, nicht genehmigter Nachunternehmer", "Hoch", "Vollprüfung", "Behördliche Zustimmung und Compliance-Remediation vorsehen.", "Closing-Bedingung", "Garantie, Consent", "S03"),
                ("Garantien & Patronate", "Welche Garantien, Bürgschaften oder Patronate bestehen zugunsten Dritter?", "Garantieverzeichnis, Bankbestätigungen, Board Minutes", "Begünstigtenbestätigung und Abgleich mit Bilanz/Related Parties.", "Unbefristete Garantie für Verkäufergruppe, unklarer Höchstbetrag", "Kritisch", "Vollprüfung", "Freigabe vor Closing oder vollständige Besicherung/Freistellung.", "SPA/Haftung", "Release, Indemnity", "S03"),
                ("AGB & Verbraucherschutz", "Sind AGB, Widerruf, Preisangaben und digitale Prozesse wirksam?", "AGB-Versionen, Bestellstrecken, Beschwerden, Abmahnungen", "Klauselkontrolle und Testkäufe nach Kundengruppe/Jurisdiktion.", "Unwirksame Preisanpassung, Dark Patterns, Massenrückforderung", "Hoch", "Vollprüfung", "AGB/Flows korrigieren, Exposure reservieren und Freistellung verhandeln.", "SPA/Haftung", "Indemnity", "S03"),
                ("Dokumentenaufbewahrung", "Sind Legal Hold, Aufbewahrung und Signaturprozesse belastbar?", "Retention Policy, DMS, Legal Holds, Signaturrichtlinie", "Stichprobe auf Auffindbarkeit, Vollständigkeit und Beweiswert.", "Gelöschte Prozessunterlagen, unzulässige Signaturen", "Mittel", "Vollprüfung", "Legal Hold und DMS-Kontrollen vor Closing stabilisieren.", "Integration/100-Tage-Plan", "Covenant", "S03"),
            ],
        ),
        (
            "Operations",
            "OPS",
            [
                ("Prozessleistung", "Sind Kernprozesse, KPIs und Engpässe transparent?", "Prozesskarten, KPI-Historie, Schicht-/Kapazitätsdaten", "End-to-end Walkthrough, KPI-Reperformance und Engpassanalyse.", "KPI ohne Datenquelle, hohe manuelle Nacharbeit", "Hoch", "Vollprüfung", "KPI-Baseline und priorisiertes Verbesserungsprogramm etablieren.", "Integration/100-Tage-Plan", "Covenant", "S03"),
                ("Kapazität", "Reicht reale Kapazität für den Business Plan?", "Maschinen-/Personalstunden, OEE, Auslastung, Schichtmodelle", "Rated vs. demonstrated capacity, Engpässe und Ramp-up simulieren.", "Plan > nachgewiesene Kapazität, OEE strukturell niedrig", "Kritisch", "Vollprüfung", "Plan korrigieren oder Capex/Schichten samt Vorlauf budgetieren.", "Bewertung/Kaufpreis", "Capex Covenant", "S03"),
                ("Qualität", "Sind Ausschuss, Reklamationen und Qualitätskosten beherrscht?", "FPY, Ausschuss, Reklamationen, Auditberichte, Zertifikate", "Trend, Pareto, Root Cause und Rückstellungsabgleich prüfen.", "Steigende Feldausfälle, verlorene Zertifizierung, Serienfehler", "Kritisch", "Vollprüfung", "Containment, Ursachenprogramm und Produktfreistellung/Versicherung sichern.", "SPA/Haftung", "Indemnity, Escrow", "S03"),
                ("Instandhaltung", "Besteht ein Instandhaltungs- oder Ersatzinvestitionsstau?", "Wartungsplan, Störungen, Anlagenalter, Ersatzteile", "Backlog, MTBF/MTTR, kritische Assets und Capex abgleichen.", "Run-to-failure bei Engpassanlage, keine Ersatzteile", "Hoch", "Vollprüfung", "Catch-up-Plan und Kaufpreisanpassung für aufgeschobenen Aufwand.", "Bewertung/Kaufpreis", "Capex Adjustment", "S03"),
                ("Business Continuity", "Sind kritische Prozesse gegen Ausfall abgesichert und getestet?", "BCP, Notfallpläne, Tests, kritische Ressourcen", "Szenariotests für Standort, Energie, Personal und IT; RTO prüfen.", "Plan nie getestet, Single Point of Failure", "Kritisch", "Vollprüfung", "Notfallmaßnahmen vor Closing und Resilienzprogramm im 100-Tage-Plan.", "Integration/100-Tage-Plan", "Closing Deliverable", "S03"),
                ("Bestände", "Sind Bestand, Reichweite und Obsoleszenz realistisch bewertet?", "Artikelbestand, Bewegungen, Altersstruktur, Inventurdifferenzen", "Slow-/No-Mover, Reichweite, NRV und Inventurbeobachtung analysieren.", "Hohe Altbestände, negative Bestände, manuelle Reserven", "Kritisch", "Vollprüfung", "Abwertung im Closing NWC und Abbauprogramm vereinbaren.", "Bewertung/Kaufpreis", "NWC-Mechanismus", "S03"),
                ("Standortabhängigkeit", "Welche Standort-, Energie- und Infrastrukturabhängigkeiten bestehen?", "Site Map, Versorgerverträge, Ausfallhistorie, Genehmigungen", "Single points, Redundanz, Versorgungs- und Klimarisiken bewerten.", "Ein Standort ohne Alternative, auslaufender Netzanschluss", "Hoch", "Vollprüfung", "Redundanz-/Versicherungsplan und notwendige Investitionen einpreisen.", "Integration/100-Tage-Plan", "Covenant", "S03"),
                ("Skalierbarkeit", "Skalieren Prozesse, Organisation und Systeme mit geplantem Wachstum?", "Kapazitätsplan, Organisationsplan, Systemlimits, SLA", "Volumen-Stresstest und Ressourcen-/Kostenkurve erstellen.", "Überproportionale Kosten, Schlüsselprozess in Tabellenkalkulation", "Hoch", "Vollprüfung", "Skalierungs-Roadmap mit Triggern, Kosten und Verantwortlichen erstellen.", "Integration/100-Tage-Plan", "Business-Plan-Covenant", "S03"),
                ("Produktivität", "Sind Produktivitätsannahmen und Verbesserungen belegt?", "Output/FTE, OEE, Lernkurven, Lean-Projekte", "Historische Initiativen und Benefit Tracking validieren.", "Doppelt gezählte Einsparung, kein Owner, Benefit vor Umsetzung", "Mittel", "Vollprüfung", "Synergien risikogewichten und Benefit-Tracking aufsetzen.", "Bewertung/Kaufpreis", "Earn-out", "S03"),
            ],
        ),
        (
            "Supply Chain",
            "SUP",
            [
                ("Lieferantenkonzentration", "Wie hoch ist die Abhängigkeit von Lieferanten und Unterlieferanten?", "Spend Cube, Lieferantenstamm, BOM, Konzernzuordnung", "Top-Spend, HHI, Abhängigkeit je Produkt und Tier-n kartieren.", "Single Source für kritisches Teil, unbekannte Tier-2-Quelle", "Kritisch", "Vollprüfung", "Dual Sourcing, Sicherheitsbestand oder vertragliche Absicherung priorisieren.", "Integration/100-Tage-Plan", "Covenant", "S03"),
                ("Versorgungsrisiko", "Sind Lieferfähigkeit, Lead Times und Allokationsrisiken beherrscht?", "OTIF, Lead Times, Backorders, Kapazitätszusagen", "Trend und Stressszenarien für Nachfrage, Transport und Ausfall.", "Dauerhafte Rückstände, informelle Kapazitätszusage", "Hoch", "Vollprüfung", "Kapazitätsbestätigung und Kontingenzplan mit Triggern erstellen.", "Closing-Bedingung", "Supplier Consent", "S03"),
                ("Beschaffungspreise", "Sind Preisgleitungen, Rohstoffexposure und Einsparungen realistisch?", "Preislisten, Indexklauseln, PPV, Hedging, Savings Pipeline", "Preis-/Index-Bridge und realisierte vs. geplante Savings.", "Ungehedgte Volatilität, Einsparung ohne Lieferantenzusage", "Hoch", "Vollprüfung", "Business Case aktualisieren und Re-Sourcing/Indexklauseln verhandeln.", "Bewertung/Kaufpreis", "Covenant", "S03"),
                ("Lieferantenqualität", "Sind Qualität und Compliance kritischer Lieferanten ausreichend?", "Audits, PPM, Reklamationen, Zertifikate, CAPA", "Risikobasierte Lieferantenbewertung und Stichprobe von CAPA.", "Wiederholte Abweichung ohne Schließung, gefälschtes Zertifikat", "Kritisch", "Vollprüfung", "Containment, Re-Audit und alternative Quelle vorsehen.", "Integration/100-Tage-Plan", "Closing Deliverable", "S03"),
                ("Logistik", "Sind Fracht-, Lager- und Zollprozesse kosten- und ausfallsicher?", "Frachtverträge, Routen, Incoterms, Zollprüfungen", "Kosten je Einheit, Routenabhängigkeit, Zollklassifikation und Notfallroute.", "Ein Frachtführer, falsche Zolltarifnummer, hohe Sonderfracht", "Hoch", "Vollprüfung", "Routen diversifizieren, Zollstammdaten korrigieren und Kosten normalisieren.", "Bewertung/Kaufpreis", "Freistellung", "S03"),
                ("Nachhaltige Lieferkette", "Sind Menschenrechts-, Umwelt- und Sanktionsrisiken in der Lieferkette kontrolliert?", "Supplier Code, Risikoanalyse, Audits, Herkunftsnachweise", "Risikosegmentierung nach Land/Ware und Wirksamkeit der Abhilfe prüfen.", "Hochrisikolieferant ohne Prüfung, fehlende Herkunft", "Kritisch", "Vollprüfung", "Sperr-/Abhilfeplan und Vertragsklauseln vor bzw. nach Closing umsetzen.", "SPA/Haftung", "Garantie, Covenant", "S13"),
                ("Bestellkontrollen", "Verhindern Procurement-Kontrollen Maverick Buying, Kickbacks und Doppelzahlungen?", "Freigabematrix, PO-Daten, Vendor Master, Rechnungen", "PO-Compliance, Drei-Wege-Abgleich, Bankkonto- und Dublettentests.", "Lieferant und Mitarbeiter teilen Bank/Adresse, nachträgliche Bestellung", "Hoch", "Vollprüfung", "Forensische Vertiefung und Procure-to-Pay-Kontrollen stärken.", "Abbruch/No-go", "Indemnity", "S03"),
            ],
        ),
        (
            "IT & Cyber",
            "IT",
            [
                ("IT-Strategie", "Unterstützen IT-Strategie, Architektur und Budget den Business Plan?", "IT-Roadmap, Architektur, Budget, Projektportfolio", "Business-Alignment, Investitionslücke, Abhängigkeiten und Nutzen prüfen.", "Keine Roadmap, Projekte ohne Budget, Architektur blockiert Wachstum", "Hoch", "Vollprüfung", "Finanzierte IT-Roadmap mit Day-1- und 100-Tage-Prioritäten erstellen.", "Integration/100-Tage-Plan", "TSA, Covenant", "S08"),
                ("Asset Inventory", "Sind Hardware, Software, Cloud-Assets und Datenbestände vollständig inventarisiert?", "CMDB, Inventar, Cloud-Accounts, SaaS-Liste, Datenkatalog", "Stichprobe gegen Netzwerk, Rechnungen und Identitätsprovider.", "Unbekannte Server/Cloud Accounts, Shadow IT", "Kritisch", "Vollprüfung", "Discovery durchführen und Eigentümer/Lifecycle für kritische Assets festlegen.", "Integration/100-Tage-Plan", "Closing Deliverable", "S08"),
                ("Legacy & EOL", "Welche Systeme sind veraltet oder nicht mehr unterstützt?", "Versionsliste, Supportverträge, technische Schulden", "EOL-Daten, Kritikalität, Ersatzplan und Kosten bewerten.", "Kernsystem ohne Patches, Hersteller-Support beendet", "Kritisch", "Vollprüfung", "Sofortkompensation und finanzierte Modernisierungs-Roadmap vorsehen.", "Bewertung/Kaufpreis", "Capex Adjustment, Covenant", "S08"),
                ("IAM & MFA", "Sind Identitäten, privilegierte Zugriffe und MFA wirksam kontrolliert?", "IdP, Rollen, Admin-Konten, Joiner/Mover/Leaver, MFA-Abdeckung", "User-/Rollenstichprobe, Dormant Accounts und MFA/PAM-Abdeckung testen.", "Geteilte Admin-Konten, ehemalige Mitarbeiter aktiv, kein MFA", "Kritisch", "Vollprüfung", "MFA/PAM und sofortige Zugriffsbereinigung als Pre-/Post-Closing-Maßnahme.", "Closing-Bedingung", "Cyber Covenant", "S07"),
                ("Vulnerability & Patch", "Werden Schwachstellen und Patches risikobasiert fristgerecht behandelt?", "Scannerberichte, Patch-KPIs, Ausnahmen, Penetrationstests", "Externe Angriffsfläche und kritische Findings auf Alter/Closure prüfen.", "Internet-exponierte kritische Lücke, kein Scan, dauerhafte Ausnahme", "Kritisch", "Vollprüfung", "Kritische Findings vor Closing schließen und SLA/Monitoring etablieren.", "Closing-Bedingung", "Cyber Indemnity/Covenant", "S07"),
                ("Security Incidents", "Sind Cybervorfälle vollständig erfasst, untersucht und gemeldet?", "Incident Register, Forensikberichte, Versicherungsfälle, Behördenmeldungen", "Timeline, Root Cause, Persistenz, Datenabfluss und Remediation validieren.", "Ransomware ohne Forensik, nicht gemeldeter Datenabfluss", "Kritisch", "Vollprüfung", "Unabhängige Kompromittierungsprüfung, Meldung und spezifische Freistellung.", "Abbruch/No-go", "Cyber Indemnity, Escrow", "S07"),
                ("Backup & Recovery", "Sind Backups geschützt und Wiederherstellungen nachweislich erfolgreich?", "Backup-Konfiguration, Restore-Tests, RPO/RTO, Offline/Immutable Copies", "Stichproben-Restore kritischer Systeme; Trennung von Admin-Domänen prüfen.", "Backup online löschbar, kein Restore-Test, RPO nicht erfüllt", "Kritisch", "Vollprüfung", "Immutable Backup und Recovery-Test vor Closing bzw. Day 1 umsetzen.", "Closing-Bedingung", "Covenant", "S07"),
                ("Disaster Recovery", "Sind DR- und BCP-Pläne realistisch, aktuell und getestet?", "DR-Plan, Abhängigkeiten, Testberichte, Krisenkontakte", "Tabletop und technische Tests gegen RTO/RPO auswerten.", "Plan ohne kritische SaaS/Provider, Test dauerhaft verschoben", "Hoch", "Vollprüfung", "End-to-end-Test und Lückenschließung mit klarer Finanzierung planen.", "Integration/100-Tage-Plan", "Covenant", "S07"),
                ("Cloud & Outsourcing", "Sind Provider-, Cloud- und Managed-Service-Risiken kontrolliert?", "Providerverträge, Architektur, SOC-Berichte, Exit-Pläne", "Shared Responsibility, SLA, Datenort, Subprocessor, Konzentration und Exit prüfen.", "Kein Exit/Export, Admin beim Provider, ungeklärter Datenstandort", "Kritisch", "Vollprüfung", "Exit-/TSA-Plan, Vertragsnachträge und technische Kontrollen vereinbaren.", "Integration/100-Tage-Plan", "TSA, Consent", "S07"),
                ("Softwarelizenzen", "Sind Nutzungsrechte ausreichend und übertragen sich bei Closing?", "Lizenzverträge, Nutzer-/Core-Zahlen, Auditkorrespondenz", "Effective License Position und Change-of-Control/Assignment prüfen.", "Unterlizenzierung, Auditandrohung, Konzernlizenz endet", "Kritisch", "Vollprüfung", "True-up/Neulizenzierung budgetieren und Verkäuferfreistellung sichern.", "Bewertung/Kaufpreis", "Indemnity, TSA", "S03"),
                ("Secure SDLC", "Sind Entwicklung, Änderungen und Secrets angemessen geschützt?", "Repositories, CI/CD, Change Tickets, Scanberichte, Secret Management", "Branch Protection, Reviews, SAST/SCA, Deploy-Rechte und Secrets testen.", "Secrets im Code, direkte Produktionseinspielung, keine Reviews", "Kritisch", "Vollprüfung", "Pipeline-Gates, Secret Rotation und Segregation of Duties einführen.", "Integration/100-Tage-Plan", "Cyber Covenant", "S07"),
                ("IT-Trennung", "Sind Systeme, Daten, Domains und Verträge vom Verkäufer trennbar?", "Dependency Map, Mandanten, Netzwerk, Domains, Lizenzen, TSA-Entwurf", "Separation Workstreams, Datenmigration, Kosten und kritischen Pfad validieren.", "Gemeinsamer Tenant ohne Export, Verkäufer besitzt Domain/Quellcode", "Kritisch", "Vollprüfung", "Detaillierten Separation-/TSA-Plan mit Exit-Kriterien vertraglich fixieren.", "Closing-Bedingung", "TSA, Holdback", "S03"),
            ],
        ),
        (
            "Datenschutz",
            "DAT",
            [
                ("Verarbeitungsverzeichnis", "Sind Verarbeitungstätigkeiten, Zwecke und Rechtsgrundlagen vollständig dokumentiert?", "VVT/ROPA, Datenflussdiagramme, Datenschutzerklärungen", "VVT gegen Systeme, Produkte und Interviews auf Vollständigkeit prüfen.", "Kerngeschäft fehlt im VVT, pauschales berechtigtes Interesse", "Hoch", "Vollprüfung", "VVT und Rechtsgrundlagen vor Closing für kritische Prozesse bereinigen.", "SPA/Haftung", "Datenschutzgarantie, Covenant", "S06"),
                ("Auftragsverarbeitung", "Sind Auftragsverarbeiter und Unterauftragnehmer wirksam eingebunden?", "AV-Verträge, Subprocessor-Liste, TOM, Due-Diligence-Nachweise", "Vertragsstichprobe, Art.-28-Inhalte und Vendor Monitoring prüfen.", "Kein AV-Vertrag, unbekannte Subprocessor", "Kritisch", "Vollprüfung", "Verträge nachholen, kritische Provider sperren/ersetzen und Freistellung prüfen.", "SPA/Haftung", "Indemnity, Covenant", "S06"),
                ("Drittlandtransfer", "Sind internationale Datentransfers legitimiert und bewertet?", "SCC, TIA, Hosting- und Supportorte, Transfer Map", "Transfermechanismus, ergänzende Maßnahmen und tatsächliche Zugriffe prüfen.", "US-/Offshore-Zugriff ohne TIA/SCC, Transfer nicht inventarisiert", "Kritisch", "Vollprüfung", "SCC/TIA und technische Maßnahmen priorisiert nachholen.", "SPA/Haftung", "Datenschutz-Covenant", "S06"),
                ("Betroffenenrechte", "Werden Auskunft, Löschung und Widerspruch fristgerecht und vollständig erfüllt?", "DSAR-Register, Verfahren, Löschprotokolle, Beschwerden", "Fallstichprobe und End-to-end-Test über Systeme durchführen.", "Fristüberschreitung, keine Löschung aus Backups/Downstream", "Hoch", "Vollprüfung", "Workflow, Suchfähigkeit und Löschkonzept verbessern.", "Integration/100-Tage-Plan", "Covenant", "S06"),
                ("Datenschutzverletzungen", "Sind Datenschutzvorfälle erkannt, bewertet und fristgerecht gemeldet?", "Breach Register, Meldungen, Incident Playbook", "Vollständigkeit gegen Security Incidents und Tickets abgleichen.", "Nicht gemeldeter meldepflichtiger Vorfall, keine 72h-Entscheidung", "Kritisch", "Vollprüfung", "Vorfall neu bewerten, ggf. melden und spezifische Freistellung vereinbaren.", "SPA/Haftung", "Indemnity, Escrow", "S06"),
                ("DPIA & Privacy by Design", "Sind Hochrisikoverarbeitungen bewertet und Produkte datenschutzgerecht gestaltet?", "DPIA/DSFA, Produktfreigaben, Architekturentscheidungen", "Trigger, Methodik, Restrestrisiko und Maßnahmenumsetzung prüfen.", "Biometrie/Profiling ohne DPIA, offene Hochrisikomaßnahme", "Kritisch", "Vollprüfung", "DPIA abschließen und Release-Gates für offene Risiken setzen.", "Closing-Bedingung", "Covenant", "S06"),
                ("Retention & Löschung", "Sind Aufbewahrungs- und Löschfristen rechtlich und technisch umgesetzt?", "Löschkonzept, Retention Schedule, Systemkonfiguration", "Stichprobe veralteter Daten und automatische Jobs prüfen.", "Unbegrenzte Speicherung, produktive Kopien in Testsystemen", "Hoch", "Vollprüfung", "Risikobasierte Löschung und technische Retention Controls umsetzen.", "Integration/100-Tage-Plan", "Covenant", "S06"),
            ],
        ),
        (
            "HR & Pensions",
            "HR",
            [
                ("Belegschaftsstruktur", "Sind Headcount, FTE, Kosten und Organisationsstruktur vollständig?", "Mitarbeiterliste, Organigramm, Payroll-Abgleich, Kostenstellen", "HR-Liste zu Payroll und GuV abstimmen; Trends nach Standort/Funktion.", "Ghost Employees, unbesetzte Schlüsselrollen, inkonsistenter Headcount", "Hoch", "Vollprüfung", "Daten bereinigen und Zielorganisation/Schlüsselrollen festlegen.", "Integration/100-Tage-Plan", "Covenant", "S03"),
                ("Arbeitsverträge", "Sind Verträge, Befristungen und nachvertragliche Pflichten wirksam?", "Vertragsmuster, Schlüsselverträge, Nachträge, Policies", "Risikostichprobe nach Land, Seniorität und Sonderklausel.", "Unwirksame Befristung, unklare IP-Abtretung, unbegrenzte Bonuszusage", "Hoch", "Vollprüfung", "Nachträge/Heilung und Garantie für Altansprüche vereinbaren.", "SPA/Haftung", "Garantie, Indemnity", "S03"),
                ("Vergütung & Boni", "Sind Fix-, variable und aktienbasierte Vergütung vollständig und rückgestellt?", "Payroll, Bonuspläne, Provisionen, ESOP/VSOP, Rückstellungen", "Planregeln nachrechnen; Zielerreichung und Closing-/Acceleration-Effekt.", "Nicht rückgestellter Bonus, garantierte Provision trotz Storno", "Kritisch", "Vollprüfung", "Debt-like Behandlung bzw. Verkäuferkosten und klare Cut-off-Regeln vereinbaren.", "Bewertung/Kaufpreis", "Net Debt, Covenant", "S03"),
                ("Schlüsselpersonen", "Welche Personen sind für Umsatz, Produkt, Betrieb und Wissen kritisch?", "Talent Review, Nachfolgeplanung, Kündigungsfristen, Retention", "Key-Person-Matrix mit Abwanderungswahrscheinlichkeit und Impact.", "Founder-/Ein-Personen-Abhängigkeit, angekündigte Kündigung", "Kritisch", "Vollprüfung", "Retention, Nachfolge und Wissensübergabe vor Signing/Closing sichern.", "Closing-Bedingung", "Retention Agreement", "S03"),
                ("Fluktuation & Fehlzeiten", "Deuten Turnover, Krankenstand oder Engagement auf strukturelle Probleme?", "Ein-/Austritte, Gründe, Fehlzeiten, Surveys 36 Monate", "Kohorten/Benchmarks nach Manager, Standort und Funktion.", "Spike bei Leistungsträgern, hohe Langzeiterkrankung, toxisches Team", "Hoch", "Vollprüfung", "Ursachenmaßnahmen und realistische Recruiting-/Produktivitätskosten einplanen.", "Bewertung/Kaufpreis", "100-Tage-Plan", "S03"),
                ("Mitbestimmung & Tarif", "Sind Betriebsrat, Tarifbindung und Informations-/Konsultationspflichten beachtet?", "Betriebsvereinbarungen, Tarifverträge, Gremien, Verhandlungsstatus", "Transaktions- und Integrationsschritte gegen Pflichten/Fristen planen.", "Unterlassene Konsultation, nachwirkende Vereinbarung, Streikrisiko", "Kritisch", "Screening", "Mitbestimmungsfahrplan und Kommunikationsplan als kritischen Pfad führen.", "Closing-Bedingung", "Covenant", "S03"),
                ("Pensionen", "Sind Pensionsverpflichtungen, Planvermögen und Risiken vollständig bewertet?", "Versicherungsmathematik, Planregeln, Vermögen, Begünstigte", "Aktuarielle Annahmen, Funding, Indexierung und Change-of-Control prüfen.", "Unterdeckung, veraltete Sterbetafel, harte Garantie", "Kritisch", "Vollprüfung", "Debt-like Adjustierung, Escrow oder spezifische Freistellung vereinbaren.", "Bewertung/Kaufpreis", "Net Debt, Indemnity", "S03"),
                ("Freelancer", "Besteht Risiko aus Scheinselbstständigkeit oder Arbeitnehmerüberlassung?", "Freelancer-/Agenturverträge, Einsatzdaten, Weisungen, AÜG-Erlaubnisse", "Status anhand tatsächlicher Durchführung und Dauer beurteilen.", "Langjährige Vollzeitintegration, keine AÜG-Erlaubnis", "Kritisch", "Vollprüfung", "Status bereinigen, Nachzahlung quantifizieren und Freistellung verlangen.", "SPA/Haftung", "Indemnity", "S03"),
                ("Arbeitsstreitigkeiten", "Sind individuelle und kollektive HR-Streitigkeiten angemessen erfasst?", "Fallliste, Anwaltsschreiben, Vergleiche, Beschwerden", "Exposure und Musterwirkung je Fall; Abgleich mit Rückstellungen.", "Diskriminierungsmuster, Whistleblower-Retaliation", "Hoch", "Vollprüfung", "Spezifische Abhilfe, Training und ggf. Freistellung/Escrow.", "SPA/Haftung", "Indemnity, Escrow", "S03"),
                ("Transaktionseffekte", "Lösen Closing, Kontrollwechsel oder Integration Zahlungen/Kündigungsrechte aus?", "Change-of-Control-Klauseln, MIP, Bonus- und Abfindungspläne", "Trigger, Kosten, Steuer/Sozialversicherung und Retention-Wirkung berechnen.", "Single-/Double-Trigger ohne Cap, Verkäufer hat Kosten nicht berücksichtigt", "Kritisch", "Vollprüfung", "Kosten als debt-like behandeln und neue Retention-Struktur abstimmen.", "Bewertung/Kaufpreis", "Net Debt, Covenant", "S03"),
            ],
        ),
        (
            "Intellectual Property",
            "IP",
            [
                ("Eigentumskette", "Ist das für Produkte und Marke wesentliche IP wirksam beim Zielunternehmen?", "Patent-/Markenregister, Abtretungen, Erfinder-/Urheberverträge", "Chain of Title von Schöpfer bis Gesellschaft stichprobenartig nachvollziehen.", "Founder/Agentur hält Rechte, Abtretung formunwirksam", "Kritisch", "Vollprüfung", "Rechte vor Closing übertragen und Eigentumsgarantie/Freistellung vereinbaren.", "Closing-Bedingung", "IP Warranty, Indemnity", "S03"),
                ("Registrierte Rechte", "Sind Schutzrechte gültig, bezahlt und geografisch ausreichend?", "IP-Register, Fristen, Gebühren, Kanzleikorrespondenz", "Status, Inhaber, Länder, Restlaufzeit und Oppositionen prüfen.", "Verpasste Verlängerung, falscher Inhaber, Kernmarkt ungeschützt", "Hoch", "Vollprüfung", "Register bereinigen und Schutzstrategie/Reserve anpassen.", "Bewertung/Kaufpreis", "IP Warranty", "S03"),
                ("Drittlizenzen", "Sind Inbound-Lizenzen ausreichend, compliant und übertragbar?", "Lizenzverträge, Nutzungszahlen, Auditberichte", "Scope, Territorium, Sublizenz, CoC, Gebühren und Kündigung analysieren.", "Kerntechnologie jederzeit kündbar, Nutzung außerhalb Scope", "Kritisch", "Vollprüfung", "Consent/Neulizenzierung vor Closing und Kosten im Modell berücksichtigen.", "Closing-Bedingung", "Consent, Indemnity", "S03"),
                ("Open Source", "Sind Open-Source-Komponenten inventarisiert und Lizenzpflichten erfüllt?", "SBOM, SCA-Scan, OSS Policy, Quellcode", "Scan gegen Inventar; Copyleft, Notice und Source-Disclosure prüfen.", "AGPL/GPL in proprietärem Kern ohne Compliance, keine SBOM", "Kritisch", "Vollprüfung", "Komponenten ersetzen/isolieren, Notices liefern und spezifische Freistellung.", "SPA/Haftung", "IP Indemnity, Covenant", "S03"),
                ("Verletzungsrisiko", "Bestehen Infringement-, FTO- oder Abmahnrisiken?", "Claims, FTO, Abmahnungen, Wettbewerberpatente", "Claim Charts/FTO risikobasiert für Kernprodukte und Märkte.", "Aktive Unterlassungsforderung, bekannte Blocking Patents", "Kritisch", "Vollprüfung", "Design-around/Lizenz und Escrow/Freistellung verhandeln.", "Abbruch/No-go", "IP Indemnity, Escrow", "S03"),
                ("Geschäftsgeheimnisse", "Sind wesentliche Geheimnisse identifiziert und angemessen geschützt?", "Trade-Secret-Register, NDAs, Zugriff, Offboarding", "Need-to-know, Kennzeichnung, technische Kontrollen und Austritte prüfen.", "Quellcode öffentlich geteilt, keine NDA/Access Logs", "Hoch", "Vollprüfung", "Secret-Protection-Programm und sofortige Zugriffssicherung umsetzen.", "Integration/100-Tage-Plan", "Covenant", "S03"),
                ("Domains & Social", "Sind Domains, App-Store- und Social-Media-Konten im Eigentum/Kontrollbereich?", "Registrar-, App-Store-, Plattform- und Admin-Nachweise", "Registrant, MFA, Recovery und Übertragbarkeit prüfen.", "Privates Founder-Konto, Domain läuft aus, keine Recovery", "Hoch", "Vollprüfung", "Konten auf Gesellschaft übertragen und MFA/Break-glass etablieren.", "Closing-Bedingung", "Closing Deliverable", "S03"),
            ],
        ),
        (
            "ESG, EHS & Produkt",
            "ESG",
            [
                ("Umweltgenehmigungen", "Sind umweltrechtliche Genehmigungen und Auflagen vollständig erfüllt?", "Genehmigungen, Messberichte, Behördenkorrespondenz", "Standortbegehung, Auflagenmatrix und Compliance-Stichprobe.", "Grenzwertüberschreitung, ungenehmigte Anlage", "Kritisch", "Vollprüfung", "Abhilfe/Behördenplan, Kostenreserve und Freistellung vereinbaren.", "SPA/Haftung", "Environmental Indemnity", "S13"),
                ("Altlasten", "Bestehen Boden-, Grundwasser-, Asbest- oder sonstige Altlastenrisiken?", "Umweltgutachten, Kataster, Historie, Miet-/Kaufverträge", "Phase-I/II-Assessment risikobasiert; Verursacher-/Eigentümerhaftung prüfen.", "Frühere Chemienutzung, behördlicher Verdacht, fehlende Baseline", "Kritisch", "Vollprüfung", "Gutachten vertiefen und unbegrenzte/ausreichende Umweltfreistellung sichern.", "Abbruch/No-go", "Indemnity, Escrow", "S13"),
                ("Arbeitssicherheit", "Sind Unfälle, Gefährdungen und Schutzmaßnahmen beherrscht?", "Unfallstatistik, Gefährdungsbeurteilungen, Audits, Schulungen", "Trend/Schweregrad, Meldepflicht und CAPA-Wirksamkeit prüfen.", "Tödlicher/schwerer Unfall, wiederholte offene Maßnahme", "Kritisch", "Vollprüfung", "Sofortmaßnahmen und Safety-Programm mit Board Oversight umsetzen.", "Closing-Bedingung", "Covenant, Indemnity", "S13"),
                ("Emissionen & Energie", "Sind Energie-, Emissions- und Klimadaten belastbar und kostenrelevant?", "Verbrauch, Scope-1/2/3-Methodik, Zertifikate, CO2-Kosten", "Datenherkunft, Faktoren und Kosten-/Regulierungsszenarien prüfen.", "Unbelegte Klimaneutralität, hohe CO2-Kosten nicht im Plan", "Hoch", "Vollprüfung", "Baseline verifizieren und Dekarbonisierungs-/Capex-Plan einpreisen.", "Bewertung/Kaufpreis", "Covenant", "S13"),
                ("Berichtspflichten", "Welche Nachhaltigkeits- und Taxonomiepflichten gelten aktuell oder künftig?", "Größe, Konzernstruktur, Berichte, Wesentlichkeitsanalyse", "Anwendungsbereich und Readiness mit aktueller Rechtslage verifizieren.", "Pflicht übersehen, keine Daten-/Kontrollstruktur", "Hoch", "Vollprüfung", "Compliance-Roadmap, Verantwortliche und Budget festlegen.", "Integration/100-Tage-Plan", "Covenant", "S14"),
                ("Menschenrechte", "Sind Menschenrechtsrisiken im eigenen Betrieb und in der Lieferkette adressiert?", "Risikoanalyse, Beschwerden, Audits, Abhilfemaßnahmen", "Hochrisikoländer/-waren, Beschwerdekanal und Wirksamkeit prüfen.", "Zwangs-/Kinderarbeitsindikator, kein Abhilfeprozess", "Kritisch", "Vollprüfung", "Sofortige Abhilfe/Exit-Plan und spezifische Garantie/Freistellung.", "Abbruch/No-go", "ESG Indemnity, Covenant", "S13"),
                ("Produktkonformität", "Sind CE, Produktsicherheit, Kennzeichnung und technische Akten ordnungsgemäß?", "Konformitätserklärungen, Tests, technische Dossiers, Rückrufe", "Produktfamilien risikobasiert auf geltende Anforderungen und Nachweise prüfen.", "Fehlende CE-Unterlage, Sicherheitsmangel, Behördenschreiben", "Kritisch", "Vollprüfung", "Verkaufsstopp/Remediation bewerten und Produktrisiko freistellen.", "Abbruch/No-go", "Product Indemnity, Escrow", "S03"),
                ("Green Claims", "Sind Umwelt- und Nachhaltigkeitsaussagen nachweisbar und rechtlich vertretbar?", "Marketingclaims, Zertifikate, LCA, Prüfberichte", "Claims gegen Evidenz, Scope und Kundenerwartung prüfen.", "Pauschal 'klimaneutral' ohne belastbare Grundlage", "Hoch", "Vollprüfung", "Claims korrigieren, Freigabeprozess und Rückstellung für Ansprüche.", "SPA/Haftung", "Indemnity", "S13"),
                ("ESG-Datenkontrollen", "Sind nichtfinanzielle Kennzahlen vollständig, konsistent und prüfbar?", "Datenmodell, Kontrollen, Quellen, Assurance-Berichte", "Walkthrough und Reperformance wesentlicher KPIs.", "Manuelle Zahl ohne Owner, geänderte Definition ohne Restatement", "Mittel", "Vollprüfung", "Kontrollrahmen und Data Owners im 100-Tage-Plan etablieren.", "Integration/100-Tage-Plan", "Covenant", "S14"),
            ],
        ),
        (
            "Real Estate & Assets",
            "REA",
            [
                ("Eigentum", "Sind Eigentum, Belastungen und Nutzungsrechte an Immobilien klar?", "Grundbuch, Kaufverträge, Dienstbarkeiten, Lagepläne", "Title Review, Grenzen, Zugänge und Belastungen prüfen.", "Wegerecht fehlt, Grundschuld nicht freigegeben", "Kritisch", "Vollprüfung", "Title Cure/Freigabe als Closing-Bedingung und Freistellung.", "Closing-Bedingung", "Condition precedent", "S03"),
                ("Mietverträge", "Sind Standorte langfristig nutzbar und Mietkosten vollständig?", "Mietverträge, Nachträge, Nebenkosten, Bürgschaften", "Laufzeit, Optionen, Indexierung, CoC, Instandhaltung und Dilapidation.", "Kurzfristiger Ablauf am Hauptstandort, hohe Nachholung Nebenkosten", "Hoch", "Vollprüfung", "Verlängerung/Consent sichern und Stand-alone-Mietkosten modellieren.", "Closing-Bedingung", "Consent, Covenant", "S03"),
                ("Baurecht & Nutzung", "Entsprechen Nutzung, Umbauten und Anlagen öffentlich-rechtlichen Vorgaben?", "Baugenehmigungen, Nutzungsfreigaben, Brandschutz", "Soll-/Ist-Nutzung und offene Auflagen mit Sachverständigen prüfen.", "Ungenehmigter Umbau, Brandschutzmangel, Nutzungsuntersagung", "Kritisch", "Vollprüfung", "Legalisierung/Remediation vor Closing oder Kostenfreistellung.", "SPA/Haftung", "Indemnity, Closing Condition", "S03"),
                ("Anlagenregister", "Existieren wesentliche Anlagen, gehören sie dem Ziel und sind sie werthaltig?", "Anlagenregister, Rechnungen, Leasing, Inventur", "Site-Stichprobe, Seriennummern, Eigentum und Impairment prüfen.", "Verkauftes/geleastes Asset als Eigentum, Phantom Asset", "Hoch", "Vollprüfung", "Register bereinigen und Kaufpreis/Capex anpassen.", "Bewertung/Kaufpreis", "Asset Warranty", "S03"),
                ("Stilllegung", "Bestehen Rückbau-, Wiederherstellungs- oder Standortschließungspflichten?", "Miet-/Genehmigungsauflagen, Rückbaukalkulation, Rückstellungen", "Scope, Zeitpunkt, Inflation und Sicherheiten bewerten.", "Keine Rückstellung trotz vertraglicher Rückbaupflicht", "Hoch", "Vollprüfung", "Barwert als debt-like berücksichtigen oder Freistellung vereinbaren.", "Bewertung/Kaufpreis", "Net Debt, Indemnity", "S03"),
            ],
        ),
        (
            "Insurance",
            "INS",
            [
                ("Deckungslandkarte", "Decken Versicherungen wesentliche Betriebs-, Haftungs- und Cyberrisiken ab?", "Policen, Summen, Selbstbehalte, Broker Report", "Risiko-zu-Deckung-Mapping und Benchmark nach Umsatz/Exposure.", "Wesentliches Risiko unversichert, sehr niedrige Sublimits", "Hoch", "Vollprüfung", "Gap Cover/Neudeckung ab Closing und Kosten im Plan vorsehen.", "Integration/100-Tage-Plan", "Closing Deliverable", "S03"),
                ("Schadenhistorie", "Zeigt die Schadenhistorie wiederkehrende oder nicht gemeldete Risiken?", "Claims Runs 5 Jahre, Reserven, Ablehnungen", "Frequenz/Schwere, IBNR und Root Cause analysieren.", "Steigende Schäden, verspätete Meldung, Deckungsablehnung", "Hoch", "Vollprüfung", "Reserve/Freistellung und Präventionsprogramm umsetzen.", "SPA/Haftung", "Indemnity, Escrow", "S03"),
                ("Ausschlüsse", "Begrenzen Ausschlüsse, Sublimits oder Obliegenheiten die erwartete Deckung?", "Policenbedingungen, Endorsements, Risikoangaben", "Kritische Szenarien gegen Wortlaut und Compliance mit Obliegenheiten testen.", "Cyber/USA/Produktrückruf ausgeschlossen, falsche Risikoangabe", "Kritisch", "Vollprüfung", "Spezialdeckung beschaffen und Verkäuferfreistellung für Vorrisiken.", "SPA/Haftung", "Indemnity", "S03"),
                ("Kontrollwechsel", "Bleibt Deckung nach Signing/Closing bestehen?", "CoC-Klauseln, Brokerbestätigung, lokale Policen", "Run-off, Kündigung, Prämien und Zustimmung je Police prüfen.", "Automatisches Ende bei CoC, claims-made ohne Tail", "Kritisch", "Vollprüfung", "Tail/Run-off und neue Deckung als Closing Deliverable.", "Closing-Bedingung", "Tail Policy", "S03"),
                ("D&O/W&I", "Sind Organ- und Transaktionsrisiken angemessen über D&O/W&I strukturiert?", "D&O, W&I-Entwurf, Due-Diligence-Reports, Ausschlüsse", "Versicherungsumfang, Ausschlüsse und Knowledge Scrape abgleichen.", "Bekanntes Risiko ausgeschlossen und im SPA ungesichert", "Hoch", "Signing", "Bekannte Risiken separat freistellen; D&O-Tail und W&I-Lücken schließen.", "SPA/Haftung", "W&I, Indemnity", "S03"),
            ],
        ),
        (
            "Compliance, AML & Sanctions",
            "CMP",
            [
                ("Compliance-System", "Ist das Compliance Management System risikoadäquat und wirksam?", "Risikoanalyse, Policies, Kontrollen, Berichte, Ressourcen", "Design/Operating Effectiveness und Tone from the Top prüfen.", "Papierprogramm ohne Monitoring, Compliance berichtet an Vertrieb", "Kritisch", "Vollprüfung", "Unabhängige Remediation, klare Governance und Ressourcen festlegen.", "SPA/Haftung", "Compliance Covenant", "S03"),
                ("Anti-Korruption", "Sind Geschenke, Vermittler, Spenden und öffentliche Kontakte kontrolliert?", "Zahlungen, Drittparteien, Freigaben, Untersuchungen", "Risikobasierte Transaktions- und Drittparteien-Stichprobe.", "Erfolgsprovision an Offshore-Agent, Bargeld, fehlende Leistung", "Kritisch", "Vollprüfung", "Forensische Untersuchung, Zahlungen stoppen und Freistellung/No-go prüfen.", "Abbruch/No-go", "Indemnity, Termination Right", "S03"),
                ("AML/KYC", "Erfüllen Kunden-/Partnerprüfungen geldwäscherechtliche Anforderungen?", "KYC-Fälle, UBO, Risiko-Scoring, Monitoring, Verdachtsmeldungen", "File Testing nach Risiko; Screening- und Refresh-Logik prüfen.", "Fehlender UBO, Hochrisikokunde ohne EDD, Alert Backlog", "Kritisch", "Vollprüfung", "Backlog schließen, Kunden sperren und regulatorisches Exposure absichern.", "Abbruch/No-go", "AML Indemnity, Covenant", "S09"),
                ("Sanktionen", "Werden Kunden, Lieferanten, Eigentümer und Zahlungen wirksam gescreent?", "Screening-System, Treffer, Listen, Overrides, Zahlungsdaten", "List Coverage, Fuzzy Matching, Frequenz und Fallstichprobe.", "Geschäft mit gelisteter Partei, manuell unterdrückter Treffer", "Kritisch", "Vollprüfung", "Sofortige Sperre/Legal Review, Meldung und spezifische Freistellung.", "Abbruch/No-go", "Sanctions Indemnity", "S09"),
                ("Exportkontrolle", "Sind Güterklassifikation, Endverwendung und Genehmigungen korrekt?", "Güterlisten, ECCN/AL, End-Use, Lizenzen, Zollunterlagen", "Produkt-/Transaktionsstichprobe und Embargo-/Dual-use-Prüfung.", "Unklassifiziertes Dual-use-Produkt, fehlende Genehmigung", "Kritisch", "Vollprüfung", "Lieferstopp, Klassifizierung und Genehmigungs-/Freistellungsplan.", "Abbruch/No-go", "Export Indemnity", "S09"),
                ("Hinweisgebersystem", "Ist der Meldekanal zugänglich, vertraulich und ohne Repressalien?", "Meldekanal, Fallregister, Untersuchungsakten, Kommunikation", "Fallstichprobe auf Triage, Unabhängigkeit, Frist und Abhilfe.", "Management schließt eigenen Fall, Vergeltungsmaßnahme", "Hoch", "Vollprüfung", "Unabhängige Re-Review kritischer Fälle und Governance stärken.", "SPA/Haftung", "Covenant, Indemnity", "S12"),
                ("Drittparteien", "Werden Intermediäre, Distributoren und Hochrisikolieferanten vorab geprüft?", "Due-Diligence-Files, Verträge, Provisionen, Renewals", "Risikobasiertes File Testing und Abgleich mit Zahlungen.", "Provision ohne Vertrag/Leistung, PEP-Bezug nicht erkannt", "Kritisch", "Vollprüfung", "Beziehung pausieren, Untersuchung und Kontroll-/Vertragsremediation.", "Abbruch/No-go", "Indemnity", "S03"),
                ("Interessenkonflikte", "Sind Nebentätigkeiten, Beteiligungen und Related Parties deklariert?", "Conflict Register, jährliche Erklärungen, Vendor Master", "Erklärungen mit Eigentümer-/Lieferantendaten abgleichen.", "Manager kontrolliert Lieferanten, keine Ausschreibung", "Hoch", "Vollprüfung", "Konflikt beseitigen, Transaktionen prüfen und Rückforderung/Freistellung.", "SPA/Haftung", "Indemnity", "S03"),
                ("Untersuchungen", "Sind interne und behördliche Untersuchungen vollständig offengelegt?", "Case List, Dawn-Raid-Protokolle, Behördenkorrespondenz", "Scope, Legal Privilege, Findings, Remediation und Folgehaftung prüfen.", "Laufende unangekündigte Ermittlung, Managementbeteiligung", "Kritisch", "Vollprüfung", "Unabhängige Untersuchung und klare No-go-/Freistellungsentscheidung.", "Abbruch/No-go", "Termination Right, Indemnity", "S03"),
            ],
        ),
        (
            "Carve-out & Integration",
            "INT",
            [
                ("Abhängigkeiten", "Sind alle personellen, vertraglichen, IT- und operativen Abhängigkeiten vom Verkäufer erfasst?", "Dependency Map, Servicekatalog, Verträge, Kostenumlagen", "Bottom-up Interviews und Abgleich mit Zahlungen/Systemzugriffen.", "Nicht dokumentierter Shared Service, Schlüsselperson bleibt beim Verkäufer", "Kritisch", "Vollprüfung", "Dependency Register mit Exit-Lösung, Kosten und Owner im TSA verankern.", "Integration/100-Tage-Plan", "TSA, Holdback", "S03"),
                ("TSA-Umfang", "Deckt das TSA alle für Business Continuity erforderlichen Services ab?", "TSA-Entwurf, Service Levels, Volumen, Standorte", "Service-by-service Scope, SLA, Security, Kosten und Verantwortungen prüfen.", "Kritischer Service fehlt, Best-efforts ohne SLA", "Kritisch", "Signing", "TSA vervollständigen und messbare SLA/Remedies vereinbaren.", "Closing-Bedingung", "TSA", "S03"),
                ("TSA-Exit", "Ist der Ausstieg aus Übergangsleistungen realistisch finanziert und terminiert?", "Exit-Plan, Meilensteine, Ressourcen, Anbieterangebote", "Critical Path, Datenmigration, Tests und Parallelbetrieb challengen.", "Enddatum vor Systemmigration, keine Ressourcen/Anbieter", "Kritisch", "Signing", "Exit-Kriterien, Verlängerungsrechte und Verkäuferunterstützung vertraglich sichern.", "Integration/100-Tage-Plan", "TSA Extension, Holdback", "S03"),
                ("Stand-alone-Kosten", "Sind Kosten nach Herauslösung vollständig und ohne Verkäufer-Synergien modelliert?", "Umlagen, FTE, Lizenzen, Einkauf, Versicherung, IT", "Bottom-up Cost Build und Benchmark gegen Umlagen/Peers.", "Umlage als Stand-alone-Kosten übernommen, fehlende Corporate Functions", "Kritisch", "Vollprüfung", "Bewertung um dis-synergies/Catch-up-Kosten anpassen.", "Bewertung/Kaufpreis", "Purchase Price Adjustment", "S03"),
                ("Separation Costs", "Sind einmalige Trennungs- und Transformationskosten vollständig?", "Projektplan, Angebote, Migration, Branding, Berater", "Workstream-basierte Cost-to-Achieve-Range mit Contingency.", "Keine Datenmigration/Parallelbetrieb budgetiert", "Hoch", "Vollprüfung", "Kosten und Puffer in Finanzierung/Kaufpreis aufnehmen.", "Bewertung/Kaufpreis", "Holdback, Cost Sharing", "S03"),
                ("Day 1 Readiness", "Sind kritische Prozesse, Zugriffe, Konten und Entscheidungen für Day 1 vorbereitet?", "Day-1-Checklist, Cutover, RACI, Kommunikationsplan", "Tabletop über Order-to-Cash, Pay, Payroll, IT und Compliance.", "Kein Bankzugriff, Payroll/Versicherung nicht aktiv", "Kritisch", "Closing", "Go-live-Gates, War Room und Fallbacks mit Verantwortlichen festlegen.", "Closing-Bedingung", "Closing Deliverables", "S03"),
                ("Synergien", "Sind Umsatz- und Kostensynergien separat, realistisch und umsetzungskostenbereinigt?", "Synergy Case, Baselines, Initiativen, Owner, Costs-to-achieve", "Doppelzählungen, Timing, Churn/Dis-synergies und Confidence prüfen.", "Synergie ohne Initiative/Owner, vor Closing im Ziel-EBITDA", "Hoch", "Vollprüfung", "Synergien risikogewichten und nicht als Target-QoE behandeln.", "Bewertung/Kaufpreis", "Earn-out", "S03"),
                ("People Integration", "Sind Retention, Mitbestimmung, Kultur und Zielorganisation abgestimmt?", "Talent Map, Org Design, Retention, Kommunikations-/Konsultationsplan", "Schlüsselrollen, Doppelbesetzung, Fluktuationsrisiko und Fristen prüfen.", "Keine Führungsentscheidung, konkurrierende Retention-Angebote", "Kritisch", "Signing", "Führung/Retention vor Closing klären und sensible Kommunikation timen.", "Closing-Bedingung", "Retention, Covenant", "S03"),
                ("Integration Governance", "Gibt es klare Entscheidungsrechte, Baselines und Benefit Tracking?", "IMO-Charter, RACI, Workstreams, KPI, Risiko-/Entscheidungslog", "Governance gegen Deal Thesis und kritischen Pfad prüfen.", "Kein Baseline Owner, Entscheidungen ohne Eskalationsweg", "Hoch", "Closing", "IMO/SteerCo mit KPI, Cadence und Eskalation vor Day 1 aktivieren.", "Integration/100-Tage-Plan", "Covenant", "S03"),
            ],
        ),
    ]

    checklist: list[dict[str, str]] = []
    for area, prefix, rows in sections:
        for number, row in enumerate(rows, start=1):
            (
                subarea,
                question,
                documents,
                analysis,
                red_flags,
                priority,
                phase,
                action,
                deal_impact,
                protection,
                source,
            ) = row
            checklist.append(
                {
                    "id": f"{prefix}-{number:02d}",
                    "area": area,
                    "subarea": subarea,
                    "question": question,
                    "documents": documents,
                    "analysis": analysis,
                    "red_flags": red_flags,
                    "priority": priority,
                    "phase": phase,
                    "action": action,
                    "deal_impact": deal_impact,
                    "protection": protection,
                    "source": source,
                }
            )
    return checklist


SOURCES = [
    ("S01", "Due-Diligence-Prüfung – Überblick", "Wikipedia", "https://de.wikipedia.org/wiki/Due-Diligence-Pr%C3%BCfung", "Begriffe, Ziele und Prüfungsarten", "Sekundärquelle; fachlich verifizieren"),
    ("S02", "Due-Diligence-Prüfung", "Validatis", "https://www.validatis.de/kyc-prozess/news-fachwissen/due-diligence-pruefung/", "Ablauf und Bericht", "Praxisüberblick"),
    ("S03", "Deal Advisory / Due Diligence", "BDO Deutschland", "https://www.bdo.de/de-de/services/advisory/deal-advisory/due-diligence", "Prüfungsbereiche und Transaktionsbezug", "Praxisüberblick"),
    ("S04", "Due-Diligence-Prüfungen", "Schultze & Braun", "https://www.schultze-braun.de/leistungen/wirtschaftspruefung/due-diligence-pruefungen", "Zweck und Prüfungsfelder", "Praxisüberblick"),
    ("S05", "Due-Diligence-Ablauf", "Sattler & Partner", "https://sattlerundpartner.de/de/due-diligence-ablauf/", "Projektablauf und Phasen", "Praxisüberblick"),
    ("S06", "Datenschutz-Grundverordnung", "EUR-Lex", "https://eur-lex.europa.eu/eli/reg/2016/679/oj", "Datenschutzprüfung", "Primärrecht; aktuelle Fassung prüfen"),
    ("S07", "Cybersecurity Framework 2.0", "NIST", "https://www.nist.gov/cyberframework", "Cyber-Governance und Kontrollen", "Frei zugänglicher Standard"),
    ("S08", "IT-Grundschutz", "BSI", "https://www.bsi.bund.de/grundschutz", "IT-Sicherheitsmethodik", "Frei zugängliche Methodik"),
    ("S09", "Gesetze im Internet – GwG", "BMJ/BfJ", "https://www.gesetze-im-internet.de/gwg_2017/", "AML/KYC", "Primärquelle; aktuelle Fassung prüfen"),
    ("S10", "Transfer Pricing Guidelines", "OECD", "https://www.oecd.org/tax/transfer-pricing/oecd-transfer-pricing-guidelines-for-multinational-enterprises-and-tax-administrations-20769717.htm", "Verrechnungspreise", "Internationale Leitlinie"),
    ("S11", "Due Diligence – Grundlagen", "Buchhaltung einfach sicher", "https://www.buchhaltung-einfach-sicher.de/bwl/due-diligence", "Prüfungsbereiche", "Sekundärquelle"),
    ("S12", "Hinweisgeberschutzgesetz", "BMJ/BfJ", "https://www.gesetze-im-internet.de/hinschg/", "Hinweisgebersystem", "Primärquelle; aktuelle Fassung prüfen"),
    ("S13", "OECD Guidelines for Multinational Enterprises", "OECD", "https://mneguidelines.oecd.org/", "ESG, Menschenrechte und Lieferkette", "Internationale Leitlinie"),
    ("S14", "Corporate sustainability reporting", "Europäische Kommission", "https://finance.ec.europa.eu/capital-markets-union-and-financial-markets/company-reporting-and-auditing/company-reporting/corporate-sustainability-reporting_en", "Nachhaltigkeitsberichterstattung", "Anwendungsbereich stets aktuell prüfen"),
    ("S15", "Due Diligence – Videoeinführung", "YouTube", "https://www.youtube.com/watch?v=fP3Nzk8h5iw&t=157", "Ergänzende Einführung", "Keine Primärquelle"),
]


DEAL_MECHANISMS = [
    ("Kaufpreisanpassung", "Quantifizierbare Wertabweichung", "NWC, Net Debt, nicht nachhaltiges EBITDA, Catch-up-Capex", "Definitionen, Beispielrechnung, Accounting Principles und Streitverfahren präzise regeln.", "Bewertungsrisiko und Doppelzählung", "CFO / M&A"),
    ("Locked Box / Leakage", "Historischer Preisstichtag", "Belastbare Bilanz, stabile Entwicklung, gute Informationsrechte", "Permitted Leakage abschließend definieren; Zins und Bring-down berücksichtigen.", "Risiko nach Locked-Box-Stichtag", "Legal / Finance"),
    ("Closing Accounts", "Unsichere Closing-Bilanz", "Volatiles NWC, Refinanzierung, Carve-out", "Hierarchie der Regeln und Expert Determination festlegen.", "Streit über Bilanzierung", "Finance / Legal"),
    ("Spezifische Freistellung", "Bekanntes Einzelrisiko", "Steuerprüfung, Rechtsstreit, Umwelt, IP, Cyber", "Trigger, Laufzeit, Cap, Kontrolle des Verfahrens und Brutto-/Nettoeffekt regeln.", "Bekanntes Risiko meist aus W&I ausgeschlossen", "Legal / Tax"),
    ("Escrow / Holdback", "Unsicheres oder schwer vollstreckbares Risiko", "Offene Freistellung, TSA-Exit, Kaufpreisstreit", "Freigabemechanik, Laufzeit und Zugriff klar definieren.", "Liquiditäts-/Insolvenzrisiko Verkäufer", "Legal / Treasury"),
    ("Garantie", "Unbekanntes Risiko / Tatsachenstand", "Eigentum, Abschlüsse, Compliance, Verträge", "Knowledge, Materiality Scrape, Disclosure und Haftungsgrenzen abstimmen.", "Beweis-/Kenntnisrisiko", "Legal"),
    ("Closing-Bedingung", "Vor Vollzug zwingend zu lösendes Risiko", "Genehmigung, Consent, Refinanzierung, Lizenz, Key Person", "Objektiv messbares Deliverable und Long-stop-Folge bestimmen.", "Vollzugsrisiko", "Legal / M&A"),
    ("Covenant", "Verhalten zwischen Signing und Closing bzw. danach", "Ordinary course, Remediation, Informationspflicht", "Zustimmungsschwellen, Reporting und Rechtsfolge festlegen.", "Wertabfluss/Verhaltensrisiko", "Legal / Business"),
    ("Earn-out", "Unsicherheit der künftigen Leistung", "Kundenkonzentration, Pipeline, Wachstum, Founder Transition", "KPI manipulationsfest definieren; Governance und Accounting regeln.", "Streit und Fehlanreize", "M&A / Finance"),
    ("W&I-Versicherung", "Übertragung allgemeiner Garantiehaftung", "Breite DD und marktkonforme Garantien", "Ausschlüsse und bekannte Risiken separat absichern.", "Deckungslücken", "Legal / Insurance"),
    ("TSA", "Temporäre Verkäuferabhängigkeit", "IT, Finance, HR, Procurement, Facilities", "Servicekatalog, SLA, Security, Preis, Exit und Verlängerung regeln.", "Betriebsunterbrechung", "Integration / Legal"),
    ("Payoff & Release", "Ablösung Finanzierung/Sicherheiten", "Bankdarlehen, Pfandrechte, Garantien", "Funds Flow, Zins bis Closing und bedingungslose Freigabe koordinieren.", "Eigentums-/Finanzierungsrisiko", "Treasury / Legal"),
    ("Retention Agreement", "Abwanderungsrisiko Schlüsselpersonen", "Founder, Vertrieb, Produkt, Betrieb", "Zeitraum, Meilensteine, Good/Bad Leaver und Wettbewerbsrecht prüfen.", "Know-how-/Umsatzverlust", "HR / Business"),
    ("Preisabschlag / Risikoabschlag", "Dauerhafte niedrigere Ertragskraft", "Churn, Marge, Stand-alone-Kosten, Capex", "Nicht zugleich als Freistellung und Preisabzug doppelt zählen.", "Bewertungsrisiko", "M&A / Finance"),
    ("Abbruch / No-go", "Nicht mitigierbares oder illegales Risiko", "Sanktionen, Korruption, fehlendes Kern-IP, existenzielle Genehmigung", "Entscheidung anhand vorab definierter Kriterien und dokumentierter Evidenz.", "Reputations-/Existenzrisiko", "Investment Committee"),
]


def main() -> None:
    checklist = build_checklist()
    workbook = xlsxwriter.Workbook(OUTPUT)
    workbook.set_properties(
        {
            "title": "Due-Diligence-Arbeitsmappe",
            "subject": "Risikoorientierte Unternehmensprüfung vor Transaktionen",
            "author": "Erstellt als anpassbare Due-Diligence-Vorlage",
            "company": "Vertraulich",
            "comments": "Die Inhalte sind eine Arbeitsvorlage und ersetzen keine Rechts-, Steuer- oder Prüfungsberatung.",
        }
    )
    workbook.set_calc_mode("auto")

    colors = {
        "navy": "#17365D",
        "blue": "#1F4E78",
        "teal": "#0F6B78",
        "light_blue": "#D9EAF7",
        "light_teal": "#DDEBF7",
        "green": "#E2F0D9",
        "dark_green": "#548235",
        "yellow": "#FFF2CC",
        "orange": "#FCE4D6",
        "red": "#F4CCCC",
        "dark_red": "#C00000",
        "gray": "#E7E6E6",
        "light_gray": "#F3F4F6",
        "dark": "#1F2937",
        "white": "#FFFFFF",
        "purple": "#E4DFEC",
    }
    fmt = {
        "title": workbook.add_format({"bold": True, "font_size": 20, "font_color": colors["white"], "bg_color": colors["navy"], "align": "left", "valign": "vcenter"}),
        "subtitle": workbook.add_format({"font_size": 10, "font_color": colors["dark"], "bg_color": colors["light_blue"], "text_wrap": True, "valign": "vcenter"}),
        "section": workbook.add_format({"bold": True, "font_size": 12, "font_color": colors["white"], "bg_color": colors["blue"], "align": "left", "valign": "vcenter"}),
        "header": workbook.add_format({"bold": True, "font_color": colors["white"], "bg_color": colors["blue"], "border": 1, "align": "center", "valign": "vcenter", "text_wrap": True}),
        "label": workbook.add_format({"bold": True, "bg_color": colors["light_blue"], "border": 1, "valign": "top", "text_wrap": True}),
        "input": workbook.add_format({"bg_color": colors["yellow"], "border": 1, "valign": "top", "text_wrap": True}),
        "input_num": workbook.add_format({"bg_color": colors["yellow"], "border": 1, "num_format": '#,##0.00;[Red]-#,##0.00', "valign": "top"}),
        "input_int": workbook.add_format({"bg_color": colors["yellow"], "border": 1, "num_format": "0", "valign": "top"}),
        "input_date": workbook.add_format({"bg_color": colors["yellow"], "border": 1, "num_format": "dd.mm.yyyy", "valign": "top"}),
        "text": workbook.add_format({"border": 1, "valign": "top", "text_wrap": True}),
        "text_gray": workbook.add_format({"border": 1, "valign": "top", "text_wrap": True, "bg_color": colors["light_gray"]}),
        "formula": workbook.add_format({"bg_color": colors["light_blue"], "border": 1, "num_format": '#,##0.00;[Red]-#,##0.00', "valign": "top"}),
        "formula_int": workbook.add_format({"bg_color": colors["light_blue"], "border": 1, "num_format": "0", "valign": "top"}),
        "formula_pct": workbook.add_format({"bg_color": colors["light_blue"], "border": 1, "num_format": "0.0%", "valign": "top"}),
        "money": workbook.add_format({"border": 1, "num_format": '#,##0;[Red]-#,##0', "valign": "top"}),
        "money_input": workbook.add_format({"bg_color": colors["yellow"], "border": 1, "num_format": '#,##0;[Red]-#,##0', "valign": "top"}),
        "pct_input": workbook.add_format({"bg_color": colors["yellow"], "border": 1, "num_format": "0.0%", "valign": "top"}),
        "date": workbook.add_format({"border": 1, "num_format": "dd.mm.yyyy", "valign": "top"}),
        "note": workbook.add_format({"font_color": "#595959", "italic": True, "text_wrap": True, "valign": "top"}),
        "warning": workbook.add_format({"font_color": colors["dark_red"], "bg_color": colors["red"], "bold": True, "border": 1, "text_wrap": True}),
        "good": workbook.add_format({"font_color": "#006100", "bg_color": "#C6EFCE", "border": 1, "text_wrap": True}),
        "link": workbook.add_format({"font_color": "#0563C1", "underline": True, "border": 1, "valign": "top", "text_wrap": True}),
        "kpi_label": workbook.add_format({"bold": True, "font_color": colors["white"], "bg_color": colors["teal"], "align": "center", "valign": "vcenter", "border": 1, "text_wrap": True}),
        "kpi_value": workbook.add_format({"bold": True, "font_size": 18, "font_color": colors["navy"], "bg_color": colors["light_teal"], "align": "center", "valign": "vcenter", "border": 1}),
        "kpi_pct": workbook.add_format({"bold": True, "font_size": 18, "font_color": colors["navy"], "bg_color": colors["light_teal"], "align": "center", "valign": "vcenter", "border": 1, "num_format": "0.0%"}),
        "kpi_money": workbook.add_format({"bold": True, "font_size": 16, "font_color": colors["navy"], "bg_color": colors["light_teal"], "align": "center", "valign": "vcenter", "border": 1, "num_format": '#,##0" €";[Red]-#,##0" €"'}),
    }

    help_registry: list[dict[str, str]] = []

    def field_guidance(header: str) -> dict[str, str]:
        """Return consistent, context-sensitive guidance for a workbook field."""
        h = header.casefold()
        guidance = {
            "mode": "Eingabe",
            "required": "Wenn relevant",
            "entry": f"Den für „{header}“ zutreffenden, belegbaren Wert eintragen.",
            "example": "Konkreter Wert oder kurzer, eindeutiger Text",
            "format": "Text",
            "source": "Primärbeleg bzw. freigegebene Projektdaten",
            "quality": "Keine unbelegten Annahmen; Quelle oder Referenz ergänzen.",
        }
        if h == "id" or h.endswith("-id") or h in {"dok-id", "risiko-id", "maßnahmen-id", "q&a-id", "vertrags-id", "adj.-id"}:
            guidance.update(mode="Vorbelegt", required="Automatisch", entry="Eindeutige Kennung beibehalten; nur beim Ergänzen neuer Zeilen fortlaufend vergeben.", example="R-014", format="Text, eindeutig", source="Arbeitsmappe", quality="Keine ID doppelt vergeben oder nachträglich umnummerieren.")
        elif "ref." in h or "referenz" in h or h.endswith("-ref"):
            guidance.update(required="Empfohlen", entry="Verknüpfte Checklisten-, Risiko-, Dokument- oder Q&A-ID eintragen.", example="FIN-04 / DOC-037 / Q-012", format="Eine oder mehrere IDs", source="Andere Register dieser Arbeitsmappe", quality="Nur vorhandene IDs verwenden; mehrere Referenzen mit „ / “ trennen.")
        elif any(term in h for term in ("prüfbereich", "unterbereich", "thema", "kategorie", "vertragstyp", "komponente")):
            guidance.update(required="Pflicht", entry="Sachverhalt einer eindeutigen Kategorie zuordnen.", example="Financial – Working Capital", format="Auswahl oder kurzer Text", source="DD-Scope / Master-Checkliste", quality="Nicht mehrere unverbundene Themen in einer Zeile mischen.")
        elif any(term in h for term in ("prüfziel", "prüffrage", "frage")):
            guidance.update(required="Pflicht", entry="Eine konkret beantwortbare Frage mit klarem Entscheidungsbezug formulieren.", example="Sind alle debt-like Positionen im Closing-Mechanismus erfasst?", format="Vollständiger Fragesatz", source="Prüfhypothese / offene Entscheidung", quality="Keine Suggestiv- oder Sammelfrage; pro Zeile ein Sachverhalt.")
        elif any(term in h for term in ("unterlage", "evidenz", "nachweis")):
            guidance.update(required="Pflicht bei Abschluss", entry="Konkreten Beleg mit Dateiname, Datum, Version und VDR-Pfad nennen.", example="VDR 3.2.1, Monatsbilanz 08/2026, Version final", format="Text / Link / Referenz", source="VDR, Vertrag, Hauptbuch, externe Bestätigung", quality="Management-Aussage allein reicht für wesentliche Findings nicht aus.")
        elif any(term in h for term in ("analyse", "test")):
            guidance.update(required="Pflicht bei Bearbeitung", entry="Durchgeführten Test inklusive Zeitraum, Population, Stichprobe und Ergebnis beschreiben.", example="24 Monatsabschlüsse übergeleitet; 15 Cut-off-Belege geprüft; 2 Abweichungen", format="Kurze Methodik + Ergebnis", source="Arbeitspapiere / Datenanalyse", quality="Nicht nur „geprüft“ schreiben; Umfang und Ergebnis nachvollziehbar machen.")
        elif "red flag" in h or "hypothese" in h or "szenario" in h:
            guidance.update(mode="Vorbelegt / anpassen", required="Empfohlen", entry="Mögliches Risikoszenario neutral beschreiben; noch nicht als Tatsache darstellen.", example="Stichtagssteuerung des NWC durch verzögerte Lieferantenzahlungen", format="Wenn–dann-Szenario", source="Prüfplanung / erste Indikatoren", quality="Hypothese und bestätigtes Finding sprachlich klar trennen.")
        elif "priorität" in h or h == "kritikalität":
            guidance.update(required="Pflicht", entry="Priorität nach Deal-Relevanz und zeitlicher Dringlichkeit auswählen.", example="Kritisch", format="Dropdown", source="Materialität / kritischer Transaktionspfad", quality="Nicht allein nach Arbeitsaufwand priorisieren.")
        elif h == "phase":
            guidance.update(required="Pflicht", entry="Zeitpunkt angeben, zu dem Prüfung oder Maßnahme abgeschlossen sein muss.", example="Vollprüfung", format="Dropdown bzw. definierte Deal-Phase", source="Transaktionszeitplan", quality="Closing-kritische Themen nicht in Post-Closing verschieben.")
        elif "status" in h:
            guidance.update(required="Pflicht", entry="Nur den tatsächlich erreichten Bearbeitungsstand auswählen.", example="In Prüfung", format="Dropdown", source="Aktueller Arbeitsstand", quality="„Abgeschlossen“ erst bei dokumentierter Evidenz und Reviewer-Freigabe.")
        elif any(term in h for term in ("owner", "verantwortlich", "empfänger", "fragesteller", "reviewer", "support", "federführung")):
            guidance.update(required="Pflicht für aktive Punkte", entry="Namentlich verantwortliche Person oder eindeutige Rolle eintragen.", example="Anna Beispiel (CFO) / Tax Lead", format="Name und Rolle", source="Projekt-RACI", quality="Keine Mehrfach-Owner; genau eine rechenschaftspflichtige Rolle festlegen.")
        elif any(term in h for term in ("fällig", "erstellt am", "antwort am", "erhalten am", "angefordert am", "beginn", "ende", "start", "aktualisierung", "abrufdatum")):
            guidance.update(required="Pflicht, sobald terminiert", entry="Kalenderdatum im Format TT.MM.JJJJ eintragen.", example="31.10.2026", format="Datum", source="Projektplan / Dokumentenmetadaten", quality="Keine relativen Angaben wie „nächste Woche“.")
        elif "eintritt" in h and "rest" not in h:
            guidance.update(required="Pflicht bei Finding", entry="Eintrittswahrscheinlichkeit anhand der Skala 1–5 und belegter Indikatoren bewerten.", example="4 – wahrscheinlich", format="Ganzzahl 1–5", source="Evidenz und Szenarioanalyse", quality="Bewertung im Finding-Kommentar begründen; nicht mit Auswirkung vermischen.")
        elif "auswirkung" in h and "rest" not in h:
            guidance.update(required="Pflicht bei Finding", entry="Maximal plausible Deal-/Wertauswirkung anhand der Skala 1–5 bewerten.", example="3 – wesentlich", format="Ganzzahl 1–5", source="Exposure- und Szenarioanalyse", quality="Auswirkung brutto vor Maßnahmen bewerten.")
        elif "resteintritt" in h or "restauswirkung" in h:
            guidance.update(required="Nach definierter Maßnahme", entry="Verbleibendes Risiko nach vollständig wirksamer Gegenmaßnahme mit 1–5 bewerten.", example="2", format="Ganzzahl 1–5", source="Maßnahmenwirksamkeit / Kontrolltest", quality="Nur reduzieren, wenn Umsetzung und Wirksamkeit nachgewiesen sind.")
        elif any(term in h for term in ("risikoscore", "restscore", "klasse", "alter (tage)", "überfällig?")):
            guidance.update(mode="Automatische Formel", required="Automatisch", entry="Nicht überschreiben; Wert wird aus den Eingaben berechnet.", example="12 / Hoch", format="Formel", source="Verknüpfte Eingabezellen", quality="Bei leerem Ergebnis zuerst die erforderlichen Eingabefelder vervollständigen.")
        elif "feststellung" in h or h == "risiko" or "ergebnis" in h and "abnahmekriterium" not in h:
            guidance.update(required="Pflicht bei Abweichung", entry="Fakt, Ursache, Umfang und Geschäftsauswirkung klar von Annahmen trennen.", example="7 von 40 Stichproben ohne Genehmigung; Exposure Base 180 T€", format="Sachverhalt + Quantifizierung", source="Primärevidenz und Analyse", quality="Keine Wertung ohne Fakten; Gegenbelege und Einschränkungen nennen.")
        elif "maßnahme" in h or "next step" in h:
            guidance.update(required="Pflicht bei relevantem Finding", entry="Konkrete, ausführbare Handlung mit Zielzustand formulieren.", example="MFA für alle privilegierten Konten vor Closing aktivieren und testen.", format="Verb + Objekt + Zieltermin", source="Finding / Risikobehandlung", quality="Keine unspezifischen Formulierungen wie „prüfen“ oder „beobachten“.")
        elif "abnahmekriterium" in h:
            guidance.update(required="Pflicht für aktive Maßnahme", entry="Objektiv messbaren Zielzustand und benötigten Nachweis definieren.", example="100 % Admin-Konten mit MFA; Export aus IdP durch CISO freigegeben", format="Messbares Kriterium", source="Maßnahmenplan / Fachstandard", quality="Kriterium muss eine eindeutige Erledigt-Entscheidung erlauben.")
        elif "deal-implikation" in h or "transaktionsfolge" in h or "erwartete wirkung" in h:
            guidance.update(required="Pflicht bei wesentlichem Finding", entry="Konsequenz für Preis, SPA, Closing, Finanzierung oder Integration auswählen/beschreiben.", example="SPA/Haftung – spezifische Steuerfreistellung", format="Kategorie + kurze Begründung", source="Finding und Deal-Team-Entscheidung", quality="Operative Maßnahme und vertraglichen Schutz getrennt betrachten.")
        elif any(term in h for term in ("kaufpreiseffekt", "exposure", "budget", "jahreswert", "betrag (€)", "management-betrag", "dd-vorschlag", "akzeptierter betrag")):
            guidance.update(required="Wenn quantifizierbar", entry="Betrag in Berichtswährung ohne Tausendertext eintragen; Vorzeichenlogik des Blatts beachten.", example="250000", format="Zahl in EUR", source="Berechnung / Vertrag / Hauptbuch", quality="Low/Base/High dokumentieren; Steuern, Wahrscheinlichkeit und Doppelzählung prüfen.")
        elif "schutzmechanismus" in h or "deal-mechanismus" in h or "spa-behandlung" in h:
            guidance.update(required="Bei Deal-Relevanz", entry="Geeigneten vertraglichen oder wirtschaftlichen Mechanismus konkret benennen.", example="Spezifische Freistellung mit 5 Jahren Laufzeit und 500 T€ Escrow", format="Mechanismus + Eckpunkte", source="Deal-Team / Rechts- und Steuerberatung", quality="Bekannte Risiken nicht allein auf allgemeine Garantien oder W&I stützen.")
        elif any(term in h for term in ("vdr-pfad", "vdr-link", "quelle / ref", "quelle", "link")):
            guidance.update(required="Empfohlen, bei Finding Pflicht", entry="Nachvollziehbare Fundstelle oder klickbaren Link mit Version angeben.", example="VDR 4.1.3 / Vertrag Kunde A vom 12.03.2024", format="Pfad, ID oder URL", source="VDR / Arbeitsmappe / externe Primärquelle", quality="Keine privaten lokalen Pfade; Zugriff und Version müssen reproduzierbar sein.")
        elif "vollständigkeit" in h:
            guidance.update(required="Pflicht nach Erstprüfung", entry="Qualität des erhaltenen Pakets auswählen.", example="Plausibel", format="Dropdown", source="Abgleich mit Request und Inhaltsprüfung", quality="„Vollständig“ bzw. „verifiziert“ nur nach nachvollziehbarem Abgleich.")
        elif "vertraulichkeit" in h:
            guidance.update(required="Pflicht", entry="Höchste im Datensatz enthaltene Schutzklasse auswählen.", example="Clean Team", format="Dropdown", source="NDA / Informationsklassifizierung", quality="HR-, Gesundheits-, Wettbewerbs- und Kundendaten besonders schützen.")
        elif h in {"pflicht?", "aktivieren?", "einbeziehen?", "consent nötig?", "wiederkehrend?"}:
            guidance.update(required="Pflicht", entry="Ja, Nein oder Zu prüfen anhand der dokumentierten Entscheidung auswählen.", example="Zu prüfen", format="Dropdown", source="Scope-/Finding-Entscheidung", quality="„Zu prüfen“ mit Owner und Fälligkeit versehen.")
        elif "fortschritt" in h:
            guidance.update(required="Bei aktiver Maßnahme", entry="Tatsächlich erreichten Fertigstellungsgrad zwischen 0 % und 100 % eintragen.", example="40 %", format="Prozent", source="Liefergegenstände / Meilensteine", quality="100 % nur bei erfülltem Abnahmekriterium.")
        elif any(term in h for term in ("kommentar", "entscheidung")):
            guidance.update(required="Bei Abweichung/Entscheidung", entry="Entscheidung, Begründung, Annahmen und offene Einschränkungen knapp dokumentieren.", example="IC akzeptiert Restrisiko unter Bedingung eines 300 T€ Escrows.", format="Kurzer Audit-Trail", source="Meeting-/Entscheidungsprotokoll", quality="Datum und Entscheider nennen; keine vertraulichen Nebendaten kopieren.")
        elif "vertraulich" in h:
            guidance.update(required="Pflicht", entry="Informationsschutz gemäß NDA und Clean-Team-Regeln festlegen.", example="Streng vertraulich", format="Auswahl", source="NDA / Legal", quality="Im Zweifel die höhere Schutzstufe verwenden.")
        return guidance

    def register_field_help(ws, row: int, col: int, header: str, override: dict[str, str] | None = None) -> None:
        guidance = field_guidance(header)
        if override:
            guidance.update(override)
        sheet_name = ws.get_name()
        help_registry.append({"sheet": sheet_name, "field": header, **guidance})
        comment = (
            f"AUSFÜLLHILFE – {header}\n\n"
            f"Was eintragen: {guidance['entry']}\n"
            f"Beispiel: {guidance['example']}\n"
            f"Bearbeitung: {guidance['mode']} | Pflichtgrad: {guidance['required']}\n"
            f"Format: {guidance['format']}\n"
            f"Quelle/Nachweis: {guidance['source']}\n"
            f"Qualitätsregel: {guidance['quality']}"
        )
        ws.write_comment(row, col, comment, {"author": "Ausfüllhilfe", "width": 360, "height": 220})

    def input_hint(title: str, message: str, **options) -> dict:
        """Add an Excel input message to an existing data-validation rule."""
        return {
            **options,
            "input_title": title[:32],
            "input_message": message[:255],
            "show_input": True,
            "show_error": True,
            "error_title": "Eingabe prüfen",
            "error_message": "Bitte die vorgegebene Auswahl bzw. das geforderte Format verwenden.",
        }

    def banner(ws, title: str, subtitle: str, last_col: int) -> None:
        ws.merge_range(0, 0, 0, last_col, title, fmt["title"])
        ws.merge_range(1, 0, 1, last_col, subtitle, fmt["subtitle"])
        ws.set_row(0, 30)
        ws.set_row(1, 34)
        ws.set_tab_color(colors["blue"])
        ws.hide_gridlines(2)

    def add_table(ws, header_row: int, last_row: int, headers: list[str], name: str, first_col: int = 0, style: str = "Table Style Medium 2") -> None:
        ws.add_table(
            header_row,
            first_col,
            last_row,
            first_col + len(headers) - 1,
            {
                "name": name,
                "style": style,
                "columns": [{"header": header} for header in headers],
                "autofilter": True,
            },
        )
        ws.set_row(header_row, 42)
        for offset, header in enumerate(headers):
            register_field_help(ws, header_row, first_col + offset, header)

    def conditional_status(ws, cell_range: str) -> None:
        for value, bg, font in [
            ("Abgeschlossen", "#C6EFCE", "#006100"),
            ("Vollständig", "#C6EFCE", "#006100"),
            ("Erledigt", "#C6EFCE", "#006100"),
            ("Blockiert", "#FFC7CE", "#9C0006"),
            ("Kritisch", "#FFC7CE", "#9C0006"),
            ("Überfällig", "#FFC7CE", "#9C0006"),
            ("In Prüfung", "#FFEB9C", "#9C6500"),
            ("In Arbeit", "#FFEB9C", "#9C6500"),
        ]:
            ws.conditional_format(cell_range, {"type": "text", "criteria": "containing", "value": value, "format": workbook.add_format({"bg_color": bg, "font_color": font})})

    # Hidden validation lists.
    lists = workbook.add_worksheet("_Listen")
    validation_lists = {
        "Pruefstatus": ["Nicht begonnen", "In Prüfung", "Rückfrage", "Blockiert", "Abgeschlossen", "Nicht anwendbar"],
        "Prioritaet": ["Kritisch", "Hoch", "Mittel", "Niedrig"],
        "Phase": ["Screening", "Vollprüfung", "Signing", "Closing", "Post-Closing"],
        "JaNeinPruefen": ["Ja", "Nein", "Zu prüfen"],
        "DokStatus": ["Nicht angefordert", "Angefordert", "Teilweise", "Vollständig", "Nicht verfügbar", "Nicht anwendbar"],
        "Vollstaendigkeit": ["Ungeprüft", "Unvollständig", "Plausibel", "Verifiziert"],
        "RisikoStatus": ["Zu verifizieren", "Bestätigt", "Entkräftet", "Mitigiert", "Akzeptiert"],
        "MassStatus": ["Nicht gestartet", "In Arbeit", "Blockiert", "Erledigt", "Verworfen"],
        "QAStatus": ["Entwurf", "Gesendet", "Teilbeantwortet", "Beantwortet", "Nachfrage", "Geschlossen"],
        "Vertraulichkeit": ["Normal", "Vertraulich", "Streng vertraulich", "Clean Team"],
        "Transaktionstyp": ["Share Deal", "Asset Deal", "Beteiligung", "Carve-out", "IPO", "Refinanzierung", "Sonstige"],
        "DealImpact": ["Bewertung/Kaufpreis", "SPA/Haftung", "Closing-Bedingung", "Finanzierung", "Integration/100-Tage-Plan", "Abbruch/No-go", "Kein direkter", "Zu prüfen"],
        "Reifegrad": ["0 – Nicht vorhanden", "1 – Ad hoc", "2 – Definiert", "3 – Implementiert", "4 – Gemessen/optimiert"],
        "Vertragstyp": ["Kunde", "Lieferant", "Finanzierung", "Miete", "Lizenz", "IT/Cloud", "Distribution", "Kooperation/JV", "Versicherung", "Sonstige"],
    }
    for col, (name, values) in enumerate(validation_lists.items()):
        lists.write(0, col, name)
        for row, value in enumerate(values, start=1):
            lists.write(row, col, value)
        col_letter = xlsxwriter.utility.xl_col_to_name(col)
        workbook.define_name(name, f"='_Listen'!${col_letter}$2:${col_letter}${len(values)+1}")
    lists.hide()

    # 00 Start
    ws = workbook.add_worksheet("00_Start")
    # Create guidance and dashboard early so the visible tab order is intuitive.
    # Their content is populated after the dependent sheets have been defined.
    ws_help = workbook.add_worksheet("00_Ausfüllhilfe")
    ws_dash = workbook.add_worksheet("01_Dashboard")
    banner(ws, "Due-Diligence-Arbeitsmappe", "Branchenneutrale, risikoorientierte Arbeitsvorlage. Gelbe Zellen sind Eingaben, blaue Zellen enthalten Formeln. Alle Vorschläge sind auf den konkreten Deal anzupassen.", 7)
    ws.set_column("A:A", 30)
    ws.set_column("B:B", 34)
    ws.set_column("C:H", 18)
    ws.merge_range("A4:H4", "Projektparameter", fmt["section"])
    project_fields = [
        ("Zielunternehmen", ""),
        ("Transaktionstyp", "Share Deal"),
        ("Käufer / Investor", ""),
        ("DD-Stichtag", ""),
        ("Projektleitung", ""),
        ("Version", "1.0"),
        ("Vertraulichkeit", "Streng vertraulich"),
        ("Berichtswährung", "EUR"),
        ("Materialitätsschwelle (€)", ""),
    ]
    project_help = {
        "Zielunternehmen": {"required": "Pflicht", "entry": "Vollständige rechtliche Firma des Prüfungsobjekts eintragen.", "example": "Muster GmbH", "source": "Handelsregister / Term Sheet", "quality": "Bei Carve-outs den exakten Perimeter ergänzen."},
        "Transaktionstyp": {"required": "Pflicht", "entry": "Geplante rechtliche bzw. wirtschaftliche Transaktionsform auswählen.", "example": "Share Deal", "format": "Dropdown", "source": "Term Sheet / Strukturmemorandum", "quality": "Bei Mischformen die primäre Struktur auswählen und Details kommentieren."},
        "Käufer / Investor": {"required": "Pflicht", "entry": "Erwerbende Gesellschaft bzw. Investorengruppe nennen.", "example": "Investor Holding GmbH", "source": "Term Sheet", "quality": "Nicht nur den Projektnamen verwenden."},
        "DD-Stichtag": {"required": "Pflicht", "entry": "Informations- bzw. Bewertungsstichtag der Prüfung eintragen.", "example": "30.09.2026", "format": "Datum TT.MM.JJJJ", "source": "Projektauftrag", "quality": "Nicht mit Signing- oder Closing-Datum verwechseln."},
        "Projektleitung": {"required": "Pflicht", "entry": "Gesamtverantwortliche Person mit Rolle nennen.", "example": "Max Beispiel, M&A Director", "source": "Projekt-RACI", "quality": "Genau eine Gesamtverantwortung festlegen."},
        "Version": {"required": "Pflicht", "entry": "Freigabestand der Arbeitsmappe führen.", "example": "1.1", "format": "Versionsnummer", "source": "Dokumentenlenkung", "quality": "Bei materiellen Änderungen Version erhöhen."},
        "Vertraulichkeit": {"required": "Pflicht", "entry": "Höchste Schutzstufe für die gesamte Arbeitsmappe auswählen.", "example": "Streng vertraulich", "format": "Dropdown", "source": "NDA / Clean-Team-Regeln", "quality": "Einzelblätter können eine höhere Schutzstufe benötigen."},
        "Berichtswährung": {"required": "Pflicht", "entry": "Einheitliche Währung für alle monetären Eingaben festlegen.", "example": "EUR", "format": "ISO-Währungscode", "source": "Investment Case", "quality": "Fremdwährungsumrechnung und Stichtagskurs separat dokumentieren."},
        "Materialitätsschwelle (€)": {"required": "Pflicht", "entry": "Vom Deal-Team genehmigte quantitative Basisschwelle eintragen.", "example": "100000", "format": "Betrag in Berichtswährung", "source": "DD-Scope / Risikotoleranz", "quality": "Qualitative No-go-Themen bleiben unabhängig vom Betrag wesentlich."},
    }
    for row, (label, value) in enumerate(project_fields, start=4):
        ws.write(row, 0, label, fmt["label"])
        if label == "DD-Stichtag":
            ws.write_blank(row, 1, None, fmt["input_date"])
        elif label == "Materialitätsschwelle (€)":
            ws.write_blank(row, 1, None, fmt["money_input"])
        else:
            ws.write(row, 1, value, fmt["input"])
        register_field_help(ws, row, 1, label, project_help[label])
    ws.data_validation("B5", input_hint("Zielunternehmen", "Vollständige rechtliche Firma bzw. exakten Carve-out-Perimeter eintragen.", validate="any"))
    ws.data_validation("B6", input_hint("Transaktionstyp", "Transaktionsform aus der Liste wählen.", validate="list", source="=Transaktionstyp"))
    ws.data_validation("B7", input_hint("Käufer / Investor", "Rechtliche Firma oder eindeutig benannte Investorengruppe eintragen.", validate="any"))
    ws.data_validation("B8", input_hint("DD-Stichtag", "Informations-/Bewertungsstichtag im Format TT.MM.JJJJ.", validate="date", criteria="between", minimum=date(2000, 1, 1), maximum=date(2100, 12, 31)))
    ws.data_validation("B9", input_hint("Projektleitung", "Eine gesamtverantwortliche Person mit Rolle nennen.", validate="any"))
    ws.data_validation("B10", input_hint("Version", "Freigabestand, z. B. 1.1.", validate="any"))
    ws.data_validation("B11", input_hint("Vertraulichkeit", "Schutzstufe gemäß NDA/Clean-Team-Regeln wählen.", validate="list", source="=Vertraulichkeit"))
    ws.data_validation("B12", input_hint("Berichtswährung", "ISO-Währungscode, z. B. EUR, USD oder GBP.", validate="any"))
    ws.data_validation("B13", input_hint("Materialität", "Genehmigte quantitative Basisschwelle als Zahl ohne Währungszeichen.", validate="decimal", criteria=">=", value=0))
    workbook.define_name("Zielunternehmen", "='00_Start'!$B$5")
    workbook.define_name("Transaktionstyp_Auswahl", "='00_Start'!$B$6")
    workbook.define_name("DD_Stichtag", "='00_Start'!$B$8")
    workbook.define_name("Berichtswahrung", "='00_Start'!$B$12")
    ws.merge_range("D5:H5", "Empfohlener Ablauf", fmt["section"])
    workflow = [
        ("1. Scope & Hypothesen", "Perimeter, Materialität, No-go-Kriterien und Workstreams freigeben."),
        ("2. Datenraum & Q&A", "Dokumente anfordern, Versionen kontrollieren, Lücken und Widersprüche eskalieren."),
        ("3. Analyse & Triangulation", "Management-Daten mit Verträgen, Hauptbuch, externen Quellen und Stichproben belegen."),
        ("4. Findings & Quantifizierung", "Sachverhalt, Evidenz, Ursache, Eintritt, Auswirkung und Exposure trennen."),
        ("5. Deal-Entscheidung", "Preis, SPA-Schutz, Closing-Bedingungen, Finanzierung und No-go bewerten."),
        ("6. Maßnahmen & Übergabe", "Owner, Frist, Budget, KPI sowie Day-1-/100-Tage-Plan festlegen."),
    ]
    for row, (step, detail) in enumerate(workflow, start=5):
        ws.write(row, 3, step, fmt["label"])
        ws.merge_range(row, 4, row, 7, detail, fmt["text"])
        ws.set_row(row, 32)
    ws.merge_range("A15:H15", "Risiko-Scoring", fmt["section"])
    ws.write_row("A16", ["Wert", "Eintrittswahrscheinlichkeit", "Auswirkung", "Orientierung"], fmt["header"])
    scoring = [
        (1, "Sehr gering", "Unwesentlich", "Kein relevanter Einfluss; normale Steuerung"),
        (2, "Gering", "Begrenzt", "Unter Materialität; lokale Korrektur"),
        (3, "Möglich", "Wesentlich", "Management Attention; quantifizieren"),
        (4, "Wahrscheinlich", "Schwerwiegend", "Deal-/SPA-relevant; IC-Eskalation"),
        (5, "Sehr wahrscheinlich", "Existenz-/Deal-kritisch", "No-go oder zwingende Vorbedingung"),
    ]
    for row, values in enumerate(scoring, start=16):
        ws.write_row(row, 0, values, fmt["text"])
    ws.merge_range("E16:H16", "Risikoklasse = Eintritt × Auswirkung", fmt["header"])
    risk_bands = [
        ("1–4", "Niedrig", "Dokumentieren / regulär überwachen", colors["green"]),
        ("5–9", "Mittel", "Maßnahme mit Owner und Frist", colors["yellow"]),
        ("10–16", "Hoch", "Quantifizieren und Deal-Schutz entscheiden", colors["orange"]),
        ("17–25", "Kritisch", "Sofort eskalieren; No-go/CP/Freistellung prüfen", colors["red"]),
    ]
    for row, (score, level, response, color) in enumerate(risk_bands, start=17):
        ws.write(row, 4, score, workbook.add_format({"border": 1, "bg_color": color, "bold": True}))
        ws.write(row, 5, level, workbook.add_format({"border": 1, "bg_color": color, "bold": True}))
        ws.merge_range(row, 6, row, 7, response, workbook.add_format({"border": 1, "bg_color": color, "text_wrap": True}))
    ws.merge_range("A23:H23", "Nutzungshinweise", fmt["section"])
    notes = [
        "Prüfpunkte sind Hypothesen und keine Feststellungen. Findings erst nach belegbarer Evidenz eintragen.",
        "Risikoscore nicht ausfüllen, bevor Eintritt und Auswirkung begründet sind. Exposure (Low/Base/High) separat quantifizieren.",
        "Kaufpreisanpassung, Freistellung und operative Maßnahme dürfen dasselbe Risiko nicht unbemerkt doppelt erfassen.",
        "Personenbezogene Daten minimieren; sensible HR-, Gesundheits- und Kundendaten nur über geeignete Clean-Team-Prozesse verarbeiten.",
        "Die Vorlage ersetzt keine Rechts-, Steuer-, Wirtschaftsprüfungs-, Cyber- oder Umweltberatung. Rechtslage und Standards zum Transaktionszeitpunkt prüfen.",
    ]
    for row, text in enumerate(notes, start=23):
        ws.merge_range(row, 0, row, 7, f"• {text}", fmt["text"])
        ws.set_row(row, 30)
    ws.freeze_panes(4, 0)

    # 02 checklist is built before dashboard to establish ranges.
    ws_check = workbook.add_worksheet("02_Checkliste")
    check_headers = [
        "ID", "Prüfbereich", "Unterbereich", "Prüfziel / Prüffrage", "Benötigte Unterlagen / Daten",
        "Empfohlene Analyse", "Typische Red Flags", "Priorität", "Phase", "Status",
        "Verantwortlich", "Fälligkeit", "Eintritt (1–5)", "Auswirkung (1–5)", "Risikoscore",
        "Risikoklasse", "Feststellung / Evidenz", "Maßnahmenvorschlag", "Deal-Implikation",
        "Kaufpreiseffekt (€)", "SPA-/Schutzmechanismus", "Dokument-/Q&A-Referenz",
        "Quelle", "Letzte Aktualisierung", "Reviewer",
    ]
    banner(ws_check, "Master-Checkliste", f"{len(checklist)} risikoorientierte Prüfpunkte. Vorschläge sind Hypothesen; tatsächliche Feststellungen benötigen Evidenz.", len(check_headers) - 1)
    check_header_row = 3
    check_first_row = 4
    for idx, item in enumerate(checklist):
        row = check_first_row + idx
        values = [
            item["id"], item["area"], item["subarea"], item["question"], item["documents"],
            item["analysis"], item["red_flags"], item["priority"], item["phase"], "Nicht begonnen",
            "", "", "", "", "", "", "", item["action"], item["deal_impact"], "",
            item["protection"], "", item["source"], "", "",
        ]
        for col, value in enumerate(values):
            if col == 11 or col == 23:
                ws_check.write_blank(row, col, None, fmt["input_date"])
            elif col in (12, 13):
                ws_check.write_blank(row, col, None, fmt["input_int"])
            elif col == 19:
                ws_check.write_blank(row, col, None, fmt["money_input"])
            elif col in (10, 16, 21, 24):
                ws_check.write(row, col, value, fmt["input"])
            elif col in (14, 15):
                continue
            else:
                ws_check.write(row, col, value, fmt["text"])
        excel_row = row + 1
        ws_check.write_formula(row, 14, f'=IF(OR(M{excel_row}="",N{excel_row}=""),"",M{excel_row}*N{excel_row})', fmt["formula_int"], "")
        ws_check.write_formula(row, 15, f'=IF(O{excel_row}="","",IF(O{excel_row}>=17,"Kritisch",IF(O{excel_row}>=10,"Hoch",IF(O{excel_row}>=5,"Mittel","Niedrig"))))', fmt["formula"], "")
    check_last_row = check_first_row + len(checklist) - 1
    add_table(ws_check, check_header_row, check_last_row, check_headers, "tblCheckliste")
    widths = [12, 24, 22, 42, 40, 42, 38, 11, 14, 16, 18, 12, 11, 12, 11, 13, 40, 42, 22, 16, 28, 24, 10, 14, 18]
    for col, width in enumerate(widths):
        ws_check.set_column(col, col, width)
    ws_check.freeze_panes(check_first_row, 3)
    ws_check.set_default_row(66)
    ws_check.data_validation(check_first_row, 7, check_last_row, 7, input_hint("Priorität", "Deal-Relevanz und Dringlichkeit auswählen; kritisch = sofort eskalieren.", validate="list", source="=Prioritaet"))
    ws_check.data_validation(check_first_row, 8, check_last_row, 8, input_hint("Phase", "Phase wählen, bis zu der der Punkt geklärt sein muss.", validate="list", source="=Phase"))
    ws_check.data_validation(check_first_row, 9, check_last_row, 9, input_hint("Prüfstatus", "Nur bei ausreichender Evidenz auf „Abgeschlossen“ setzen.", validate="list", source="=Pruefstatus"))
    ws_check.data_validation(check_first_row, 10, check_last_row, 10, input_hint("Verantwortlich", "Eine Person oder eindeutig verantwortliche Rolle eintragen.", validate="any"))
    ws_check.data_validation(check_first_row, 11, check_last_row, 11, input_hint("Fälligkeit", "Verbindliches Datum im Format TT.MM.JJJJ.", validate="date", criteria="between", minimum=date(2000, 1, 1), maximum=date(2100, 12, 31)))
    ws_check.data_validation(check_first_row, 12, check_last_row, 13, input_hint("Risiko 1–5", "Eintritt und Auswirkung getrennt bewerten; Definitionen siehe 00_Start.", validate="integer", criteria="between", minimum=1, maximum=5))
    ws_check.data_validation(check_first_row, 16, check_last_row, 16, input_hint("Finding / Evidenz", "Fakt, Ursache, Umfang, Auswirkung sowie konkrete Belegreferenz dokumentieren.", validate="any"))
    ws_check.data_validation(check_first_row, 18, check_last_row, 18, input_hint("Deal-Implikation", "Primäre Folge für Preis, SPA, Closing, Finanzierung oder Integration wählen.", validate="list", source="=DealImpact"))
    ws_check.data_validation(check_first_row, 19, check_last_row, 19, input_hint("Kaufpreiseffekt", "Quantifizierten Betrag ohne Währungstext eingeben; Herleitung im Finding dokumentieren.", validate="any"))
    ws_check.data_validation(check_first_row, 21, check_last_row, 21, input_hint("Referenz", "Vorhandene Dokument-, Q&A- oder Risiko-ID eintragen.", validate="any"))
    ws_check.data_validation(check_first_row, 23, check_last_row, 23, input_hint("Aktualisierung", "Datum der letzten materiellen Aktualisierung.", validate="date", criteria="between", minimum=date(2000, 1, 1), maximum=date(2100, 12, 31)))
    ws_check.data_validation(check_first_row, 24, check_last_row, 24, input_hint("Reviewer", "Unabhängigen fachlichen Reviewer mit Rolle eintragen.", validate="any"))
    conditional_status(ws_check, f"H{check_first_row+1}:P{check_last_row+1}")
    ws_check.conditional_format(check_first_row, 14, check_last_row, 14, {"type": "3_color_scale", "min_color": "#C6EFCE", "mid_color": "#FFEB9C", "max_color": "#FFC7CE"})

    # 03 Documents: one request per checklist point.
    ws_docs = workbook.add_worksheet("03_Dokumente")
    doc_headers = ["Dok-ID", "Prüfbereich", "Unterlage / Datensatz", "Zeitraum / Scope", "Analysezweck", "Priorität", "Pflicht?", "Owner Zielunternehmen", "Angefordert am", "Fällig am", "Erhalten am", "Status", "Vollständigkeit", "Vertraulichkeit", "VDR-Pfad / Link", "Checklisten-Ref.", "Offene Punkte", "Tage überfällig", "Reviewer"]
    banner(ws_docs, "Dokumentenanforderung / VDR-Tracker", "Aus der Master-Checkliste abgeleitete Request List. Eine Zeile kann bei Bedarf in einzelne Dateien/Datenpakete aufgeteilt werden.", len(doc_headers) - 1)
    doc_first_row = 4
    owner_map = {
        "Financial": "CFO / Finance", "Tax": "Tax", "Legal": "Legal", "IT & Cyber": "CIO / CISO",
        "Datenschutz": "DPO / Legal", "HR & Pensions": "HR", "Commercial": "Sales / Strategy",
        "Operations": "COO", "Supply Chain": "Procurement / SCM", "Intellectual Property": "Legal / CTO",
        "ESG, EHS & Produkt": "EHS / ESG / Quality", "Real Estate & Assets": "Facilities / Legal",
        "Insurance": "Risk / Finance", "Compliance, AML & Sanctions": "Compliance",
        "Carve-out & Integration": "PMO / Separation", "Corporate & Governance": "Legal / Corporate",
        "Transaktion & Scope": "M&A / Legal",
    }
    for idx, item in enumerate(checklist, start=1):
        row = doc_first_row + idx - 1
        period = "Letzte 3–5 Jahre und LTM" if item["area"] in {"Financial", "Tax", "Commercial", "HR & Pensions"} else "Aktuell; historische Fälle soweit relevant"
        data = [
            f"DOC-{idx:03d}", item["area"], item["documents"], period, item["question"],
            item["priority"], "Ja" if item["priority"] in {"Kritisch", "Hoch"} else "Zu prüfen",
            owner_map.get(item["area"], ""), "", "", "", "Nicht angefordert", "Ungeprüft",
            "Streng vertraulich" if item["area"] in {"HR & Pensions", "Compliance, AML & Sanctions"} else "Vertraulich",
            "", item["id"], "", "", "",
        ]
        for col, value in enumerate(data):
            if col in (8, 9, 10):
                ws_docs.write_blank(row, col, None, fmt["input_date"])
            elif col in (14, 16, 18):
                ws_docs.write(row, col, value, fmt["input"])
            elif col == 17:
                continue
            else:
                ws_docs.write(row, col, value, fmt["text"])
        er = row + 1
        ws_docs.write_formula(row, 17, f'=IF(OR(J{er}="",L{er}="Vollständig",L{er}="Nicht anwendbar"),"",MAX(0,TODAY()-J{er}))', fmt["formula_int"], "")
    doc_last_row = doc_first_row + len(checklist) - 1
    add_table(ws_docs, 3, doc_last_row, doc_headers, "tblDokumente")
    doc_widths = [12, 24, 44, 24, 40, 11, 10, 22, 13, 13, 13, 17, 16, 18, 28, 16, 34, 14, 18]
    for col, width in enumerate(doc_widths):
        ws_docs.set_column(col, col, width)
    ws_docs.set_default_row(58)
    ws_docs.freeze_panes(doc_first_row, 3)
    ws_docs.data_validation(doc_first_row, 5, doc_last_row, 5, input_hint("Priorität", "Priorität aus Deal-Relevanz und zeitlichem Pfad wählen.", validate="list", source="=Prioritaet"))
    ws_docs.data_validation(doc_first_row, 6, doc_last_row, 6, input_hint("Pflicht?", "Ja, Nein oder Zu prüfen auswählen.", validate="list", source="=JaNeinPruefen"))
    ws_docs.data_validation(doc_first_row, 7, doc_last_row, 7, input_hint("Owner Zielunternehmen", "Eine lieferverantwortliche Person oder Rolle eintragen.", validate="any"))
    ws_docs.data_validation(doc_first_row, 8, doc_last_row, 10, input_hint("Dokumentendatum", "Anforderung, Fälligkeit und Erhalt im Format TT.MM.JJJJ pflegen.", validate="date", criteria="between", minimum=date(2000, 1, 1), maximum=date(2100, 12, 31)))
    ws_docs.data_validation(doc_first_row, 11, doc_last_row, 11, input_hint("Dokumentenstatus", "„Vollständig“ erst nach Inhalts- und Periodenprüfung wählen.", validate="list", source="=DokStatus"))
    ws_docs.data_validation(doc_first_row, 12, doc_last_row, 12, input_hint("Vollständigkeit", "Qualität nach Abgleich mit Request und Inhalt auswählen.", validate="list", source="=Vollstaendigkeit"))
    ws_docs.data_validation(doc_first_row, 13, doc_last_row, 13, input_hint("Vertraulichkeit", "Höchste enthaltene Schutzklasse auswählen.", validate="list", source="=Vertraulichkeit"))
    ws_docs.data_validation(doc_first_row, 14, doc_last_row, 14, input_hint("VDR-Pfad", "Eindeutigen, reproduzierbaren VDR-Pfad oder Link eintragen.", validate="any"))
    ws_docs.data_validation(doc_first_row, 16, doc_last_row, 16, input_hint("Offene Punkte", "Fehlende Perioden, Anhänge, Versionen oder Widersprüche konkret benennen.", validate="any"))
    ws_docs.data_validation(doc_first_row, 18, doc_last_row, 18, input_hint("Reviewer", "Person/Rolle der Qualitätsprüfung eintragen.", validate="any"))
    conditional_status(ws_docs, f"F{doc_first_row+1}:R{doc_last_row+1}")
    ws_docs.conditional_format(doc_first_row, 17, doc_last_row, 17, {"type": "cell", "criteria": ">", "value": 0, "format": workbook.add_format({"bg_color": "#FFC7CE", "font_color": "#9C0006"})})

    # Risk hypotheses are selected from critical/high checklist rows and are explicitly not findings.
    priority_order = {"Kritisch": 0, "Hoch": 1, "Mittel": 2, "Niedrig": 3}
    risk_candidates = sorted(checklist, key=lambda item: (priority_order[item["priority"]], checklist.index(item)))[:60]
    ws_risk = workbook.add_worksheet("04_Risiken")
    risk_headers = ["Risiko-ID", "Prüfbereich", "Prüfhypothese / Szenario", "Indikatoren / benötigte Evidenz", "Analyse / Test", "Bewertungsstatus", "Feststellung / Evidenz", "Eintritt (1–5)", "Auswirkung (1–5)", "Score", "Klasse", "Exposure Low (€)", "Exposure Base (€)", "Exposure High (€)", "Gegenmaßnahme", "Owner", "Fälligkeit", "Maßnahmenstatus", "Transaktionsfolge", "Checklisten-Ref.", "Resteintritt", "Restauswirkung", "Restscore", "Restklasse", "Entscheidung / Kommentar", "Reviewer"]
    banner(ws_risk, "Risikoregister", "Vorausgefüllte Prüfhypothesen – ausdrücklich keine bestätigten Findings. Eintritt, Auswirkung und Exposure erst nach Evidenz bewerten.", len(risk_headers) - 1)
    risk_first_row = 4
    for idx, item in enumerate(risk_candidates, start=1):
        row = risk_first_row + idx - 1
        data = [
            f"R-{idx:03d}", item["area"], item["red_flags"], item["documents"], item["analysis"],
            "Zu verifizieren", "", "", "", "", "", "", "", "", item["action"], "", "",
            "Nicht gestartet", item["deal_impact"], item["id"], "", "", "", "", "", "",
        ]
        for col, value in enumerate(data):
            if col in (7, 8, 20, 21):
                ws_risk.write_blank(row, col, None, fmt["input_int"])
            elif col in (11, 12, 13):
                ws_risk.write_blank(row, col, None, fmt["money_input"])
            elif col == 16:
                ws_risk.write_blank(row, col, None, fmt["input_date"])
            elif col in (6, 15, 24, 25):
                ws_risk.write(row, col, value, fmt["input"])
            elif col in (9, 10, 22, 23):
                continue
            else:
                ws_risk.write(row, col, value, fmt["text"])
        er = row + 1
        ws_risk.write_formula(row, 9, f'=IF(OR(H{er}="",I{er}=""),"",H{er}*I{er})', fmt["formula_int"], "")
        ws_risk.write_formula(row, 10, f'=IF(J{er}="","",IF(J{er}>=17,"Kritisch",IF(J{er}>=10,"Hoch",IF(J{er}>=5,"Mittel","Niedrig"))))', fmt["formula"], "")
        ws_risk.write_formula(row, 22, f'=IF(OR(U{er}="",V{er}=""),"",U{er}*V{er})', fmt["formula_int"], "")
        ws_risk.write_formula(row, 23, f'=IF(W{er}="","",IF(W{er}>=17,"Kritisch",IF(W{er}>=10,"Hoch",IF(W{er}>=5,"Mittel","Niedrig"))))', fmt["formula"], "")
    risk_last_row = risk_first_row + len(risk_candidates) - 1
    add_table(ws_risk, 3, risk_last_row, risk_headers, "tblRisiken")
    risk_widths = [12, 24, 40, 38, 40, 17, 40, 11, 12, 9, 11, 16, 17, 17, 42, 18, 13, 18, 22, 16, 11, 12, 10, 11, 34, 18]
    for col, width in enumerate(risk_widths):
        ws_risk.set_column(col, col, width)
    ws_risk.set_default_row(64)
    ws_risk.freeze_panes(risk_first_row, 3)
    for col in (7, 8, 20, 21):
        ws_risk.data_validation(risk_first_row, col, risk_last_row, col, input_hint("Risikowert 1–5", "Bruttorisiko bzw. Restrisiko getrennt und anhand der Skala auf 00_Start bewerten.", validate="integer", criteria="between", minimum=1, maximum=5))
    ws_risk.data_validation(risk_first_row, 5, risk_last_row, 5, input_hint("Bewertungsstatus", "Hypothese erst nach Evidenz als bestätigt, entkräftet oder mitigiert markieren.", validate="list", source="=RisikoStatus"))
    ws_risk.data_validation(risk_first_row, 6, risk_last_row, 6, input_hint("Feststellung / Evidenz", "Fakten, Ursache, Umfang und konkrete Primärbelege dokumentieren.", validate="any"))
    ws_risk.data_validation(risk_first_row, 11, risk_last_row, 13, input_hint("Exposure", "Low/Base/High als Bruttobeträge in Berichtswährung quantifizieren.", validate="any"))
    ws_risk.data_validation(risk_first_row, 15, risk_last_row, 15, input_hint("Risiko-Owner", "Eine entscheidungsverantwortliche Person oder Rolle eintragen.", validate="any"))
    ws_risk.data_validation(risk_first_row, 16, risk_last_row, 16, input_hint("Fälligkeit", "Verbindliches Abschlussdatum der Risikobehandlung.", validate="date", criteria="between", minimum=date(2000, 1, 1), maximum=date(2100, 12, 31)))
    ws_risk.data_validation(risk_first_row, 17, risk_last_row, 17, input_hint("Maßnahmenstatus", "Status nach tatsächlichem Umsetzungsstand auswählen.", validate="list", source="=MassStatus"))
    ws_risk.data_validation(risk_first_row, 18, risk_last_row, 18, input_hint("Transaktionsfolge", "Primäre Konsequenz für Deal-Struktur und Entscheidung auswählen.", validate="list", source="=DealImpact"))
    ws_risk.data_validation(risk_first_row, 24, risk_last_row, 25, input_hint("Entscheidung / Review", "Entscheidung, Bedingungen, Datum und fachlichen Reviewer dokumentieren.", validate="any"))
    conditional_status(ws_risk, f"F{risk_first_row+1}:X{risk_last_row+1}")
    ws_risk.conditional_format(risk_first_row, 9, risk_last_row, 9, {"type": "3_color_scale", "min_color": "#C6EFCE", "mid_color": "#FFEB9C", "max_color": "#FFC7CE"})

    # Measures are derived from the selected risk hypotheses.
    ws_action = workbook.add_worksheet("05_Maßnahmen")
    action_headers = ["Maßnahmen-ID", "Aktivieren?", "Risiko-/Finding-Ref.", "Phase", "Prüfbereich", "Maßnahmenvorschlag", "Ergebnis / Abnahmekriterium", "Priorität", "Owner", "Support", "Start", "Fällig", "Status", "Fortschritt", "Abhängigkeit", "Budget (€)", "Erwartete Wirkung", "KPI / Nachweis", "Eskalationstrigger", "Deal-Mechanismus", "Kommentar"]
    banner(ws_action, "Maßnahmenplan", "Vorschläge werden erst nach Bestätigung eines Findings aktiviert. Jede aktive Maßnahme benötigt Owner, Termin und messbares Abnahmekriterium.", len(action_headers) - 1)
    action_first_row = 4
    for idx, item in enumerate(risk_candidates, start=1):
        row = action_first_row + idx - 1
        phase = "Pre-Signing" if item["deal_impact"] in {"Abbruch/No-go", "Closing-Bedingung"} else ("SPA / Signing" if item["deal_impact"] in {"SPA/Haftung", "Bewertung/Kaufpreis", "Finanzierung"} else "Day 1 / 100 Tage")
        criterion = f"Maßnahme für {item['id']} dokumentiert, fachlich abgenommen und durch belastbare Evidenz geschlossen."
        data = [
            f"M-{idx:03d}", "Zu prüfen", f"R-{idx:03d} / {item['id']}", phase, item["area"],
            item["action"], criterion, item["priority"], "", "", "", "", "Nicht gestartet", 0,
            "", "", item["deal_impact"], "Evidenz im VDR; Reviewer-Freigabe", "Fristüberschreitung oder Score ≥17",
            item["protection"], "",
        ]
        for col, value in enumerate(data):
            if col in (8, 9, 14, 20):
                ws_action.write(row, col, value, fmt["input"])
            elif col in (10, 11):
                ws_action.write_blank(row, col, None, fmt["input_date"])
            elif col == 13:
                ws_action.write_number(row, col, value, fmt["pct_input"])
            elif col == 15:
                ws_action.write_blank(row, col, None, fmt["money_input"])
            else:
                ws_action.write(row, col, value, fmt["text"])
    action_last_row = action_first_row + len(risk_candidates) - 1
    add_table(ws_action, 3, action_last_row, action_headers, "tblMassnahmen")
    action_widths = [14, 12, 20, 18, 24, 44, 38, 11, 18, 18, 13, 13, 18, 12, 28, 14, 25, 28, 26, 28, 30]
    for col, width in enumerate(action_widths):
        ws_action.set_column(col, col, width)
    ws_action.set_default_row(60)
    ws_action.freeze_panes(action_first_row, 5)
    ws_action.data_validation(action_first_row, 1, action_last_row, 1, input_hint("Aktivieren?", "Nur bei bestätigtem, relevantem Finding auf „Ja“ setzen.", validate="list", source="=JaNeinPruefen"))
    ws_action.data_validation(action_first_row, 7, action_last_row, 7, input_hint("Priorität", "Dringlichkeit nach Risiko und kritischem Deal-Pfad wählen.", validate="list", source="=Prioritaet"))
    ws_action.data_validation(action_first_row, 8, action_last_row, 9, input_hint("Verantwortung", "Genau einen Owner und bei Bedarf unterstützende Rollen eintragen.", validate="any"))
    ws_action.data_validation(action_first_row, 10, action_last_row, 11, input_hint("Termin", "Start und verbindliche Fälligkeit im Format TT.MM.JJJJ.", validate="date", criteria="between", minimum=date(2000, 1, 1), maximum=date(2100, 12, 31)))
    ws_action.data_validation(action_first_row, 12, action_last_row, 12, input_hint("Maßnahmenstatus", "Status nur nach tatsächlichem Umsetzungsstand wählen.", validate="list", source="=MassStatus"))
    ws_action.data_validation(action_first_row, 13, action_last_row, 13, input_hint("Fortschritt", "Tatsächlichen Fertigstellungsgrad 0–100 % eintragen.", validate="decimal", criteria="between", minimum=0, maximum=1))
    ws_action.data_validation(action_first_row, 14, action_last_row, 14, input_hint("Abhängigkeit", "Voraussetzungen, Consents oder vorgelagerte Maßnahmen mit ID nennen.", validate="any"))
    ws_action.data_validation(action_first_row, 15, action_last_row, 15, input_hint("Budget", "Genehmigten oder erwarteten Bruttobetrag ohne Währungstext eingeben.", validate="any"))
    ws_action.data_validation(action_first_row, 20, action_last_row, 20, input_hint("Kommentar", "Fortschritt, Entscheidung, Abweichung und nächste Eskalation dokumentieren.", validate="any"))
    conditional_status(ws_action, f"H{action_first_row+1}:N{action_last_row+1}")
    ws_action.conditional_format(action_first_row, 11, action_last_row, 11, {"type": "formula", "criteria": f'=AND($L{action_first_row+1}<TODAY(),$M{action_first_row+1}<>"Erledigt",$L{action_first_row+1}<>"")', "format": workbook.add_format({"bg_color": "#FFC7CE", "font_color": "#9C0006"})})

    # Q&A tracker with 100 ready-to-use rows.
    ws_qa = workbook.add_worksheet("06_Q&A")
    qa_headers = ["Q&A-ID", "Erstellt am", "Prüfbereich", "Check-/Dok-Ref.", "Frage", "Begründung / Entscheidungskontext", "Priorität", "Empfänger", "Fragesteller", "Fällig", "Antwort am", "Status", "Antwort", "Evidenz / VDR-Link", "Nachfrage / Next Step", "Alter (Tage)", "Überfällig?", "Reviewer"]
    banner(ws_qa, "Q&A-Tracker", "Fragen konkret, neutral und entscheidungsorientiert formulieren. Mündliche Antworten schriftlich bestätigen und mit Evidenz verknüpfen.", len(qa_headers) - 1)
    qa_first_row = 4
    for idx in range(1, 101):
        row = qa_first_row + idx - 1
        ws_qa.write(row, 0, f"Q-{idx:03d}", fmt["text"])
        for col in range(1, len(qa_headers)):
            if col in (1, 9, 10):
                ws_qa.write_blank(row, col, None, fmt["input_date"])
            elif col == 11:
                ws_qa.write(row, col, "Entwurf", fmt["input"])
            elif col in (15, 16):
                continue
            else:
                ws_qa.write_blank(row, col, None, fmt["input"])
        er = row + 1
        ws_qa.write_formula(row, 15, f'=IF(B{er}="","",IF(K{er}<>"",K{er}-B{er},TODAY()-B{er}))', fmt["formula_int"], "")
        ws_qa.write_formula(row, 16, f'=IF(OR(J{er}="",L{er}="Beantwortet",L{er}="Geschlossen"),"",IF(TODAY()>J{er},"Ja","Nein"))', fmt["formula"], "")
    qa_last_row = qa_first_row + 99
    add_table(ws_qa, 3, qa_last_row, qa_headers, "tblQA")
    qa_widths = [11, 13, 23, 18, 44, 36, 11, 20, 18, 13, 13, 17, 44, 26, 34, 12, 12, 18]
    for col, width in enumerate(qa_widths):
        ws_qa.set_column(col, col, width)
    ws_qa.set_default_row(52)
    ws_qa.freeze_panes(qa_first_row, 4)
    ws_qa.data_validation(qa_first_row, 1, qa_last_row, 1, input_hint("Erstellt am", "Datum der erstmaligen Erfassung.", validate="date", criteria="between", minimum=date(2000, 1, 1), maximum=date(2100, 12, 31)))
    ws_qa.data_validation(qa_first_row, 2, qa_last_row, 5, input_hint("Q&A-Inhalt", "Bereich, Referenz, eine klare Frage und ihren Entscheidungskontext erfassen.", validate="any"))
    ws_qa.data_validation(qa_first_row, 6, qa_last_row, 6, input_hint("Priorität", "Dringlichkeit nach Deal-Entscheidung und kritischem Pfad wählen.", validate="list", source="=Prioritaet"))
    ws_qa.data_validation(qa_first_row, 7, qa_last_row, 8, input_hint("Q&A-Verantwortung", "Empfänger und Fragesteller jeweils namentlich oder als eindeutige Rolle erfassen.", validate="any"))
    ws_qa.data_validation(qa_first_row, 9, qa_last_row, 10, input_hint("Q&A-Termin", "Fälligkeit bzw. Antwortdatum im Format TT.MM.JJJJ.", validate="date", criteria="between", minimum=date(2000, 1, 1), maximum=date(2100, 12, 31)))
    ws_qa.data_validation(qa_first_row, 11, qa_last_row, 11, input_hint("Q&A-Status", "„Beantwortet“ erst bei vollständiger, evidenzbasierter Antwort wählen.", validate="list", source="=QAStatus"))
    ws_qa.data_validation(qa_first_row, 12, qa_last_row, 14, input_hint("Antwort / Nachweis", "Antwort, konkrete VDR-Evidenz und ggf. nächste Nachfrage dokumentieren.", validate="any"))
    ws_qa.data_validation(qa_first_row, 17, qa_last_row, 17, input_hint("Reviewer", "Fachlichen Prüfer der Antwort eintragen.", validate="any"))
    conditional_status(ws_qa, f"G{qa_first_row+1}:Q{qa_last_row+1}")

    # Financial analysis template.
    ws_fin = workbook.add_worksheet("07_Finanzanalyse")
    banner(ws_fin, "Finanzanalyse", "Eingaben positiv erfassen (auch Aufwendungen und Schulden); Formeln ziehen Kosten ab. Periodenbezeichnungen können überschrieben werden.", 8)
    ws_fin.set_column("A:A", 30)
    ws_fin.set_column("B:F", 15)
    ws_fin.set_column("G:H", 18)
    ws_fin.set_column("I:I", 38)
    period_labels = ["2022A", "2023A", "2024A", "LTM / aktuell", "Budget"]
    ws_fin.write("A4", "Kennzahl", fmt["header"])
    register_field_help(
        ws_fin,
        3,
        0,
        "Kennzahl",
        {"mode": "Vorbelegt", "required": "Automatisch", "entry": "Kennzahlenbezeichnung nicht ändern; zusätzliche Kennzahlen unterhalb des Blocks ergänzen.", "example": "Umsatz", "source": "Financial-DD-Analyseschema"},
    )
    for col, label in enumerate(period_labels, start=1):
        ws_fin.write(3, col, label, fmt["input"])
        register_field_help(
            ws_fin,
            3,
            col,
            f"Periode – {label}",
            {"required": "Pflicht", "entry": "Periodenbezeichnung an das gelieferte Datenpaket anpassen.", "example": "2025A / LTM Sep-26", "format": "Kurze Periodenbezeichnung", "source": "Jahresabschluss / Monatsreporting", "quality": "Ist-, LTM- und Budgetperioden eindeutig kennzeichnen."},
        )
    ws_fin.write("G4", "Δ LTM vs. 2024", fmt["header"])
    ws_fin.write("H4", "Δ LTM vs. Budget", fmt["header"])
    ws_fin.write("I4", "Kommentar / Quelle", fmt["header"])
    register_field_help(ws_fin, 3, 6, "Δ LTM vs. Vorperiode", {"mode": "Automatische Formel", "required": "Automatisch", "entry": "Nicht überschreiben; prozentuale Veränderung wird berechnet.", "format": "Prozent"})
    register_field_help(ws_fin, 3, 7, "Δ LTM vs. Budget", {"mode": "Automatische Formel", "required": "Automatisch", "entry": "Nicht überschreiben; Budgetabweichung wird berechnet.", "format": "Prozent"})
    register_field_help(ws_fin, 3, 8, "Kommentar / Quelle", {"required": "Pflicht bei Auffälligkeit", "entry": "Datenquelle, Überleitung und Erklärung wesentlicher Abweichungen eintragen.", "example": "VDR 2.1.4; LTM-Umsatz +8 % durch Preis +5 % und Volumen +3 %", "source": "Reporting / Hauptbuch / Analyse"})
    ws_fin.data_validation(3, 1, 3, 5, input_hint("Periodenbezeichnung", "Bezeichnungen an die gelieferten Ist-, LTM- und Budgetperioden anpassen.", validate="any"))
    metrics = [
        ("Umsatz", "input", None),
        ("Umsatzkosten (COGS)", "input", None),
        ("Bruttoergebnis", "formula", "REV-COGS"),
        ("Bruttomarge", "pct", "GP/REV"),
        ("Personalaufwand", "input", None),
        ("Sonstige Opex", "input", None),
        ("EBITDA berichtet", "input", None),
        ("QoE-Anpassungen (netto)", "input", None),
        ("EBITDA normalisiert", "formula", "EBITDA+ADJ"),
        ("EBITDA-Marge normalisiert", "pct", "ADJEBITDA/REV"),
        ("Abschreibungen", "input", None),
        ("EBIT normalisiert", "formula", "ADJEBITDA-DA"),
        ("Nettozinsaufwand", "input", None),
        ("Ertragsteuern", "input", None),
        ("Jahresergebnis (vereinfachte Sicht)", "formula", "EBIT-INT-TAX"),
        ("Operativer Cashflow", "input", None),
        ("Capex", "input", None),
        ("Free Cashflow", "formula", "OCF-CAPEX"),
        ("Cash", "input", None),
        ("Finanzschulden", "input", None),
        ("Leasingverbindlichkeiten", "input", None),
        ("Sonstige debt-like Positionen", "input", None),
        ("Net Debt", "formula", "DEBT+LEASE+OTHER-CASH"),
        ("Vorräte", "input", None),
        ("Forderungen L&L", "input", None),
        ("Vertragsvermögenswerte", "input", None),
        ("Sonstige operative kurzfristige Aktiva", "input", None),
        ("Verbindlichkeiten L&L", "input", None),
        ("Deferred Revenue / Vertragsverbindlichkeiten", "input", None),
        ("Sonstige operative kurzfristige Passiva", "input", None),
        ("Net Working Capital", "formula", "NWC"),
        ("NWC in % Umsatz", "pct", "NWC/REV"),
        ("DSO", "formula1", "AR/REV*365"),
        ("DIO", "formula1", "INV/COGS*365"),
        ("DPO", "formula1", "AP/COGS*365"),
        ("Headcount (FTE)", "input1", None),
        ("Umsatz je FTE", "formula", "REV/FTE"),
        ("EBITDA je FTE", "formula", "ADJEBITDA/FTE"),
    ]
    row_map: dict[str, int] = {}
    keys = ["REV", "COGS", "GP", "GPM", "PERSONNEL", "OPEX", "EBITDA", "ADJ", "ADJEBITDA", "EBITDAM", "DA", "EBIT", "INT", "TAX", "NI", "OCF", "CAPEX", "FCF", "CASH", "DEBT", "LEASE", "OTHER", "NETDEBT", "INV", "AR", "CA", "OA", "AP", "DR", "OP", "NWC", "NWCP", "DSO", "DIO", "DPO", "FTE", "REVFTE", "EBITDAFTE"]
    for offset, ((label, kind, expression), key) in enumerate(zip(metrics, keys), start=4):
        row_map[key] = offset
        ws_fin.write(offset, 0, label, fmt["label"] if kind.startswith("formula") or kind == "pct" else fmt["text"])
        is_input = kind in {"input", "input1"}
        register_field_help(
            ws_fin,
            offset,
            0,
            label,
            {
                "mode": "Eingabe" if is_input else "Automatische Formel",
                "required": "Pflicht bei verfügbaren Daten" if is_input else "Automatisch",
                "entry": (
                    "Wert für jede Periode eingeben. Aufwendungen, Schulden und Bestände als positive Beträge erfassen; die Formeln berücksichtigen das Vorzeichen."
                    if kind == "input"
                    else ("FTE je Periode als durchschnittlichen oder Stichtagswert konsistent erfassen." if kind == "input1" else "Nicht überschreiben; Kennzahl wird aus den Eingaben dieses Blatts berechnet.")
                ),
                "example": "1250000" if kind == "input" else ("84" if kind == "input1" else "Automatisch berechnet"),
                "format": "Betrag in Berichtswährung" if kind == "input" else ("Ganzzahl / FTE" if kind == "input1" else "Formel"),
                "source": "Jahresabschluss, Monatsreporting und Hauptbuch" if is_input else "Verknüpfte Eingabezeilen",
                "quality": "Perioden und Vorzeichen konsistent halten; Abweichungen in Spalte I erklären." if is_input else "Formelzellen nicht überschreiben.",
            },
        )
        for col in range(1, 6):
            cell = xlsxwriter.utility.xl_rowcol_to_cell(offset, col)
            def ref(k: str) -> str:
                return xlsxwriter.utility.xl_rowcol_to_cell(row_map[k], col)
            if kind in {"input", "input1"}:
                ws_fin.write_blank(offset, col, None, fmt["input_int"] if kind == "input1" else fmt["money_input"])
            elif key == "GP":
                ws_fin.write_formula(offset, col, f"={ref('REV')}-{ref('COGS')}", fmt["formula"], 0)
            elif key == "GPM":
                ws_fin.write_formula(offset, col, f'=IFERROR({ref("GP")}/{ref("REV")},"")', fmt["formula_pct"], "")
            elif key == "ADJEBITDA":
                ws_fin.write_formula(offset, col, f"={ref('EBITDA')}+{ref('ADJ')}", fmt["formula"], 0)
            elif key == "EBITDAM":
                ws_fin.write_formula(offset, col, f'=IFERROR({ref("ADJEBITDA")}/{ref("REV")},"")', fmt["formula_pct"], "")
            elif key == "EBIT":
                ws_fin.write_formula(offset, col, f"={ref('ADJEBITDA')}-{ref('DA')}", fmt["formula"], 0)
            elif key == "NI":
                ws_fin.write_formula(offset, col, f"={ref('EBIT')}-{ref('INT')}-{ref('TAX')}", fmt["formula"], 0)
            elif key == "FCF":
                ws_fin.write_formula(offset, col, f"={ref('OCF')}-{ref('CAPEX')}", fmt["formula"], 0)
            elif key == "NETDEBT":
                ws_fin.write_formula(offset, col, f"={ref('DEBT')}+{ref('LEASE')}+{ref('OTHER')}-{ref('CASH')}", fmt["formula"], 0)
            elif key == "NWC":
                ws_fin.write_formula(offset, col, f"={ref('INV')}+{ref('AR')}+{ref('CA')}+{ref('OA')}-{ref('AP')}-{ref('DR')}-{ref('OP')}", fmt["formula"], 0)
            elif key == "NWCP":
                ws_fin.write_formula(offset, col, f'=IFERROR({ref("NWC")}/{ref("REV")},"")', fmt["formula_pct"], "")
            elif key == "DSO":
                ws_fin.write_formula(offset, col, f'=IFERROR({ref("AR")}/{ref("REV")}*365,"")', fmt["formula"], "")
            elif key == "DIO":
                ws_fin.write_formula(offset, col, f'=IFERROR({ref("INV")}/{ref("COGS")}*365,"")', fmt["formula"], "")
            elif key == "DPO":
                ws_fin.write_formula(offset, col, f'=IFERROR({ref("AP")}/{ref("COGS")}*365,"")', fmt["formula"], "")
            elif key == "REVFTE":
                ws_fin.write_formula(offset, col, f'=IFERROR({ref("REV")}/{ref("FTE")},"")', fmt["formula"], "")
            elif key == "EBITDAFTE":
                ws_fin.write_formula(offset, col, f'=IFERROR({ref("ADJEBITDA")}/{ref("FTE")},"")', fmt["formula"], "")
        er = offset + 1
        ws_fin.write_formula(offset, 6, f'=IFERROR(E{er}/D{er}-1,"")', fmt["formula_pct"], "")
        ws_fin.write_formula(offset, 7, f'=IFERROR(E{er}/F{er}-1,"")', fmt["formula_pct"], "")
        ws_fin.write_blank(offset, 8, None, fmt["input"])
        if is_input:
            ws_fin.data_validation(
                offset,
                1,
                offset,
                5,
                input_hint(
                    label,
                    "Periodenwert eingeben; Beträge grundsätzlich positiv, QoE-Anpassungen mit wirtschaftlichem Vorzeichen.",
                    validate="any",
                ),
            )
        ws_fin.data_validation(offset, 8, offset, 8, input_hint("Kommentar / Quelle", "Quelle und wesentliche Treiber oder Abweichungen dokumentieren.", validate="any"))
    ws_fin.freeze_panes(4, 1)
    ws_fin.conditional_format(4, 6, 4 + len(metrics) - 1, 7, {"type": "3_color_scale", "min_color": "#FFC7CE", "mid_color": "#FFEB9C", "max_color": "#C6EFCE"})

    # QoE bridge.
    ws_qoe = workbook.add_worksheet("08_QoE")
    banner(ws_qoe, "Quality-of-Earnings-Brücke", "Nur belegte Normalisierungen erfassen. Synergien des Käufers gehören grundsätzlich nicht in das historische normalisierte EBITDA.", 15)
    ws_qoe.set_column("A:A", 13)
    ws_qoe.set_column("B:B", 22)
    ws_qoe.set_column("C:C", 42)
    ws_qoe.set_column("D:E", 15)
    ws_qoe.set_column("F:H", 16)
    ws_qoe.set_column("I:P", 22)
    ws_qoe.write("A4", "EBITDA berichtet (LTM)", fmt["label"])
    ws_qoe.write_blank("B4", None, fmt["money_input"])
    register_field_help(
        ws_qoe,
        3,
        1,
        "EBITDA berichtet (LTM)",
        {"required": "Pflicht", "entry": "Berichtetes EBITDA der identischen LTM-Periode vor DD-Anpassungen eingeben.", "example": "4250000", "format": "Betrag in Berichtswährung", "source": "Management Reporting / GuV-Überleitung", "quality": "Periode und Definition mit 07_Finanzanalyse abstimmen."},
    )
    ws_qoe.data_validation("B4", input_hint("EBITDA berichtet", "Berichtetes EBITDA für exakt dieselbe LTM-Periode wie die Anpassungen eingeben.", validate="any"))
    ws_qoe.write("A5", "Akzeptierte Anpassungen", fmt["label"])
    ws_qoe.write_formula("B5", "=SUM(H10:H49)", fmt["formula"], 0)
    ws_qoe.write("A6", "EBITDA normalisiert", fmt["label"])
    ws_qoe.write_formula("B6", "=B4+B5", fmt["formula"], 0)
    ws_qoe.write("A7", "Anpassungen in % berichtet", fmt["label"])
    ws_qoe.write_formula("B7", '=IFERROR(B5/B4,"")', fmt["formula_pct"], "")
    qoe_headers = ["Adj.-ID", "Kategorie", "Prüfansatz / Beschreibung", "Richtung", "Periode", "Management-Betrag (€)", "DD-Vorschlag (€)", "Akzeptierter Betrag (€)", "Evidenz", "Wiederkehrend?", "Cash / Non-Cash", "Konfidenz", "Status", "Owner", "Quelle / Ref.", "Kommentar"]
    qoe_examples = [
        ("Einmalkosten", "Restrukturierung, Rechtsfall oder Transaktionskosten auf echte Einmaligkeit prüfen.", "+"),
        ("Einmalertrag", "Versicherungs-/Vergleichsertrag oder Anlagenverkauf aus nachhaltigem Ergebnis entfernen.", "−"),
        ("Owner / Related Party", "Vergütung, Miete und Services auf Marktniveau normalisieren.", "+/−"),
        ("Run-rate", "Umgesetzte Preis-/Kostenänderung nur ab wirksamen Datum und mit Evidenz annualisieren.", "+/−"),
        ("Accounting Error", "Periodenfremde oder fehlerhafte Buchung korrigieren.", "+/−"),
        ("Unterinvestition", "Fehlende laufende Kosten oder Maintenance-Aufwand ergänzen.", "−"),
        ("Stand-alone Costs", "Nach Carve-out notwendige Corporate-/IT-/Insurance-Kosten ergänzen.", "−"),
        ("Synergie", "Käufer-Synergie separat vom Target-QoE ausweisen.", "separat"),
        ("FX / Commodity", "Außergewöhnliche Effekte nur bei klar definierter Normalbasis beurteilen.", "+/−"),
        ("Kunden-/Vertragsereignis", "Verlorenen/gewonnenen Großkunden mit Start-/Enddatum und Marge berücksichtigen.", "+/−"),
        ("Personal", "Offene Stellen, Bonus, Gehaltsanpassung und Freelancer-Run-rate normalisieren.", "−"),
        ("Sonstige", "Jede weitere Anpassung mit Gegenkonto, Cash-Wirkung und Wiederkehr belegen.", "+/−"),
    ]
    qoe_first_row = 9
    for idx in range(40):
        row = qoe_first_row + idx
        example = qoe_examples[idx] if idx < len(qoe_examples) else ("", "", "")
        values = [f"ADJ-{idx+1:03d}", example[0], example[1], example[2], "LTM", "", "", "", "", "Zu prüfen", "", "", "Offen", "", "", ""]
        for col, value in enumerate(values):
            if col in (5, 6, 7):
                ws_qoe.write_blank(row, col, None, fmt["money_input"])
            elif col in (8, 13, 14, 15):
                ws_qoe.write(row, col, value, fmt["input"])
            else:
                ws_qoe.write(row, col, value, fmt["text"])
    add_table(ws_qoe, 8, qoe_first_row + 39, qoe_headers, "tblQoE")
    qoe_last_row = qoe_first_row + 39
    ws_qoe.data_validation(qoe_first_row, 3, qoe_last_row, 3, input_hint("Richtung", "+ erhöht, − reduziert, +/− noch offen; Synergien separat kennzeichnen.", validate="list", source=["+", "−", "+/−", "separat"]))
    ws_qoe.data_validation(qoe_first_row, 4, qoe_last_row, 4, input_hint("Periode", "Betroffene Periode, z. B. LTM Sep-26 oder 2025A.", validate="any"))
    ws_qoe.data_validation(qoe_first_row, 5, qoe_last_row, 7, input_hint("QoE-Betrag", "Betrag mit wirtschaftlichem Vorzeichen und ohne Währungstext eingeben.", validate="any"))
    ws_qoe.data_validation(qoe_first_row, 8, qoe_last_row, 8, input_hint("Evidenz", "Konten, Belege und Berechnung mit VDR-/Arbeitspapier-Referenz nennen.", validate="any"))
    ws_qoe.data_validation(qoe_first_row, 9, qoe_last_row, 9, input_hint("Wiederkehrend?", "Wiederkehr des Effekts anhand der Analyse auswählen.", validate="list", source=["Ja", "Nein", "Teilweise", "Zu prüfen"]))
    ws_qoe.data_validation(qoe_first_row, 10, qoe_last_row, 10, input_hint("Cash / Non-Cash", "Zahlungswirkung des Effekts klassifizieren.", validate="list", source=["Cash", "Non-Cash", "Gemischt", "Zu prüfen"]))
    ws_qoe.data_validation(qoe_first_row, 11, qoe_last_row, 11, input_hint("Konfidenz", "Belegqualität der Anpassung einstufen.", validate="list", source=["Hoch", "Mittel", "Niedrig"]))
    ws_qoe.data_validation(qoe_first_row, 12, qoe_last_row, 12, input_hint("Status", "Bearbeitungs- bzw. Entscheidungsstand auswählen.", validate="list", source=["Offen", "In Prüfung", "Akzeptiert", "Abgelehnt", "Teilweise akzeptiert"]))
    ws_qoe.data_validation(qoe_first_row, 13, qoe_last_row, 15, input_hint("QoE-Dokumentation", "Owner, Referenz und entscheidungsrelevanten Kommentar ergänzen.", validate="any"))
    ws_qoe.freeze_panes(qoe_first_row, 3)
    ws_qoe.set_default_row(46)

    # NWC and net debt.
    ws_nwc = workbook.add_worksheet("09_NWC_NetDebt")
    banner(ws_nwc, "Net Working Capital & Net Debt", "Monatswerte als positive Beträge erfassen; der Faktor +1/−1 steuert die NWC-Wirkung. Net-Debt-Positionen separat auf wirtschaftlichen Finanzierungscharakter prüfen.", 18)
    ws_nwc.set_column("A:A", 34)
    ws_nwc.set_column("B:B", 10)
    ws_nwc.set_column("C:N", 13)
    ws_nwc.set_column("O:R", 14)
    ws_nwc.set_column("S:S", 34)
    ws_nwc.merge_range("A4:S4", "NWC-Monatsanalyse", fmt["section"])
    nwc_headers = ["Komponente", "Faktor"] + [f"Monat {i}" for i in range(-11, 1)] + ["Durchschnitt", "Median", "Minimum", "Maximum", "Kommentar / Definition"]
    for col, header in enumerate(nwc_headers):
        ws_nwc.write(4, col, header, fmt["header"])
        if header == "Komponente":
            override = {"mode": "Vorbelegt / ergänzbar", "required": "Pflicht", "entry": "Operative NWC-Komponente beibehalten oder eindeutig ergänzen.", "example": "Forderungen L&L", "source": "Closing-Accounts-Definition"}
        elif header == "Faktor":
            override = {"required": "Pflicht", "entry": "+1 für Aktiva, −1 für Passiva wählen.", "example": "-1", "format": "Dropdown +1/−1", "source": "Wirtschaftliche NWC-Logik"}
        elif header.startswith("Monat"):
            override = {"required": "Pflicht für repräsentative Historie", "entry": "Monatsendbestand als positiven Bruttobetrag eingeben.", "example": "850000", "format": "Betrag in Berichtswährung", "source": "Monatsbilanz / Hauptbuch", "quality": "Mindestens 12, bei starker Saisonalität 24–36 Monate analysieren."}
        elif header in {"Durchschnitt", "Median", "Minimum", "Maximum"}:
            override = {"mode": "Automatische Formel", "required": "Automatisch", "entry": "Nicht überschreiben; Kennzahl wird aus den Monatswerten berechnet.", "example": "Automatisch", "format": "Formel", "source": "Monatswerte"}
        else:
            override = {"required": "Bei Definitionseffekt", "entry": "Abgrenzung, Ausschlüsse, Saisonalität und Datenbesonderheiten dokumentieren.", "example": "Bonuszahlungen jeweils im März; Steuerposition ausgeschlossen.", "source": "SPA-Definition / Analyse"}
        register_field_help(ws_nwc, 4, col, header, override)
    nwc_components = [
        ("Vorräte", 1), ("Forderungen L&L", 1), ("Vertragsvermögenswerte", 1),
        ("Sonstige operative kurzfristige Aktiva", 1), ("Verbindlichkeiten L&L", -1),
        ("Deferred Revenue / Vertragsverbindlichkeiten", -1), ("Sonstige operative kurzfristige Passiva", -1),
    ]
    nwc_start = 5
    for idx, (component, factor) in enumerate(nwc_components):
        row = nwc_start + idx
        ws_nwc.write(row, 0, component, fmt["text"])
        ws_nwc.write_number(row, 1, factor, fmt["input_int"])
        for col in range(2, 14):
            ws_nwc.write_blank(row, col, None, fmt["money_input"])
        er = row + 1
        ws_nwc.write_formula(row, 14, f'=IF(COUNTA(C{er}:N{er})=0,"",AVERAGE(C{er}:N{er}))', fmt["formula"], "")
        ws_nwc.write_formula(row, 15, f'=IF(COUNTA(C{er}:N{er})=0,"",MEDIAN(C{er}:N{er}))', fmt["formula"], "")
        ws_nwc.write_formula(row, 16, f'=IF(COUNTA(C{er}:N{er})=0,"",MIN(C{er}:N{er}))', fmt["formula"], "")
        ws_nwc.write_formula(row, 17, f'=IF(COUNTA(C{er}:N{er})=0,"",MAX(C{er}:N{er}))', fmt["formula"], "")
        ws_nwc.write_blank(row, 18, None, fmt["input"])
    nwc_last_component_row = nwc_start + len(nwc_components) - 1
    ws_nwc.data_validation(nwc_start, 1, nwc_last_component_row, 1, input_hint("NWC-Faktor", "+1 für Aktiva, −1 für Passiva.", validate="list", source=[1, -1]))
    ws_nwc.data_validation(nwc_start, 2, nwc_last_component_row, 13, input_hint("Monatsbestand", "Positiven Monatsendbestand ohne Währungstext eingeben.", validate="decimal", criteria=">=", value=0))
    ws_nwc.data_validation(nwc_start, 18, nwc_last_component_row, 18, input_hint("NWC-Kommentar", "Definition, Ausschlüsse, Saisonalität und Datenauffälligkeiten erläutern.", validate="any"))
    total_row = nwc_start + len(nwc_components)
    ws_nwc.write(total_row, 0, "Net Working Capital", fmt["label"])
    for col in range(2, 14):
        col_letter = xlsxwriter.utility.xl_col_to_name(col)
        ws_nwc.write_formula(total_row, col, f"=SUMPRODUCT($B${nwc_start+1}:$B${total_row},{col_letter}${nwc_start+1}:{col_letter}${total_row})", fmt["formula"], 0)
    er = total_row + 1
    ws_nwc.write_formula(total_row, 14, f"=AVERAGE(C{er}:N{er})", fmt["formula"], 0)
    ws_nwc.write_formula(total_row, 15, f"=MEDIAN(C{er}:N{er})", fmt["formula"], 0)
    ws_nwc.write_formula(total_row, 16, f"=MIN(C{er}:N{er})", fmt["formula"], 0)
    ws_nwc.write_formula(total_row, 17, f"=MAX(C{er}:N{er})", fmt["formula"], 0)
    ws_nwc.write(total_row + 1, 0, "Vorgeschlagenes NWC-Peg", fmt["label"])
    ws_nwc.write_formula(total_row + 1, 2, f"=P{er}", fmt["formula"], 0)
    ws_nwc.write(total_row + 1, 18, "Ausgangspunkt: Median; Saisonalität, Wachstum, Bilanzierungsänderungen und Ausreißer separat würdigen.", fmt["note"])
    register_field_help(
        ws_nwc,
        total_row + 1,
        0,
        "Vorgeschlagenes NWC-Peg",
        {"mode": "Automatische Ausgangsbasis", "required": "Deal-Team-Entscheidung", "entry": "Median dient nur als Ausgangspunkt; finalen Peg nach Saisonalität, Wachstum und Definition beschließen.", "example": "1.850.000 EUR", "format": "Betrag + dokumentierte Herleitung", "source": "Monatsanalyse / SPA-Verhandlung", "quality": "Keine rein mechanische Übernahme ohne Ausreißer- und Cut-off-Prüfung."},
    )
    debt_section = total_row + 4
    ws_nwc.merge_range(debt_section, 0, debt_section, 9, "Net-Debt-/Debt-like-Brücke", fmt["section"])
    debt_headers = ["Position", "Kategorie", "Betrag (€)", "Einbeziehen?", "Vorzeichen", "Einbezogener Betrag (€)", "Begründung", "Evidenz", "SPA-Behandlung", "Owner"]
    debt_items = [
        ("Frei verfügbares Cash", "Cash-like", -1), ("Gesperrtes / regulatorisches Cash", "Excluded cash", 0),
        ("Bankdarlehen", "Debt", 1), ("Aufgelaufene Zinsen / Vorfälligkeit", "Debt-like", 1),
        ("Gesellschafterdarlehen", "Debt", 1), ("Leasingverbindlichkeiten", "Debt-like", 1),
        ("Factoring / Reverse Factoring", "Debt-like", 1), ("Cash Pool Saldo", "Debt/Cash", 1),
        ("Unbezahlte Dividenden / Leakage", "Debt-like", 1), ("Transaktionsboni", "Debt-like", 1),
        ("Überfällige Steuern / Sozialabgaben", "Debt-like", 1), ("Capex-Kreditoren", "Debt-like", 1),
        ("Unterdotierte Pensionen", "Debt-like", 1), ("Rechts-/Umweltpositionen", "Case-by-case", 1),
        ("Deferred Revenue", "NWC / Case-by-case", 0), ("Garantien / Bürgschaften", "Contingent", 0),
        ("Sonstige", "Case-by-case", 1),
    ]
    debt_header_row = debt_section + 1
    debt_first_row = debt_header_row + 1
    for idx, (position, category, sign) in enumerate(debt_items):
        row = debt_first_row + idx
        values = [position, category, "", "Zu prüfen", sign, "", "", "", "", ""]
        for col, value in enumerate(values):
            if col == 2:
                ws_nwc.write_blank(row, col, None, fmt["money_input"])
            elif col in (6, 7, 8, 9):
                ws_nwc.write(row, col, value, fmt["input"])
            elif col == 5:
                continue
            else:
                ws_nwc.write(row, col, value, fmt["text"])
        erow = row + 1
        ws_nwc.write_formula(row, 5, f'=IF(D{erow}="Ja",C{erow}*E{erow},0)', fmt["formula"], 0)
    debt_last_row = debt_first_row + len(debt_items) - 1
    add_table(ws_nwc, debt_header_row, debt_last_row, debt_headers, "tblNetDebt")
    ws_nwc.write(debt_last_row + 2, 4, "Net Debt gesamt", fmt["label"])
    ws_nwc.write_formula(debt_last_row + 2, 5, f"=SUM(F{debt_first_row+1}:F{debt_last_row+1})", fmt["formula"], 0)
    ws_nwc.data_validation(debt_first_row, 2, debt_last_row, 2, input_hint("Net-Debt-Betrag", "Betrag gemäß Stichtagsdaten ohne Währungstext eingeben.", validate="any"))
    ws_nwc.data_validation(debt_first_row, 3, debt_last_row, 3, input_hint("Einbeziehen?", "Wirtschaftliche Einbeziehung in Net Debt auswählen und begründen.", validate="list", source="=JaNeinPruefen"))
    ws_nwc.data_validation(debt_first_row, 4, debt_last_row, 4, input_hint("Vorzeichen", "+1 erhöht Net Debt, −1 reduziert Net Debt, 0 schließt aus.", validate="list", source=[-1, 0, 1]))
    ws_nwc.data_validation(debt_first_row, 6, debt_last_row, 9, input_hint("Net-Debt-Dokumentation", "Begründung, Evidenz, SPA-Behandlung und Owner vollständig dokumentieren.", validate="any"))
    ws_nwc.freeze_panes(5, 2)

    # Contract review tracker.
    ws_contract = workbook.add_worksheet("10_Verträge")
    contract_headers = ["Vertrags-ID", "Vertragstyp", "Gegenpartei", "Konzernzuordnung", "Leistungsgegenstand", "Jahreswert (€)", "Marge / Kritikalität", "Beginn", "Ende", "Autom. Verlängerung", "Kündigungsfrist", "Change of Control", "Abtretung", "Exklusivität / MFN", "Mindestabnahme", "Haftung / Cap", "Freistellungen", "SLA / Vertragsstrafe", "Datenschutz / Security", "IP-Rechte", "Rechtswahl / Gerichtsstand", "Consent nötig?", "Risiko", "Maßnahme", "Owner", "Status", "VDR-Link", "Checklisten-Ref."]
    banner(ws_contract, "Vertragsprüfung", "Wesentliche Verträge einzeln erfassen. Finanzdaten, Vertragsregister und tatsächliche Durchführung gegeneinander abstimmen.", len(contract_headers) - 1)
    contract_first_row = 4
    for idx in range(1, 61):
        row = contract_first_row + idx - 1
        ws_contract.write(row, 0, f"V-{idx:03d}", fmt["text"])
        for col in range(1, len(contract_headers)):
            if col in (5,):
                ws_contract.write_blank(row, col, None, fmt["money_input"])
            elif col in (7, 8):
                ws_contract.write_blank(row, col, None, fmt["input_date"])
            else:
                ws_contract.write_blank(row, col, None, fmt["input"])
    contract_last_row = contract_first_row + 59
    add_table(ws_contract, 3, contract_last_row, contract_headers, "tblVertraege")
    for col, width in enumerate([12, 16, 24, 20, 34, 15, 20, 12, 12, 18, 18, 20, 16, 22, 18, 24, 24, 24, 24, 22, 24, 14, 30, 34, 18, 16, 26, 18]):
        ws_contract.set_column(col, col, width)
    ws_contract.set_default_row(46)
    ws_contract.freeze_panes(contract_first_row, 4)
    ws_contract.data_validation(contract_first_row, 1, contract_last_row, 1, input_hint("Vertragstyp", "Vertrag nach seinem wirtschaftlichen Hauptzweck klassifizieren.", validate="list", source="=Vertragstyp"))
    ws_contract.data_validation(contract_first_row, 2, contract_last_row, 6, input_hint("Vertragsstammdaten", "Gegenpartei, Konzernbezug, Leistung, Jahreswert und Kritikalität vollständig erfassen.", validate="any"))
    ws_contract.data_validation(contract_first_row, 7, contract_last_row, 8, input_hint("Vertragsdatum", "Beginn und Ende gemäß unterzeichnetem Vertrag im Format TT.MM.JJJJ.", validate="date", criteria="between", minimum=date(1900, 1, 1), maximum=date(2100, 12, 31)))
    ws_contract.data_validation(contract_first_row, 9, contract_last_row, 20, input_hint("Klauselprüfung", "Klauselinhalt, Schwellen, Fristen und Fundstelle knapp, aber eindeutig extrahieren.", validate="any"))
    ws_contract.data_validation(contract_first_row, 21, contract_last_row, 21, input_hint("Consent nötig?", "Zustimmungsbedarf juristisch beurteilen; bei Unsicherheit „Zu prüfen“.", validate="list", source="=JaNeinPruefen"))
    ws_contract.data_validation(contract_first_row, 22, contract_last_row, 24, input_hint("Risiko / Maßnahme", "Risiko, konkrete Behandlung und einen Owner dokumentieren.", validate="any"))
    ws_contract.data_validation(contract_first_row, 25, contract_last_row, 25, input_hint("Prüfstatus", "Abgeschlossen erst nach Review des vollständigen Vertrags samt Nachträgen.", validate="list", source="=Pruefstatus"))
    ws_contract.data_validation(contract_first_row, 26, contract_last_row, 27, input_hint("Vertragsreferenz", "VDR-Pfad und zugehörige Checklisten-ID eintragen.", validate="any"))

    # Specialized workstream sheets derived from master checklist.
    def workstream_sheet(sheet_name: str, title: str, area: str, owner_label: str) -> None:
        items = [item for item in checklist if item["area"] == area]
        ws_local = workbook.add_worksheet(sheet_name)
        headers = ["ID", "Thema", "Prüffrage", "Evidenz", "Test / Analyse", "Red Flags", "Reifegrad / Ergebnis", "Risiko", "Empfohlene Maßnahme", "Owner", "Fällig", "Status", "Master-Ref."]
        banner(ws_local, title, f"Vertiefungsmatrix für {area}. Ergebnisse in die Master-Checkliste und das Risikoregister zurückspiegeln.", len(headers) - 1)
        first_row = 4
        for idx, item in enumerate(items, start=1):
            row = first_row + idx - 1
            values = [f"{sheet_name[:2]}-{idx:02d}", item["subarea"], item["question"], item["documents"], item["analysis"], item["red_flags"], "", "", item["action"], owner_label, "", "Nicht begonnen", item["id"]]
            for col, value in enumerate(values):
                if col == 10:
                    ws_local.write_blank(row, col, None, fmt["input_date"])
                elif col in (6, 7, 9):
                    ws_local.write(row, col, value, fmt["input"])
                else:
                    ws_local.write(row, col, value, fmt["text"])
        last_row = first_row + len(items) - 1
        add_table(ws_local, 3, last_row, headers, f"tbl{sheet_name.replace('&', '').replace('_', '')}")
        for col, width in enumerate([11, 24, 40, 38, 40, 36, 22, 28, 42, 18, 13, 17, 15]):
            ws_local.set_column(col, col, width)
        ws_local.set_default_row(62)
        ws_local.freeze_panes(first_row, 3)
        ws_local.data_validation(first_row, 3, last_row, 5, input_hint("Vertiefungsnachweis", "Konkrete Evidenz, ausgeführten Test und beobachtete Red Flags dokumentieren.", validate="any"))
        ws_local.data_validation(first_row, 6, last_row, 6, input_hint("Reifegrad", "Nur anhand getesteter Gestaltung und Wirksamkeit einstufen.", validate="list", source="=Reifegrad"))
        ws_local.data_validation(first_row, 7, last_row, 7, input_hint("Risiko", "Bestätigtes Risiko mit Ursache, Umfang und Auswirkung beschreiben.", validate="any"))
        ws_local.data_validation(first_row, 9, last_row, 9, input_hint("Owner", "Eine fachlich verantwortliche Person oder Rolle eintragen.", validate="any"))
        ws_local.data_validation(first_row, 10, last_row, 10, input_hint("Fälligkeit", "Verbindliches Datum im Format TT.MM.JJJJ.", validate="date", criteria="between", minimum=date(2000, 1, 1), maximum=date(2100, 12, 31)))
        ws_local.data_validation(first_row, 11, last_row, 11, input_hint("Prüfstatus", "Abgeschlossen erst nach Evidenz und Review.", validate="list", source="=Pruefstatus"))
        conditional_status(ws_local, f"G{first_row+1}:L{last_row+1}")

    workstream_sheet("11_IT_Cyber", "IT- & Cyber-Vertiefung", "IT & Cyber", "CIO / CISO")
    workstream_sheet("12_HR", "HR- & Pensions-Vertiefung", "HR & Pensions", "CHRO / HR")
    workstream_sheet("13_Steuern", "Tax-Due-Diligence-Vertiefung", "Tax", "Head of Tax")

    # Deal mechanisms.
    ws_deal = workbook.add_worksheet("14_Deal_Mechanismen")
    deal_headers = ["Mechanismus", "Geeignet für", "Typische Anwendungsfälle", "Zentrale Ausgestaltung", "Adressiertes Risiko", "Federführung", "Konkrete Entscheidung / Bezug", "Status"]
    banner(ws_deal, "Deal-Mechanismen & Entscheidungshilfe", "Die Auswahl folgt dem Finding: quantifizieren, Doppelzählungen vermeiden und rechtliche/steuerliche Wirksamkeit prüfen.", len(deal_headers) - 1)
    deal_first_row = 4
    for idx, row_values in enumerate(DEAL_MECHANISMS):
        row = deal_first_row + idx
        values = list(row_values) + ["", "Zu prüfen"]
        for col, value in enumerate(values):
            ws_deal.write(row, col, value, fmt["input"] if col in (6, 7) else fmt["text"])
    deal_last_row = deal_first_row + len(DEAL_MECHANISMS) - 1
    add_table(ws_deal, 3, deal_last_row, deal_headers, "tblDealMechanismen")
    for col, width in enumerate([24, 28, 40, 45, 30, 20, 38, 16]):
        ws_deal.set_column(col, col, width)
    ws_deal.set_default_row(60)
    ws_deal.freeze_panes(deal_first_row, 1)
    ws_deal.data_validation(deal_first_row, 6, deal_last_row, 6, input_hint("Konkrete Entscheidung", "Finding-/Risiko-ID, beschlossenen Mechanismus und wesentliche Eckpunkte dokumentieren.", validate="any"))
    ws_deal.data_validation(deal_first_row, 7, deal_last_row, 7, input_hint("Entscheidungsstatus", "Aktuellen Abstimmungsstand auswählen.", validate="list", source=["Zu prüfen", "In Verhandlung", "Beschlossen", "Verworfen", "Umgesetzt"]))

    # Sources.
    ws_sources = workbook.add_worksheet("15_Quellen")
    source_headers = ["Quellen-ID", "Titel", "Herausgeber", "URL", "Verwendung", "Hinweis", "Abrufdatum"]
    banner(ws_sources, "Quellen & methodische Hinweise", "Quellen dienen als Startpunkt. Für konkrete Entscheidungen sind aktuelle Primärquellen und qualifizierte Fachberater heranzuziehen.", len(source_headers) - 1)
    source_first_row = 4
    for idx, source in enumerate(SOURCES):
        row = source_first_row + idx
        for col, value in enumerate(source):
            if col == 3:
                ws_sources.write_url(row, col, value, fmt["link"], string=value)
            else:
                ws_sources.write(row, col, value, fmt["text"])
        ws_sources.write_datetime(row, 6, date(2026, 10, 6), fmt["date"])
    source_last_row = source_first_row + len(SOURCES) - 1
    add_table(ws_sources, 3, source_last_row, source_headers, "tblQuellen")
    for col, width in enumerate([12, 36, 24, 70, 32, 34, 13]):
        ws_sources.set_column(col, col, width)
    ws_sources.set_default_row(44)
    ws_sources.freeze_panes(source_first_row, 1)

    # Dashboard after all dependent sheets have been defined.
    ws_dash.set_tab_color(colors["teal"])
    banner(ws_dash, "Due-Diligence-Dashboard", "Automatische Übersicht aus Checkliste, Dokumenten-, Risiko- und Maßnahmenregistern. Excel berechnet die Kennzahlen beim Öffnen neu.", 13)
    ws_dash.set_column("A:N", 14)
    ws_dash.write("A3", "Zielunternehmen", fmt["label"])
    ws_dash.merge_range("B3:D3", "", fmt["formula"])
    ws_dash.write_formula("B3", "=Zielunternehmen", fmt["formula"], "")
    ws_dash.write("E3", "Transaktion", fmt["label"])
    ws_dash.merge_range("F3:H3", "", fmt["formula"])
    ws_dash.write_formula("F3", "=Transaktionstyp_Auswahl", fmt["formula"], "Share Deal")
    ws_dash.write("I3", "Stichtag", fmt["label"])
    ws_dash.merge_range("J3:K3", "", fmt["formula"])
    ws_dash.write_formula("J3", "=DD_Stichtag", fmt["formula"], "")
    ws_dash.write("L3", "Checklistenpunkte", fmt["label"])
    ws_dash.merge_range("M3:N3", len(checklist), fmt["formula_int"])

    kpis = [
        ("Prüfpunkte gesamt", '=COUNTA(\'02_Checkliste\'!$A$5:$A$1000)', len(checklist), fmt["kpi_value"]),
        ("Abgeschlossen", '=COUNTIF(\'02_Checkliste\'!$J$5:$J$1000,"Abgeschlossen")', 0, fmt["kpi_value"]),
        ("Fortschritt", '=IFERROR(COUNTIF(\'02_Checkliste\'!$J$5:$J$1000,"Abgeschlossen")/COUNTA(\'02_Checkliste\'!$A$5:$A$1000),0)', 0, fmt["kpi_pct"]),
        ("Risiko unbewertet", '=COUNTIFS(\'02_Checkliste\'!$A$5:$A$1000,"<>",\'02_Checkliste\'!$P$5:$P$1000,"")', len(checklist), fmt["kpi_value"]),
        ("Hoch / kritisch", '=COUNTIF(\'02_Checkliste\'!$P$5:$P$1000,"Hoch")+COUNTIF(\'02_Checkliste\'!$P$5:$P$1000,"Kritisch")', 0, fmt["kpi_value"]),
        ("Kritische Doks offen", '=COUNTIFS(\'03_Dokumente\'!$F$5:$F$1000,"Kritisch",\'03_Dokumente\'!$L$5:$L$1000,"<>Vollständig")', sum(1 for x in checklist if x["priority"] == "Kritisch"), fmt["kpi_value"]),
        ("Maßnahmen überfällig", '=COUNTIFS(\'05_Maßnahmen\'!$L$5:$L$500,"<"&TODAY(),\'05_Maßnahmen\'!$L$5:$L$500,"<>",\'05_Maßnahmen\'!$M$5:$M$500,"<>Erledigt")', 0, fmt["kpi_value"]),
        ("Exposure Base", '=SUM(\'04_Risiken\'!$M$5:$M$500)', 0, fmt["kpi_money"]),
    ]
    positions = [(4, 0), (4, 4), (4, 8), (4, 12), (8, 0), (8, 4), (8, 8), (8, 12)]
    for (label, formula, cached, value_format), (row, col) in zip(kpis, positions):
        end_col = min(col + 1, 13)
        ws_dash.merge_range(row, col, row, end_col, label, fmt["kpi_label"])
        ws_dash.merge_range(row + 1, col, row + 2, end_col, "", value_format)
        ws_dash.write_formula(row + 1, col, formula, value_format, cached)
        ws_dash.set_row(row + 1, 24)
        ws_dash.set_row(row + 2, 24)

    area_counts = Counter(item["area"] for item in checklist)
    areas = list(area_counts.keys())
    summary_row = 12
    ws_dash.merge_range(summary_row, 0, summary_row, 5, "Fortschritt nach Prüfbereich", fmt["section"])
    sum_headers = ["Prüfbereich", "Umfang", "Abgeschlossen", "Fortschritt", "Unbewertet", "Hoch/kritisch"]
    for col, header in enumerate(sum_headers):
        ws_dash.write(summary_row + 1, col, header, fmt["header"])
    for idx, area in enumerate(areas):
        row = summary_row + 2 + idx
        escaped = area.replace('"', '""')
        ws_dash.write(row, 0, area, fmt["text"])
        ws_dash.write_formula(row, 1, f'=COUNTIF(\'02_Checkliste\'!$B$5:$B$1000,"{escaped}")', fmt["formula_int"], area_counts[area])
        ws_dash.write_formula(row, 2, f'=COUNTIFS(\'02_Checkliste\'!$B$5:$B$1000,"{escaped}",\'02_Checkliste\'!$J$5:$J$1000,"Abgeschlossen")', fmt["formula_int"], 0)
        ws_dash.write_formula(row, 3, f'=IFERROR(C{row+1}/B{row+1},0)', fmt["formula_pct"], 0)
        ws_dash.write_formula(row, 4, f'=COUNTIFS(\'02_Checkliste\'!$B$5:$B$1000,"{escaped}",\'02_Checkliste\'!$P$5:$P$1000,"")', fmt["formula_int"], area_counts[area])
        ws_dash.write_formula(row, 5, f'=COUNTIFS(\'02_Checkliste\'!$B$5:$B$1000,"{escaped}",\'02_Checkliste\'!$P$5:$P$1000,"Hoch")+COUNTIFS(\'02_Checkliste\'!$B$5:$B$1000,"{escaped}",\'02_Checkliste\'!$P$5:$P$1000,"Kritisch")', fmt["formula_int"], 0)
    summary_last_row = summary_row + 1 + len(areas)
    add_table(ws_dash, summary_row + 1, summary_last_row, sum_headers, "tblDashboardBereiche", style="Table Style Medium 4")
    ws_dash.set_column("A:A", 28)
    ws_dash.set_column("B:F", 14)
    ws_dash.conditional_format(summary_row + 2, 3, summary_last_row, 3, {"type": "data_bar", "bar_color": colors["teal"]})

    chart = workbook.add_chart({"type": "bar"})
    chart.add_series({
        "name": "Umfang",
        "categories": f"='01_Dashboard'!$A${summary_row+3}:$A${summary_last_row+1}",
        "values": f"='01_Dashboard'!$B${summary_row+3}:$B${summary_last_row+1}",
        "fill": {"color": colors["light_blue"]},
        "border": {"color": colors["blue"]},
    })
    chart.add_series({
        "name": "Abgeschlossen",
        "categories": f"='01_Dashboard'!$A${summary_row+3}:$A${summary_last_row+1}",
        "values": f"='01_Dashboard'!$C${summary_row+3}:$C${summary_last_row+1}",
        "fill": {"color": colors["dark_green"]},
    })
    chart.set_title({"name": "Prüfungsfortschritt"})
    chart.set_legend({"position": "bottom"})
    chart.set_style(10)
    chart.set_size({"width": 780, "height": 430})
    ws_dash.insert_chart("H14", chart)

    gate_row = summary_last_row + 3
    ws_dash.merge_range(gate_row, 0, gate_row, 13, "Entscheidungs-Gates", fmt["section"])
    gate_headers = ["Gate", "Leitfrage", "Status", "Owner", "Entscheidung / Kommentar"]
    for col, header in enumerate(gate_headers):
        ws_dash.write(gate_row + 1, col, header, fmt["header"])
        register_field_help(ws_dash, gate_row + 1, col, header)
    gates = [
        ("G1", "Sind Deal Perimeter und Eigentum zweifelsfrei?"),
        ("G2", "Sind normalisiertes EBITDA, Net Debt und NWC belastbar?"),
        ("G3", "Sind Genehmigungen, Consents und Finanzierung auf kritischem Pfad gesichert?"),
        ("G4", "Sind wesentliche Legal-, Tax-, Compliance-, Cyber- und ESG-Risiken mitigiert?"),
        ("G5", "Sind Day 1, TSA und Schlüsselpersonen einsatzbereit?"),
        ("G6", "Ist der verbleibende Downside innerhalb der genehmigten Risikotoleranz?"),
    ]
    for idx, (gate, question) in enumerate(gates):
        row = gate_row + 2 + idx
        ws_dash.write(row, 0, gate, fmt["text"])
        ws_dash.write(row, 1, question, fmt["text"])
        ws_dash.write(row, 2, "Offen", fmt["input"])
        ws_dash.write_blank(row, 3, None, fmt["input"])
        ws_dash.merge_range(row, 4, row, 13, "", fmt["input"])
    ws_dash.data_validation(
        gate_row + 2,
        2,
        gate_row + 1 + len(gates),
        2,
        input_hint(
            "Gate-Status",
            "Offen, Bedingt erfüllt, Erfüllt oder No-go eintragen; Entscheidung im Kommentarfeld belegen.",
            validate="list",
            source=["Offen", "Bedingt erfüllt", "Erfüllt", "No-go"],
        ),
    )
    ws_dash.data_validation(
        gate_row + 2,
        3,
        gate_row + 1 + len(gates),
        3,
        input_hint("Gate-Owner", "Eine entscheidungsverantwortliche Person oder Rolle eintragen.", validate="any"),
    )
    ws_dash.data_validation(
        gate_row + 2,
        4,
        gate_row + 1 + len(gates),
        13,
        input_hint("Gate-Entscheidung", "Entscheidung, Datum, Entscheider, Bedingungen und Referenzen dokumentieren.", validate="any"),
    )
    ws_dash.freeze_panes(3, 0)
    ws_dash.hide_gridlines(2)

    # Central fill-in guide. The registry is populated by all table headers and
    # standalone input fields above.
    banner(
        ws_help,
        "Ausfüllhilfe & Feldhandbuch",
        "Startpunkt für die Bearbeitung: Tabellen filtern, gewünschtes Arbeitsblatt öffnen und Hinweise in den kommentierten Spaltenköpfen beachten.",
        8,
    )
    ws_help.set_tab_color(colors["dark_green"])
    ws_help.set_column("A:A", 24)
    ws_help.set_column("B:B", 30)
    ws_help.set_column("C:D", 18)
    ws_help.set_column("E:E", 46)
    ws_help.set_column("F:F", 36)
    ws_help.set_column("G:G", 20)
    ws_help.set_column("H:H", 34)
    ws_help.set_column("I:I", 42)
    ws_help.merge_range("A4:I4", "Schnellstart", fmt["section"])
    quick_steps = [
        ("1", "Im Blatt 00_Start Zielunternehmen, Deal-Typ, Stichtag, Projektleitung, Währung und Materialität festlegen."),
        ("2", "In 03_Dokumente die Request List versenden, Owner und Fristen setzen; Datenqualität und VDR-Pfade laufend pflegen."),
        ("3", "In 02_Checkliste Status, Evidenz und Analyse dokumentieren. Ein Finding erst nach nachvollziehbarer Primärevidenz erfassen."),
        ("4", "Bestätigte Risiken nach 04_Risiken übertragen bzw. dort bewerten: Eintritt, Auswirkung und Exposure Low/Base/High getrennt bestimmen."),
        ("5", "In 05_Maßnahmen nur passende Vorschläge aktivieren; genau einen Owner, Termin, Budget, KPI und ein messbares Abnahmekriterium festlegen."),
        ("6", "Dashboard und Entscheidungs-Gates vor Signing/Closing reviewen; Preis-, SPA-, Finanzierungs- und Integrationsfolgen beschließen."),
    ]
    for row, (number, instruction) in enumerate(quick_steps, start=4):
        ws_help.write(row, 0, number, fmt["label"])
        ws_help.merge_range(row, 1, row, 8, instruction, fmt["text"])
        ws_help.set_row(row, 32)
    ws_help.merge_range("A12:I12", "Farben und Bedienung", fmt["section"])
    legends = [
        ("Gelb", colors["yellow"], "Eingabe oder aktiv zu bestätigende Auswahl"),
        ("Hellblau", colors["light_blue"], "Automatische Formel – nicht überschreiben"),
        ("Rot/Orange", colors["red"], "Eskalation, hohe Priorität oder überfälliger Punkt"),
        ("Kommentarindikator", colors["purple"], "Spaltenkopf oder Feld auswählen/überfahren, um die kontextbezogene Ausfüllhilfe zu lesen"),
    ]
    for row, (label, color, meaning) in enumerate(legends, start=12):
        ws_help.write(row, 0, label, workbook.add_format({"bold": True, "bg_color": color, "border": 1}))
        ws_help.merge_range(row, 1, row, 8, meaning, fmt["text"])

    sheet_guides = [
        ("00_Start", "Projektparameter, Scoring und Grundregeln festlegen", "M&A-Projektleitung", "Projektstart / Scope-Änderung", "Freigegebene Projektbasis"),
        ("00_Ausfüllhilfe", "Felddefinitionen, Beispiele und Qualitätsregeln nachschlagen", "Alle Bearbeiter", "Vor und während jeder Eingabe", "Einheitliche Datenerfassung"),
        ("01_Dashboard", "Fortschritt und Entscheidungsreife überwachen", "PMO / Deal Lead", "Wöchentlich und vor Gates", "Management- und IC-Übersicht"),
        ("02_Checkliste", "Alle Prüfhypothesen bearbeiten und Findings dokumentieren", "Workstream Leads", "Laufend", "Vollständiger DD-Status"),
        ("03_Dokumente", "VDR-Anforderungen, Fristen und Datenqualität steuern", "PMO / Zielunternehmen", "Ab Scope-Freigabe", "Vollständige Request List"),
        ("04_Risiken", "Bestätigte Risiken bewerten, quantifizieren und entscheiden", "Workstream Leads / Deal Lead", "Nach Evidenz", "Priorisiertes Risikoregister"),
        ("05_Maßnahmen", "Mitigation, Deal-Schutz und Umsetzung nachhalten", "Maßnahmen-Owner", "Nach Finding / bis Closing", "Verbindlicher Aktionsplan"),
        ("06_Q&A", "Offene Fragen und schriftliche Antworten steuern", "Prüfer / Management", "Während der Analyse", "Nachvollziehbarer Q&A-Audit-Trail"),
        ("07_Finanzanalyse", "Historische Entwicklung, Cash Conversion und Bilanzkennzahlen analysieren", "Financial-DD-Team", "Nach Datenlieferung", "Normalisierte Finanzbasis"),
        ("08_QoE", "EBITDA-Normalisierungen einzeln belegen und entscheiden", "Financial-DD-Team", "Nach GuV-/Kontenanalyse", "Reported-to-normalized Bridge"),
        ("09_NWC_NetDebt", "NWC-Peg und Net-Debt-/Debt-like-Definition vorbereiten", "Finance / Legal", "Vor SPA-Verhandlung", "Closing-Mechanik"),
        ("10_Verträge", "Wesentliche Klauseln und Consents je Vertrag extrahieren", "Legal-DD-Team", "Nach Vertragslieferung", "Vertragsrisiko- und Consent-Liste"),
        ("11_IT_Cyber", "IT- und Cyberkontrollen vertieft bewerten", "CIO/CISO-DD-Team", "Vollprüfung", "IT-/Cyber-Remediation"),
        ("12_HR", "Personal-, Retention- und Pensionsrisiken vertieft bewerten", "HR-DD-Team", "Vollprüfung / Clean Team", "People-Risikoübersicht"),
        ("13_Steuern", "Steuerrisiken nach Themen vertieft dokumentieren", "Tax-DD-Team", "Vollprüfung", "Tax-Risk- und Indemnity-Basis"),
        ("14_Deal_Mechanismen", "Geeignete wirtschaftliche und vertragliche Schutzmechanismen auswählen", "Deal Lead / Legal / Tax", "SPA-/Preisverhandlung", "Beschlossene Risikobehandlung"),
        ("15_Quellen", "Methodische und rechtliche Ausgangsquellen nachvollziehen", "Alle Workstreams", "Bei Methodik-/Rechtsfragen", "Quellenverzeichnis"),
    ]
    nav_section_row = 17
    ws_help.merge_range(nav_section_row, 0, nav_section_row, 8, "Blattnavigation und Bearbeitungsreihenfolge", fmt["section"])
    nav_header_row = nav_section_row + 1
    nav_headers = ["Arbeitsblatt", "Zweck", "Wer füllt aus?", "Wann?", "Hauptausgabe"]
    nav_first_row = nav_header_row + 1
    for idx, guide in enumerate(sheet_guides):
        row = nav_first_row + idx
        sheet_name, purpose, owner, timing, output = guide
        ws_help.write_url(row, 0, f"internal:'{sheet_name}'!A1", fmt["link"], string=sheet_name)
        ws_help.write_row(row, 1, [purpose, owner, timing, output], fmt["text"])
    nav_last_row = nav_first_row + len(sheet_guides) - 1
    ws_help.add_table(
        nav_header_row,
        0,
        nav_last_row,
        len(nav_headers) - 1,
        {"name": "tblBlattnavigation", "style": "Table Style Medium 4", "columns": [{"header": h} for h in nav_headers]},
    )
    ws_help.set_row(nav_header_row, 36)

    # De-duplicate standalone and table registrations while preserving order.
    unique_help: list[dict[str, str]] = []
    seen_help: set[tuple[str, str]] = set()
    for item in help_registry:
        key = (item["sheet"], item["field"])
        if item["sheet"].startswith("_") or key in seen_help:
            continue
        seen_help.add(key)
        unique_help.append(item)
    field_section_row = nav_last_row + 2
    ws_help.merge_range(field_section_row, 0, field_section_row, 8, "Detaillierte Feldhilfe – nach Arbeitsblatt oder Feld filtern", fmt["section"])
    field_header_row = field_section_row + 1
    field_first_row = field_header_row + 1
    field_headers = ["Arbeitsblatt", "Feld / Spalte", "Bearbeitung", "Pflichtgrad", "Was eintragen?", "Beispiel", "Format", "Quelle / Nachweis", "Qualitätsregel / typischer Fehler"]
    for idx, item in enumerate(unique_help):
        row = field_first_row + idx
        ws_help.write_url(row, 0, f"internal:'{item['sheet']}'!A1", fmt["link"], string=item["sheet"])
        ws_help.write_row(
            row,
            1,
            [
                item["field"],
                item["mode"],
                item["required"],
                item["entry"],
                item["example"],
                item["format"],
                item["source"],
                item["quality"],
            ],
            fmt["text"],
        )
    field_last_row = field_first_row + len(unique_help) - 1
    ws_help.add_table(
        field_header_row,
        0,
        field_last_row,
        len(field_headers) - 1,
        {"name": "tblFeldhilfe", "style": "Table Style Medium 2", "columns": [{"header": h} for h in field_headers]},
    )
    ws_help.set_row(field_header_row, 44)
    ws_help.set_default_row(48)
    # Keep only the title area and the two navigation columns visible.
    # Freezing up to field_first_row would lock roughly 39 rows and leave no
    # practical scroll area on smaller Excel windows.
    ws_help.freeze_panes(3, 2)

    # Open the workbook on the guide for first-time users.
    ws_help.activate()
    ws_help.set_first_sheet()
    workbook.close()
    print(f"Erstellt: {OUTPUT}")
    print(f"Prüfpunkte: {len(checklist)}")
    print(f"Dokumentenanforderungen: {len(checklist)}")
    print(f"Prüfhypothesen/Maßnahmen: {len(risk_candidates)}")
    print(f"Dokumentierte Eingabefelder: {len(unique_help)}")


if __name__ == "__main__":
    main()
