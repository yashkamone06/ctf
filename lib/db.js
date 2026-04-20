// Simple in-memory store. Resets on serverless cold start — that's fine for CTF.
// Zero external deps keeps this deployable on Vercel's free tier with no config.

const users = []; // insertion-ordered so SQL injection behaves like a real DB
const notes = new Map();

let noteCounter = 1000;
let seeded = false;

function seed() {
  if (seeded) return;
  seeded = true;

  users.push({ id: 1, username: "demo", password: "demo123" });
  users.push({ id: 42, username: "admin", password: "S3cret_AdminPass_DoNotLeak!" });

  addNote(1, "Shopping list", "milk, eggs, bread, coffee beans");
  addNote(1, "Todo", "finish CTF writeup, call mom, gym at 6");

  addNote(42, "Meeting agenda", "Q2 roadmap sync with the team at 3pm");
  addNote(42, "Personal", "remember to water the plants");

  const flagNote = {
    id: 1337,
    ownerId: 42,
    title: "CONFIDENTIAL — do not share",
    body: "Flag: BFHL_CTF{idor_1s_scary_wh3n_auth_is_missing}",
    createdAt: new Date().toISOString(),
  };
  notes.set(1337, flagNote);
}

function addNote(ownerId, title, body) {
  noteCounter += 1;
  const note = {
    id: noteCounter,
    ownerId,
    title,
    body,
    createdAt: new Date().toISOString(),
  };
  notes.set(note.id, note);
  return note;
}

function getUser(username) {
  seed();
  return users.find((u) => u.username === username);
}

function getNote(id) {
  seed();
  return notes.get(Number(id));
}

function getNotesForUser(ownerId) {
  seed();
  return Array.from(notes.values()).filter((n) => n.ownerId === ownerId);
}

function createNote(ownerId, title, body) {
  seed();
  return addNote(ownerId, title, body);
}

// ---------------------------------------------------------------------------
// Intentionally-vulnerable mini SQL evaluator used by /api/auth/login.
//
// Supports just enough SQL to make classic injection payloads work:
//   SELECT ... FROM users WHERE <condition>
//
// Grammar for <condition>:
//   or   := and ("OR" and)*
//   and  := cmp ("AND" cmp)*
//   cmp  := term ("=" term)?
//   term := STRING | NUMBER | IDENT | "(" or ")"
// Line comments with "--" truncate the rest of the statement, matching SQL.
//
// Supported injection payloads (given the query built in login.js):
//   username = admin' --                 → logs in as admin
//   username = ' OR '1'='1' --           → logs in as first user (demo)
//   username = ' OR 1=1 --
//   username = x' OR username='admin' OR '1'='
// ---------------------------------------------------------------------------

function tokenizeWhere(src) {
  const commentIdx = src.indexOf("--");
  if (commentIdx !== -1) src = src.slice(0, commentIdx);

  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== "'") j++;
      if (j >= src.length) {
        throw new Error("unterminated string literal");
      }
      tokens.push({ t: "str", v: src.slice(i + 1, j) });
      i = j + 1;
    } else if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j).toLowerCase();
      if (word === "and" || word === "or") {
        tokens.push({ t: "kw", v: word });
      } else {
        tokens.push({ t: "id", v: word });
      }
      i = j;
    } else if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      tokens.push({ t: "num", v: Number(src.slice(i, j)) });
      i = j;
    } else if (ch === "=") {
      tokens.push({ t: "op", v: "=" });
      i++;
    } else if (ch === "(" || ch === ")") {
      tokens.push({ t: "paren", v: ch });
      i++;
    } else if (ch === ";") {
      break;
    } else {
      throw new Error(`unexpected character '${ch}'`);
    }
  }
  return tokens;
}

function evalWhere(tokens, row) {
  let p = 0;
  const peek = () => tokens[p];
  const take = () => tokens[p++];

  function parseOr() {
    let left = parseAnd();
    while (peek() && peek().t === "kw" && peek().v === "or") {
      take();
      const right = parseAnd();
      left = left || right;
    }
    return left;
  }
  function parseAnd() {
    let left = parseCmp();
    while (peek() && peek().t === "kw" && peek().v === "and") {
      take();
      const right = parseCmp();
      left = left && right;
    }
    return left;
  }
  function parseCmp() {
    const a = parseTerm();
    if (peek() && peek().t === "op" && peek().v === "=") {
      take();
      const b = parseTerm();
      return String(a) === String(b);
    }
    return Boolean(a);
  }
  function parseTerm() {
    const t = take();
    if (!t) throw new Error("unexpected end of input");
    if (t.t === "paren" && t.v === "(") {
      const v = parseOr();
      const close = take();
      if (!close || close.v !== ")") throw new Error("expected ')'");
      return v;
    }
    if (t.t === "str") return t.v;
    if (t.t === "num") return t.v;
    if (t.t === "id") return row[t.v] != null ? row[t.v] : null;
    throw new Error(`unexpected token near '${t.v}'`);
  }

  const result = parseOr();
  if (p < tokens.length) {
    throw new Error(`extra input near '${tokens[p].v}'`);
  }
  return result;
}

function executeLoginQuery(sql) {
  seed();
  const lower = sql.toLowerCase();
  const whereIdx = lower.indexOf("where");
  if (whereIdx === -1) throw new Error("missing WHERE clause");
  const whereClause = sql.slice(whereIdx + "where".length);
  const tokens = tokenizeWhere(whereClause);

  const results = [];
  for (const u of users) {
    if (evalWhere(tokens, u)) results.push(u);
  }
  return results;
}

module.exports = {
  getUser,
  getNote,
  getNotesForUser,
  createNote,
  executeLoginQuery,
};
