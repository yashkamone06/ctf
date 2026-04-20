const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "notevault-dev-secret-change-me";

function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "2h" });
}

function verifyFromReq(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  try {
    return jwt.verify(match[1], SECRET);
  } catch {
    return null;
  }
}

module.exports = { sign, verifyFromReq };
