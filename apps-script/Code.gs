/**
 * RSL GameChanger Importer — Google Apps Script
 *
 * ONE-TIME SETUP (Tim):
 *   1. Open the "RSL Stats 2026" Google Sheet.
 *   2. Extensions → Apps Script. Delete any starter code in Code.gs,
 *      paste this entire file, hit Save (disk icon).
 *   3. Reload the spreadsheet. A new "⚾ RSL" menu appears.
 *   4. First run only: pick "Import GameChanger files…", Google asks for
 *      authorization — approve it (the script only touches this sheet).
 *
 * WEEKLY (Pastor Blake):
 *   1. In GameChanger, download the league "Results" CSV and each team's
 *      "Season Stats" CSV.
 *   2. In the sheet: ⚾ RSL → Import GameChanger files… → select all the
 *      downloaded CSVs at once → Import.
 *   3. Add a Player of the Week row on the POW tab (that's still manual).
 *
 * What it does: rewrites the "Games" tab from the Results export, and
 * updates the "GCStats" tab per team from the Season Stats exports (teams
 * not included in an upload keep their existing rows). File type is
 * auto-detected, so selecting extra files is harmless.
 */

var GAMES_SHEET = 'Games';
var STATS_SHEET = 'GCStats';
var STATS_HEADER = ['Team', 'Player', 'GP', 'PA', 'AB', 'H', 'R', 'RBI',
  '2B', '3B', 'HR', 'BB', 'K', 'SF', 'OBE'];
var GAMES_HEADER = ['Date', 'Team1', 'Score1', 'Team2', 'Score2'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚾ RSL')
    .addItem('Import GameChanger files…', 'showImportDialog')
    .addToUi();
}

function showImportDialog() {
  var html = HtmlService.createHtmlOutput(DIALOG_HTML).setWidth(440).setHeight(380);
  SpreadsheetApp.getUi().showModalDialog(html, 'Import GameChanger exports');
}

/* Called from the dialog with [{name, text}, ...]. Returns report lines. */
function importGcFiles(files) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var report = [];
  var teamBlocks = [];
  var games = null;

  files.forEach(function (f) {
    try {
      var grid = Utilities.parseCsv(String(f.text).replace(/^﻿/, ''));
      var kind = detectKind(grid);
      if (kind === 'results') {
        games = parseResults(grid);
        report.push('✓ ' + f.name + ' — ' + games.length + ' games');
      } else if (kind === 'teamstats') {
        var team = teamNameFromFile(f.name, knownTeams(ss, games));
        var rows = parseTeamStats(grid);
        teamBlocks.push({ team: team, rows: rows });
        report.push('✓ ' + f.name + ' — ' + rows.length + ' players → "' + team + '"');
      } else if (kind === 'leaders') {
        report.push('· ' + f.name + ' — leaders report, not needed (skipped)');
      } else {
        report.push('✗ ' + f.name + ' — format not recognized (skipped)');
      }
    } catch (e) {
      report.push('✗ ' + f.name + ' — ' + e.message);
    }
  });

  if (games) writeGames(ss, games);
  if (teamBlocks.length) writeStats(ss, teamBlocks);
  return report;
}

/* ---------------- pure parsing (no Sheets access) ---------------- */

function detectKind(grid) {
  if (!grid || !grid.length) return 'unknown';
  var r0 = grid[0].join(',');
  if (r0.indexOf('Home team name') !== -1) return 'results';
  if (r0.indexOf('First Name') !== -1 && r0.indexOf('Last Name') !== -1) return 'leaders';
  if (grid.length > 1 && grid[1][0] === 'Number' && grid[1][1] === 'Last' &&
      grid[1][2] === 'First') return 'teamstats';
  return 'unknown';
}

