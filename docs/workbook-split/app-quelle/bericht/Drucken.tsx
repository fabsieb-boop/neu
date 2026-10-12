'use client';

/** Druckdialog des Browsers. Die Druckformatierung steckt in globals.css. */
export default function Drucken() {
  return (
    <button className="btn" type="button" onClick={() => window.print()}>
      Drucken oder als PDF sichern
    </button>
  );
}
