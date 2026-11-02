"""Liest Kontoauszüge aus CSV, CAMT, MT940 und Excel-Listen.

Die Beträge bleiben so, wie die Bank sie ausweist: Zufluss positiv, Abfluss
negativ. Es werden keine Kategorien ergänzt und keine Salden geschätzt.
"""

from __future__ import annotations

import csv
import hashlib
import io
import re
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from xml.etree import ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
EXCEL_EPOCH = date(1899, 12, 30)
DATE_HEADERS = {"buchungstag", "buchungsdatum", "datum"}
VALUTA_HEADERS = {"valutadatum", "valuta", "wertstellung", "wertstellungsdatum"}
AMOUNT_HEADERS = {"betrag", "betrageur", "umsatz", "umsatzbetrag", "amount"}
SOLL_HEADERS = {"soll", "sollbetrag", "sollbetrageur"}
HABEN_HEADERS = {"haben", "habenbetrag", "habenbetrageur"}
SH_HEADERS = {"sollhaben", "sollhabenkz", "shkz", "sh"}
TEXT_HEADERS = {"buchungstext", "umsatzart", "vorgang", "text", "buchungsart"}
PURPOSE_HEADERS = {"verwendungszweck", "zweck", "buchungsinformation"}
OWN_HEADERS = {"auftragskonto", "eigenkonto"}
CURRENCY_HEADERS = {"waehrung", "currency"}
MT61 = re.compile(
    r"^(?P<date>\d{6})(?P<entry>\d{4})?(?P<dc>RC|RD|C|D)"
    r"(?P<fund>[A-Z])?(?P<amount>\d+,?\d*)"
)
MT_BALANCE = re.compile(r"^(?P<dc>C|D)(?P<date>\d{6})(?P<ccy>[A-Z]{3})(?P<amount>\d+,?\d*)")


class KontoauszugError(ValueError):
    pass


@dataclass
class Movement:
    fingerprint: str
    buchungsdatum: str
    valuta: str | None
    betrag: float
    waehrung: str
    buchungstext: str
    verwendungszweck: str
    gegenpartei: str
    gegen_iban: str
    eigenkonto: str


@dataclass
class Statement:
    format: str
    konto: str
    movements: list[Movement]
    skipped: int
    closing_balance: float | None
    closing_date: str | None


def parse_statement(content: bytes, filename: str = "") -> Statement:
    if not content or not content.strip():
        raise KontoauszugError("Die Datei ist leer.")
    if len(content) > 32 * 1024 * 1024:
        raise KontoauszugError("Die Datei ist größer als 32 MB.")
    name = filename.lower()
    if content.startswith(b"PK\x03\x04") or name.endswith((".xlsx", ".xlsm")):
        return _from_xlsx(content)
    if _looks_like_camt(content) or name.endswith(".xml"):
        return _from_camt(content)
    text = _decode(content)
    if _looks_like_mt940(text) or name.endswith((".sta", ".mt940", ".swift")):
        return _from_mt940(text)
    return _from_csv(text)


def _decode(content: bytes) -> str:
    if content.startswith((b"\xff\xfe", b"\xfe\xff")):
        return content.decode("utf-16")
    if content.startswith(b"\xef\xbb\xbf"):
        return content.decode("utf-8-sig")
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("cp1252")


def _looks_like_camt(content: bytes) -> bool:
    head = content[:4000].lower()
    return b"<" in head and (b"bktocstmr" in head or b"camt.05" in head)


def _looks_like_mt940(text: str) -> bool:
    return ":61:" in text and (":20:" in text or ":25:" in text)


def _norm(value: str) -> str:
    text = value.lower().strip()
    text = (
        text.replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
    )
    return re.sub(r"[^a-z0-9]+", "", text)


# Kurze Kennzeichen dürfen character varying(6) nicht sprengen: die Währung
# ist ein ISO-Code mit 3 Zeichen. Der Buchungstext folgt der DATEV-Länge 60,
# der Name der Spalte mit 255, IBAN und Konto der Spalte mit 40. Was am
# Buchungstext abgeschnitten wird, bleibt im Verwendungszweck (Text ohne Limit).
BOOKING_TEXT_LIMIT = 60
TEXT_LIMIT = 255
ACCOUNT_LIMIT = 40
PURPOSE_LIMIT = 4000
_CURRENCY_ALIASES = {
    "EUR": "EUR",
    "EURO": "EUR",
    "USD": "USD",
    "USDOLLAR": "USD",
    "DOLLAR": "USD",
    "CHF": "CHF",
    "SFR": "CHF",
    "FRANKEN": "CHF",
    "GBP": "GBP",
    "PFUND": "GBP",
}


