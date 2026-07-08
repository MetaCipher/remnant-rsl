/*
 * Tests the Apps Script GameChanger parsers (apps-script/Code.gs) against
 * real export files in sample/ (gitignored — tests auto-skip if absent).
 * Run: node tests/gc-import.test.cjs
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* Minimal CSV parser standing in for Apps Script's Utilities.parseCsv */
function parseCsv(text) {
  const rows = [[]];
  let cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { rows[rows.length - 1].push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      rows[rows.length - 1].push(cell); cell = '';
      rows.push([]);
    } else cell += c;
  }
  rows[rows.length - 1].push(cell);
  while (rows.length && rows[rows.length - 1].every(v => v === '')) rows.pop();
  return rows;
}

/* Load Code.gs with stubbed Apps Script globals */
const sandbox = {
  Utilities: { parseCsv },
  SpreadsheetApp: {}, HtmlService: {},
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8'), sandbox);

let passed = 0, skipped = 0;
function check(name, fn) { fn(); passed++; console.log('  ok - ' + name); }
function sampleGrid(file) {
  const p = path.join(__dirname, '../sample', file);
  if (!fs.existsSync(p)) return null;
  return parseCsv(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
}

check('teamNameFromFile strips season suffixes', () => {
  assert.strictEqual(sandbox.teamNameFromFile('Paladins Summer 2026 Stats.csv', []), 'Paladins');
  assert.strictEqual(sandbox.teamNameFromFile('Sugar Creek Summer 2026 Stats.csv', []), 'Sugar Creek');
  assert.strictEqual(sandbox.teamNameFromFile('Knights Fall 2027 Stats (3).csv', []), 'Knights');
});

check('teamNameFromFile prefers known-team prefix match', () => {
  const known = ['Sugar Creek', 'Sugar'];
  assert.strictEqual(sandbox.teamNameFromFile('Sugar Creek Summer 2026 Stats.csv', known), 'Sugar Creek');
});

check('sortableTime parses GC timestamps', () => {
  assert.strictEqual(sandbox.sortableTime('5/16/2026, 1:45:00 PM EDT'), '2026-05-16T13:45:00');
  assert.strictEqual(sandbox.sortableTime('12/3/2026, 12:05:00 AM EST'), '2026-12-03T00:05:00');
  assert.strictEqual(sandbox.sortableTime('garbage'), null);
});

check('dedupeTeamBlocks keeps last block per team', () => {
  const out = sandbox.dedupeTeamBlocks([
    { team: 'Paladins', rows: [1] },
    { team: 'Knights', rows: [2] },
    { team: 'paladins', rows: [3] }, // case-insensitive dupe, later wins
  ]);
  assert.strictEqual(out.length, 2);
  assert.deepStrictEqual(Array.from(out.find(b => b.team.toLowerCase() === 'paladins').rows), [3]);
});

const paladins = sampleGrid('Paladins Summer 2026 Stats.csv');
if (paladins) {
  check('detects team stats export', () => {
    assert.strictEqual(sandbox.detectKind(paladins), 'teamstats');
  });
  check('parses Paladins batting section', () => {
    const rows = sandbox.parseTeamStats(paladins);
    assert.strictEqual(rows.length, 13); // matches leaders-report roster count
    const aj = rows.find(r => r.player === 'Aj N.');
    assert.deepStrictEqual(
      [aj.gp, aj.pa, aj.ab, aj.h, aj.r, aj.rbi, aj.bb, aj.k, aj.sf, aj.obe],
      [8, 25, 24, 10, 9, 8, 1, 0, 0, 3]);
    assert.strictEqual(aj.d2, 4);
    assert.strictEqual(aj.hr, 1);
  });
} else skipped++;

const crusaders = sampleGrid('Crusaders Summer 2026 Stats.csv');
if (crusaders) {
  check('parses Crusaders with split First/Last names', () => {
    const rows = sandbox.parseTeamStats(crusaders);
    const alex = rows.find(r => r.player === 'Alex H.');
    assert.ok(alex, 'joins First + Last into "Alex H."');
    assert.strictEqual(alex.gp, 9);
    assert.strictEqual(alex.ab, 22);
    assert.ok(rows.every(r => r.player && r.player !== 'Glossary'));
  });
} else skipped++;

const results = sampleGrid('Remnant Softball League 2026-07-08 - Results.csv');
if (results) {
  check('detects and parses results export chronologically', () => {
    assert.strictEqual(sandbox.detectKind(results), 'results');
    const games = sandbox.parseResults(results);
    assert.ok(games.length >= 20, 'has a season of games, got ' + games.length);
    // Array.from: vm-sandbox arrays have a foreign prototype deepStrictEqual rejects
    const dates = Array.from(games, g => g[0]);
    assert.deepStrictEqual(dates, [...dates].sort(), 'chronological');
    const g1 = games.find(g => g[1] === 'Knights' && g[3] === 'Sliders' && g[0] === '2026-05-16');
    assert.deepStrictEqual(Array.from(g1), ['2026-05-16', 'Knights', 1, 'Sliders', 19]);
  });
} else skipped++;

const leaders = sampleGrid('Remnant Softball League Leaders Report 2026-07-08.csv');
if (leaders) {
  check('leaders report detected and would be skipped', () => {
    assert.strictEqual(sandbox.detectKind(leaders), 'leaders');
  });
} else skipped++;

console.log(`\n${passed} checks passed` + (skipped ? ` (${skipped} skipped: local sample files absent)` : ''));
