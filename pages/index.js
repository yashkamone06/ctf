import { useState } from "react";
import { useRouter } from "next/router";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (r.ok) {
      router.push("/dashboard");
      return;
    }
    const j = await r.json().catch(() => ({}));
    if (j.query) {
      setErr(`${j.error}\nquery: ${j.query}`);
    } else {
      setErr(j.error || "Invalid credentials");
    }
  }

  return (
    <div className="wrap">
      <h1>🔐 NoteVault</h1>
      <p className="sub">Your private, secure notes.</p>
      <form onSubmit={submit} className="card">
        <label>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="button" onClick={submit}>Sign in</button>
        {err && <p className="err">{err}</p>}
        <p className="hint">Demo account: <code>demo</code> / <code>demo123</code>. Happy hunting.</p>
      </form>
      <style jsx>{`
        .wrap { max-width: 420px; margin: 80px auto; font-family: system-ui; padding: 0 20px; }
        h1 { margin-bottom: 4px; }
        .sub { color: #666; margin-top: 0; }
        .card { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); border: 1px solid #eee; }
        label { display: block; font-size: 13px; color: #444; margin-top: 12px; }
        input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; margin-top: 4px; box-sizing: border-box; }
        button { margin-top: 16px; width: 100%; padding: 10px; background: #111; color: #fff; border: 0; border-radius: 6px; cursor: pointer; }
        .err { color: #c00; font-size: 12px; margin-top: 12px; white-space: pre-wrap; word-break: break-all; font-family: ui-monospace, Menlo, monospace; background: #fff5f5; border: 1px solid #fecaca; border-radius: 6px; padding: 8px; }
        .hint { color: #888; font-size: 12px; margin-top: 12px; }
      `}</style>
    </div>
  );
}
