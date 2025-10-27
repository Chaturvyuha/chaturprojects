// Save/overwrite this file as server.js in your project root
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const cors = require('cors');

// Config
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_session_secret_change_me';
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 1 day

// Open (or create) SQLite database file
const dbFile = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Failed to open DB:', err);
    process.exit(1);
  }
  console.log('Opened SQLite DB at', dbFile);
});

// Promise wrappers for sqlite3
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
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

(async () => {
  // Create tables if they don't exist.
  // Note: If your existing users table had no "email" column, run the migration script provided below first.
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER, 
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      priority INTEGER DEFAULT 2,
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const app = express();

  // If you ever use the API from another origin, configure CORS properly.
  app.use(cors());

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // Sessions (store sessions in a separate SQLite DB file 'sessions.db')
  app.use(session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: __dirname,
      table: 'sessions'
    }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: SESSION_MAX_AGE,
      // secure: false for localhost; set true in production with HTTPS
      secure: false,
      httpOnly: true,
    }
  }));

  // Helper middleware
  function requireAuth(req, res, next) {
    if (req.session && req.session.userId) return next();
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // AUTH routes
  app.post('/auth/register', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'username and password required' });
      if (String(username).trim().length < 3) return res.status(400).json({ error: 'username must be at least 3 chars' });
      if (String(password).length < 6) return res.status(400).json({ error: 'password must be at least 6 chars' });

      const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
      if (existing) return res.status(400).json({ error: 'Username already taken' });

      const password_hash = await bcrypt.hash(password, 10);
      const result = await run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, password_hash]);
      const user = await get('SELECT id, username, created_at, email FROM users WHERE id = ?', [result.lastID]);

      // create session
      req.session.userId = user.id;
      req.session.username = user.username;

      res.status(201).json({ id: user.id, username: user.username, email: user.email || null });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'username and password required' });

      const user = await get('SELECT id, username, password_hash, email FROM users WHERE username = ?', [username]);
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

      req.session.userId = user.id;
      req.session.username = user.username;

      res.json({ id: user.id, username: user.username, email: user.email || null });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/auth/logout', (req, res) => {
    if (req.session) {
      req.session.destroy(err => {
        if (err) {
          console.error('Session destroy error:', err);
          return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  });

  app.get('/auth/me', async (req, res) => {
    if (req.session && req.session.userId) {
      const user = await get('SELECT id, username, created_at, email FROM users WHERE id = ?', [req.session.userId]);
      return res.json(user);
    } else {
      return res.status(200).json(null);
    }
  });

  // Change email
  app.post('/auth/change-email', requireAuth, async (req, res) => {
    try {
      const { newEmail } = req.body;
      if (!newEmail || String(newEmail).trim() === '') return res.status(400).json({ error: 'Email required' });

      const email = String(newEmail).trim().toLowerCase();
      // Basic email format check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      const existing = await get('SELECT id FROM users WHERE lower(email) = ?', [email]);
      if (existing && existing.id !== req.session.userId) {
        return res.status(400).json({ error: 'Email already in use' });
      }

      await run('UPDATE users SET email = ? WHERE id = ?', [email, req.session.userId]);
      res.json({ success: true, email });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Delete account (requires password confirmation)
  app.post('/auth/delete-account', requireAuth, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) return res.status(400).json({ error: 'Password required' });

      const user = await get('SELECT id, password_hash FROM users WHERE id = ?', [req.session.userId]);
      if (!user) return res.status(400).json({ error: 'User not found' });

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(400).json({ error: 'Incorrect password' });

      // Deleting the user will cascade-delete tasks because of the foreign key
      await run('DELETE FROM users WHERE id = ?', [user.id]);

      // destroy session
      req.session.destroy(err => {
        if (err) {
          console.error('Session destroy error after delete:', err);
          // still return success
        }
      });

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // TASKS API (protected)
  // Get all tasks (optionally ?completed=0|1, ?priority=1|2|3, ?search=...)
  app.get('/api/tasks', requireAuth, async (req, res) => {
    try {
      const { completed, priority, search } = req.query;
      let sql = 'SELECT * FROM tasks WHERE user_id = ?';
      const params = [req.session.userId];

      if (completed === '0' || completed === '1') {
        sql += ' AND completed = ?';
        params.push(completed);
      }
      if (priority === '1' || priority === '2' || priority === '3') {
        sql += ' AND priority = ?';
        params.push(priority);
      }
      if (search && String(search).trim() !== '') {
        sql += ' AND (title LIKE "%" || ? || "%" OR description LIKE "%" || ? || "%")';
        params.push(search, search);
      }

      sql += ' ORDER BY priority ASC, created_at DESC';
      const rows = await all(sql, params);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Create a task
  app.post('/api/tasks', requireAuth, async (req, res) => {
    try {
      const { title, description, due_date, priority } = req.body;
      if (!title || title.trim() === '') return res.status(400).json({ error: 'Title is required' });
      const result = await run(
        'INSERT INTO tasks (user_id, title, description, due_date, priority) VALUES (?, ?, ?, ?, ?)',
        [req.session.userId, title.trim(), description || null, due_date || null, priority || 2]
      );
      const task = await get('SELECT * FROM tasks WHERE id = ?', [result.lastID]);
      res.status(201).json(task);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Update task (full update)
  app.put('/api/tasks/:id', requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const task = await get('SELECT * FROM tasks WHERE id = ?', [id]);
      if (!task || task.user_id !== req.session.userId) return res.status(404).json({ error: 'Not found' });

      const { title, description, due_date, priority, completed } = req.body;
      await run(
        `UPDATE tasks SET title = ?, description = ?, due_date = ?, priority = ?, completed = ? WHERE id = ?`,
        [title, description, due_date, priority, completed ? 1 : 0, id]
      );
      const updated = await get('SELECT * FROM tasks WHERE id = ?', [id]);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Toggle completed
  app.patch('/api/tasks/:id/toggle', requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const task = await get('SELECT * FROM tasks WHERE id = ?', [id]);
      if (!task || task.user_id !== req.session.userId) return res.status(404).json({ error: 'Not found' });
      const newVal = task.completed ? 0 : 1;
      await run('UPDATE tasks SET completed = ? WHERE id = ?', [newVal, id]);
      const updated = await get('SELECT * FROM tasks WHERE id = ?', [id]);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Delete task
  app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const task = await get('SELECT * FROM tasks WHERE id = ?', [id]);
      if (!task || task.user_id !== req.session.userId) return res.status(404).json({ error: 'Not found' });
      await run('DELETE FROM tasks WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'DB error' });
    }
  });

  // Fallback to index.html for SPA behavior
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
})();