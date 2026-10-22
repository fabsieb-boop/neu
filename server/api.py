#!/usr/bin/env python3
"""Liest die SQLite-Datei und liefert die berechneten Blätter."""

from __future__ import annotations

import gzip
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock

from model import ForecastInputError, add_forecast_plan, build, journal_rows

HOST = os.environ.get("TVF_API_HOST", "127.0.0.1")
PORT = int(os.environ.get("TVF_API_PORT", "8787"))


class Handler(BaseHTTPRequestHandler):
    dashboard = None
    journal = None
    forecast_lock = Lock()

    def log_message(self, fmt: str, *args) -> None:
        print(f"[api] {self.address_string()} {fmt % args}")

    def do_GET(self) -> None:  # noqa: N802
        if self.path.startswith("/api/dashboard"):
            self._json(self.dashboard)
            return
        if self.path.startswith("/api/journal"):
            self._json(self.journal)
            return
        self.send_error(404)

    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") != "/api/forecast":
            self.send_error(404)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 64 * 1024:
                raise ForecastInputError("Die Forecast-Eingabe ist ungültig.")
            payload = json.loads(self.rfile.read(content_length))
            if not isinstance(payload, dict):
                raise ForecastInputError("Die Forecast-Eingabe ist ungültig.")

            with self.forecast_lock:
                saved = add_forecast_plan(
                    payload.get("projektNr"),
                    payload.get("groesse"),
                    payload.get("werte"),
                )
                dashboard = build()
                Handler.dashboard = dashboard
            self._json({"saved": len(saved), "entries": saved, "dashboard": dashboard}, status=201)
        except ForecastInputError as error:
            self._json({"error": str(error)}, status=400)
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
            self._json({"error": "Die Forecast-Eingabe ist ungültig."}, status=400)
        except Exception as error:
            print(f"[api] Forecast konnte nicht gespeichert werden: {error}")
            self._json({"error": "Der Forecast konnte nicht gespeichert werden."}, status=500)

    def _json(self, payload, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
        headers = {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"}
        if "gzip" in self.headers.get("Accept-Encoding", ""):
            body = gzip.compress(body)
            headers["Content-Encoding"] = "gzip"
        headers["Content-Length"] = str(len(body))
        self.send_response(status)
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
