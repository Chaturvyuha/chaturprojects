# Todo Manager

Simple Node + Express + SQLite todo manager with session auth.

## Quick start (local)

1. Install:
   npm install

2. Start:
   npm start

3. Open in browser:
   http://localhost:3000

## Notes
- Uses SQLite (data.db). Do NOT commit `data.db` to source control.
- Session store is `sessions.db`. Do NOT commit that either.
- Configure `SESSION_SECRET` via environment variables in production.

## Helpful scripts
- `node migrate_add_email.js` — add `email` column to users if missing.
- `node migrate_add_userid.js` — add `user_id` column to tasks if missing.
- `node reset_accounts.js` — delete all users/tasks (creates backups).
- `node debug_db.js` / `node debug_sessions2.js` — debug helpers.

## Deploy
- For production, set `SESSION_SECRET` and enable HTTPS/secure cookies.