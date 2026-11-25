export default function Privacy({ history, stickerCount, usageCount, onClearHistory, onClearStickers, onClearAll }) {
  const ask = (msg, fn) => () => window.confirm(msg) && fn();
  return (
    <main className="privacy">
      <section className="tile">
        <b>🔒 Your memes stay on your device</b>
        <span>
          MemeGen has no accounts and no server. Your photos, stickers and memes are processed inside your own browser and are never uploaded or shown to anyone else.
          What you make is saved only in this browser on this computer, so someone using another laptop sees none of it. If you share a computer or browser profile, use the buttons below to clear it.
        </span>
      </section>

      <div className="clear-row">
        <button className="btn" onClick={ask("Clear your recent memes and template history on this device?", onClearHistory)}>Clear history</button>
        <button className="btn" onClick={ask("Delete all your saved stickers on this device?", onClearStickers)}>Delete my stickers</button>
        <button className="btn danger" onClick={ask("Erase everything MemeGen has stored on this device?", onClearAll)}>Erase everything</button>
      </div>
      <p className="note small">Stored here: {history.length} recent meme{history.length === 1 ? "" : "s"}, {stickerCount} sticker{stickerCount === 1 ? "" : "s"}, usage for {usageCount} template{usageCount === 1 ? "" : "s"} (used for your recommendations).</p>

      <h3 className="sec">Recent memes</h3>
      {history.length === 0 && <p className="note">Nothing here yet. Memes you download or copy will show up here, on this device only.</p>}
      <div className="grid">
        {history.map((h) => (
          <div key={h.id} className="card sticker-card">
            <img src={h.thumb} alt={h.name} />
            <span>{h.name} · {new Date(h.ts).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
