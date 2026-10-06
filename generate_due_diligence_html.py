from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from generate_due_diligence_workbook import (
    DEAL_MECHANISMS,
    SOURCES,
    build_checklist,
    build_project_start_tasks,
)


OUTPUT = Path(__file__).with_name("Due_Diligence_Portal.html")


def build_data() -> dict:
    checklist = build_checklist()
    project_tasks = build_project_start_tasks()
    priority_order = {"Kritisch": 0, "Hoch": 1, "Mittel": 2, "Niedrig": 3}
    risk_candidates = sorted(
        enumerate(checklist),
        key=lambda entry: (priority_order[entry[1]["priority"]], entry[0]),
    )[:60]

    project = [
        {
            **task,
            "status": "Nicht begonnen",
            "ownerName": task["owner"],
            "startDate": "",
            "dueDate": "",
            "completedDate": "",
            "evidenceRef": "",
            "comment": "",
            "reviewer": "",
        }
        for task in project_tasks
    ]
    master = [
        {
            **item,
            "status": "Nicht begonnen",
            "owner": "",
            "dueDate": "",
            "probability": "",
            "impact": "",
            "finding": "",
            "purchasePriceEffect": "",
            "reference": "",
            "updatedAt": "",
            "reviewer": "",
        }
        for item in checklist
    ]
    documents = [
        {
            "id": f"DOC-{idx:03d}",
            "area": item["area"],
            "request": item["documents"],
            "scope": "Letzte 3–5 Jahre und LTM"
            if item["area"] in {"Financial", "Tax", "Commercial", "HR & Pensions"}
            else "Aktuell; historische Fälle soweit relevant",
            "purpose": item["question"],
            "priority": item["priority"],
            "mandatory": "Ja" if item["priority"] in {"Kritisch", "Hoch"} else "Zu prüfen",
            "owner": "",
            "requestDate": "",
            "dueDate": "",
            "receivedDate": "",
            "status": "Nicht angefordert",
            "completeness": "Ungeprüft",
            "confidentiality": "Streng vertraulich"
            if item["area"] in {"HR & Pensions", "Compliance, AML & Sanctions"}
            else "Vertraulich",
            "vdrPath": "",
            "checkRef": item["id"],
            "openItems": "",
            "reviewer": "",
        }
        for idx, item in enumerate(checklist, start=1)
    ]
    risks = []
    actions = []
    for idx, (_, item) in enumerate(risk_candidates, start=1):
        risk_id = f"R-{idx:03d}"
        risks.append(
            {
                "id": risk_id,
                "area": item["area"],
                "scenario": item["red_flags"],
                "indicators": item["documents"],
                "analysis": item["analysis"],
                "status": "Zu verifizieren",
                "finding": "",
                "probability": "",
                "impact": "",
                "exposureLow": "",
                "exposureBase": "",
                "exposureHigh": "",
                "measure": item["action"],
                "owner": "",
                "dueDate": "",
                "measureStatus": "Nicht gestartet",
                "transactionEffect": item["deal_impact"],
                "checkRef": item["id"],
                "residualProbability": "",
                "residualImpact": "",
                "decision": "",
                "reviewer": "",
            }
        )
        phase = (
            "Pre-Signing"
            if item["deal_impact"] in {"Abbruch/No-go", "Closing-Bedingung"}
            else (
                "SPA / Signing"
                if item["deal_impact"] in {"SPA/Haftung", "Bewertung/Kaufpreis", "Finanzierung"}
                else "Day 1 / 100 Tage"
            )
        )
        actions.append(
            {
                "id": f"M-{idx:03d}",
                "active": "Zu prüfen",
                "reference": f"{risk_id} / {item['id']}",
                "phase": phase,
                "area": item["area"],
                "measure": item["action"],
                "acceptance": f"Maßnahme für {item['id']} dokumentiert, fachlich abgenommen und durch belastbare Evidenz geschlossen.",
                "priority": item["priority"],
                "owner": "",
                "support": "",
                "startDate": "",
                "dueDate": "",
                "status": "Nicht gestartet",
                "progress": 0,
                "dependency": "",
                "budget": "",
                "effect": item["deal_impact"],
                "evidence": "Evidenz im VDR; Reviewer-Freigabe",
                "escalation": "Fristüberschreitung oder Score ≥17",
                "mechanism": item["protection"],
                "comment": "",
            }
        )

    qoe_examples = [
        ("Einmalkosten", "Restrukturierung, Rechtsfall oder Transaktionskosten auf echte Einmaligkeit prüfen.", "+"),
        ("Einmalertrag", "Versicherungs-/Vergleichsertrag oder Anlagenverkauf aus nachhaltigem Ergebnis entfernen.", "−"),
        ("Owner / Related Party", "Vergütung, Miete und Services auf Marktniveau normalisieren.", "+/−"),
        ("Run-rate", "Umgesetzte Preis-/Kostenänderung nur ab wirksamen Datum und mit Evidenz annualisieren.", "+/−"),
        ("Accounting Error", "Periodenfremde oder fehlerhafte Buchung korrigieren.", "+/−"),
        ("Unterinvestition", "Fehlende laufende Kosten oder Maintenance-Aufwand ergänzen.", "−"),
        ("Stand-alone Costs", "Nach Carve-out notwendige Corporate-/IT-/Insurance-Kosten ergänzen.", "−"),
        ("Synergie", "Käufer-Synergie separat vom Target-QoE ausweisen.", "separat"),
        ("FX / Commodity", "Außergewöhnliche Effekte nur bei klar definierter Normalbasis beurteilen.", "+/−"),
        ("Kunden-/Vertragsereignis", "Verlorenen oder gewonnenen Großkunden mit Datum und Marge berücksichtigen.", "+/−"),
        ("Personal", "Offene Stellen, Bonus, Gehaltsanpassung und Freelancer-Run-rate normalisieren.", "−"),
        ("Sonstige", "Weitere Anpassung mit Gegenkonto, Cash-Wirkung und Wiederkehr belegen.", "+/−"),
    ]
    qoe_rows = [
        {
            "id": f"ADJ-{idx:03d}",
            "category": category,
            "description": description,
            "direction": direction,
            "period": "LTM",
            "managementAmount": "",
            "ddAmount": "",
            "acceptedAmount": "",
            "evidence": "",
            "recurring": "Zu prüfen",
            "cashType": "Zu prüfen",
            "confidence": "",
            "status": "Offen",
            "owner": "",
            "reference": "",
            "comment": "",
        }
        for idx, (category, description, direction) in enumerate(qoe_examples, start=1)
    ]
    nwc_components = [
        ("Vorräte", 1),
        ("Forderungen L&L", 1),
        ("Vertragsvermögenswerte", 1),
        ("Sonstige operative kurzfristige Aktiva", 1),
        ("Verbindlichkeiten L&L", -1),
        ("Deferred Revenue / Vertragsverbindlichkeiten", -1),
        ("Sonstige operative kurzfristige Passiva", -1),
    ]
    debt_items = [
        ("Frei verfügbares Cash", "Cash-like", -1),
        ("Gesperrtes / regulatorisches Cash", "Excluded cash", 0),
        ("Bankdarlehen", "Debt", 1),
        ("Aufgelaufene Zinsen / Vorfälligkeit", "Debt-like", 1),
        ("Gesellschafterdarlehen", "Debt", 1),
        ("Leasingverbindlichkeiten", "Debt-like", 1),
        ("Factoring / Reverse Factoring", "Debt-like", 1),
        ("Cash Pool Saldo", "Debt/Cash", 1),
        ("Unbezahlte Dividenden / Leakage", "Debt-like", 1),
        ("Transaktionsboni", "Debt-like", 1),
        ("Überfällige Steuern / Sozialabgaben", "Debt-like", 1),
        ("Capex-Kreditoren", "Debt-like", 1),
        ("Unterdotierte Pensionen", "Debt-like", 1),
        ("Rechts-/Umweltpositionen", "Case-by-case", 1),
        ("Deferred Revenue", "NWC / Case-by-case", 0),
        ("Garantien / Bürgschaften", "Contingent", 0),
        ("Sonstige", "Case-by-case", 1),
    ]
    mechanisms = [
        {
            "mechanism": row[0],
            "suitable": row[1],
            "examples": row[2],
            "design": row[3],
            "risk": row[4],
            "lead": row[5],
            "decision": "",
            "status": "Zu prüfen",
        }
        for row in DEAL_MECHANISMS
    ]
    sources = [
        {
            "id": row[0],
            "title": row[1],
            "publisher": row[2],
            "url": row[3],
            "use": row[4],
            "note": row[5],
        }
        for row in SOURCES
    ]
    return {
        "schemaVersion": 1,
        "generatedAt": date.today().isoformat(),
        "meta": {
            "target": "",
            "transactionType": "Share Deal",
            "buyer": "",
            "ddDate": "",
            "projectLead": "",
            "version": "1.0",
            "confidentiality": "Streng vertraulich",
            "currency": "EUR",
            "materiality": "",
        },
        "projectTasks": project,
        "checklist": master,
        "documents": documents,
        "risks": risks,
        "actions": actions,
        "qa": [],
        "finance": {
            "periods": ["2022A", "2023A", "2024A", "LTM / aktuell", "Budget"],
            "values": {},
            "comments": {},
        },
        "qoe": {"reportedEbitda": "", "rows": qoe_rows},
        "nwc": {
            "months": [f"Monat {month}" for month in range(-11, 1)],
            "components": [
                {"name": name, "factor": factor, "values": [""] * 12, "comment": ""}
                for name, factor in nwc_components
            ],
            "debt": [
                {
                    "position": position,
                    "category": category,
                    "amount": "",
                    "include": "Zu prüfen",
                    "sign": sign,
                    "reason": "",
                    "evidence": "",
                    "spa": "",
                    "owner": "",
                }
                for position, category, sign in debt_items
            ],
        },
        "contracts": [],
        "mechanisms": mechanisms,
        "sources": sources,
    }


