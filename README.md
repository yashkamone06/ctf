# NoteVault — SQLi + IDOR CTF Challenge

A deliberately vulnerable Next.js app for teaching **SQL Injection** on login and **Insecure Direct Object Reference (IDOR)** on note retrieval. Deploys to Vercel in one click.

## The challenge (for players)

> Sign in to NoteVault and find the flag. The login form happens to talk to a SQL-ish backend, and once you're inside, the notes API is... trusting. An admin has left a confidential note somewhere on the platform.
>
> A known low-privilege account exists (`demo` / `demo123`) in case you need a foothold, but the fastest path in may not need it.
>
> Flag format: `BFHL_CTF{...}`

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. (Optional) Set env var `JWT_SECRET` to any random string. Defaults to a dev value otherwise.
4. Deploy. Done.

That's it — no database, no external services. The app uses an in-memory store that's seeded on first request. The SQL engine is a tiny hand-rolled interpreter in `lib/db.js`, so there are zero native deps and nothing to install on Vercel beyond `npm install`.

## Local testing

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Intended solution path (for organizers)

There are two solve paths to the same flag:

### Path A — SQL injection on login (faster)

1. Player hits the login form. Submitting a `'` in the username returns a JSON error that leaks a SQL query and a "database error: …" message — the classic SQLi tell.
2. Player injects `admin' --` as the username (password can be anything). The built query becomes:

   ```sql
   SELECT id, username FROM users WHERE username='admin' --' AND password='x'
   ```

   The `--` comments out the password check. Player is logged in as admin.
3. Dashboard loads admin's notes, including note `142` — flag is right there.

Other payloads that work:
- `' OR '1'='1' --` — logs in as the first row (demo).
- `' OR 1=1 --` — same.

### Path B — Classic IDOR (original challenge)

1. Login normally as `demo` / `demo123`.
2. Dashboard shows demo's notes (IDs `1001`, `1002`). Opening a note calls `GET /api/notes/{id}` and the response leaks an `ownerId` field.
3. Player realizes they can request arbitrary IDs. The dashboard has an "Open note by ID" input.
4. Enumerate (`1`, `100`, `1000`, or brute-force `1..2000`). Note `142` belongs to admin and contains the flag.

```bash
# Example brute force once logged in
for i in {1..2000}; do
  curl -s -b "session=$TOKEN" "https://your-app.vercel.app/api/notes/$i" \
    | grep -o 'BFHL_CTF{[^}]*}' && echo "found at $i"
done
```

## The vulnerabilities

### 1. SQL injection — `pages/api/auth/login.js`

The login endpoint concatenates user-controlled input into a SQL string:

```js
const sql =
  "SELECT id, username FROM users " +
  "WHERE username='" + username + "' AND password='" + password + "'";
const rows = executeLoginQuery(sql);
```

There is no parameterization, no escaping, and the query error message is returned to the client. The backing engine (`executeLoginQuery` in `lib/db.js`) is a small hand-rolled evaluator that understands `= AND OR ( ) --` — enough to make classic injection payloads behave like they would against SQLite or MySQL.

### 2. IDOR — `pages/api/notes/[id].js`

```js
const note = getNote(id);
if (!note) return res.status(404).json({ error: "note not found" });

// MISSING: ownership check should be here.
return res.status(200).json({ ... });
```

The endpoint authenticates the session but never checks that `note.ownerId === session.uid`. Any authenticated user can read any note by ID.

## Fix (don't ship this to players)

```js
// Login — use a prepared statement / parameterized query.
const rows = executeLoginQuery(
  "SELECT id, username FROM users WHERE username=? AND password=?",
  [username, password]
);

// Notes — enforce ownership.
if (note.ownerId !== session.uid) {
  return res.status(403).json({ error: "forbidden" });
}
```

## Difficulty tuning

- **Easier:** Leave the `query` field in the SQLi error response so players can see exactly what they're injecting into.
- **Harder:** Drop the `query` field from the error response and only return a generic `"database error"` string. Remove the "Open by ID" input so IDOR requires Burp / curl.
- **Harder still:** Switch note IDs to UUIDs and remove sequential seeding so IDOR brute force is infeasible. Use bcrypt for passwords so even after SQLi the admin credential isn't trivially usable elsewhere.

## Notes on serverless state

Because Vercel functions are stateless, the in-memory DB resets on cold starts. For a CTF this is actually a feature — state stays clean. If you want persistence, swap `lib/db.js` to use Vercel KV.
