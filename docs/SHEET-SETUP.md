# Google Sheet Setup

The sheet is the league's single source of truth; the website reads it
automatically. Stats flow in from **GameChanger exports** via a built-in
importer (see below) — nobody types individual stats by hand.

## One-time: install the GameChanger importer

1. Open the sheet → **Extensions → Apps Script**.
2. Delete any starter code, paste the entire contents of
   [`apps-script/Code.gs`](../apps-script/Code.gs), save.
3. Reload the spreadsheet — a **⚾ RSL** menu appears in the menu bar.
4. First use only: Google asks to authorize the script (it only touches
   this spreadsheet).

## Weekly routine (Pastor Blake, ~5 min)

1. In GameChanger, download this week's exports:
   - the league **Results** CSV (all game scores), and
   - each team's **Season Stats** CSV.
2. Open the sheet → **⚾ RSL → Import GameChanger files…** → select all the
   downloaded CSVs at once → **Import**. File types are auto-detected;
   the dialog reports what was imported. (Uploading only some teams is
   fine — the others keep their existing numbers.)
3. Add this week's **Player of the Week** row on the `POW` tab (still manual).
4. Done — the website updates within ~5 minutes.

The importer fills two tabs:

- **GCStats** — `Team, Player, GP, PA, AB, H, R, RBI, 2B, 3B, HR, BB, K, SF, OBE`,
  one row per player (season totals). The team name comes from the export's
  filename, matched against teams already in the data.
- **Games** — rewritten from the Results export (chronological, all games).
- **Meta** — a `LastUpdated` stamp written on every import; the website's
  header shows it as "Updated <date>". (Without it, the site falls back to
  showing the latest game date as "Stats through <date>".)

Note: hitting streaks (HS/LHS) aren't shown with GameChanger data — season
totals can't produce them. The widget's OB% uses the league formula
`(H+BB+OBE)/(AB+BB)`, so it can differ slightly from GC's own OBP.

---

# Manual mode (legacy / fallback)

Everything below describes the original hand-entered game-by-game flow.
It still works — the widget auto-detects which format the stats tab holds,
and falls back to `PlayerStats` if `GCStats` doesn't exist yet. Manual mode
is also the only way to get hitting-streak columns.

## One-time setup (Tim, ~10 minutes)

1. In Google Drive, create a new spreadsheet named **RSL Stats 2026**.
2. Import the three CSV templates from this repo's `sample/` folder:
   - **File → Import → Upload** → pick `PlayerStats.csv` → Import location:
     **Insert new sheet(s)** → repeat for `Games.csv` and `POW.csv`.
   - Rename the three imported tabs to exactly: `PlayerStats`, `Games`, `POW`
     (right-click tab → Rename). Delete the default empty "Sheet1".
   - The imported example rows show the format — delete them before the
     season starts (keep the header row!).
3. Share it: **Share → General access → Anyone with the link → Viewer**.
   (Only people editing stats need edit access — share edit rights with
   Pastor Blake's Google account specifically.)
4. Copy the **sheet ID** from the URL — the long string between `/d/` and `/edit`:
   `https://docs.google.com/spreadsheets/d/`**`1AbC...xYz`**`/edit#gid=0`
5. Paste it into `config.js` (`sheetId: "1AbC...xYz"`) and redeploy (git push).

**Optional but recommended:** protect the header rows (right-click row 1 →
View more row actions → Protect) so they can't be edited accidentally, and
add a data-validation dropdown for the Team columns (Data → Data validation →
Dropdown from a range listing the team names) to keep spellings consistent.

## Tab formats

### PlayerStats — one row per player **per game**

| Date | Team | Player | AB | R | H | 2B | 3B | HR | RBI | BB | K | SF | OBE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-05-09 | The Remnant | John Example | 4 | 2 | 3 | 1 | 0 | 1 | 2 | 0 | 0 | 0 | 0 |

- A Saturday doubleheader = **two rows** per player (one per game).
- 2B/3B/HR are *included in* H (3 hits, one of them a homer → H=3, HR=1).
- OBE = reached base on an error. K = strikeouts. SF = sacrifice flies.
- Leave a player out of a game he/she didn't play — don't add zero rows.
- Everything else (AVG, OB%, SLG, OPS, OPR, PA, H/G, streaks) is **computed
  by the website** — never type those.

### Games — one row per game

| Date | Team1 | Score1 | Team2 | Score2 |
|---|---|---|---|---|
| 2026-05-09 | The Remnant | 12 | First Baptist | 8 |

Order doesn't matter (no home/away). This tab drives standings, records,
and streaks.

### POW — Player of the Week

| Date | Team | Player | Note |
|---|---|---|---|
| 2026-05-09 | The Remnant | John Example | 3-for-4 with a homer |

Add one row for the current week's Player of the Week. Only the single
newest row (league-wide) is shown, on the Standings and Leaders tabs, so
add just the current winner each week — older rows are kept as history.

## Pastor Blake's weekly routine (~10–15 min after games)

1. Open the **RSL Stats 2026** sheet (works fine on a phone, easier on a computer).
2. **Games tab** — add one row per game played with the final scores.
3. **PlayerStats tab** — add one row per player per game from the scorebook.
4. **POW tab** — add one row for this week's Player of the Week (optional).
5. That's it. The website updates itself within about 5 minutes.

### Rules that keep the stats accurate

- **Spell names the same way every week** — "Jon Smith" and "John Smith"
  become two different players. Copy-paste from previous weeks when in doubt.
- **Team names must match exactly across all three tabs** (capitalization
  doesn't matter, spelling does).
- Dates: `2026-05-09` or `5/9/2026` both work — pick one style and stick to it.
- Don't rename the tabs or the header columns.
- Mistakes are easy to fix: just edit the wrong cell — the site recalculates
  everything from scratch on every view.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Website says "Couldn't load stats" | Sheet sharing must be "Anyone with the link: Viewer"; tab names must be exactly `PlayerStats`, `Games`, `POW`. |
| A player shows up twice | Name spelled two ways — make them identical. |
| A team is missing from standings | It has no row in the `Games` tab yet. |
| Edits not showing | Google caches for a few minutes — wait 5 minutes and hard-refresh. |
