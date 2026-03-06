#!/usr/bin/env node
/**
 * start-all.js
 * Kills any existing servers/ngrok, starts all 16 MCP servers + 16 ngrok tunnels,
 * each on its own reserved ngrok.app domain. Run once and everything is live.
 *
 * Usage: node "GPT Apps/start-all.js"   (from project root)
 *     or: node start-all.js             (from GPT Apps/)
 */
import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// ── Domain mapping (slug → reserved ngrok.app domain) ──────────────────────
const DOMAIN_MAP = {
  "aha":                          "aha-test.ngrok.app",
  "sjogrens-foundation":          "sjogrens-test.ngrok.app",
  "spina-bifida-association":     "spina-bifida.ngrok.app",
  "national-psoriasis-foundation":"psoriasis-test.ngrok.app",
  "cerebral-palsy-foundation":    "cerebral-test.ngrok.app",
  "cystic-fibrosis-foundation":   "cystic-test.ngrok.app",
  "parkinsons-foundation":        "parkinsons-test.ngrok.app",
  "alzheimers-association":       "alzheimers-test.ngrok.app",
  "fare":                         "fare-test.ngrok.app",
  "arthritis-foundation":         "arthritis-test.ngrok.app",
  "hydrocephalus-association":    "hydrocephalus-test.ngrok.app",
  "blood-cancer-united":          "bcu-test.ngrok.app",
  "afsp":                         "afsp-test.ngrok.app",
  "american-cancer-society":      "acs-test.ngrok.app",
  "pcos-challenge":               "pcos-test.ngrok.app",
  "national-ms-society":          "ms-test.ngrok.app",
};

// ── Port assignments ─────────────────────────────────────────────────────────
// AHA (root server: test widget + AHA MCP) uses 8787; the 15 GPT-Apps orgs use 8788–8802 (matching orgs[] order)
const AHA_PORT = 8787;
const ORG_START_PORT = 8788;

// ── ngrok config path ────────────────────────────────────────────────────────
const defaultConfigPath =
  process.platform === "darwin"
    ? join(os.homedir(), "Library", "Application Support", "ngrok", "ngrok.yml")
    : process.platform === "win32"
      ? join(process.env.LOCALAPPDATA || "", "ngrok", "ngrok.yml")
      : join(process.env.XDG_CONFIG_HOME || join(os.homedir(), ".config"), "ngrok", "ngrok.yml");

// ── Helpers ───────────────────────────────────────────────────────────────────
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function log(msg) { process.stdout.write(msg + "\n"); }

// ── Step 1: Kill existing processes ──────────────────────────────────────────
log("\n[1/4] Stopping any existing ngrok and MCP server processes...");
try { execSync("pkill -f 'ngrok http' 2>/dev/null || true", { shell: true }); } catch (_) {}
try { execSync("pkill -f 'mcp-server.js' 2>/dev/null || true", { shell: true }); } catch (_) {}
try { execSync("pkill -f 'run-all-mcp.js' 2>/dev/null || true", { shell: true }); } catch (_) {}
// Give ports a moment to free up
await wait(1500);

// ── Step 2: Start MCP servers ────────────────────────────────────────────────
log("[2/4] Starting MCP servers...");

const orgs = JSON.parse(readFileSync(join(__dirname, "organizations.json"), "utf8"));
const mcpServerPath = join(__dirname, "mcp-server.js");
const ahaServerPath = join(rootDir, "server.js");

// Build list of all 16 apps: AHA first, then 15 orgs
const apps = [
  { slug: "aha", name: "American Heart Association", port: AHA_PORT, serverPath: ahaServerPath, cwd: rootDir, env: { PORT: String(AHA_PORT) } },
  ...orgs.map((org, i) => ({
    slug: org.slug,
    name: org.name,
    port: ORG_START_PORT + i,
    serverPath: mcpServerPath,
    cwd: __dirname,
    env: { PORT: String(ORG_START_PORT + i), APP_SLUG: org.slug },
  })),
];

