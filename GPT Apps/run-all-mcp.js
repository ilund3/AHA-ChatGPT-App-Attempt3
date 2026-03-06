#!/usr/bin/env node
/**
 * Start one MCP server per GPT App. Default: 15 apps on ports 8787–8801.
 * Usage: node run-all-mcp.js [count] [startPort]
 * Example: node run-all-mcp.js 5 9000  → 5 apps on 9000–9004
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const orgsPath = join(__dirname, "organizations.json");
const orgs = JSON.parse(readFileSync(orgsPath, "utf8"));
const serverPath = join(__dirname, "mcp-server.js");

const count = Math.min(parseInt(process.argv[2], 10) || 15, orgs.length);
const startPort = parseInt(process.argv[3], 10) || 8787;

const children = [];
const urls = [];

for (let i = 0; i < count; i++) {
  const org = orgs[i];
  const port = startPort + i;
  const child = spawn("node", [serverPath], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(port),
      APP_SLUG: org.slug,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk) => process.stdout.write(`[${port}] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[${port}] ${chunk}`));
  child.on("error", (err) => console.error(`[${port}] Failed:`, err.message));
  children.push({ port, slug: org.slug, name: org.name, child });
  urls.push({ name: org.name, slug: org.slug, url: `http://localhost:${port}/mcp` });
}

console.log("\n--- MCP endpoints (one per app) ---\n");
urls.forEach(({ name, slug, url }) => {
  console.log(`${slug}`);
  console.log(`  ${url}`);
  console.log("");
});
console.log("Press Ctrl+C to stop all.\n");

process.on("SIGINT", () => {
  console.log("\nStopping all MCP servers...");
  children.forEach(({ child }) => child.kill("SIGTERM"));
  process.exit(0);
});
process.on("SIGTERM", () => {
  children.forEach(({ child }) => child.kill("SIGTERM"));
  process.exit(0);
});