def _clean_text(value: object, limit: int = PURPOSE_LIMIT) -> str:
    text = "" if value is None else str(value).strip()
    if text.startswith('="') and text.endswith('"') and len(text) >= 3:
        text = text[2:-1]
    return re.sub(r"\s+", " ", text)[:limit]


def _currency(value: object) -> str:
    """Immer genau drei Buchstaben, sonst EUR. Längere Zellen bleiben draußen."""
    raw = _clean_text(value, 40).upper()
    compact = re.sub(r"[^A-Z]", "", raw)
    if compact in _CURRENCY_ALIASES:
        return _CURRENCY_ALIASES[compact]
    if len(compact) == 3:
        return compact
    bracket = re.search(r"\(([A-Z]{3})\)", raw)
    if bracket and bracket.group(1) in _CURRENCY_ALIASES:
        return _CURRENCY_ALIASES[bracket.group(1)]
    return "EUR"


# Feste IBAN-Längen. Hängt die Bank noch Text an die Kontonummer, bleibt der Rest draußen.
_IBAN_LENGTH = {
    "DE": 22, "AT": 20, "CH": 21, "LI": 21, "NL": 18, "BE": 16,
    "FR": 27, "IT": 27, "ES": 24, "PL": 28, "LU": 20,
}


def _account(value: object) -> str:
    text = _clean_text(value, 160).upper().replace(" ", "")
    if not text:
        return ""
    match = re.search(r"[A-Z]{2}\d{2}[A-Z0-9]{10,30}", text)
    if match:
        candidate = match.group(0)
        expected = _IBAN_LENGTH.get(candidate[:2])
        if expected and len(candidate) >= expected:
            return candidate[:expected]
        return candidate[:ACCOUNT_LIMIT]
    return re.sub(r"[^A-Z0-9/-]", "", text)[:ACCOUNT_LIMIT]


def _parse_amount(value: object) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = _clean_text(value, 80)
    if not text:
        return None
    text = (
        text.replace("€", "")
        .replace("EUR", "")
        .replace("eur", "")
        .replace("\xa0", "")
        .replace(" ", "")
    )
    sign = 1
    if text.endswith("-") or text.startswith("-") or text.endswith("S"):
        sign = -1
    if text.startswith("+"):
        sign = 1
    text = text.strip("+-SHs").rstrip("SHs")
    if not text:
        return None
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return sign * float(text)
    except ValueError:
        return None


def _parse_date(value: object) -> str | None:
    if value is None or isinstance(value, bool) or value == "":
        return None
    if isinstance(value, (int, float)):
        serial = int(value)
        if 20000 <= serial <= 80000:
            return (EXCEL_EPOCH + timedelta(days=serial)).isoformat()
        return None
    text = _clean_text(value, 40)
    if re.fullmatch(r"\d{5}", text):
        return _parse_date(int(text))
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d.%m.%y", "%Y/%m/%d", "%d/%m/%Y"):
        try:
            parsed = datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
        if parsed.year < 100:
            parsed = parsed.replace(year=parsed.year + 2000)
        return parsed.isoformat()
    match = re.fullmatch(r"(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})", text)
    if not match:
        return None
    day, month, year = (int(part) for part in match.groups())
    if year < 100:
        year += 2000 if year < 70 else 1900
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def _yyMMdd(value: str) -> date | None:
    try:
        year = int(value[0:2])
        year += 2000 if year < 70 else 1900
        return date(year, int(value[2:4]), int(value[4:6]))
    except (ValueError, IndexError):
        return None


def _signed_amount(amount: float | None, soll: float | None, haben: float | None, sh: str) -> float | None:
    if soll is not None or haben is not None:
        outgoing = abs(soll or 0)
        incoming = abs(haben or 0)
        if outgoing == 0 and incoming == 0:
            return 0.0
        return incoming - outgoing
    if amount is None:
        return None
    mark = sh.strip().upper()
    if mark.startswith("S") or mark in {"DEBIT", "D", "DBIT"}:
        return -abs(amount)
    if mark.startswith("H") or mark in {"CREDIT", "C", "CRDT", "HABEN"}:
        return abs(amount)
    return amount


