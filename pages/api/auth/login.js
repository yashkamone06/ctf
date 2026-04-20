const { getUser } = require("../../../lib/db");
const { sign } = require("../../../lib/auth");

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }
  const { username, password } = req.body || {};
  const user = getUser(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  const token = sign({ uid: user.id, username: user.username });
  res.setHeader(
    "Set-Cookie",
    `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200`
  );
  return res.status(200).json({ ok: true, user: { id: user.id, username: user.username } });
}
