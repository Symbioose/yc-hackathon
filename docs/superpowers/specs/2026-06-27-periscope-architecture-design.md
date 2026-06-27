# Periscope — Architecture Design Spec

> **Status:** Draft for review (v2) · **Date:** 2026-06-27 · **Event:** Paris Builds (Unaite × YC), 36h, track *Software for Agents*
> **Scope of this doc:** the technical architecture we will build for the demo. Strategy/pitch live in the README; this is the engineering source of truth.

---

## 1. One-liner

Periscope is the **sovereign external-action layer for air-gapped enterprise agents**. A sealed internal agent (no internet) dispatches a mission through a single audited egress; an isolated fleet of specialized AI agents acts on the outside world (open web, Tor, breach APIs); a **multi-agent security membrane** verifies and cryptographically attests everything that crosses back in; the firm gets a sanitized, sourced, **signed, tradeable** intelligence brief without ever touching the wire.

---

## 2. Goals & non-goals

**Goals (what the demo must prove)**
1. The cage is **real** — the internal agent genuinely cannot reach the internet at the network layer.
2. The fleet **really acts** — at least one live Tor `.onion` fetch with a visible foreign exit IP.
3. The membrane **really protects** — a multi-agent adversarial panel catches a live prompt-injection and refuses to let it cross.
4. The result is **provably untampered** — Ed25519 signature + Merkle audit ledger, demonstrated live (incl. a tamper-demo).
5. The hero signal lands on a **real, indisputable breach** (SEC-documented) with a quantified **lead-time** and a **quant alpha framing**.
6. It is **visually impressive** and it **works** under demo conditions.

**Non-goals (explicitly killed for 36h)**
- Real zero-knowledge proofs, SGX/TEE attestation, Z3/formal verification → narrated as roadmap, not built.
- One container per fleet agent → fleet agents are async tasks in one service.
- Telegram/Telethon collection → later.
- Multi-tenant policy management UI → single hard-coded tenant policy.
- A bidding marketplace of agent providers → vision only.
- **Ollama / a real local weak model on the critical path** → off the critical path; see §3.

---

## 3. Stack (locked)

| Layer | Choice |
|---|---|
| Language | **TypeScript everywhere** |
| Apps & gateway | **Next.js (App Router)** — two apps |
| Agent orchestration | **Vercel AI SDK** (`ai` + `@ai-sdk/openai`) — provider-agnostic; reverting to Anthropic later is a one-import swap |
| LLM provider | **OpenAI** via `@ai-sdk/openai`. Models: `OPENAI_MODEL_FAST` (Scouts + verifiers) · `OPENAI_MODEL_STRONG` (Planner + Judge). Set exact IDs + `OPENAI_API_KEY` in `.env` (key lives only in `external-app`). |
| **Sealed agent brain** | `OPENAI_MODEL_FAST` **routed through the gateway's on-prem LLM proxy** (see §4.1) — *not* a local model |
| Ollama (optional, roadmap) | nice-to-have only: the "even a weak local model gets external reach" narrative. Never on the critical path. |
| Schemas / contract | **Zod** (shared package) |
| Live trace transport | **SSE** (AI SDK streaming → ops-center UI) |
| Tor | `tor` daemon container → SOCKS5 `127.0.0.1:9050`; fetch via `undici` + `socks-proxy-agent` |
| Breach / OSINT | HIBP / IntelX / Ahmia over plain HTTPS (`fetch`) |
| Backtest / alpha | `yahoo-finance2` (npm) |
| Crypto | `node:crypto` (Ed25519) + hand-rolled Merkle ledger |
| Packaging | pnpm workspace + Turborepo |
| Runtime | **Docker Compose**, 2 networks (see §5) |

**Why no Ollama on the critical path:** CPU-only in Docker on Mac (slow) and unreliable tool-calling on a 3B model = highest fragility-per-value. The sealed agent doesn't need to be impressive — it must only *fail to reach the internet* and *dispatch*. A network-sealed OpenAI agent is just as air-gapped, and far more reliable.

---

## 4. System overview

