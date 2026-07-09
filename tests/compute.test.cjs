/*
 * Verifies the compute engine against real published rows from
 * www.bgsd.com/softball/stats/2026/ch-church-L2-26.shtml (the reference
 * site this widget mimics). Run: node tests/compute.test.cjs
 */
const assert = require('assert');
const C = require('../assets/rsl-compute.js');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ok - ' + name);
}
function approx(a, b) { assert.strictEqual(a.toFixed(3), b.toFixed(3)); }

// --- bgsd published rows: [name, GP,PA,AB,H,R,RBI,2B,3B,HR,BB,K,SF,OBE, H/G,OPR,OB%,AVG,SLG,OPS]
const BGSD_ROWS = [
  ['Greg Breedlove', 2, 7, 6, 4, 3, 2, 0, 1, 0, 1, 0, 0, 0, 2.0, 0.833, 0.714, 0.667, 1.000, 1.714],
  ['Brett Nichols', 6, 24, 20, 13, 10, 11, 5, 0, 1, 3, 0, 1, 0, 2.2, 1.050, 0.696, 0.650, 1.050, 1.746],
  ['Grant Gannon', 6, 25, 25, 16, 13, 13, 7, 0, 1, 0, 0, 0, 1, 2.7, 1.040, 0.680, 0.640, 1.040, 1.720],
  ['Tyler Stevens', 4, 17, 15, 9, 6, 7, 2, 2, 0, 2, 0, 0, 0, 2.3, 0.867, 0.647, 0.600, 1.000, 1.647],
  ['Scott Danielson', 4, 12, 9, 5, 2, 3, 0, 0, 0, 3, 1, 0, 0, 1.3, 0.556, 0.667, 0.556, 0.556, 1.222],
  ['Mike Chevraux', 6, 22, 20, 10, 3, 9, 2, 0, 0, 1, 0, 1, 0, 1.7, 0.600, 0.524, 0.500, 0.600, 1.124],
  ['Chris Keller', 4, 14, 8, 4, 5, 3, 0, 0, 0, 6, 0, 0, 0, 1.0, 1.000, 0.714, 0.500, 0.500, 1.214],
];

console.log('deriveTotals vs bgsd published values:');
for (const row of BGSD_ROWS) {
  const [name, gp, pa, ab, h, r, rbi, d2, d3, hr, bb, k, sf, obe,
         hg, opr, obp, avg, slg, ops] = row;
  check(name, () => {
    const t = C.deriveTotals({ gp, ab, h, r, rbi, d2, d3, hr, bb, k, sf, obe });
    assert.strictEqual(t.pa, pa, 'PA');
    approx(t.avg, avg);
    approx(t.obp, obp);
    approx(t.slg, slg);
    approx(t.ops, ops);
    approx(t.opr, opr);
    assert.strictEqual(t.hg.toFixed(1), hg.toFixed(1), 'H/G');
  });
}

console.log('hitting streaks:');
check('streak broken by 0-fer, unaffected by walk-only game', () => {
  const s = C.hittingStreaks([
    { h: 2, ab: 4 }, { h: 1, ab: 3 }, { h: 0, ab: 3 }, // streak 2, broken
    { h: 1, ab: 4 }, { h: 0, ab: 0 }, { h: 3, ab: 4 }, // walk-only game keeps it alive
  ]);
  assert.strictEqual(s.lhs, 2); // hit game + walk-only + hit game = streak of 2
  assert.strictEqual(s.hs, 2);
});
check('current streak alive at season end', () => {
  const s = C.hittingStreaks([{ h: 0, ab: 4 }, { h: 1, ab: 4 }, { h: 2, ab: 4 }]);
  assert.deepStrictEqual({ hs: s.hs, lhs: s.lhs }, { hs: 2, lhs: 2 });
});

console.log('aggregatePlayers:');
check('sums lines and computes streaks chronologically', () => {
  const rows = [
    { date: '2026-05-16', team: 'A', player: 'Pat', ab: 4, h: 0, r: 1, rbi: 0, d2: 0, d3: 0, hr: 0, bb: 0, k: 1, sf: 0, obe: 0 },
    { date: '2026-05-09', team: 'A', player: 'Pat', ab: 3, h: 2, r: 2, rbi: 3, d2: 1, d3: 0, hr: 1, bb: 1, k: 0, sf: 1, obe: 0 },
  ];
  const [p] = C.aggregatePlayers(rows);
  assert.strictEqual(p.gp, 2);
  assert.strictEqual(p.ab, 7);
  assert.strictEqual(p.h, 2);
  assert.strictEqual(p.pa, 9); // 7 + 1 BB + 1 SF
  assert.strictEqual(p.lhs, 1); // hit on 5/9, 0-fer on 5/16
  assert.strictEqual(p.hs, 0);  // ...so current streak is dead
});

