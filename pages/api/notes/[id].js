const { getNote } = require("../../../lib/db");
const { verifyFromReq } = require("../../../lib/auth");

// Vulnerable endpoint: authenticates the request but never checks
// whether the requested note actually belongs to the authenticated user.
// This is the IDOR. Swap `note.ownerId === session.uid` back in to fix it.
export default function handler(req, res) {
  const session = verifyFromReq(req);
  if (!session) return res.status(401).json({ error: "not authenticated" });

  const { id } = req.query;
  const note = getNote(id);
  if (!note) return res.status(404).json({ error: "note not found" });

  // MISSING: ownership check should be here.
  return res.status(200).json({
    id: note.id,
    title: note.title,
    body: note.body,
    ownerId: note.ownerId,
    createdAt: note.createdAt,
  });
}
