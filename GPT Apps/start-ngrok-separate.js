#!/usr/bin/env node
/**
 * Start 15 separate ngrok processes so each GPT App gets its own public URL.
 * Prereq: MCP servers running (npm run start:all). Uses your default ngrok config for authtoken.
 * Output: Table of 15 MCP URLs and writes NGROK-ENDPOINTS.md
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const orgs = JSON.parse(readFileSync(join(__dirname, "organizations.json"), "utf8"));
const START_PORT = 8787;
const WEB_PORT_BASE = 4040;

const defaultConfigPath =
  process.platform === "darwin"
    ? join(process.env.HOME, "Library", "Application Support", "ngrok", "ngrok.yml")
    : process.platform === "win32"
      ? join(process.env.LOCALAPPDATA || "", "ngrok", "ngrok.yml")
      : join(process.env.XDG_CONFIG_HOME || join(process.env.HOME, ".config"), "ngrok", "ngrok.yml");

if (!existsSync(defaultConfigPath)) {
  console.error("Default ngrok config not found at:", defaultConfigPath);
  console.error("Run: ngrok config check");
  process.exit(1);
}

const tmpDir = join(__dirname, ".ngrok-single");
mkdirSync(tmpDir, { recursive: true });

// Write 15 minimal configs (only web_addr) so each ngrok uses a different inspect port
for (let i = 0; i < 15; i++) {
  const webPort = WEB_PORT_BASE + i;
  const yml = `version: "3"
agent:
  web_addr: "127.0.0.1:${webPort}"
`;
  writeFileSync(join(tmpDir, `port-${START_PORT + i}.yml`), yml);
}

// Kill any existing ngrok on our web ports to avoid EADDRINUSE
async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const children = [];
for (let i = 0; i < 15; i++) {
  const port = START_PORT + i;
  const configPath = join(tmpDir, `port-${port}.yml`);
  const child = spawn("ngrok", ["http", String(port), "--config", defaultConfigPath, "--config", configPath], {
    cwd: __dirname,
    stdio: "ignore",
    detached: true,
  });
  child.unref();
  children.push({ port, name: orgs[i].name, slug: orgs[i].slug });
}

console.log("Started 15 ngrok processes (one per app). Waiting for tunnels to register...\n");
await wait(15e3);

const results = [];
for (let i = 0; i < 15; i++) {
  const webPort = WEB_PORT_BASE + i;
  try {
    const res = await fetch(`http://127.0.0.1:${webPort}/api/tunnels`);
    const data = await res.json();
    const url = data.tunnels?.[0]?.public_url || data.public_url || "";
    results.push({ ...children[i], url: url ? `${url}/mcp` : "" });
  } catch (_) {
    results.push({ ...children[i], url: "(waiting...)" });
  }
}

const lines = [
  "# ngrok endpoints – one URL per app (for ChatGPT connectors)",
  "",
  "Run `node start-ngrok-separate.js` with MCP servers already running (`npm run start:all`).",
  "Then add each URL below as a separate connector in ChatGPT.",
  "",
  "| # | App | Port | MCP URL (add as connector in ChatGPT) |",
  "|---|-----|------|----------------------------------------|",
  ...results.map((r, i) => `| ${i + 1} | ${r.name} | ${r.port} | ${r.url} |`),
  "",
  "To stop all: `pkill -f 'ngrok http'` (or close the terminal that started them).",
];

const md = lines.join("\n");
writeFileSync(join(__dirname, "NGROK-ENDPOINTS.md"), md, "utf8");
console.log(md);
const uniqueUrls = [...new Set(results.map((r) => r.url).filter(Boolean))];
if (uniqueUrls.length === 1 && uniqueUrls[0] !== "(waiting...)") {
  console.log("\nNote: Your ngrok plan may be returning one shared URL for all tunnels.");
  console.log("Check your plan at dashboard.ngrok.com; Pay-as-you-go allows unlimited distinct endpoints.");
}
console.log("\nTable saved to NGROK-ENDPOINTS.md. Add each MCP URL as a separate connector in ChatGPT.");
process.exit(0);
