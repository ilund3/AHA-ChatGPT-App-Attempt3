#!/usr/bin/env bash
# Start all 15 ngrok endpoints using your default ngrok config (authtoken) + GPT Apps endpoints.
# Run from GPT Apps directory. Requires: MCP servers already running (npm run start:all in another terminal).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default ngrok config path (has your authtoken); merge with our endpoints config
if [[ "$OSTYPE" == "darwin"* ]]; then
  DEFAULT_CONFIG="$HOME/Library/Application Support/ngrok/ngrok.yml"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
  DEFAULT_CONFIG="$LOCALAPPDATA/ngrok/ngrok.yml"
else
  DEFAULT_CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/ngrok/ngrok.yml"
fi

if [[ ! -f "$DEFAULT_CONFIG" ]]; then
  echo "Default ngrok config not found at: $DEFAULT_CONFIG"
  echo "Run 'ngrok config check' to see your config path, then merge manually:"
  echo "  ngrok start --all --config \"YOUR_DEFAULT_CONFIG,$SCRIPT_DIR/ngrok-gpt-apps.yml\""
  exit 1
fi

echo "Using your ngrok account (from $DEFAULT_CONFIG) + 15 GPT App endpoints."
echo "Each endpoint will get an https URL; use that URL + /mcp in ChatGPT."
echo ""
echo "If you see 'endpoint is already online': stop any other ngrok (e.g. AHA tunnel) first, then run this again."
echo ""
exec ngrok start --all --config "$DEFAULT_CONFIG" --config "$SCRIPT_DIR/ngrok-gpt-apps.yml"
