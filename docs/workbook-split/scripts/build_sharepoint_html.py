#!/usr/bin/env python3
"""Baut alle SharePoint-HTML-Dateien neu aus app-sharepoint-map.json.

Zielstruktur auf SharePoint (Dokumente):
  TVF-Controlling-Cockpit/
    Cockpit.xlsx, GuV.xlsx, …   (Excels flach)
    zahlen/
    design-html/   ← generierte HTML landen lokal hier und können hochgeladen werden
    scripts/

Seiten (Site Pages, nicht in Dokumente):
  …/SitePages/TVF-….aspx
"""
from __future__ import annotations

import json
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "app-sharepoint-map.json"
KPI_PATH = ROOT / "zahlen" / "kpi-summary.json"
OUT = ROOT / "design-html"
SEITEN = OUT / "seiten"

SITE = "https://tvfaltwert.sharepoint.com/sites/03-Finance"
# Bibliothek heißt in der UI „Dokumente“, Server-Pfad typisch Shared Documents
DOCS_REL = "/sites/03-Finance/Shared Documents/TVF-Controlling-Cockpit"
DOCS_URL = SITE.replace("/sites/03-Finance", "") + DOCS_REL.replace(" ", "%20")
# Robuster: absolute URLs
DOCS_BASE = f"{SITE}/Shared%20Documents/TVF-Controlling-Cockpit"
PAGES_BASE = f"{SITE}/SitePages"
HOME_PAGE = "TVF-ALTWERT-GMBH-Dashboard"

CSS = """
:root{--primary:#1F4E79;--accent:#5B2C6F;--surface:#F3F6F9;--text:#1A1A1A;--muted:#5F6B7A;--ok:#1B7A4E;--warn:#B45309}
*{box-sizing:border-box}
.tvf-root,body{margin:0;font-family:"Segoe UI",system-ui,sans-serif;color:var(--text);background:linear-gradient(165deg,#e8eef5 0%,#f7f3f9 45%,#f3f6f9 100%)}
.hero{background:linear-gradient(120deg,var(--primary),var(--accent));color:#fff;padding:28px 32px 36px;position:relative;overflow:hidden}
.hero::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 85% 20%,rgba(255,255,255,.18),transparent 45%);pointer-events:none}
.brand{font-size:28px;font-weight:700;letter-spacing:.04em;margin:0 0 6px;position:relative;z-index:1}
.hero p{margin:0;max-width:52ch;opacity:.92;font-size:15px;line-height:1.45;position:relative;z-index:1}
.navpills{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;position:relative;z-index:1}
.navpills a{background:rgba(255,255,255,.14);color:#fff;text-decoration:none;padding:8px 14px;border:1px solid rgba(255,255,255,.28);font-size:13px;font-weight:600}
.navpills a:hover{background:rgba(255,255,255,.28)}
.wrap{padding:22px 28px 40px;max-width:1180px;margin:0 auto}
.gruppe{margin:0 0 26px}
.gruppe h2{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 12px;font-weight:700}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.tile{display:block;text-decoration:none;color:var(--text);background:#fff;border:1px solid #d7dee8;padding:16px 16px 14px;min-height:110px}
.tile:hover{border-color:var(--primary)}
.tile .lab{font-weight:700;font-size:15px;margin:0 0 6px;color:var(--primary)}
.tile .sub{font-size:12px;color:var(--muted);margin:0;line-height:1.35}
.kpirow{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:18px 0 8px}
.kpi{background:#fff;border-left:4px solid var(--primary);padding:12px 14px}
.kpi .k{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.kpi .v{font-size:20px;font-weight:700;margin-top:4px;color:var(--primary)}
.note{font-size:12px;color:var(--muted);margin-top:10px}
.footer{margin-top:28px;padding-top:14px;border-top:1px solid #d7dee8;font-size:12px;color:var(--muted)}
.subhero{background:linear-gradient(120deg,var(--primary),#2a5f8f);color:#fff;padding:20px 28px;position:relative}
.subhero .brand{font-size:18px;letter-spacing:.08em}
.subhero h1{margin:0 0 4px;font-size:22px}
.subhero p{margin:0;opacity:.9;font-size:14px}
.box{background:#fff;border:1px solid #d7dee8;padding:16px;margin:12px 0}
.box a{color:var(--primary);font-weight:600}
""".strip()


def page_url(seitenname: str) -> str:
    return f"{PAGES_BASE}/{seitenname}.aspx"


def excel_url(filename: str, in_zahlen: bool = False) -> str:
    if not filename:
        return ""
    enc = urllib.parse.quote(filename)
    if in_zahlen or filename == "TVF_Zahlen_Export.xlsx":
        return f"{DOCS_BASE}/zahlen/{enc}"
    return f"{DOCS_BASE}/{enc}"


