// Everything the app remembers lives in this browser's localStorage, on this device only.
export const KEYS = { stickers: "memegen.stickers.v1", history: "memegen.history.v1", usage: "memegen.usage.v1" };
export const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
export const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };
export const wipe = (...ks) => ks.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
