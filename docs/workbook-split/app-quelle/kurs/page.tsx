import { redirect } from 'next/navigation';

/* Der Kurs ist eine fertige HTML-Datei unter public/dateien.  Die Route haelt
   nur die kurze, merkbare Adresse /kurs darauf.  Sie lag bisher allein auf dem
   Server und war in keinem Commit – beim Ausliefern verschwand deshalb ihr
   Menueintrag. */

export const dynamic = 'force-dynamic';

export default function Seite() {
  redirect('/dateien/TVF-Kurs-Projektabrechnung.html');
}
