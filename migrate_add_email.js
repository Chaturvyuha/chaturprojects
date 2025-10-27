// Save this as migrate_add_email.js in your project root and run:
//    node migrate_add_email.js             -> adds email column if missing
//    node migrate_add_email.js user@example.com  -> also set that email for all existing users/tasks (optional)
//
// This script uses sqlite3 and the same data.db used by the app.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbFile = path.join(__dirname, 'data.db');
const newEmailArg = process.argv[2];

const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Cannot open DB:', err.message);
    process.exit(1);
  }
});

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
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
    const cols = await all("PRAGMA table_info(users);");
    const colNames = cols.map(c => c.name);
    if (colNames.includes('email')) {
      console.log('email column already exists in users.');
    } else {
      console.log('Adding email column to users table...');
      await run('ALTER TABLE users ADD COLUMN email TEXT;');
      console.log('email column added.');
    }

    if (newEmailArg) {
      // set email for all users that have NULL email (optional convenience)
      console.log(`Setting email="${newEmailArg}" for users with NULL email (careful: usually you want per-user emails).`);
      await run('UPDATE users SET email = ? WHERE email IS NULL', [newEmailArg]);
      console.log('Update finished.');
    }

    const newCols = await all("PRAGMA table_info(users);");
    console.log('Current users columns:', newCols.map(c => c.name).join(', '));
    console.log('Migration finished.');
  } catch (err) {
    console.error('Migration error:', err.message || err);
  } finally {
    db.close();
  }
})();