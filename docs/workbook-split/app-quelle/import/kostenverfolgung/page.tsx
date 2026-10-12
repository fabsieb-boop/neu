import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Kostenverfolgung wird im Cockpit-Import hochgeladen, nicht in der alten Maske. */
export default function KvImportSeite() {
  redirect('/dash#importmanager');
}
