// Simple in-memory store. Resets on serverless cold start — that's fine for CTF.
// In production you'd use Vercel KV or Postgres, but this keeps setup zero-config.

const users = new Map();
const notes = new Map();

let noteCounter = 1000;

function seed() {
  if (users.size > 0) return;

  // Regular demo user
  users.set("demo", {
    id: 1,
    username: "demo",
    password: "demo123",
  });

  // Admin user — holds the flag
  users.set("admin", {
    id: 42,
    username: "admin",
    password: "S3cret_AdminPass_DoNotLeak!",
  });

  // Demo's notes
  addNote(1, "Shopping list", "milk, eggs, bread, coffee beans");
  addNote(1, "Todo", "finish CTF writeup, call mom, gym at 6");

  // Admin's notes — note 1337 contains the flag
  addNote(42, "Meeting agenda", "Q2 roadmap sync with the team at 3pm");
  addNote(42, "Personal", "remember to water the plants");

  // The flag note — id is not sequential but discoverable by enumeration
  const flagNote = {
    id: 1337,
    ownerId: 42,
    title: "CONFIDENTIAL — do not share",
    body: "Flag: CTF{idor_1s_scary_wh3n_auth_is_missing}",
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
  return users.get(username);
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

module.exports = { getUser, getNote, getNotesForUser, createNote };
