/* Static SPA server for Azure App Service / generic Node hosts.
   Serves the Vite-built `dist/` folder. Falls back to index.html so the
   client-side router (such as it is) keeps working on direct URLs.

   App Service runs `npm start` if it exists, ignoring the `main` field —
   so Electron's main.cjs (which only works under the Electron binary)
   never gets executed in this environment.

   Built with Node built-ins only — no extra dependency on Express/etc. */

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "dist");
const PORT = process.env.PORT || 8080;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".map":  "application/json",
  ".txt":  "text/plain; charset=utf-8",
};

function safeJoin(rootDir, requestPath) {
  // Strip query/hash, decode, prevent path traversal outside ROOT.
  const decoded = decodeURIComponent(requestPath.split("?")[0].split("#")[0]);
  const target = path.normalize(path.join(rootDir, decoded));
  if (!target.startsWith(rootDir)) return null;
  return target;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Cache-Control": "no-cache", ...headers });
  res.end(body);
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return sendIndex(res, 404);
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    // Hashed asset filenames from Vite are immutable — long cache them.
    const isHashed = /\.[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(filePath);
    const cache = isHashed
      ? "public, max-age=31536000, immutable"
      : "no-cache";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": cache });
    fs.createReadStream(filePath).pipe(res);
  });
}

function sendIndex(res, status = 200) {
  const indexPath = path.join(ROOT, "index.html");
  fs.readFile(indexPath, (err, buf) => {
    if (err) {
      return send(
        res, 500,
        "dist/index.html missing — did you run `npm run build`?",
        { "Content-Type": "text/plain; charset=utf-8" }
      );
    }
    res.writeHead(status, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "Method Not Allowed");
  }
  const urlPath = req.url || "/";
  if (urlPath === "/" || urlPath === "") return sendIndex(res);

  const filePath = safeJoin(ROOT, urlPath);
  if (!filePath) return sendIndex(res, 404);

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) return serveFile(res, filePath);
    if (!err && stat.isDirectory()) {
      return serveFile(res, path.join(filePath, "index.html"));
    }
    // SPA fallback: any unknown path returns index.html so the client
    // router can take over.
    return sendIndex(res);
  });
});

server.listen(PORT, () => {
  console.log(`DaisyConquest static server listening on :${PORT} (root=${ROOT})`);
});
