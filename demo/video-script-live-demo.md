# Altai — LIVE DEMO script (the centerpiece) · 1:45–3:35

**Run the demo in Docker** (`docker compose up --build`), NOT `pnpm dev` — only Docker
enforces the real air-gap that beat 4a depends on. Ops-center: `http://localhost:3000`.
Sealed app: `http://localhost:3000/bank`.

Everything below is **real** — no hardcoded answers. For a flawless take: pre-run the hero
mission once (it stays in memory), keep the best take, and have this recording as the backup
if the live network rate-limits during the pitch.

Keep VO light; let the screen carry it. Lower-third caption per beat.

---

## 4a · The cage is real — 1:45–2:05
**ON SCREEN:** terminal.
```bash
docker compose exec internal-app curl --max-time 5 https://google.com          # times out fast → no internet
docker compose exec internal-app curl http://external-app:3000/api/health      # {"ok":true}
```
> Note the `--max-time 5` so the timeout is instant (no dead air).

**VO:** "First — the cage is real. From inside the sealed container I curl Google. It times out: no internet. The only host it can reach is our gateway. This isn't a mockup."

---

## 4b · Dispatch a real mission — 2:05–2:55
**ON SCREEN:** sealed app `localhost:3000/bank` → ask the copilot →
**Query:** *"Has Ticketmaster (Live Nation) been breached and is the data on the dark web?"*
→ switch to ops-center `localhost:3000`, watch it light up live.

**VO:** "Now I ask the sealed copilot a real question: has Ticketmaster been breached? It can't research on its own — it dispatches to Altai. Watch the ops-center. Policy passes. The firm's identity is stripped. The fleet deploys — here's the **live Tor exit IP, a real circuit** going out, and a live `.onion` fetch. The web scout reads real press, the planner fuses **independent sources into a confidence score**."

> Honest wording: the **Breach Scout (HIBP/IntelX)** only returns data if you set
> `HIBP_API_KEY` in `.env`. Without a key it returns nothing — so say "web + dark-web
> corroborate", not "the breach scout found a match". (Optional: add a HIBP key to light it
> up for real.)

---

## 4c · Membrane + sign — 2:55–3:10
**ON SCREEN:** membrane panel → "No prompt-injection detected" → Sanitizer redactions → Judge signs.

**VO (honest — no fake "catch"):** "Nothing crosses back unchecked. The membrane scans every returned source for prompt-injection and identity-exfil, sanitizes every field — PII, secrets, HTML, unsafe URLs — and only then the Judge signs the brief: **Ed25519 over a tamper-evident Merkle ledger**."

> ⚠️ Do **not** claim "caught an injection" on a clean press run — the Injection Hunter
> honestly reports none. If you want a real catch on camera: dispatch a dark-web query where
> a fetched `.onion`/forum post actually contains an injection string — then the quarantine
> is genuine. Otherwise keep the wording above (the wow is the **signature**, not a staged catch).

---

## 4d · Honest inconclusive — 3:10–3:20
**ON SCREEN:** dispatch an obviously invented company (e.g. **Acme Fusion Dynamics**) → inconclusive, confidence 0. *(Never use "Northwind".)*

**VO:** "And when there's nothing there? I ask about a company that doesn't exist. It comes back **inconclusive, confidence zero**. It never fabricates a finding. That's the line between a real agent and a prompt in a box."

---

## 4e · Tamper-evidence — 3:20–3:30
**ON SCREEN:** click **⚠ TAMPER** → recomputed Merkle root turns red, signature still valid.

**VO:** "Tamper with one audit entry — the recomputed root turns red, the signature stays valid. Tampering is **mathematically detectable**."

---

## 4f · Deliverables + verify offline — 3:30–3:40
**ON SCREEN:** download `.xlsx` / STIX from the SIGNAL card → drag `brief.json` onto the VERIFY zone → ✓ AUTHENTIC → edit one byte → ✗ FORGED.

**VO:** "Download it as Excel, or a STIX bundle for your SIEM. Hand the file to anyone — they verify it **offline**. Authentic. Change one byte — forged. Don't trust; verify."

---

### What's real (so you can defend every claim)
- Air-gap: enforced by two Docker networks (4a is a real `curl` timeout).
- Tor exit IP + live `.onion` fetch: real circuit, in the signed ledger.
- Confidence: real noisy-OR fusion over independent sources.
- Signature/tamper: real Ed25519 + Merkle; verify is offline against the embedded key.
- Inconclusive: real honest fallback, never fabricated.
- Documents: real files rendered by the gateway from the signed brief.