HTML_TEMPLATE = r"""<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%2317365d'/%3E%3Ctext x='32' y='40' text-anchor='middle' font-family='Arial' font-size='24' font-weight='700' fill='white'%3EDD%3C/text%3E%3C/svg%3E">
  <title>Due-Diligence-Portal</title>
  <style>
    :root {
      --bg: #f4f7fb;
      --surface: #ffffff;
      --surface-2: #f8fafc;
      --ink: #142335;
      --muted: #66758a;
      --line: #dce4ee;
      --navy: #17365d;
      --navy-2: #214f7c;
      --teal: #0f7c83;
      --blue: #2563eb;
      --green: #198754;
      --amber: #b36b00;
      --red: #c43131;
      --purple: #6846c7;
      --shadow: 0 10px 30px rgba(23, 54, 93, .08);
      --radius: 16px;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.45;
    }
    button, input, select, textarea { font: inherit; }
    button { cursor: pointer; }
    a { color: var(--blue); }
    .app { min-height: 100vh; }
    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      width: 272px;
      background: linear-gradient(180deg, #132e4d 0%, #173c61 58%, #0f666f 140%);
      color: #fff;
      padding: 22px 16px;
      overflow-y: auto;
      z-index: 30;
    }
    .brand { display: flex; align-items: center; gap: 12px; padding: 2px 8px 20px; }
    .brand-mark {
      display: grid; place-items: center; width: 40px; height: 40px;
      border-radius: 12px; background: rgba(255,255,255,.14); font-weight: 800; letter-spacing: .04em;
    }
    .brand strong { display: block; font-size: 16px; }
    .brand small { color: #bdd3e6; }
    .nav-label { margin: 14px 10px 7px; color: #9fbed7; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .nav {
      display: flex; flex-direction: column; gap: 3px;
    }
    .nav button {
      width: 100%; display: flex; gap: 10px; align-items: center;
      border: 0; border-radius: 10px; padding: 9px 11px;
      color: #dbe8f3; background: transparent; text-align: left;
    }
    .nav button:hover, .nav button.active { color: #fff; background: rgba(255,255,255,.12); }
    .nav .ico { width: 22px; text-align: center; opacity: .9; }
    .sidebar-note {
      margin: 18px 6px 0; padding: 12px; border: 1px solid rgba(255,255,255,.12);
      border-radius: 12px; color: #c8dbe9; font-size: 12px; background: rgba(0,0,0,.08);
    }
    .main { margin-left: 272px; min-width: 0; }
    .topbar {
      position: sticky; top: 0; z-index: 20; min-height: 70px;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 12px 28px; background: rgba(244,247,251,.92); backdrop-filter: blur(14px);
      border-bottom: 1px solid rgba(220,228,238,.85);
    }
    .topbar h1 { margin: 0; font-size: 18px; }
    .topbar .sub { color: var(--muted); font-size: 12px; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 7px; }
    .btn {
      border: 1px solid var(--line); border-radius: 10px; padding: 8px 11px;
      background: var(--surface); color: var(--ink); font-weight: 650; text-decoration: none;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .btn:hover { border-color: #a9bbcf; transform: translateY(-1px); }
    .btn.primary { background: var(--navy); color: #fff; border-color: var(--navy); }
    .btn.soft { background: #e9f1fb; color: var(--navy); border-color: #d5e3f2; }
    .btn.danger { color: var(--red); }
    .save-state {
      display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; margin-right: 4px;
    }
    .save-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); }
    .menu-toggle { display: none; }
    .content { padding: 28px; max-width: 1900px; margin: 0 auto; }
    .page-head { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 20px; }
    .page-head h2 { margin: 0 0 6px; font-size: clamp(22px, 3vw, 32px); letter-spacing: -.025em; }
    .page-head p { margin: 0; color: var(--muted); max-width: 900px; }
    .eyebrow { color: var(--teal); font-size: 11px; font-weight: 850; text-transform: uppercase; letter-spacing: .11em; margin-bottom: 6px; }
    .card {
      background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
      box-shadow: var(--shadow); padding: 18px;
    }
    .grid { display: grid; gap: 16px; }
    .grid.cards { grid-template-columns: repeat(6, minmax(150px, 1fr)); }
    .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .metric { padding: 16px; min-height: 112px; }
    .metric .label { color: var(--muted); font-size: 12px; font-weight: 700; }
    .metric .value { margin-top: 8px; font-size: 28px; font-weight: 800; color: var(--navy); letter-spacing: -.03em; }
    .metric .foot { margin-top: 5px; color: var(--muted); font-size: 11px; }
    .metric.alert .value { color: var(--red); }
    .metric.good .value { color: var(--green); }
    .section-title { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin: 26px 0 10px; }
    .section-title h3 { margin: 0; font-size: 17px; }
    .section-title small { color: var(--muted); }
    .progress { height: 8px; border-radius: 99px; background: #e8eef5; overflow: hidden; }
    .progress > span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--teal), #42a8a5); }
    .progress.blue > span { background: linear-gradient(90deg, var(--navy-2), var(--blue)); }
    .area-list { display: grid; gap: 10px; }
    .area-row {
      display: grid; grid-template-columns: minmax(180px, 1.2fr) 2fr 70px 90px;
      gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf1f6;
    }
    .area-row:last-child { border: 0; }
    .filters {
      display: flex; flex-wrap: wrap; gap: 9px; align-items: center;
      margin: 0 0 12px; padding: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
    }
    .filters input { min-width: 260px; flex: 1; }
    input, select, textarea {
      width: 100%; border: 1px solid #cdd8e5; border-radius: 8px;
      background: #fff; color: var(--ink); padding: 7px 9px; outline: none;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.11); }
    textarea { min-height: 64px; resize: vertical; }
    input[type="number"] { min-width: 110px; }
    .field { display: flex; flex-direction: column; gap: 5px; }
    .field label { font-size: 11px; color: var(--muted); font-weight: 750; }
    .form-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .table-wrap {
      width: 100%; overflow: auto; border: 1px solid var(--line);
      border-radius: 14px; background: var(--surface); box-shadow: var(--shadow);
      max-height: calc(100vh - 245px);
    }
    table { width: 100%; min-width: 1100px; border-collapse: separate; border-spacing: 0; }
    th {
      position: sticky; top: 0; z-index: 4; padding: 10px;
      background: #eaf1f8; color: #27445f; text-align: left; font-size: 11px;
      text-transform: uppercase; letter-spacing: .045em; border-bottom: 1px solid #cddbea;
    }
    td { padding: 9px 10px; vertical-align: top; border-bottom: 1px solid #edf1f6; background: #fff; }
    tr:hover td { background: #fbfdff; }
    td.compact { width: 1%; white-space: nowrap; }
    td.wide { min-width: 320px; }
    .cell-title { font-weight: 750; color: var(--navy); }
    .cell-sub { margin-top: 4px; color: var(--muted); font-size: 12px; }
    details.inline { margin-top: 7px; }
    details.inline summary { color: var(--blue); font-size: 12px; cursor: pointer; }
    details.inline .detail-body { margin-top: 7px; padding: 9px; border-radius: 8px; background: var(--surface-2); color: #405369; font-size: 12px; }
    .badge {
      display: inline-flex; align-items: center; border-radius: 99px; padding: 4px 8px;
      font-size: 11px; font-weight: 800; white-space: nowrap; background: #e8eef5; color: #43556a;
    }
    .badge.critical { background: #fde2e2; color: #9b1c1c; }
    .badge.high { background: #fff0d6; color: #8b5000; }
    .badge.medium { background: #fff8ca; color: #705d00; }
    .badge.low, .badge.done { background: #dff4e8; color: #146c3e; }
    .badge.blue { background: #e1ebff; color: #1d4ed8; }
    .badge.purple { background: #eee8ff; color: #5b38b1; }
    .risk-score { min-width: 52px; text-align: center; font-size: 18px; font-weight: 850; }
    .callout {
      padding: 14px 16px; border-left: 4px solid var(--teal); border-radius: 10px;
      background: #e9f7f6; color: #24545a; margin-bottom: 16px;
    }
    .callout.warning { border-color: var(--amber); background: #fff7e7; color: #6e4c13; }
    .empty { padding: 50px 20px; text-align: center; color: var(--muted); }
    .link-card { color: inherit; text-decoration: none; transition: transform .15s ease; }
    .link-card:hover { transform: translateY(-2px); }
    .source { display: flex; gap: 12px; align-items: flex-start; padding: 13px 0; border-bottom: 1px solid var(--line); }
    .source:last-child { border: 0; }
    .source-id { flex: 0 0 42px; font-weight: 850; color: var(--teal); }
    .help-steps { counter-reset: steps; display: grid; gap: 12px; }
    .help-step { position: relative; padding: 16px 16px 16px 58px; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
    .help-step::before {
      counter-increment: steps; content: counter(steps); position: absolute; left: 15px; top: 15px;
      display: grid; place-items: center; width: 28px; height: 28px; border-radius: 9px; background: var(--navy); color: #fff; font-weight: 850;
    }
    .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .score-box { padding: 13px; border-radius: 12px; border: 1px solid var(--line); }
    .score-box strong { display: block; margin-bottom: 4px; }
    .score-box.low { background: #edf9f2; }
    .score-box.medium { background: #fffbe5; }
    .score-box.high { background: #fff4e5; }
    .score-box.critical { background: #fff0f0; }
    .money { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .sticky-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .mobile-overlay { display: none; }
    @media (max-width: 1300px) {
      .grid.cards { grid-template-columns: repeat(3, 1fr); }
      .form-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 860px) {
      .sidebar { transform: translateX(-100%); transition: transform .2s ease; }
      .sidebar.open { transform: translateX(0); }
      .main { margin-left: 0; }
      .menu-toggle { display: inline-flex; }
      .topbar { padding: 10px 14px; }
      .toolbar .optional { display: none; }
      .content { padding: 18px 12px; }
      .grid.cards, .grid.two, .grid.three, .form-grid { grid-template-columns: 1fr; }
      .area-row { grid-template-columns: 1fr; gap: 5px; }
      .page-head { flex-direction: column; }
      .score-grid { grid-template-columns: 1fr 1fr; }
      .mobile-overlay.show { display: block; position: fixed; inset: 0; background: rgba(15,30,45,.4); z-index: 25; }
    }
    @media print {
      .sidebar, .topbar, .filters, .no-print { display: none !important; }
      .main { margin: 0; }
      .content { padding: 0; }
      .card, .table-wrap { box-shadow: none; }
      .table-wrap { max-height: none; overflow: visible; }
      th { position: static; }
      body { background: white; font-size: 10px; }
    }
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brand-mark">DD</div>
        <div><strong>Due Diligence</strong><small>Projektportal</small></div>
      </div>
      <div class="nav-label">Steuerung</div>
      <nav class="nav">
        <button data-view="dashboard"><span class="ico">◫</span>Übersicht</button>
        <button data-view="project"><span class="ico">✓</span>Projektstart</button>
        <button data-view="checklist"><span class="ico">☷</span>DD-Checkliste</button>
        <button data-view="documents"><span class="ico">▣</span>Dokumente</button>
        <button data-view="risks"><span class="ico">△</span>Risiken</button>
        <button data-view="actions"><span class="ico">→</span>Maßnahmen</button>
        <button data-view="qa"><span class="ico">?</span>Q&amp;A</button>
      </nav>
      <div class="nav-label">Analysen</div>
      <nav class="nav">
        <button data-view="finance"><span class="ico">€</span>Finanzanalyse</button>
        <button data-view="qoe"><span class="ico">≈</span>Quality of Earnings</button>
        <button data-view="nwc"><span class="ico">⇄</span>NWC &amp; Net Debt</button>
        <button data-view="contracts"><span class="ico">§</span>Verträge</button>
        <button data-view="it"><span class="ico">⌘</span>IT &amp; Cyber</button>
        <button data-view="hr"><span class="ico">◎</span>HR &amp; Pensions</button>
        <button data-view="tax"><span class="ico">%</span>Steuern</button>
      </nav>
      <div class="nav-label">Entscheidung &amp; Hilfe</div>
      <nav class="nav">
        <button data-view="mechanisms"><span class="ico">◇</span>Deal-Mechanismen</button>
        <button data-view="help"><span class="ico">i</span>Ausfüllhilfe</button>
        <button data-view="sources"><span class="ico">↗</span>Quellen</button>
      </nav>
      <div class="sidebar-note">
        Eingaben werden automatisch nur in diesem Browser gespeichert. Für Übergabe oder Sicherung bitte JSON exportieren.
      </div>
    </aside>
    <div class="mobile-overlay" id="overlay"></div>
    <main class="main">
      <header class="topbar">
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn menu-toggle" id="menuToggle" aria-label="Menü öffnen">☰</button>
          <div><h1 id="topTitle">Übersicht</h1><div class="sub" id="projectName">Neues Due-Diligence-Projekt</div></div>
        </div>
        <div class="toolbar">
          <span class="save-state"><span class="save-dot"></span><span id="saveText">Lokal gespeichert</span></span>
          <a class="btn soft optional" href="Due_Diligence_Arbeitsmappe.xlsx" download>Excel</a>
          <button class="btn optional" data-action="export-csv">CSV</button>
          <button class="btn optional" data-action="export-json">JSON</button>
          <button class="btn optional" data-action="import-json">Import</button>
          <button class="btn" data-action="print">Drucken</button>
        </div>
      </header>
      <div class="content" id="viewRoot"></div>
    </main>
  </div>
  <input id="importFile" type="file" accept="application/json,.json" hidden>
  <script>
    const BASE_DATA = __DATA__;
    const STORAGE_KEY = "due-diligence-portal-v1";
    const VIEW_TITLES = {
      dashboard:"Übersicht", project:"Projektstart", checklist:"DD-Checkliste", documents:"Dokumente",
      risks:"Risiken", actions:"Maßnahmen", qa:"Q&A", finance:"Finanzanalyse", qoe:"Quality of Earnings",
      nwc:"NWC & Net Debt", contracts:"Verträge", it:"IT & Cyber", hr:"HR & Pensions",
      tax:"Steuern", mechanisms:"Deal-Mechanismen", help:"Ausfüllhilfe", sources:"Quellen"
    };
    const SHEET_VIEW = {
      "00_Start":"dashboard", "00_Projektstart":"project", "00_Ausfüllhilfe":"help", "01_Dashboard":"dashboard",
      "02_Checkliste":"checklist", "03_Dokumente":"documents", "04_Risiken":"risks", "05_Maßnahmen":"actions",
      "06_Q&A":"qa", "07_Finanzanalyse":"finance", "08_QoE":"qoe", "09_NWC_NetDebt":"nwc",
      "10_Verträge":"contracts", "11_IT_Cyber":"it", "12_HR":"hr", "13_Steuern":"tax",
      "14_Deal_Mechanismen":"mechanisms", "15_Quellen":"sources"
    };
    const OPTIONS = {
      status:["Nicht begonnen","In Prüfung","Rückfrage","Blockiert","Abgeschlossen","Nicht anwendbar"],
      priority:["Kritisch","Hoch","Mittel","Niedrig"],
      yesNo:["Ja","Nein","Zu prüfen"],
      mandatory:["Ja","Nein","Wenn relevant","Zu prüfen"],
      docStatus:["Nicht angefordert","Angefordert","Teilweise","Vollständig","Nicht verfügbar","Nicht anwendbar"],
      completeness:["Ungeprüft","Unvollständig","Plausibel","Verifiziert"],
      confidentiality:["Normal","Vertraulich","Streng vertraulich","Clean Team"],
      riskStatus:["Zu verifizieren","Bestätigt","Entkräftet","Mitigiert","Akzeptiert"],
      actionStatus:["Nicht gestartet","In Arbeit","Blockiert","Erledigt","Verworfen"],
      qaStatus:["Entwurf","Gesendet","Teilbeantwortet","Beantwortet","Nachfrage","Geschlossen"],
      dealImpact:["Bewertung/Kaufpreis","SPA/Haftung","Closing-Bedingung","Finanzierung","Integration/100-Tage-Plan","Abbruch/No-go","Kein direkter","Zu prüfen"]
    };
    const FIN_METRICS = [
      ["REV","Umsatz","input"],["COGS","Umsatzkosten (COGS)","input"],["GP","Bruttoergebnis","formula"],
      ["GPM","Bruttomarge","percent"],["PERSONNEL","Personalaufwand","input"],["OPEX","Sonstige Opex","input"],
      ["EBITDA","EBITDA berichtet","input"],["ADJ","QoE-Anpassungen (netto)","input"],["ADJEBITDA","EBITDA normalisiert","formula"],
      ["EBITDAM","EBITDA-Marge normalisiert","percent"],["DA","Abschreibungen","input"],["EBIT","EBIT normalisiert","formula"],
      ["INT","Nettozinsaufwand","input"],["TAX","Ertragsteuern","input"],["NI","Jahresergebnis (vereinfachte Sicht)","formula"],
      ["OCF","Operativer Cashflow","input"],["CAPEX","Capex","input"],["FCF","Free Cashflow","formula"],
      ["CASH","Cash","input"],["DEBT","Finanzschulden","input"],["LEASE","Leasingverbindlichkeiten","input"],
      ["OTHER","Sonstige debt-like Positionen","input"],["NETDEBT","Net Debt","formula"],["INV","Vorräte","input"],
      ["AR","Forderungen L&L","input"],["CA","Vertragsvermögenswerte","input"],["OA","Sonstige operative kurzfristige Aktiva","input"],
      ["AP","Verbindlichkeiten L&L","input"],["DR","Deferred Revenue","input"],["OP","Sonstige operative kurzfristige Passiva","input"],
      ["NWC","Net Working Capital","formula"],["NWCP","NWC in % Umsatz","percent"],["DSO","DSO","formula"],
      ["DIO","DIO","formula"],["DPO","DPO","formula"],["FTE","Headcount (FTE)","input"],
      ["REVFTE","Umsatz je FTE","formula"],["EBITDAFTE","EBITDA je FTE","formula"]
    ];
    const clone = value => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
    let state = loadState();
    let currentView = "project";

    function loadState(){
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if(parsed && parsed.schemaVersion === BASE_DATA.schemaVersion) return parsed;
      } catch(e) {}
      return clone(BASE_DATA);
    }
    function saveState(){
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const el=document.getElementById("saveText");
      if(el){ el.textContent="Gespeichert "+new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}); }
    }
    function esc(value){
      return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
    }
    function num(value){ const n=Number(value); return Number.isFinite(n) ? n : 0; }
    function fmtNum(value, decimals=0){
      if(value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) return "–";
      return new Intl.NumberFormat("de-DE",{maximumFractionDigits:decimals,minimumFractionDigits:decimals}).format(Number(value));
    }
    function fmtMoney(value){ return value === "" || value === null ? "–" : new Intl.NumberFormat("de-DE",{style:"currency",currency:state.meta.currency||"EUR",maximumFractionDigits:0}).format(num(value)); }
    function pct(value){ return (Math.round((Number(value)||0)*1000)/10).toLocaleString("de-DE")+" %"; }
    function getPath(obj,path){ return path.split(".").reduce((acc,key)=>acc == null ? undefined : acc[key],obj); }
    function setPath(obj,path,value){
      const parts=path.split("."); const last=parts.pop(); let cur=obj;
      parts.forEach(key=>{ if(cur[key]===undefined) cur[key]={}; cur=cur[key]; }); cur[last]=value;
    }
    function input(path,value,type="text",extra=""){
      return `<input type="${type}" data-bind="${esc(path)}" value="${esc(value)}" ${extra}>`;
    }
    function textarea(path,value,placeholder=""){
      return `<textarea data-bind="${esc(path)}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;
    }
    function select(path,value,options,extra=""){
      return `<select data-bind="${esc(path)}" ${extra}>${["",...options].map(option=>`<option value="${esc(option)}" ${String(option)===String(value)?"selected":""}>${esc(option||"– wählen –")}</option>`).join("")}</select>`;
    }
    function badge(value){
      const s=String(value||"");
      let cls="";
      if(/kritisch|blockiert|no-go/i.test(s)) cls="critical";
      else if(/hoch|überfällig/i.test(s)) cls="high";
      else if(/mittel|prüfung|teil/i.test(s)) cls="medium";
      else if(/niedrig|abgeschlossen|vollständig|erledigt|bereit$/i.test(s)) cls="done";
      else if(/financial|blue/i.test(s)) cls="blue";
      return `<span class="badge ${cls}">${esc(s||"–")}</span>`;
    }
    function riskInfo(probability,impact){
      if(!probability || !impact) return {score:"",label:"Unbewertet",cls:""};
      const score=num(probability)*num(impact);
      if(score>=17) return {score,label:"Kritisch",cls:"critical"};
      if(score>=10) return {score,label:"Hoch",cls:"high"};
      if(score>=5) return {score,label:"Mittel",cls:"medium"};
      return {score,label:"Niedrig",cls:"low"};
    }
    function overdue(due,status){
      if(!due || ["Abgeschlossen","Nicht anwendbar","Erledigt","Geschlossen"].includes(status)) return 0;
      const delta=Math.floor((new Date().setHours(0,0,0,0)-new Date(due+"T00:00:00").getTime())/86400000);
      return Math.max(0,delta);
    }
    function pageHead(eyebrow,title,text,actions=""){
      return `<div class="page-head"><div><div class="eyebrow">${esc(eyebrow)}</div><h2>${esc(title)}</h2><p>${esc(text)}</p></div><div class="sticky-actions no-print">${actions}</div></div>`;
    }
    function metric(label,value,foot="",cls=""){
      return `<div class="card metric ${cls}"><div class="label">${esc(label)}</div><div class="value">${value}</div><div class="foot">${esc(foot)}</div></div>`;
    }
    function filterBar(prefix,fields){
      return `<div class="filters no-print">${fields.map(f=>{
        if(f.type==="search") return `<input data-filter-for="${prefix}" data-filter-field="search" placeholder="${esc(f.placeholder||"Suchen …")}">`;
        return `<select data-filter-for="${prefix}" data-filter-field="${esc(f.field)}"><option value="">${esc(f.label||"Alle")}</option>${f.options.map(x=>`<option>${esc(x)}</option>`).join("")}</select>`;
      }).join("")}</div>`;
    }
    function filterRows(prefix){
      const controls=[...document.querySelectorAll(`[data-filter-for="${prefix}"]`)];
      const rows=[...document.querySelectorAll(`[data-filter-row="${prefix}"]`)];
      rows.forEach(row=>{
        const show=controls.every(control=>{
          const value=control.value.toLowerCase();
          if(!value) return true;
          const field=control.dataset.filterField;
          return String(row.dataset[field]||"").toLowerCase().includes(value);
        });
        row.style.display=show?"":"none";
      });
    }
    function showView(view){
      currentView=view;
      document.querySelectorAll("[data-view]").forEach(btn=>btn.classList.toggle("active",btn.dataset.view===view));
      document.getElementById("topTitle").textContent=VIEW_TITLES[view]||view;
      document.getElementById("projectName").textContent=state.meta.target||"Neues Due-Diligence-Projekt";
      renderCurrent();
      closeMenu();
      window.scrollTo({top:0,behavior:"smooth"});
    }
    function renderCurrent(){
      const renderers={
        dashboard:renderDashboard, project:renderProject, checklist:renderChecklist, documents:renderDocuments,
        risks:renderRisks, actions:renderActions, qa:renderQA, finance:renderFinance, qoe:renderQoE,
        nwc:renderNWC, contracts:renderContracts, it:()=>renderWorkstream("IT & Cyber","IT & Cyber"),
        hr:()=>renderWorkstream("HR & Pensions","HR & Pensions"), tax:()=>renderWorkstream("Tax","Steuern"),
        mechanisms:renderMechanisms, help:renderHelp, sources:renderSources
      };
      document.getElementById("viewRoot").innerHTML=(renderers[currentView]||renderDashboard)();
      document.getElementById("projectName").textContent=state.meta.target||"Neues Due-Diligence-Projekt";
    }
    function renderDashboard(){
      const projectDone=state.projectTasks.filter(x=>x.status==="Abgeschlossen").length;
      const projectCritical=state.projectTasks.filter(x=>x.priority==="Kritisch"&&!["Abgeschlossen","Nicht anwendbar"].includes(x.status)).length;
      const checksDone=state.checklist.filter(x=>x.status==="Abgeschlossen").length;
      const docsDone=state.documents.filter(x=>x.status==="Vollständig").length;
      const highRisks=state.checklist.filter(x=>["Hoch","Kritisch"].includes(riskInfo(x.probability,x.impact).label)).length;
      const overdueActions=state.actions.filter(x=>overdue(x.dueDate,x.status)>0).length;
      const exposure=state.risks.reduce((sum,x)=>sum+num(x.exposureBase),0);
      const areas=[...new Set(state.checklist.map(x=>x.area))];
      const areaRows=areas.map(area=>{
        const rows=state.checklist.filter(x=>x.area===area); const done=rows.filter(x=>x.status==="Abgeschlossen").length;
        const percent=rows.length?done/rows.length:0;
        const risk=rows.filter(x=>["Hoch","Kritisch"].includes(riskInfo(x.probability,x.impact).label)).length;
        return `<div class="area-row"><strong>${esc(area)}</strong><div class="progress"><span style="width:${percent*100}%"></span></div><span>${done}/${rows.length}</span><span>${risk?badge(risk+" Risiko"):"–"}</span></div>`;
      }).join("");
      const next=state.projectTasks.filter(x=>x.priority==="Kritisch"&&!["Abgeschlossen","Nicht anwendbar"].includes(x.status)).slice(0,6);
      return pageHead("Managementübersicht","Due-Diligence-Dashboard","Projektparameter, Startreife, Prüfungsfortschritt und Transaktionsrisiken auf einen Blick.",
        `<button class="btn primary" data-view="project">Projektstart öffnen</button>`) + `
        <div class="card" style="margin-bottom:16px">
          <div class="form-grid">
            <div class="field"><label>Zielunternehmen</label>${input("meta.target",state.meta.target)}</div>
            <div class="field"><label>Transaktionstyp</label>${select("meta.transactionType",state.meta.transactionType,["Share Deal","Asset Deal","Beteiligung","Carve-out","IPO","Refinanzierung","Sonstige"])}</div>
            <div class="field"><label>Käufer / Investor</label>${input("meta.buyer",state.meta.buyer)}</div>
            <div class="field"><label>DD-Stichtag</label>${input("meta.ddDate",state.meta.ddDate,"date")}</div>
            <div class="field"><label>Projektleitung</label>${input("meta.projectLead",state.meta.projectLead)}</div>
            <div class="field"><label>Berichtswährung</label>${input("meta.currency",state.meta.currency)}</div>
            <div class="field"><label>Materialität</label>${input("meta.materiality",state.meta.materiality,"number")}</div>
            <div class="field"><label>Vertraulichkeit</label>${select("meta.confidentiality",state.meta.confidentiality,OPTIONS.confidentiality)}</div>
          </div>
        </div>
        <div class="grid cards">
          ${metric("Startfreigabe",projectCritical===0?"Bereit":"Nicht bereit",projectCritical+" kritische Startaufgaben offen",projectCritical===0?"good":"alert")}
          ${metric("Projektstart",pct(projectDone/state.projectTasks.length),projectDone+" von "+state.projectTasks.length+" Aufgaben")}
          ${metric("DD-Fortschritt",pct(checksDone/state.checklist.length),checksDone+" von "+state.checklist.length+" Prüfpunkten")}
          ${metric("Dokumente vollständig",docsDone,state.documents.length+" Anforderungen")}
          ${metric("Hohe / kritische Risiken",highRisks,"bewertete Prüfpunkte",highRisks?"alert":"")}
          ${metric("Exposure Base",fmtMoney(exposure),overdueActions+" Maßnahmen überfällig",overdueActions?"alert":"")}
        </div>
        <div class="grid two">
          <div class="card">
            <div class="section-title"><h3>Fortschritt nach Prüfbereich</h3><small>Master-Checkliste</small></div>
            <div class="area-list">${areaRows}</div>
          </div>
          <div class="card">
            <div class="section-title"><h3>Nächste kritische Startaufgaben</h3><button class="btn" data-view="project">Alle anzeigen</button></div>
            ${next.length?next.map(task=>`<div class="source"><div class="source-id">${esc(task.id)}</div><div><strong>${esc(task.task)}</strong><div class="cell-sub">${esc(task.phase)} · ${esc(task.ownerName||task.owner)}</div></div></div>`).join(""):'<div class="empty">Alle kritischen Startaufgaben sind abgeschlossen.</div>'}
          </div>
        </div>`;
    }
    function renderProject(){
      const done=state.projectTasks.filter(x=>x.status==="Abgeschlossen").length;
      const critical=state.projectTasks.filter(x=>x.priority==="Kritisch"&&!["Abgeschlossen","Nicht anwendbar"].includes(x.status)).length;
      const phases=[...new Set(state.projectTasks.map(x=>x.phase))];
      const rows=state.projectTasks.map((task,i)=>`
        <tr data-filter-row="project" data-search="${esc([task.id,task.phase,task.workstream,task.task,task.ownerName].join(" "))}" data-phase="${esc(task.phase)}" data-status="${esc(task.status)}">
          <td class="compact"><strong>${esc(task.id)}</strong><div style="margin-top:5px">${badge(task.priority)}</div></td>
          <td><div class="cell-title">${esc(task.phase)}</div><div class="cell-sub">${esc(task.workstream)}</div></td>
          <td class="wide"><div class="cell-title">${esc(task.task)}</div><details class="inline"><summary>Abnahmekriterium</summary><div class="detail-body">${esc(task.acceptance)}</div></details></td>
          <td>${select(`projectTasks.${i}.status`,task.status,OPTIONS.status)}</td>
          <td>${input(`projectTasks.${i}.ownerName`,task.ownerName)}</td>
          <td>${input(`projectTasks.${i}.dueDate`,task.dueDate,"date")}<div class="cell-sub">${overdue(task.dueDate,task.status)?badge(overdue(task.dueDate,task.status)+" Tage überfällig"):""}</div></td>
          <td><div class="cell-sub">${esc(task.dependency||"–")}</div><button class="btn soft" data-link-sheet="${esc(task.sheet)}">Öffnen →</button></td>
          <td>${textarea(`projectTasks.${i}.evidenceRef`,task.evidenceRef,task.evidence)}</td>
          <td>${textarea(`projectTasks.${i}.comment`,task.comment,"Entscheidung / Abweichung")}</td>
        </tr>`).join("");
      return pageHead("Projektbeginn","Verbundene Projektstart-Checklisten","Sechs Teilchecklisten verbinden Governance, Datenraum, Analysen und Deliverables direkt mit den jeweiligen Arbeitsbereichen.",
        `<button class="btn primary" data-action="complete-visible-project">Sichtbare Aufgaben abschließen</button>`) + `
        <div class="grid cards" style="margin-bottom:16px">
          ${metric("Aufgaben",state.projectTasks.length,"sechs Teilchecklisten")}
          ${metric("Abgeschlossen",done,pct(done/state.projectTasks.length))}
          ${metric("Kritisch offen",critical,"Startfreigabe",critical?"alert":"good")}
          ${metric("Überfällig",state.projectTasks.filter(x=>overdue(x.dueDate,x.status)>0).length,"mit Fälligkeitsdatum")}
          ${metric("Direkt verknüpft",state.projectTasks.length,"interne Bereiche")}
          ${metric("Startstatus",critical===0?"Bereit":"Nicht bereit","alle kritischen Aufgaben",critical===0?"good":"alert")}
        </div>
        ${filterBar("project",[{type:"search",placeholder:"Aufgabe, ID, Workstream oder Owner suchen …"},{field:"phase",label:"Alle Teilchecklisten",options:phases},{field:"status",label:"Alle Status",options:OPTIONS.status}])}
        <div class="table-wrap"><table><thead><tr><th>ID / Priorität</th><th>Teilcheckliste</th><th>Startaufgabe</th><th>Status</th><th>Owner</th><th>Fällig</th><th>Verbindung</th><th>Evidenz</th><th>Kommentar</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    function renderChecklist(areaFilter=null,title="DD-Master-Checkliste"){
      const areas=[...new Set(state.checklist.map(x=>x.area))];
      const indexed=state.checklist.map((item,index)=>({item,index})).filter(x=>!areaFilter||x.item.area===areaFilter);
      const rows=indexed.map(({item,i,index})=>{
        const risk=riskInfo(item.probability,item.impact);
        return `<tr data-filter-row="checklist" data-search="${esc([item.id,item.area,item.subarea,item.question,item.finding,item.owner].join(" "))}" data-area="${esc(item.area)}" data-status="${esc(item.status)}" data-priority="${esc(item.priority)}">
          <td class="compact"><strong>${esc(item.id)}</strong><div style="margin-top:5px">${badge(item.priority)}</div></td>
          <td><div class="cell-title">${esc(item.area)}</div><div class="cell-sub">${esc(item.subarea)}</div></td>
          <td class="wide"><div>${esc(item.question)}</div><details class="inline"><summary>Analyse, Unterlagen und Red Flags</summary><div class="detail-body"><strong>Unterlagen:</strong> ${esc(item.documents)}<br><strong>Analyse:</strong> ${esc(item.analysis)}<br><strong>Red Flags:</strong> ${esc(item.red_flags)}</div></details></td>
          <td>${select(`checklist.${index}.status`,item.status,OPTIONS.status)}</td>
          <td>${input(`checklist.${index}.owner`,item.owner)}${input(`checklist.${index}.dueDate`,item.dueDate,"date","style='margin-top:6px'")}</td>
          <td><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">${select(`checklist.${index}.probability`,item.probability,["1","2","3","4","5"])}${select(`checklist.${index}.impact`,item.impact,["1","2","3","4","5"])}</div><div style="margin-top:6px">${badge(risk.score?risk.score+" · "+risk.label:risk.label)}</div></td>
          <td class="wide">${textarea(`checklist.${index}.finding`,item.finding,"Fakt, Evidenz, Ursache, Auswirkung")}<div class="cell-sub">${esc(item.action)}</div></td>
          <td>${badge(item.deal_impact)}<div class="cell-sub">${esc(item.protection)}</div></td>
        </tr>`;
      }).join("");
      return pageHead("Prüfungsarbeit",title,areaFilter?`Vertiefung aus der verbundenen Master-Checkliste: ${areaFilter}. Änderungen wirken direkt in Dashboard und Risikologik.`:"156 risikoorientierte Prüfpunkte mit Analysen, Red Flags, Maßnahmen und Deal-Folgen.") +
        (areaFilter?"":filterBar("checklist",[{type:"search",placeholder:"ID, Bereich, Frage, Finding oder Owner suchen …"},{field:"area",label:"Alle Bereiche",options:areas},{field:"priority",label:"Alle Prioritäten",options:OPTIONS.priority},{field:"status",label:"Alle Status",options:OPTIONS.status}]))+
        `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Bereich</th><th>Prüffrage</th><th>Status</th><th>Owner / Termin</th><th>Risiko E/A</th><th>Finding / Maßnahme</th><th>Deal-Folge</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    function renderDocuments(){
      const areas=[...new Set(state.documents.map(x=>x.area))];
      const rows=state.documents.map((doc,i)=>`<tr data-filter-row="documents" data-search="${esc([doc.id,doc.area,doc.request,doc.owner,doc.vdrPath].join(" "))}" data-area="${esc(doc.area)}" data-status="${esc(doc.status)}" data-priority="${esc(doc.priority)}">
        <td class="compact"><strong>${esc(doc.id)}</strong><div style="margin-top:5px">${badge(doc.priority)}</div></td>
        <td>${esc(doc.area)}<div class="cell-sub">${esc(doc.checkRef)}</div></td>
        <td class="wide"><div class="cell-title">${esc(doc.request)}</div><div class="cell-sub">${esc(doc.scope)}</div><details class="inline"><summary>Analysezweck</summary><div class="detail-body">${esc(doc.purpose)}</div></details></td>
        <td>${select(`documents.${i}.status`,doc.status,OPTIONS.docStatus)}${select(`documents.${i}.completeness`,doc.completeness,OPTIONS.completeness,"style='margin-top:6px'")}</td>
        <td>${input(`documents.${i}.owner`,doc.owner)}${input(`documents.${i}.dueDate`,doc.dueDate,"date","style='margin-top:6px'")}${overdue(doc.dueDate,doc.status)?`<div class="cell-sub">${badge(overdue(doc.dueDate,doc.status)+" Tage überfällig")}</div>`:""}</td>
        <td>${input(`documents.${i}.vdrPath`,doc.vdrPath,"text","placeholder='VDR-Pfad / Link'")}</td>
        <td>${textarea(`documents.${i}.openItems`,doc.openItems,"Fehlende Perioden, Anhänge oder Versionen")}</td>
      </tr>`).join("");
      return pageHead("VDR-Steuerung","Dokumentenanforderungen","156 mit der Master-Checkliste verbundene Requests. Status und Vollständigkeit erst nach Inhaltsprüfung aktualisieren.")+
        filterBar("documents",[{type:"search",placeholder:"Dokument, ID, Bereich, Owner oder VDR-Pfad suchen …"},{field:"area",label:"Alle Bereiche",options:areas},{field:"priority",label:"Alle Prioritäten",options:OPTIONS.priority},{field:"status",label:"Alle Status",options:OPTIONS.docStatus}])+
        `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Bereich</th><th>Anforderung</th><th>Status / Qualität</th><th>Owner / Termin</th><th>VDR-Pfad</th><th>Offene Punkte</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    function renderRisks(){
      const rows=state.risks.map((risk,i)=>{
        const info=riskInfo(risk.probability,risk.impact); const residual=riskInfo(risk.residualProbability,risk.residualImpact);
        return `<tr data-filter-row="risks" data-search="${esc([risk.id,risk.area,risk.scenario,risk.finding,risk.owner].join(" "))}" data-status="${esc(risk.status)}" data-area="${esc(risk.area)}" data-priority="${esc(info.label)}">
          <td class="compact"><strong>${esc(risk.id)}</strong><div>${badge(risk.checkRef)}</div></td>
          <td><div class="cell-title">${esc(risk.area)}</div><div class="cell-sub">${esc(risk.scenario)}</div><details class="inline"><summary>Analyse</summary><div class="detail-body">${esc(risk.analysis)}<br><strong>Evidenz:</strong> ${esc(risk.indicators)}</div></details></td>
          <td>${select(`risks.${i}.status`,risk.status,OPTIONS.riskStatus)}${textarea(`risks.${i}.finding`,risk.finding,"Bestätigte Feststellung","")}</td>
          <td><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">${select(`risks.${i}.probability`,risk.probability,["1","2","3","4","5"])}${select(`risks.${i}.impact`,risk.impact,["1","2","3","4","5"])}</div><div class="risk-score">${info.score||"–"}</div>${badge(info.label)}</td>
          <td>${input(`risks.${i}.exposureLow`,risk.exposureLow,"number","placeholder='Low'")}${input(`risks.${i}.exposureBase`,risk.exposureBase,"number","placeholder='Base' style='margin-top:5px'")}${input(`risks.${i}.exposureHigh`,risk.exposureHigh,"number","placeholder='High' style='margin-top:5px'")}</td>
          <td class="wide"><div>${esc(risk.measure)}</div>${input(`risks.${i}.owner`,risk.owner,"text","placeholder='Owner' style='margin-top:7px'")}${input(`risks.${i}.dueDate`,risk.dueDate,"date","style='margin-top:5px'")}</td>
          <td>${badge(risk.transactionEffect)}${textarea(`risks.${i}.decision`,risk.decision,"Entscheidung / Bedingungen")}</td>
          <td><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">${select(`risks.${i}.residualProbability`,risk.residualProbability,["1","2","3","4","5"])}${select(`risks.${i}.residualImpact`,risk.residualImpact,["1","2","3","4","5"])}</div><div>${badge(residual.label)}</div></td>
        </tr>`;
      }).join("");
      const areas=[...new Set(state.risks.map(x=>x.area))];
      return pageHead("Bewertung","Risikoregister","Prüfhypothesen werden erst nach Evidenz bewertet. Bruttorisiko, Exposure und Restrisiko getrennt dokumentieren.")+
        filterBar("risks",[{type:"search",placeholder:"Risiko, Bereich, Finding oder Owner suchen …"},{field:"area",label:"Alle Bereiche",options:areas},{field:"status",label:"Alle Status",options:OPTIONS.riskStatus},{field:"priority",label:"Alle Klassen",options:["Kritisch","Hoch","Mittel","Niedrig"]}])+
        `<div class="table-wrap"><table><thead><tr><th>ID / Ref.</th><th>Szenario</th><th>Status / Finding</th><th>Bruttorisiko</th><th>Exposure L/B/H</th><th>Gegenmaßnahme</th><th>Deal-Folge</th><th>Restrisiko</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    function renderActions(){
      const rows=state.actions.map((action,i)=>`<tr data-filter-row="actions" data-search="${esc([action.id,action.area,action.measure,action.owner,action.reference].join(" "))}" data-status="${esc(action.status)}" data-priority="${esc(action.priority)}" data-area="${esc(action.area)}">
        <td class="compact"><strong>${esc(action.id)}</strong><div>${badge(action.priority)}</div></td>
        <td>${select(`actions.${i}.active`,action.active,OPTIONS.yesNo)}<div class="cell-sub">${esc(action.reference)}</div></td>
        <td><div class="cell-title">${esc(action.area)}</div><div class="cell-sub">${esc(action.phase)}</div></td>
        <td class="wide"><div>${esc(action.measure)}</div><details class="inline"><summary>Abnahmekriterium</summary><div class="detail-body">${esc(action.acceptance)}</div></details></td>
        <td>${input(`actions.${i}.owner`,action.owner,"text","placeholder='Owner'")}${input(`actions.${i}.dueDate`,action.dueDate,"date","style='margin-top:5px'")}</td>
        <td>${select(`actions.${i}.status`,action.status,OPTIONS.actionStatus)}<input type="range" min="0" max="100" data-bind="actions.${i}.progress" value="${esc(action.progress)}"><div class="cell-sub">${esc(action.progress)} %</div></td>
        <td>${input(`actions.${i}.budget`,action.budget,"number","placeholder='Budget'")}<div class="cell-sub">${esc(action.effect)}</div></td>
        <td>${textarea(`actions.${i}.comment`,action.comment,"Fortschritt / Entscheidung")}</td>
      </tr>`).join("");
      const areas=[...new Set(state.actions.map(x=>x.area))];
      return pageHead("Umsetzung","Maßnahmenplan","Vorschläge erst bei passendem Finding aktivieren. Jede aktive Maßnahme benötigt Owner, Termin und objektives Abnahmekriterium.")+
        filterBar("actions",[{type:"search",placeholder:"Maßnahme, ID, Bereich oder Owner suchen …"},{field:"area",label:"Alle Bereiche",options:areas},{field:"priority",label:"Alle Prioritäten",options:OPTIONS.priority},{field:"status",label:"Alle Status",options:OPTIONS.actionStatus}])+
        `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Aktiv / Ref.</th><th>Bereich / Phase</th><th>Maßnahme</th><th>Owner / Termin</th><th>Status</th><th>Budget / Wirkung</th><th>Kommentar</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    function addQA(){
      const n=state.qa.length+1;
      state.qa.push({id:`Q-${String(n).padStart(3,"0")}`,created:new Date().toISOString().slice(0,10),area:"",reference:"",question:"",context:"",priority:"Mittel",recipient:"",requester:"",dueDate:"",answerDate:"",status:"Entwurf",answer:"",evidence:"",nextStep:"",reviewer:""});
      saveState(); renderCurrent();
    }
    function renderQA(){
      const rows=state.qa.map((q,i)=>`<tr>
        <td class="compact"><strong>${esc(q.id)}</strong><div>${badge(q.priority)}</div></td>
        <td>${input(`qa.${i}.area`,q.area,"text","placeholder='Prüfbereich'")}${input(`qa.${i}.reference`,q.reference,"text","placeholder='Check-/Dok-Ref.' style='margin-top:5px'")}</td>
        <td class="wide">${textarea(`qa.${i}.question`,q.question,"Eine konkret beantwortbare Frage")}${textarea(`qa.${i}.context`,q.context,"Entscheidungskontext")}</td>
        <td>${input(`qa.${i}.recipient`,q.recipient,"text","placeholder='Empfänger'")}${input(`qa.${i}.requester`,q.requester,"text","placeholder='Fragesteller' style='margin-top:5px'")}</td>
        <td>${input(`qa.${i}.dueDate`,q.dueDate,"date")}${select(`qa.${i}.status`,q.status,OPTIONS.qaStatus,"style='margin-top:5px'")}</td>
        <td class="wide">${textarea(`qa.${i}.answer`,q.answer,"Schriftliche Antwort")}${input(`qa.${i}.evidence`,q.evidence,"text","placeholder='VDR-Evidenz' style='margin-top:5px'")}</td>
        <td>${textarea(`qa.${i}.nextStep`,q.nextStep,"Nachfrage / Next Step")}</td>
      </tr>`).join("");
      return pageHead("Klärung","Q&A-Tracker","Fragen neutral, konkret und entscheidungsorientiert formulieren. Mündliche Antworten schriftlich und mit Evidenz bestätigen.",
        `<button class="btn primary" data-action="add-qa">+ Frage hinzufügen</button>`) +
        (state.qa.length?`<div class="table-wrap"><table><thead><tr><th>ID</th><th>Bereich / Ref.</th><th>Frage / Kontext</th><th>Empfänger</th><th>Termin / Status</th><th>Antwort / Evidenz</th><th>Next Step</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="card empty"><h3>Noch keine Q&A-Frage</h3><p>Erste Frage hinzufügen und mit Checklisten- oder Dokumenten-ID verbinden.</p><button class="btn primary" data-action="add-qa">+ Frage hinzufügen</button></div>`);
    }
    function finValue(key,p){
      const values=state.finance.values; const raw=()=>num((values[key]||[])[p]);
      const v=k=>finValue(k,p);
      switch(key){
        case "GP": return v("REV")-v("COGS"); case "GPM": return v("REV")?v("GP")/v("REV"):0;
        case "ADJEBITDA": return v("EBITDA")+v("ADJ"); case "EBITDAM": return v("REV")?v("ADJEBITDA")/v("REV"):0;
        case "EBIT": return v("ADJEBITDA")-v("DA"); case "NI": return v("EBIT")-v("INT")-v("TAX");
        case "FCF": return v("OCF")-v("CAPEX"); case "NETDEBT": return v("DEBT")+v("LEASE")+v("OTHER")-v("CASH");
        case "NWC": return v("INV")+v("AR")+v("CA")+v("OA")-v("AP")-v("DR")-v("OP");
        case "NWCP": return v("REV")?v("NWC")/v("REV"):0; case "DSO": return v("REV")?v("AR")/v("REV")*365:0;
        case "DIO": return v("COGS")?v("INV")/v("COGS")*365:0; case "DPO": return v("COGS")?v("AP")/v("COGS")*365:0;
        case "REVFTE": return v("FTE")?v("REV")/v("FTE"):0; case "EBITDAFTE": return v("FTE")?v("ADJEBITDA")/v("FTE"):0;
        default:return raw();
      }
    }
    function renderFinance(){
      const periodHeads=state.finance.periods.map((p,i)=>`<th>${input(`finance.periods.${i}`,p)}</th>`).join("");
      const rows=FIN_METRICS.map(([key,label,type])=>{
        const cells=state.finance.periods.map((_,p)=>{
          if(type==="input") return `<td>${input(`finance.values.${key}.${p}`,(state.finance.values[key]||[])[p]??"","number")}</td>`;
          const value=finValue(key,p); return `<td class="money"><strong>${type==="percent"?pct(value):fmtNum(value,type==="formula"&&["DSO","DIO","DPO"].includes(key)?1:0)}</strong></td>`;
        }).join("");
        const current=finValue(key,3), prior=finValue(key,2), budget=finValue(key,4);
        const delta=prior?current/prior-1:0, budgetDelta=budget?current/budget-1:0;
        return `<tr><td><strong>${esc(label)}</strong></td>${cells}<td>${pct(delta)}</td><td>${pct(budgetDelta)}</td><td>${input(`finance.comments.${key}`,state.finance.comments[key]||"","text","placeholder='Quelle / Erklärung'")}</td></tr>`;
      }).join("");
      return pageHead("Financial DD","Finanzanalyse","Aufwendungen und Schulden als positive Beträge erfassen. Berechnete Kennzahlen aktualisieren sich unmittelbar im Browser.")+
        `<div class="callout">Eingaben werden nicht mit der Excel-Datei synchronisiert. Für eine Übergabe den JSON-Export verwenden oder Werte zusätzlich in Excel pflegen.</div>
        <div class="table-wrap"><table><thead><tr><th>Kennzahl</th>${periodHeads}<th>Δ LTM / Vorjahr</th><th>Δ LTM / Budget</th><th>Kommentar / Quelle</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    function addQoE(){
      const n=state.qoe.rows.length+1;
      state.qoe.rows.push({id:`ADJ-${String(n).padStart(3,"0")}`,category:"",description:"",direction:"+/−",period:"LTM",managementAmount:"",ddAmount:"",acceptedAmount:"",evidence:"",recurring:"Zu prüfen",cashType:"Zu prüfen",confidence:"",status:"Offen",owner:"",reference:"",comment:""});
      saveState(); renderCurrent();
    }
    function renderQoE(){
      const accepted=state.qoe.rows.reduce((s,x)=>s+num(x.acceptedAmount),0); const reported=num(state.qoe.reportedEbitda);
      const rows=state.qoe.rows.map((r,i)=>`<tr><td><strong>${esc(r.id)}</strong></td><td>${input(`qoe.rows.${i}.category`,r.category)}</td><td class="wide">${textarea(`qoe.rows.${i}.description`,r.description)}</td><td>${select(`qoe.rows.${i}.direction`,r.direction,["+","−","+/−","separat"])}</td><td>${input(`qoe.rows.${i}.acceptedAmount`,r.acceptedAmount,"number")}</td><td>${textarea(`qoe.rows.${i}.evidence`,r.evidence,"Konten / Belege / Referenz")}</td><td>${select(`qoe.rows.${i}.status`,r.status,["Offen","In Prüfung","Akzeptiert","Abgelehnt","Teilweise akzeptiert"])}</td></tr>`).join("");
      return pageHead("Financial DD","Quality of Earnings","Nur belegte, nachhaltige Normalisierungen akzeptieren. Käufer-Synergien separat vom historischen Target-EBITDA ausweisen.",
        `<button class="btn primary" data-action="add-qoe">+ Anpassung</button>`) + `
        <div class="grid three" style="margin-bottom:16px">
          <div class="card field"><label>EBITDA berichtet (LTM)</label>${input("qoe.reportedEbitda",state.qoe.reportedEbitda,"number")}</div>
          ${metric("Akzeptierte Anpassungen",fmtMoney(accepted),state.qoe.rows.length+" Positionen")}
          ${metric("EBITDA normalisiert",fmtMoney(reported+accepted),"berichtet + akzeptiert")}
        </div>
        <div class="table-wrap"><table><thead><tr><th>ID</th><th>Kategorie</th><th>Beschreibung</th><th>Richtung</th><th>Akzeptiert</th><th>Evidenz</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    function renderNWC(){
      const totals=state.nwc.months.map((_,m)=>state.nwc.components.reduce((s,c)=>s+num(c.values[m])*num(c.factor),0));
      const sorted=[...totals].sort((a,b)=>a-b); const median=sorted.length?(sorted[5]+sorted[6])/2:0;
      const compRows=state.nwc.components.map((c,i)=>`<tr><td><strong>${esc(c.name)}</strong></td><td>${select(`nwc.components.${i}.factor`,c.factor,["1","-1"])}</td>${c.values.map((v,m)=>`<td>${input(`nwc.components.${i}.values.${m}`,v,"number")}</td>`).join("")}<td>${fmtMoney(c.values.reduce((s,v)=>s+num(v),0)/12)}</td></tr>`).join("");
      const totalRow=`<tr><td><strong>Net Working Capital</strong></td><td></td>${totals.map(v=>`<td><strong>${fmtNum(v)}</strong></td>`).join("")}<td><strong>${fmtMoney(totals.reduce((s,v)=>s+v,0)/12)}</strong></td></tr>`;
      const debtRows=state.nwc.debt.map((d,i)=>{ const included=d.include==="Ja"?num(d.amount)*num(d.sign):0; return `<tr><td><strong>${esc(d.position)}</strong><div class="cell-sub">${esc(d.category)}</div></td><td>${input(`nwc.debt.${i}.amount`,d.amount,"number")}</td><td>${select(`nwc.debt.${i}.include`,d.include,OPTIONS.yesNo)}</td><td>${select(`nwc.debt.${i}.sign`,d.sign,["-1","0","1"])}</td><td><strong>${fmtMoney(included)}</strong></td><td>${textarea(`nwc.debt.${i}.reason`,d.reason,"Begründung / SPA-Behandlung")}</td></tr>`;}).join("");
      const netDebt=state.nwc.debt.reduce((s,d)=>s+(d.include==="Ja"?num(d.amount)*num(d.sign):0),0);
      return pageHead("Closing-Mechanik","NWC & Net Debt","Monatswerte positiv erfassen; Faktor +1/−1 steuert NWC. Debt-like-Positionen wirtschaftlich und vertraglich beurteilen.")+
        `<div class="grid two" style="margin-bottom:16px">${metric("Vorgeschlagenes NWC-Peg",fmtMoney(median),"Median der zwölf Monats-NWC")}${metric("Net Debt",fmtMoney(netDebt),"einbezogene Positionen")}</div>
        <div class="section-title"><h3>NWC-Monatsanalyse</h3><small>horizontal scrollbar</small></div>
        <div class="table-wrap" style="max-height:520px"><table><thead><tr><th>Komponente</th><th>Faktor</th>${state.nwc.months.map(x=>`<th>${esc(x)}</th>`).join("")}<th>Ø</th></tr></thead><tbody>${compRows}${totalRow}</tbody></table></div>
        <div class="section-title"><h3>Net-Debt-/Debt-like-Brücke</h3></div>
        <div class="table-wrap"><table><thead><tr><th>Position</th><th>Betrag</th><th>Einbeziehen?</th><th>Vorzeichen</th><th>Einbezogen</th><th>Begründung</th></tr></thead><tbody>${debtRows}</tbody></table></div>`;
    }
    function addContract(){
      const n=state.contracts.length+1;
      state.contracts.push({id:`V-${String(n).padStart(3,"0")}`,type:"",counterparty:"",subject:"",annualValue:"",start:"",end:"",changeControl:"",termination:"",liability:"",consent:"Zu prüfen",risk:"",measure:"",owner:"",status:"Nicht begonnen",vdr:"",checkRef:""});
      saveState(); renderCurrent();
    }
    function renderContracts(){
      const rows=state.contracts.map((c,i)=>`<tr><td><strong>${esc(c.id)}</strong></td><td>${select(`contracts.${i}.type`,c.type,["Kunde","Lieferant","Finanzierung","Miete","Lizenz","IT/Cloud","Distribution","Kooperation/JV","Versicherung","Sonstige"])}</td><td>${input(`contracts.${i}.counterparty`,c.counterparty)}</td><td class="wide">${textarea(`contracts.${i}.subject`,c.subject,"Leistungsgegenstand")}</td><td>${input(`contracts.${i}.annualValue`,c.annualValue,"number")}</td><td>${textarea(`contracts.${i}.changeControl`,c.changeControl,"CoC / Abtretung / Kündigung")}</td><td>${select(`contracts.${i}.consent`,c.consent,OPTIONS.yesNo)}</td><td>${textarea(`contracts.${i}.risk`,c.risk,"Risiko")}</td><td>${textarea(`contracts.${i}.measure`,c.measure,"Maßnahme")}</td><td>${select(`contracts.${i}.status`,c.status,OPTIONS.status)}</td></tr>`).join("");
      return pageHead("Legal DD","Vertragsprüfung","Wesentliche Verträge einzeln erfassen und mit Umsatz, Marge, Vertragsregister und tatsächlicher Durchführung abstimmen.",
        `<button class="btn primary" data-action="add-contract">+ Vertrag</button>`) +
        (state.contracts.length?`<div class="table-wrap"><table><thead><tr><th>ID</th><th>Typ</th><th>Gegenpartei</th><th>Leistung</th><th>Jahreswert</th><th>Kernklauseln</th><th>Consent?</th><th>Risiko</th><th>Maßnahme</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`:`<div class="card empty"><h3>Noch keine Verträge erfasst</h3><p>Ersten wesentlichen Vertrag hinzufügen.</p><button class="btn primary" data-action="add-contract">+ Vertrag</button></div>`);
    }
    function renderWorkstream(area,title){ return renderChecklist(area,`${title}-Vertiefung`); }
    function renderMechanisms(){
      const cards=state.mechanisms.map((m,i)=>`<div class="card"><div style="display:flex;justify-content:space-between;gap:10px"><h3 style="margin:0">${esc(m.mechanism)}</h3>${badge(m.status)}</div><p><strong>Geeignet für:</strong> ${esc(m.suitable)}</p><p class="cell-sub">${esc(m.examples)}</p><details class="inline"><summary>Ausgestaltung und Risiko</summary><div class="detail-body">${esc(m.design)}<br><strong>Adressiert:</strong> ${esc(m.risk)}<br><strong>Lead:</strong> ${esc(m.lead)}</div></details><div class="field" style="margin-top:12px"><label>Entscheidung / Bezug</label>${textarea(`mechanisms.${i}.decision`,m.decision,"Finding-ID und Eckpunkte")}</div><div class="field" style="margin-top:8px"><label>Status</label>${select(`mechanisms.${i}.status`,m.status,["Zu prüfen","In Verhandlung","Beschlossen","Verworfen","Umgesetzt"])}</div></div>`).join("");
      return pageHead("Transaktionsschutz","Deal-Mechanismen","Mechanismus aus dem bestätigten Finding ableiten, wirtschaftliche Doppelzählungen vermeiden und Wirksamkeit fachlich prüfen.")+`<div class="grid three">${cards}</div>`;
    }
    function renderHelp(){
      return pageHead("Anleitung","Ausfüllhilfe","Klarer Arbeitsablauf für ein neues Due-Diligence-Projekt und einheitliche Qualitätsregeln.")+`
        <div class="grid two">
          <div class="card"><h3>Empfohlener Ablauf</h3><div class="help-steps">
            <div class="help-step"><strong>Projektparameter setzen</strong><div class="cell-sub">Ziel, Deal-Typ, Stichtag, Materialität und Vertraulichkeit auf der Übersicht festlegen.</div></div>
            <div class="help-step"><strong>Projektstart abschließen</strong><div class="cell-sub">63 Aufgaben bearbeiten, namentliche Owner und Termine setzen; Direktlinks nutzen.</div></div>
            <div class="help-step"><strong>Datenraum steuern</strong><div class="cell-sub">Requests versenden, Qualität prüfen und fehlende kritische Dokumente eskalieren.</div></div>
            <div class="help-step"><strong>Analysieren und belegen</strong><div class="cell-sub">Checklistenstatus nur mit nachvollziehbarer Primärevidenz abschließen.</div></div>
            <div class="help-step"><strong>Risiken entscheiden</strong><div class="cell-sub">Eintritt, Auswirkung und Exposure getrennt bewerten; Preis-/SPA-/Closing-Folge festlegen.</div></div>
            <div class="help-step"><strong>Maßnahmen übergeben</strong><div class="cell-sub">Owner, Frist, Budget, KPI und Abnahmekriterium bis Day 1/100 Tage nachhalten.</div></div>
          </div></div>
          <div class="card"><h3>Risiko-Scoring</h3><p class="cell-sub">Score = Eintrittswahrscheinlichkeit × Auswirkung. Beide Werte sind anhand belegter Szenarien zu begründen.</p><div class="score-grid">
            <div class="score-box low"><strong>1–4 · Niedrig</strong>Dokumentieren und regulär überwachen.</div>
            <div class="score-box medium"><strong>5–9 · Mittel</strong>Maßnahme mit Owner und Frist.</div>
            <div class="score-box high"><strong>10–16 · Hoch</strong>Quantifizieren und Deal-Schutz entscheiden.</div>
            <div class="score-box critical"><strong>17–25 · Kritisch</strong>Sofort eskalieren; No-go/CP/Freistellung prüfen.</div>
          </div><div class="callout warning" style="margin-top:16px">Hypothesen sind keine Findings. Management-Aussagen allein reichen für wesentliche Feststellungen nicht aus.</div></div>
        </div>
        <div class="section-title"><h3>Datensicherheit und Übergabe</h3></div>
        <div class="grid three">
          <div class="card"><h3>Lokale Speicherung</h3><p>Der Browser speichert Änderungen lokal. Andere Nutzer und Browser erhalten sie nicht automatisch.</p></div>
          <div class="card"><h3>JSON-Sicherung</h3><p>Regelmäßig JSON exportieren. Die Datei enthält alle HTML-Eingaben und kann wieder importiert werden.</p></div>
          <div class="card"><h3>Excel</h3><p>HTML und Excel sind separate Arbeitsstände. Ein direkter Link lädt die Excel-Vorlage; eine automatische Synchronisierung findet nicht statt.</p></div>
        </div>`;
    }
    function renderSources(){
      const rows=state.sources.map(s=>`<div class="source"><div class="source-id">${esc(s.id)}</div><div><a href="${esc(s.url)}" target="_blank" rel="noopener"><strong>${esc(s.title)}</strong></a><div class="cell-sub">${esc(s.publisher)} · ${esc(s.use)}</div><div class="cell-sub">${esc(s.note)}</div></div></div>`).join("");
      return pageHead("Methodik","Quellen","Ausgangspunkte für Methodik und Rechtsfragen. Aktuelle Primärquellen und qualifizierte Fachberatung bleiben erforderlich.")+`<div class="card">${rows}</div>`;
    }
    function dataRowsForView(){
      if(currentView==="project") return state.projectTasks;
      if(currentView==="checklist"||["it","hr","tax"].includes(currentView)) return state.checklist;
      if(currentView==="documents") return state.documents;
      if(currentView==="risks") return state.risks;
      if(currentView==="actions") return state.actions;
      if(currentView==="qa") return state.qa;
      if(currentView==="contracts") return state.contracts;
      if(currentView==="mechanisms") return state.mechanisms;
      return [];
    }
    function download(content,name,type){
      const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob);
      const a=document.createElement("a"); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
    }
    function exportJSON(){ download(JSON.stringify(state,null,2),`DD_${(state.meta.target||"Projekt").replace(/\W+/g,"_")}.json`,"application/json"); }
    function exportCSV(){
      const rows=dataRowsForView(); if(!rows.length){ alert("Für diese Ansicht ist kein Tabellenexport verfügbar."); return; }
      const keys=[...new Set(rows.flatMap(row=>Object.keys(row)))];
      const q=v=>`"${String(Array.isArray(v)?v.join(" | "):(v??"")).replace(/"/g,'""')}"`;
      const csv="\ufeff"+[keys.map(q).join(";"),...rows.map(row=>keys.map(k=>q(row[k]&&typeof row[k]==="object"?JSON.stringify(row[k]):row[k])).join(";"))].join("\n");
      download(csv,`DD_${currentView}.csv`,"text/csv;charset=utf-8");
    }
    function importJSON(file){
      const reader=new FileReader();
      reader.onload=()=>{ try { const parsed=JSON.parse(reader.result); if(parsed.schemaVersion!==BASE_DATA.schemaVersion) throw new Error("Versionskonflikt"); state=parsed; saveState(); showView("dashboard"); alert("Projektstand wurde importiert."); } catch(e){ alert("Die Datei ist kein kompatibler Projektstand."); } };
      reader.readAsText(file);
    }
    function closeMenu(){ document.getElementById("sidebar").classList.remove("open"); document.getElementById("overlay").classList.remove("show"); }
    document.addEventListener("change",event=>{
      const el=event.target;
      if(el.dataset.bind){
        let value=el.type==="range"?Number(el.value):el.value;
        setPath(state,el.dataset.bind,value); saveState(); renderCurrent();
      }
      if(el.dataset.filterFor) filterRows(el.dataset.filterFor);
    });
    document.addEventListener("input",event=>{ if(event.target.dataset.filterFor) filterRows(event.target.dataset.filterFor); });
    document.addEventListener("click",event=>{
      const viewButton=event.target.closest("[data-view]"); if(viewButton){ showView(viewButton.dataset.view); return; }
      const link=event.target.closest("[data-link-sheet]"); if(link){ showView(SHEET_VIEW[link.dataset.linkSheet]||"dashboard"); return; }
      const action=event.target.closest("[data-action]")?.dataset.action;
      if(action==="add-qa") addQA();
      else if(action==="add-qoe") addQoE();
      else if(action==="add-contract") addContract();
      else if(action==="export-json") exportJSON();
      else if(action==="export-csv") exportCSV();
      else if(action==="import-json") document.getElementById("importFile").click();
      else if(action==="print") window.print();
      else if(action==="complete-visible-project"){
        document.querySelectorAll('[data-filter-row="project"]').forEach(row=>{ if(row.style.display!=="none"){ const id=row.querySelector("strong")?.textContent; const task=state.projectTasks.find(x=>x.id===id); if(task){ task.status="Abgeschlossen"; task.completedDate=new Date().toISOString().slice(0,10); } } });
        saveState(); renderCurrent();
      }
    });
    document.getElementById("importFile").addEventListener("change",e=>{ if(e.target.files[0]) importJSON(e.target.files[0]); e.target.value=""; });
    document.getElementById("menuToggle").addEventListener("click",()=>{ document.getElementById("sidebar").classList.toggle("open"); document.getElementById("overlay").classList.toggle("show"); });
    document.getElementById("overlay").addEventListener("click",closeMenu);
    showView("project");
  </script>
</body>
</html>
"""


def main() -> None:
    data = json.dumps(build_data(), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = HTML_TEMPLATE.replace("__DATA__", data)
    OUTPUT.write_text(html, encoding="utf-8")
    print(f"Erstellt: {OUTPUT}")
    print(f"Dateigröße: {OUTPUT.stat().st_size} Bytes")


if __name__ == "__main__":
    main()
