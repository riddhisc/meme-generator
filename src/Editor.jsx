import { useEffect, useMemo, useRef, useState } from "react";
import { IDEAS } from "./ideas.js";

const FONT = 'Impact, Anton, "Arial Black", sans-serif';
const MAX_W = 900;
let uid = 0;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dims = (s) => ({ w: s.naturalWidth || s.width, h: s.naturalHeight || s.height });

// x/y are fractions of the canvas. Text: x = centre, y = top. Sticker: x, y = centre.
const textItem = (o) => ({ id: ++uid, kind: "text", text: "", x: 0.5, y: 0.04, size: 48, color: "#ffffff", stroke: "#000000", ...o });
const stickerItem = (src) => ({ id: ++uid, kind: "sticker", src, x: 0.5, y: 0.5, scale: 0.35, rot: 0, flip: false });

function initialItems(t) {
  const n = clamp(t.box_count || 2, 1, 6);
  const items = Array.from({ length: n }, (_, i) => textItem({ y: n === 1 ? 0.04 : 0.04 + (0.78 * i) / (n - 1) }));
  if (t.prefill) items.filter((i) => i.kind === "text").forEach((i, k) => { i.text = t.prefill[k] ?? ""; });
  if (t.sticker) items.push(stickerItem(t.sticker));
  return items;
}

function measure(ctx, b, W, text) {
  const fontPx = (b.size * W) / 600;
  ctx.font = `${fontPx}px ${FONT}`;
  const lines = [];
  let line = "";
  for (const word of text.toUpperCase().split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > W * 0.92) { lines.push(line); line = word; } else line = test;
  }
  lines.push(line);
  const lineH = fontPx * 1.1;
  return { fontPx, lines, lineH, w: Math.max(...lines.map((l) => ctx.measureText(l).width)), h: lineH * lines.length };
}

// draws everything and returns hit-test shapes (centre, size, rotation) for each layer
function render(canvas, bg, items, cache, selected, forExport) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(bg, 0, 0, W, H);
  ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.lineJoin = "round";
  const shapes = [];
  const frame = (cx, cy, w, h, rot) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((rot * Math.PI) / 180);
    ctx.setLineDash([8, 6]); ctx.strokeStyle = "#ffd34d"; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12);
    ctx.restore();
  };
  for (const it of items) {
    if (it.kind === "sticker") {
      const im = cache.get(it.src);
      if (!im) continue;
      const w = it.scale * W, h = (w * im.height) / im.width, cx = it.x * W, cy = it.y * H;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((it.rot * Math.PI) / 180); ctx.scale(it.flip ? -1 : 1, 1);
      ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
      shapes.push({ id: it.id, cx, cy, w, h, rot: it.rot });
      if (!forExport && it.id === selected) frame(cx, cy, w, h, it.rot);
    } else {
      const empty = !it.text.trim();
      if (empty && forExport) continue;
      const m = measure(ctx, it, W, empty ? "text" : it.text);
      const cx = it.x * W, top = it.y * H;
      ctx.save();
      ctx.globalAlpha = empty ? 0.35 : 1; ctx.lineWidth = m.fontPx / 6; ctx.strokeStyle = it.stroke; ctx.fillStyle = it.color;
      m.lines.forEach((l, i) => { ctx.strokeText(l, cx, top + i * m.lineH); ctx.fillText(l, cx, top + i * m.lineH); });
      ctx.restore();
      shapes.push({ id: it.id, cx, cy: top + m.h / 2, w: m.w, h: m.h, rot: 0 });
      if (!forExport && it.id === selected) frame(cx, top + m.h / 2, m.w, m.h, 0);
    }
  }
  return shapes;
}

