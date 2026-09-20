# Planty 🌿

Track your house plants — location, light needs, and a watering (and
"move to brighter light") schedule — with optional Home Assistant
integration for reminders, and room to grow into live light/moisture
sensor readings.

Runs two ways from the same codebase:

- **Standalone**, via Docker/docker-compose, anywhere Docker runs.
- **As a Home Assistant addon**, added from this repo as a custom addon
  repository.

## Features (phase 1)

- Add plants with species, location, light requirement, photo, and notes.
- Per-plant care tasks (watering, move-to-brighter-light, fertilizing, or a
  custom task) on a repeating interval, with a dashboard showing what's
  overdue, due soon, or on track.
- Home Assistant integration via MQTT discovery: once you point Planty at
  your MQTT broker (Settings page), each plant's care tasks are published as
  HA entities (`sensor.*_next_due`, `binary_sensor.*_overdue`) that you can
  use in your own HA automations/notifications — Planty doesn't need to know
  about your notification setup at all.
- Link a light or moisture sensor to a plant by MQTT topic (e.g. from
  Zigbee2MQTT, or Home Assistant's `mqtt_statestream`); Planty subscribes and
  shows the latest reading on the plant's page.

**Phase 2 (planned):** printing plant labels (name, species, light, watering
interval, location) on a Brother QL700 label printer.

## Running standalone (Docker)

```bash
docker compose up -d --build
```

Then open `http://<host>:8080`. Data (SQLite DB + uploaded photos) is stored
in `./data`, which is bind-mounted into the container so it survives
rebuilds.

## Running as a Home Assistant addon

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store → ⋮ → Repositories**.
2. Add this repository's URL: `https://github.com/wilco20004/planty`.
3. Find **Planty** in the store, install, and start it.
4. Open it from the sidebar (Ingress) or via the "Open Web UI" link.

The addon's data lives in `/data`, which Home Assistant persists
automatically across restarts and addon updates.

## Connecting to Home Assistant for schedules

Whichever way you run it, open **Settings** inside Planty and enter your
MQTT broker details (e.g. the Mosquitto broker addon: host
`core-mosquitto`, port `1883`, with a Home Assistant user's credentials).
Planty will connect and publish each plant's tasks via MQTT discovery —
Home Assistant will pick up the new entities automatically, no YAML needed.
Build your own automations on top, e.g.:

```yaml
automation:
  - alias: Notify when a plant needs watering
    trigger:
      - platform: state
        entity_id: binary_sensor.planty_monstera_watering_overdue
        to: "on"
    action:
      - service: notify.mobile_app_your_phone
        data:
          message: "{{ trigger.to_state.attributes.friendly_name }} needs watering!"
```

## AI species lookup (MCP server)

`mcp/` is a [Model Context Protocol](https://modelcontextprotocol.io) server
that exposes Planty's custom species database as tools for an MCP-capable AI
client (e.g. Claude Desktop or Claude Code). Point an AI at a plant photo and
ask it to identify the species and add it to Planty — the AI does the visual
identification itself and calls these tools to save the result:

- `search_species` — search local + Perenual species by name (check for
  duplicates before adding)
- `get_perenual_species_detail` — pull richer reference data from Perenual by id
- `list_species` / `get_species` — browse the local database
- `add_species` — create a new species (only `common_name` is required; the AI
  fills in whatever care details it can determine)
- `update_species` / `delete_species` — edit or remove existing entries

Build it once:

```bash
npm install
npm run build:mcp
```

Then point your MCP client at `mcp/dist/index.js`. For Claude Desktop, add to
its config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "planty": {
      "command": "node",
      "args": ["C:/path/to/Planty/mcp/dist/index.js"],
      "env": {
        "PLANTY_API_URL": "http://localhost:8080"
      }
    }
  }
}
```

Set `PLANTY_API_URL` to wherever your Planty instance is reachable (defaults
to `http://localhost:8080` if omitted). The MCP server talks to Planty's
existing REST API — no separate credentials needed.

## Planty Slicer (browser-based slicer for the Flashforge Adventurer 5M)

`slicer/` is a standalone, fully client-side 3D print slicer focused on the
Flashforge Adventurer 5M / 5M Pro: load STL/3MF/OBJ, arrange, slice with
Orca-derived Flashforge profiles, preview toolpaths and download (or send over
LAN) ready-to-print G-code. Everything runs in the browser — nothing is uploaded.

```bash
npm install
npm run dev:slicer     # http://localhost:5173
npm run build:slicer   # static site in slicer/dist
```

See [`slicer/README.md`](slicer/README.md) for features, architecture and limits.

## Development

This is an npm workspaces monorepo:

- `server/` — Express + TypeScript API, SQLite (better-sqlite3) storage, MQTT
  client for Home Assistant discovery and sensor ingestion.
- `web/` — React + Vite + TypeScript frontend.
- `mcp/` — Model Context Protocol server exposing the species database as
  AI-callable tools (see "AI species lookup" above).
- `slicer/` — browser-based 3D print slicer for the Flashforge Adventurer 5M
  (React + Three.js + a Clipper-based slicing engine in a Web Worker).

```bash
npm install
npm run dev:server   # API on :8080
npm run dev:web      # Vite dev server on :5173, proxies /api to :8080
```

Production build (used by the Dockerfile): `npm run build` builds the web
app into `web/dist` and compiles the server into `server/dist`; the server
serves the built frontend directly, so `npm start` alone is enough to run
everything from one process.
