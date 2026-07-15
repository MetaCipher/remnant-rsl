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
  leadersTopN: 5,

  // Combine duplicate roster entries. GameChanger sometimes lists one person
  // under two names; each entry here folds the `aliases` into the `master`
  // name. Their stats are added together and the rate stats (AVG/OBP/SLG/OPS)
  // are recomputed from the combined totals — not averaged. Team + names match
  // loosely (case, spaces, and periods are ignored), so "Luke N" and "Luke N."
  // are the same — but the spelling must still match the sheet (it says "Johny
  // J.", not "Johnny J."). GP is summed (fine unless one game is double-listed).
  // Add a line whenever a new split-name player shows up.
  mergePlayers: [
    { team: "Knights",     master: "Luke N.",    aliases: ["Luke"] },
    { team: "Nazarene",    master: "Collin C.",  aliases: ["Collin", "C Cripe"] },
    { team: "Sugar Creek", master: "Brandon G.", aliases: ["Brandon"] },
    { team: "Sugar Creek", master: "Johnny J.",  aliases: ["John", "Johny J."] },
    { team: "Sugar Creek", master: "Zachariah",  aliases: ["Zach"] },
    { team: "Sugar Creek", master: "Levi J.",    aliases: ["Levi"] }
  ],

  // Player names to drop entirely (GameChanger substitute/filler rows).
  // Matched case-insensitively; a token also catches a trailing "<token> Sub",
  // "<token> 2", etc., but not real names that merely start with those letters
  // ("Sub" ignores "Sub Sub" but keeps "Suber"; "New" ignores "New Player" but
  // keeps "Newton").
  ignorePlayers: ["Sub", "New"]
};