def _assign(rows: list[dict], source_format: str, account: str, skipped: int, closing: float | None, closing_date: str | None) -> Statement:
    counts: dict[str, int] = {}
    movements: list[Movement] = []
    own_account = _account(account)
    for row in rows:
        full_text = _clean_text(row.get("buchungstext"))
        purpose = _clean_text(row.get("verwendungszweck"))
        if len(full_text) > BOOKING_TEXT_LIMIT and full_text not in purpose:
            purpose = _clean_text(f"{purpose} {full_text}".strip())
        row = {
            **row,
            "waehrung": _currency(row.get("waehrung")),
            "buchungstext": full_text[:BOOKING_TEXT_LIMIT],
            "verwendungszweck": purpose,
            "gegenpartei": _clean_text(row.get("gegenpartei"), TEXT_LIMIT),
            "gegen_iban": _account(row.get("gegen_iban")),
            "eigenkonto": _account(row.get("eigenkonto")) or own_account,
        }
        base = "\u001f".join(
            [
                row["eigenkonto"] or own_account,
                row["buchungsdatum"],
                row.get("valuta") or "",
                f"{row['betrag']:.2f}",
                row["waehrung"],
                row["buchungstext"],
                row["verwendungszweck"],
                row["gegenpartei"],
                row["gegen_iban"],
            ]
        )
        counts[base] = counts.get(base, 0) + 1
        digest = hashlib.sha256(f"{base}\u001f{counts[base]}".encode()).hexdigest()
        movements.append(
            Movement(
                fingerprint=digest,
                buchungsdatum=row["buchungsdatum"],
                valuta=row.get("valuta"),
                betrag=round(float(row["betrag"]), 2),
                waehrung=row["waehrung"] or "EUR",
                buchungstext=row["buchungstext"],
                verwendungszweck=row["verwendungszweck"],
                gegenpartei=row["gegenpartei"],
                gegen_iban=row["gegen_iban"],
                eigenkonto=row["eigenkonto"] or own_account,
            )
        )
    if not movements:
        raise KontoauszugError(
            "Im Kontoauszug steht keine Buchung. Erwartet werden Buchungstag und Betrag, "
            "bei DATEV auch Soll und Haben."
        )
    shown_account = own_account or movements[0].eigenkonto
    return Statement(source_format, shown_account, movements, skipped, closing, closing_date)


def _map_headers(header: list[str]) -> dict[str, int]:
    roles: dict[str, int] = {}
    party_score: tuple[int, int] | None = None
    iban_at: int | None = None
    for index, raw in enumerate(header):
        name = _norm(raw)
        if not name:
            continue
        if name in DATE_HEADERS and "datum" not in roles:
            roles["datum"] = index
        elif name in VALUTA_HEADERS:
            roles["valuta"] = index
        elif name in SOLL_HEADERS:
            roles["soll"] = index
        elif name in HABEN_HEADERS:
            roles["haben"] = index
        elif name in SH_HEADERS:
            roles["sh"] = index
        elif name in AMOUNT_HEADERS and "betrag" not in roles:
            roles["betrag"] = index
        elif name in TEXT_HEADERS and "text" not in roles:
            roles["text"] = index
        elif name in PURPOSE_HEADERS:
            roles["zweck"] = index
        elif name in OWN_HEADERS:
            roles["konto"] = index
        elif name in CURRENCY_HEADERS:
            roles["waehrung"] = index
        elif "iban" in name and "auftrag" not in name:
            iban_at = index
        else:
            score = 0
            if "beguenstigt" in name or "zahlungspflicht" in name:
                score = 5
            elif "auftraggeber" in name or "empfaenger" in name or "gegenpartei" in name:
                score = 4
            elif name in {"partner", "name", "zahlungsbeteiligter"}:
                score = 2
            if score and (party_score is None or score > party_score[0]):
                party_score = (score, index)
    if "betrag" in roles and roles["betrag"] == roles.get("text"):
        roles.pop("betrag", None)
    if "datum" not in roles:
        return {}
    if "betrag" not in roles and "soll" not in roles and "haben" not in roles:
        return {}
    if party_score:
        roles["partner"] = party_score[1]
    if iban_at is not None:
        roles["iban"] = iban_at
    # Liegt „Umsatz“ neben einem echten Betrag, ist Umsatz meist der Text.
    if "betrag" in roles and _norm(header[roles["betrag"]]) == "umsatz" and "soll" in roles:
        roles.pop("betrag")
    return roles


