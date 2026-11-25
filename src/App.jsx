import { useEffect, useMemo, useState } from "react";
import Editor from "./Editor.jsx";
import StickerMaker from "./StickerMaker.jsx";
import Privacy from "./Privacy.jsx";
import { ALL_IDEAS } from "./ideas.js";
import { KEYS, read, write, wipe } from "./store.js";

const API = "https://api.imgflip.com/get_memes"; // public endpoint, no login needed
const SAMPLE = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#7ed6df"/><circle cx="130" cy="110" r="60" fill="#f9ca24"/><rect y="470" width="800" height="130" fill="#6ab04c"/><text x="400" y="430" font-size="330" text-anchor="middle">🐶</text></svg>`);
const TITLES = { templates: "Choose a background", maker: "Sticker maker", stickers: "My stickers", editor: "Meme editor", privacy: "History & privacy" };
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

function Card({ t, onPick, lines }) {
  return (
    <button className="card" onClick={() => onPick(lines ? { ...t, prefill: lines } : t)} title={t.name}>
      {lines ? (
        <div className="sug-img" style={{ backgroundImage: `url(${t.url})` }}><p>{lines[0]}</p><p>{lines[1]}</p></div>
      ) : <img src={t.url} alt={t.name} loading="lazy" />}
      <span>{t.name}</span>
    </button>
  );
}

