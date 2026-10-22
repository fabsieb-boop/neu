type GuvSourceRow = {
  name: string;
  values: number[];
};

export type WaterfallBar = {
  name: string;
  base: number;
  val: number;
  neg: boolean;
};

export function buildGuvWaterfall(rows: GuvSourceRow[]) {
  const total = (name: string) => {
    const row = rows.find((item) => item.name === name);
    if (!row) throw new Error(`GuV-Zeile fehlt: ${name}`);
    return row.values.reduce((sum, value) => sum + value, 0);
  };

  const umsatz = total("Summe Umsatzerlöse");
  const steps: [string, number][] = [
    ["Umsatz", umsatz],
    ["bis Rohertrag", total("Rohertrag") - umsatz],
    ["Sonst. Erträge", total("Andere sonstige betriebliche Ertraege")],
    ["Personal", total("Personalaufwand")],
    ["Sachkosten", total("Sachkosten")],
    ["Neutral", total("Neutrales Ergebnis")],
  ];

  let run = 0;
  const wf: WaterfallBar[] = steps.map(([name, value]) => {
    const start = run;
    run += value;
    return { name, base: Math.min(start, run), val: Math.abs(value), neg: value < 0 };
  });

  const ebitda = total("EBITDA");
  wf.push({ name: "EBITDA", base: Math.min(0, ebitda), val: Math.abs(ebitda), neg: ebitda < 0 });
  return { steps, run, ebitda, wf };
}
