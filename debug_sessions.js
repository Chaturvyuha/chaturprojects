// Run this in the project root (D:\Beginning):
//   node debug_sessions.js
// It prints recent session rows (sid, expiry) and the decoded sess JSON (userId/username snippet).

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbFile = path.join(__dirname, 'sessions.db');
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Cannot open sessions.db (it may not exist):', err.message);
    process.exit(1);
  }
});

db.all("SELECT sid, sess, expire FROM sessions ORDER BY expire DESC LIMIT 20;", [], (err, rows) => {
  if (err) {
    console.error('Error reading sessions table:', err);
    db.close();
    return;
  }
  console.log('sessions rows (sid, expire, sess JSON snippet):');
  rows.forEach(r => {
    let parsed = null;
    try {
      parsed = JSON.parse(r.sess);
    } catch (e) {
      parsed = '<<unparseable sess>>';
    }
    const info = parsed && typeof parsed === 'object' ? { userId: parsed.userId, username: parsed.username } : parsed;
    console.log({ sid: r.sid, expire: r.expire, info });
  });
  db.close();
});