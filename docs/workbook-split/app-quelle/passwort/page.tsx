import Shell from '../components/Shell';
import PasswortFormular from './PasswortFormular';
import { requireUser } from '@/lib/guard';
import { passwortWechselFaellig } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function PasswortSeite({ searchParams }:
  { searchParams: Promise<Record<string, string>> }) {

  const benutzer = await requireUser();
  const sp = await searchParams;
  const faellig = await passwortWechselFaellig(benutzer.benutzer_id);

  return (
    <Shell titel="Passwort ändern" bereich={benutzer.email} aktiv="passwort" benutzer={benutzer}>
      {faellig && (
        <div className="note warn">
          <b>Für dieses Konto steht ein Passwortwechsel an.</b> Es wurde aus dem Altsystem
          übernommen und war dort zum Wechsel vorgemerkt – vermutlich läuft es noch auf einem
          vergebenen Startpasswort. Bitte jetzt ändern.
        </div>
      )}
      {sp.grund === 'pflicht' && !faellig && (
        <div className="note">Das Passwort ist gesetzt. Sie können weiterarbeiten.</div>
      )}
      <PasswortFormular email={benutzer.email} />
    </Shell>
  );
}
