# CLAUDE.md — NoteVault CTF Knowledge Base

> **Read this before making any changes.** This file gives you the context you need to work on this repo correctly.

## ⚠️ CRITICAL: This app is INTENTIONALLY VULNERABLE

NoteVault is a **Capture The Flag (CTF) challenge** built to teach two web vulns: **SQL Injection** on login, and **Insecure Direct Object Reference (IDOR)** on note retrieval. The security flaws in this codebase are **features, not bugs**.

**Do NOT:**
- "Fix" the string-concatenated SQL in `pages/api/auth/login.js` (e.g. by parameterizing). It is the intended SQLi sink.
- Stop leaking SQL errors / the raw query back to the client — the error response is an intentional hint.
- "Fix" the missing authorization check in `pages/api/notes/[id].js`.
- Remove the `ownerId` field from note API responses (it's an intentional IDOR hint).
- Replace sequential integer note IDs with UUIDs unless explicitly asked.
- Hash/encrypt the passwords in `lib/db.js` without being asked — they need to be comparable by the vulnerable SQL query.
- Rotate or hide the flag string without being asked.

**If you see what looks like a security issue, assume it's intentional unless told otherwise.** Ask before patching.

## Project purpose

A deliberately vulnerable Next.js app that runs on Vercel's free tier. Two solve paths lead to the same flag:
- **SQLi** the login form (e.g. `admin' --`) to log in as admin, then read note `1337` directly.
- **Normal login** as `demo / demo123`, then exploit the IDOR on `/api/notes/{id}` to read note `1337`.

**The flag:** `BFHL_CTF{idor_1s_scary_wh3n_auth_is_missing}` (lives in `lib/db.js`, note ID `1337`).

**Flag format:** `BFHL_CTF{...}`. If asked to change the flag, keep this prefix unless the user says otherwise.

## Tech stack

- **Next.js 14** (Pages Router, not App Router) — chosen for simplicity and Vercel zero-config deploy
- **React 18** for the frontend
- **jsonwebtoken** for session tokens (HttpOnly cookie, HS256)
- **In-memory "database"** — an array of users + a `Map` of notes in `lib/db.js`, reseeded on cold start
- **Hand-rolled mini SQL evaluator** in `lib/db.js` — no `sqlite3`, no `sql.js`, no WASM. This is deliberate: it keeps the Vercel deploy zero-config, avoids native build steps, and makes the SQLi sink easy to understand. Supports just enough SQL (`=`, `AND`, `OR`, parens, string/number literals, `--` comments) to make classic injection payloads behave realistically.
- **No external services** — no Postgres, no Redis, no KV. This is deliberate so the challenge deploys in one click.

## File layout

```
notevault-ctf/
├── package.json              # deps: next, react, react-dom, jsonwebtoken
├── lib/
│   ├── db.js                 # in-memory store + vulnerable mini SQL evaluator
│   └── auth.js               # JWT sign/verify helpers, reads `session` cookie
├── pages/
│   ├── index.js              # login page
│   ├── dashboard.js          # notes list + viewer + "open by ID" input
│   └── api/
│       ├── auth/login.js     # POST, builds unsafe SQL string (VULNERABLE — SQLi)
│       └── notes/
│           ├── index.js      # GET, returns the current user's notes (safe)
│           └── [id].js       # GET, returns ANY note by ID (VULNERABLE — IDOR)
└── README.md                 # public-facing challenge description + solve paths
```

## Seeded data (in `lib/db.js`)

| User     | Password                       | User ID |
| -------- | ------------------------------ | ------- |
| `demo`   | `demo123`                      | 1       |
| `admin`  | `S3cret_AdminPass_DoNotLeak!`  | 42      |

Users are stored in an **array** (insertion order preserved) so that SQLi payloads like `' OR 1=1 --` return the first row (demo), matching real SQL behavior without an `ORDER BY`.

Notes are created with sequential IDs starting at `1001`, **except** the flag note which is hard-pinned to ID `1337` and owned by admin (user 42).

## The vulnerabilities (intentional)

### 1. SQL injection — `pages/api/auth/login.js`

```js
const sql =
  "SELECT id, username FROM users " +
  "WHERE username='" + username + "' AND password='" + password + "'";
const rows = executeLoginQuery(sql);
```

No parameterization, no escaping. The error handler also returns the SQL error message and the raw query string to the client — an intentional hint that the input reaches a SQL engine.

Classic payloads that work:
- Username `admin' --` → logs in as admin
- Username `' OR '1'='1' --` → logs in as demo (first row)
- Username `' OR 1=1 --` → same

### 2. IDOR — `pages/api/notes/[id].js`

```js
const note = getNote(id);
if (!note) return res.status(404).json({ error: "note not found" });
// MISSING: ownership check should be here.
return res.status(200).json({ ... });
```

The endpoint verifies **authentication** but never **authorization**. Any logged-in user can read any note by guessing or enumerating the ID.

### Hints that guide players to the solve

**SQLi path:**
1. Submitting `'` as the username triggers a "database error" response with the raw SQL query → obvious SQLi sink.
2. The error leaks the column list and table name → player knows what to inject against.

**IDOR path:**
1. The `ownerId` field is returned in the note API response — signals ownership is tracked server-side but not enforced.
2. Note IDs are sequential integers starting at 1001 → easy to enumerate.
3. The dashboard has an "Open note by ID" input so players can try IDs without Burp.
4. The flag note ID `1337` is a well-known hacker number → findable by guessing or brute force in the first ~2000 IDs.

**These are all intentional difficulty levers.** Removing them makes the challenge harder; add them back if you want it easier.

## Mini SQL evaluator (`executeLoginQuery` in `lib/db.js`)

A tiny recursive-descent evaluator. Understands:
- String literals: `'...'`
- Numeric literals: `1`, `42`
- Identifiers (column names on the current row): `username`, `password`, `id`
- Equality: `=` (compared as strings, so `'1' = 1` is truthy — matches loose SQL behavior)
- Booleans: `AND`, `OR` (case-insensitive, `AND` binds tighter than `OR`)
- Parentheses: `( ... )`
- Line comments: `--` (truncates rest of statement)
- Statement terminator: `;` (stops tokenization)

Anything else (`;` multi-statements, `UNION`, `JOIN`, `LIKE`, subqueries) is unsupported and raises a syntax error. That's fine for the intended payloads. If a future variant needs more, extend the evaluator rather than pulling in `sql.js` — the whole point is no WASM and no native deps.

## Common tasks

### Change the flag

Edit `lib/db.js`, find the object with `id: 1337`, update the `body` string. Keep the `BFHL_CTF{...}` format unless the user asks otherwise. Also update the README's solution paths so the writeup stays accurate.

### Make the challenge harder

Tunable knobs:
1. Remove the `query` field from the SQLi error response in `pages/api/auth/login.js` → players only see `"database error: …"`, not the raw SQL.
2. Drop `ownerId` from the note response in `pages/api/notes/[id].js` → players can't visually confirm IDOR.
3. Remove the "Open by ID" input from `pages/dashboard.js` → forces Burp / curl for IDOR.
4. Switch note IDs to UUIDs in `lib/db.js` → IDOR brute force becomes infeasible.
5. Randomize the flag note ID on seed → no "try 1337" shortcut.

### Make the challenge easier

1. Pin the flag note to a rounder ID like `1000` or `9999`.
2. Add a comment in the dashboard HTML hinting at sequential IDs.
3. Leak the admin's user ID somewhere visible.

### Add a new challenge variant

If asked to add a *different* vulnerability (JWT `alg:none`, SSTI, SSRF, prototype pollution, etc.), create it as a **new route** rather than modifying SQLi/IDOR. Keep the existing vulns intact unless explicitly told to remove them.

### Run / test locally

```bash
npm install
npm run dev       # http://localhost:3000
```

Smoke test after any change:
1. Normal login: `demo` / `demo123` → should succeed.
2. SQLi login: username `admin' --`, any password → should succeed as admin.
3. SQLi discovery: username `'`, any password → 500 response with `"database error: unterminated string literal"` and the raw `query` field.
4. Dashboard loads the signed-in user's notes.
5. Open note by ID `1337` as demo → returns flag (IDOR path).
6. Open note by ID `1337` as admin (via SQLi login) → returns flag in their own notes list.
7. Open note by ID `99999` → 404.
8. Without logging in, `curl /api/notes/1337` → 401.

### Deploy

Git push → Vercel auto-deploys (if GitHub integration is connected).
Manual: `vercel --prod` from repo root.

Environment variables: `JWT_SECRET` is optional. If not set, uses a dev default. For production CTFs, set it to a random string so sessions survive redeploys.

## State / persistence notes

The DB is **in-memory** and resets on Vercel cold starts. This is intentional for a CTF — keeps state clean across players. If you're ever asked to add persistence, use Vercel KV rather than introducing a real database dependency. Don't break zero-config deploy.

## Style / conventions

- CommonJS `require` in `lib/*.js` (matches what's already there)
- ES module `import`/`export` in `pages/*.js` (Next.js convention)
- Styled-jsx inline in page components (no Tailwind, no CSS modules)
- Keep dependencies minimal — every new dep slows down Vercel cold start, and we specifically avoid SQL engines (`sqlite3`, `better-sqlite3`, `sql.js`) to stay zero-config

## When in doubt

Ask the user before:
- Changing any security-relevant logic
- Adding persistence / databases / external services
- Upgrading Next.js major version
- Adding auth providers, OAuth, or password hashing
- Restructuring the file layout
- Swapping the hand-rolled SQL evaluator for a real SQL library

This is a teaching tool. Simplicity and transparency of the vulnerabilities matter more than code quality or production-readiness.
