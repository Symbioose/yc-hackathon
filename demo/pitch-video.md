# Altai — Demo Video Script (timeline)

**Goal:** maximize every Paris Builds criterion (Problem 17 · Demo 17 · Pricing 17 · GTM 17 · Differentiation 16 · Pitch Delivery 16 · Agentic Depth 15).
**Target length:** **4:15–4:45** (hard cap 5:00). Under 5 is rewarded — don't pad.
**Format:** YC-style product demo. Mostly real screen capture, tight voice-over. Bookend with deck slides.
**Golden rule:** *"Judge by proof, not demo vibes."* → ~40% of the runtime is the live demo. Show, don't tell.

### 3 rules before you record
1. **Pre-record the demo run** (screen capture) and voice over it — never risk a live failure on camera. Edit out dead time (loading), keep the real moments.
2. **Use a REAL query** (`Has Live Nation suffered a data breach?`) so corroboration is genuine. No staged "hero case."
3. **Captions ON** (judges may watch muted) · lower-third labels for each proof moment.

---

## Timeline overview

| Time | Segment | On screen | Criterion |
|---|---|---|---|
| 0:00–0:30 | Hook + problem | Title → Problem slide | Problem Clarity (17) |
| 0:30–0:55 | What Altai is | One-liner / Solution slide | sets up |
| 0:55–1:45 | Architecture + Search DNA | Architecture diagram + membrane + route-reuse | Agentic Depth + Differentiation |
| 1:45–3:35 | **LIVE DEMO (centerpiece)** | Terminal + ops-center + sealed app | **Demo (17) + Agentic (15)** |
| 3:30–4:15 | Why we win | Market → Business model → Matrix | Market / Pricing / Differentiation |
| 4:15–4:45 | Team + GTM + vision | Team slide → Vision close | GTM (17) + Team |

---

## 1 · Hook + Problem — 0:00–0:30
**ON SCREEN:** Title slide (ALTAI sentinel) → cut to Problem slide.
**VO:**
> "The smartest AI agent at a hedge fund isn't allowed to open a web page.
> Every desk is racing to deploy internal AI agents — and every CISO seals them off from the internet. That's correct security. But the signal that moves a stock lives *outside* that wall: alternative data, filings, supply-chain shifts, breach exposure.
> Today the workaround is a human analyst who spends **42% of their time just gathering data** — and is still never first."

---

## 2 · What Altai is — 0:30–0:55
**ON SCREEN:** Title one-liner slide (or solution slide).
**VO:**
> "Altai is the one governed door that lets a sealed agent reach the open, blocked, and dark web — and bring back a **signed, sourced answer** it can act on. The firm never touches the wire.
> You ask a research question; you get a **conclusion with a confidence score**, not a pile of links."

---

## 3 · Architecture + Search DNA — 0:55–1:45
**ON SCREEN:** Architecture diagram (two-network air-gap topology + the 6 layers). Animate it building up. End on the **Search DNA** layer — reused routes lighting up on a repeat query.
**VO:**
> "Here's how. The sealed agent holds no keys and has exactly one exit — it dispatches a mission.
> Our gateway checks policy, **strips the firm's identity**, and sends an isolated fleet outside: open web, Tor, breach APIs, in parallel.
> Everything coming back hits an **adversarial membrane** — it hunts prompt-injection, sanitizes, and only then signs the brief. Six layers, one audited door. *That membrane is why a regulated firm can actually trust what comes back.*
> And it **learns**. Every mission records the route that worked — which sources, which path — into what we call **Search DNA**. The next similar question reuses it instead of re-exploring, so each search is **cheaper and smarter than the last**. A learned navigation graph a competitor can't clone — **defensible beyond any base model.**"

---

## 4 · LIVE DEMO (the centerpiece) — 1:45–3:35
> Keep VO light here; let the screen carry it. Lower-third caption for each beat. *(Beat timestamps below are relative — shift to start at 1:45.)*

### 4a · The cage is real — 1:30–1:50
**ON SCREEN:** terminal.
```bash
docker compose exec internal-app curl https://google.com          # hangs → times out
docker compose exec internal-app curl http://external-app:3000/api/health   # {"ok":true}
```
**VO:**
> "First — the cage is real. From inside the sealed container I curl Google. It times out. No internet. The only host it can reach is our gateway. **This isn't a mockup.**"

### 4b · Dispatch a real mission — 1:50–2:40
**ON SCREEN:** sealed app at `localhost:3000/bank` → type the query → switch to ops-center at `localhost:3000`, lights up live.
**Query:** `Has Live Nation suffered a data breach?`  (target_entity: `Live Nation`)
**VO:**
> "Now I dispatch a real question from the sealed app: *has Live Nation suffered a breach?* Watch the ops-center.
> Policy passes. The firm's identity is stripped. The fleet deploys — and here's the **live Tor exit IP**, a real circuit going out. The web scout finds corroborating press; the breach scout cross-checks. The planner fuses **independent sources into a confidence score**."

### 4c · Membrane + sign — 2:40–2:55
**ON SCREEN:** membrane panel → injection caught/quarantined → Judge signs.
**VO:**
> "The membrane scans everything that came back, catches a **prompt-injection** planted in a source, quarantines it — and signs the brief. Ed25519 over a tamper-evident Merkle ledger."

