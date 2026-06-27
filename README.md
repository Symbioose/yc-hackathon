# Periscope — The Sovereign External-Action Layer for Air-Gapped Enterprise Agents

> **Paris Builds hackathon** (Unaite × YC) · 27–28 June 2026 · 36h · Prize: €20k + YC interview + a day at QRT
> **Track:** Software for Agents
> **Goal:** WIN. A demo that silences the room + a warm paying buyer + QRT-grade technical depth.

---

## 🧩 One-liner

**Periscope is the compliant window to the outside world for enterprise AI agents.**
Your internal agents are sealed off from the internet by your CISO/DSI. Periscope lets them dispatch missions to a fleet of specialized, isolated external agents (a web-research agent, a Tor/dark-web agent, …) that act on everything your firewall blocks — the open web, blocked sites, closed sources and Tor — and return a **sanitized, audited, sourced intelligence brief**, without ever exposing your identity or your queries.

> Recorded Future sells you a static feed for humans. **Periscope gives your sealed agents eyes — they dispatch a mission, an isolated fleet acts on the forbidden outside, and you get a provenance-stamped, tradeable signal back — without opening the hull.**

---

## 🔥 Validation

**QRT — the hackathon's biggest sponsor and a judge — told us directly that they have many blocked sites and would love to research them securely.** The buyer in the room verbalized the exact pain. We also have a **trader (warm, already willing to pay)** for the alt-data alpha use case.

---

## 🎯 The problem

Enterprises are racing to deploy internal AI agents — but the CISO/DSI imposes a hard rule (especially in finance, FR & US):
- **No outbound. The agent runtime is air-gapped.** No web, no third-party APIs, no Tor.
- The firm wants **external intelligence** but **forbids its own agents from reaching out**.

Today the only options are a static vendor feed (generic, slow, not agent-native), a slow human, or breaking the security posture. **There is no agent-native, compliant, audited egress layer.**

---

## 💡 The solution (what we build)

Periscope = a controlled egress gateway + an isolated, specialized external agent fleet.

1. **Dispatch (the only hole in the wall)** → the internal agent calls Periscope via an **MCP server / SDK**: `periscope.dispatch(mission)`. Single, audited, policy-enforced egress point.
2. **Broker + policy** → enforce allowed sources/scope/spend, log **every action** for compliance/audit, guarantee the client's identity & raw queries are **never** exposed.
3. **Specialized external fleet** → isolated workers with their own identities/egress: a **web-research agent** (open + blocked sites), a **Tor/dark-web agent** (Ahmia/IntelX + a real Tor SOCKS fetch), a **data-API agent** (HIBP/Dehashed/IntelX).
4. **Signal extraction** → unstructured findings → `{entity/ticker, event_type, confidence, source, timestamp}`.
5. **Sanitized return** → only the clean, classified brief + audit trail crosses the wall. No raw dark-web payloads enter the firm.
6. **Backtest / lead-time** → overlay signal timestamp vs price action → quantify the alpha ("known N days before public disclosure").

---

## 🏗️ Architecture — the layers (this is the moat, not the proxy)

Every mission crosses **6 layers**, and every action is logged. This is what makes Periscope *not* "a VM with Tor".

```
  SEALED ENTERPRISE                        PERISCOPE                                 OUTSIDE WORLD
 ┌──────────────────┐   dispatch()   ┌──────────────────────────────────────┐   ┌──────────────────┐
 │  internal agent  │ ─────────────► │ 1. Dispatch (MCP)                    │   │  open web        │
 │  (NO INTERNET)   │                │ 2. Policy & governance               │   │  blocked sites   │
 │                  │                │ 3. Identity isolation                │ ► │  Tor / .onion    │
 │  ◄───────────────│ ◄───────────── │ 4. Execution (agent fleet)           │   │  breach APIs     │
 │  sourced brief   │  signal+audit  │ 5. Sanitization & classification     │   │  Telegram        │
 └──────────────────┘                │ 6. Audit & attestation               │   └──────────────────┘
                                      └──────────────────────────────────────┘
```

