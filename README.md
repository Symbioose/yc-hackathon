# Keystone — Execution Risk Intelligence

> **Paris Builds hackathon** (Unaite × YC) · 27–28 June 2026 · 36h · Prize: €20k + YC interview + a day at QRT
> **Track:** The Next Big DecaCorn
> **Goal:** WIN. Demo that silences the room + real traction + QRT-grade technical depth.

---

## 🧩 One-liner

**Keystone is the "Aladdin for organizational execution risk."**
It ingests a company's work signals (Slack / email / CRM — metadata only), builds a **living graph** of how work *really* flows, quantifies the **probability that critical projects fail** (Org-VaR), stress-tests shocks ("what if this key person leaves?"), and recommends the **single move** to de-risk the org.

> Viva Insights shows you how your team collaborated last month. **Keystone tells you which project will fail next month, who the breaking point is, and the one move to prevent it.** Analytics → Risk management.

---

## 🎯 The problem

Every company runs on an **invisible org** that has nothing to do with the org chart:
- **Key-person risk** — a critical project depends on one person; they leave/burn out → project dies.
- **Hidden bottlenecks** — a few overloaded connectors slow the whole org.
- **Execution risk** — a project will slip in 3 weeks due to structural overload, and nobody sees it coming.

Today this is "felt" by managers or mapped *once, statically* by consultants for $100K–$300K. **Nobody quantifies it as a continuous, predictive risk.**

---

## 💡 The solution (what we build)

Treat the org like a **portfolio** and apply quant risk management to it:

1. **Ingest** → connect a data source (demo: Enron corpus / a real GitHub org / live Slack). Metadata only.
2. **Graph** → living temporal graph. Nodes = people/teams, edges = real collaboration flows (weighted by frequency + recency).
3. **Quantify risk**:
   - **Concentration risk** (key-person) → centrality + articulation points
   - **Load forecast** per node/edge → time-series (seasonality + trend)
   - **Org-VaR** → probability × magnitude of execution failure
4. **Stress test** → "remove this person" / "Q4 demand surge" → graph fractures, Org-VaR spikes.
5. **Optimize & act** → agent recommends the minimal reallocation that drops risk below threshold.
6. **Report** → anonymized, exec-ready risk report.

---

## 🎬 The demo (60–90s) — this is what we rehearse

1. **Connect real data** → ingest Enron (real company, real collapse) or a real GitHub org.
2. **Graph comes alive** → real people, real flows, pulsing. Keystone nodes glow.
3. **Reveal the hidden org** → "Org chart says these 5 are critical. The data says these 3 hidden people carry the company. 1 project depends on a single person."
4. **Scrub time forward** → a team turns red → "Q4: overload 140%, Project Falcon = 73% delay probability."
5. **Stress test live** → "What if this keystone person leaves?" → graph fractures, Org-VaR €1.2M → €4.8M.
6. **Agent acts** → proposes optimal reallocation → red turns green, Org-VaR drops.
7. **Output** → anonymized exec risk report.

> Killer line (Enron version): *"Keystone would have flagged the risk concentration months before the collapse."*

---

## 🏆 Why it wins (winning patterns from past hackathons)

- **World > dashboard** → a living, fracturing org graph, not a table.
- **Simulation must produce a decision** → stress test → quantified risk → optimal action.
- **Sponsor frontier (QRT)** → portfolio risk math (concentration risk, VaR, stress test, optimization). QRT lives in this. Lead with the math.
- **Real data, no fake** → Enron / GitHub / live Slack = undeniable. Kills the "fake demo data" problem.
- **Traction** → we collect real waitlist signups from real, *relevant* buyers (state numbers only if true and defensible).

---

## 🛠️ Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + graph viz (`react-force-graph` / Sigma.js / D3) + time slider |
| Backend | Python (FastAPI) |
| Graph + risk | NetworkX / igraph — centrality, articulation points |
| Forecast | lightweight time-series (seasonality + trend) |
| Org-VaR | transparent, defensible formula (probability × value-at-risk) |
| Optimization | greedy / LP for reallocation |
| Agents | LangGraph + Claude (ingestion → entity/edge extraction, stress-test narration, intervention proposals) |
| Data | Enron email corpus (public) + a real GitHub org via API; optional live Slack connector |
| Deploy | Vercel (front) + Railway/Render (back) |

---

## 👥 Team & ownership

| Person | Owns |
|---|---|
| **Louis** (CS/Math) | Graph engine + concentration risk + Org-VaR + optimization |
| **Dung** (CS) | Data ingestion + backend + forecast pipeline |
| **Emile** (AI/agents/demo) | Agentic layer + living-graph demo + pitch storyline |
| **Malena** (Finance/M&A) | Risk/ROI narrative + buyer + waitlist outreach |
| **Gibril** (hard science) | Dashboard + reliability + report export |

> Assign owners from minute one. Don't let two people touch the same file in parallel.

---

## 📅 36-hour plan

- **H0–4** — lock scope + datasets (Enron + 1 GitHub org) + demo script + ownership
- **H4–14** — core engine: ingest → temporal graph → centrality/concentration risk → load forecast → Org-VaR
- **H14–24** — living graph UI + time slider + stress test (fracture + VaR spike) + reallocation optimization
- **H24–32** — rehearse demo + backup video + pitch deck + first design partners
- **H32–36** — 2–3 clean demo runs + report export + polish + submit

---

## 🚀 Getting started (to fill as we scaffold)

```bash
# clone
git clone https://github.com/Symbioose/yc-hackathon.git
cd yc-hackathon

# backend (Python)
# cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn main:app --reload

# frontend (React)
# cd frontend && npm install && npm run dev
```

> Repo structure, env vars, and run commands will be added here as we scaffold the project.

---

## 📊 Business / pitch essentials

- **Buyer:** COO / CHRO / CFO / Head of Delivery (fast-scaling tech, consulting/agencies, PE portfolios).
- **Model:** SaaS ($2K–$20K/mo by headcount) + event-based de-risking (reorg / M&A / layoffs — replaces $100K–$300K consulting).
- **Vision:** the system of record for organizational risk — "Aladdin for organizations."
- **Anti-Viva line:** "Viva is analytics. Keystone is risk management. We forecast failure and prescribe the fix."
- **Privacy:** metadata only, aggregated + anonymized, consent + admin-controlled. Say it explicitly.

---

## ⚠️ Risks we're actively managing

| Risk | Mitigation |
|---|---|
| Demo looks like fake data | Use Enron + real GitHub org; offer live Slack connect |
| QRT sees "HR tool" not quant | Frame as portfolio risk / Org-VaR; lead with the math |
| Crowded space (Viva, BehaviorGraph, Cally…) | Wedge = quantified risk + stress test + optimization, not analytics |
| Org-VaR seems hand-wavy | Keep the formula transparent; show the inputs |
| Waitlist traction | Only claim real, relevant signups — a YC partner WILL probe "who are they?" |

---

## 📚 Strategic context

Full strategy, scoring, competitor analysis and the detailed spec live in the brainstorm vault (`yc-brainstorm`):
- `16_Project_Spec_Keystone.md` — source of truth for the project
- `AGENTS.md` — strategy, QRT lever, winning patterns
- `00_Context_Paris_Builds.md` — event, sponsors, judging

---

*Let's take the interview. 🦅*