def _header_index(rows: list[list[str]]) -> tuple[int, dict[str, int]] | None:
    best: tuple[int, int, dict[str, int]] | None = None
    for index, row in enumerate(rows[:40]):
        mapping = _map_headers(row)
        if not mapping:
            continue
        score = len(mapping)
        if best is None or score > best[0]:
            best = (score, index, mapping)
    if best is None:
        return None
    return best[1], best[2]


def _records_from_table(table: list[list[object]]) -> tuple[list[dict], int, str]:
    preview = [[_clean_text(cell, 80) for cell in row] for row in table[:40]]
    found = _header_index(preview)
    if found is None:
        return [], 0, ""
    start, mapping = found
    account = ""
    skipped = 0
    records: list[dict] = []
    for raw in table[start + 1 :]:
        if not any(_clean_text(cell) for cell in raw):
            continue
        def cell(role: str) -> object:
            index = mapping.get(role)
            return raw[index] if index is not None and index < len(raw) else None

        booked = _parse_date(cell("datum"))
        amount = _signed_amount(
            _parse_amount(cell("betrag")) if "betrag" in mapping else None,
            _parse_amount(cell("soll")) if "soll" in mapping else None,
            _parse_amount(cell("haben")) if "haben" in mapping else None,
            _clean_text(cell("sh"), 20),
        )
        if booked is None or amount is None:
            skipped += 1
            continue
        if amount == 0:
            skipped += 1
            continue
        own = cell("konto")
        if _clean_text(own) and not account:
            account = _clean_text(own)
        text = _clean_text(cell("text"))
        purpose = _clean_text(cell("zweck"))
        if not purpose:
            purpose = text
            text = ""
        currency = _currency(cell("waehrung"))
        records.append(
            {
                "buchungsdatum": booked,
                "valuta": _parse_date(cell("valuta")),
                "betrag": amount,
                "waehrung": currency,
                "buchungstext": text,
                "verwendungszweck": purpose,
                "gegenpartei": _clean_text(cell("partner"), TEXT_LIMIT),
                "gegen_iban": cell("iban"),
                "eigenkonto": own,
            }
        )
    return records, skipped, account


def _split_csv(text: str) -> list[list[str]]:
    lines = [line for line in text.splitlines() if line.strip() and not line.lower().startswith("sep=")]
    if not lines:
        raise KontoauszugError("Die Datei enthält keine Zeilen.")
    best_rows: list[list[str]] = []
    best_score = -1
    for delimiter in (";", ",", "\t", "|"):
        parsed = list(csv.reader(lines, delimiter=delimiter))
        found = _header_index(parsed[:40])
        score = 0 if found is None else len(found[1]) * 100 + max(len(row) for row in parsed[:40])
        if score > best_score:
            best_score = score
            best_rows = parsed
    return best_rows


def _from_csv(text: str) -> Statement:
    records, skipped, account = _records_from_table(_split_csv(text))
    return _assign(records, "CSV", account, skipped, None, None)


def _from_xlsx(content: bytes) -> Statement:
    try:
        archive = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as error:
        raise KontoauszugError("Die Excel-Datei lässt sich nicht öffnen.") from error
    tables = _xlsx_tables(archive)
    best: tuple[list[dict], int, str] | None = None
    for table in tables:
        records, skipped, account = _records_from_table(table)
        if best is None or len(records) > len(best[0]):
            best = (records, skipped, account)
    if best is None:
        raise KontoauszugError("Die Excel-Datei enthält kein Blatt.")
    return _assign(best[0], "Excel", best[2], best[1], None, None)