/* Results export -> [[iso date, team1, score1, team2, score2], ...] chronological */
function parseResults(grid) {
  var head = grid[0];
  function col(name) {
    var i = head.indexOf(name);
    if (i === -1) throw new Error('missing column "' + name + '"');
    return i;
  }
  var cTime = col('Game time'), cHome = col('Home team name'),
      cHs = col('Home team score'), cAway = col('Away team name'),
      cAs = col('Away team score');
  var out = [];
  for (var i = 1; i < grid.length; i++) {
    var r = grid[i];
    if (!r[cHome] || !r[cAway] || r[cHs] === '' || r[cAs] === '') continue;
    var key = sortableTime(r[cTime]);
    if (!key) continue;
    out.push({ key: key, row: [key.slice(0, 10), r[cHome], Number(r[cHs]), r[cAway], Number(r[cAs])] });
  }
  out.sort(function (a, b) { return a.key < b.key ? -1 : a.key > b.key ? 1 : 0; });
  return out.map(function (g) { return g.row; });
}

/* "5/16/2026, 10:00:00 AM EDT" -> "2026-05-16T10:00:00" (local, sortable) */
function sortableTime(s) {
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,\s*(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM))?/.exec(String(s).trim());
  if (!m) return null;
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var hh = 0, mi = 0, sec = 0;
  if (m[4]) {
    hh = Number(m[4]) % 12 + (m[7] === 'PM' ? 12 : 0);
    mi = Number(m[5]);
    sec = Number(m[6]);
  }
  return m[3] + '-' + pad(Number(m[1])) + '-' + pad(Number(m[2])) +
    'T' + pad(hh) + ':' + pad(mi) + ':' + pad(sec);
}

/* Team Season Stats export -> [{player, gp, pa, ab, h, r, rbi, d2, d3, hr,
   bb, k, sf, obe}, ...] — batting section only, glossary/blank rows skipped */
function parseTeamStats(grid) {
  var sections = grid[0], cols = grid[1];
  var end = sections.indexOf('Pitching');
  if (end === -1) end = cols.length;
  function col(name) {
    for (var i = 0; i < end; i++) if (cols[i] === name) return i;
    throw new Error('missing batting column "' + name + '"');
  }
  var idx = {
    gp: col('GP'), pa: col('PA'), ab: col('AB'), h: col('H'), r: col('R'),
    rbi: col('RBI'), d2: col('2B'), d3: col('3B'), hr: col('HR'),
    bb: col('BB'), k: col('SO'), sf: col('SF'), obe: col('ROE')
  };
  var out = [];
  for (var i = 2; i < grid.length; i++) {
    var row = grid[i];
    if (row[0] === 'Glossary') break;
    var name = ((row[2] || '') + ' ' + (row[1] || '')).replace(/\s+/g, ' ').trim();
    if (!name) continue;
    var p = { player: name };
    for (var k in idx) {
      var v = parseFloat(row[idx[k]]);
      p[k] = isFinite(v) ? v : 0;
    }
    out.push(p);
  }
  return out;
}

/* "Sugar Creek Summer 2026 Stats.csv" -> "Sugar Creek". Prefers a prefix
   match against team names already known from games/stats data. */
function teamNameFromFile(filename, known) {
  var base = String(filename).replace(/\.csv$/i, '').trim();
  var lower = base.toLowerCase();
  var best = '';
  (known || []).forEach(function (t) {
    if (lower.indexOf(t.toLowerCase()) === 0 && t.length > best.length) best = t;
  });
  if (best) return best;
  return base
    .replace(/\s+(spring|summer|fall|winter|autumn)\s+\d{4}[\s\S]*$/i, '')
    .replace(/\s+\d{4}[\s\S]*$/, '')
    .replace(/\s+stats[\s\S]*$/i, '')
    .trim();
}

/* ---------------- sheet I/O ---------------- */

function knownTeams(ss, parsedGames) {
  var names = {};
  function add(n) { if (n) names[String(n).trim()] = true; }
  (parsedGames || []).forEach(function (g) { add(g[1]); add(g[3]); });
  [GAMES_SHEET, STATS_SHEET].forEach(function (sheetName) {
    var sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow() < 2) return;
    var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
    vals.forEach(function (r) {
      if (sheetName === GAMES_SHEET) { add(r[1]); add(r[3]); } // Team1, Team2
      else add(r[0]);                                          // GCStats Team col
    });
  });
  return Object.keys(names);
}