1. **Dispatch layer (MCP)** — the sealed agent's *only* egress. Tools: `dispatch`, `status`, `fetch_signal`. Nothing else in the runtime touches the outside.
2. **Policy & governance layer** — per-tenant rules: source allow/deny-list, scope, data classes, spend caps, rate limits. Out-of-policy missions are rejected *before* execution.
3. **Identity isolation layer** — the client's identity, IP and raw query **never leave Periscope**. External agents act under Periscope's own rotating identities/egress. The firm is never on the wire.
4. **Execution layer** — the specialized, isolated agent fleet (below).
5. **Sanitization & classification layer** — raw external payloads never enter the firm; results are extracted, PII/secret/malware-stripped, classified, returned as a structured brief.
6. **Audit & attestation layer** — every action (which agent, which source, when, what was fetched) is immutably logged; exportable compliance report; *(roadmap)* cryptographic attestation via confidential compute (SGX).

### 🛡️ Compliance agents (they enforce — this is why it's not a proxy)

| Agent | Role |
|---|---|
| **Policy Agent** | Validates every mission against the tenant's policy *before* anything runs |
| **Guardrail Agent** | Enforces **defensive / OSINT read-only** — blocks any attempt to transact, purchase or interact |
| **Sanitization Agent** | Strips PII, secrets, malware and raw illicit content from results before they cross the wall |
| **Audit Agent** | Records & signs every action into the immutable audit log; generates the compliance report |

### 🔭 Research agents (the fleet that acts on the outside)

| Agent | Role |
|---|---|
| **Web-research agent** | Open web + firewall-blocked sites (foreign press, sector forums, restricted sources) |
| **Tor / dark-web agent** | Ahmia/IntelX discovery + a **real live Tor SOCKS fetch** of `.onion` |
| **Data-API agent** | Breach data via HIBP / Dehashed / IntelX; optional Telegram (Telethon) |
| **Signal agent** | Findings → structured `{entity, event, confidence, source, timestamp}` + backtest / lead-time |

> **The one-line moat:** "We don't give your agent the internet. We give it a *governed, audited, identity-isolated* delegate that brings back a decision — and proves the firm never touched the wire."

---

## 🎬 The demo (60–90s) — engineered for the *wow*

> **Rule of wow:** make the room *feel the cage* before they see the escape. Everything converges on **beat 4**.
> **Rule of safety:** live = proof, cached = the hero signal. Pre-warm Tor circuits. Backup video ready.

Split screen: **LEFT** = sealed corporate env. **RIGHT** = the Periscope fleet in the wild.

1. **Prove the cage is real (tension)** → ask the sealed agent *"is issuer **X** compromised?"* → it **fails live**: `BLOCKED: egress denied by policy`, a `ping` that times out. *(Theatre: a real laptop in airplane mode / ethernet unplugged on the table = "this is the bank".)*
2. **Dispatch → the fleet ignites (energy)** → on `dispatch`, the right pane explodes: specialized agents spawn, real-time logs stream, web-agent + Tor-agent fan out in parallel.
3. **Prove it's really the dark web (credibility)** → fetch a real `.onion` **live**; show **your IP before (FR) vs via Tor (foreign exit node)** + the Tor circuit (3 relays). Nobody can call it fake.
4. **THE HERO MOMENT — the signal lands on a REAL case (silence)** → fleet returns *"X: credential dump, posted [real date], forum [real], confidence 0.86."* Then overlay on the **real stock chart**: animate two vertical lines → *"This is when WE'd have known. This is when the market knew. **Twelve days.**"* The gap = the alpha; the stock craters −X%.
5. **"Oh, it's bigger" (the turn)** → take a **live ticker from the room/judge** and run the mission for real. Proves it's not scripted. *(Fallback: a pre-loaded case + the backup video.)*
6. **Compliance close (scary → moat)** → open the **audit log**: every action scoped & timestamped → *"and the firm's identity never touched the wire. Proof, right here."*

