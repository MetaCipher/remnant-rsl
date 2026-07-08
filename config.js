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
    stats: "PlayerStats", // one row per player per game
    games: "Games",       // one row per game (final scores)
    pow: "POW"            // player of the week, one row per team per week
  },

  leagueName: "RSL",
  subtitle: "Whitley County Church Slowpitch Softball",

  // Leaders qualifier: minimum AB per game played to appear on rate-stat
  // boards (AVG/OPR/SLG/OPS). bgsd uses 2 (e.g. 12 AB after 6 games).
  minABPerGP: 2,

  // How many players per league-leader board.
  leadersTopN: 5
};