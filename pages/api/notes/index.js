const { getNotesForUser } = require("../../../lib/db");
const { verifyFromReq } = require("../../../lib/auth");

export default function handler(req, res) {
  const session = verifyFromReq(req);
  if (!session) return res.status(401).json({ error: "not authenticated" });
  const notes = getNotesForUser(session.uid).map((n) => ({
    id: n.id,
    title: n.title,
  }));
  return res.status(200).json({ user: session.username, notes });
}
