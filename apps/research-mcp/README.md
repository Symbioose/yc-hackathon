# @altai/research-mcp — Research MCP layer (adapter)

A thin **MCP-to-HTTP adapter** that exposes Altai's existing external research
pipeline (`apps/external`) as MCP tools over **Streamable HTTP**, so any
MCP-capable agent can launch missions. It owns **no** research logic, fleet,
mock data, audit or crypto — every tool call is forwarded to the external
gateway over `EXTERNAL_URL`. The MCP path and the direct HTTP path therefore run
the exact same governed pipeline (policy → identity → web/Tor/breach scouts →
membrane → Ed25519/Merkle audit).

## Tools → upstream mapping

| Tool | Forwards to |
|---|---|
| `dispatch_research_mission` (`entity`, `question`, `allowed_sources?`, `ticker?`) | `POST ${EXTERNAL_URL}/api/missions` → `{ mission_id }` (or `blocked` + reason) |
| `get_mission_status` (`mission_id`) | `GET ${EXTERNAL_URL}/api/missions/:id/signal` → `running` / `completed` |
| `fetch_signal` (`mission_id`) | `GET ${EXTERNAL_URL}/api/missions/:id/signal` + `/audit` → signed brief + audit ledger |

**Policy** is enforced upstream in `apps/external/lib/policy.ts` (at the mission
ingress), so both the MCP path and the direct API path block out-of-scope /
unsafe missions.

## Env

- `MCP_PORT` (default `3200`)
- `EXTERNAL_URL` (default `http://localhost:3000`; in Compose `http://external-app:3000`)

## Run

```bash
pnpm install
# the adapter needs the external pipeline running:
docker compose up --build research-mcp external-app internal-app

# local (no Docker), two terminals:
pnpm --filter @altai/external dev                                   # :3000
EXTERNAL_URL=http://localhost:3000 pnpm --filter @altai/research-mcp dev   # :3200
```

Health: `curl http://localhost:3200/health` → `{ ok, service, upstream }`.

### Quick manual call (dispatch)

```bash
curl -s http://localhost:3200/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"dispatch_research_mission","arguments":{"entity":"Live Nation","ticker":"LYV","question":"is this issuer compromised?","allowed_sources":["HIBP","Ahmia","press"]}}}'
```

Inside Compose the URL is `http://research-mcp:3200/mcp`.
