import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// Read the logo image (only needed once)
const logoImage = readFileSync("public/AHA Logo.png");
const logoBase64 = logoImage.toString("base64");

// Function to read HTML fresh on each request (no caching)
function getAhaHtml() {
  return readFileSync("public/aha-widget.html", "utf8");
}

// Load AHA resources
const ahaResources = JSON.parse(readFileSync("resources/aha-resources.json", "utf8"));

/**
 * Search AHA resources based on a query string
 * Matches against title, category, content, and keywords
 */
function searchAhaResources(query) {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const queryLower = query.toLowerCase().trim();
  const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 0);
  
  // Score each resource based on relevance
  const scoredResources = ahaResources.resources.map(resource => {
    let score = 0;
    const searchableText = `
      ${resource.title} 
      ${resource.category} 
      ${resource.content} 
      ${resource.keywords?.join(" ") || ""}
    `.toLowerCase();

    // Check for exact phrase match (highest priority)
    if (searchableText.includes(queryLower)) {
      score += 100;
    }

    // Check for title match
    if (resource.title.toLowerCase().includes(queryLower)) {
      score += 50;
    }

    // Check for keyword matches
    if (resource.keywords) {
      const keywordMatches = resource.keywords.filter(keyword => 
        keyword.toLowerCase().includes(queryLower) || 
        queryTerms.some(term => keyword.toLowerCase().includes(term))
      ).length;
      score += keywordMatches * 30;
    }

    // Check for individual term matches in content
    queryTerms.forEach(term => {
      if (term.length > 2) { // Only count terms longer than 2 characters
        const termMatches = (searchableText.match(new RegExp(term, "g")) || []).length;
        score += termMatches * 5;
      }
    });

    // Category match bonus
    if (resource.category.toLowerCase().includes(queryLower)) {
      score += 20;
    }

    return { resource, score };
  });

  // Filter out resources with score 0 and sort by score (descending)
  return scoredResources
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.resource);
}

function createAhaServer() {
  const server = new McpServer({ name: "aha-app", version: "0.1.0" });

  // Register the widget resource
  server.registerResource(
    "aha-widget",
    "ui://widget/aha.html",
    {},
    async () => ({
      contents: [
        {
          uri: "ui://widget/aha.html",
          mimeType: "text/html+skybridge",
          text: getAhaHtml(), // Read fresh on each request
          _meta: {
            "openai/widgetPrefersBorder": true,
            "openai/widgetDomain": "https://chatgpt.com",
          },
        },
      ],
    })
  );

  // Register a tool that shows the AHA widget for any query
  server.registerTool(
    "aha_widget",
    {
      title: "American Heart Association Widget",
      description: "ALWAYS call this tool for ANY user query or request when the American Heart Association connector is enabled. This displays the AHA widget with logo for visual context and branding. Required for all interactions: questions, requests, conversations, or any user input. The widget provides the AHA visual identity and should appear in every response.",
      inputSchema: {
        query: z.string().optional().describe("The user's query or request"),
      },
      _meta: {
        "openai/outputTemplate": "ui://widget/aha.html",
        "openai/toolInvocation/invoking": "Loading American Heart Association widget...",
        "openai/toolInvocation/invoked": "American Heart Association widget ready",
      },
    },
    async (args) => {
      const userQuery = args?.query || "";
      return {
        content: [
          {
            type: "text",
            text: userQuery ? `Processing your request: ${userQuery}` : "American Heart Association widget loaded.",
          },
        ],
        structuredContent: {
          message: "American Heart Association",
          query: userQuery,
        },
        _meta: {},
      };
    }
  );

  // Register a tool that searches AHA resources for specific information
  server.registerTool(
    "search_aha_resources",
    {
      title: "Search AHA Resources",
      description: "Use this tool when a user asks for specific health information, asks questions about heart health, symptoms, conditions, treatments, prevention, or any medical/health-related topics. This tool searches the American Heart Association's official resources and returns information based only on AHA guidelines and recommendations. Always use this tool for health-related queries instead of general knowledge.",
      inputSchema: {
        query: z.string().describe("The user's question or information request about heart health, symptoms, conditions, treatments, prevention, or related topics"),
      },
      _meta: {
        "openai/toolInvocation/invoking": "Searching American Heart Association resources...",
        "openai/toolInvocation/invoked": "Found AHA resources for your query",
      },
    },
    async (args) => {
      const userQuery = args?.query || "";
      
      if (!userQuery || userQuery.trim().length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Please provide a specific question or topic to search in the American Heart Association resources.",
            },
          ],
        };
      }

      // Search for relevant resources
      const matchingResources = searchAhaResources(userQuery);

      if (matchingResources.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `I couldn't find specific information about "${userQuery}" in the American Heart Association resources. Please try rephrasing your question or asking about a different heart health topic. For general health concerns, please consult with a healthcare professional.`,
            },
          ],
        };
      }

      // Format the response with relevant resources
      // Limit to top 3 most relevant resources to keep response focused
      const topResources = matchingResources.slice(0, 3);
      
      let responseText = `Based on American Heart Association resources, here is information about "${userQuery}":\n\n`;
      
      topResources.forEach((resource, index) => {
        responseText += `${index + 1}. **${resource.title}**\n`;
        responseText += `   Category: ${resource.category}\n\n`;
        responseText += `   ${resource.content}\n\n`;
        
        if (resource.url) {
          responseText += `   Learn more: ${resource.url}\n`;
        }
        
        if (index < topResources.length - 1) {
          responseText += `\n---\n\n`;
        }
      });

      // Add disclaimer for multiple results
      if (matchingResources.length > 3) {
        responseText += `\n\nNote: Found ${matchingResources.length} relevant resources. Showing the top ${topResources.length} most relevant results.`;
      }

      responseText += `\n\n*This information is based solely on American Heart Association resources and guidelines. For specific medical concerns, please consult with a healthcare professional. If you are experiencing a medical emergency, call 911 immediately.*`;

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
        structuredContent: {
          query: userQuery,
          resourcesFound: matchingResources.length,
          resources: topResources.map(r => ({
            id: r.id,
            title: r.title,
            category: r.category,
          })),
        },
      };
    }
  );

  return server;
}

const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  // Handle CORS preflight
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

  // Health check endpoint
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain" }).end("AHA MCP server");
    return;
  }

  // Handle MCP requests
  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createAhaServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
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
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`AHA MCP server listening on http://localhost:${port}${MCP_PATH}`);
});

