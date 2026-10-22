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


class ForecastInputTest(unittest.TestCase):
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

    def active_project(self) -> sqlite3.Row:
        with self.connection() as connection:
            return connection.execute(
                """
                SELECT projekt_nr, name, region
                FROM projekt
                WHERE status = 'AKTIV'
                ORDER BY projekt_id
                LIMIT 1
                """
            ).fetchone()

    def test_saves_plan_rows_and_reverses_only_revenue_sign(self) -> None:
        project = self.active_project()
        with self.connection() as connection:
            before = connection.execute("SELECT COUNT(*) FROM forecast_plan").fetchone()[0]

        result = model.add_forecast_plan(
            project["projekt_nr"],
            "umsatz",
            [{"monat": 10, "wert": 1234.56}, {"monat": 11, "wert": -250.0}],
        )

        with self.connection() as connection:
            rows = connection.execute(
                """
                SELECT jahr, region, auftrag, auftragname, groesse, art, monat, wert
                FROM forecast_plan
                ORDER BY rowid DESC
                LIMIT 2
                """
            ).fetchall()[::-1]
            after = connection.execute("SELECT COUNT(*) FROM forecast_plan").fetchone()[0]
            jahr = connection.execute("SELECT jahr FROM parameter").fetchone()[0]

        self.assertEqual(after, before + 2)
        self.assertEqual(len(result), 2)
        self.assertEqual(
            [tuple(row) for row in rows],
            [
                (jahr, project["region"], project["projekt_nr"], project["name"], "umsatz", "plan", 10, -1234.56),
                (jahr, project["region"], project["projekt_nr"], project["name"], "umsatz", "plan", 11, 250.0),
            ],
        )

    def test_rejects_invalid_batch_without_partial_insert(self) -> None:
        project = self.active_project()
        with self.connection() as connection:
            before = connection.execute("SELECT COUNT(*) FROM forecast_plan").fetchone()[0]

        with self.assertRaisesRegex(model.ForecastInputError, "Monat"):
            model.add_forecast_plan(
                project["projekt_nr"],
                "kosten",
                [{"monat": 10, "wert": 100.0}, {"monat": 13, "wert": 200.0}],
            )

        with self.connection() as connection:
            after = connection.execute("SELECT COUNT(*) FROM forecast_plan").fetchone()[0]
        self.assertEqual(after, before)

    def test_accepts_only_active_known_orders_and_forecast_fields(self) -> None:
        with self.connection() as connection:
            inactive = connection.execute(
                "SELECT projekt_nr FROM projekt WHERE status <> 'AKTIV' ORDER BY projekt_id LIMIT 1"
            ).fetchone()[0]
            columns = [row[1] for row in connection.execute("PRAGMA table_info(forecast_plan)")]

        with self.assertRaisesRegex(model.ForecastInputError, "nicht gefunden"):
            model.add_forecast_plan(inactive, "ba", [{"monat": 12, "wert": 100.0}])
        with self.assertRaisesRegex(model.ForecastInputError, "Forecast-Art"):
            model.add_forecast_plan("unbekannt", "freigabe", [{"monat": 12, "wert": 100.0}])

        self.assertEqual(
            columns,
            ["jahr", "region", "auftrag", "auftragname", "groesse", "art", "monat", "wert"],
        )


if __name__ == "__main__":
    unittest.main()
