#!/usr/bin/env python3
"""Startseite NUR mit Inline-Styles – funktioniert im SharePoint-Text-Webpart.

Kein DOCTYPE, kein <html>, kein <style>, kein <script>.
Ausgabe: design-html/STARTSEITE-INLINE.html
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAP = json.loads((ROOT / "app-sharepoint-map.json").read_text(encoding="utf-8"))
kpi_path = ROOT / "zahlen" / "kpi-summary.json"
KPI = json.loads(kpi_path.read_text(encoding="utf-8")) if kpi_path.exists() else {
    "buchungen_anzahl": 10509, "projekte_anzahl": 153, "kostenarten_anzahl": 108
}

SITE = "https://tvfaltwert.sharepoint.com/sites/03-Finance"
PAGES = f"{SITE}/SitePages"
DOCS = f"{SITE}/Shared%20Documents/TVF-Controlling-Cockpit"
HOME = "TVF-ALTWERT-GMBH-Dashboard"

# SharePoint-sichere Inline-Styles
S = {
    "wrap": "font-family:Segoe UI,Arial,sans-serif;color:#1A1A1A;margin:0;padding:0;",
    "hero": "background:linear-gradient(120deg,#1F4E79 0%,#5B2C6F 100%);color:#ffffff;padding:28px 24px;margin:0 0 16px 0;",
    "brand": "font-size:28px;font-weight:700;letter-spacing:0.04em;margin:0 0 8px 0;line-height:1.2;",
    "heroP": "font-size:15px;margin:0;max-width:720px;line-height:1.45;opacity:0.95;",
    "pills": "margin-top:18px;",
    "pill": "display:inline-block;background:#ffffff22;color:#ffffff;text-decoration:none;padding:8px 14px;margin:0 8px 8px 0;border:1px solid #ffffff55;font-size:13px;font-weight:600;",
    "kpiRow": "margin:0 0 20px 0;",
    "kpi": "display:inline-block;vertical-align:top;width:22%;min-width:120px;background:#ffffff;border-left:4px solid #1F4E79;padding:12px 14px;margin:0 1% 10px 0;box-sizing:border-box;",
    "kpiK": "font-size:11px;color:#5F6B7A;text-transform:uppercase;letter-spacing:0.06em;",
    "kpiV": "font-size:22px;font-weight:700;color:#1F4E79;margin-top:4px;",
    "h2": "font-size:13px;text-transform:uppercase;letter-spacing:0.12em;color:#5F6B7A;margin:22px 0 10px 0;font-weight:700;",
    "tile": "display:inline-block;vertical-align:top;width:23%;min-width:160px;background:#F3F6F9;border-left:4px solid #1F4E79;padding:14px 14px;margin:0 1% 12px 0;text-decoration:none;color:#1A1A1A;box-sizing:border-box;",
    "tileLab": "font-size:15px;font-weight:700;color:#1F4E79;margin:0 0 6px 0;",
    "tileSub": "font-size:12px;color:#5F6B7A;margin:0;line-height:1.35;",
    "note": "font-size:12px;color:#5F6B7A;margin:8px 0 16px 0;line-height:1.4;",
    "pad": "padding:0 8px 24px 8px;",
    "a": "color:#1F4E79;font-weight:600;",
}


def page(name: str) -> str:
    return f"{PAGES}/{name}.aspx"


def main() -> None:
    pills = [
        ("TVF-Cockpit", "Cockpit"),
        ("TVF-Steuerung", "Steuerung"),
        ("TVF-GuV", "GuV"),
        ("TVF-Forecast", "Forecast"),
        ("TVF-Regionen", "Regionen"),
        ("TVF-Projekte", "Projekte"),
        ("TVF-FC-Eingabe", "FC Eingabe"),
        ("TVF-Zahlen", "Zahlen"),
    ]
    pill_html = "".join(
        f'<a href="{page(s)}" style="{S["pill"]}">{lab}</a>' for s, lab in pills
    )

    buch = KPI.get("buchungen_anzahl", 0)
    proj = KPI.get("projekte_anzahl", 0)
    ka = KPI.get("kostenarten_anzahl", 0)

    parts = [
        f'<div style="{S["wrap"]}">',
        f'<div style="{S["hero"]}">',
        f'<div style="{S["brand"]}">TVF ALTWERT</div>',
        f'<p style="{S["heroP"]}">Controlling Cockpit 2026 – Lagebild, GuV, Forecast, Regionen und Projekte. '
        f"Gerettete Zahlen: {buch} Buchungen · {proj} Projekte · {ka} Kostenarten.</p>",
        f'<div style="{S["pills"]}">{pill_html}</div>',
        "</div>",
        f'<div style="{S["pad"]}">',
        f'<div style="{S["kpiRow"]}">',
        f'<div style="{S["kpi"]}"><div style="{S["kpiK"]}">Buchungen</div><div style="{S["kpiV"]}">{buch}</div></div>',
        f'<div style="{S["kpi"]}"><div style="{S["kpiK"]}">Projekte</div><div style="{S["kpiV"]}">{proj}</div></div>',
        f'<div style="{S["kpi"]}"><div style="{S["kpiK"]}">Kostenarten</div><div style="{S["kpiV"]}">{ka}</div></div>',
        f'<div style="{S["kpi"]}"><div style="{S["kpiK"]}">Geschäftsjahr</div><div style="{S["kpiV"]}">2026</div></div>',
        "</div>",
        f'<p style="{S["note"]}">Excel: <a style="{S["a"]}" href="{DOCS}/Cockpit.xlsx">Cockpit.xlsx</a> (Hub) · '
        f'<a style="{S["a"]}" href="{DOCS}/zahlen/TVF_Zahlen_Export.xlsx">Zahlen-Export</a> · '
        f'Ordner <a style="{S["a"]}" href="{DOCS}">TVF-Controlling-Cockpit</a></p>',
    ]

    # Kern-Kacheln zuerst
    parts.append(f'<div style="{S["h2"]}">Direktzugriff</div>')
    core = [
        ("TVF-Cockpit", "Cockpit", "Lagebild & Kennzahlen"),
        ("TVF-Steuerung", "Steuerung", "Jahr, Monat, Region"),
        ("TVF-GuV", "GuV / EBITDA", "Monats- und YTD-GuV"),
        ("TVF-Forecast", "Forecast", "Ist + Forecast"),
        ("TVF-FC-Eingabe", "Forecast eingeben", "Deltas erfassen"),
        ("TVF-Regionen", "Regionen", "West, Süd-West, Ost, Berlin"),
        ("TVF-Projekte", "Projekte", "Projektergebnisse"),
        ("TVF-Zahlen", "Zahlen-Export", "Gerettete DB-Zahlen"),
    ]
    for seite, lab, sub in core:
        parts.append(
            f'<a href="{page(seite)}" style="{S["tile"]}">'
            f'<div style="{S["tileLab"]}">{lab}</div>'
            f'<div style="{S["tileSub"]}">{sub}</div></a>'
        )

    for g in MAP.get("gruppen", []):
        parts.append(f'<div style="{S["h2"]}">{g["gruppe"]}</div>')
        for it in g["items"]:
            excel = it.get("excel") or ""
            hub = it.get("hubBlatt")
            sub = excel + (f" · {hub}" if hub else "")
            parts.append(
                f'<a href="{page(it["seite"])}" style="{S["tile"]}">'
                f'<div style="{S["tileLab"]}">{it["label"]}</div>'
                f'<div style="{S["tileSub"]}">{sub}</div></a>'
            )

    parts.append(
        f'<p style="{S["note"]}">Regionen: '
        f'<a style="{S["a"]}" href="{page("TVF-Region-West")}">West</a> · '
        f'<a style="{S["a"]}" href="{page("TVF-Region-Sued-West")}">Süd-West</a> · '
        f'<a style="{S["a"]}" href="{page("TVF-Region-Ost")}">Ost</a> · '
        f'<a style="{S["a"]}" href="{page("TVF-Region-Berlin")}">Berlin</a> · '
        f'<a style="{S["a"]}" href="{page("TVF-Region-Verwaltung")}">Verwaltung</a></p>'
    )
    parts.append("</div></div>")

    html = "\n".join(parts) + "\n"
    out = ROOT / "design-html"
    out.mkdir(parents=True, exist_ok=True)
    (out / "STARTSEITE-INLINE.html").write_text(html, encoding="utf-8")

    # Kurze Hand-Anleitung daneben
    (out / "STARTSEITE-SO-EINFUEGEN.md").write_text(
        f"""# Startseite einfügen (sichtbares Layout, kein Quellcode)