export default function Editor({ template, stickers, onMade }) {
  const canvasRef = useRef(null);
  const shapesRef = useRef([]);
  const dragRef = useRef(null);
  const cacheRef = useRef(new Map()); // sticker src → loaded Image
  const [img, setImg] = useState(null);
  const [tainted, setTainted] = useState(false); // photo loaded without CORS → can't export
  const [failed, setFailed] = useState(false);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [items, setItems] = useState(() => initialItems(template));
  const [selected, setSelected] = useState(() => items[0]?.id ?? null);
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState("");
  const [cat, setCat] = useState(Object.keys(IDEAS)[0]);

  useEffect(() => { document.fonts?.load("48px Anton").then(() => setTick((t) => t + 1)).catch(() => {}); }, []);

  useEffect(() => {
    if (template.blank) return;
    let alive = true;
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => alive && setImg(im);
    im.onerror = () => {
      const fb = new Image();
      fb.onload = () => alive && (setTainted(true), setImg(fb));
      fb.onerror = () => alive && setFailed(true);
      fb.src = template.url;
    };
    im.src = template.url;
    return () => { alive = false; };
  }, [template]);

  const blank = useMemo(() => {
    if (!template.blank) return null;
    const c = document.createElement("canvas");
    c.width = 800; c.height = 800;
    const x = c.getContext("2d"); x.fillStyle = bgColor; x.fillRect(0, 0, 800, 800);
    return c;
  }, [template.blank, bgColor]);
  const bg = template.blank ? blank : img;

  // load any sticker layer image once
  useEffect(() => {
    items.forEach((it) => {
      if (it.kind !== "sticker" || cacheRef.current.has(it.src)) return;
      cacheRef.current.set(it.src, null);
      const im = new Image();
      im.onload = () => { cacheRef.current.set(it.src, im); setTick((t) => t + 1); };
      im.src = it.src;
    });
  }, [items]);

  useEffect(() => {
    if (!bg) return;
    const c = canvasRef.current, { w, h } = dims(bg), W = Math.min(w, MAX_W);
    c.width = W; c.height = Math.round((h / w) * W);
    shapesRef.current = render(c, bg, items, cacheRef.current, selected, false);
  }, [bg, items, selected, tick]);

  const update = (id, patch) => setItems((l) => l.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const sel = items.find((b) => b.id === selected);
  const add = (it) => { setItems((l) => [...l, it]); setSelected(it.id); };
  const remove = (id) => { setItems((l) => l.filter((b) => b.id !== id)); setSelected(null); };
  const move = (id, dir) => setItems((l) => {
    const i = l.findIndex((b) => b.id === id), j = i + dir;
    if (j < 0 || j >= l.length) return l;
    const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  const applyIdea = (lines) => setItems((l) => {
    let k = 0;
    const out = l.map((it) => (it.kind === "text" && k < lines.length ? { ...it, text: lines[k++] } : it));
    while (k < lines.length) out.push(textItem({ text: lines[k++], y: 0.4 }));
    return out;
  });
  const surprise = () => { const all = Object.values(IDEAS).flat(); applyIdea(all[Math.floor(Math.random() * all.length)]); };

  const toCanvas = (e) => {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  };
  const hitTest = (p) => {
    for (const s of [...shapesRef.current].reverse()) {
      const a = (-s.rot * Math.PI) / 180, dx = p.x - s.cx, dy = p.y - s.cy;
      const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(rx) <= s.w / 2 + 8 && Math.abs(ry) <= s.h / 2 + 8) return s.id;
    }
    return null;
  };
  const onDown = (e) => {
    const p = toCanvas(e), c = canvasRef.current, id = hitTest(p);
    setSelected(id);
    if (id == null) return;
    const b = items.find((b) => b.id === id);
    dragRef.current = { id, ox: b.x - p.x / c.width, oy: b.y - p.y / c.height };
    c.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toCanvas(e), c = canvasRef.current;
    update(d.id, { x: clamp(p.x / c.width + d.ox, 0, 1), y: clamp(p.y / c.height + d.oy, 0, 1) });
  };

  const exportCanvas = () => {
    const c = document.createElement("canvas");
    c.width = canvasRef.current.width; c.height = canvasRef.current.height;
    render(c, bg, items, cacheRef.current, null, true);
    return c;
  };
  const toBlob = () => new Promise((res, rej) => exportCanvas().toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), "image/png"));
  // keep a small thumbnail in this browser's history (never leaves the device)
  const remember = () => {
    try {
      const src = exportCanvas(), k = Math.min(1, 360 / src.width);
      const t = document.createElement("canvas");
      t.width = Math.round(src.width * k); t.height = Math.round(src.height * k);
      t.getContext("2d").drawImage(src, 0, 0, t.width, t.height);
      onMade?.(t.toDataURL("image/jpeg", 0.7), template.name);
    } catch { /* tainted canvas: skip */ }
  };
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 2500); };
  const download = async () => {
    try {
      const url = URL.createObjectURL(await toBlob());
      Object.assign(document.createElement("a"), { href: url, download: "meme.png" }).click();
      URL.revokeObjectURL(url); remember(); flash("Downloaded meme.png");
    } catch { flash("This template blocks export. Upload the image yourself instead."); }
  };
  const copy = async () => {
    try { await navigator.clipboard.write([new ClipboardItem({ "image/png": await toBlob() })]); remember(); flash("Copied to clipboard"); }
    catch { flash("Copy isn't supported here. Use Download."); }
  };

  if (failed) return <main><p className="note">Couldn't load that image. Use Back to pick another.</p></main>;

  return (
    <main className="editor">
      <div className="stage">
        <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (dragRef.current = null)} />
        <p className="hint">Drag captions and stickers to move them.</p>
      </div>

      <aside className="panel">
        <h2>{template.name}</h2>
        {template.blank && <label className="row">Background <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} /></label>}

        <div className="layers">
          {items.map((b, i) => b.kind === "text" ? (
            <input key={b.id} className={`field ${b.id === selected ? "on" : ""}`} value={b.text}
              placeholder={`Caption ${i + 1}`} onFocus={() => setSelected(b.id)} onChange={(e) => update(b.id, { text: e.target.value })} />
          ) : (
            <button key={b.id} className={`layer checker-sm ${b.id === selected ? "on" : ""}`} onClick={() => setSelected(b.id)}>
              <img src={b.src} alt="" /> Sticker
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => add(textItem({ y: 0.4 }))}>+ Add text</button>

        <details className="ideas">
          <summary>💡 Caption ideas</summary>
          <div className="chips">
            {Object.keys(IDEAS).map((c) => <button key={c} className={c === cat ? "on" : ""} onClick={() => setCat(c)}>{c}</button>)}
            <button onClick={surprise}>🎲 Surprise me</button>
          </div>
          <div className="idea-list">
            {IDEAS[cat].map((lines) => <button key={lines[0]} onClick={() => applyIdea(lines)}>{lines[0]} <i>/</i> {lines[1]}</button>)}
          </div>
        </details>

        {stickers.length > 0 && (
          <>
            <p className="label">Add a sticker</p>
            <div className="strip">
              {stickers.map((s) => <button key={s.id} className="checker-sm" onClick={() => add(stickerItem(s.url))}><img src={s.url} alt="sticker" /></button>)}
            </div>
          </>
        )}

        {sel && (
          <div className="styles">
            {sel.kind === "text" ? (
              <>
                <label className="row">Size <input type="range" min="20" max="120" value={sel.size} onChange={(e) => update(sel.id, { size: +e.target.value })} /></label>
                <label className="row">Fill <input type="color" value={sel.color} onChange={(e) => update(sel.id, { color: e.target.value })} /></label>
                <label className="row">Outline <input type="color" value={sel.stroke} onChange={(e) => update(sel.id, { stroke: e.target.value })} /></label>
              </>
            ) : (
              <>
                <label className="row">Size <input type="range" min="5" max="100" value={Math.round(sel.scale * 100)} onChange={(e) => update(sel.id, { scale: +e.target.value / 100 })} /></label>
                <label className="row">Rotate <input type="range" min="-180" max="180" value={sel.rot} onChange={(e) => update(sel.id, { rot: +e.target.value })} /></label>
                <button className="btn" onClick={() => update(sel.id, { flip: !sel.flip })}>⇋ Flip</button>
              </>
            )}
            <div className="actions">
              <button className="btn" onClick={() => move(sel.id, 1)}>↑ Raise</button>
              <button className="btn" onClick={() => move(sel.id, -1)}>↓ Lower</button>
              <button className="btn danger" onClick={() => remove(sel.id)}>Delete</button>
            </div>
          </div>
        )}

        <div className="actions">
          <button className="btn primary" onClick={download} disabled={!bg}>Download PNG</button>
          <button className="btn" onClick={copy} disabled={!bg}>Copy</button>
        </div>
        {tainted && <p className="note small">This template's host doesn't allow export. Save the image and upload it to download.</p>}
        {msg && <p className="toast" role="status">{msg}</p>}
      </aside>
    </main>
  );
}
