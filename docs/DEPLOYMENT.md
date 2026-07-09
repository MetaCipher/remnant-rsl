# Deployment Pipeline

Everything that changes what visitors see at [theremnant.life/rsl-stats](https://www.theremnant.life/rsl-stats)
flows through one of **four surfaces**. Only the first two change regularly.

```
┌─ DATA (weekly, Pastor Blake) ─────────────────────────────────────────────┐
│  GameChanger app/web                                                      │
│    └─ download CSVs (league Results + each team's Season Stats)           │
│         └─ Google Sheet menu: ⚾ RSL → Import GameChanger files…           │
│              └─ Apps Script rewrites tabs: GCStats, Games, Meta           │
│                   └─ GViz endpoint (public, keyless)   ~1–5 min cache     │
│                        └─ widget fetches on every page load               │
└───────────────────────────────────────────────────────────────────────────┘

┌─ WIDGET CODE (as needed, Tim) ────────────────────────────────────────────┐
│  local repo  ──git push──►  github.com/MetaCipher/remnant-rsl (main)      │
│    └─ GitHub Pages rebuilds automatically   ~1 min build + ~10 min CDN    │
│         └─ https://metacipher.github.io/remnant-rsl/                      │
│              └─ <iframe> on theremnant.life/rsl-stats                     │
└───────────────────────────────────────────────────────────────────────────┘

┌─ APPS SCRIPT (rare — MANUAL DEPLOY) ──────────────────────────────────────┐
│  apps-script/Code.gs in this repo  ──copy/paste──►  Sheet → Extensions →  │
│  Apps Script → replace contents → Save.  ⚠ Does NOT deploy on git push.  │
└───────────────────────────────────────────────────────────────────────────┘

┌─ SQUARESPACE (almost never) ──────────────────────────────────────────────┐
│  Embed block iframe + Custom CSS on theremnant.life (Personal plan —      │
│  no code blocks, no page-side JS).  Edited by hand in the Squarespace UI. │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Data pipeline (weekly)

**Trigger:** Pastor Blake, after Saturday games.

1. In GameChanger, download the league **Results** CSV and each team's
   **Season Stats** CSV.
2. Open the Google Sheet → **⚾ RSL → Import GameChanger files…** → select
   all downloaded CSVs at once → Import. File types are auto-detected;
   duplicates within a batch are deduped (last file per team wins).
3. Add a **POW** row per team by hand (the only manual data).

**What the importer writes:**

| Tab | Contents | Write mode |
|---|---|---|
| `GCStats` | Team, Player, GP, PA, AB, H, R, RBI, 2B, 3B, HR, BB, K, SF, OBE | Replace **per team**; teams absent from the upload keep existing rows |
| `Games` | Date, Team1, Score1, Team2, Score2 (chronological) | Full replace |
| `Meta` | `LastUpdated` stamp → the site's "Updated \<date\>" header | Full replace |

**Idempotent:** importing the same file twice yields the identical sheet.
Importing an *older* export overwrites with older numbers — the next correct
import heals it (GC exports are season-cumulative).

**Propagation:** Google caches GViz responses ~1–5 minutes. No deploys, no
builds — the widget reads the sheet on every page load.

**Verify:** open the stats page, hard-refresh, check the header says
"Updated" with today's date and spot-check one player.

## 2. Widget code pipeline (as needed)

**What deploys:** everything committed to `main` — `index.html`, `config.js`,
`assets/*`. The `.gitignore` keeps real GameChanger exports (player names)
and the local test fixture out of the public repo.

```bash
# before pushing
node tests/compute.test.cjs     # formulas (locked to bgsd + GC-verified rows)
node tests/gc-import.test.cjs   # importer parsers (vs real local exports)
python3 -m http.server 8477     # eyeball at http://127.0.0.1:8477

# deploy
git add -A && git commit -m "..." && git push origin main
```

GitHub Pages (Settings → Pages: branch `main`, folder `/ (root)`) rebuilds
automatically. **Latency:** ~1 minute build, then up to ~10 minutes of CDN
cache (`max-age=600`) plus visitors' browser cache — hard-refresh
(Cmd+Shift+R) to see changes immediately.

**Rollback:** `git revert <sha> && git push` (or `git push --force` an older
commit). Pages redeploys the same way. Data is unaffected — it lives in the
sheet, not the repo.

**Config changes** (sheet ID, tab names, league name, leaders qualifier)
are code deploys too — edit `config.js`, commit, push.

## 3. Apps Script pipeline (rare, manual)

`apps-script/Code.gs` is **versioned in this repo but deployed by hand** —
git push does *not* update the copy running in the sheet.

To deploy: open the Sheet → **Extensions → Apps Script** → select all →
paste the current file contents → Save (no re-authorization needed for
edits to the same project). Do this whenever `Code.gs` changes in the repo.

> ⚠ Drift risk: if the repo file and the pasted copy diverge, the repo is
> the source of truth — re-paste. The script history in Apps Script
> (File → Version history) is the rollback path on that side.

## 4. Squarespace surface (almost never)

- **Embed block** on theremnant.life/rsl-stats holds the iframe:
  ```html
  <iframe src="https://metacipher.github.io/remnant-rsl/"
    title="RSL Weekly Stats" width="700" height="1500"
    style="border:0;" loading="lazy"></iframe>
  ```
  Squarespace converts `height/width` attributes into an aspect-ratio box
  (height ∝ page width). The **Custom CSS** panel (Design → Custom CSS)
  overrides that to a fixed height:
  ```css
  #block-yui_3_17_2_1_1783521207016_2110 .embed-block-wrapper {
    padding-bottom: 0 !important;
    height: 1500px !important;
  }
  ```
  ⚠ The block ID changes if the Embed block is ever deleted/recreated or
  moved to another page — re-find it (view page source, search `metacipher`)
  and update the CSS rule.
- Touch this surface only to: change the iframe height, move the embed, or
  (if the site ever upgrades to Business plan) replace the iframe with the
  inline code-block snippet in `docs/SQUARESPACE-SETUP.md`.

## 5. Local development & testing

| Task | How |
|---|---|
| Preview with live data | `python3 -m http.server 8477` → http://127.0.0.1:8477 (config.js has the real sheet ID) |
| Preview with demo data | temporarily blank `sheetId` in config.js — renders generated sample data with a DEMO badge |
| Preview another sheet | `http://127.0.0.1:8477/?sheet=<SHEET_ID>` |
| Deep-link a view | `?view=standings`, `?view=leaders`, `?view=team:Paladins` |
| Formula/parser tests | `node tests/compute.test.cjs` · `node tests/gc-import.test.cjs` (parser tests auto-skip if the local gitignored GC exports are absent) |
| Full pipeline fixture | `test-totals.html` (gitignored) — the widget running against canned GViz responses built from real exports |

## 6. Caches & propagation cheat sheet

| Layer | Cache | Beat it with |
|---|---|---|
| Google GViz (sheet reads) | ~1–5 min | wait; nothing to click |
| GitHub Pages CDN | up to ~10 min | wait, or verify via `curl -s <url> \| head` |
| Visitor browser | until revisit | hard refresh (Cmd+Shift+R) |
| Squarespace | none relevant (iframe src is external) | — |

Rule of thumb: **data edits appear in ~5 minutes; code pushes in ~10.**

## 7. Access & credentials inventory

Nothing secret lives in the repo — no API keys anywhere in the system.

| Asset | Where | Who |
|---|---|---|
| GitHub repo `MetaCipher/remnant-rsl` (public) | github.com | Tim (SSH key on his Mac) |
| Google Sheet (link-view public, edit restricted) | Google Drive | Pastor Blake (edit), Tim |
| Apps Script (runs as the authorizing editor) | inside the sheet | whoever ran first authorization |
| GameChanger league account | gc.com | Blake (blakecastle15@…), team staff for per-team exports |
| Squarespace site | theremnant.life | Tim |
| Figma (flyer) | figma.com | Tim |

## 8. Disaster recovery

| Failure | Recovery |
|---|---|
| Bad data imported | Re-import the correct exports — every tab write is a full replace (per-team for GCStats) |
| Sheet tab deleted/corrupted | Re-run the importer (it recreates `GCStats`/`Games`/`Meta`); `POW` is the only tab needing manual re-entry |
| Whole sheet deleted | New sheet from `sample/*.csv` per `docs/SHEET-SETUP.md`, share link-view, put the new ID in `config.js`, push, re-paste Apps Script, re-import |
| Broken widget deploy | `git revert` + push |
| Site shows "Couldn't load stats" | Check sheet sharing is "Anyone with link: Viewer" and tab names match `config.js` |
| Stale stats on site | Almost always caching — wait 5–10 min, hard-refresh; then confirm the import actually ran (Meta stamp / "Updated" date) |