### 4d · Honest inconclusive — 2:55–3:10
**ON SCREEN:** dispatch an obviously invented company (e.g. `Acme Fusion Dynamics`) → `inconclusive`, confidence `0`. *(Do NOT use "Northwind" — the deck claims Northwind found a breach.)*
**VO:**
> "And when there's nothing there? I ask about a company that doesn't exist. It comes back **inconclusive, confidence zero**. It never fabricates a finding. That's the line between a real agent and a prompt in a box."

### 4e · Tamper-evidence — 3:10–3:20
**ON SCREEN:** click **⚠ TAMPER** → recomputed Merkle root turns red, signature still valid.
**VO:**
> "Tamper with one audit entry — the recomputed root turns red, the signature stays valid. **Tampering is mathematically detectable.**"

### 4f · Deliverables + verify offline — 3:20–3:30
**ON SCREEN:** download `.xlsx` / STIX from SIGNAL card → drag `brief.json` onto **VERIFY** zone → ✓ AUTHENTIC → edit one byte → ✗ FORGED.
**VO:**
> "Download it as Excel, or a STIX bundle for your SIEM. Hand the file to anyone — they verify it **offline**. Authentic. Change one byte — forged. *Don't trust; verify.*"

---

## 5 · Why we win — 3:35–4:20
**ON SCREEN:** Market slide → Business model → **Competition matrix** (linger on the "Web-search APIs" column).
**VO:**
> "Alternative data is a **$17.78 billion market growing 52% a year**. Funds already pay **$1.6M a year** for fixed feeds — we're the **on-demand layer for the questions those feeds can't answer**. €2,500 a seat, then metered usage — and that Search DNA compounds our margin over time.
> And no — we're not a search API. **Linkup gives an app the open web. Altai gives a sealed, regulated agent governed, *attested* access to the open, blocked, and dark web.** The crypto is copyable in a weekend; the **compounding system isn't.**"

---

## 6 · Team + GTM + vision — 4:20–4:50
**ON SCREEN:** Team slide (photos, QRT validation) → Vision close slide.
**VO:**
> "We're the team to build this — the buyer, the quants, and the engineers on one team — and we've already **pressure-tested it with quants at QRT**.
> Our first ten customers are two intros away: design-partner desks, first revenue in weeks.
> Today, the trading desks. Next, **every regulated enterprise that air-gaps its agents**.
> **Altai — the governed door to the outside world.**"

---

## Exact commands / inputs (have these ready)
```bash
docker compose up --build                                          # bring the system up
docker compose exec internal-app curl https://google.com           # PROOF: times out (no internet)
docker compose exec internal-app curl http://external-app:3000/api/health   # 200 — only the gateway is reachable
# Sealed app:  http://localhost:3000/bank   ·  Ops-center: http://localhost:3000
# Buttons: TAMPER  ·  VERIFY A BRIEF drop-zone  ·  Deliverables: xlsx / stix / md
```

## Demo queries — exactly what to type
> The build is **breach / cyber-exposure focused** (web + Tor + breach scouts). Type queries it genuinely answers; *talk* the alt-data breadth as roadmap.

1. **Hero run (real corroboration + live Tor):** `Has Live Nation suffered a data breach?` — target_entity `Live Nation`.
   - Backups if it's slow/empty on the day (all real, heavily-covered breaches): `23andMe`, `AT&T`, `Ticketmaster`, `Snowflake`.
2. **Honest negative:** `Has Acme Fusion Dynamics been breached?` (invented) → **inconclusive @ 0**. *Never use "Northwind."*
3. **File generation / report:** on the Live Nation brief → Deliverables → **.xlsx** (Summary · Sources · Provenance), **STIX** bundle, **Markdown** note → then drag `brief.json` onto **VERIFY** (✓ → edit a byte → ✗).

## Production checklist
- [ ] Pre-recorded demo capture (no live failures), dead time trimmed.
- [ ] Captions + lower-third labels on every proof beat ("AIR-GAP IS REAL", "LIVE TOR EXIT", "TAMPER → SEAL BREAKS", "VERIFY OFFLINE").
- [ ] Real query used (Live Nation) — corroboration genuine.
- [ ] Total runtime ≤ 5:00 (target 4:30). Demo segment ~2:00, intact.
- [ ] Clean voice-over, scripted, energetic, no filler.
- [ ] Intro/outro use the deck slides for branding.

## ⚠️ Consistency note
The deck slide 5 currently frames the proof as *"Northwind Logistics · 9 days · −14%"*. The video runs a **real** query (Live Nation). Pick one and align both:
- **Recommended:** demo Live Nation live in the video, and either reframe slide 5 as illustrative or update it to the real run. Don't let a judge spot a gap between a "recorded demo case" claim and what's on screen.

## Word-count / pacing budget
~510 words of VO ≈ 3:25 of speech at 150 wpm + ~60–90s of demo visual pauses = **~4:30–5:00**. If you run long, cut the Search DNA detail in §3 or the market line in §5 — **never the demo**.
