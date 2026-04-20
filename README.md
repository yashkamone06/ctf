# NoteVault — IDOR CTF Challenge

A deliberately vulnerable Next.js app for teaching **Insecure Direct Object Reference (IDOR)**. Deploys to Vercel in one click.

## The challenge (for players)

> Sign in to NoteVault with the demo account (`demo` / `demo123`). Somewhere on the platform, an admin has left a confidential note. Find the flag.
>
> Flag format: `CTF{...}`

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. (Optional) Set env var `JWT_SECRET` to any random string. Defaults to a dev value otherwise.
4. Deploy. Done.

That's it — no database, no external services. The app uses an in-memory store that's seeded on first request.

## Local testing

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Intended solution path (for organizers)

1. **Recon** — Player logs in as `demo`, sees their own notes with IDs like `1001`, `1002`.
2. **Inspect traffic** — Opening a note calls `GET /api/notes/{id}`. The response leaks an `ownerId` field.
3. **Hypothesis** — "What if I request an ID that isn't mine?"
4. **Exploit** — The dashboard has a "Open note by ID" input. Player enumerates: `1`, `100`, `1000`, or brute-forces a range. Or they just try `1337`, a classic hacker number.
5. **Flag** — Note `1337` belongs to admin (ownerId 42) and contains `CTF{idor_1s_scary_wh3n_auth_is_missing}`.

Enumeration tools players might use: Burp Intruder, ffuf, a 10-line curl loop.

```bash
# Example brute force
for i in {1..2000}; do
  curl -s -b "session=$TOKEN" "https://your-app.vercel.app/api/notes/$i" \
    | grep -o 'CTF{[^}]*}' && echo "found at $i"
done
```

## The vulnerability

File: `pages/api/notes/[id].js`

```js
const note = getNote(id);
if (!note) return res.status(404).json({ error: "note not found" });

// MISSING: ownership check should be here.
return res.status(200).json({ ... });
```

The endpoint authenticates the session but never checks that `note.ownerId === session.uid`. Classic IDOR.

## Fix (don't ship this to players)

```js
if (note.ownerId !== session.uid) {
  return res.status(403).json({ error: "forbidden" });
}
```

## Difficulty tuning

- **Easier:** Pin the flag note to ID `1000` or `9999` (rounder number, faster to guess).
- **Harder:** Remove the "Open by ID" input so players must intercept and modify requests with Burp. Also drop `ownerId` from the response so they can't visually confirm ownership leaks.
- **Harder still:** Use UUIDs instead of integers and leak one UUID through a side channel (e.g. a public "shared note" feature that mentions the admin's note UUID in metadata).

## Notes on serverless state

Because Vercel functions are stateless, the in-memory DB resets on cold starts. For a CTF this is actually a feature — state stays clean. If you want persistence, swap `lib/db.js` to use Vercel KV.
