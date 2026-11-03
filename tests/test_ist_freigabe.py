from __future__ import annotations

import shutil
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server import model  # noqa: E402
from scripts.import_excel import import_workbook  # noqa: E402


class IstFreigabeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database = Path(self.temp_dir.name) / "tvf.sqlite"
        shutil.copy2(ROOT / "data" / "tvf.sqlite", self.database)
        self.original_database = model.DB
        model.DB = self.database

    def tearDown(self) -> None:
        model.DB = self.original_database
        self.temp_dir.cleanup()

    def connection(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database)
        connection.row_factory = sqlite3.Row
        return connection

    def test_sheet_stays_september_until_a_month_is_released(self) -> None:
        dashboard = model.build()
        october = next(month for month in dashboard["months"] if month["m"] == 10)
        umsatz = next(row for row in dashboard["guv"] if row["name"] == "Summe Umsatzerlöse")

        self.assertEqual(dashboard["letzterIst"], 9)
        self.assertEqual(dashboard["mappeMonat"], 9)
        self.assertFalse(dashboard["freigabeGesetzt"])
        self.assertFalse(october["ist"])
        self.assertAlmostEqual(october["umsatz"], 1351000, places=2)
        self.assertAlmostEqual(october["ebitda"], 278192, places=2)
        self.assertEqual(len(umsatz["values"]), 12)
        self.assertAlmostEqual(umsatz["values"][9], 1351000, places=2)
        vorleistungen = next(row for row in dashboard["guv"] if row["name"] == "Vorleistungen")
        sachkosten = next(row for row in dashboard["guv"] if row["name"] == "Sachkosten")
        self.assertAlmostEqual(vorleistungen["values"][9], -930250, places=2)
        self.assertAlmostEqual(sachkosten["values"][9], -142558, places=2)
        self.assertIsNone(next(row for row in dashboard["guv"] if row["name"] == "Erl. sonst. DL Deutschland")["values"][9])

    def test_released_october_shows_journal_figures_and_can_return_to_the_sheet(self) -> None:
        before = model.build()
        september_umsatz = next(row for row in before["guv"] if row["name"] == "Summe Umsatzerlöse")["values"][8]
        october_plan = next(month for month in before["months"] if month["m"] == 10)["ebitda"]

        model.set_ist_freigabe(10)
        released = model.build()
        october = next(month for month in released["months"] if month["m"] == 10)
        umsatz = next(row for row in released["guv"] if row["name"] == "Summe Umsatzerlöse")
        ebitda = next(row for row in released["guv"] if row["name"] == "EBITDA")
        leaf = next(row for row in released["guv"] if row["name"] == "Erl. sonst. DL Deutschland")

        self.assertEqual(released["letzterIst"], 10)
        self.assertEqual(released["mappeMonat"], 9)
        self.assertTrue(released["freigabeGesetzt"])
        self.assertTrue(october["ist"])
        self.assertAlmostEqual(october["umsatz"], -179903.49, places=2)
        self.assertAlmostEqual(october["leistung"], october["umsatz"] + october["bestand"], places=2)
        self.assertAlmostEqual(october["ebitda"], ebitda["values"][9], places=2)
        self.assertNotEqual(round(october["ebitda"], 2), 0)
        self.assertEqual(len(umsatz["values"]), 12)
        self.assertAlmostEqual(umsatz["values"][9], -179903.49, places=2)
        self.assertAlmostEqual(umsatz["values"][10], 2099750, places=2)
        self.assertAlmostEqual(umsatz["values"][8], september_umsatz, places=2)
        self.assertIsNone(leaf["values"][9])

        with self.connection() as connection:
            project = connection.execute(
                "SELECT projekt_nr FROM projekt WHERE status = 'AKTIV' ORDER BY projekt_id LIMIT 1"
            ).fetchone()["projekt_nr"]
        with self.assertRaisesRegex(model.ForecastInputError, "letzten Ist-Monat"):
            model.add_forecast_plan(project, "kosten", [{"monat": 10, "wert": 100.0}])
        model.add_forecast_plan(project, "kosten", [{"monat": 11, "wert": 100.0}])

        model.set_ist_freigabe(None)
        restored = model.build()
        restored_october = next(month for month in restored["months"] if month["m"] == 10)
        self.assertEqual(restored["letzterIst"], 9)
        self.assertFalse(restored["freigabeGesetzt"])
        self.assertFalse(restored_october["ist"])
        self.assertAlmostEqual(restored_october["umsatz"], 1351000, places=2)
        self.assertAlmostEqual(restored_october["ebitda"], october_plan, places=2)
        self.assertEqual(
            len(next(row for row in restored["guv"] if row["name"] == "Summe Umsatzerlöse")["values"]),
            12,
        )

    def test_excel_import_keeps_the_released_month(self) -> None:
        model.set_ist_freigabe(11)
        import_workbook(ROOT / "data" / "tvf-dashboard-download.xlsx", self.database)

        with self.connection() as connection:
            stored = connection.execute("SELECT monat FROM ist_freigabe").fetchone()["monat"]
            sheet = connection.execute("SELECT letzter_ist_monat FROM parameter").fetchone()["letzter_ist_monat"]
        dashboard = model.build()

        self.assertEqual(stored, 11)
        self.assertEqual(sheet, 9)
        self.assertEqual(dashboard["letzterIst"], 11)
        self.assertEqual(dashboard["mappeMonat"], 9)
        november = next(month for month in dashboard["months"] if month["m"] == 11)
        self.assertTrue(november["ist"])

    def test_rejects_a_month_outside_the_year(self) -> None:
        with self.assertRaisesRegex(model.SystemInputError, "Monat"):
            model.set_ist_freigabe(13)
        dashboard = model.build()
        self.assertEqual(dashboard["letzterIst"], 9)
