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

  /* Season-totals rows (GCStats tab, from GameChanger exports) */
  function isTotalsFormat(rawRows) {
    return rawRows.some(function (r) {
      return r.gp !== undefined || r.gamesplayed !== undefined;
    });
  }

  function adaptTotals(rows) {
    return rows.map(function (r) {
      return {
        team: pick(r, ['team', 'teamname']) || '',
        player: pick(r, ['player', 'name', 'playername']) || '',
        gp: toNum(pick(r, ['gp', 'gamesplayed'])),
        pa: toNum(pick(r, ['pa', 'plateappearances'])),
        ab: toNum(pick(r, ['ab', 'atbats'])),
        h: toNum(pick(r, ['h', 'hits'])),
        r: toNum(pick(r, ['r', 'runs'])),
        rbi: toNum(pick(r, ['rbi', 'rbis'])),
        d2: toNum(pick(r, ['2b', 'doubles'])),
        d3: toNum(pick(r, ['3b', 'triples'])),
        hr: toNum(pick(r, ['hr', 'homeruns'])),
        bb: toNum(pick(r, ['bb', 'walks'])),
        k: toNum(pick(r, ['k', 'so', 'strikeouts'])),
        sf: toNum(pick(r, ['sf', 'sac', 'sacflies'])),
        obe: toNum(pick(r, ['obe', 'roe', 'onbaseerror']))
      };
    });
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

  /* Meta tab: Key/Value rows written by the importer ("LastUpdated"). */
  function adaptMeta(rows) {
    for (var i = 0; i < rows.length; i++) {
      var key = normKey(pick(rows[i], ['key']) || '');
      if (key === 'lastupdated') return normDate(pick(rows[i], ['value']));
    }
    return '';
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
      case 'sint': return (v > 0 ? '+' : '') + Math.round(v);
      default: return String(Math.round(v));
    }
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
    { key: 'obp', label: 'OBP', title: 'On-base %: (H + BB + OBE) / (AB + BB)', fmt: 'avg3' },
    { key: 'avg', label: 'AVG', title: 'Batting average: H / AB', fmt: 'avg3' },
    { key: 'slg', label: 'SLG', title: 'Slugging: total bases / AB', fmt: 'avg3' },
    { key: 'ops', label: 'OPS', title: 'OB% + SLG', fmt: 'avg3' }
  ];

  var STANDINGS_COLS = [
    { key: 'team', label: 'Team', title: 'Team', text: true },
    { key: 'w', label: 'W', title: 'Wins' },
    { key: 'l', label: 'L', title: 'Losses' },
    { key: 't', label: 'T', title: 'Ties' },
    { key: 'pct', label: 'PCT', title: 'Win % (ties count half)', fmt: 'avg3' },
    { key: 'rf', label: 'RS', title: 'Total runs scored' },
    { key: 'ra', label: 'RA', title: 'Total runs allowed' },
    { key: 'diff', label: 'DIFF', title: 'Run differential', fmt: 'sint' },
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
      teamMode: 'table',    // 'table' | 'cards' — batting stats presentation
      sort: { key: 'player', dir: 1 },
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
      var statsTab = tabs.stats || 'PlayerStats';
      var statsFetch = fetchTab(sheetId, statsTab).then(function (rows) {
        if (!rows.length) throw new Error('tab "' + statsTab + '" is empty');
        return rows;
      });
      if (tabs.statsFallback && tabs.statsFallback !== statsTab) {
        statsFetch = statsFetch.catch(function () {
          return fetchTab(sheetId, tabs.statsFallback);
        });
      }
      loaded = Promise.all([
        statsFetch,
        fetchTab(sheetId, tabs.games || 'Games').catch(function () { return []; }),
        fetchTab(sheetId, tabs.pow || 'POW').catch(function () { return []; }),
        fetchTab(sheetId, tabs.meta || 'Meta').catch(function () { return []; })
      ]).then(function (res) {
        // stats tab may hold season totals (GCStats, from GameChanger
        // exports) or a game-by-game log (PlayerStats) — detect by shape
        var totals = isTotalsFormat(res[0]);
        var gamelog = totals ? [] : adaptStats(res[0]);
        return {
          players: totals ? C.playersFromTotals(adaptTotals(res[0])) : C.aggregatePlayers(gamelog),
          gamelogRows: gamelog,
          games: adaptGames(res[1]),
          pow: adaptPow(res[2]),
          lastUpdated: adaptMeta(res[3])
        };
      });
    } else if (window.RSL_DEMO_DATA) {
      state.demo = true;
      var demo = adaptDemo(window.RSL_DEMO_DATA);
      loaded = Promise.resolve({
        players: C.aggregatePlayers(demo.stats),
        gamelogRows: demo.stats,
        games: demo.games,
        pow: demo.pow
      });
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
    var players = data.players;
    var standings = C.standings(data.games);
    var opts = {
      minAB: cfg.leadersMinAB != null ? cfg.leadersMinAB : 10,
      topN: cfg.leadersTopN || 5
    };
    var names = {}; // union of teams seen in games + stats, alphabetical
    standings.forEach(function (s) { names[s.team.toLowerCase()] = s.team; });
    players.forEach(function (p) {
      if (!names[p.team.toLowerCase()]) names[p.team.toLowerCase()] = p.team;
    });
    var teams = Object.keys(names).map(function (k) { return names[k]; }).sort(function (a, b) {
      return a.localeCompare(b);
    });
    var through = '';
    data.gamelogRows.concat(data.games).forEach(function (r) {
      if (r.date && r.date > through) through = r.date;
    });
    return {
      players: players, standings: standings, pow: data.pow,
      teams: teams, opts: opts, through: through,
      lastUpdated: data.lastUpdated || ''
    };
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

  function yearOf(iso) {
    var m = /^(\d{4})-/.exec(iso);
    return m ? m[1] : '';
  }

  /* Builds the persistent shell (masthead + tabs + empty body) exactly once;
     view/sort changes only re-render the body, so the tab strip's horizontal
     scroll position survives clicking a team pill. */
  function render(state) {
    var d = state.data, cfg = state.cfg;
    var html = '<div class="rsl">';

    html += '<header class="rsl-masthead"><div>' +
      '<h2 class="rsl-league">' + esc(cfg.leagueName || 'League Stats') + '</h2>' +
      (cfg.subtitle ? '<div class="rsl-season">' + esc(cfg.subtitle) + '</div>' : '') +
      '</div>';
    // prefer the sheet's import stamp; fall back to the latest game date
    var stamp = d.lastUpdated || d.through;
    var stampLabel = d.lastUpdated ? 'Updated' : 'Stats through';
    if (stamp) {
      html += '<div class="rsl-updated">' + stampLabel + ' <strong>' + esc(shortDate(stamp)) + '</strong>' +
        (yearOf(stamp) ? '<div class="rsl-year">' + yearOf(stamp) + '</div>' : '') +
        '</div>';
    }
    html += '</header>';

    html += '<nav class="rsl-tabs" role="tablist">';
    if (d.standings.length) html += tabBtn(state, 'standings', 'Standings');
    html += tabBtn(state, 'leaders', 'Leaders');
    d.teams.forEach(function (t) { html += tabBtn(state, 'team:' + t, t); });
    html += '</nav>';

    html += '<main class="rsl-body"></main>';

    if (state.demo) {
      html += '<footer class="rsl-foot"><span class="rsl-demobadge">DEMO DATA</span> ' +
        'Sample data shown — set your Google Sheet ID in config.js.</footer>';
    }
    html += '</div>';

    state.el.innerHTML = html;

    state.el.querySelectorAll('.rsl-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.view = btn.getAttribute('data-view');
        state.el.querySelectorAll('.rsl-tab').forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on);
        });
        renderBody(state);
      });
    });

    renderBody(state);
  }

  function renderBody(state) {
    var body = state.el.querySelector('.rsl-body');
    var wrap = body.querySelector('.rsl-tablewrap');
    var keepX = wrap ? wrap.scrollLeft : 0;
    var doc = document.scrollingElement || document.documentElement;
    var keepY = doc.scrollTop;

    if (state.view === 'standings') body.innerHTML = renderStandings(state);
    else if (state.view === 'leaders') body.innerHTML = renderLeaders(state);
    else body.innerHTML = renderTeam(state, state.view.slice(5));

    doc.scrollTop = keepY;
    var newWrap = body.querySelector('.rsl-tablewrap');
    if (newWrap) newWrap.scrollLeft = keepX;

    body.querySelectorAll('[data-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-mode');
        if (mode !== state.teamMode) {
          state.teamMode = mode;
          renderBody(state);
        }
      });
    });
    body.querySelectorAll('[data-sort]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (state.view.indexOf('team:') !== 0) return; // standings keep rank order
        var key = btn.getAttribute('data-sort');
        var textCol = key === 'player' || key === 'team';
        if (state.sort.key === key) state.sort.dir *= -1;
        else state.sort = { key: key, dir: textCol ? 1 : -1 };
        renderBody(state);
      });
    });
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
    return html;
  }

  function renderLeaders(state) {
    var boards = C.leagueLeaders(state.data.players, state.data.opts);
    if (!boards.length) return '<p class="rsl-empty">No stats yet — check back after the first games!</p>';
    var html = '<h3 class="rsl-viewtitle">League Leaders</h3><div class="rsl-boards">';
    boards.forEach(function (b) {
      html += '<section class="rsl-board"><h4>' + esc(b.label) +
        (b.qualifiedNote ? '<span class="rsl-qual">' + esc(b.qualifiedNote) + '</span>' : '') + '</h4><ol>';
      var prevVal = null, prevRank = 0;
      b.top.forEach(function (p, i) {
        var val = fmt(p[b.key], b.fmt);
        var rank = val === prevVal ? prevRank : i + 1; // ties share a rank
        prevVal = val; prevRank = rank;
        html += '<li><span class="rsl-lrank">' + rank + '</span>' +
          '<span class="rsl-lname">' + esc(p.player) +
          ' <em>' + esc(p.team) + '</em></span>' +
          '<span class="rsl-lval">' + val + '</span></li>';
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
      var cards = state.teamMode === 'cards';
      html += '<div class="rsl-tablebar"><div class="rsl-viewtoggle" role="group" aria-label="Stats view">' +
        '<button type="button" data-mode="table" aria-pressed="' + !cards + '"' +
        (cards ? '' : ' class="is-on"') + '>Table</button>' +
        '<button type="button" data-mode="cards" aria-pressed="' + cards + '"' +
        (cards ? ' class="is-on"' : '') + '>Cards</button>' +
        '</div></div>';
      html += cards
        ? renderPlayerCards(players)
        : sortableTable(BATTING_COLS, sortRows(players, state.sort), state.sort);
    } else {
      html += '<p class="rsl-empty">No player stats for ' + esc(team) + ' yet.</p>';
    }
    return html;
  }

  function plural(n, word, pluralWord) {
    return n + ' ' + (n === 1 ? word : (pluralWord || word + 's'));
  }

  /* Plain-language per-player cards, alphabetical for easy name lookup */
  function renderPlayerCards(players) {
    var list = players.slice().sort(function (a, b) {
      return a.player.localeCompare(b.player);
    });
    var html = '<div class="rsl-pcards">';
    list.forEach(function (p) {
      var chips = [];
      if (p.hr) chips.push(plural(p.hr, 'home run'));
      if (p.d3) chips.push(plural(p.d3, 'triple'));
      if (p.d2) chips.push(plural(p.d2, 'double'));
      chips.push(plural(p.r, 'run') + ' scored');
      chips.push(plural(p.rbi, 'run') + ' batted in');
      if (p.bb) chips.push(plural(p.bb, 'walk'));
      if (p.k) chips.push(plural(p.k, 'strikeout'));
      html += '<div class="rsl-pcard">' +
        '<div class="rsl-pcard-top"><span class="rsl-pcard-name">' + esc(p.player) + '</span>' +
        '<span class="rsl-pcard-avg">' + fmt3(p.avg) + '<em>batting avg</em></span></div>' +
        '<div class="rsl-pcard-line">' + p.h + '-for-' + p.ab + ' at the plate across ' +
        plural(p.gp, 'game') + '</div>' +
        '<div class="rsl-pcard-chips">' + chips.map(function (c) {
          return '<span>' + esc(c) + '</span>';
        }).join('') + '</div>' +
        (p.ab + p.bb > 0
          ? '<div class="rsl-pcard-ob">On base ' + Math.round(p.obp * 100) + '% of the time</div>'
          : '') +
        '</div>';
    });
    return html + '</div>';
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
