/*
 * RSL Stats widget — fetches game-by-game data from a public Google Sheet
 * and renders team batting tables, standings, league leaders, and player
 * of the week. No dependencies. Requires rsl-compute.js loaded first.
 *
 * Usage: <div id="rsl-stats"></div> + window.RSL_CONFIG (see config.js).
 * The sheet must be shared "Anyone with the link: Viewer" — data is read
 * via Google's GViz endpoint, no API key needed.
 */
(function () {
  'use strict';
  var C = window.RSLCompute;

  /* ---------------- Google Sheets (GViz) fetch + parse ---------------- */

  function gvizUrl(sheetId, tab) {
    return 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheetId) +
      '/gviz/tq?tqx=out:json&headers=1&sheet=' + encodeURIComponent(tab);
  }

  function parseGviz(text) {
    var start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start < 0 || end < 0) throw new Error('Unexpected response from Google Sheets');
    var json = JSON.parse(text.slice(start, end + 1));
    if (json.status === 'error') {
      throw new Error((json.errors && json.errors[0] && json.errors[0].detail) || 'Sheet error');
    }
    var cols = (json.table.cols || []).map(function (c) { return normKey(c.label || c.id || ''); });
    return (json.table.rows || []).map(function (row) {
      var obj = {};
      (row.c || []).forEach(function (cell, i) {
        obj[cols[i]] = cellValue(cell);
      });
      return obj;
    });
  }

  function cellValue(cell) {
    if (!cell) return null;
    var v = cell.v;
    if (typeof v === 'string') {
      var m = /^Date\((\d+),(\d+),(\d+)/.exec(v);
      if (m) return isoDate(+m[1], +m[2] + 1, +m[3]);
      return v.trim();
    }
    return v;
  }

  function normKey(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function fetchTab(sheetId, tab) {
    return fetch(gvizUrl(sheetId, tab)).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' loading tab "' + tab + '"');
      return res.text();
    }).then(parseGviz);
  }

  /* ---------------- field aliases -> canonical row shapes ---------------- */

  function pick(obj, aliases) {
    for (var i = 0; i < aliases.length; i++) {
      if (obj[aliases[i]] !== undefined && obj[aliases[i]] !== null && obj[aliases[i]] !== '') {
        return obj[aliases[i]];
      }
    }
    return null;
  }

  function toNum(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  function isoDate(y, m, d) {
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function normDate(v) {
    if (v === null || v === undefined) return '';
    var s = String(v).trim();
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);           // 2026-05-09
    if (m) return isoDate(+m[1], +m[2], +m[3]);
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);           // 5/9/2026 or 5/9/26
    if (m) return isoDate(m[3].length === 2 ? 2000 + (+m[3]) : +m[3], +m[1], +m[2]);
    return s; // free-form ("Week 3") still sorts consistently as text
  }

  function shortDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? (+m[2]) + '/' + (+m[3]) : iso;
  }

  function adaptStats(rows) {
    return rows.map(function (r) {
      return {
        date: normDate(pick(r, ['date', 'week', 'gamedate'])),
        team: pick(r, ['team', 'teamname']) || '',
        player: pick(r, ['player', 'name', 'playername']) || '',
        ab: toNum(pick(r, ['ab', 'atbats'])),
        r: toNum(pick(r, ['r', 'runs'])),
        h: toNum(pick(r, ['h', 'hits'])),
        d2: toNum(pick(r, ['2b', 'd', 'doubles'])),
        d3: toNum(pick(r, ['3b', 't', 'triples'])),
        hr: toNum(pick(r, ['hr', 'homeruns'])),
        rbi: toNum(pick(r, ['rbi', 'rbis'])),
        bb: toNum(pick(r, ['bb', 'walks'])),
        k: toNum(pick(r, ['k', 'so', 'strikeouts'])),
        sf: toNum(pick(r, ['sf', 'sac', 'sacflies'])),
        obe: toNum(pick(r, ['obe', 'roe', 'onbaseerror', 'errors']))
      };
    }).filter(function (r) { return r.team && r.player; });
  }

  function adaptGames(rows) {
    return rows.map(function (r) {
      return {
        date: normDate(pick(r, ['date', 'week', 'gamedate'])),
        team1: pick(r, ['team1', 'hometeam', 'home', 'teama']) || '',
        score1: toNum(pick(r, ['score1', 'runs1', 'homescore', 'homeruns', 'scorea'])),
        team2: pick(r, ['team2', 'awayteam', 'away', 'visitor', 'teamb']) || '',
        score2: toNum(pick(r, ['score2', 'runs2', 'awayscore', 'awayruns', 'scoreb']))
      };
    }).filter(function (r) { return r.team1 && r.team2; });
  }

  function adaptPow(rows) {
    return rows.map(function (r) {
      return {
        date: normDate(pick(r, ['date', 'week'])),
        team: pick(r, ['team', 'teamname']) || '',
        player: pick(r, ['player', 'name', 'playername']) || '',
        note: pick(r, ['note', 'notes', 'comment', 'writeup']) || ''
      };
    }).filter(function (r) { return r.team && r.player; });
  }

  function adaptDemo(demo) {
    function zip(keys, arr) {
      return arr.map(function (vals) {
        var o = {};
        keys.forEach(function (k, i) { o[k] = vals[i]; });
        return o;
      });
    }
    return {
      stats: adaptStats(zip(['date', 'team', 'player', 'ab', 'r', 'h', '2b', '3b', 'hr', 'rbi', 'bb', 'k', 'sf', 'obe'], demo.stats)),
      games: adaptGames(zip(['date', 'team1', 'score1', 'team2', 'score2'], demo.games)),
      pow: adaptPow(zip(['date', 'team', 'player', 'note'], demo.pow))
    };
  }

  /* ---------------- formatting ---------------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt3(v) { // .667 style (softball convention), 1.050 for >= 1
    var s = v.toFixed(3);
    return s.replace(/^0\./, '.');
  }

  function fmt(v, kind) {
    if (v === null || v === undefined) return '';
    switch (kind) {
      case 'avg3': return fmt3(v);
      case 'dec1': return v.toFixed(1);
      case 'sdec1': return (v > 0 ? '+' : '') + v.toFixed(1);
      default: return String(Math.round(v));
    }
  }

  function teamAbbrev(name) {
    var words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.map(function (w) { return w[0]; }).join('').slice(0, 3).toUpperCase();
  }

  /* ---------------- column definitions ---------------- */

  var BATTING_COLS = [
    { key: 'player', label: 'Player', title: 'Player', text: true },
    { key: 'gp', label: 'GP', title: 'Games played' },
    { key: 'pa', label: 'PA', title: 'Plate appearances (AB + BB + SF)' },
    { key: 'ab', label: 'AB', title: 'At bats' },
    { key: 'h', label: 'H', title: 'Hits' },
    { key: 'r', label: 'R', title: 'Runs scored' },
    { key: 'rbi', label: 'RBI', title: 'Runs batted in' },
    { key: 'd2', label: '2B', title: 'Doubles' },
    { key: 'd3', label: '3B', title: 'Triples' },
    { key: 'hr', label: 'HR', title: 'Home runs' },
    { key: 'bb', label: 'BB', title: 'Walks' },
    { key: 'k', label: 'K', title: 'Strikeouts' },
    { key: 'sf', label: 'SF', title: 'Sacrifice flies' },
    { key: 'obe', label: 'OBE', title: 'On base by error' },
    { key: 'hg', label: 'H/G', title: 'Hits per game', fmt: 'dec1' },
    { key: 'opr', label: 'OPR', title: 'Offensive potency: (R + RBI) / AB', fmt: 'avg3' },
    { key: 'obp', label: 'OB%', title: 'On-base %: (H + BB + OBE) / (AB + BB)', fmt: 'avg3' },
    { key: 'avg', label: 'AVG', title: 'Batting average: H / AB', fmt: 'avg3' },
    { key: 'slg', label: 'SLG', title: 'Slugging: total bases / AB', fmt: 'avg3' },
    { key: 'ops', label: 'OPS', title: 'OB% + SLG', fmt: 'avg3' },
    { key: 'hs', label: 'HS', title: 'Current hitting streak (games)' },
    { key: 'lhs', label: 'LHS', title: 'Longest hitting streak (games)' }
  ];

  var STANDINGS_COLS = [
    { key: 'team', label: 'Team', title: 'Team', text: true },
    { key: 'gp', label: 'GP', title: 'Games played' },
    { key: 'w', label: 'W', title: 'Wins' },
    { key: 'l', label: 'L', title: 'Losses' },
    { key: 't', label: 'T', title: 'Ties' },
    { key: 'pct', label: 'PCT', title: 'Win % (ties count half)', fmt: 'avg3' },
    { key: 'rg', label: 'R/G', title: 'Runs scored per game', fmt: 'dec1' },
    { key: 'rag', label: 'RA/G', title: 'Runs allowed per game', fmt: 'dec1' },
    { key: 'rdg', label: 'RD/G', title: 'Run differential per game', fmt: 'sdec1' },
    { key: 'gb', label: 'GB', title: 'Games back', fmt: 'gb' },
    { key: 'lws', label: 'LWS', title: 'Longest win streak' },
    { key: 'ps', label: 'STRK', title: 'Current streak', text: true }
  ];

  /* ---------------- widget ---------------- */

  function init(container, config) {
    var state = {
      el: container,
      cfg: config || window.RSL_CONFIG || {},
      view: null,           // 'standings' | 'leaders' | 'team:<Name>'
      sort: { key: 'avg', dir: -1 },
      data: null,
      demo: false
    };

    container.innerHTML =
      '<div class="rsl"><div class="rsl-loading"><div class="rsl-spin"></div>Loading stats…</div></div>';

    var params = new URLSearchParams(window.location.search);
    var sheetId = params.get('sheet') || state.cfg.sheetId;

    var loaded;
    if (sheetId) {
      var tabs = state.cfg.tabs || {};
      loaded = Promise.all([
        fetchTab(sheetId, tabs.stats || 'PlayerStats'),
        fetchTab(sheetId, tabs.games || 'Games').catch(function () { return []; }),
        fetchTab(sheetId, tabs.pow || 'POW').catch(function () { return []; })
      ]).then(function (res) {
        return { stats: adaptStats(res[0]), games: adaptGames(res[1]), pow: adaptPow(res[2]) };
      });
    } else if (window.RSL_DEMO_DATA) {
      state.demo = true;
      loaded = Promise.resolve(adaptDemo(window.RSL_DEMO_DATA));
    } else {
      loaded = Promise.reject(new Error('No sheetId configured and no demo data available.'));
    }

    loaded.then(function (data) {
      state.data = compute(data, state.cfg);
      var v = params.get('view');
      state.view = validView(state, v) ? v : defaultView(state);
      render(state);
    }).catch(function (err) {
      container.innerHTML =
        '<div class="rsl"><div class="rsl-error"><strong>Couldn&#39;t load stats.</strong><br>' +
        esc(err.message || err) +
        '<br><span>Check that the Google Sheet is shared as &quot;Anyone with the link: Viewer&quot; ' +
        'and the tab names match the config.</span></div></div>';
    });
  }

  function compute(data, cfg) {
    var players = C.aggregatePlayers(data.stats);
    var standings = C.standings(data.games);
    var opts = { minABPerGP: cfg.minABPerGP != null ? cfg.minABPerGP : 2, topN: cfg.leadersTopN || 5 };
    var teams = standings.length
      ? standings.map(function (s) { return s.team; })
      : uniqueTeams(players);
    var through = '';
    data.stats.concat(data.games).forEach(function (r) {
      if (r.date && r.date > through) through = r.date;
    });
    return {
      players: players, standings: standings, pow: data.pow,
      teams: teams, opts: opts, through: through
    };
  }

  function uniqueTeams(players) {
    var seen = {}, out = [];
    players.forEach(function (p) {
      var k = p.team.toLowerCase();
      if (!seen[k]) { seen[k] = true; out.push(p.team); }
    });
    return out.sort();
  }

  function defaultView(state) {
    return state.data.standings.length ? 'standings' : 'team:' + (state.data.teams[0] || '');
  }

  function validView(state, v) {
    if (!v) return false;
    if (v === 'standings') return state.data.standings.length > 0;
    if (v === 'leaders') return true;
    if (v.indexOf('team:') === 0) {
      var name = v.slice(5).toLowerCase();
      return state.data.teams.some(function (t) { return t.toLowerCase() === name; });
    }
    return false;
  }

  /* ---------------- rendering ---------------- */

  function render(state) {
    var d = state.data, cfg = state.cfg;
    var html = '<div class="rsl">';

    html += '<header class="rsl-masthead"><div>' +
      '<h2 class="rsl-league">' + esc(cfg.leagueName || 'League Stats') + '</h2>' +
      '<div class="rsl-season">' + esc(cfg.seasonLabel || '') + '</div></div>';
    if (d.through) {
      html += '<div class="rsl-updated">Stats through <strong>' + esc(shortDate(d.through)) + '</strong></div>';
    }
    html += '</header>';

    html += '<nav class="rsl-tabs" role="tablist">';
    if (d.standings.length) html += tabBtn(state, 'standings', 'Standings');
    html += tabBtn(state, 'leaders', 'Leaders');
    d.teams.forEach(function (t) { html += tabBtn(state, 'team:' + t, t); });
    html += '</nav>';

    html += '<main class="rsl-body">';
    if (state.view === 'standings') html += renderStandings(state);
    else if (state.view === 'leaders') html += renderLeaders(state);
    else html += renderTeam(state, state.view.slice(5));
    html += '</main>';

    html += '<footer class="rsl-foot">';
    if (state.demo) {
      html += '<span class="rsl-demobadge">DEMO DATA</span> Sample data shown — set your Google Sheet ID in config.js.';
    } else {
      html += 'Updated automatically from the league scorekeeper&#39;s sheet.';
    }
    html += '</footer></div>';

    state.el.innerHTML = html;
    wireEvents(state);
  }

  function tabBtn(state, view, label) {
    var active = state.view === view || (view.indexOf('team:') === 0 && state.view.toLowerCase() === view.toLowerCase());
    return '<button type="button" role="tab" data-view="' + esc(view) + '" class="rsl-tab' +
      (active ? ' is-active' : '') + '" aria-selected="' + active + '">' + esc(label) + '</button>';
  }

  function sortableTable(cols, rows, sort, rankCol) {
    var html = '<div class="rsl-tablewrap"><table class="rsl-table"><thead><tr>';
    if (rankCol) html += '<th class="rsl-rank" aria-label="Rank"></th>';
    cols.forEach(function (c) {
      var is = sort && sort.key === c.key;
      html += '<th' + (c.text ? ' class="rsl-textcol"' : '') + '>' +
        '<button type="button" data-sort="' + c.key + '" title="' + esc(c.title) + '"' +
        (is ? ' class="is-sorted"' : '') + '>' + esc(c.label) +
        (is ? '<span class="rsl-caret">' + (sort.dir < 0 ? '▾' : '▴') + '</span>' : '') +
        '</button></th>';
    });
    html += '</tr></thead><tbody>';
    rows.forEach(function (row, i) {
      html += '<tr>';
      if (rankCol) html += '<td class="rsl-rank">' + (i + 1) + '</td>';
      cols.forEach(function (c) {
        var v = row[c.key];
        html += c.text
          ? '<td class="rsl-textcol">' + esc(v == null ? '' : v) + '</td>'
          : '<td>' + (c.fmt === 'gb' ? fmtGB(v) : fmt(v, c.fmt)) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function fmtGB(v) { return v <= 0 ? '—' : v.toFixed(1); }

  function sortRows(rows, sort) {
    var out = rows.slice();
    out.sort(function (a, b) {
      var av = a[sort.key], bv = b[sort.key], cmp;
      if (typeof av === 'string' || typeof bv === 'string') {
        cmp = String(av || '').localeCompare(String(bv || ''));
      } else {
        cmp = (av || 0) - (bv || 0);
      }
      cmp *= sort.dir; // direction applies to the sorted column only
      if (cmp === 0) cmp = (b.ab || 0) - (a.ab || 0);
      if (cmp === 0) cmp = String(a.player || a.team || '').localeCompare(String(b.player || b.team || ''));
      return cmp;
    });
    return out;
  }

  function renderStandings(state) {
    var html = '<h3 class="rsl-viewtitle">Team Standings</h3>';
    html += sortableTable(STANDINGS_COLS, state.data.standings, null, true);
    html += '<p class="rsl-legend">PCT counts ties as half a win · GB = games back · LWS = longest win streak · STRK = current streak</p>';
    return html;
  }

  function renderLeaders(state) {
    var boards = C.leagueLeaders(state.data.players, state.data.opts);
    if (!boards.length) return '<p class="rsl-empty">No stats yet — check back after the first games!</p>';
    var html = '<h3 class="rsl-viewtitle">League Leaders</h3><div class="rsl-boards">';
    boards.forEach(function (b) {
      html += '<section class="rsl-board"><h4>' + esc(b.label) +
        (b.qualifiedNote ? '<span class="rsl-qual">' + esc(b.qualifiedNote) + '</span>' : '') + '</h4><ol>';
      b.top.forEach(function (p) {
        html += '<li><span class="rsl-lname">' + esc(p.player) +
          ' <em>' + esc(teamAbbrev(p.team)) + '</em></span>' +
          '<span class="rsl-lval">' + fmt(p[b.key], b.fmt) + '</span></li>';
      });
      html += '</ol></section>';
    });
    html += '</div>';
    return html;
  }

  function renderTeam(state, teamName) {
    var d = state.data;
    var team = d.teams.filter(function (t) { return t.toLowerCase() === teamName.toLowerCase(); })[0] || teamName;
    var players = d.players.filter(function (p) { return p.team.toLowerCase() === team.toLowerCase(); });
    var rec = d.standings.filter(function (s) { return s.team.toLowerCase() === team.toLowerCase(); })[0];

    var html = '<div class="rsl-teamhead"><h3 class="rsl-viewtitle">' + esc(team) + '</h3>';
    if (rec) {
      html += '<div class="rsl-record">' + rec.w + '–' + rec.l + (rec.t ? '–' + rec.t : '') +
        ' <span>(' + fmt3(rec.pct) + ')</span></div>';
    }
    html += '</div>';

    // player of the week: latest entry for this team
    var pows = d.pow.filter(function (p) { return p.team.toLowerCase() === team.toLowerCase(); });
    pows.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (pows[0]) {
      html += '<div class="rsl-pow"><span class="rsl-pow-star">★</span><div>' +
        '<div class="rsl-pow-kicker">Player of the Week' +
        (pows[0].date ? ' · ' + esc(shortDate(pows[0].date)) : '') + '</div>' +
        '<div class="rsl-pow-name">' + esc(pows[0].player) + '</div>' +
        (pows[0].note ? '<div class="rsl-pow-note">' + esc(pows[0].note) + '</div>' : '') +
        '</div></div>';
    }

    var strip = C.teamLeaders(players, d.opts);
    if (strip.length) {
      html += '<div class="rsl-cards">';
      strip.forEach(function (c) {
        html += '<div class="rsl-card"><div class="rsl-card-stat">' + esc(c.label) + '</div>' +
          '<div class="rsl-card-val">' + fmt(c.player[c.key], c.fmt) + '</div>' +
          '<div class="rsl-card-name">' + esc(c.player.player) + '</div></div>';
      });
      html += '</div>';
    }

    if (players.length) {
      html += sortableTable(BATTING_COLS, sortRows(players, state.sort), state.sort);
      html += '<p class="rsl-legend">Tap a column to sort · OPR = (R+RBI)/AB · OB% = (H+BB+OBE)/(AB+BB) · HS/LHS = current/longest hitting streak</p>';
    } else {
      html += '<p class="rsl-empty">No player stats for ' + esc(team) + ' yet.</p>';
    }
    return html;
  }

  function wireEvents(state) {
    state.el.querySelectorAll('.rsl-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.view = btn.getAttribute('data-view');
        render(state);
      });
    });
    state.el.querySelectorAll('[data-sort]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.view.indexOf('team:') !== 0) return; // standings keep rank order
        var key = btn.getAttribute('data-sort');
        var textCol = key === 'player' || key === 'team';
        if (state.sort.key === key) state.sort.dir *= -1;
        else state.sort = { key: key, dir: textCol ? 1 : -1 };
        render(state);
      });
    });
  }

  /* ---------------- bootstrap ---------------- */

  window.RSLStats = { init: init };

  function autoInit() {
    var el = document.getElementById('rsl-stats');
    if (el) init(el, window.RSL_CONFIG);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
