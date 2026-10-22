#!/usr/bin/env python3
"""Liest die SQLite-Datei und liefert die berechneten Blätter."""

from __future__ import annotations

import gzip
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from model import build, journal_rows

HOST = "127.0.0.1"
PORT = 8787


class Handler(BaseHTTPRequestHandler):
    dashboard = None
    journal = None

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
