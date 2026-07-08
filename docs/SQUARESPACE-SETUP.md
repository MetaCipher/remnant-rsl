# Hosting + Squarespace Embed

theremnant.life is on a **Personal** Squarespace plan, which doesn't allow
Code blocks (custom JS). So the widget lives on free external hosting and the
RSL page embeds it in an iframe via an **Embed block** (available on all plans).

## Step 1 — Host the widget on GitHub Pages (free, one-time)

1. Create a GitHub account (or use an existing one) and a new **public**
   repository named `remnant-rsl`.
2. Push this folder to it:

   ```bash
   cd /Users/tim/Projects/remnant-rsl
   git add -A
   git commit -m "RSL stats widget"
   git remote add origin https://github.com/YOUR-USERNAME/remnant-rsl.git
   git push -u origin main
   ```

3. On GitHub: **Settings → Pages → Build and deployment** →
   Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
4. After a minute the widget is live at:
   `https://YOUR-USERNAME.github.io/remnant-rsl/`
   (It shows demo data until `config.js` has the real sheet ID.)

**Updating later** (new sheet ID, style tweaks): edit the file, then
`git add -A && git commit -m "update" && git push` — Pages redeploys
automatically in about a minute. The weekly stats themselves need **no**
deploys — they flow straight from the Google Sheet.

*No-git alternative:* drag this folder onto [Netlify Drop](https://app.netlify.com/drop)
— you'll get a URL the same way, but updates mean re-dragging the folder.

## Step 2 — Embed it on theremnant.life/rsl

1. Log in to Squarespace and edit the **RSL** page.
2. Add a block where the stats should appear → choose **Embed**.
3. Click the **`</>`** (Embed Data / code) icon in the block's URL field and
   paste, replacing the URL with your real GitHub Pages URL:

   ```html
   <iframe
     src="https://YOUR-USERNAME.github.io/remnant-rsl/"
     title="RSL Weekly Stats"
     style="width:100%; height:1500px; border:0;"
     loading="lazy"></iframe>
   ```

4. Save the page. Done — the widget inherits the page's white background and
   is styled to match the site (charcoal header, the site's red-orange accent,
   futura-style headings).

### Sizing notes

- `height:1500px` fits ~15-player rosters with the Player-of-the-Week card.
  If a team view gets clipped, bump the number; if there's too much blank
  space below, shrink it. (The Personal plan can't run the script needed for
  auto-resizing — this is the one trade-off of the iframe route.)
- Deep links work if you ever want them:
  `.../remnant-rsl/?view=standings`, `?view=leaders`, or `?view=team:The Remnant`.

## If the site is ever upgraded to Business plan

Skip the iframe entirely: add a **Code block** containing

```html
<div id="rsl-stats"></div>
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://YOUR-USERNAME.github.io/remnant-rsl/assets/rsl-stats.css">
<script src="https://YOUR-USERNAME.github.io/remnant-rsl/config.js"></script>
<script src="https://YOUR-USERNAME.github.io/remnant-rsl/assets/rsl-compute.js"></script>
<script src="https://YOUR-USERNAME.github.io/remnant-rsl/assets/rsl-stats.js"></script>
```

The widget renders inline (auto-height, no inner scrollbars) and still pulls
data from the same sheet and hosted files.
