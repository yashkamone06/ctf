const { executeLoginQuery } = require("../../../lib/db");
const { sign } = require("../../../lib/auth");

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }
  const { username = "", password = "" } = req.body || {};

  // VULNERABLE: builds the SQL by raw string concatenation. This is the
  // intentional SQL-injection sink for the CTF — do not "fix" it.
  const sql =
    "SELECT id, username FROM users " +
    "WHERE username='" + username + "' AND password='" + password + "'";

  let rows;
  try {
    rows = executeLoginQuery(sql);
  } catch (e) {
    // Leak the SQL error — classic hint that the input reaches a SQL engine.
    return res.status(500).json({
      error: "database error: " + e.message,
      query: sql,
    });
  }

  if (!rows.length) {
    return res.status(401).json({ error: "invalid credentials" });
  }

  const user = rows[0];
  const token = sign({ uid: user.id, username: user.username });
  res.setHeader(
    "Set-Cookie",
    `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200`
  );
  return res
    .status(200)
    .json({ ok: true, user: { id: user.id, username: user.username } });
}
