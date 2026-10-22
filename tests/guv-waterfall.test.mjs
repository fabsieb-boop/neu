import assert from "node:assert/strict";
import test from "node:test";

import { buildGuvWaterfall } from "../src/lib/guv-waterfall.ts";

test("Wasserfall endet beim GuV-EBITDA und enthält alle EBITDA-Bestandteile", () => {
  const rows = [
    { name: "Summe Umsatzerlöse", values: [120, 80] },
    { name: "Rohertrag", values: [70, 50] },
    { name: "Andere sonstige betriebliche Ertraege", values: [10, 5] },
    { name: "Personalaufwand", values: [-20, -20] },
    { name: "Sachkosten", values: [-15, -10] },
    { name: "Neutrales Ergebnis", values: [3, 2] },
    { name: "EBITDA", values: [40, 35] },
    { name: "Abschreibungen", values: [-10, -10] },
    { name: "Finanzergebnis", values: [-5, -5] },
    { name: "Ergebnis vor Steuern", values: [25, 20] },
  ];

  const result = buildGuvWaterfall(rows);
  const finalBar = result.wf.at(-1);
  const signedFinal = finalBar.neg ? -finalBar.val : finalBar.val;

  assert.deepEqual(result.steps.map(([name]) => name), [
    "Umsatz",
    "bis Rohertrag",
    "Sonst. Erträge",
    "Personal",
    "Sachkosten",
    "Neutral",
  ]);
  assert.equal(result.run, result.ebitda);
  assert.equal(signedFinal, result.ebitda);
  assert.equal(finalBar.name, "EBITDA");
});
