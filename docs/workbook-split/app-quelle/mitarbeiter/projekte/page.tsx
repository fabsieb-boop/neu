import MitarbeiterSeite from '../page';

/* Eigene Adresse für den Reiter, damit er sich verlinken lässt. */
export const dynamic = 'force-dynamic';

export default function Seite({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return <MitarbeiterSeite searchParams={searchParams} teil="projekte" />;
}
