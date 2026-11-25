import { useEffect, useRef, useState } from "react";

const MAX_W = 900;   // working resolution of the source photo
const MAX_OUT = 600; // largest sticker side

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// crop away fully transparent borders; returns null if nothing is left
function trim(c) {
  const { width: W, height: H } = c;
  const d = c.getContext("2d").getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  if (x1 < 0) return null;
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext("2d").drawImage(c, -x0, -y0);
  return out;
}

// classic sticker look: a white silhouette stamped around the cut-out
function withOutline(c, r) {
  const pad = r > 0 ? r + 2 : 0;
  const out = document.createElement("canvas");
  out.width = c.width + pad * 2; out.height = c.height + pad * 2;
  const ctx = out.getContext("2d");
  if (r > 0) {
    const sil = document.createElement("canvas");
    sil.width = c.width; sil.height = c.height;
    const s = sil.getContext("2d");
    s.drawImage(c, 0, 0); s.globalCompositeOperation = "source-in"; s.fillStyle = "#fff"; s.fillRect(0, 0, c.width, c.height);
    ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    for (let a = 0; a < 32; a++) ctx.drawImage(sil, pad + Math.cos((a / 32) * 6.283) * r, pad + Math.sin((a / 32) * 6.283) * r);
    ctx.shadowColor = "transparent";
  }
  ctx.drawImage(c, pad, pad);
  const k = Math.min(1, MAX_OUT / Math.max(out.width, out.height));
  if (k === 1) return out;
  const small = document.createElement("canvas");
  small.width = Math.round(out.width * k); small.height = Math.round(out.height * k);
  small.getContext("2d").drawImage(out, 0, 0, small.width, small.height);
  return small;
}

const HINTS = {
  lasso: "Draw around the part you want. Release to close the shape.",
  rect: "Drag a rectangle around the part you want.",
  wand: "Click the background (or any area) to erase similar colours. Click as many times as you need.",
};