def _xlsx_tables(archive: zipfile.ZipFile) -> list[list[list[object]]]:
    if "xl/workbook.xml" not in archive.namelist():
        raise KontoauszugError("Die Excel-Datei enthält keine Arbeitsmappe.")
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        node.attrib["Id"]: node.attrib["Target"]
        for node in rels
        if node.attrib.get("Id")
    }
    shared: list[str] = []
    if "xl/sharedStrings.xml" in archive.namelist():
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        shared = ["".join(node.itertext()) for node in root.findall("m:si", NS)]
    tables: list[list[list[object]]] = []
    for sheet in workbook.findall(".//m:sheet", NS):
        relation = sheet.attrib.get(
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id",
            "",
        )
        target = targets.get(relation, "")
        path = target.lstrip("/") if target.startswith("/") else f"xl/{target.lstrip('./')}"
        if path not in archive.namelist():
            continue
        root = ET.fromstring(archive.read(path))
        rows: dict[int, dict[int, object]] = {}
        for cell in root.findall(".//m:c", NS):
            ref = cell.attrib.get("r", "")
            column = 0
            row_number = 0
            for char in ref:
                if char.isalpha():
                    column = column * 26 + ord(char.upper()) - 64
                elif char.isdigit():
                    row_number = row_number * 10 + int(char)
            if row_number == 0:
                continue
            rows.setdefault(row_number, {})[column] = _xlsx_value(cell, shared)
        table: list[list[object]] = []
        for row_number in sorted(rows):
            width = max(rows[row_number], default=0)
            table.append([rows[row_number].get(col, "") for col in range(1, width + 1)])
        if table:
            tables.append(table)
    return tables


def _xlsx_value(cell: ET.Element, shared: list[str]) -> object:
    kind = cell.attrib.get("t")
    if kind == "inlineStr":
        return "".join(cell.itertext())
    node = cell.find("m:v", NS)
    if node is None or node.text is None:
        return ""
    raw = node.text
    if kind == "s":
        try:
            return shared[int(raw)]
        except (IndexError, ValueError):
            return raw
    if kind == "b":
        return raw == "1"
    if any(mark in raw for mark in ".eE"):
        return float(raw)
    if raw.lstrip("-").isdigit():
        return int(raw)
    return raw


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _first(element: ET.Element, name: str) -> ET.Element | None:
    for child in element:
        if _local(child.tag) == name:
            return child
    return None


def _text(element: ET.Element | None) -> str:
    return "" if element is None else "".join(element.itertext()).strip()


def _from_camt(content: bytes) -> Statement:
    try:
        root = ET.fromstring(content)
    except ET.ParseError as error:
        raise KontoauszugError("Die XML-Datei ist kein lesbarer CAMT-Kontoauszug.") from error
    records: list[dict] = []
    account = ""
    closing: float | None = None
    closing_date: str | None = None
    statements = [node for node in root.iter() if _local(node.tag) == "Stmt"]
    if not statements:
        raise KontoauszugError("Die XML-Datei enthält keinen CAMT-Auszug.")
    for statement in statements:
        own = ""
        account_node = _first(statement, "Acct")
        if account_node is not None:
            for node in account_node.iter():
                if _local(node.tag) == "IBAN" and _text(node):
                    own = _text(node).replace(" ", "")
                    break
        if own and not account:
            account = own
        for balance in statement:
            if _local(balance.tag) != "Bal":
                continue
            code = ""
            for node in balance.iter():
                if _local(node.tag) == "Cd":
                    code = _text(node)
                    break
            if code != "CLBD":
                continue
            amount = _parse_amount(_text(_first(balance, "Amt")))
            if amount is None:
                continue
            mark = _text(_first(balance, "CdtDbtInd"))
            closing = -abs(amount) if mark == "DBIT" else abs(amount)
            date_node = _first(balance, "Dt")
            closing_date = _parse_date(_text(date_node)[:10] if date_node is not None else "")
        for entry in statement:
            if _local(entry.tag) != "Ntry":
                continue
            amount = _parse_amount(_text(_first(entry, "Amt")))
            if amount is None:
                continue
            if _text(_first(entry, "CdtDbtInd")) == "DBIT":
                amount = -abs(amount)
            else:
                amount = abs(amount)
            if amount == 0:
                continue
            booked = _camt_date(entry, "BookgDt") or _camt_date(entry, "ValDt")
            if booked is None:
                continue
            party = ""
            iban = ""
            purpose_parts: list[str] = []
            details = [node for node in entry.iter() if _local(node.tag) == "TxDtls"]
            for detail in details:
                wanted = "Cdtr" if amount < 0 else "Dbtr"
                for node in detail.iter():
                    if _local(node.tag) == wanted:
                        name = _text(_first(node, "Nm"))
                        if name:
                            party = name
                    if _local(node.tag) == "IBAN" and not iban:
                        candidate = _text(node).replace(" ", "")
                        if candidate and candidate != own:
                            iban = candidate
                    if _local(node.tag) == "Ustrd":
                        purpose_parts.append(_text(node))
            amount_node = _first(entry, "Amt")
            currency = _currency(amount_node.attrib.get("Ccy") if amount_node is not None else "")
            records.append(
                {
                    "buchungsdatum": booked,
                    "valuta": _camt_date(entry, "ValDt"),
                    "betrag": amount,
                    "waehrung": currency,
                    "buchungstext": _clean_text(_text(_first(entry, "AddtlNtryInf"))),
                    "verwendungszweck": _clean_text(" ".join(purpose_parts)),
                    "gegenpartei": party,
                    "gegen_iban": iban,
                    "eigenkonto": own,
                }
            )
    return _assign(records, "CAMT", account, 0, closing, closing_date)


