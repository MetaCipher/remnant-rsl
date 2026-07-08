# RSL Stats Widget

Live season stats for the **Remnant Softball League** ([theremnant.life/rsl](https://www.theremnant.life/rsl)), powered by a Google Sheet that Pastor Blake updates weekly. Players and fans see standings, league leaders, per-team batting tables, and Player of the Week — updated automatically within minutes of a sheet edit.

## How it works

```
Pastor Blake edits          Google Sheets              This widget (static page,
the Google Sheet    ──►     GViz JSON endpoint   ──►   hosted free on GitHub Pages)
(one row per player          (public read-only,          │
 per game)                    no API key needed)         ▼
                                              <iframe> on theremnant.life/rsl
                                              (Squarespace Embed block)
```

No server, no database, no API keys, no cost. The sheet is shared as
"Anyone with the link: **Viewer**" and the widget reads it straight from the
browser. All stats (AVG, OB%, SLG, OPS, OPR, hitting streaks, standings,
games back, leaders) are computed by the widget from the raw game-by-game
numbers — the pastor only ever types counting stats.

## Repo map

| Path | What it is |
|---|---|
| `index.html` | The widget page (this is what gets iframed / hosted) |
| `config.js` | **The only file you edit** — sheet ID, league name, tab names |
| `assets/rsl-compute.js` | Stats engine (formulas verified against bgsd.com printouts) |
| `assets/rsl-stats.js` | Fetching, parsing, and rendering |
| `assets/rsl-stats.css` | Styling (matched to theremnant.life palette + type) |
| `assets/demo-data.js` | Sample data shown until a real sheet ID is configured |
| `sample/*.csv` | Import these into Google Sheets to create the three tabs |
| `docs/PLAN.md` | The plan, decisions, and reverse-engineered formulas |
| `docs/SHEET-SETUP.md` | Google Sheet setup + Pastor Blake's weekly routine |
| `docs/SQUARESPACE-SETUP.md` | Hosting on GitHub Pages + embedding in Squarespace |
| `tests/compute.test.cjs` | Formula tests (`node tests/compute.test.cjs`) |

## Quick start (local preview)

```bash
python3 -m http.server 8477
# open http://127.0.0.1:8477 — runs on demo data until config.js has a sheetId
```

You can also preview against a real sheet without editing config:
`http://127.0.0.1:8477/?sheet=YOUR_SHEET_ID`

## Going live — three steps

1. **Sheet** — follow [docs/SHEET-SETUP.md](docs/SHEET-SETUP.md); paste the sheet ID into `config.js`.
2. **Host** — push this folder to GitHub and enable GitHub Pages ([docs/SQUARESPACE-SETUP.md](docs/SQUARESPACE-SETUP.md), step 1).
3. **Embed** — add an Embed block with the iframe snippet to the RSL page (same doc, step 2).

## Tests

```bash
node tests/compute.test.cjs
```

Verifies the derived-stat formulas against seven real published rows from the
reference site (bgsd.com), plus streaks, standings, and leader-qualifier logic.