```
╔════════ DOCKER "internal" (network internal:true — NO internet) ════════╗
║  apps/internal (Next)                                                    ║
║   ├─ chat UI (sober)                                                     ║
║   └─ sealed agent (OpenAI brain via gateway proxy; holds NO API key)    ║
║        tools:  dispatch()  → the only egress that does anything external ║
║                fetch_url() → fails (no internet, network layer)          ║
║        only reachable host = external-app ──────────────────────────────╫─┐
╚════════════════════════════════════════════════════════════════════════╝ │ the only hole
                                                                             ▼
╔════════ DOCKER "external" (internet) ═══════════════════════════════════╗
║  apps/external (Next) = ON-PREM LLM PROXY + GATEWAY + FLEET + OPS UI     ║
║   /api/onprem-llm  → proxies sealed agent's OpenAI calls (key lives here)║
║   gateway: POST /missions · GET /missions/:id/stream (SSE) · /signal     ║
║   6 layers per mission:                                                  ║
║     1 Dispatch ingress                                                   ║
║     2 Policy Agent       (validate/reject before exec)                   ║
║     3 Identity isolation (client identity never leaves)                  ║
║     4 Execution = research swarm (Planner + Scouts)                      ║
║     5 Membrane           (core: Sanitizer + Injection Hunter + Judge;    ║
║                           extended: + Compliance Auditor)               ║
║     6 Audit & attestation (Merkle ledger + Ed25519 signature)           ║
║   ops-center UI: live trace · Tor circuit · signal+ALPHA card ·          ║
║                  confidence-fusion breakdown · audit log + TAMPER-DEMO   ║
║                  ◄── SSE                                                 ║
║  tor (daemon) ── SOCKS5 :9050 ──► .onion                                ║
╚═════════════════════════════════════════════════════════════════════════╝
```

### 4.1 Sealed agent brain (network-sealed OpenAI agent)
The sealed agent is a real OpenAI agent (`OPENAI_MODEL_FAST`), but its LLM calls go through `external-app`'s `/api/onprem-llm` proxy — the only host it can reach. Consequences:
- The internal container is on `internal:true` → **genuinely no internet** (`docker exec internal-app curl https://google.com` → timeout). Cage is real and demonstrable.
- The **OpenAI API key lives only in `external-app`**, never in the sealed container → the firm's environment holds no credentials and has no wire access. Extra air-gap talking point.
- Framing: the proxy is the "on-prem inference endpoint"; `dispatch` is the audited egress. The internal agent only ever talks to its local Periscope endpoint.
- `fetch_url()`/`search_web()` tools attempt real outbound requests → fail at the network layer → the agent concludes it must `dispatch`.

---

## 5. Docker topology

```yaml
networks:
  internal: { internal: true }   # no route to the internet
  external: {}                   # normal bridge, has internet

services:
  internal-app:  { networks: [internal] }            # Next chat + sealed agent (no API key)
  external-app:  { networks: [internal, external] }  # on-prem LLM proxy + gateway + fleet + ops UI (the bridge)
  tor:           { networks: [external] }            # tor daemon, SOCKS5 9050
  # ollama:      { networks: [internal] }            # OPTIONAL, off critical path
```

**Cage proof:** `internal-app` on `internal:true` → genuinely no internet; can reach only `external-app`.

**RESOLVED:** Docker does restrict host port-publishing for containers on an `internal:true` network — confirmed in Phase 0. The internal chat UI is now served through `external-app` at `/bank` via a Next.js rewrite proxy (`source: "/bank/:path*"` → `http://internal-app:3100/bank/:path*`). `internal-app` runs with `basePath: "/bank"` and has no host port exposed. The cage proof via `docker exec internal-app curl https://google.com` is unaffected — `internal-app` remains fully sealed (no internet, no host port).

---

## 6. The contract (shared Zod package)

`packages/contracts` is the single source of truth every package codes against.