def _camt_date(entry: ET.Element, wrapper: str) -> str | None:
    node = _first(entry, wrapper)
    if node is None:
        return None
    for child in node:
        if _local(child.tag) in {"Dt", "DtTm"}:
            return _parse_date(_text(child)[:10])
    return _parse_date(_text(node)[:10])


def _from_mt940(text: str) -> Statement:
    tags: list[tuple[str, str]] = []
    current: str | None = None
    buffer: list[str] = []
    for line in text.splitlines():
        match = re.match(r"^:([0-9A-Z]{2,3}):(.*)$", line)
        if match:
            if current is not None:
                tags.append((current, "".join(buffer)))
            current = match.group(1)
            buffer = [match.group(2)]
            continue
        if current is not None and line.strip() not in {"", "-"}:
            buffer.append(line.strip())
    if current is not None:
        tags.append((current, "".join(buffer)))
    account = next((value.strip() for tag, value in tags if tag == "25"), "")
    closing: float | None = None
    closing_date: str | None = None
    currency = "EUR"
    for tag, value in tags:
        if tag not in {"60F", "60M", "62F", "62M"}:
            continue
        match = MT_BALANCE.match(value.replace(" ", ""))
        if not match:
            continue
        currency = _currency(match.group("ccy"))
        if tag not in {"62F", "62M"}:
            continue
        amount = _parse_amount(match.group("amount"))
        if amount is None:
            continue
        closing = -abs(amount) if match.group("dc") == "D" else abs(amount)
        parsed = _yyMMdd(match.group("date"))
        closing_date = parsed.isoformat() if parsed else None
    records: list[dict] = []
    pending: dict | None = None
    for tag, value in tags:
        if tag == "61":
            if pending:
                records.append(pending)
            pending = _mt61(value, account, currency)
            continue
        if tag == "86" and pending is not None:
            text_value, purpose, party = _mt86(value)
            pending["buchungstext"] = text_value or pending["buchungstext"]
            pending["verwendungszweck"] = purpose or pending["verwendungszweck"]
            pending["gegenpartei"] = party or pending["gegenpartei"]
    if pending:
        records.append(pending)
    records = [row for row in records if row]
    return _assign(records, "MT940", account, 0, closing, closing_date)


def _mt61(value: str, account: str, currency: str) -> dict | None:
    match = MT61.match(value.replace(" ", ""))
    if not match:
        return None
    valuta = _yyMMdd(match.group("date"))
    if valuta is None:
        return None
    booked = valuta
    entry = match.group("entry")
    if entry:
        try:
            booked = date(valuta.year, int(entry[:2]), int(entry[2:]))
        except ValueError:
            booked = valuta
    amount = _parse_amount(match.group("amount"))
    if amount is None or amount == 0:
        return None
    mark = match.group("dc")
    if mark in {"D", "RC"}:
        amount = -abs(amount)
    else:
        amount = abs(amount)
    return {
        "buchungsdatum": booked.isoformat(),
        "valuta": valuta.isoformat(),
        "betrag": amount,
        "waehrung": currency,
        "buchungstext": "",
        "verwendungszweck": "",
        "gegenpartei": "",
        "gegen_iban": "",
        "eigenkonto": account,
    }


def _mt86(value: str) -> tuple[str, str, str]:
    parts = re.findall(r"\?(\d{2})([^?]*)", value)
    if not parts:
        return "", _clean_text(value), ""
    purpose = _clean_text("".join(text for code, text in parts if code in {f"{i:02d}" for i in range(20, 30)}))
    party = _clean_text("".join(text for code, text in parts if code in {"32", "33"}))
    label = _clean_text(next((text for code, text in parts if code == "00"), ""))
    return label, purpose, party
