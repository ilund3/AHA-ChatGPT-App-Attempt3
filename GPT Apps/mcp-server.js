#!/usr/bin/env node
/**
 * MCP server for one GPT App. Run with APP_SLUG and PORT.
 * Example: APP_SLUG=sjogrens-foundation PORT=8787 node mcp-server.js
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const APP_SLUG = process.env.APP_SLUG;
const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";

if (!APP_SLUG) {
  console.error("Set APP_SLUG (e.g. APP_SLUG=sjogrens-foundation)");
  process.exit(1);
}

const appDir = join(__dirname, APP_SLUG);
const widgetPath = join(appDir, "public", "widget.html");
const resourcesPath = join(appDir, "resources", `${APP_SLUG}-resources.json`);

if (!existsSync(widgetPath) || !existsSync(resourcesPath)) {
  console.error(`Missing app files for ${APP_SLUG} (widget or resources).`);
  process.exit(1);
}

function getWidgetHtml() {
  return readFileSync(widgetPath, "utf8");
}

const resources = JSON.parse(readFileSync(resourcesPath, "utf8"));
const orgName = resources.organization || APP_SLUG;

function searchResources(query) {
  if (!query || !query.trim()) return [];
  const q = query.toLowerCase().trim();
  const terms = q.split(/\s+/).filter(Boolean);
  const all = [
    ...(resources.services || []).map((r) => ({ ...r, category: "Services" })),
    ...(resources.getInvolved || []).map((r) => ({ ...r, category: "Get Involved" })),
  ];
  return all
    .map((r) => {
      const title = (r.title || "").toLowerCase();
      let score = title.includes(q) ? 50 : 0;
      terms.forEach((t) => {
        if (t.length > 2 && title.includes(t)) score += 20;
      });
      return { resource: r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.resource);
}

function createMcpServer() {
  const server = new McpServer({
    name: resources.organization ? resources.organization.replace(/\s+/g, "-").toLowerCase() : APP_SLUG,
    version: "0.1.0",
  });

  const widgetUri = "ui://widget/app.html";
  server.registerResource(
    "app-widget",
    widgetUri,
    {},
    async () => ({
      contents: [
        {
          uri: widgetUri,
          mimeType: "text/html+skybridge",
          text: getWidgetHtml(),
          _meta: {
            "openai/widgetPrefersBorder": true,
            "openai/widgetDomain": "https://chatgpt.com",
          },
        },
      ],
    })
  );

  server.registerTool(
    "show_widget",
    {
      title: `${orgName} Widget`,
      description: `Call this tool to show the ${orgName} widget. Use for general questions or when the user wants to see resources, get involved, or learn about ${orgName}.`,
      inputSchema: {
        query: z.string().optional().describe("The user's query or request"),
      },
      _meta: {
        "openai/outputTemplate": widgetUri,
        "openai/toolInvocation/invoking": `Loading ${orgName} widget...`,
        "openai/toolInvocation/invoked": `${orgName} widget ready`,
      },
    },
    async (args) => {
      const userQuery = args?.query || "";
      const text = userQuery ? `Processing: ${userQuery}` : `${orgName} widget loaded.`;
      return {
        content: [{ type: "text", text }],
        structuredContent: { message: orgName, query: userQuery },
        _meta: {},
      };
    }
  );

  server.registerTool(
    "search_resources",
    {
      title: `Search ${orgName} Resources`,
      description: `Search ${orgName} services and get-involved options. Use when the user asks about programs, events, support, or how to get involved.`,
      inputSchema: {
        query: z.string().describe("Search query for services or get involved"),
      },
      _meta: {
        "openai/toolInvocation/invoking": `Searching ${orgName} resources...`,
        "openai/toolInvocation/invoked": "Resources found",
      },
    },
    async (args) => {
      const q = args?.query || "";
      const matches = searchResources(q);
      if (matches.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No resources found for "${q}". Try different keywords or browse the widget for Services and Get Involved.`,
            },
          ],
        };
      }
      const lines = matches.slice(0, 8).map((r) => `• ${r.title} (${r.category})`);
      const text = `Found ${matches.length} resource(s):\n\n${lines.join("\n")}`;
      return {
        content: [{ type: "text", text }],
        structuredContent: { query: q, count: matches.length, resources: matches.slice(0, 8) },
        _meta: {},
      };
    }
  );

  return server;
}

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

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain" }).end(`${orgName} MCP server`);
    return;
  }

  if (req.method === "GET") {
    let path = decodeURIComponent(url.pathname);
    if (path.startsWith("/")) path = path.slice(1);
    if (path === "" || path === "index.html") path = "index.html";
    const filePath = join(appDir, path);
    if (!filePath.startsWith(appDir) || !existsSync(filePath)) {
      res.writeHead(404).end("Not Found");
      return;
    }
    try {
      const body = readFileSync(filePath);
      const ext = extname(path).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";
      res.writeHead(200, { "content-type": contentType }).end(body);
      return;
    } catch (err) {
      res.writeHead(500).end("Error");
      return;
    }
  }

  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`${orgName} MCP: http://localhost:${port}${MCP_PATH}`);
});
