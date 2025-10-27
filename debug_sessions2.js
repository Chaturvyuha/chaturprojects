// Save as debug_sessions2.js in project root (D:\Beginning)
// Run: node debug_sessions2.js
// This script prints the sessions table schema and parses the sess JSON for rows.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbFile = path.join(__dirname, 'sessions.db');
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Cannot open sessions.db (it may not exist):', err.message);
    process.exit(1);
  }
});

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

(async () => {
  try {
    console.log('--- PRAGMA table_info(sessions) ---');
    const cols = await all(db, "PRAGMA table_info(sessions);");
    console.log(cols);

    // Build a select list for available columns (we'll always request sid and sess if present)
    const colNames = cols.map(c => c.name);
    const want = [];
    if (colNames.includes('sid')) want.push('sid');
    if (colNames.includes('sess')) want.push('sess');
    // include any other columns (like 'expire' if present) to show with rows
    const extras = colNames.filter(n => !['sid','sess'].includes(n));
    const selectCols = want.concat(extras).join(', ');

    if (!want.length) {
      console.error('sessions table does not contain sid or sess columns. Schema:', colNames);
      process.exit(1);
    }

    console.log('\\n--- sessions rows (top 50) ---');
    const rows = await all(db, `SELECT ${selectCols} FROM sessions LIMIT 50;`);
    for (const r of rows) {
      let parsed = null;
      if (r.sess) {
        try {
          parsed = JSON.parse(r.sess);
        } catch (e) {
          parsed = '<<unparseable sess>>';
        }
      }
      // show a small summary
      const info = parsed && typeof parsed === 'object' ? { userId: parsed.userId, username: parsed.username } : parsed;
      const out = { ...r };
      out.sess_parsed = info;
      // hide full sess text to keep output readable
      if (out.sess) out.sess = '<<hidden>>';
      console.log(out);
    }
  } catch (err) {
    console.error('Error reading sessions DB:', err);
  } finally {
    db.close();
  }
})();