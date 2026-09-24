# Discord Integration & Selective Sync API

Self-hosted microservice and frontend portal for integrating Discord with Matrix Synapse, providing real-time Discord server inspection, ID extraction, and selective server bridging into Element.

---

## Features

- **Live Discord API Inspector**: Queries Discord's official `/users/@me/guilds` and `/users/@me` endpoints in real-time to list all servers belonging to the authenticated account.
- **Server ID Extractor**: 1-click clipboard copy for individual Discord IDs, mass ID copy, and export to JSON or CSV.
- **Selective Syncing**: Pick and choose specific Discord servers to bridge into Matrix/Element rather than flooding your client with every channel.
- **Automated Matrix Bridging**: Handles double-puppeting (`login-matrix`) and space orchestration via `mautrix-discord`.
- **Caddy Reverse Proxy**: Clean URL routing for API endpoints, static assets, and the Matrix homeserver.

---

## Project Structure

```
├── auto_setup_service.py   # Python HTTP service handling Discord API proxying and Matrix bridge automation (Port 8089)
├── server-select.html      # Responsive Discord Server Inspector & Selective Sync UI
├── index.html              # Main Discord/Element integration onboarding portal
├── sync.ps1                # Automated 1-click PowerShell setup client helper
├── guilds.json             # Discovered guild cache
└── Caddyfile               # Production reverse proxy configuration
```

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/status` | Healthcheck endpoint |
| `GET` | `/api/discord/guilds` | Returns cached/discovered guilds from local bridge DB |
| `POST` | `/api/discord/fetch-account-guilds` | Queries live Discord API using user token and returns account info + servers |
| `POST` | `/api/bridge-guilds` | Bridges selected Discord server IDs to the user's Matrix account |
| `POST` | `/api/auto-setup` | Full automated login, token linking, and Space configuration |

---

## Setup & Deployment

1. Run `auto_setup_service.py` as a systemd service on port `8089`:
   ```bash
   python3 auto_setup_service.py
   ```
2. Serve static files (`index.html`, `server-select.html`) via Caddy or Nginx.
3. Configure reverse proxy to route `/api/*` to `localhost:8089` and Matrix client traffic to port `8008`/`8007`.
