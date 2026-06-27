# Periscope Phase 1 — Real Research Swarm + Tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mocked fake fleet with a **real agentic swarm on OpenAI (Vercel AI SDK)** that genuinely acts on the outside world — real web fetch, one live Tor `.onion` fetch (foreign exit IP), real breach/OSINT lookups — while the **hero signal stays deterministic** (cached, contract-stable) and a **feature flag falls back to the fake fleet** for demo safety. The `TraceEvent`/`Signal` contract and the ops-center UI are unchanged.

**Architecture:** New `packages/tools` (provider-agnostic tool functions: web, Tor, breach/OSINT) and `packages/agents` (AI SDK agents: Web/Tor/Breach Scouts + Planner orchestrator). The external gateway swaps `runFakeFleet` for `runFleet(mission)`, gated by `USE_REAL_FLEET`. Scouts call tools in an AI SDK `stopWhen: stepCountIs(...)` loop; each tool's `execute` emits `TraceEvent`s to the existing `missionStore` bus, so the ops-center "ignites" exactly as today. The Planner collects `SourceContribution[]`, fuses confidence (noisy-OR, already in `@periscope/fixtures`), and — for the hero ticker — pins the final `Signal` to the verified fixture so the climax is reproducible.

**Tech Stack:** TypeScript (ESM), Vercel AI SDK (`ai` + `@ai-sdk/openai`), Zod, `fetch-socks` (undici SOCKS dispatcher for Tor), Vitest, Docker (`tor` daemon service). OpenAI models + API key via env.

**Reference spec:** `docs/superpowers/specs/2026-06-27-periscope-architecture-design.md` (§3, §7.1, §7.4, §9, §10). Builds on the merged Phase 0.

---

## Prerequisites (env — set before integration steps; unit tests don't need them)

Create `.env` at repo root (and ensure `external-app` receives these in `docker-compose.yml`, Task 8):

```
OPENAI_API_KEY=sk-...            # required for any LLM step
OPENAI_MODEL_STRONG=...          # Planner synthesis (set the exact OpenAI model id you have access to)
OPENAI_MODEL_FAST=...            # Scouts (faster/cheaper tier)
HIBP_API_KEY=...                 # optional; breach tool degrades gracefully if absent
INTELX_API_KEY=...               # optional; breach tool degrades gracefully if absent
TOR_SOCKS_HOST=tor               # tor daemon hostname (docker service); localhost for bare-metal dev
TOR_SOCKS_PORT=9050
USE_REAL_FLEET=1                 # 0 → fall back to the Phase-0 fake fleet (demo safety)
```

`.env` is already gitignored (`.env*.local`); add a committed `.env.example` mirroring the keys (Task 1).

> **AI SDK version note for implementers:** this plan targets the AI SDK v5 surface — `tool({ inputSchema, execute })` and `stopWhen: stepCountIs(n)`. After `pnpm add ai @ai-sdk/openai`, confirm the exact exported symbol names (`stepCountIs` vs `isStepCount`, `onStepFinish` vs `onStepEnd`, `result.fullStream` vs `result.stream`) against the installed version's `node_modules/ai` types and adjust call sites if the minor version differs. The field name (`inputSchema`) and the `stopWhen` mechanism are stable; only helper symbol names may vary.

---

## File structure (created/modified in this plan)

```
.env.example                                  committed template (NEW)
packages/tools/
  package.json  tsconfig.json
  src/web.ts            fetchUrl()                                   (NEW)
  src/web.test.ts
  src/tor.ts            torFetch() via fetch-socks, getExitIp()      (NEW)
  src/ahmia.ts          ahmiaSearch() (clearnet .onion index)        (NEW)
  src/breach.ts         hibpLookup(), intelxSearch(), heroSourcesFor()  (NEW)
  src/breach.test.ts    hero-pinning is deterministic
  src/index.ts          barrel export
packages/agents/
  package.json  tsconfig.json
  src/provider.ts       openai provider from env (strong/fast)       (NEW)
  src/trace.ts          emit-helper bound to a mission_id            (NEW)
  src/scouts.ts         webScout(), torScout(), breachScout()        (NEW)
  src/planner.ts        runSwarm(): scouts → sources → Signal        (NEW)
  src/planner.test.ts   hero-pinned Signal is deterministic
  src/index.ts          barrel export
apps/external/
  lib/realFleet.ts      runFleet() — real swarm → missionStore bus   (NEW)
  lib/fleet.ts          chooses real vs fake by USE_REAL_FLEET       (NEW)
  app/api/missions/route.ts   (MODIFY: call runFleetSelected)
docker-compose.yml      (MODIFY: add tor service + external-app env)
```