```ts
// Mission — what the sealed agent dispatches
Mission = {
  id: string
  query: string
  target_entity?: string        // e.g. "Live Nation / Ticketmaster"
  ticker?: string               // e.g. "LYV"
  allowed_sources: string[]
  scope: "osint_readonly"       // hard-coded guardrail for MVP
  data_classes: string[]        // e.g. ["breach","press","paste"]
  max_spend_usd: number
}

// SourceContribution — one independent corroborating source (fuels confidence fusion)
SourceContribution = {
  name: string                  // "BreachForums" | "HIBP" | "paste site"
  type: "tor_forum"|"breach_api"|"paste"|"press"|"filing"
  url?: string
  reliability: number           // 0..1, per-source prior
  observed_at: string           // ISO
}

// Signal — the structured, returnable intelligence (a SIGNAL ENGINE output)
Signal = {
  entity: string
  ticker?: string
  event_type: string            // e.g. "credential_dump"
  sources: SourceContribution[] // N independent sources
  confidence: number            // FUSED (see §7.4)
  confidence_method: "noisy_or"
  observed_at: string           // earliest credible source timestamp
  disclosed_at?: string         // public disclosure (ISO)
  lead_time_days?: number       // disclosed_at - observed_at
  alpha?: AlphaCard             // quant framing (§7.5)
  summary: string
}

// AlphaCard — the QUANT framing (turns threat-intel into a tradeable signal)
AlphaCard = {
  strategy: string              // "short at observed_at close, cover at disclosed_at close"
  entry_date: string
  exit_date: string
  entry_price?: number
  exit_price?: number
  return_pct?: number           // implied P&L of the lead-time window
  max_drawdown_pct?: number
  note?: string                 // honest caveat where price impact is muted
}

// AuditEntry — hash-chained Merkle leaf
AuditEntry = {
  seq: number
  ts: string
  actor: string
  action: string
  source?: string
  target?: string
  hash: string                  // sha256(entry)
  prev_hash: string
}

// SignedBrief — what crosses back to the sealed agent
SignedBrief = {
  signal: Signal
  audit_root: string            // Merkle root over all AuditEntry leaves
  signature: string             // Ed25519 over canonical(signal)+audit_root
  public_key: string            // sealed side verifies against this
}

// TraceEvent — streamed over SSE; drives the ops-center "ignition"
TraceEvent = {
  mission_id: string
  ts: string
  layer: "dispatch"|"policy"|"identity"|"execution"|"membrane"|"audit"
  agent: string                 // "Planner"|"WebScout"|"TorScout"|"InjectionHunter"|"Judge"|...
  level: "info"|"action"|"warn"|"block"|"success"
  msg: string
  meta?: Record<string, unknown> // e.g. { exit_ip, country, onion_url, circuit:[...] }
}
```

---

## 7. The agentic system

### 7.1 Research swarm (Execution layer)
Real Vercel AI SDK tool-calling agents, run in parallel:
- **Planner** (`OPENAI_MODEL_STRONG`) — decomposes mission → assigns Scouts → synthesizes a candidate Signal.
- **Web Scout** (`OPENAI_MODEL_FAST`) — tool: `fetch_url`.
- **Tor Scout** (`OPENAI_MODEL_FAST`) — tools: `ahmia_search`, `tor_fetch` (live SOCKS5 `.onion`; emits exit IP + circuit into `meta`).
- **Breach Scout** (`OPENAI_MODEL_FAST`) — tools: `hibp_lookup`, `intelx_search`.

Every tool call/step streams a `TraceEvent`.

### 7.2 The Membrane (proof system, inbound) — core / extended
Candidate Signal crosses back **only** on full PASS; the Judge then signs.

**Core (always build — sufficient for the wow):**
| Agent | Model | Role |
|---|---|---|
| **Sanitizer** | `OPENAI_MODEL_FAST` | strip PII/secrets/malware/raw illicit payloads; show redaction diff |
| **Injection Hunter** | `OPENAI_MODEL_FAST` | adversarially scan fetched content for prompt-injection / client-identity exfil / payloads → **catches the planted injection live** |
| **Judge / Attestor** | `OPENAI_MODEL_STRONG` | require PASS from all verifiers → sign Signal + Merkle root |

**Extended (if time; otherwise drop/merge):**
| Agent | Role |
|---|---|
| **Compliance Auditor** | merges *Provenance* (every claim → real source+timestamp; anti-hallucination) and *Policy Warden* (data-class/scope conformance) into one verifier |

Consensus: `cross = Sanitizer.pass && InjectionHunter.pass && (ComplianceAuditor.pass ?? true)`. Any fail → **quarantine**, surfaced on ops-center. Build core 3 first; add the Compliance Auditor only once core is green.

### 7.3 Cryptographic proof layer + tamper-demo
- **Merkle ledger** (`packages/crypto`): every `AuditEntry` is a leaf; root recomputed on append; tamper-evident.
- **Ed25519 signature**: Judge signs `canonical(signal)+audit_root`; sealed agent verifies → ✓ "untampered, from Periscope".
- **TAMPER-DEMO (cheap, huge wow):** an ops-center affordance to **edit one audit-log entry live** → recompute Merkle root → root no longer matches the signed root → **Ed25519 verification flips to RED** in ~10s. Proves "tamper-evident" in front of the judges. *(Demo-only control, clearly behind a "demo" toggle.)*

### 7.4 Multi-source confidence fusion (signal-engine credibility)
Confidence is the transparent fusion of N **independent** corroborating sources (Tor forum + breach API + paste), via **noisy-OR**:

```
confidence = 1 − Π_i (1 − reliability_i)      // over independent SourceContributions
```

The ops-center renders the breakdown (each source, its reliability, its marginal contribution) so it reads as a *signal engine*, not a scrape. Example: BreachForums(0.7) + HIBP(0.6) ⇒ 1 − (0.3·0.4) = **0.88**.

