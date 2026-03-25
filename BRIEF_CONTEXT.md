# Morning Brief — Generation Workflow

> Adapted from CONTEXT_2.md. Briefs now live inside dcf-dashboard — no separate repo needed.

---

## File Structure

```
dcf-dashboard/
└── public/
    └── briefs/
        ├── latest.html          ← always the current brief (iframe src)
        ├── YYYY-MM-DD.html      ← one file per day (archive)
        └── archive.html         ← browseable index (optional)
```

The dashboard reads `public/briefs/latest.html` and renders it in an iframe.
Pushing a new `latest.html` to main automatically updates the dashboard.

---

## After Generating a Brief

```bash
# From dcf-dashboard/ root:
cp /path/to/brief.html public/briefs/2026-03-25.html
cp /path/to/brief.html public/briefs/latest.html
git add public/briefs/
git commit -m "Brief 2026-03-25 · [one-line headline]"
git push
```

Vercel re-deploys automatically on push. The iframe refreshes on next page load.

---

## Coverage Areas

See original CONTEXT_2.md for full detail. Summary:

- **3A Geopolitics** — Iran/Hormuz war situation, ceasefire odds
- **3B Markets** — S&P, Brent, Gold, Merval, Country risk AR, USD/BRL, BCRA
- **3C Portfolio** — US equities, Brazil, Argentina, Fixed Income, Asia, Energy
- **3D Regulation** — EU AI Act, NIS2, DORA, CRA deadlines
- **3E SAP Intelligence** — BofA ratings, Q results, client pipeline

## Delivery

- **Morning**: 7:00 AM ART (UTC−3)
- **Evening**: 5:00 PM ART
- **Gmail draft**: To `marciofabrizio@gmail.com`, Subject: `☀️ Morning Brief · DD Mon YYYY`

---

## HTML Design System

Self-contained HTML — embedded CSS, no JS, Google Fonts Inter only.
Header gradient changes with market tone:
- War/escalation: `linear-gradient(135deg, #1e1b4b, #7f1d1d)`
- Talks/diplomatic: `linear-gradient(135deg, #1c3a5e, #1e1b4b)`
- Positive/ceasefire: `linear-gradient(135deg, #065f46, #1e1b4b)`

Full CSS and component reference: see CONTEXT_2.md sections 4–6.
