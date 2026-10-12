import LiquiditaetSeite from '../page';

/* Eigene Adresse für den Teilbereich – die Seite liegt eine Ebene höher
   und zeigt nur den hier angeforderten Abschnitt. */
export const dynamic = 'force-dynamic';

export default function Seite({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return <LiquiditaetSeite searchParams={searchParams} teil="herleitung" />;
}
