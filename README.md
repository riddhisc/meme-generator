# MemeGen

A meme maker **and sticker maker** built with React 18 + Vite. Everything is rendered in your browser with the Canvas API, so there is no account, API key or backend.

## Features
- **Redesigned UI**: clean light interface, simple hero, bento home screen, hover-lift template cards
- **Sticker maker**: upload a photo and cut out the part you want with a freehand lasso, a box, or the "erase colour" wand (flood-fill with adjustable tolerance). Add an optional white sticker border and export a transparent PNG.
- **Sticker library**: stickers are saved in your browser (localStorage) and can be reused in any meme.
- **Meme editor**: ~100 live Imgflip templates with search, your own upload, paste from the clipboard, or a blank canvas.
- **Layers**: captions and stickers are movable objects. Drag, resize, rotate, flip, reorder forward/back, delete.
- **Navigation**: a Back button on every screen (also Esc, and the browser/phone back button via the History API), and the logo returns Home.
- **Suggestions**: suggested memes (template + ready-made caption), recommendations based on what you use, popular templates, and 25+ caption ideas by category.
- Download PNG or copy to clipboard. Responsive and touch friendly. Auto-deploys to GitHub Pages.

## Privacy
- No accounts, no backend, no analytics. Photos, stickers and memes are processed in your browser and never uploaded.
- Saved stickers, recent memes and template usage live in this browser's `localStorage`, on this device only. Another laptop (or browser) sees none of it.
- **History** screen: view recent memes and **Clear history**, **Delete my stickers** or **Erase everything** at any time.
- Production builds ship a Content-Security-Policy that only allows requests to Imgflip (template list and images), plus `no-referrer`.

## Run locally
```bash
npm install
npm run dev
```

## Build / deploy
`npm run build` outputs to `dist/`. Pushing to `main` runs the included GitHub Actions workflow (Settings → Pages → Source: *GitHub Actions*).

## Tech
React 18, Vite, Canvas API (clip paths, compositing, flood fill), Pointer Events, History API, plain CSS.

## Roadmap
TypeScript migration, AI background removal, undo/redo, text shadow and font picker, animated GIF stickers.
