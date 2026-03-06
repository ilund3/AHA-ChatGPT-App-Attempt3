# MCP server URLs (one per app)

## Why "Unsafe URL" with localhost?

Clients like **Cursor** and **ChatGPT** only accept **HTTPS** URLs for MCP/connectors. `http://localhost:8787/mcp` is treated as unsafe and rejected. The AHA app works because it’s exposed via **ngrok**, which gives you an `https://...` URL that tunnels to your local server.

**To replicate the AHA setup:** run your app locally, then run **ngrok** against that port and use the **https** URL (with `/mcp`) in your client.

---

## 1. Run MCP servers locally

From the **GPT Apps** directory:

```bash
cd "GPT Apps"
npm run start:all
```

Local URLs (for ngrok or local tools only; clients will reject these as unsafe):

| # | Organization | Slug | Port | Local URL (unsafe in Cursor/ChatGPT) |
|---|--------------|------|------|--------------------------------------|
| 1 | Sjögren's Foundation | sjogrens-foundation | 8787 | http://localhost:8787/mcp |
| 2 | Spina Bifida Association | spina-bifida-association | 8788 | http://localhost:8788/mcp |
| 3 | National Psoriasis Foundation | national-psoriasis-foundation | 8789 | http://localhost:8789/mcp |
| 4 | Cerebral Palsy Foundation | cerebral-palsy-foundation | 8790 | http://localhost:8790/mcp |
| 5 | Cystic Fibrosis Foundation | cystic-fibrosis-foundation | 8791 | http://localhost:8791/mcp |
| 6 | Parkinson's Foundation | parkinsons-foundation | 8792 | http://localhost:8792/mcp |
| 7 | Alzheimer's Association | alzheimers-association | 8793 | http://localhost:8793/mcp |
| 8 | Food Allergy Research & Education (FARE) | fare | 8794 | http://localhost:8794/mcp |
| 9 | Arthritis Foundation | arthritis-foundation | 8795 | http://localhost:8795/mcp |
| 10 | Hydrocephalus Association | hydrocephalus-association | 8796 | http://localhost:8796/mcp |
| 11 | Blood Cancer United | blood-cancer-united | 8797 | http://localhost:8797/mcp |
| 12 | American Foundation for Suicide Prevention | afsp | 8798 | http://localhost:8798/mcp |
| 13 | American Cancer Society | american-cancer-society | 8799 | http://localhost:8799/mcp |
| 14 | PCOS Challenge | pcos-challenge | 8800 | http://localhost:8800/mcp |
| 15 | National MS Society | national-ms-society | 8801 | http://localhost:8801/mcp |

---

## 2. Expose one app with ngrok (safe HTTPS URL)

1. **Start only that app** (so it binds to one port), e.g. Sjögren's on 8787:

   ```bash
   cd "GPT Apps"
   APP_SLUG=sjogrens-foundation PORT=8787 npm start
   ```

2. **In another terminal**, run ngrok against that port:

   ```bash
   ngrok http 8787
   ```

3. **Use the HTTPS URL** ngrok prints, with `/mcp`:

   - Example: `https://abc123.ngrok-free.app/mcp`
   - Put that URL in Cursor (MCP settings) or ChatGPT (Connectors). No "Unsafe URL" error.

---

## 3. One separate URL per app (recommended for ChatGPT)

So each app shows **separately** in ChatGPT, use 15 separate ngrok processes (one URL per app).

**Step 1 – Stop any existing ngrok** (so ports are free):

```bash
pkill -f "ngrok" || true
```

**Step 2 – Start all 15 MCP servers** (terminal 1):

```bash
cd "GPT Apps"
npm run start:all
```

**Step 3 – Start 15 separate ngrok tunnels** (terminal 2):

```bash
cd "GPT Apps"
node start-ngrok-separate.js
```

The script starts 15 ngrok processes (one per app), waits for them to register, then prints a table of **15 different MCP URLs** and saves it to **NGROK-ENDPOINTS.md**.

**Step 4 – Add all 15 in ChatGPT**

- Settings → Connectors → Create a connector for **each** row in the table.
- Paste that row’s MCP URL and name it (e.g. "Sjögren's Foundation", "Parkinson's Foundation").
- You’ll have 15 separate connectors; each app appears on its own in ChatGPT.

To stop all ngrok tunnels: `pkill -f 'ngrok http'`

---

**Alternative: one shared URL** (all 15 apps behind a single ngrok URL):

```bash
./start-ngrok-all.sh
```

Then add **one** connector in ChatGPT with that URL + `/mcp`. You won’t get 15 separate connectors.

---

**Health check (browser):** `http://localhost:8787/` … `http://localhost:8801/`  
**Widget test page:** `http://localhost:8787/index.html` … `http://localhost:8801/index.html`
