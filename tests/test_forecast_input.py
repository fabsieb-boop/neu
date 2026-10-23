from __future__ import annotations

import hashlib
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

    def test_rejects_forecast_values_in_closed_actual_months(self) -> None:
        project = self.active_project()
        with self.connection() as connection:
            last_actual = connection.execute(
                "SELECT letzter_ist_monat FROM parameter"
            ).fetchone()[0]
        with self.assertRaisesRegex(model.ForecastInputError, "letzten Ist-Monat"):
            model.add_forecast_plan(
                project["projekt_nr"],
                "kosten",
                [{"monat": last_actual, "wert": 100.0}],
            )

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

    def test_rejects_forecast_for_a_region_outside_the_user_scope(self) -> None:
        project = self.active_project()
        allowed = next(
            region
            for region in model.available_regions()
            if region != project["region"]
        )
        with self.assertRaisesRegex(model.ForecastInputError, "Ihrer Region"):
            model.add_forecast_plan(
                project["projekt_nr"],
                "kosten",
                [{"monat": 10, "wert": 100.0}],
                {allowed},
            )

    def test_user_passwords_roles_and_regions_are_enforced(self) -> None:
        password = "Startpasswort123"
        admin = model.create_user(
            "admin@example.test", password, "Ada", "Admin", "NEUTRAL"
        )
        self.assertTrue(admin["istAdmin"])
        self.assertTrue(admin["passwortOffen"])
        with self.connection() as connection:
            stored = connection.execute(
                "SELECT passwort_hash FROM benutzer WHERE benutzer_id = ?",
                (admin["id"],),
            ).fetchone()[0]
        self.assertNotIn(password, stored)
        self.assertEqual(model.authenticate("ADMIN@example.test", password)["id"], admin["id"])

        region = model.available_regions()[0]
        changed = model.update_user(admin["id"], "region", region, True)
        self.assertEqual(model.user_regions(changed), {region})
        with self.assertRaisesRegex(model.SystemInputError, "letzte aktive ADMIN"):
            model.update_user(admin["id"], "rolle", "ADMIN", False)

        second = model.create_user(
            "zweiter@example.test", "ZweitesPasswort456", rolle="NEUTRAL"
        )
        model.update_user(second["id"], "rolle", "ADMIN", True)
        demoted = model.update_user(admin["id"], "rolle", "ADMIN", False)
        self.assertNotIn("ADMIN", demoted["rollen"])

    def test_mandatory_password_change_clears_the_flag(self) -> None:
        user = model.create_user(
            "passwort@example.test", "Startpasswort123", rolle="ADMIN"
        )
        with self.assertRaisesRegex(model.SystemInputError, "bisherige Passwort"):
            model.change_password(user["id"], "Falsch123456", "NeuesPasswort456")
        changed = model.change_password(
            user["id"], "Startpasswort123", "NeuesPasswort456"
        )
        self.assertFalse(changed["passwortOffen"])
        self.assertIsNone(model.authenticate("passwort@example.test", "Startpasswort123"))
        self.assertIsNotNone(model.authenticate("passwort@example.test", "NeuesPasswort456"))

    def test_regional_build_filters_every_value_bearing_dataset(self) -> None:
        with self.connection() as connection:
            region = connection.execute(
                """
                SELECT p.region
                FROM kosten_meldung k
                JOIN projekt p ON p.projekt_nr = k.auftrag
                WHERE p.region <> ''
                LIMIT 1
                """
            ).fetchone()[0]
        dashboard = model.build({region})
        self.assertEqual(dashboard["scope"], {"regional": True, "regions": [region]})
        self.assertEqual(dashboard["months"], [])
        self.assertEqual(dashboard["guv"], [])
        self.assertEqual(dashboard["liquidity"]["weeks"], [])
        self.assertTrue(dashboard["orders"])
        self.assertTrue(all(row["region"] == region for row in dashboard["orders"]))
        self.assertTrue(dashboard["kostenverfolgung"])
        self.assertTrue(
            all(row["region"] == region for row in dashboard["kostenverfolgung"])
        )
        self.assertTrue(
            all(row["region"] == region for row in model.journal_rows({region}))
        )
        self.assertTrue(
            all(row["region"] == region for row in dashboard["forecastPlan"])
        )

    def test_report_templates_are_private_to_each_user(self) -> None:
        first = model.create_user(
            "eins@example.test", "ErstesPasswort123", rolle="ADMIN"
        )
        second = model.create_user(
            "zwei@example.test", "ZweitesPasswort456", rolle="NEUTRAL"
        )
        first_id = model.save_report_template(
            first["id"], "Monatsbericht", "projekte", {"spalten": ["region"]}
        )
        second_id = model.save_report_template(
            second["id"], "Monatsbericht", "liquiditaet", {"spalten": ["datum"]}
        )
        self.assertNotEqual(first_id, second_id)
        self.assertEqual(
            [row["quelle"] for row in model.report_templates(first["id"])],
            ["projekte"],
        )
        with self.assertRaisesRegex(model.SystemInputError, "nicht gefunden"):
            model.delete_report_template(first["id"], second_id)


class IsolatedImportTest(unittest.TestCase):
    def test_import_uses_temporary_paths_and_keeps_repository_data_unchanged(self) -> None:
        workbook = ROOT / "data" / "tvf-dashboard-download.xlsx"
        database = ROOT / "data" / "tvf.sqlite"
        before_workbook = hashlib.sha256(workbook.read_bytes()).hexdigest()
        before_database = hashlib.sha256(database.read_bytes()).hexdigest()
        with sqlite3.connect(database) as connection:
            expected = {
                table: connection.execute(
                    f'SELECT COUNT(*) FROM "{table}"'
                ).fetchone()[0]
                for table in ("projekt", "guv_position")
            }
        with tempfile.TemporaryDirectory() as folder:
            imported = Path(folder) / "tvf.sqlite"
            counts = import_workbook(workbook, imported)
            with sqlite3.connect(imported) as connection:
                tables = {
                    row[0]
                    for row in connection.execute(
                        "SELECT name FROM sqlite_master WHERE type = 'table'"
                    )
                }
            self.assertEqual(counts["projekt"], expected["projekt"])
            self.assertEqual(counts["guv_position"], expected["guv_position"])
            self.assertTrue(
                {"benutzer", "bericht_vorlage", "ja_stand", "import_protokoll"}
                <= tables
            )
            with sqlite3.connect(imported) as connection:
                connection.execute(
                    """
                    INSERT INTO import_protokoll
                      (dateiname, schritt, status, zeilen, detail)
                    VALUES (?, 'analyse', 'ERFOLGREICH', 0, '')
                    """,
                    (workbook.name,),
                )
            import_workbook(workbook, imported)
            with sqlite3.connect(imported) as connection:
                preserved = connection.execute(
                    """
                    SELECT COUNT(*)
                    FROM import_protokoll
                    WHERE dateiname = ? AND schritt = 'analyse'
                    """,
                    (workbook.name,),
                ).fetchone()[0]
            self.assertEqual(preserved, 1)
        self.assertEqual(
            hashlib.sha256(workbook.read_bytes()).hexdigest(), before_workbook
        )
        self.assertEqual(
            hashlib.sha256(database.read_bytes()).hexdigest(), before_database
        )


if __name__ == "__main__":
    unittest.main()
