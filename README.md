# Altai

**The sovereign external-action layer for air-gapped enterprise AI agents.**

Enterprises are deploying internal AI agents behind a hard rule from their CISO/DSI: **no outbound network access**. The agent runtime is air-gapped — no web, no third-party APIs, no Tor. This is the correct security posture, and it creates a real problem: the firm wants external intelligence, but forbids its own agents from reaching out to get it.

Altai closes that gap. A sealed internal agent **dispatches a mission** through a single audited egress. An isolated fleet of specialized external agents acts on the outside world — the open web, firewall-blocked sites, breach APIs, and Tor — a multi-agent **security membrane** verifies and cryptographically signs everything that crosses back, and the firm receives a **sanitized, sourced, signed intelligence brief**. The firm's identity and queries never touch the wire.

> Like a watchtower on high ground: your agents see across the whole valley while never leaving their own peak.

---

## Table of contents

- [Why Altai](#why-altai)
- [Architecture](#architecture)
- [How it works (the six layers)](#how-it-works-the-six-layers)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Running the system](#running-the-system)
- [API reference](#api-reference)
- [Data contracts](#data-contracts)
- [Security model](#security-model)
- [Testing](#testing)
- [Tech stack](#tech-stack)
- [Roadmap](#roadmap)

---

## Why Altai

| Problem | Today | With Altai |
|---|---|---|
| Internal agents are air-gapped by policy | They simply can't answer questions about the outside world | They dispatch a mission to a governed egress and get a structured answer back |
| External intelligence is needed (breaches, leaks, alt-data) | Static vendor feeds for humans, or a slow analyst | An agent-native, on-demand fleet returns a tradeable, sourced signal |
| Reaching closed/dark sources is risky and non-compliant | Breaks the security posture, or doesn't happen | Identity-isolated egress, defensive/read-only, every action audited |
| "How do we trust what comes back?" | No provenance, no guarantees | Ed25519-signed brief over a tamper-evident Merkle audit ledger |

Altai is **not a proxy or a VPN**. The value is the governance and verification around the egress: a policy engine, identity isolation, an adversarial inbound membrane, and cryptographic attestation. The proxy is the boring part; the moat is everything around it.

### Example use case

A desk wants to know whether a public company has been compromised *before the market does*. The internal (sealed) agent dispatches the question. Altai's fleet finds the leak on a dark-web forum, cross-checks breach APIs, fuses the sources into a confidence score, and returns a signal stamped with **when Altai would have known vs. when the company disclosed publicly** — plus the implied short return over that window. Every step is in the signed audit log.

---

## Architecture

Two Docker networks enforce the air-gap at the network layer. The sealed side has **no route to the internet**; its only reachable host is the Altai gateway. The gateway is the single bridge between the sealed network and the outside world.

```
            SEALED NETWORK  (docker network: internal, internal=true — NO internet)
          ┌───────────────────────────────────────────────────────────────────────┐
          │   apps/internal  (Next.js, served under /bank)                          │
          │   ┌─────────────────────────────────────────────┐                       │
          │   │  Sealed agent                                │                       │
          │   │  • holds NO api keys                         │                       │
          │   │  • fetch_url()  → fails (no route out)       │                       │
          │   │  • dispatch()   → only egress that works ────┼──┐                    │
          │   └─────────────────────────────────────────────┘  │                    │
          └────────────────────────────────────────────────────┼────────────────────┘
                                                                 │ the only hole in the wall
                                                                 ▼
            ALTAI GATEWAY  (docker network: internal + external — the single bridge)
          ┌───────────────────────────────────────────────────────────────────────┐
          │   apps/external  (Next.js: gateway + fleet + membrane + ops-center UI)   │
          │                                                                         │
          │   1. DISPATCH        receive mission (validated against the contract)    │
          │   2. POLICY          allow/deny sources, scope, spend — reject early     │
          │   3. IDENTITY        strip client identity; act under Altai egress       │
          │   4. EXECUTION  ───────────────────────────────────────────────┐        │
          │        Planner → Web Scout · Tor Scout · Breach Scout           │        │
          │   5. MEMBRANE   Sanitizer · Injection Hunter · Judge            │        │
          │   6. AUDIT      Merkle ledger + Ed25519 signature → SignedBrief │        │
          │                                                                 │        │
          │   SignedBrief ◄── sanitized, signed, provenance-stamped ◄───────┘        │
          └───────────────────────────────┬─────────────────────────────────────────┘
                                           │
                                           ▼
            OUTSIDE WORLD  (docker network: external — internet + Tor)
          ┌───────────────────────────────────────────────────────────────────────┐
          │   open web · firewall-blocked sites · breach APIs (HIBP/IntelX)         │
          │   Tor daemon (SOCKS5 :9050) → .onion / dark-web sources                 │
          └───────────────────────────────────────────────────────────────────────┘
```

Two consequences fall out of the topology, and both are demonstrable:

- The sealed container genuinely cannot reach the internet (`curl https://google.com` times out). Its only reachable host is the gateway.
- The Anthropic/OpenAI API key lives **only** on the gateway. The sealed environment holds no credentials and has no wire access.

---

## How it works (the six layers)

Every mission crosses six layers; every action is recorded into the audit ledger.

1. **Dispatch** — the sealed agent's only egress. The mission is parsed and validated against the shared `Mission` contract.
2. **Policy** — per-tenant governance: source allow/deny-list, scope (`osint_readonly`), data classes, spend caps. Out-of-policy missions are rejected before any execution.
3. **Identity isolation** — the client's identity, IP, and raw query never leave the gateway. The fleet acts under Altai's own egress.
4. **Execution** — a `Planner` decomposes the mission and runs specialized scouts in parallel:
   - **Web Scout** — open web + firewall-blocked sites.
   - **Tor Scout** — Ahmia discovery + a live `.onion` fetch over SOCKS5, reporting the real Tor exit IP and country.
   - **Breach Scout** — HIBP / IntelX breach corroboration.
5. **Membrane** — an adversarial inbound panel. Nothing crosses back until it passes:
   - **Sanitizer** — strips PII, secrets, and malware from anything returned.
   - **Injection Hunter** — scans fetched dark-web/web content for prompt-injection and identity-exfil attempts; quarantines on hit.
   - **Judge** — requires a clean pass, then signs the brief.
6. **Audit & attestation** — every action is hash-chained into a Merkle ledger; the Judge signs `canonical(signal) + merkleRoot` with Ed25519. The sealed side independently verifies the signature against the embedded public key. Tampering with any audit entry breaks the recomputed root while the signature stays valid — i.e. tampering is mathematically detectable.

**Signal intelligence.** Findings are fused into a single confidence via **noisy-OR** over independent sources, and (for finance use cases) wrapped in an **AlphaCard**: lead-time vs. public disclosure and the implied return of shorting the window, computed from the real price series.

---

## Project structure

A pnpm + Turborepo monorepo. TypeScript end to end, with a single shared contract package every other package codes against.

```
altai/
├── apps/
│   ├── external/            Gateway + agent fleet + membrane + ops-center UI (port 3000)
│   │   ├── app/api/         missions · events (SSE) · signal · audit · tamper · prices · health
│   │   ├── app/page.tsx     Ops-center: live trace, signal card, stock overlay, audit ledger
│   │   └── lib/             gateway orchestration, mission store, real/fake fleet, membrane+seal
│   └── internal/            Sealed enterprise app (served under /bank, port 3100)
│       ├── app/page.tsx     Sealed chat: dispatch → await signed brief → verify signature
│       └── app/api/         dispatch · signal (proxies to the gateway, its only egress)
├── packages/
│   ├── contracts/           Zod schemas: Mission · Signal · AlphaCard · AuditEntry · SignedBrief · TraceEvent
│   ├── agents/              AI-SDK swarm (Planner, Scouts) + membrane (Sanitizer, Injection Hunter)
│   ├── crypto/              Ed25519 sign/verify + Merkle ledger + tamper helper
│   ├── tools/               web fetch · Tor SOCKS5 fetch · Ahmia · HIBP/IntelX
│   └── fixtures/            verified case data + price puller + confidence fusion / AlphaCard
├── docker-compose.yml       two networks (internal=true, external) — the cage
├── turbo.json               build/dev/test/typecheck pipeline
└── docs/superpowers/        architecture spec + phase plans
```

---

## Getting started

### Prerequisites

- **Node.js 22+**
- **pnpm 10+** (`corepack enable`)
- **Docker + Docker Compose** (for the full air-gapped topology)

### Install

```bash
git clone https://github.com/Symbioose/yc-hackathon.git
cd yc-hackathon
pnpm install
```

---

## Configuration

Copy `.env.example` to `.env` and fill in what you need. Out of the box, with no keys, the fleet runs a deterministic mocked fallback so the system is fully functional offline.

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | for real swarm | Enables the live LLM agent swarm. Without it, the mocked fallback runs. |
| `OPENAI_MODEL_STRONG` | for real swarm | Model id for the Planner and the membrane Judge. |
| `OPENAI_MODEL_FAST` | for real swarm | Model id for the scouts and verifiers. |
| `OPENAI_BASE_URL` | optional | Override the LLM endpoint (e.g. an on-prem inference proxy). |
| `HIBP_API_KEY` | optional | Live Have I Been Pwned breach lookups. |
| `INTELX_API_KEY` | optional | Live IntelX search. |
| `TOR_SOCKS_HOST` / `TOR_SOCKS_PORT` | optional | Tor SOCKS5 proxy (defaults `tor` / `9050` under Docker). |
| `USE_REAL_FLEET` | optional | `1` = run the real swarm; unset/`0` = mocked fallback. |
| `EXTERNAL_URL` | optional | Gateway URL the sealed app dispatches to (default `http://localhost:3000`). |
| `INTERNAL_URL` | optional | Internal app URL the gateway proxies `/bank/*` to (default `http://localhost:3100`). |

---

## Running the system

### Full topology (Docker — recommended)

This is the only mode that reproduces the real air-gap.

```bash
docker compose up --build
```

- Ops-center: <http://localhost:3000>
- Sealed enterprise app: <http://localhost:3000/bank>

Verify the cage is real:

```bash
docker compose exec internal-app curl https://google.com                  # times out — no internet
docker compose exec internal-app curl http://external-app:3000/api/health # 200 — only the gateway is reachable
```

### Local development (no Docker)

```bash
pnpm --filter @altai/external dev   # gateway + ops-center on :3000
pnpm --filter @altai/internal dev   # sealed app on :3100 (also reachable via :3000/bank)
```

Note: local dev does not enforce the network air-gap (that's a Docker-only guarantee); it's for fast iteration on the gateway, fleet, and UI.

### Workspace commands

```bash
pnpm build        # build all apps and packages (turbo)
pnpm test         # run the full test suite
pnpm typecheck    # typecheck the whole workspace

# refresh verified market data for the example case
pnpm --filter @altai/fixtures pull-prices
```

---

## API reference

The gateway (`apps/external`) exposes the egress and observability surface.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/missions` | Dispatch a mission. Body: a `Mission`. Returns `{ id }`. |
| `GET` | `/api/events` | Server-Sent Events firehose of `TraceEvent`s and the final `signal`. |
| `GET` | `/api/missions/:id/signal` | The `SignedBrief` once ready (`202` while in progress). |
| `GET` | `/api/missions/:id/audit` | Audit ledger + `signature_valid` + `ledger_ok`. |
| `POST` | `/api/missions/:id/tamper` | Demo control: mutate one ledger entry to show tamper-evidence. |
| `GET` | `/api/prices/:ticker` | Daily close series for the overlay chart (market data, outside the signed payload). |
| `GET` | `/api/health` | Liveness probe. |

The sealed app (`apps/internal`, under `/bank`) exposes only its egress:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/bank/api/dispatch` | The sealed agent's single outbound action → forwards to the gateway. |
| `GET` | `/bank/api/signal/:id` | Fetches the brief from the gateway and verifies the Ed25519 signature locally. |

---

## Data contracts

All packages code against `@altai/contracts` (Zod schemas → inferred TypeScript types). The core objects:

```ts
Mission           // what the sealed agent dispatches
{ id, query, target_entity?, ticker?, allowed_sources[], scope: "osint_readonly",
  data_classes[], max_spend_usd }

SourceContribution // one independent corroborating source (feeds confidence fusion)
{ name, type: "tor_forum"|"breach_api"|"paste"|"press"|"filing", url?, reliability, observed_at }

Signal            // the structured intelligence output
{ entity, ticker?, event_type, sources[], confidence, confidence_method: "noisy_or",
  observed_at, disclosed_at?, lead_time_days?, alpha?, summary }

AlphaCard         // quant framing: short-the-leak window
{ strategy, entry_date, exit_date, entry_price?, exit_price?, return_pct?, note? }

AuditEntry        // hash-chained Merkle leaf
{ seq, ts, actor, action, source?, target?, hash, prev_hash }

SignedBrief       // what crosses back to the sealed agent
{ signal, audit_root, signature, public_key }

TraceEvent        // streamed over SSE; drives the ops-center
{ mission_id, ts, layer, agent, level, msg, meta? }
```

---

## Security model

- **Network air-gap.** The sealed network is `internal=true` — no NAT, no route to the internet. The only reachable host is the gateway. Enforced by Docker, not by application code.
- **No credentials on the sealed side.** API keys live only on the gateway. The sealed environment can't leak what it doesn't hold.
- **Identity isolation.** The client's identity, IP, and raw query never leave the gateway; the fleet acts under Altai's egress.
- **Defensive / read-only.** Scope is fixed to OSINT read-only. The fleet observes and reports; it never transacts.
- **Inbound membrane.** Returned content is sanitized (PII/secrets/malware) and scanned for prompt-injection before it can reach the sealed agent.
- **Tamper-evident provenance.** Every action is hash-chained into a Merkle ledger; the brief is Ed25519-signed over the signal plus the Merkle root. Altering any entry breaks the recomputed root, and the sealed side detects it on verification.

---

## Testing

```bash
pnpm test        # all packages
pnpm typecheck   # all packages
```

Coverage spans the contract schemas, the crypto (Ed25519 round-trip, Merkle root, tamper detection), the tools (web/breach), the agents (planner synthesis, membrane injection detection), and the fixtures (confidence fusion and AlphaCard computation).

---

## Tech stack

- **Language:** TypeScript across the whole monorepo.
- **Apps:** Next.js 15 (App Router), React 19.
- **Agents:** Vercel AI SDK (`ai` + `@ai-sdk/openai`) — provider-agnostic (one-import swap).
- **Contracts:** Zod.
- **Crypto:** Node `crypto` (Ed25519) + a hand-rolled Merkle ledger.
- **Egress:** `fetch-socks` over a Tor SOCKS5 daemon; native `fetch` for clear-web and breach APIs.
- **Market data:** `yahoo-finance2`.
- **Tooling:** pnpm workspaces + Turborepo.
- **Runtime:** Docker Compose, two networks (the cage).

---

## Roadmap

- **Intelligence Network — the compounding moat.** Not a knowledge graph of *facts* (what is true) but a learned navigation network (*how* information is found). Where a fact store memorizes destinations, Altai records **routes**: which source types yield corroborated signals for which mission types, in what order, at what cost and latency — a weighted graph of discovery that every mission walks and updates. A new mission is matched against similar past ones to retrieve the search trajectory that worked, so each investigation is faster, cheaper, and more accurate than the last. This is *procedural* memory — how to search — not a fact dump that goes stale. The reward signal is free and trustworthy because **the membrane is the oracle**: a path is reinforced only when its signal is corroborated by independent sources (noisy-OR), passes the Judge, and is signed; paths that lead into quarantine, poison, or dead ends are down-weighted. Exposed through the MCP server below, the network compounds across every connected agent — a data network effect, not a proxy anyone can re-implement in a weekend.
  - *Privacy by construction.* What persists is abstracted, entity-stripped structure (source reliability, plan shapes, link patterns) — never the raw target or query — so the network cannot reconstruct who asked what. The egress's identity-isolation guarantee, applied to memory.
- **MCP server** — expose `altai.dispatch` / `altai.fetch_signal` as Model Context Protocol tools so any MCP-capable agent (Claude Desktop, Cursor, …) can call Altai natively.
- **On-prem / local inference** — run the agents on local open-weight models behind the gateway so the client's queries never leave the perimeter (SGX / confidential compute for attestation).
- **Expanded sources** — Telegram channels, paste sites, additional breach providers, and pluggable OSINT connectors.
- **Marketplace** — open the fleet to third-party specialized agent providers that bid on dispatched missions.
- **Policy & multi-tenancy** — a real policy editor, per-tenant isolation, spend metering, and exportable compliance reports.

---

## License

Proprietary — all rights reserved.
