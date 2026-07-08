# RSL Stats — Plan & Process

*Last updated: July 2026*

## Goal

A weekly-updated stats display for the Remnant Softball League page on
theremnant.life (Squarespace). Pastor Blake updates a Google Sheet after
Saturday doubleheaders; players and viewers see fresh stats on the website
with no further work.

## Decisions (agreed 7/7/2026)

| Question | Decision | Consequence |
|---|---|---|
| Squarespace plan | **Personal/Basic** | No Code blocks → widget is hosted externally (GitHub Pages, free) and embedded via an **Embed block iframe**. Built to also work as a paste-in code block if the site is ever upgraded to Business. |
| Sections | Standings, league leaders, per-team stats + record + team leaders + team Player of the Week | Tabs: `Standings · Leaders · <one per team>`. POW and team-leader cards live on each team's tab. |
| Data entry | **Game-by-game** (one row per player per game) | Pastor types only counting stats; the widget does all math. Also the only way to compute hitting streaks (HS/LHS). |
| Stat columns | **Full bgsd set** | GP · PA · AB · H · R · RBI · 2B · 3B · HR · BB · K · SF · OBE · H/G · OPR · OB% · AVG · SLG · OPS · HS · LHS |

## Reference sites

- **Data model**: [bgsd.com church league stats](https://www.bgsd.com/softball/stats/2026/ch-church-L2-26.shtml) — column set, standings columns (GP W L T · R/G RA/G RD/G · PCT · LWS · streak · GB), 11 leader categories, Player of the Week.
- **Aesthetic**: [iScore Central](https://pro.iscorecentral.com/AAPB/stats?tab=batting&sort=avg) — clean cards, pill tabs, sortable dark-headed tables, `.667`-style rate stats.
- **Site fit**: theremnant.life — Squarespace 7.0 "Bedford" template. Extracted tokens: ink `#272727`, header `#201a16`, accent `#f0523d`, Adobe fonts futura-pt/proxima-nova (approximated with Google's "Jost" + system stack, since the Adobe kit is licensed to their domain only).

## Formulas (reverse-engineered from bgsd, verified against 7 published rows)

| Stat | Formula | Note |
|---|---|---|
| PA | AB + BB + SF | |
| AVG | H / AB | |
| OB% | (H + BB + OBE) / (AB + BB) | OBE = on base by error; SF excluded from denominator. This exact form is the only one matching every bgsd row. |
| SLG | (1B + 2·2B + 3·3B + 4·HR) / AB | |
| OPS | OB% + SLG | |
| OPR | (R + RBI) / AB | bgsd calls this "Offensive Potency Ratio" |
| H/G | H / GP | |
| HS / LHS | current / longest hitting streak | Game with ≥1 H extends; 0-fer with AB>0 breaks; walk-only game (AB=0) leaves it untouched. |
| PCT | (W + 0.5·T) / GP | ties count half |
| GB | ((W_lead − W) + (L − L_lead)) / 2 | |
| Leaders qualifier | AB ≥ 2 × GP | bgsd uses "minimum 12 AB" at 6 games; configurable via `minABPerGP` |

These are locked in by `tests/compute.test.cjs`, which asserts exact equality
with the seven bgsd rows captured on 7/7/2026.

## Architecture

- **Backend = Google Sheet** shared "Anyone with link: Viewer". Read via the
  GViz endpoint (`/gviz/tq?tqx=out:json&sheet=<tab>`) — public, CORS-enabled,
  keyless. Google caches responses for a few minutes, so edits appear on the
  site within ~5 minutes.
- **Widget = static vanilla JS** (no frameworks, no build step):
  `rsl-compute.js` (pure math, unit-tested) + `rsl-stats.js` (fetch/parse/render)
  + `rsl-stats.css`. Header aliases are forgiving (`H`/`Hits`, `2B`/`Doubles`,
  `OBE`/`ROE`…), dates accept `2026-05-09` or `5/9/2026`, team matching is
  case-insensitive.
- **Hosting = GitHub Pages** (free static hosting). The Squarespace page
  embeds it with a fixed-height iframe (Personal plan can't run scripts, so
  no dynamic iframe resizing — the widget keeps its own scrolling instead).
- **Demo mode**: with no `sheetId` configured, the widget renders generated
  sample data and shows a DEMO DATA badge, so the design can be previewed
  and the embed tested before the real sheet exists.

## Sheet schema (3 tabs)

- **PlayerStats** — `Date, Team, Player, AB, R, H, 2B, 3B, HR, RBI, BB, K, SF, OBE` — one row per player per game.
- **Games** — `Date, Team1, Score1, Team2, Score2` — one row per game (doubleheader = 2 rows). Drives standings and team records.
- **POW** — `Date, Team, Player, Note` — player of the week; the newest row per team is shown on that team's tab.

## Rollout checklist

- [x] Reverse-engineer reference data model + formulas; verify with tests
- [x] Build widget (standings / leaders / team tabs / POW / sorting / mobile)
- [x] Visual check in Chrome at desktop + phone widths
- [ ] Create the Google Sheet from `sample/*.csv`, share as link-viewer (Tim)
- [ ] Put sheet ID in `config.js`
- [ ] Push repo to GitHub, enable Pages
- [ ] Add Embed block iframe to theremnant.life/rsl
- [ ] Dry run with Pastor Blake: enter one real week of stats, watch it appear
- [ ] Hand off `docs/SHEET-SETUP.md` weekly-routine section to Pastor Blake

## Known limitations & mitigations

- **Fixed iframe height** (Personal plan = no script on the Squarespace side).
  Mitigation: tabbed layout keeps height stable; iframe gets `height:1500px`
  and the widget scrolls internally if a roster is unusually long.
- **Sheet must be link-readable.** Only stats live there — no contact info.
- **Name/team spelling must be consistent** — "Jon" vs "John" becomes two
  players. Mitigation documented in SHEET-SETUP (copy-paste rosters, or use
  a data-validation dropdown).
- **~5 min propagation delay** from Google's cache. Acceptable for weekly updates.

## Future ideas

- Upgrade to Business plan → paste the widget inline (auto-height, no iframe)
- Auto-resizing iframe via postMessage (needs Business plan for the listener)
- Pitching/defense stats tab; game-by-game log view per player
- Season archive selector (one sheet per season, dropdown in config)
- Schedule/upcoming-games tab from a `Schedule` sheet tab