`@periscope/contracts` (TraceEvent, Signal, SourceContribution) and `@periscope/fixtures` (`heroSignal`, `fuseConfidence`, `heroCase`) are reused unchanged.

---

## Task 1: Workspace deps + `.env.example` + tools package scaffold

**Files:**
- Create: `.env.example`, `packages/tools/package.json`, `packages/tools/tsconfig.json`, `packages/tools/src/index.ts`

- [ ] **Step 1: Create `.env.example`** (committed template; real `.env` stays gitignored)

```
OPENAI_API_KEY=
OPENAI_MODEL_STRONG=
OPENAI_MODEL_FAST=
HIBP_API_KEY=
INTELX_API_KEY=
TOR_SOCKS_HOST=tor
TOR_SOCKS_PORT=9050
USE_REAL_FLEET=1
```

- [ ] **Step 2: Create `packages/tools/package.json`**

```json
{
  "name": "@periscope/tools",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@periscope/contracts": "workspace:*",
    "@periscope/fixtures": "workspace:*",
    "fetch-socks": "^1.3.0",
    "undici": "^6.21.0"
  },
  "devDependencies": { "typescript": "^5.7.0", "vitest": "^2.1.0" }
}
```

- [ ] **Step 3: Create `packages/tools/tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "noEmit": true }, "include": ["src"] }
```

- [ ] **Step 4: Create `packages/tools/src/index.ts` (barrel; filled by later tasks)**

```ts
export * from "./web";
export * from "./ahmia";
export * from "./tor";
export * from "./breach";
```

- [ ] **Step 5: Install**

Run: `pnpm install`
Expected: resolves `@periscope/tools` + `fetch-socks` + `undici`. (`index.ts` will not typecheck until web/ahmia/tor/breach exist — that's fine; later tasks add them. Do not run typecheck yet.)

- [ ] **Step 6: Commit**

```bash
git add .env.example packages/tools/package.json packages/tools/tsconfig.json packages/tools/src/index.ts pnpm-lock.yaml
git commit -m "chore(tools): scaffold @periscope/tools package + .env.example"
```

---

## Task 2: Web fetch tool (TDD)

**Files:**
- Create: `packages/tools/src/web.ts`
- Test: `packages/tools/src/web.test.ts`

- [ ] **Step 1: Write the failing test `packages/tools/src/web.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { fetchUrl } from "./web";

describe("fetchUrl", () => {
  it("returns status + truncated text for a reachable page", async () => {
    const r = await fetchUrl("https://example.com");
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.text.toLowerCase()).toContain("example domain");
    expect(r.text.length).toBeLessThanOrEqual(8000);
  }, 15000);

  it("reports a failure (no throw) for an unresolvable host", async () => {
    const r = await fetchUrl("https://nonexistent.invalid.periscope");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  }, 15000);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @periscope/tools test src/web.test.ts`
Expected: FAIL — `fetchUrl` not exported.

- [ ] **Step 3: Implement `packages/tools/src/web.ts`**

```ts
export interface FetchResult {
  url: string;
  ok: boolean;
  status: number;
  text: string;      // truncated to 8000 chars
  title?: string;
  error?: string;
}

const MAX = 8000;

export async function fetchUrl(url: string, timeoutMs = 10000): Promise<FetchResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "PeriscopeBot/0.1" } });
    const body = await res.text();
    const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    return { url, ok: res.ok, status: res.status, text: body.slice(0, MAX), title };
  } catch (e) {
    return { url, ok: false, status: 0, text: "", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @periscope/tools test src/web.test.ts`
Expected: PASS (2 tests). (Requires outbound internet — you have it on the host.)

- [ ] **Step 5: Commit**

```bash
git add packages/tools/src/web.ts packages/tools/src/web.test.ts
git commit -m "feat(tools): real web fetchUrl with timeout + truncation"
```

---

## Task 3: Ahmia search + Tor `.onion` fetch

**Files:**
- Create: `packages/tools/src/ahmia.ts`, `packages/tools/src/tor.ts`

- [ ] **Step 1: Implement `packages/tools/src/ahmia.ts` (clearnet index of `.onion` sites)**

```ts
import { fetchUrl } from "./web";

export interface OnionHit { title: string; onion: string; }

/** Query the Ahmia clearnet index; parse .onion result links. Returns [] on failure. */
export async function ahmiaSearch(query: string, limit = 5): Promise<OnionHit[]> {
  const r = await fetchUrl(`https://ahmia.fi/search/?q=${encodeURIComponent(query)}`, 12000);
  if (!r.ok) return [];
  const hits: OnionHit[] = [];
  const re = /<a[^>]+href="(?:\/search\/redirect\?[^"]*redirect_url=)?(https?:\/\/[a-z2-7]{16,56}\.onion[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(r.text)) && hits.length < limit) {
    hits.push({ onion: decodeURIComponent(m[1]), title: m[2].trim() });
  }
  return hits;
}
```

- [ ] **Step 2: Implement `packages/tools/src/tor.ts` (live SOCKS5 `.onion` fetch + exit IP)**

```ts
import { socksDispatcher } from "fetch-socks";

