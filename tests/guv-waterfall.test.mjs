import assert from "node:assert/strict";
import test from "node:test";

import { buildGuvWaterfall } from "../src/lib/guv-waterfall.ts";

test("Wasserfall endet beim GuV-EBITDA und enthält alle EBITDA-Bestandteile", () => {
  const rows = [
    { name: "Umsatzerloese", values: [120, 80] },
    { name: "Rohertrag", values: [70, 50] },
    { name: "Sonstige betriebliche Ertraege", values: [10, 5] },
    { name: "Personalaufwand", values: [-20, -20] },
    { name: "Sonstige betriebliche Aufwendungen", values: [-15, -10] },
    { name: "Sonstige Steuern", values: [0, 0] },
    { name: "Neutrales Ergebnis", values: [3, 2] },
    { name: "EBITDA", values: [45, 25] },
    { name: "Abschreibungen", values: [-10, -10] },
    { name: "Zinsen und Steuern", values: [-5, -5] },
    { name: "Ergebnis", values: [33, 12] },
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
  ]);
  assert.equal(result.run, result.ebitda);
  assert.equal(signedFinal, result.ebitda);
  assert.equal(finalBar.name, "EBITDA");
});