> Killer line: *"Your agents are blind by design. Periscope gives them eyes — without opening the hull."*

### ☠️ Wow-killers to ban
- Latency (pre-warm Tor, pre-fetch the hero signal — never a 30s spinner live)
- Walls of JSON (narrate the story, not the schema)
- Narrating features instead of showing the cage → escape → gap → audit
- A fake "Acme Corp" ticker — **real breach, real ticker, real price move only**

---

## 🏆 Why it wins

- **Agent infra that's simple to tell + technically impressive** → "the egress layer for sealed enterprise agents." One sentence, deep build. MCP-native.
- **Impossible transformation, real data** → a sealed agent → real signal on a real breach → quantified lead-time on a real stock move.
- **Sponsor validated the pain** → QRT told us they need exactly this.
- **Decision, not a dashboard** → the mission returns a tradeable, provenance-stamped signal.
- **Compliance is the moat** → defensive/OSINT, fully audited, identity-isolated. The scary part becomes the differentiator.

---

## 🛠️ Tech stack

| Layer | Choice |
|---|---|
| Monorepo | **pnpm workspace + Turborepo**, **TypeScript** everywhere |
| Sealed side | **Next.js** sealed chat (`apps/internal`) — dispatch-only egress; runs on a Docker `internal:true` network (genuinely no internet) |
| Gateway / broker | **Next.js (App Router)** route handlers (`apps/external`) — mission ingress, SSE trace stream, 6-layer orchestration; bridges both networks |
| Agent fleet | **Vercel AI SDK v5 + OpenAI** (`@periscope/agents`): Planner + Web / Tor / Breach scouts (real tool-calling) |
| Tools | `@periscope/tools`: web fetch, **Tor** SOCKS5 (`fetch-socks` → `tor` daemon `:9050`), Ahmia (`.onion` index), HIBP / IntelX |
| Contract | **Zod** shared package (`@periscope/contracts`): Mission · TraceEvent · Signal · AuditEntry · SignedBrief |
| Signal | multi-source confidence fusion (noisy-OR) + quant **AlphaCard**; deterministic hero pinning for the demo |
| Backtest | `yahoo-finance2` → price series + lead-time |
| Frontend | React (Next): ops-center (live trace + signal card) + sealed chat, served on one origin (`/` and `/bank`) |
| Runtime | **Docker Compose**, 2 networks — `internal:true` (sealed) + `external` (internet + Tor) = the real cage |
| Provider | **OpenAI** via `@ai-sdk/openai` (provider-agnostic — one-import swap back to Claude). Roadmap: on-prem / local models / SGX |

---

## 👥 Team & ownership

| Person | Owns |
|---|---|
| **Louis** (CS/Math) | Gateway + external fleet + signal extraction/scoring + backtest math |
| **Dung** (CS) | Collection pipeline (OSINT/Tor/APIs) + backend + data sources |
| **Emile** (AI/agents/demo) | MCP `dispatch` + sealed agent + split-screen demo + pitch storyline |
| **Malena** (Finance/M&A) | Trader/QRT design partner + alpha/ROI + compliance narrative |
| **Gibril** (hard science) | Isolation/confidential-compute architecture + reliability + audit-log export |

> Assign owners from minute one. Don't let two people touch the same file in parallel.

---

## 📅 36-hour plan

- **H0–4** — lock the demo company X (a real breach that leaked before disclosure) + live sources + demo script + ownership
- **H4–14** — core: MCP `dispatch` from a sealed agent → gateway → **compliance layers** (Policy + Guardrail + identity isolation) → research fleet (OSINT + Tor SOCKS fetch)
- **H14–24** — Sanitization + Audit agents (immutable log) + signal extraction + backtest overlay + split-screen UI (cage → fleet → gap → audit)
- **H24–32** — rehearse the 6-beat demo + airplane-mode theatre + backup video + pitch deck + lock QRT/trader design partner & exact paid mission
- **H32–36** — 2–3 clean demo runs + audit-log/compliance-report export + polish + submit

