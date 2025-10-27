// Run this in the project root (D:\Beginning):
//   node debug_db.js
// It prints users & tasks schema and rows for quick diagnosis.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbFile = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Cannot open data.db:', err.message);
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
    console.log('--- PRAGMA table_info(users) ---');
    const usersCols = await all(db, "PRAGMA table_info(users);");
    console.log(usersCols);

    console.log('\\n--- PRAGMA table_info(tasks) ---');
    const tasksCols = await all(db, "PRAGMA table_info(tasks);");
    console.log(tasksCols);

    console.log('\\n--- users rows (id, username, email, created_at) ---');
    const users = await all(db, "SELECT id, username, email, created_at FROM users ORDER BY id;");
    console.log(users);

    console.log('\\n--- tasks rows (id, user_id, title, created_at) LIMIT 50 ---');
    const tasks = await all(db, "SELECT id, user_id, title, created_at FROM tasks ORDER BY created_at DESC LIMIT 50;");
    console.log(tasks);

    console.log('\\n--- counts: tasks per user_id ---');
    const counts = await all(db, "SELECT user_id, COUNT(*) AS cnt FROM tasks GROUP BY user_id;");
    console.log(counts);

    console.log('\\n--- PRAGMA foreign_keys ---');
    const fk = await all(db, "PRAGMA foreign_keys;");
    console.log(fk);

    console.log('\\n--- PRAGMA integrity_check ---');
    const ic = await all(db, "PRAGMA integrity_check;");
    console.log(ic);
  } catch (err) {
    console.error('Error reading DB:', err);
  } finally {
    db.close();
  }
})();