### 7.5 Quant alpha framing (QRT language)
The brief is not "we'd have known 4 days early" — it's a tradeable signal. The **AlphaCard** (computed from `yahoo-finance2`) shows: *short at `observed_at` close, cover at `disclosed_at` close → return_pct*, with lead-time + price move + implied P&L. Where price impact is muted (the hero, see §9), the card is honest about it and the beat reframes on **informational edge**; a secondary case carries the **magnitude**.

---

## 8. Repository layout

```
apps/
  internal/    Next: chat UI + sealed agent (OpenAI via proxy, dispatch-only egress)  [Emile]
  external/    Next: on-prem LLM proxy + gateway + fleet + membrane + ops-center UI     [Emile scaffolds; Louis/Dung fill]
packages/
  contracts/   Zod: Mission · SourceContribution · Signal · AlphaCard · AuditEntry · SignedBrief · TraceEvent  [team, lock H0]
  agents/      AI SDK: Planner · Scouts · Membrane (Sanitizer/InjectionHunter/Judge[/Compliance]) + tools     [Louis]
  crypto/      Ed25519 sign/verify + Merkle ledger + tamper-demo helper                 [Gibril]
  tools/       tor-fetch · breach (HIBP/IntelX) · ahmia · backtest+alpha (yfinance)     [Dung]
  fixtures/    hero_case.json (Ticketmaster primary + Medibank secondary)              [Malena/Dung]
docker-compose.yml
docs/superpowers/specs/2026-06-27-periscope-architecture-design.md
```

---

## 9. Hero case (LOCKED)

### 9.1 Primary — Live Nation / Ticketmaster (LYV, NYSE) — chosen for indisputable credibility
Mechanism is the cleanest fit for Periscope's thesis, and the timeline is **SEC-documented** (the 8-K itself states the dark-web sale date — nobody can argue against it):

- **2024-05-20** — Live Nation detects activity (internal, non-public).
- **2024-05-27** — ShinyHunters lists **560M** customer records for sale on the dark web (BreachForums, $500k). → `observed_at`
- **2024-05-31** — Live Nation confirms publicly via **SEC 8-K**. → `disclosed_at`
- **lead_time_days = 4.** Beat 4 shows the BreachForums listing (May 27) **beside the SEC 8-K (May 31)**.
- **Honest weakness:** stock barely moved ("no material impact"; buried in DOJ antitrust news). → reframe beat 4 on the **informational edge** (4 days) rather than a crash; use the AlphaCard to state this plainly.

### 9.2 Secondary (optional) — Medibank (MPL.AX, ASX) — carries the magnitude
- **2022-10-12** dark-web chatter → **2022-10-13** detection/halt → **2022-10-26** resumption **−15%** in one session, **~−20%** over the saga ($3.60→$2.75) → **2022-11-08/09** data dumped.
- Use only to show "and when it moves the stock, here's the scale: −15%."

### 9.3 `hero_case.json` fixture (to generate as first Phase-0 artifact)
```jsonc
{
  "primary": {
    "entity": "Live Nation Entertainment (Ticketmaster)",
    "ticker": "LYV", "exchange": "NYSE",
    "event_type": "credential_dump",
    "observed_at": "2024-05-27",          // BreachForums listing
    "disclosed_at": "2024-05-31",         // SEC 8-K
    "lead_time_days": 4,
    "sources": [
      { "name": "BreachForums", "type": "tor_forum", "reliability": 0.7, "observed_at": "2024-05-27", "url": "<listing>" },
      { "name": "HIBP", "type": "breach_api", "reliability": 0.6, "observed_at": "2024-05-28" }
    ],
    "evidence_url": "<SEC 8-K filing URL>", // indisputable
    "summary": "ShinyHunters listed 560M Ticketmaster customer records ($500k) 4 days before Live Nation's SEC 8-K confirmation.",
    "alpha": {
      "strategy": "short at observed_at close, cover at disclosed_at close",
      "entry_date": "2024-05-27", "exit_date": "2024-05-31",
      "note": "edge is informational lead-time; price impact muted (no material impact + DOJ antitrust noise)"
    },
    "price_series": []                      // LYV daily closes, pulled via yahoo-finance2 (Phase 0)
  },
  "secondary": {
    "entity": "Medibank", "ticker": "MPL.AX", "exchange": "ASX",
    "event_type": "ransomware_breach",
    "observed_at": "2022-10-12", "disclosed_at": "2022-10-13",
    "magnitude": { "single_session_drop_pct": -15, "saga_drop_pct": -20, "from": 3.60, "to": 2.75 },
    "purpose": "magnitude beat",
    "price_series": []
  }
}
```

