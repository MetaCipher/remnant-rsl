# CLAUDE.md — working on this repo

Stats widget for a church softball league (RSL), embedded on
theremnant.life/rsl-stats. Vanilla JS, **no build step, no dependencies** —
keep it that way. Full docs live in `docs/` (start with `DEPLOYMENT.md`).

## Non-negotiables

- **Do not "fix" the stat formulas to MLB definitions.** OB% =
  (H+BB+OBE)/(AB+BB) and OPR = (R+RBI)/AB are league conventions
  reverse-engineered from bgsd.com and locked by tests. GC's app shows a
  different OBP — that difference is deliberate.
- **Leaders qualifier gates on TEAM games played** (min AB = 2 × team GP),
  not the player's own GP. Regression here puts 2-game subs atop the boards.
- **`apps-script/Code.gs` does not deploy via git.** It runs as a pasted
  copy inside the Google Sheet (Extensions → Apps Script). After changing it
  here, tell the user to re-paste it.
- **Never commit real GameChanger exports** (they carry player names; the
  repo is public). `.gitignore` covers `sample/*Report*.csv`,
  `sample/*Summer*.csv`, `sample/*Results*.csv`, `test-totals.html`.

## Commands

```bash
node tests/compute.test.cjs      # stat formulas (must stay green — locked to real published rows)
node tests/gc-import.test.cjs    # GC CSV parsers (auto-skips if local real exports are absent)
python3 -m http.server 8477      # preview at http://127.0.0.1:8477 (live sheet via config.js)
```

Deploy = `git push origin main` → GitHub Pages (~1 min build + ~10 min CDN
cache). Data updates never require a deploy — the widget reads the Google
Sheet (GViz endpoint, keyless) on every page load.

## Layout

- `assets/rsl-compute.js` — pure stats engine (node-testable, UMD)
- `assets/rsl-stats.js` — fetch/parse/render (browser IIFE)
- `config.js` — the only file needing edits in normal operation (sheet ID etc.)
- `apps-script/Code.gs` — GameChanger CSV importer (manual deploy, see above)
- `docs/` — PLAN (decisions/formulas), SHEET-SETUP (data ops),
  SQUARESPACE-SETUP (embed), DEPLOYMENT (pipelines/caches/recovery),
  SEASON-TRANSITION (yearly runbook)

## Style

- Widget JS is ES5-flavored (function/var), 2-space indent; match it.
- Brand: maroon `#75231d` (headers), brick `#ad3c2f` (accent), light tint
  `#e7b3aa` for accent text on maroon — CSS variables atop `rsl-stats.css`.
- The site is embedded in a fixed-height iframe on a Squarespace Personal
  plan: no page-side JS exists, the widget must stay self-contained.