---

## 🚀 Getting started

```bash
git clone https://github.com/Symbioose/yc-hackathon.git
cd yc-hackathon
pnpm install

# run the full demo (sealed cage + gateway + fleet + Tor) under Docker
docker compose up --build
#   → http://localhost:3000        ops-center (live trace + signal card)
#   → http://localhost:3000/bank   sealed bank chat (ask → dispatch → brief)
```

**Prove the cage is real:**

```bash
docker compose exec internal-app curl https://google.com               # → times out (no internet)
docker compose exec internal-app curl http://external-app:3000/api/health  # → 200 (only the gateway is reachable)
```

**Real swarm vs fallback.** Out of the box the fleet runs a safe **mocked fallback** (deterministic hero signal), so the demo always completes. To light up the *real* OpenAI swarm + live Tor, copy `.env.example` → `.env` and set:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL_STRONG=<model id>
OPENAI_MODEL_FAST=<model id>
# optional: HIBP_API_KEY, INTELX_API_KEY
```

**Local dev (no Docker):** `pnpm --filter @periscope/external dev` (:3000) + `pnpm --filter @periscope/internal dev` (:3100). `pnpm test` runs the suite, `pnpm typecheck` the whole workspace.

### Status

- ✅ **Phase 0** — monorepo, Zod contract, mocked end-to-end demo, real Docker cage
- ✅ **Phase 1** — real OpenAI agent swarm (Planner + Web/Tor/Breach scouts), Tor/breach/OSINT tools, hero pinning, fallback safety
- ✅ **Phase 2** — Membrane (Injection Hunter catches a live dark-web injection + Sanitizer + Judge) + Ed25519/Merkle audit ledger; sealed-side signature verification + live tamper-demo
- ⏭ **Phase 3** — AlphaCard + stock-overlay UI, polish

> Architecture spec & phase plans live in `docs/superpowers/specs/` and `docs/superpowers/plans/`.

---

## 📊 Business / pitch essentials

- **Buyer:** a trader (warm, paying) + QRT (stated need) → quant funds, family offices, threat-intel teams, any enterprise air-gapping its agents.
- **Model:** usage-based (per-mission / per-signal — pay for alpha) + platform/compliance tiers.
- **Vision:** the **external nervous system of the agent economy** — a bidding marketplace where specialized agent providers fulfil missions for sealed enterprise agents. *(Vision, NOT the 36h MVP — MVP is a single first-party gateway.)*
- **Anti-feed line:** "Recorded Future is a feed for humans. Periscope is an agent-native, compliant egress layer that returns a decision."

---

## ⚠️ Risks we're actively managing

| Risk | Mitigation |
|---|---|
| "Just dark-web monitoring (Recorded Future)" | Lead with agent-native compliant egress + per-mission dispatch + tradeable signal, not a feed |
| Legal/ethical alarm (Tor, wallets) | **Defensive / OSINT read-only. No illicit transactions.** Everything audited. State it up front |
| Live Tor flakiness in demo | One real live Tor fetch to prove capability; headline breach signal pre-collected/verified |
| Looks like a thin proxy/VPN | Show the policy + audit + identity-isolation + signal-extraction stack; emphasize MCP + isolation |
| Signal credibility | Use a real breach that really preceded a real stock move; show provenance + timestamps |
| Most-crowded track | Win with the impossible transformation + warm finance buyer + compliance moat |

---

## 📚 Strategic context

Full strategy, scoring, competitor analysis and the detailed spec live in the brainstorm vault (`yc-brainstorm`):
- `17_Project_Spec_Periscope.md` — source of truth for the project
- `AGENTS.md` — strategy, QRT lever, winning patterns
- `00_Context_Paris_Builds.md` — event, sponsors, judging

---

*Let's take the interview. 🦅*
