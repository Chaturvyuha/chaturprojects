// Run with:
//   node migrate_add_userid.js             -> adds user_id column if missing
//   node migrate_add_userid.js username    -> adds column (if needed) and sets user_id for existing tasks to that username (if found)

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbFile = path.join(__dirname, 'data.db');
const usernameArg = process.argv[2]; // optional

const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Cannot open DB:', err.message);
    process.exit(1);
  }
});

// Helper: run sql as Promise
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

(async () => {
  try {
    const cols = await all("PRAGMA table_info(tasks);");
    const colNames = cols.map(c => c.name);
    if (colNames.includes('user_id')) {
      console.log('user_id column already exists in tasks.');
    } else {
      console.log('Adding user_id column to tasks...');
      await run('ALTER TABLE tasks ADD COLUMN user_id INTEGER;');
      console.log('user_id column added.');
    }

    if (usernameArg) {
      // Find user id
      const user = await get('SELECT id FROM users WHERE username = ?', [usernameArg]);
      if (!user) {
        console.error(`User not found with username="${usernameArg}". No tasks were assigned.`);
      } else {
        console.log(`Assigning existing tasks with NULL user_id to user id=${user.id} (${usernameArg})...`);
        const res = await run('UPDATE tasks SET user_id = ? WHERE user_id IS NULL', [user.id]);
        console.log('Update completed. Note: sqlite3 run() does not return affectedRows reliably; verify below.');
      }
    } else {
      console.log('No username provided; migration only added the column. Existing tasks keep NULL user_id.');
    }

    // Print current table columns for verification
    const newCols = await all("PRAGMA table_info(tasks);");
    console.log('Current tasks columns:', newCols.map(c => c.name).join(', '));

    console.log('Migration finished.');
  } catch (err) {
    console.error('Migration error:', err.message || err);
  } finally {
    db.close();
  }
})();