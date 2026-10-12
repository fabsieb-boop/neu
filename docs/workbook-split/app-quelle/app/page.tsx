import Shell from '../components/Shell';
import { requireUser } from '@/lib/guard';
import QRCode from 'qrcode';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function AppSeite() {
  const benutzer = await requireUser();

  /* Die Adresse aus der laufenden Anfrage bilden, nicht fest eintragen:
     so stimmt der Code auch, wenn das Cockpit über eine andere Adresse
     erreicht wird als die, unter der ich ihn erzeuge. */
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '130.61.222.216';
  const schema = (h.get('x-forwarded-proto') ?? 'http').split(',')[0].trim();
  // Die App liegt unter /mobil/ – /app ist diese Hinweisseite selbst.
  const adresse = `${schema}://${host}/mobil/`;

  const qr = await QRCode.toString(adresse, {
    type: 'svg', margin: 1, width: 260,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  return (
    <Shell titel="App auf das Telefon" bereich="Controlling-Cockpit unterwegs"
           aktiv="app" benutzer={benutzer}>

      <div className="note">
        <b>So kommt das Cockpit aufs Telefon.</b> Die App braucht keinen App Store und keine
        Installation im herkömmlichen Sinn: Code scannen, Seite öffnen, zum Startbildschirm
        hinzufügen. Danach startet sie wie jede andere App – mit eigenem Symbol und ohne
        Adressleiste.
      </div>

      <div className="grid-wide">
        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Mit der Kamera scannen</div><h2>QR-Code</h2></div>
          </div>
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div className="qrrahmen" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mono" style={{ marginTop: 12, fontSize: 13 }}>{adresse}</p>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              Falls das Scannen nicht klappt: Adresse abtippen.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><div className="eyebrow">Schritt für Schritt</div><h2>Einrichten</h2></div>
          </div>
          <div className="card-body">
            <div className="deflist">
              <div><b>iPhone</b>
                <span>Code mit der Kamera scannen, Seite in Safari öffnen. Dann auf das
                      Teilen-Symbol tippen und <i>Zum Home-Bildschirm</i> wählen.</span></div>
              <div><b>Android</b>
                <span>Code scannen, Seite in Chrome öffnen. Im Menü rechts oben
                      <i> App installieren</i> oder <i>Zum Startbildschirm zufügen</i> wählen.</span></div>
              <div><b>Anmeldung</b>
                <span>Dieselbe E-Mail-Adresse und dasselbe Passwort wie im Browser. Die
                      Anmeldung hält 30 Tage, danach einmal neu eingeben.</span></div>
              <div><b>Was die App zeigt</b>
                <span>Ergebnis bis zum letzten vollständigen Monat, erwartetes Jahresergebnis,
                      Gesamtleistung, Liquiditätssaldo und das Ergebnis je Region. Wer nur
                      bestimmte Regionen sehen darf, sieht auch in der App nur diese.</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <span className="muted" style={{ fontSize: 12.5 }}>
            Die App wird aus derselben Datenbank gespeist wie diese Oberfläche – es gibt keine
            zweite Zahlenwelt. Sie greift über eine eigene Schnittstelle zu, die dieselben
            Rechte und Regionsfreigaben auswertet.
          </span>
        </div>
      </div>
    </Shell>
  );
}