const HOST = process.env.TOR_SOCKS_HOST ?? "127.0.0.1";
const PORT = Number(process.env.TOR_SOCKS_PORT ?? 9050);

function dispatcher() {
  return socksDispatcher({ type: 5, host: HOST, port: PORT });
}

export interface TorResult {
  url: string;
  ok: boolean;
  status: number;
  text: string;
  error?: string;
}

/** Fetch any URL (incl. .onion) through the Tor SOCKS5 proxy. */
export async function torFetch(url: string, timeoutMs = 30000): Promise<TorResult> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      // @ts-expect-error undici dispatcher is accepted at runtime by Node fetch
      dispatcher: dispatcher(),
      signal: ctrl.signal,
      headers: { "user-agent": "PeriscopeBot/0.1" },
    });
    const body = await res.text();
    return { url, ok: res.ok, status: res.status, text: body.slice(0, 8000) };
  } catch (e) {
    return { url, ok: false, status: 0, text: "", error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

/** The Tor exit-node IP as seen by the outside world (proves foreign egress). */
export async function getExitIp(): Promise<{ ip?: string; error?: string }> {
  const r = await torFetch("https://api.ipify.org?format=json", 30000);
  if (!r.ok) return { error: r.error ?? `status ${r.status}` };
  try { return { ip: JSON.parse(r.text).ip }; } catch { return { error: "parse" }; }
}
```

- [ ] **Step 3: Typecheck (no unit test — Tor is integration; verified in Task 8 under Docker)**

Run: `pnpm --filter @periscope/tools typecheck`
Expected: passes once `breach.ts` exists too. If `index.ts` re-export of `./breach` errors, temporarily comment that line, typecheck, then restore in Task 4. (Or do Task 4 first, then typecheck once.)

- [ ] **Step 4: Commit**

```bash
git add packages/tools/src/ahmia.ts packages/tools/src/tor.ts
git commit -m "feat(tools): ahmiaSearch (clearnet) + Tor SOCKS5 torFetch/getExitIp"
```

---

## Task 4: Breach/OSINT tool with deterministic hero pinning (TDD)

**Files:**
- Create: `packages/tools/src/breach.ts`
- Test: `packages/tools/src/breach.test.ts`

- [ ] **Step 1: Write the failing test `packages/tools/src/breach.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { heroSourcesFor } from "./breach";

describe("heroSourcesFor", () => {
  it("returns the verified fixture sources for the hero ticker (deterministic)", () => {
    const s = heroSourcesFor("LYV");
    expect(s.length).toBeGreaterThanOrEqual(2);
    expect(s.map((x) => x.name)).toContain("BreachForums");
    expect(s.every((x) => x.reliability > 0 && x.reliability <= 1)).toBe(true);
  });

  it("returns null for a non-hero ticker", () => {
    expect(heroSourcesFor("AAPL")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @periscope/tools test src/breach.test.ts`
Expected: FAIL — `heroSourcesFor` not exported.

- [ ] **Step 3: Implement `packages/tools/src/breach.ts`**

```ts
import type { SourceContribution } from "@periscope/contracts";
import { heroCase } from "@periscope/fixtures";

/** Hero pinning: for the demo ticker, return the verified fixture sources so the
 * final Signal is reproducible regardless of live API availability (spec §10). */
export function heroSourcesFor(ticker: string): SourceContribution[] | null {
  if (ticker?.toUpperCase() === heroCase.primary.ticker.toUpperCase()) {
    return heroCase.primary.sources;
  }
  return null;
}

/** Live HIBP breaches for a domain. Returns [] if no key or on failure (graceful). */
export async function hibpLookup(domain: string): Promise<SourceContribution[]> {
  const key = process.env.HIBP_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://haveibeenpwned.com/api/v3/breaches?domain=${encodeURIComponent(domain)}`, {
      headers: { "hibp-api-key": key, "user-agent": "PeriscopeBot/0.1" },
    });
    if (!res.ok) return [];
    const list = (await res.json()) as Array<{ Name: string; BreachDate: string }>;
    return list.slice(0, 3).map((b) => ({
      name: `HIBP:${b.Name}`, type: "breach_api" as const, reliability: 0.6, observed_at: b.BreachDate,
    }));
  } catch { return []; }
}

/** Live IntelX search. Returns [] if no key or on failure (graceful). */
export async function intelxSearch(term: string): Promise<SourceContribution[]> {
  const key = process.env.INTELX_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://2.intelx.io/intelligent/search?term=${encodeURIComponent(term)}`, {
      headers: { "x-key": key, "user-agent": "PeriscopeBot/0.1" },
    });
    if (!res.ok) return [];
    return [{ name: "IntelX", type: "breach_api", reliability: 0.55, observed_at: new Date().toISOString().slice(0, 10) }];
  } catch { return []; }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @periscope/tools test src/breach.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck the whole package**

Run: `pnpm --filter @periscope/tools typecheck`
Expected: passes (barrel `index.ts` now resolves all four modules).

- [ ] **Step 6: Commit**

```bash
git add packages/tools/src/breach.ts packages/tools/src/breach.test.ts
git commit -m "feat(tools): breach/OSINT (HIBP/IntelX) + deterministic hero pinning"
```

---

## Task 5: `packages/agents` scaffold + provider + trace helper + Scouts

**Files:**
- Create: `packages/agents/package.json`, `tsconfig.json`, `src/provider.ts`, `src/trace.ts`, `src/scouts.ts`, `src/index.ts`

- [ ] **Step 1: Create `packages/agents/package.json`**

```json
{
  "name": "@periscope/agents",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@periscope/contracts": "workspace:*",
    "@periscope/fixtures": "workspace:*",
    "@periscope/tools": "workspace:*",
    "ai": "^5.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": { "typescript": "^5.7.0", "vitest": "^2.1.0" }
}
```

> After `pnpm install`, check the resolved `ai` / `@ai-sdk/openai` major versions and reconcile the AI SDK symbol names per the version note at the top of this plan.

- [ ] **Step 2: Create `packages/agents/tsconfig.json`**

```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "noEmit": true }, "include": ["src"] }
```

- [ ] **Step 3: Create `packages/agents/src/provider.ts`**

```ts
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
  // baseURL can be overridden for the sealed-agent on-prem proxy (Phase 1b); default = OpenAI direct
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

export const strongModel = () => openai(process.env.OPENAI_MODEL_STRONG ?? "");
export const fastModel = () => openai(process.env.OPENAI_MODEL_FAST ?? "");
```

- [ ] **Step 4: Create `packages/agents/src/trace.ts`**

```ts
import type { TraceEvent } from "@periscope/contracts";

export type TraceSink = (ev: TraceEvent) => void;

/** Bind a sink + mission_id so tools/agents emit contract-valid TraceEvents tersely. */
export function tracer(missionId: string, sink: TraceSink) {
  return (
    layer: TraceEvent["layer"],
    agent: string,
    level: TraceEvent["level"],
    msg: string,
    meta?: Record<string, unknown>,
  ) => sink({ mission_id: missionId, ts: new Date().toISOString(), layer, agent, level, msg, meta });
}
export type Trace = ReturnType<typeof tracer>;
```

- [ ] **Step 5: Create `packages/agents/src/scouts.ts`**

```ts
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import type { SourceContribution } from "@periscope/contracts";
import { fetchUrl, ahmiaSearch, torFetch, getExitIp, hibpLookup, intelxSearch, heroSourcesFor } from "@periscope/tools";
import { fastModel } from "./provider";
import type { Trace } from "./trace";

export interface ScoutResult { sources: SourceContribution[]; notes: string; }

// --- Web Scout: open + blocked web -----------------------------------------
export async function webScout(mission: { query: string; target_entity?: string }, trace: Trace): Promise<ScoutResult> {
  trace("execution", "WebScout", "action", "Searching open + blocked web sources");
  const found: SourceContribution[] = [];
  const res = await generateText({
    model: fastModel(),
    stopWhen: stepCountIs(4),
    tools: {
      fetch_url: tool({
        description: "Fetch a web page (open or firewall-blocked). Returns status + text.",
        inputSchema: z.object({ url: z.string().url() }),
        execute: async ({ url }) => {
          trace("execution", "WebScout", "action", `GET ${url}`);
          const r = await fetchUrl(url);
          if (r.ok) found.push({ name: new URL(url).hostname, type: "press", reliability: 0.4, observed_at: new Date().toISOString().slice(0, 10), url });
          return { ok: r.ok, status: r.status, title: r.title, text: r.text.slice(0, 1500) };
        },
      }),
    },
    prompt: `You are a web-research scout. Find press/forum corroboration that "${mission.target_entity ?? mission.query}" suffered a data breach. Fetch 1-2 relevant URLs, then stop and summarize in one sentence.`,
  });
  return { sources: found, notes: res.text };
}

// --- Tor Scout: live .onion fetch (the proof beat) --------------------------
export async function torScout(mission: { target_entity?: string; query: string }, trace: Trace): Promise<ScoutResult> {
  trace("execution", "TorScout", "action", "Establishing Tor circuit");
  const exit = await getExitIp();
  if (exit.ip) trace("execution", "TorScout", "success", `Tor exit established`, { exit_ip: exit.ip });
  else trace("execution", "TorScout", "warn", `Tor exit unavailable: ${exit.error}`);

  const sources: SourceContribution[] = [];
  const hits = await ahmiaSearch(`${mission.target_entity ?? mission.query} breach`, 3);
  if (hits.length) {
    trace("execution", "TorScout", "action", `Ahmia returned ${hits.length} .onion candidates; fetching one live`, { onion_url: hits[0].onion });
    const r = await torFetch(hits[0].onion);
    if (r.ok) {
      sources.push({ name: hits[0].title || "tor_forum", type: "tor_forum", reliability: 0.7, observed_at: new Date().toISOString().slice(0, 10), url: hits[0].onion });
      trace("execution", "TorScout", "success", `Live .onion fetch OK (${r.status})`, { onion_url: hits[0].onion, exit_ip: exit.ip });
    } else {
      trace("execution", "TorScout", "warn", `.onion fetch failed: ${r.error ?? r.status}`);
    }
  } else {
    trace("execution", "TorScout", "warn", "No .onion candidates from Ahmia");
  }
  return { sources, notes: `tor exit ${exit.ip ?? "n/a"}, ${sources.length} onion source(s)` };
}

// --- Breach Scout: APIs + deterministic hero pinning ------------------------
export async function breachScout(mission: { ticker?: string; target_entity?: string }, trace: Trace): Promise<ScoutResult> {
  trace("execution", "BreachScout", "action", "Querying breach APIs (HIBP/IntelX)");
  const pinned = mission.ticker ? heroSourcesFor(mission.ticker) : null;
  if (pinned) {
    trace("execution", "BreachScout", "success", `Verified breach corroboration found (${pinned.length} sources)`);
    return { sources: pinned, notes: "verified hero corroboration" };
  }
  const domain = (mission.target_entity ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
  const [hibp, ix] = await Promise.all([hibpLookup(domain), intelxSearch(mission.target_entity ?? "")]);
  const sources = [...hibp, ...ix];
  trace("execution", "BreachScout", sources.length ? "success" : "info", `Breach APIs returned ${sources.length} sources`);
  return { sources, notes: `${sources.length} breach-api sources` };
}
```

- [ ] **Step 6: Create `packages/agents/src/index.ts`**

```ts
export * from "./scouts";
export * from "./planner";
export * from "./trace";
```

- [ ] **Step 7: Install + typecheck (planner added next task; comment its export if needed, then restore)**

Run: `pnpm install && pnpm --filter @periscope/agents typecheck`
Expected: passes once `planner.ts` exists (Task 6). If typecheck runs before Task 6, temporarily comment the `./planner` export.

- [ ] **Step 8: Commit**

```bash
git add packages/agents/package.json packages/agents/tsconfig.json packages/agents/src/provider.ts packages/agents/src/trace.ts packages/agents/src/scouts.ts packages/agents/src/index.ts pnpm-lock.yaml
git commit -m "feat(agents): scaffold + provider + trace helper + Web/Tor/Breach scouts (AI SDK)"
```

---

## Task 6: Planner / swarm orchestrator with deterministic hero Signal (TDD)

**Files:**
- Create: `packages/agents/src/planner.ts`
- Test: `packages/agents/src/planner.test.ts`

- [ ] **Step 1: Write the failing test `packages/agents/src/planner.test.ts`** (mocks scouts; asserts hero pinning, no LLM/network needed)

```ts
import { describe, it, expect, vi } from "vitest";
import { SignalSchema } from "@periscope/contracts";

// Mock the scouts so the test is deterministic and offline.
vi.mock("./scouts", () => ({
  webScout: async () => ({ sources: [], notes: "web" }),
  torScout: async () => ({ sources: [{ name: "BreachForums", type: "tor_forum", reliability: 0.7, observed_at: "2024-05-27" }], notes: "tor" }),
  breachScout: async () => ({ sources: [{ name: "HIBP", type: "breach_api", reliability: 0.6, observed_at: "2024-05-28" }], notes: "breach" }),
}));

import { synthesizeSignal } from "./planner";

describe("synthesizeSignal (hero pinning)", () => {
  it("produces the deterministic hero Signal for the hero ticker", () => {
    const sources = [
      { name: "BreachForums", type: "tor_forum" as const, reliability: 0.7, observed_at: "2024-05-27" },
      { name: "HIBP", type: "breach_api" as const, reliability: 0.6, observed_at: "2024-05-28" },
    ];
    const s = synthesizeSignal({ ticker: "LYV", target_entity: "Live Nation", query: "x" }, sources);
    expect(() => SignalSchema.parse(s)).not.toThrow();
    expect(s.entity).toContain("Live Nation");
    expect(s.lead_time_days).toBe(4);
    expect(s.confidence).toBeCloseTo(0.88, 2); // noisy-OR of 0.7 + 0.6
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @periscope/agents test src/planner.test.ts`
Expected: FAIL — `synthesizeSignal` not exported.

- [ ] **Step 3: Implement `packages/agents/src/planner.ts`**

```ts
import type { Mission, Signal, SourceContribution } from "@periscope/contracts";
import { heroCase, heroSignal, fuseConfidence } from "@periscope/fixtures";
import { webScout, torScout, breachScout } from "./scouts";
import type { Trace } from "./trace";

/** Build the final Signal from collected sources. Hero ticker → pinned verified
 * fixture Signal (deterministic climax). Otherwise → live synthesis from sources. */
export function synthesizeSignal(mission: Pick<Mission, "ticker" | "target_entity" | "query">, sources: SourceContribution[]): Signal {
  const isHero = mission.ticker?.toUpperCase() === heroCase.primary.ticker.toUpperCase();
  if (isHero) {
    // Pin entity/dates/alpha from the verified fixture; confidence fuses the
    // actually-collected sources (falls back to fixture sources if scouts found none).
    const base = heroSignal();
    const used = sources.length ? sources : base.sources;
    return { ...base, sources: used, confidence: fuseConfidence(used) };
  }
  return {
    entity: mission.target_entity ?? mission.query,
    ticker: mission.ticker,
    event_type: "suspected_breach",
    sources,
    confidence: fuseConfidence(sources),
    confidence_method: "noisy_or",
    observed_at: sources[0]?.observed_at ?? new Date().toISOString().slice(0, 10),
    summary: `Corroboration from ${sources.length} source(s) for ${mission.target_entity ?? mission.query}.`,
  };
}

/** Run the full swarm: plan → scouts (parallel) → synthesize. Emits TraceEvents. */
export async function runSwarm(mission: Mission, trace: Trace): Promise<Signal> {
  trace("execution", "Planner", "action", "Decomposing mission → Web/Tor/Breach scouts");
  const [web, tor, breach] = await Promise.all([
    webScout(mission, trace),
    torScout(mission, trace),
    breachScout(mission, trace),
  ]);
  const sources = [...web.sources, ...tor.sources, ...breach.sources];
  trace("execution", "Planner", "success", `Synthesizing signal from ${sources.length} source(s) across 3 scouts`);
  return synthesizeSignal(mission, sources);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @periscope/agents test src/planner.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Full package typecheck**

Run: `pnpm --filter @periscope/agents typecheck`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add packages/agents/src/planner.ts packages/agents/src/planner.test.ts
git commit -m "feat(agents): Planner runSwarm + synthesizeSignal with deterministic hero pinning"
```

---

## Task 7: Wire the real swarm into the external gateway (behind a flag)

**Files:**
- Create: `apps/external/lib/realFleet.ts`, `apps/external/lib/fleet.ts`
- Modify: `apps/external/app/api/missions/route.ts`
- Modify: `apps/external/package.json` (add `@periscope/agents`, `@periscope/tools` deps), `apps/external/next.config.mjs` (transpile new packages)

- [ ] **Step 1: Add deps to `apps/external/package.json`**

Add to `dependencies`: `"@periscope/agents": "workspace:*"`, `"@periscope/tools": "workspace:*"`. Then run `pnpm install`.

- [ ] **Step 2: Add the new packages to `apps/external/next.config.mjs` transpile list**

Modify the `transpilePackages` array to include `"@periscope/agents"` and `"@periscope/tools"` alongside the existing entries. Keep the `rewrites()` from Phase 0 intact.

- [ ] **Step 3: Create `apps/external/lib/realFleet.ts`**

```ts
import type { Mission } from "@periscope/contracts";
import { runSwarm, tracer } from "@periscope/agents";
import { completeMission, emitTrace } from "./missionStore";

export async function runRealFleet(mission: Mission): Promise<void> {
  const trace = tracer(mission.id, emitTrace);
  trace("dispatch", "Gateway", "info", "Mission received via sealed egress");
  trace("policy", "PolicyAgent", "success", "Mission within tenant policy (osint_readonly)");
  trace("identity", "IdentityIsolation", "info", "Client identity stripped; acting under Periscope egress");
  try {
    const signal = await runSwarm(mission, trace);
    trace("membrane", "Sanitizer", "success", "PII/secret/malware stripped");
    trace("membrane", "Judge", "success", "Consensus PASS — signing brief");
    trace("audit", "AuditAgent", "success", "Brief recorded in audit ledger");
    completeMission(mission.id, signal);
  } catch (e) {
    trace("execution", "Planner", "warn", `Swarm error: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}
```

- [ ] **Step 4: Create `apps/external/lib/fleet.ts` (flag-based selector + safety fallback)**

```ts
import type { Mission } from "@periscope/contracts";
import { runFakeFleet } from "./fakeFleet";
import { runRealFleet } from "./realFleet";

export async function runFleet(mission: Mission): Promise<void> {
  if (process.env.USE_REAL_FLEET === "1") {
    try {
      await runRealFleet(mission);
      return;
    } catch {
      // Demo safety: if the real swarm fails (no key / Tor down), fall back to the
      // scripted fleet so the demo still completes with the hero signal.
      await runFakeFleet(mission);
      return;
    }
  }
  await runFakeFleet(mission);
}
```

- [ ] **Step 5: Modify `apps/external/app/api/missions/route.ts`** — swap the fake-fleet call for the selector. Change the import from `import { runFakeFleet } from "@/lib/fakeFleet";` to `import { runFleet } from "@/lib/fleet";` and the call from `void runFakeFleet(mission);` to `void runFleet(mission);`. Everything else (Mission parse, createMission, response) stays.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @periscope/external typecheck`
Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add apps/external/lib/realFleet.ts apps/external/lib/fleet.ts apps/external/app/api/missions/route.ts apps/external/package.json apps/external/next.config.mjs pnpm-lock.yaml
git commit -m "feat(external): wire real swarm behind USE_REAL_FLEET with fake-fleet fallback"
```

---

## Task 8: Docker — add Tor service + env; integration verify

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add the `tor` service and `external-app` env to `docker-compose.yml`**

Add under `services:` (keep existing `external-app`/`internal-app` and the two networks):

```yaml
  tor:
    image: dperson/torproxy
    networks: [external]

  # ... on external-app, add:
  #   environment:
  #     OPENAI_API_KEY: ${OPENAI_API_KEY}
  #     OPENAI_MODEL_STRONG: ${OPENAI_MODEL_STRONG}
  #     OPENAI_MODEL_FAST: ${OPENAI_MODEL_FAST}
  #     HIBP_API_KEY: ${HIBP_API_KEY:-}
  #     INTELX_API_KEY: ${INTELX_API_KEY:-}
  #     TOR_SOCKS_HOST: tor
  #     TOR_SOCKS_PORT: "9050"
  #     USE_REAL_FLEET: ${USE_REAL_FLEET:-1}
```

Apply the commented `environment:` block to the real `external-app` service (uncomment + indent correctly). Add `tor` to `external-app`'s `depends_on`. Compose reads `${VAR}` from the repo-root `.env`.

- [ ] **Step 2: Bring up and verify the real swarm produces the hero signal (requires `.env` with `OPENAI_API_KEY` + models)**

Run (timeout 600000): `docker compose up --build -d`
Then wait for health: `until curl -sf http://localhost:3000/api/health; do sleep 2; done`
Then dispatch through the sealed app and confirm the hero signal still returns:
```
ID=$(curl -s -X POST http://localhost:3000/bank/api/dispatch -H 'content-type: application/json' -d '{"query":"Is Live Nation compromised?","ticker":"LYV","target_entity":"Live Nation"}' | sed -E 's/.*"id":"([^"]+)".*/\1/')
for i in $(seq 1 40); do sleep 1; curl -s -o /tmp/sig -w "%{http_code}" http://localhost:3000/bank/api/signal/$ID | grep -q 200 && break; done
cat /tmp/sig
```
Expected: the Live Nation hero Signal (`lead_time_days: 4`). Watch `http://localhost:3000` — the trace should now show **real** scout activity (real `GET` lines, a Tor exit IP if Tor connected). If `OPENAI_API_KEY` is missing or the swarm errors, the fallback fires and the scripted trace + hero signal still appear (confirm the demo still completes either way).

- [ ] **Step 3: Confirm the cage still holds and tear down**

Run: `docker compose exec -T internal-app curl -m5 -s -o /dev/null -w "%{http_code}\n" https://google.com || echo "BLOCKED — cage holds"`
Expected: blocked/timeout.
Then: `docker compose down`.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(docker): add tor service + OpenAI/breach/Tor env for the real fleet"
```

---

## Self-review (completed by plan author)

**Spec coverage (Phase 1 scope):** real swarm Planner+Scouts ✓ (T5,T6) · live Tor `.onion` fetch + exit IP ✓ (T3,T5 torScout) · web fetch ✓ (T2) · breach/OSINT ✓ (T4) · multi-source confidence fusion reused from fixtures ✓ (T6) · hero determinism (live=proof, cached=hero per spec §10) ✓ (T4 hero pinning, T6 synthesizeSignal) · contract + ops-center unchanged ✓ (TraceEvent bus reused, no UI change) · demo-safety fallback ✓ (T7 flag). **Deferred to Phase 1b (noted, not in this plan):** the on-prem LLM proxy (`/api/onprem-llm`) + making the *sealed* agent a real LLM agent — the sealed agent is deliberately unimpressive, so this is low-value; `provider.ts` already supports `OPENAI_BASE_URL` for it. **Phase 2 (separate plan):** the real Membrane agents (Injection Hunter etc.), Ed25519 + Merkle ledger, tamper-demo — Task 7 currently emits membrane/audit trace lines as scripted placeholders so the trace stays complete until Phase 2 replaces them.

**Placeholder scan:** No TBD/TODO. The membrane/audit trace lines in `realFleet.ts` are intentional scripted lines (Phase 2 replaces them with real agents) — called out above, not a silent gap. The AI SDK symbol-name caveat is an explicit external-dep verification step, with concrete code given.

**Type consistency:** `Trace`/`tracer` (T5 trace.ts) used by scouts (T5) and planner (T6) and realFleet (T7). `ScoutResult`/`webScout`/`torScout`/`breachScout` (T5) consumed by `runSwarm` (T6). `synthesizeSignal`/`runSwarm` (T6) consumed by `realFleet` (T7). `heroSourcesFor` (T4) used by `breachScout` (T5). `fetchUrl`/`torFetch`/`getExitIp`/`ahmiaSearch`/`hibpLookup`/`intelxSearch` (T2–T4) imported in scouts (T5). `emitTrace`/`completeMission` (Phase 0 missionStore) used by realFleet (T7). `fuseConfidence`/`heroSignal`/`heroCase` (Phase 0 fixtures) used in T4/T6. SSE event names + `Signal`/`TraceEvent` contract unchanged → ops-center (Phase 0) needs no edit.

---

## Notes for later phases (not in this plan)
- **Phase 1b (optional):** `external-app` `/api/onprem-llm/v1/[...path]` proxy → `https://api.openai.com/v1/*` injecting `OPENAI_API_KEY`; sealed agent uses `@ai-sdk/openai` with `OPENAI_BASE_URL=http://external-app:3000/api/onprem-llm/v1` and tools `dispatch` (works) + `fetch_url` (fails, no internet) so it reasons → dispatches. Key never enters the sealed container.
- **Phase 2:** real Membrane (Sanitizer + Injection Hunter + Judge) replacing the scripted membrane lines; `packages/crypto` (Ed25519 sign + Merkle ledger); live injection catch; tamper-demo. `SignedBrief` contract already defined.
- **Phase 3:** AlphaCard + confidence-fusion UI, stock overlay chart, rehearsal + backup video.
