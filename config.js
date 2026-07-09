/*
 * RSL Stats — league configuration.
 * This is the ONLY file that needs editing for normal operation.
 */
window.RSL_CONFIG = {
  // Google Sheet ID — the long string in the sheet's URL:
  // https://docs.google.com/spreadsheets/d/<THIS PART>/edit
  // The sheet must be shared as "Anyone with the link: Viewer".
  // Leave empty ("") to run in demo mode with sample data.
  sheetId: "1oT2FD3p2Aci7-jZ6vBUPLAnJEVfRW8eF7GuPXotz8XE",

  // Tab (worksheet) names inside the Google Sheet.
  tabs: {
    stats: "GCStats",             // season totals, filled by the GameChanger importer
    statsFallback: "PlayerStats", // used until GCStats exists (manual game-by-game log)
    games: "Games",               // one row per game (final scores)
    pow: "POW",                   // player of the week, one row per team per week
    meta: "Meta"                  // import stamp, written by the importer
  },

  leagueName: "RSL",
  subtitle: "Whitley County Church Slowpitch Softball",

  // Leaders qualifier: minimum at-bats to appear on rate-stat boards
  // (AVG/OBP/SLG/OPS). League rule as of 7/9/2026.
  leadersMinAB: 10,

  // How many players per league-leader board.
  leadersTopN: 5
};