export default function App() {
  // screen stack, wired to browser history so the phone/browser Back button works too
  const [stack, setStack] = useState([{ name: "home" }]);
  const screen = stack[stack.length - 1];
  const push = (s) => { history.pushState({ d: stack.length + 1 }, ""); setStack((st) => [...st, s]); };
  const back = () => stack.length > 1 && history.back();
  const home = () => stack.length > 1 && history.go(-(stack.length - 1));

  useEffect(() => {
    history.replaceState({ d: 1 }, "");
    const onPop = (e) => setStack((st) => st.slice(0, Math.max(1, e.state?.d ?? 1)));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !e.target.matches?.("input,textarea") && back();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- private, per-device data (localStorage only) ----
  const [stickers, setStickers] = useState(() => read(KEYS.stickers, []));
  const [recent, setRecent] = useState(() => read(KEYS.history, []));
  const [usage, setUsage] = useState(() => read(KEYS.usage, {}));
  useEffect(() => write(KEYS.stickers, stickers), [stickers]);
  useEffect(() => write(KEYS.history, recent), [recent]);
  useEffect(() => write(KEYS.usage, usage), [usage]);
  const addSticker = (url) => setStickers((s) => [{ id: Date.now() + Math.random(), url }, ...s].slice(0, 24));
  const dropSticker = (id) => setStickers((s) => s.filter((x) => x.id !== id));
  const addRecent = (thumb, name) => setRecent((h) => [{ id: Date.now(), thumb, name, ts: Date.now() }, ...h].slice(0, 12));
  const clearHistory = () => { setRecent([]); setUsage({}); wipe(KEYS.history, KEYS.usage); };
  const clearStickers = () => { setStickers([]); wipe(KEYS.stickers); };
  const clearAll = () => { clearHistory(); clearStickers(); };

  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState("loading");
  const [query, setQuery] = useState("");
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(API, { signal: ctl.signal })
      .then((r) => r.json())
      .then((d) => { if (!d.success) throw new Error("bad response"); setTemplates(d.data.memes); setStatus("ready"); })
      .catch((e) => e.name !== "AbortError" && setStatus("error"));
    return () => ctl.abort();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? templates.filter((t) => t.name.toLowerCase().includes(q)) : templates;
  }, [templates, query]);

  // suggested memes: a popular template paired with a ready-made caption
  const suggestions = useMemo(() => {
    const pool = shuffle(templates.slice(0, 40));
    return pool.length ? shuffle(ALL_IDEAS).slice(0, 6).map((lines, i) => ({ lines, t: pool[i % pool.length] })) : [];
  }, [templates, seed]);
  // recommendations: what you use most on this device, otherwise what's popular
  const mine = useMemo(() => Object.values(usage).sort((a, b) => b.count - a.count || b.last - a.last).slice(0, 6), [usage]);

  const toMaker = (src) => push({ name: "maker", src });
  const toEditor = (template, pending) => {
    if (template.url && /^https?:/.test(template.url) && !template.blank) {
      setUsage((u) => {
        const n = { ...u, [template.id]: { id: template.id, name: template.name, url: template.url, box_count: template.box_count, count: (u[template.id]?.count || 0) + 1, last: Date.now() } };
        Object.keys(n).sort((a, b) => n[a].last - n[b].last).slice(0, Math.max(0, Object.keys(n).length - 30)).forEach((k) => delete n[k]);
        return n;
      });
    }
    push({ name: "editor", template: { ...template, sticker: pending } });
  };
  const fileURL = (f) => URL.createObjectURL(f);

  // Ctrl/Cmd+V: on Home → sticker maker, on templates → meme background
  useEffect(() => {
    const onPaste = (e) => {
      const f = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
      if (!f) return;
      if (screen.name === "home") toMaker(fileURL(f));
      if (screen.name === "templates") toEditor({ id: "up", name: "Your image", url: fileURL(f), box_count: 2 }, screen.pending);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const browsing = !query.trim() && status === "ready";

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-l">
          {stack.length > 1 && <button className="btn back" onClick={back} aria-label="Go back">← Back</button>}
          <button className="logo" onClick={home} aria-label="Home"><span className="logo-ic">😂</span><span>Meme<b>Gen</b></span></button>
        </div>
        <div className="nav-r">
          {TITLES[screen.name] && <span className="chip">{TITLES[screen.name]}</span>}
          {screen.name !== "privacy" && <button className="btn" onClick={() => push({ name: "privacy" })}>🔒 History</button>}
        </div>
      </nav>

      {screen.name === "home" && (
        <main>
          <section className="hero">
            <p className="eyebrow">Free · No sign-up · Stays on your device</p>
            <h2>Make memes. <em>Cut stickers.</em> Mix them together.</h2>
            <p className="lede">Pick a template, or cut any part out of your own photo and turn it into a sticker.</p>
            <div className="actions hero-cta">
              <button className="btn primary lg" onClick={() => push({ name: "templates" })}>Start a meme →</button>
              <label className="btn ghost lg">✂ Make a sticker
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && toMaker(fileURL(e.target.files[0]))} />
              </label>
            </div>
          </section>

          <section className="bento">
            <button className="tile t-templates" onClick={() => push({ name: "templates" })}>
              <div className="collage" aria-hidden="true">
                {(templates.length ? templates.slice(0, 3).map((t) => <img key={t.id} src={t.url} alt="" />) : ["🙀", "😎", "🔥"].map((e) => <div key={e}>{e}</div>))}
              </div>
              <b>Meme templates</b>
              <span>Suggestions, recommendations and caption ideas included.</span>
              <em className="go">Browse →</em>
            </button>

            <div className="tile t-maker">
              <div className="lasso" aria-hidden="true"><svg viewBox="0 0 120 120"><path d="M20 70 C10 30 50 8 85 22 C112 34 108 80 78 96 C50 110 28 98 20 70Z" /></svg><span>🐶</span></div>
              <b>Sticker maker</b>
              <span>Lasso, box-select or erase a colour. Get a clean transparent PNG.</span>
              <div className="actions">
                <label className="btn primary">Upload photo
                  <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && toMaker(fileURL(e.target.files[0]))} />
                </label>
                <button className="btn" onClick={() => toMaker(SAMPLE)}>Try a sample</button>
              </div>
            </div>

            <button className="tile t-library" onClick={() => push({ name: "stickers" })}>
              <div className="thumbs" aria-hidden="true">
                {stickers.length ? stickers.slice(0, 4).map((x) => <img key={x.id} className="checker" src={x.url} alt="" />) : <div>🧩</div>}
              </div>
              <b>My stickers <small>{stickers.length}</small></b>
              <span>Your cut-outs, ready to reuse.</span>
            </button>

            <button className="tile t-how" onClick={() => push({ name: "privacy" })}>
              <b>🔒 Private by design</b>
              <span>Nothing is uploaded. Your memes live only in this browser. Clear them any time.</span>
              <em className="go">History &amp; privacy →</em>
            </button>
          </section>
        </main>
      )}

      {screen.name === "templates" && (
        <main>
          {screen.pending && (
            <div className="banner"><img src={screen.pending} alt="" /> Pick a background for your sticker.</div>
          )}
          <div className="bar">
            <input className="search" placeholder={`Search ${templates.length || ""} templates…`} value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="btn" onClick={() => toEditor({ id: "blank", name: "Blank canvas", blank: true, box_count: 2 }, screen.pending)}>Blank canvas</button>
            <label className="btn primary">Upload image
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && toEditor({ id: "up", name: "Your image", url: fileURL(e.target.files[0]), box_count: 2 }, screen.pending)} />
            </label>
          </div>
          {status === "loading" && <p className="note">Loading templates…</p>}
          {status === "error" && <p className="note">Couldn't load templates (offline or API down). You can still use a blank canvas, upload an image, or paste one with Ctrl+V.</p>}

          {browsing && suggestions.length > 0 && (
            <section>
              <div className="sec-head"><h3 className="sec">💡 Suggested memes <small>template + ready-made caption</small></h3><button className="btn" onClick={() => setSeed((s) => s + 1)}>🎲 Shuffle</button></div>
              <div className="grid">{suggestions.map(({ t, lines }, i) => <Card key={i} t={t} lines={lines} onPick={(x) => toEditor(x, screen.pending)} />)}</div>
            </section>
          )}
          {browsing && (
            <section>
              <h3 className="sec">{mine.length ? "⭐ Recommended for you" : "🔥 Popular right now"} <small>{mine.length ? "based on what you make on this device" : "the most-used templates"}</small></h3>
              <div className="grid">{(mine.length ? mine : templates.slice(0, 6)).map((t) => <Card key={t.id} t={t} onPick={(x) => toEditor(x, screen.pending)} />)}</div>
            </section>
          )}
          {status === "ready" && shown.length === 0 && <p className="note">No templates match “{query}”.</p>}
          {status === "ready" && <h3 className="sec">{browsing ? "All templates" : `Results for “${query}”`}</h3>}
          <div className="grid">{shown.map((t) => <Card key={t.id} t={t} onPick={(x) => toEditor(x, screen.pending)} />)}</div>
        </main>
      )}

      {screen.name === "maker" && (
        <StickerMaker key={screen.src} src={screen.src} onSave={addSticker} onUse={(url) => push({ name: "templates", pending: url })} />
      )}

      {screen.name === "stickers" && (
        <main>
          {stickers.length === 0 && <p className="note">No stickers yet. Make one in the Sticker maker.</p>}
          <div className="grid">
            {stickers.map((s) => (
              <div key={s.id} className="card sticker-card">
                <img className="checker" src={s.url} alt="sticker" />
                <div className="actions">
                  <button className="btn primary" onClick={() => push({ name: "templates", pending: s.url })}>Use</button>
                  <a className="btn" href={s.url} download="sticker.png">PNG</a>
                  <button className="btn danger" onClick={() => dropSticker(s.id)} aria-label="Delete sticker">✕</button>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {screen.name === "privacy" && (
        <Privacy history={recent} stickerCount={stickers.length} usageCount={Object.keys(usage).length}
          onClearHistory={clearHistory} onClearStickers={clearStickers} onClearAll={clearAll} />
      )}

      {screen.name === "editor" && <Editor key={stack.length} template={screen.template} stickers={stickers} onMade={addRecent} />}

      <footer className="foot">🔒 Everything you make stays on this device. Nothing is uploaded.</footer>
    </div>
  );
}
