import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT ?? 8787);

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  let path = decodeURIComponent(url.pathname) || "/";
  if (path === "/") path = "/index.html";
  if (path.startsWith("/")) path = path.slice(1);
  const filePath = join(__dirname, path);
  if (!filePath.startsWith(__dirname) || !existsSync(filePath)) {
    res.writeHead(404).end("Not Found");
    return;
  }
  try {
    const body = readFileSync(filePath);
    const ext = extname(path).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "content-type": contentType }).end(body);
  } catch (err) {
    res.writeHead(500).end("Error");
  }
}).listen(port, () => {
  console.log(`Serving at http://localhost:${port}`);
});
