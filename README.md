# American Heart Association ChatGPT App

A simple ChatGPT app that displays the American Heart Association logo widget.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the MCP Server Locally

```bash
npm start
```

The server will start on `http://localhost:8787/mcp`

### 3. Test with MCP Inspector (Optional)

You can test your server locally using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector@latest http://localhost:8787/mcp
```

This will open a browser window where you can test your server and see the widget render.

### 4. Expose Your Server to the Internet

ChatGPT requires HTTPS. Use ngrok (or similar) to create a tunnel to your local server:

```bash
ngrok http 8787
```

This will give you a public URL like `https://<subdomain>.ngrok.app`

**Important:** Use the full URL with the `/mcp` path: `https://<subdomain>.ngrok.app/mcp`

### 5. Connect to ChatGPT

1. **Enable Developer Mode:**
   - Open ChatGPT
   - Go to **Settings** → **Apps & Connectors** → **Advanced settings**
   - Enable **Developer mode**

2. **Create a Connector:**
   - Go to **Settings** → **Connectors**
   - Click the **Create** button
   - Paste your ngrok URL with `/mcp` path (e.g., `https://<subdomain>.ngrok.app/mcp`)
   - Name it: "American Heart Association" (or any name you prefer)
   - Add a short description: "Displays the American Heart Association logo"
   - Click **Create**

3. **Use the App in ChatGPT:**
   - Open a new chat in ChatGPT
   - Click the **+** button to add connectors
   - Select your "American Heart Association" connector from the **More** menu
   - Type a prompt like: "Show me the American Heart Association logo" or "Display the AHA logo"
   - ChatGPT will call the `show_aha_logo` tool and display the widget

### 6. Refresh After Changes

If you make changes to your server or widget:
1. Rebuild/restart your server
2. In ChatGPT, go to **Settings** → **Connectors**
3. Select your connector
4. Click the **Refresh** button to pull the latest changes

## Project Structure

```
AHA-ChatGPT-App-Attempt3/
├── public/
│   └── aha-widget.html    # The widget HTML file
├── server.js              # MCP server implementation
├── package.json           # Dependencies
└── README.md              # This file
```

## Customization

To replace the SVG logo with an actual image file:

1. Add your logo image to the `public/` directory
2. Update `public/aha-widget.html` to use an `<img>` tag instead of the SVG:

```html
<img id="aha-logo" src="path/to/your/logo.png" alt="American Heart Association" />
```

Or if hosting externally, use the full URL.

## Troubleshooting

- **Widget doesn't appear:** Make sure the server is running and accessible via the ngrok URL
- **CORS errors:** The server includes CORS headers, but ensure ngrok is running
- **404 errors:** Verify you're using the full URL with `/mcp` path when creating the connector
- **Changes not showing:** Click the Refresh button in ChatGPT connector settings after making changes

## Next Steps

- Add more tools or functionality as needed
- Customize the widget design
- Add authentication if required
- Deploy to a production hosting service (Fly.io, Render, Railway, etc.)

