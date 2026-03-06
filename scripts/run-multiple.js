#!/usr/bin/env node
/**
 * Start multiple MCP server instances on consecutive ports for local testing.
 * Usage: node scripts/run-multiple.js [count] [startPort]
 * Default: 15 instances on ports 8787-8801
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const serverPath = join(rootDir, "server.js");

const count = Math.min(parseInt(process.argv[2], 10) || 15, 50);
const startPort = parseInt(process.argv[3], 10) || 8787;

const children = [];

for (let i = 0; i < count; i++) {
  const port = startPort + i;
  const label = `instance ${i + 1} (port ${port})`;
  const child = spawn("node", [serverPath], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      INSTANCE_LABEL: label,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk) =>
    process.stdout.write(`[${port}] ${chunk}`)
  );
  child.stderr?.on("data", (chunk) =>
    process.stderr.write(`[${port}] ${chunk}`)
  );
  child.on("error", (err) => {
    console.error(`[${port}] Failed to start:`, err.message);
  });
  child.on("exit", (code, signal) => {
    if (code != null && code !== 0) {
      console.error(`[${port}] Exited with code ${code}`);
    }
    if (signal) {
      console.error(`[${port}] Killed by signal ${signal}`);
    }
  });

  children.push({ port, label, child });
}

console.log(
  `Started ${count} MCP server(s) on ports ${startPort}-${startPort + count - 1}`
);
console.log("MCP endpoints:");
children.forEach(({ port }) => {
  console.log(`  http://localhost:${port}/mcp`);
});
console.log("\nPress Ctrl+C to stop all.\n");

process.on("SIGINT", () => {
  console.log("\nShutting down all instances...");
  children.forEach(({ child }) => child.kill("SIGTERM"));
  process.exit(0);
});

process.on("SIGTERM", () => {
  children.forEach(({ child }) => child.kill("SIGTERM"));
  process.exit(0);
});
