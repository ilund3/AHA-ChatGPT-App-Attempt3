# GPT Apps – Organization widget templates

This folder contains one app per organization. Each app is a replica of the AHA widget template with:

- **Theme color** – Replaced with the organization’s hex color throughout the widget.
- **Get Involved** – Replaced with that organization’s Get Involved resource titles.
- **Services** – Replaced with that organization’s Services resource titles.

## Structure (per app)

- `public/widget.html` – Full widget HTML (theme, Get Involved list, Services list).
- `index.html` – Simple test page that loads the widget in an iframe.
- `resources/<slug>-resources.json` – Services and Get Involved as JSON for future MCP/server use.
- `server.js` – Minimal static file server for local testing.
- `package.json` – Run script for the server.

## Run one MCP server (single app)

```bash
cd "GPT Apps"
APP_SLUG=sjogrens-foundation PORT=8787 npm start
```

Then the MCP URL is **http://localhost:8787/mcp**. Open http://localhost:8787/ for health and http://localhost:8787/index.html to view the widget.

## Run all 15 MCP servers

```bash
cd "GPT Apps"
npm run start:all
```

This starts one MCP server per app on ports **8787–8801**. All URLs are listed in **MCP-URLs.md**.

**Run all 15 apps over HTTPS and use them in ChatGPT as `https://..../mcp`:** In terminal 1 run `npm run start:all`. In terminal 2 run `./start-ngrok-all.sh` (uses your default ngrok account). Add each of the 15 HTTPS URLs + `/mcp` as a connector in ChatGPT. See **MCP-URLs.md** section 3.

If Cursor or ChatGPT shows **"Unsafe URL"** for `http://localhost:.../mcp`, use **ngrok** to expose a port and get an `https://` URL; see **MCP-URLs.md** for step-by-step instructions (same approach as the main AHA app).

## Rebuild all widgets

From the **project root**:

```bash
node "GPT Apps/build-widgets.js"
```

This reads `organizations.json` and `public/aha-widget.html`, then regenerates each app’s `public/widget.html`, `index.html`, resources, `server.js`, and `package.json`.

## Organizations (15)

- Sjögren's Foundation
- Spina Bifida Association
- National Psoriasis Foundation
- Cerebral Palsy Foundation
- Cystic Fibrosis Foundation
- Parkinson's Foundation
- Alzheimer's Association
- Food Allergy Research & Education (FARE)
- Arthritis Foundation
- Hydrocephalus Association
- Blood Cancer United
- American Foundation for Suicide Prevention (AFSP)
- American Cancer Society
- PCOS Challenge
- National MS Society