function writeGames(ss, games) {
  var sh = ss.getSheetByName(GAMES_SHEET) || ss.insertSheet(GAMES_SHEET);
  sh.clearContents();
  var data = [GAMES_HEADER].concat(games);
  sh.getRange(1, 1, data.length, GAMES_HEADER.length).setValues(data);
}

function writeStats(ss, teamBlocks) {
  var sh = ss.getSheetByName(STATS_SHEET) || ss.insertSheet(STATS_SHEET);
  var uploaded = {};
  teamBlocks.forEach(function (b) { uploaded[b.team.toLowerCase()] = true; });

  var keep = [];
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, STATS_HEADER.length).getValues()
      .forEach(function (r) {
        if (r[0] !== '' && !uploaded[String(r[0]).toLowerCase()]) keep.push(r);
      });
  }
  var fresh = [];
  teamBlocks.forEach(function (b) {
    b.rows.forEach(function (p) {
      fresh.push([b.team, p.player, p.gp, p.pa, p.ab, p.h, p.r, p.rbi,
        p.d2, p.d3, p.hr, p.bb, p.k, p.sf, p.obe]);
    });
  });
  var data = [STATS_HEADER].concat(keep, fresh);
  sh.clearContents();
  sh.getRange(1, 1, data.length, STATS_HEADER.length).setValues(data);
}

/* ---------------- upload dialog ---------------- */

var DIALOG_HTML =
  '<!DOCTYPE html><html><head><base target="_top"><style>' +
  'body{font-family:Arial,sans-serif;font-size:13px;color:#272727;margin:14px}' +
  'button{background:#ad3c2f;color:#fff;border:0;border-radius:5px;padding:8px 18px;' +
  'font-size:13px;cursor:pointer;margin-top:10px}button:disabled{opacity:.5}' +
  '#out{margin-top:12px;line-height:1.6}#out div{border-bottom:1px solid #eee}' +
  '.hint{color:#75716d;font-size:12px}' +
  '</style></head><body>' +
  '<p>Select this week\'s GameChanger downloads — the league <b>Results</b> CSV ' +
  'and each team\'s <b>Season Stats</b> CSV. You can select them all at once; ' +
  'file types are detected automatically.</p>' +
  '<input type="file" id="f" multiple accept=".csv">' +
  '<br><button id="go">Import</button>' +
  '<div id="out"></div>' +
  '<script>' +
  'var go=document.getElementById("go"),out=document.getElementById("out");' +
  'go.onclick=function(){' +
  ' var fs=document.getElementById("f").files;' +
  ' if(!fs.length){out.textContent="Pick the CSV files first.";return}' +
  ' var reads=[];' +
  ' for(var i=0;i<fs.length;i++)(function(file){' +
  '  reads.push(new Promise(function(res){' +
  '   var r=new FileReader();' +
  '   r.onload=function(){res({name:file.name,text:r.result})};' +
  '   r.readAsText(file);}));' +
  ' })(fs[i]);' +
  ' go.disabled=true;out.textContent="Importing\\u2026";' +
  ' Promise.all(reads).then(function(payload){' +
  '  google.script.run.withSuccessHandler(function(report){' +
  '   go.disabled=false;' +
  '   out.innerHTML=report.map(function(l){return "<div>"+l+"</div>"}).join("")+' +
  '    "<p class=hint>Done. The website updates within ~5 minutes. " +' +
  '    "Player of the Week is still entered by hand on the POW tab.</p>";' +
  '  }).withFailureHandler(function(e){' +
  '   go.disabled=false;out.textContent="Error: "+e.message;' +
  '  }).importGcFiles(payload);' +
  ' });' +
  '};' +
  '</script></body></html>';
