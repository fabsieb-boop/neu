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
                SELECT projekt.auftragsnr AS projekt_nr, projekt.bezeichnung AS name, region.bezeichnung AS region
                FROM projekt
                JOIN region ON region.region_id = projekt.region_id
                JOIN kostenstelle ON kostenstelle.kostenstelle_id = projekt.kostenstelle_id
                WHERE projekt.phase = 'LAUFEND' AND kostenstelle.typ = 'PROJEKT'
                  AND projekt.auftragsnr NOT IN ('OVERHEAD', 'BEWERTUNG')
                ORDER BY projekt.projekt_id
                LIMIT 1
                """
            ).fetchone()

    def test_saves_plan_rows_and_reverses_only_revenue_sign(self) -> None:
        project = self.active_project()
        with self.connection() as connection:
            before = connection.execute(
                "SELECT COUNT(*) FROM forecast_wert WHERE betrag_plan IS NOT NULL"
            ).fetchone()[0]

        result = model.add_forecast_plan(
            project["projekt_nr"],
            "umsatz",
            [{"monat": 10, "wert": 1234.56}, {"monat": 11, "wert": -250.0}],
        )

        with self.connection() as connection:
            rows = connection.execute(
                """
                SELECT v.geschaeftsjahr, r.bezeichnung, p.auftragsnr, p.bezeichnung,
                       fw.wertart, fw.monat, fw.betrag_plan
                FROM forecast_wert fw
                JOIN forecast_version v ON v.version_id = fw.version_id
                JOIN projekt p ON p.projekt_id = fw.projekt_id
                JOIN region r ON r.region_id = p.region_id
                WHERE p.auftragsnr = ? AND fw.wertart = 'UMSATZ' AND fw.monat >= '2026-10-01'
                ORDER BY fw.monat
                """,
                (project["projekt_nr"],),
            ).fetchall()
            jahr = connection.execute(
                "SELECT geschaeftsjahr FROM forecast_version WHERE typ = 'PLAN'"
            ).fetchone()[0]

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["wert"], 1234.56)
        self.assertEqual(result[1]["wert"], -250.0)
        self.assertEqual(
            [tuple(row) for row in rows],
            [
                (jahr, project["region"], project["projekt_nr"], project["name"], "UMSATZ", "2026-10-01", 1234.56),
                (jahr, project["region"], project["projekt_nr"], project["name"], "UMSATZ", "2026-11-01", -250.0),
            ],
        )
        self.assertGreaterEqual(before, 1)

    def test_rejects_invalid_batch_without_partial_insert(self) -> None:
        project = self.active_project()
        with self.connection() as connection:
            before = connection.execute("SELECT COUNT(*) FROM forecast_wert").fetchone()[0]

        with self.assertRaisesRegex(model.ForecastInputError, "Monat"):
            model.add_forecast_plan(
                project["projekt_nr"],
                "kosten",
                [{"monat": 10, "wert": 100.0}, {"monat": 13, "wert": 200.0}],
            )

        with self.connection() as connection:
            after = connection.execute("SELECT COUNT(*) FROM forecast_wert").fetchone()[0]
        self.assertEqual(after, before)

    def test_rejects_forecast_values_in_closed_actual_months(self) -> None:
        project = self.active_project()
        with self.connection() as connection:
            last_actual = connection.execute(
                "SELECT ist_bis_periode AS letzter_ist_monat FROM forecast_version WHERE typ = 'ROLLING_FORECAST' AND ist_aktiv = 1"
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
                "SELECT auftragsnr FROM projekt WHERE phase <> 'LAUFEND' ORDER BY projekt_id LIMIT 1"
            ).fetchone()[0]
            columns = [row[1] for row in connection.execute("PRAGMA table_info(forecast_wert)")]

        with self.assertRaisesRegex(model.ForecastInputError, "nicht gefunden"):
            model.add_forecast_plan(inactive, "ba", [{"monat": 12, "wert": 100.0}])
        with self.assertRaisesRegex(model.ForecastInputError, "Forecast-Art"):
            model.add_forecast_plan("unbekannt", "freigabe", [{"monat": 12, "wert": 100.0}])

        self.assertIn("betrag_plan", columns)
        self.assertIn("wertart", columns)

    def test_creates_projektakte_with_psp_from_the_order_number(self) -> None:
        nummer = "P4102307452"
        self.assertEqual(model.psp_from_auftrag(nummer), "307452")
        self.assertEqual(model.psp_from_auftrag("P410281020"), "81020")
        with self.connection() as connection:
            project = connection.execute(
                """
                SELECT p.bezeichnung, p.phase, p.psp, r.code, r.bezeichnung AS region, ks.typ,
                       (SELECT COUNT(*) FROM buchung WHERE projekt_id = p.projekt_id) AS belege
                FROM projekt p
                JOIN region r ON r.region_id = p.region_id
                JOIN kostenstelle ks ON ks.kostenstelle_id = p.kostenstelle_id
                WHERE p.auftragsnr = ?
                """,
                (nummer,),
            ).fetchone()
        self.assertEqual(project["region"], "Sued-West")
        self.assertEqual(project["code"], "SW")
        self.assertEqual(project["phase"], "LAUFEND")
        self.assertEqual(project["typ"], "PROJEKT")
        self.assertEqual(project["psp"], "307452")
        self.assertGreater(project["belege"], 0)
        with self.assertRaisesRegex(model.ForecastInputError, "schon im Projektstamm"):
            model.create_projektakte(nummer, "Noch einmal", "Süd-West")
        created = model.create_projektakte("P4102999999", "Neue Akte", "Süd-West")
        self.assertEqual(created["psp"], "999999")
        self.assertEqual(created["region"], "Süd-West")

    def test_saves_forecast_for_journal_order_missing_from_master(self) -> None:
        nummer = "P4102307452"
        with self.connection() as connection:
            self.assertIsNotNone(
                connection.execute(
                    "SELECT 1 FROM projekt WHERE auftragsnr = ? AND bemerkung = 'Journal'",
                    (nummer,),
                ).fetchone()
            )

        saved = model.add_forecast_plan(nummer, "kosten", [{"monat": 10, "wert": 1500.0}])
        self.assertEqual(saved[0]["nr"], nummer)
        self.assertEqual(saved[0]["region"], "Süd-West")
        self.assertEqual(saved[0]["wert"], 1500.0)

        order = next(row for row in model.build()["forecastOrders"] if row["nr"] == nummer)
        self.assertEqual(order["region"], "Süd-West")
        self.assertEqual(order["status"], "LAUFEND")
        self.assertEqual(order["monate"][9], -1500.0)

        with self.assertRaisesRegex(model.ForecastInputError, "nicht gefunden"):
            model.add_forecast_plan("P9990000001", "kosten", [{"monat": 10, "wert": 10.0}])

    def test_journal_order_without_master_shows_region_and_bookings(self) -> None:
        dashboard = model.build()
        forecast = next(row for row in dashboard["forecastOrders"] if row["nr"] == "P4102157474")
        report = next(row for row in dashboard["orders"] if row["nr"] == "P4102157474")
        neighbor = next(row for row in dashboard["forecastOrders"] if row["nr"] == "P4102157473")
        neighbor_report = next(row for row in dashboard["orders"] if row["nr"] == "P4102157473")

        self.assertEqual(forecast["region"], "West")
        self.assertEqual(forecast["status"], "LAUFEND")
        self.assertEqual(forecast["psp"], "157474")
        self.assertIn("Wallstein", forecast["name"])
        self.assertAlmostEqual(forecast["leistungMonate"][7], 0, places=2)
        self.assertAlmostEqual(forecast["kostenMonate"][8], 3385.2, places=2)
        self.assertAlmostEqual(forecast["monate"][8], -3385.2, places=2)
        self.assertAlmostEqual(forecast["leistungMonate"][9], 0, places=2)
        self.assertAlmostEqual(forecast["kostenMonate"][9], 0, places=2)
        self.assertAlmostEqual(forecast["monate"][9], 0, places=2)
        self.assertEqual(report["region"], "West")
        self.assertAlmostEqual(report["leistung"], 0, places=2)
        self.assertLess(report["akte"], 0)
        self.assertEqual(neighbor["region"], "West")
        self.assertAlmostEqual(neighbor["monate"][8], -16314.9, places=2)
        self.assertAlmostEqual(neighbor["monate"][9], 0, places=2)
        self.assertAlmostEqual(neighbor_report["leistung"], 0, places=2)
        october = dashboard["forecast"][9]
        self.assertFalse(october["ist"])
        self.assertAlmostEqual(october["umsatzPlan"], 0, places=2)
        self.assertAlmostEqual(october["kostenPlan"], 0, places=2)
        self.assertAlmostEqual(october["angezeigt"], 0, places=2)
        self.assertAlmostEqual(
            sum(row["monate"][9] for row in dashboard["forecastOrders"]),
            october["angezeigt"],
            places=2,
        )
        self.assertTrue(october["offen"])
        self.assertAlmostEqual(october["leistungJournal"], 0, places=2)
        self.assertAlmostEqual(dashboard["months"][9]["auftragsergebnis"], 0, places=2)

        west = model.build({"West"})
        self.assertIn("P4102157474", {row["nr"] for row in west["forecastOrders"]})
        self.assertNotIn("P4102307452", {row["nr"] for row in west["forecastOrders"]})
        west_journal = model.journal_rows({"West"})
        self.assertTrue(any(row["nr"] == "P4102157474" and row["region"] == "West" for row in west_journal))
        self.assertFalse(any(row["nr"] == "P4102307452" for row in west_journal))

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
        region = "West"
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
                for table in ("projekt", "berichtsposition")
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
            self.assertEqual(counts["berichtsposition"], expected["berichtsposition"])
            self.assertIn("buchung", tables)
            self.assertNotIn("guv_wert", tables)
            self.assertNotIn("forecast_plan", tables)
            with sqlite3.connect(imported) as connection:
                connection.execute(
                    """
                    INSERT INTO import_lauf (quelle, dateiname, zeilen, bemerkung)
                    VALUES ('MANUELL', ?, 0, 'schritt=analyse;status=fertig;detail=')
                    """,
                    (workbook.name,),
                )
            import_workbook(workbook, imported)
            with sqlite3.connect(imported) as connection:
                preserved = connection.execute(
                    """
                    SELECT COUNT(*)
                    FROM import_lauf
                    WHERE quelle = 'MANUELL' AND dateiname = ? AND bemerkung LIKE '%schritt=analyse%'
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
