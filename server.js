// Tiny zero-dependency static server for Railway / any Node host.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff2":"font/woff2",
  ".map":  "application/json",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Cache-Control": "no-cache", ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath = path.join(ROOT, urlPath);
    if (!filePath.startsWith(ROOT)) return send(res, 403, "Forbidden");
    let stat;
    try { stat = fs.statSync(filePath); } catch (_) { return send(res, 404, "Not found"); }
    if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    fs.readFile(filePath, (err, data) => {
      if (err) return send(res, 404, "Not found");
      send(res, 200, data, { "Content-Type": type });
    });
  } catch (e) {
    send(res, 500, "Server error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Pet World listening on http://${HOST}:${PORT}`);
});
