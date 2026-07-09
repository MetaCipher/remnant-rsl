# Season Transition Runbook (2026 → 2027 and beyond)

Do this before the first game of a new season. Takes ~20 minutes.
The guiding principle: **one Google Sheet per season** — the old sheet
becomes the permanent archive; nothing is ever wiped.

## 1. Copy the sheet

1. Open "RSL Stats 2026" → **File → Make a copy** → name it "RSL Stats 2027".
2. Copying a sheet **also copies its bound Apps Script**, so the ⚾ RSL menu
   comes along. The first import in the new copy will ask for authorization
   again — approve it once.
3. In the copy, clear the data rows (keep header rows) on `GCStats`, `Games`,
   `POW`, and `Meta`. (The first import replaces GCStats/Games/Meta anyway —
   `POW` is the one that must be emptied by hand.)
4. Share the copy: **Anyone with the link → Viewer**.

## 2. Point the website at the new sheet

1. Copy the new sheet's ID from its URL (between `/d/` and `/edit`).
2. Test before deploying: run `python3 -m http.server 8477` in the repo and
   open `http://127.0.0.1:8477/?sheet=NEW_SHEET_ID` — you should see an empty
   but healthy league (no standings yet, "no player stats yet" per team).
3. Edit `config.js`: set `sheetId` to the new ID. If the league name or
   subtitle changes, update those too — the **year in the header is derived
   from the data automatically**, so nothing else needs a yearly touch.
4. `git add -A && git commit -m "2027 season" && git push` — live in ~10 min.

## 3. GameChanger side

- Teams renew/recreate their GC seasons — the exports and the importer work
  identically. Two things to watch:
  - **Team names must match** between the Results export and each team file's
    filename, same as always. A renamed team is simply a new team.
  - Per-team Season Stats exports still require team-staff access — confirm
    that carries over for all teams (this was the Knights holdup in 2026).
- First import of the season: ⚾ RSL → import the Results CSV + any team
  files that have data. Everything populates from scratch.

## 4. (Optional) publish the old season as an archive

The widget accepts a `?sheet=` override, so archives are free:

1. Keep the old sheet shared (view-only).
2. On Squarespace, create a page like `/rsl-stats-2026` with an Embed block:
   ```html
   <iframe src="https://metacipher.github.io/remnant-rsl/?sheet=OLD_SHEET_ID"
     title="RSL 2026 Archive" width="700" height="1500"
     style="border:0;" loading="lazy"></iframe>
   ```
3. Link it from the current stats page or the RSL page.

One hosted widget serves every season this way — no code changes.

## 5. Sanity checklist

- [ ] New sheet shared "Anyone with link: Viewer"
- [ ] ⚾ RSL menu appears in the new sheet; first import authorized and run
- [ ] `config.js` points at the new sheet ID; pushed
- [ ] Live page shows the new season ("Updated \<date\>" from the new Meta tab)
- [ ] Old sheet untouched and still shared if an archive page uses it