---

## 10. Live vs cached seam (demo reliability)

| Genuinely live (proof) | Cached, real data (hero) |
|---|---|
| Gateway, all 6 layers, full agent graph | Hero breach payload (Ticketmaster) returned deterministically by a Scout fixture |
| One real Tor `.onion` fetch + exit IP + circuit | LYV (and MPL.AX) price series pre-pulled to `hero_case.json` |
| Policy rejection path | Planted injection text (fixed fixture) |
| Injection Hunter catching the injection | — |
| Ed25519 signing/verification + Merkle root + tamper-demo | — |
| Confidence fusion + AlphaCard computation | source reliabilities (priors) |

Rule: **live = proof, cached = the hero.** Pre-warm Tor; never a 30s live spinner on the climax.

---

## 11. Demo beats (mapped to architecture)

1. **Cage is real** — `docker exec internal-app curl https://google.com` → timeout; sealed agent fails to research directly.
2. **Dispatch → ignition** — ops-center lights up agent-by-agent from the SSE trace.
3. **Real dark web** — live `.onion` fetch; FR IP vs foreign Tor exit IP + 3-relay circuit.
4. **HERO + ALPHA** — Signal lands on Ticketmaster (BreachForums May 27 beside SEC 8-K May 31 → **4 days**); confidence shown as **multi-source fusion**; **AlphaCard** frames it as a tradeable signal (informational edge; optional Medibank for the −15% magnitude).
5. **The turn** — Injection Hunter catches a planted prompt-injection live → quarantined, never crosses.
6. **Compliance close + TAMPER-DEMO** — open the audit log; Ed25519 signature verified on the sealed side; then **edit one audit entry live → Merkle root breaks → verification flips RED**. "The firm never touched the wire, and tampering is mathematically detectable."

---

## 12. Build order (always a working demo)

- **Phase 0 (H0–H4) — vertical slice on mocks.** Lock `contracts`; generate `hero_case.json` (pull LYV + MPL.AX series via `yahoo-finance2`); `external-app` gateway with a **fake fleet** streaming a realistic trace + returning the hero fixture; `internal-app` chat dispatches via the on-prem proxy and renders; ops-center renders trace + signal card. Verify the Docker cage. *Demo exists.*
- **Phase 1 — real swarm.** Planner + Scouts as real AI SDK agents; live Tor fetch; breach/OSINT tools.
- **Phase 2 — membrane + crypto.** Core membrane (Sanitizer + Injection Hunter + Judge); Merkle ledger; Ed25519 sign/verify; the live injection catch; **tamper-demo**.
- **Phase 3 — climax + polish.** AlphaCard + confidence-fusion UI; ops-center visual polish; (optional) Compliance Auditor; rehearsal; backup video.

Swap fixtures → real without touching the contract seam.

---

## 13. Ownership

| Person | Owns |
|---|---|
| **Emile** | scaffold, `internal` app + sealed agent, `external` ops-center UI, demo + storyline |
| **Louis** | `packages/agents` (Planner, Scouts, Membrane), gateway orchestration |
| **Dung** | `packages/tools` (Tor, breach, OSINT, backtest+alpha), data sourcing |
| **Gibril** | `packages/crypto` (Ed25519, Merkle, tamper-demo), audit-log export, isolation architecture |
| **Malena** | hero case verification (SEC 8-K + listing capture), alpha/ROI + compliance narrative, design partner |

---

## 14. Risks & decisions

| Item | Status |
|---|---|
| **Hero case** | **LOCKED** — Ticketmaster/LYV (SEC-documented, 4-day edge) primary; Medibank/MPL.AX secondary for magnitude. |
| **Sealed agent reliability** | **Resolved** — network-sealed OpenAI agent via gateway proxy; Ollama off the critical path (optional roadmap flavor). |
| `internal:true` host port-publishing | Verify Phase 0; fallback = serve internal UI via `external-app` proxy. Cage proof via `docker exec` unaffected. |
| Live Tor flakiness | One live fetch for credibility; pre-warm circuits; hero is cached. |
| Membrane latency | Verifiers run in parallel; core = 3 agents; cache the hero path; sonnet for verifiers. |
| "Looks like a proxy/VPN" | Lead with policy + membrane + identity isolation + signed attestation + tamper-demo + fused signal + AlphaCard. |
| LYV "no material impact" | Reframe beat 4 on informational edge; AlphaCard is honest; Medibank carries magnitude. |

---

## 15. Out of scope for this spec
Pitch deck, business model, demo-day logistics (README + brainstorm vault).