def nav_pills(active: str | None = None) -> str:
    items = [
        (HOME_PAGE, "Dashboard"),
        ("TVF-Cockpit", "Cockpit"),
        ("TVF-Steuerung", "Steuerung"),
        ("TVF-GuV", "GuV"),
        ("TVF-Forecast", "Forecast"),
        ("TVF-Regionen", "Regionen"),
        ("TVF-Projekte", "Projekte"),
        ("TVF-FC-Eingabe", "FC Eingabe"),
        ("TVF-Zahlen", "Zahlen"),
    ]
    parts = []
    for seite, label in items:
        parts.append(f'<a href="{page_url(seite)}">{label}</a>')
    return '<div class="navpills">' + "".join(parts) + "</div>"


def full_doc(title: str, body_inner: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{title}</title>
<style>
{CSS}
</style></head><body>
{body_inner}
</body></html>
"""


def embed_frag(body_inner: str) -> str:
    return f"""<!-- TVF – für SharePoint Einbetten-Webpart | Ordner: Dokumente/TVF-Controlling-Cockpit -->
<div class="tvf-root">
<style>
{CSS}
</style>
{body_inner}
</div>
"""


def load_map():
    return json.loads(MAP_PATH.read_text(encoding="utf-8"))


def load_kpi():
    if KPI_PATH.exists():
        return json.loads(KPI_PATH.read_text(encoding="utf-8"))
    return {"buchungen_anzahl": 10509, "projekte_anzahl": 153, "kostenarten_anzahl": 108}


def build_start(nav: dict, kpi: dict) -> str:
    tiles = []
    for g in nav["gruppen"]:
        tiles.append(f'<section class="gruppe"><h2>{g["gruppe"]}</h2><div class="tiles">')
        for it in g["items"]:
            excel = it.get("excel") or "—"
            hub = it.get("hubBlatt")
            sub = excel + (f" · {hub}" if hub else "")
            ex_url = excel_url(excel, in_zahlen=(it.get("seite") == "TVF-Zahlen" or excel == "TVF_Zahlen_Export.xlsx"))
            file_hint = f'<br><span>Datei: {excel}</span>' if excel != "—" else ""
            tiles.append(
                f'<a class="tile" href="{page_url(it["seite"])}">'
                f'<div class="lab">{it["label"]}</div>'
                f'<p class="sub">{sub}{file_hint}</p></a>'
            )
        tiles.append("</div></section>")

    body = f"""
<header class="hero">
  <div class="brand">TVF ALTWERT</div>
  <p>Controlling Cockpit 2026 – Lagebild, GuV, Forecast, Regionen und Projekte.
  Zahlen gerettet: {kpi.get('buchungen_anzahl', 0)} Buchungen, {kpi.get('projekte_anzahl', 0)} Projekte.</p>
  {nav_pills()}
</header>
<main class="wrap">
  <div class="kpirow">
    <div class="kpi"><div class="k">Buchungen</div><div class="v">{kpi.get('buchungen_anzahl', 0)}</div></div>
    <div class="kpi"><div class="k">Projekte</div><div class="v">{kpi.get('projekte_anzahl', 0)}</div></div>
    <div class="kpi"><div class="k">Kostenarten</div><div class="v">{kpi.get('kostenarten_anzahl', 0)}</div></div>
    <div class="kpi"><div class="k">GJ</div><div class="v">2026</div></div>
  </div>
  <p class="note">Excel-Ordner: <a href="{DOCS_BASE}">Dokumente / TVF-Controlling-Cockpit</a>
  · Hub: <a href="{excel_url('Cockpit.xlsx')}">Cockpit.xlsx</a>
  · Zahlen: <a href="{excel_url('TVF_Zahlen_Export.xlsx', True)}">zahlen/TVF_Zahlen_Export.xlsx</a>
  · HTML-Vorlagen: <a href="{DOCS_BASE}/design-html">design-html/</a></p>
  {''.join(tiles)}
  <div class="footer">Site {SITE} · Struktur: Excels flach, Ordner zahlen / design-html / scripts</div>
</main>
"""
    return body


def build_unterseite(it: dict, gruppe: str) -> str:
    excel = it.get("excel")
    hub = it.get("hubBlatt")
    in_zahlen = it.get("seite") == "TVF-Zahlen" or excel == "TVF_Zahlen_Export.xlsx"
    ex_url = excel_url(excel, in_zahlen) if excel else ""
    file_hint = excel or "—"
    if hub and excel:
        file_hint = f"{excel} → Blatt „{hub}“"

    excel_block = ""
    if ex_url:
        excel_block = f"""
  <div class="box">
    <p><b>Excel öffnen:</b> <a href="{ex_url}" data-interception="off" target="_blank">{file_hint}</a></p>
    <p class="note">Im SharePoint-Seiten-Editor zusätzlich Webpart „Datei-Viewer“ auf dieselbe Datei setzen.</p>
  </div>"""
    else:
        excel_block = '<div class="box"><p>Keine Excel – nur HTML-Inhalt.</p></div>'

    return f"""
<header class="subhero">
  <div class="brand">TVF ALTWERT</div>
  <h1>{it['label']}</h1>
  <p>Gruppe {gruppe} · Seite {it['seite']} · App {it.get('app') or '—'}</p>
  {nav_pills(it['seite'])}
</header>
<main class="wrap">
  <section class="gruppe">
    <h2>Inhalt</h2>
    <p>SharePoint-Seite <b>{it['seite']}</b> unter <b>Seiten</b> (Site Pages).</p>
    <p>Excel liegt in <b>Dokumente / TVF-Controlling-Cockpit</b>{' / zahlen' if in_zahlen else ''}.</p>
    {"<p>Region-Filter: <b>"+it['region']+"</b></p>" if it.get('region') else ""}
  </section>
  {excel_block}
  <div class="footer"><a href="{page_url(HOME_PAGE)}">← Dashboard</a> · HTML-Quelle: design-html/seiten/{it['seite']}.html</div>
</main>
"""


def main():
    nav = load_map()
    kpi = load_kpi()
    OUT.mkdir(parents=True, exist_ok=True)
    SEITEN.mkdir(parents=True, exist_ok=True)

    start_body = build_start(nav, kpi)
    (OUT / "STARTSEITE.html").write_text(full_doc("TVF ALTWERT – Controlling Cockpit", start_body), encoding="utf-8")
    (OUT / "STARTSEITE-SHAREPOINT.html").write_text(embed_frag(start_body), encoding="utf-8")

    # Regionen-Hub-Seite falls nicht in map items
    regionen_hub = {
        "label": "Regionen",
        "seite": "TVF-Regionen",
        "excel": "Regionen.xlsx",
        "app": "/regionen",
        "layout": "regionen-hub",
    }
    # write all map items + cockpit + regionen hub
    written = []
    cockpit = {
        "label": "Cockpit",
        "seite": "TVF-Cockpit",
        "excel": "Cockpit.xlsx",
        "hubBlatt": "Cockpit",
        "app": "/dash",
    }
    for it, gruppe in [(cockpit, "Start"), (regionen_hub, "Regionen")]:
        body = build_unterseite(it, gruppe)
        (SEITEN / f"{it['seite']}.html").write_text(full_doc(f"{it['label']} | TVF ALTWERT", body), encoding="utf-8")
        (SEITEN / f"{it['seite']}-SHAREPOINT.html").write_text(embed_frag(body), encoding="utf-8")
        written.append(it["seite"])

    for g in nav["gruppen"]:
        for it in g["items"]:
            body = build_unterseite(it, g["gruppe"])
            (SEITEN / f"{it['seite']}.html").write_text(
                full_doc(f"{it['label']} | TVF ALTWERT", body), encoding="utf-8"
            )
            (SEITEN / f"{it['seite']}-SHAREPOINT.html").write_text(embed_frag(body), encoding="utf-8")
            written.append(it["seite"])

    # Vorlage
    vorlage_body = build_unterseite(
        {"label": "{{TITEL}}", "seite": "{{SEITE}}", "excel": "{{EXCEL}}", "app": "{{APP}}"},
        "{{GRUPPE}}",
    )
    (OUT / "UNTERSEITE-VORLAGE.html").write_text(full_doc("{{TITEL}}", vorlage_body), encoding="utf-8")
    (OUT / "UNTERSEITE-SHAREPOINT-VORLAGE.html").write_text(embed_frag(vorlage_body), encoding="utf-8")

    # Index für Upload
    index_lines = [
        "# design-html – neu gebaut für SharePoint-Struktur",
        "",
        f"Site: {SITE}",
        f"Excel-Ordner: {DOCS_BASE}",
        f"Seiten: {PAGES_BASE}/…",
        "",
        "## Dateien",
        "- STARTSEITE.html – Vorschau / volles Dokument",
        "- STARTSEITE-SHAREPOINT.html – **in Einbetten-Webpart auf dem Dashboard**",
        "- seiten/TVF-….html – volles Dokument",
        "- seiten/TVF-…-SHAREPOINT.html – **für Einbetten-Webpart der Unterseite**",
        "",
        "## Seitenliste",
    ]
    for s in sorted(set(written)):
        index_lines.append(f"- {s} → {page_url(s)}")
    (OUT / "README.md").write_text("\n".join(index_lines) + "\n", encoding="utf-8")

    # Pfad-Manifest für PowerShell
    manifest = {
        "siteUrl": SITE,
        "docsFolder": "TVF-Controlling-Cockpit",
        "docsUrl": DOCS_BASE,
        "pagesBase": PAGES_BASE,
        "homePage": HOME_PAGE,
        "subfolders": ["zahlen", "design-html", "scripts"],
        "excelFlat": True,
        "startEmbedHtml": "design-html/STARTSEITE-SHAREPOINT.html",
        "seiten": sorted(set(written)),
    }
    (OUT / "sharepoint-struktur.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    print(f"OK: {len(set(written))} Unterseiten + Startseite → {OUT}")
    print(f"  Docs: {DOCS_BASE}")
    print(f"  Pages: {PAGES_BASE}")
    # Inline-Startseite (Text-Webpart, kein Quellcode)
    try:
        import runpy
        runpy.run_path(str(Path(__file__).resolve().parent / "build_startseite_inline.py"), run_name="__main__")
    except Exception as e:
        print("WARN inline start:", e)


if __name__ == "__main__":
    main()
