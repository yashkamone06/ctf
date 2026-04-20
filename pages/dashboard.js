import { useEffect, useState } from "react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [noteId, setNoteId] = useState("");

  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then(setData);
  }, []);

  async function openNote(id) {
    const r = await fetch(`/api/notes/${id}`);
    const j = await r.json();
    setSelected(j);
  }

  if (!data) return <p style={{ padding: 40 }}>Loading...</p>;
  if (data.error) return <p style={{ padding: 40 }}>Please <a href="/">log in</a>.</p>;

  return (
    <div className="wrap">
      <header>
        <h1>🔐 NoteVault</h1>
        <span>Signed in as <b>{data.user}</b></span>
      </header>

      <div className="grid">
        <div className="col">
          <h3>Your notes</h3>
          {data.notes.length === 0 && <p>No notes yet.</p>}
          <ul>
            {data.notes.map((n) => (
              <li key={n.id}>
                <button onClick={() => openNote(n.id)}>
                  #{n.id} — {n.title}
                </button>
              </li>
            ))}
          </ul>

          <h3 style={{ marginTop: 24 }}>Open note by ID</h3>
          <p className="hint">Quick lookup — type any note ID.</p>
          <div className="row">
            <input
              value={noteId}
              onChange={(e) => setNoteId(e.target.value)}
              placeholder="e.g. 1001"
            />
            <button onClick={() => openNote(noteId)}>Open</button>
          </div>
        </div>

        <div className="col">
          <h3>Viewer</h3>
          {!selected && <p>Pick a note on the left.</p>}
          {selected?.error && <p className="err">{selected.error}</p>}
          {selected?.body && (
            <div className="note">
              <h2>{selected.title}</h2>
              <p className="meta">Note #{selected.id} · owner {selected.ownerId}</p>
              <pre>{selected.body}</pre>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .wrap { max-width: 900px; margin: 40px auto; font-family: system-ui; padding: 0 20px; }
        header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 12px; margin-bottom: 24px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .col { background: #fff; padding: 20px; border-radius: 10px; border: 1px solid #eee; }
        ul { list-style: none; padding: 0; }
        li { margin: 6px 0; }
        li button { background: #f5f5f5; border: 1px solid #e0e0e0; padding: 8px 12px; border-radius: 6px; cursor: pointer; width: 100%; text-align: left; }
        li button:hover { background: #eee; }
        .row { display: flex; gap: 8px; }
        input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px; }
        .row button { padding: 8px 14px; background: #111; color: #fff; border: 0; border-radius: 6px; cursor: pointer; }
        .note { background: #fafafa; padding: 16px; border-radius: 8px; border: 1px solid #eee; }
        .meta { color: #888; font-size: 12px; margin: 0 0 12px; }
        pre { white-space: pre-wrap; font-family: inherit; }
        .hint { color: #888; font-size: 12px; }
        .err { color: #c00; }
        @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