const serverProcs = [];
for (const app of apps) {
  const child = spawn("node", [app.serverPath], {
    cwd: app.cwd,
    env: { ...process.env, ...app.env },
    stdio: "ignore",
  });
  child.on("error", (err) => log(`  [ERROR] ${app.slug}: ${err.message}`));
  serverProcs.push(child);
  log(`  ✓ ${app.name.padEnd(48)} port ${app.port}`);
}

// Give servers a moment to bind
await wait(2000);
log("  All 16 MCP servers started.\n");

// ── Step 3: Start ngrok tunnels ───────────────────────────────────────────────
log("[3/4] Starting ngrok tunnels (this takes ~10s)...");

const tmpDir = join(__dirname, ".ngrok-single");
mkdirSync(tmpDir, { recursive: true });

// Each ngrok process needs a unique local web inspection port (4040–4055)
const ngrokProcs = [];
for (let i = 0; i < apps.length; i++) {
  const app = apps[i];
  const domain = DOMAIN_MAP[app.slug];
  if (!domain) { log(`  [SKIP] No domain mapped for slug: ${app.slug}`); continue; }

  const webPort = 4040 + i;
  const webAddrConfig = join(tmpDir, `web-${app.port}.yml`);
  writeFileSync(webAddrConfig, `version: "3"\nagent:\n  web_addr: "127.0.0.1:${webPort}"\n`);

  const child = spawn(
    "ngrok",
    [
      "http", String(app.port),
      "--url", `https://${domain}`,
      "--config", defaultConfigPath,
      "--config", webAddrConfig,
    ],
    { stdio: "ignore", detached: true }
  );
  child.unref();
  ngrokProcs.push({ ...app, domain, webPort });
  log(`  ✓ ${app.name.padEnd(48)} → https://${domain}`);
}

log("\n  Waiting 12s for tunnels to come online...");
await wait(12000);
log("  Done.\n");

// ── Step 4: Write table ────────────────────────────────────────────────────────
log("[4/4] All tunnels live. MCP URLs:\n");

const rows = ngrokProcs.map((a) => ({
  name: a.name,
  port: a.port,
  url: `https://${a.domain}/mcp`,
}));

// Print table to console
const nameW = Math.max(...rows.map((r) => r.name.length), 4);
const urlW  = Math.max(...rows.map((r) => r.url.length), 3);
const header = ` ${"#".padEnd(3)} | ${"App".padEnd(nameW)} | ${"Port".padEnd(5)} | MCP URL`;
const sep    = "-".repeat(header.length + 6);
log(sep);
log(header);
log(sep);
rows.forEach((r, i) => {
  log(` ${String(i + 1).padEnd(3)} | ${r.name.padEnd(nameW)} | ${String(r.port).padEnd(5)} | ${r.url}`);
});
log(sep);

// Write NGROK-ENDPOINTS.md
const md = [
  "# Live ngrok MCP Endpoints",
  "",
  "Each URL below is a separate connector to add in ChatGPT.",
  "",
  "| # | App | Port | MCP URL |",
  "|---|-----|------|---------|",
  ...rows.map((r, i) => `| ${i + 1} | ${r.name} | ${r.port} | ${r.url} |`),
  "",
  "---",
  "Generated by `node start-all.js`.",
  "To stop all servers + tunnels: `pkill -f 'ngrok http' && pkill -f 'mcp-server.js'`",
].join("\n");

writeFileSync(join(__dirname, "NGROK-ENDPOINTS.md"), md, "utf8");
log("\nSaved to NGROK-ENDPOINTS.md\n");

// Keep parent alive so Ctrl+C cleans up servers
log("Press Ctrl+C to stop all MCP servers (ngrok tunnels run independently).\n");
process.on("SIGINT", () => {
  log("\nStopping MCP servers...");
  serverProcs.forEach((p) => { try { p.kill("SIGTERM"); } catch (_) {} });
  process.exit(0);
});
process.on("SIGTERM", () => {
  serverProcs.forEach((p) => { try { p.kill("SIGTERM"); } catch (_) {} });
  process.exit(0);
});
