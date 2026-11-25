import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In production builds the page may only talk to Imgflip (template list + images).
// Your photos, stickers and memes can't be sent anywhere else, even by mistake.
const CSP = [
  "default-src 'self'", "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.imgflip.com", "connect-src 'self' https://api.imgflip.com",
  "object-src 'none'", "base-uri 'self'", "form-action 'none'",
].join("; ");

const csp = () => ({
  name: "csp",
  transformIndexHtml: (html, ctx) =>
    ctx.server || process.env.NOCSP ? html : html.replace("</title>", `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

// base "./" lets the build work on GitHub Pages under any repo name
export default defineConfig({ plugins: [react(), csp()], base: "./" });