export default function StickerMaker({ src, onSave, onUse }) {
  const viewRef = useRef(null);
  const workRef = useRef(null); // editable copy of the photo (keeps transparency)
  const dragRef = useRef(false);
  const [version, setVersion] = useState(0);
  const [mode, setMode] = useState("lasso");
  const [tol, setTol] = useState(40);
  const [sel, setSel] = useState(null);
  const [outline, setOutline] = useState(8);
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    const im = new Image();
    im.onload = () => {
      const w = Math.min(im.naturalWidth, MAX_W);
      const c = document.createElement("canvas");
      c.width = w; c.height = Math.round((im.naturalHeight / im.naturalWidth) * w);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      workRef.current = c; setSel(null); setResult(null); setVersion((v) => v + 1);
    };
    im.onerror = () => setMsg("Couldn't read that image.");
    im.src = src;
  };
  useEffect(load, [src]);

  useEffect(() => {
    const w = workRef.current;
    if (!w) return;
    const c = viewRef.current;
    c.width = w.width; c.height = w.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(w, 0, 0);
    if (!sel) return;
    ctx.lineWidth = Math.max(2, c.width / 300); ctx.setLineDash([10, 6]);
    ctx.strokeStyle = "#ffd34d"; ctx.fillStyle = "rgba(255,211,77,.18)";
    ctx.beginPath();
    if (sel.type === "rect") ctx.rect(sel.x, sel.y, sel.w, sel.h);
    else { sel.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
    ctx.fill(); ctx.stroke();
  }, [version, sel]);

  const pos = (e) => {
    const c = viewRef.current, r = c.getBoundingClientRect();
    return { x: clamp(((e.clientX - r.left) * c.width) / r.width, 0, c.width), y: clamp(((e.clientY - r.top) * c.height) / r.height, 0, c.height) };
  };

  const wand = (p) => {
    const w = workRef.current, ctx = w.getContext("2d"), W = w.width, H = w.height;
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    const start = Math.min(H - 1, Math.floor(p.y)) * W + Math.min(W - 1, Math.floor(p.x)), i0 = start * 4;
    const r0 = d[i0], g0 = d[i0 + 1], b0 = d[i0 + 2], limit = tol * tol * 3;
    const seen = new Uint8Array(W * H), stack = [start];
    while (stack.length) {
      const k = stack.pop();
      if (seen[k]) continue;
      seen[k] = 1;
      const i = k * 4, dr = d[i] - r0, dg = d[i + 1] - g0, db = d[i + 2] - b0;
      if (d[i + 3] > 0 && dr * dr + dg * dg + db * db > limit) continue;
      d[i + 3] = 0;
      const x = k % W, y = (k / W) | 0;
      if (x > 0) stack.push(k - 1);
      if (x < W - 1) stack.push(k + 1);
      if (y > 0) stack.push(k - W);
      if (y < H - 1) stack.push(k + W);
    }
    ctx.putImageData(img, 0, 0);
    setResult(null); setVersion((v) => v + 1);
  };

  const onDown = (e) => {
    const p = pos(e);
    if (mode === "wand") return wand(p);
    dragRef.current = true; viewRef.current.setPointerCapture(e.pointerId); setResult(null);
    setSel(mode === "rect" ? { type: "rect", x: p.x, y: p.y, w: 0, h: 0, x0: p.x, y0: p.y } : { type: "lasso", pts: [[p.x, p.y]] });
  };
  const onMove = (e) => {
    if (!dragRef.current) return;
    const p = pos(e);
    setSel((s) => s && (s.type === "rect"
      ? { ...s, x: Math.min(s.x0, p.x), y: Math.min(s.y0, p.y), w: Math.abs(p.x - s.x0), h: Math.abs(p.y - s.y0) }
      : { ...s, pts: [...s.pts, [p.x, p.y]] }));
  };
  const onUp = () => {
    dragRef.current = false;
    setSel((s) => (s && ((s.type === "rect" && (s.w < 8 || s.h < 8)) || (s.type === "lasso" && s.pts.length < 8)) ? null : s));
  };

  const make = () => {
    const w = workRef.current;
    let bx = 0, by = 0, bw = w.width, bh = w.height, path = null;
    if (sel?.type === "rect") ({ x: bx, y: by, w: bw, h: bh } = sel);
    if (sel?.type === "lasso") {
      const xs = sel.pts.map((p) => p[0]), ys = sel.pts.map((p) => p[1]);
      bx = Math.min(...xs); by = Math.min(...ys); bw = Math.max(...xs) - bx; bh = Math.max(...ys) - by; path = sel.pts;
    }
    bx = Math.floor(bx); by = Math.floor(by);
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(bw)); c.height = Math.max(1, Math.ceil(bh));
    const ctx = c.getContext("2d");
    if (path) {
      ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x - bx, y - by) : ctx.moveTo(x - bx, y - by))); ctx.closePath(); ctx.clip();
    }
    ctx.drawImage(w, -bx, -by);
    const t = trim(c);
    if (!t) return setMsg("Nothing there. Select an area that has visible pixels.");
    setMsg(""); setSaved(false); setResult(withOutline(t, outline).toDataURL("image/png"));
  };

  const keep = () => { if (!saved) { onSave(result); setSaved(true); } };
  const download = () => Object.assign(document.createElement("a"), { href: result, download: "sticker.png" }).click();

  return (
    <main className="editor">
      <div className="stage">
        <canvas ref={viewRef} className="checker" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />
        <p className="hint">{HINTS[mode]}</p>
      </div>

      <aside className="panel">
        <h2>Sticker maker</h2>
        <div className="seg">
          {[["lasso", "✂ Freehand"], ["rect", "▭ Box"], ["wand", "🪄 Erase colour"]].map(([k, label]) => (
            <button key={k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{label}</button>
          ))}
        </div>
        {mode === "wand" && (
          <label className="row">Tolerance <input type="range" min="5" max="120" value={tol} onChange={(e) => setTol(+e.target.value)} /></label>
        )}
        <label className="row">Sticker border <input type="range" min="0" max="20" value={outline} onChange={(e) => setOutline(+e.target.value)} /></label>
        <div className="actions">
          <button className="btn primary" onClick={make}>Create sticker</button>
          <button className="btn" onClick={() => { load(); }}>Reset</button>
        </div>
        <p className="note small">{sel ? "Selection ready." : "No selection: the whole photo (minus any erased areas) becomes the sticker."}</p>
        {msg && <p className="toast" role="status">{msg}</p>}

        {result && (
          <div className="result">
            <img className="checker" src={result} alt="Your sticker" />
            <div className="actions">
              <button className="btn" onClick={keep} disabled={saved}>{saved ? "Saved ✓" : "Save"}</button>
              <button className="btn" onClick={download}>PNG</button>
            </div>
            <button className="btn primary" onClick={() => { keep(); onUse(result); }}>Use in a meme →</button>
          </div>
        )}
      </aside>
    </main>
  );
}