console.log('standings:');
check('records, pct, gb, streaks', () => {
  const games = [
    { date: '2026-05-09', team1: 'A', score1: 10, team2: 'B', score2: 5 },
    { date: '2026-05-09', team1: 'A', score1: 8, team2: 'B', score2: 8 },
    { date: '2026-05-16', team1: 'A', score1: 7, team2: 'C', score2: 6 },
    { date: '2026-05-16', team1: 'B', score1: 9, team2: 'C', score2: 2 },
  ];
  const s = C.standings(games);
  const A = s.find(t => t.team === 'A'), B = s.find(t => t.team === 'B'), Ct = s.find(t => t.team === 'C');
  assert.deepStrictEqual([A.w, A.l, A.t], [2, 0, 1]);
  assert.deepStrictEqual([B.w, B.l, B.t], [1, 1, 1]);
  assert.deepStrictEqual([Ct.w, Ct.l, Ct.t], [0, 2, 0]);
  approx(A.pct, (2 + 0.5) / 3);
  assert.strictEqual(s[0].team, 'A');
  assert.strictEqual(A.gb, 0);
  assert.strictEqual(B.gb, 1);       // ((2-1)+(1-0))/2
  assert.strictEqual(A.ps, '1W');
  assert.strictEqual(B.ps, '1W');
  assert.strictEqual(Ct.ps, '2L');
  assert.strictEqual(A.lws, 1);      // W T W -> longest pure win streak 1
});

console.log('leaders:');
check('qualifier excludes small-sample rate leaders but not counting stats', () => {
  const players = C.aggregatePlayers([
    { date: '1', team: 'A', player: 'Regular', ab: 12, h: 6, r: 4, rbi: 4, d2: 0, d3: 0, hr: 2, bb: 0, k: 0, sf: 0, obe: 0 },
    { date: '1', team: 'A', player: 'SmallSample', ab: 1, h: 1, r: 1, rbi: 1, d2: 0, d3: 0, hr: 1, bb: 0, k: 0, sf: 0, obe: 0 },
  ]);
  const boards = C.leagueLeaders(players, { minAB: 10, topN: 5 });
  const avg = boards.find(b => b.key === 'avg');
  assert.strictEqual(avg.top[0].player, 'Regular'); // SmallSample: 1 AB < 10 -> excluded
  assert.strictEqual(avg.top.length, 1);
  const hr = boards.find(b => b.key === 'hr');
  assert.strictEqual(hr.top.length, 2); // counting stat: both listed
});
check('rate-stat qualifier: fixed 10 AB minimum, exactly 10 qualifies', () => {
  const players = C.playersFromTotals([
    { team: 'A', player: 'Sub', gp: 2, ab: 7, h: 6, r: 1, rbi: 1, d2: 0, d3: 0, hr: 0, bb: 0, k: 0, sf: 0, obe: 0 },       // .857 in 7 AB
    { team: 'A', player: 'Edge', gp: 3, ab: 10, h: 9, r: 3, rbi: 3, d2: 0, d3: 0, hr: 0, bb: 0, k: 0, sf: 0, obe: 0 },     // .900 in 10 AB
    { team: 'A', player: 'Regular', gp: 9, ab: 20, h: 16, r: 5, rbi: 5, d2: 0, d3: 0, hr: 0, bb: 0, k: 0, sf: 0, obe: 0 }, // .800 in 20 AB
  ]);
  const boards = C.leagueLeaders(players, { minAB: 10, topN: 5 });
  const avg = boards.find(b => b.key === 'avg');
  assert.deepStrictEqual(avg.top.map(p => p.player), ['Edge', 'Regular']); // Sub (7 AB) excluded
  const obp = boards.find(b => b.key === 'obp');
  assert.ok(obp, 'OBP board exists (replaced OPR)');
  assert.ok(!boards.find(b => b.key === 'opr'), 'OPR board removed');
  const strip = C.teamLeaders(players, { minAB: 10 });
  assert.strictEqual(strip.find(c => c.label === 'AVG').player.player, 'Edge');
});

check('standings expose total run differential', () => {
  const s = C.standings([{ date: '1', team1: 'A', score1: 12, team2: 'B', score2: 5 }]);
  const A = s.find(t => t.team === 'A');
  assert.strictEqual(A.rf, 12);
  assert.strictEqual(A.ra, 5);
  assert.strictEqual(A.diff, 7);
});

check('playersFromTotals derives stats from season-total rows (GameChanger)', () => {
  // Aj N. from the real Paladins GameChanger export
  const [p] = C.playersFromTotals([{
    team: 'Paladins', player: 'Aj N.', gp: 8, pa: 25, ab: 24, h: 10, r: 9,
    rbi: 8, d2: 4, d3: 0, hr: 1, bb: 1, k: 0, sf: 0, obe: 3,
  }]);
  approx(p.avg, 0.417);            // GC agrees: .417
  approx(p.slg, 0.708);            // GC agrees: .708 (TB 17 / AB 24)
  approx(p.obp, (10 + 1 + 3) / (24 + 1)); // our bgsd formula (GC's own OBP differs)
  approx(p.opr, (9 + 8) / 24);
  assert.strictEqual(p.pa, 25);    // provided PA wins over AB+BB+SF
  assert.strictEqual(p.hs, undefined); // no streaks from totals
});
check('teamLeaders returns strip of best players', () => {
  const players = C.aggregatePlayers([
    { date: '1', team: 'A', player: 'Slugger', ab: 4, h: 3, r: 2, rbi: 5, d2: 0, d3: 0, hr: 2, bb: 0, k: 0, sf: 0, obe: 0 },
  ]);
  const strip = C.teamLeaders(players, { minAB: 10 });
  assert.ok(strip.find(c => c.label === 'HR').player.player === 'Slugger'); // counting stat: no AB gate
});

console.log('\n' + passed + ' checks passed');
