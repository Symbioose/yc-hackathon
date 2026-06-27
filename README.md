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

## 🎬 The demo (60–90s) — this is what we rehearse

Split screen: **LEFT** = sealed corporate env (internal agent, big "NO INTERNET / AIR-GAPPED" badge). **RIGHT** = the Periscope external fleet operating in the wild.

1. **The sealed agent asks** → "Is issuer **X** (public company) compromised?" — and it **cannot reach out**. It can only `dispatch`.
2. **Periscope raises the periscope** → on the right, the web-agent + Tor-agent fan out across real OSINT + a controlled breach source, live.
3. **It finds a real signal** on a **real historical case** → credential dump posted on a forum **before** public disclosure.
4. **Sanitized result crosses the wall** → *"X: credential dump detected [date], confidence 0.86, source [forum], J-12 before public disclosure. Full audit trail attached."*
5. **The kicker — the backtest** → overlay the signal timestamp on X's stock chart → *"Periscope would have known 12 days before the market."*
6. **Compliance close** → show the audit log: every external action scoped & recorded; the firm's identity never left the building.

> Killer line: *"Your agents are blind by design. Periscope gives them eyes — without opening the hull."*

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
| Sandbox-side | **MCP server** (`dispatch`, `status`, `fetch_signal`) + thin SDK; demo internal agent in a visibly sealed env |
| Gateway/broker | Python (FastAPI) — policy, mission queue, full audit log, identity isolation |
| External fleet | Isolated workers (VM/container, distinct egress); Tor via `tor` daemon → SOCKS5 `127.0.0.1:9050`; httpx/Playwright through it for `.onion` |
| Collection | OSINT (web/RSS/blocked sites), Ahmia (clearnet `.onion` index), IntelX API, HIBP/Dehashed, optional Telegram (Telethon) |
| Signal extraction | LLM → structured signal `{entity, event, confidence, source, timestamp}` |
| Backtest | yfinance → signal timestamp vs price-move chart → lead-time |
| Frontend | React split-screen (sealed left, fleet right) + mission trace + signal card + stock overlay + audit log |
| Hosting | Hackathon: **VPS** (we operate the infra) + Claude API. Roadmap: on-prem / local open-weight models / SGX for query sovereignty. Front on Vercel |

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
- **H4–14** — core engine: MCP `dispatch` from a sealed agent → gateway (policy + audit + identity isolation) → external worker (OSINT + controlled breach/Tor source)
- **H14–24** — signal extraction + backtest overlay (signal vs stock chart) + split-screen UI
- **H24–32** — rehearse 60–90s demo + backup video + pitch deck + lock QRT/trader design partner & exact paid mission
- **H32–36** — 2–3 clean demo runs + audit-log export + polish + submit

---

## 🚀 Getting started (to fill as we scaffold)

```bash
# clone
git clone https://github.com/Symbioose/yc-hackathon.git
cd yc-hackathon

# backend (Python) — gateway + fleet + Tor
# cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn main:app --reload

# frontend (React) — split-screen demo
# cd frontend && npm install && npm run dev
```

> Repo structure, env vars (INTELX_API_KEY, HIBP_API_KEY, ANTHROPIC_API_KEY…) and run commands will be added here as we scaffold.

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