Die Datei **STARTSEITE-INLINE.html** enthält nur Inline-Styles.
SharePoint zeigt sie im **Text-Webpart** als Layout – nicht als Code.

## Variante PowerShell (empfohlen)

```
cd ~/TVF-Cockpit/scripts
.\\Connect-TVF.ps1
.\\New-TVFStartseite.ps1
```

## Variante Hand

1. Dashboard öffnen: {SITE}/SitePages/{HOME}.aspx
2. **Bearbeiten**
3. Alten Code-/HTML-Block mit Quelltext **löschen**
4. **+** → Webpart **Text** (nicht „Code“, nicht Datei-Viewer auf die .html)
5. Im Text-Webpart oben auf **…** oder **</>** (HTML bearbeiten / Quellcode) – falls vorhanden
6. Inhalt von STARTSEITE-INLINE.html **komplett** einfügen (beginnt mit `<div style=…`)
7. Speichern / Vorschau: du musst **Kacheln und blauen Kopf** sehen, keinen CSS-Text
8. Darunter **Datei-Viewer** → `Cockpit.xlsx` aus TVF-Controlling-Cockpit
9. **Seite veröffentlichen**

Wenn du wieder nur Quellcode siehst: du bist im falschen Webpart (Code) oder hast die volle STARTSEITE.html mit `<style>` eingefügt. Nur **STARTSEITE-INLINE.html** verwenden.
""",
        encoding="utf-8",
    )
    print(f"Wrote {out / 'STARTSEITE-INLINE.html'} ({len(html)} chars)")


if __name__ == "__main__":
    main()
