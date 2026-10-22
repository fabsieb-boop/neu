#!/usr/bin/env python3
"""Liest die SQLite-Datei und liefert die berechneten Blätter."""

from __future__ import annotations

import gzip
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from model import build, journal_rows

HOST = "127.0.0.1"
PORT = 8787
ROOT = Path(__file__).resolve().parents[1]


class Handler(BaseHTTPRequestHandler):
    dashboard = None
    journal = None

    def log_message(self, fmt: str, *args) -> None:
        print(f"[api] {self.address_string()} {fmt % args}")

    def do_GET(self) -> None:  # noqa: N802
        if self.path.startswith("/api/dashboard"):
            # region agent log
            guv_by_name = {row["name"]: row for row in self.dashboard["guv"]}
            with open("/opt/cursor/logs/debug.log", "a", encoding="utf-8") as debug:
                debug.write(json.dumps({
                    "hypothesisId": "E",
                    "location": "server/api.py:GET-dashboard",
                    "message": "Dashboard payload served to browser",
                    "data": {
                        "path": self.path,
                        "databaseMtimeNs": (ROOT / "data" / "tvf.sqlite").stat().st_mtime_ns,
                        "workbookMtimeNs": (ROOT / "data" / "tvf-dashboard-download.xlsx").stat().st_mtime_ns,
                        "ebitda": sum(guv_by_name["EBITDA"]["values"]),
                        "resultBeforeTax": sum(guv_by_name["Ergebnis vor Steuern"]["values"]),
                        "overviewActualEbitda": sum(row["ebitda"] for row in self.dashboard["months"] if row["ist"]),
                    },
                    "timestamp": int(time.time() * 1000),
                }, ensure_ascii=False) + "\n")
            # endregion
            self._json(self.dashboard)
            return
        if self.path.startswith("/api/journal"):
            self._json(self.journal)
            return
        self.send_error(404)

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/api/debug/guv-render":
            self.send_error(404)
            return
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 65536)
            payload = json.loads(self.rfile.read(length))
        except (ValueError, json.JSONDecodeError):
            self.send_error(400)
            return
        # region agent log
        with open("/opt/cursor/logs/debug.log", "a", encoding="utf-8") as debug:
            debug.write(json.dumps({
                "hypothesisId": "A",
                "location": "server/api.py:POST-guv-render",
                "message": "GuV values calculated by rendered React page",
                "data": {
                    "parts": payload.get("parts"),
                    "terminal": payload.get("terminal"),
                    "ebitda": payload.get("ebitda"),
                    "resultBeforeTax": payload.get("resultBeforeTax"),
                },
                "timestamp": int(time.time() * 1000),
            }, ensure_ascii=False) + "\n")
        # endregion
        self.send_response(204)
        self.end_headers()

    def _json(self, payload) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
        headers = {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"}
        if "gzip" in self.headers.get("Accept-Encoding", ""):
            body = gzip.compress(body)
            headers["Content-Encoding"] = "gzip"
        headers["Content-Length"] = str(len(body))
        self.send_response(200)
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    print("rechne Dashboard …")
    Handler.dashboard = build()
    Handler.journal = journal_rows()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
