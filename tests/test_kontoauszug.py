"""Kontoauszüge aus CSV, CAMT, MT940 und Excel."""

from __future__ import annotations

import io
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.import_excel import import_workbook  # noqa: E402
from server import model  # noqa: E402
from server.kontoauszug import KontoauszugError, parse_statement  # noqa: E402

SPARKASSE = """Umsatzanzeige
Konto;Sparkasse Freising

Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Kontonummer/IBAN;Betrag;Waehrung
"DE89370400440532013000";"06.10.2026";"06.10.2026";"GUTSCHRIFT";"AR-26004 Wohnquartier";"Wohnbau Müller AG";"DE12500105170648489890";"185.000,00";"EUR"
"DE89370400440532013000";"06.10.2026";"06.10.2026";"UEBERWEISUNG";"ER-5602 Stahlträger";"Holz & Stahl Süd AG";"DE44500105175407324931";"-26.412,00";"EUR"
"DE89370400440532013000";"07.10.2026";"07.10.2026";"DAUERAUFTRAG";"noch offen";"";"";"0,00";"EUR"
"""

SOLL_HABEN = """Buchungstag;Buchungstext;Soll;Haben;Name
06.10.2026;Miete;1.200,50;;Vermieter GmbH
06.10.2026;Zahlung;;3.400,00;Kunde AG
06.10.2026;Zahlung;;3.400,00;Kunde AG
"""

CAMT = """<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Acct><Id><IBAN>DE89370400440532013000</IBAN></Id></Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">158588.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2026-10-31</Dt></Dt>
      </Bal>
      <Ntry>
        <Amt Ccy="EUR">185000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-10-06</Dt></BookgDt>
        <ValDt><Dt>2026-10-06</Dt></ValDt>
        <NtryDtls><TxDtls>
          <RltdPties>
            <Dbtr><Nm>Wohnbau Alpenland AG</Nm></Dbtr>
            <DbtrAcct><Id><IBAN>DE12500105170648489890</IBAN></Id></DbtrAcct>
          </RltdPties>
          <RmtInf><Ustrd>AR-26004 Wohnquartier</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
        <AddtlNtryInf>GUTSCHRIFT</AddtlNtryInf>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">26412.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-10-06</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <RltdPties><Cdtr><Nm>Holz und Stahl</Nm></Cdtr></RltdPties>
          <RmtInf><Ustrd>ER-5602</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>
"""

MT940 = """:20:STARTUMS
:25:DE89370400440532013000
:60F:C261001EUR1000,00
:61:2610061006C185000,00NTRFNONREF
:86:166?00GUTSCHRIFT?20AR-26004 Wohnquartier?32Wohnbau Alpenland AG
:61:2610061006D26412,00NTRFNONREF
:86:166?00UEBERWEISUNG?20ER-5602?32Holz und Stahl
:62F:C261031EUR158588,00
-
"""


def statement_xlsx() -> bytes:
    shared = ["Buchungstag", "Betrag", "Verwendungszweck", "Partner", "06.10.2026", "Miete Büro", "Hausverwaltung"]
    sheet = """<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>4</v></c><c r="B2"><v>-1200.5</v></c>
      <c r="C2" t="s"><v>5</v></c><c r="D2" t="s"><v>6</v></c>
    </row>
  </sheetData>
</worksheet>
"""
    strings = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + "".join(f"<si><t>{escape(item)}</t></si>" for item in shared)
        + "</sst>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
        )
        archive.writestr(
            "xl/workbook.xml",
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Umsatz" sheetId="1" r:id="rId1"/></sheets></workbook>',
        )
        archive.writestr(
            "xl/_rels/workbook.xml.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            'Target="worksheets/sheet1.xml"/></Relationships>',
        )
        archive.writestr("xl/sharedStrings.xml", strings)
        archive.writestr("xl/worksheets/sheet1.xml", sheet)
    return buffer.getvalue()


class KontoauszugTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database = Path(self.temp_dir.name) / "tvf.sqlite"
        shutil.copy2(ROOT / "data" / "tvf.sqlite", self.database)
        self.original_database = model.DB
        model.DB = self.database

    def tearDown(self) -> None:
        model.DB = self.original_database
        self.temp_dir.cleanup()

    def test_sparkasse_csv_keeps_sign_and_skips_zero(self) -> None:
        content = SPARKASSE.encode("cp1252")
        statement = parse_statement(content, "umsatz.csv")
        self.assertEqual(statement.format, "CSV")
        self.assertEqual(statement.konto, "DE89370400440532013000")
        self.assertEqual(len(statement.movements), 2)
        self.assertEqual(statement.skipped, 1)
        self.assertEqual(statement.movements[0].betrag, 185000.00)
        self.assertEqual(statement.movements[1].betrag, -26412.00)
        self.assertEqual(statement.movements[0].gegenpartei, "Wohnbau Müller AG")
        self.assertIn("AR-26004", statement.movements[0].verwendungszweck)

    def test_soll_haben_and_identical_rows_stay_distinct(self) -> None:
        statement = parse_statement(SOLL_HABEN.encode(), "datev.csv")
        self.assertEqual([row.betrag for row in statement.movements], [-1200.50, 3400.00, 3400.00])
        self.assertEqual(len({row.fingerprint for row in statement.movements}), 3)

    def test_camt_direction_and_closing_balance(self) -> None:
        statement = parse_statement(CAMT.encode(), "auszug.xml")
        self.assertEqual(statement.format, "CAMT")
        self.assertEqual([row.betrag for row in statement.movements], [185000.00, -26412.00])
        self.assertEqual(statement.movements[0].gegenpartei, "Wohnbau Alpenland AG")
        self.assertEqual(statement.movements[1].gegenpartei, "Holz und Stahl")
        self.assertEqual(statement.closing_balance, 158588.00)
        self.assertEqual(statement.closing_date, "2026-10-31")

    def test_mt940(self) -> None:
        statement = parse_statement(MT940.encode(), "auszug.sta")
        self.assertEqual(statement.format, "MT940")
        self.assertEqual(statement.movements[0].betrag, 185000.00)
        self.assertEqual(statement.movements[0].buchungsdatum, "2026-10-06")
        self.assertEqual(statement.movements[0].gegenpartei, "Wohnbau Alpenland AG")
        self.assertEqual(statement.movements[1].betrag, -26412.00)
        self.assertEqual(statement.closing_balance, 158588.00)

    def test_excel_statement(self) -> None:
        statement = parse_statement(statement_xlsx(), "umsatz.xlsx")
        self.assertEqual(statement.format, "Excel")
        self.assertEqual(statement.movements[0].betrag, -1200.50)
        self.assertEqual(statement.movements[0].gegenpartei, "Hausverwaltung")
        self.assertIn("Büro", statement.movements[0].verwendungszweck)

    def test_dashboard_workbook_is_not_a_statement(self) -> None:
        content = (ROOT / "data" / "tvf-dashboard-download.xlsx").read_bytes()
        with self.assertRaises(KontoauszugError):
            parse_statement(content, "tvf-dashboard-download.xlsx")

    def test_reimport_skips_existing_rows_and_survives_excel_import(self) -> None:
        content = SPARKASSE.encode("utf-8")
        first = model.bank_statement_import("sparkasse.csv", content, write=True)
        second = model.bank_statement_import("sparkasse.csv", content, write=True)
        self.assertEqual(first["neu"], 2)
        self.assertIn("AR-26004", first["vorschau"][0]["text"])
        self.assertEqual(first["importiert"], 2)
        self.assertEqual(second["neu"], 0)
        self.assertEqual(second["bereits"], 2)
        self.assertEqual(second["importiert"], 0)

        workbook = Path(self.temp_dir.name) / "mappe.xlsx"
        shutil.copy2(ROOT / "data" / "tvf-dashboard-download.xlsx", workbook)
        import_workbook(workbook, self.database)
        with sqlite3.connect(self.database) as connection:
            count = connection.execute("SELECT COUNT(*) FROM bankbewegung").fetchone()[0]
        self.assertEqual(count, 2)
        overview = model.build()["bank"]
        self.assertEqual(overview["anzahl"], 2)
        self.assertEqual(overview["monate"][0]["monat"], "2026-10")
        self.assertEqual(overview["summe"], 158588.00)

    def test_long_fields_fit_varchar_limits(self) -> None:
        text = "BUCHUNG " + ("Y" * 400)
        purpose = "ZW" + ("X" * 500)
        party = "Partner " + ("Z" * 300)
        iban = "DE12 5001 0517 0648 4898 90 EXTRA-TEXT-NICHT-TEIL-DER-IBAN"
        account = "DE89 3704 0044 0532 0130 00"
        csv = (
            "Buchungstag;Buchungstext;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;"
            "Kontonummer/IBAN;Auftragskonto;Betrag;Waehrung\n"
            f"06.10.2026;{text};{purpose};{party};{iban};{account};10,00;US-Dollar\n"
            "07.10.2026;Lastschrift;Miete;Vermieter GmbH;DE44500105175407324931;"
            f"{account};-5,00;GUTSCHRIFT\n"
        )
        statement = parse_statement(csv.encode(), "lang.csv")
        long_row, short_row = statement.movements
        self.assertEqual(long_row.waehrung, "USD")
        self.assertEqual(short_row.waehrung, "EUR")
        self.assertLessEqual(len(long_row.waehrung), 3)
        self.assertEqual(len(long_row.buchungstext), 60)
        self.assertLessEqual(len(long_row.gegenpartei), 255)
        self.assertEqual(long_row.gegen_iban, "DE12500105170648489890")
        self.assertEqual(long_row.eigenkonto, "DE89370400440532013000")
        self.assertLessEqual(len(long_row.gegen_iban), 40)
        self.assertLessEqual(len(long_row.eigenkonto), 40)
        self.assertIn("Y" * 20, long_row.verwendungszweck)
        self.assertTrue(long_row.buchungstext.startswith("BUCHUNG"))

        result = model.bank_statement_import("lang.csv", csv.encode(), write=True)
        self.assertEqual(result["importiert"], 2)
        model.log_import("Umsatzanzeige_2026-10.csv", "testlauf", "ERFOLGREICH", 2, "CSV")
        shown = model.import_log()[0]
        self.assertEqual(shown["schritt"], "testlauf")
        self.assertEqual(shown["status"], "ERFOLGREICH")
        with sqlite3.connect(self.database) as connection:
            step, status = connection.execute(
                "SELECT schritt, status FROM import_protokoll ORDER BY id DESC LIMIT 1"
            ).fetchone()
            stored = connection.execute(
                """
                SELECT waehrung, length(buchungstext), length(gegenpartei),
                       length(gegen_iban), length(eigenkonto)
                FROM bankbewegung
                ORDER BY betrag DESC
                """
            ).fetchone()
        self.assertLessEqual(len(step), 6)
        self.assertLessEqual(len(status), 6)
        self.assertEqual(step, "test")
        self.assertEqual(status, "fertig")
        self.assertEqual(stored[0], "USD")
        self.assertLessEqual(stored[1], 60)
        self.assertLessEqual(stored[2], 255)
        self.assertLessEqual(stored[3], 40)
        self.assertLessEqual(stored[4], 40)

    def test_oktober_auszug_fits_varchar_60(self) -> None:
        reference = "/20261001_0847_41025_HACH" + ("X" * 50)
        self.assertGreater(len(reference), 60)
        csv = (
            "DATUM;ZAHLUNGSPARTNER;VERWENDUNGSZWECK;BETRAG (EUR);ZAHLUNGSRICHTUNG;BUCHUNGSTEXT\n"
            f"46296;Caterpillar Financial Services;SEPA-UBERWEISUNG, PmtInfld: 10;-53.032,13 €;Abbuchung;{reference}\n"
            "46296;Caterpillar Financial Services;30028663/01-10-2026;5.332,28 €;Abbuchung;Leasingraten\n"
            "46296;Caterpillar Financial Services;falsches Format;53,032.13;Abbuchung;Leasingraten\n"
        )
        statement = parse_statement(csv.encode(), "Kontoauszug_Oktober_2026_Buchungen.csv")
        first, second = statement.movements
        self.assertEqual(statement.skipped, 1)
        self.assertEqual(first.buchungsdatum, "2026-10-01")
        self.assertEqual(first.betrag, -53032.13)
        self.assertEqual(second.betrag, -5332.28)
        self.assertEqual(first.gegenpartei, "Caterpillar Financial Services")
        self.assertEqual(len(first.buchungstext), 60)
        self.assertTrue(first.buchungstext.startswith("/20261001_0847_41025_HACH"))
        self.assertIn(reference, first.verwendungszweck)
        self.assertLessEqual(len(first.buchungstext), 60)
        self.assertEqual(second.buchungstext, "Leasingraten")
        result = model.bank_statement_import("Kontoauszug_Oktober_2026_Buchungen.csv", csv.encode(), write=True)
        self.assertEqual(result["importiert"], 2)
        with sqlite3.connect(self.database) as connection:
            stored = connection.execute(
                "SELECT length(buchungstext), betrag FROM bankbewegung ORDER BY betrag"
            ).fetchall()
        self.assertEqual(stored[0][0], 60)
        self.assertEqual(stored[0][1], -53032.13)

    def test_api_started_as_script_can_import_workbook_module(self) -> None:
        proc = subprocess.run(
            [
                sys.executable,
                "-c",
                "import api\nfrom scripts.import_excel import SHEETS\nprint(len(SHEETS))",
            ],
            cwd=ROOT / "server",
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("17", proc.stdout)

    def test_dashboard_file_stays_on_workbook_path(self) -> None:
        from server.api import _is_dashboard_workbook

        content = (ROOT / "data" / "tvf-dashboard-download.xlsx").read_bytes()
        self.assertTrue(_is_dashboard_workbook(content))
        self.assertFalse(_is_dashboard_workbook(SPARKASSE.encode()))
        self.assertFalse(_is_dashboard_workbook(statement_xlsx()))


if __name__ == "__main__":
    unittest.main()
