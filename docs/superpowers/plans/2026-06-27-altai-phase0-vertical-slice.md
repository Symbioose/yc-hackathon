# Altai Phase 0 — Vertical Slice on Mocks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo + shared contract + a working end-to-end demo on mocked data: a sealed internal Next app dispatches a mission to the external gateway, a fake fleet streams a realistic live trace and returns the hero (Ticketmaster) signal, and the ops-center renders the trace + signal card — all running under Docker with a *real* network cage.

**Architecture:** pnpm + Turborepo monorepo. `packages/contracts` (Zod) is the shared seam. `apps/external` is the gateway + fake fleet + ops-center UI (bridges both Docker networks). `apps/internal` is the sealed chat that can only reach the gateway. Docker Compose with an `internal:true` network proves the cage. No real LLM/Tor/crypto in Phase 0 — those are Phase 1–2.

**Tech Stack:** TypeScript (ESM), Next.js 15 (App Router), Zod, Vitest, pnpm 10, Turborepo, Docker Compose, `yahoo-finance2` (fixture generation only).

**Reference spec:** `docs/superpowers/specs/2026-06-27-altai-architecture-design.md`

---

## File structure (created in this plan)

```
pnpm-workspace.yaml                 workspace globs
package.json                        root scripts + turbo + vitest
turbo.json                          build/dev/test pipeline
tsconfig.base.json                  shared TS config
.gitignore                          node_modules, .next, .turbo

packages/contracts/
  package.json
  tsconfig.json
  src/index.ts                      Zod: Mission, SourceContribution, Signal, AlphaCard, AuditEntry, SignedBrief, TraceEvent
  src/index.test.ts                 schema validation tests

packages/fixtures/
  package.json
  tsconfig.json
  hero_case.json                    Ticketmaster (primary) + Medibank (secondary); price_series filled by script
  scripts/pull-prices.ts            one-shot: yahoo-finance2 → fills price_series
  src/index.ts                      typed loader for hero_case.json
  src/index.test.ts                 loader validates against contracts

apps/external/                      gateway + fake fleet + ops-center
  package.json  tsconfig.json  next.config.mjs  Dockerfile
  app/layout.tsx  app/globals.css
  app/page.tsx                      ops-center UI (SSE trace + signal card)
  app/api/health/route.ts          liveness probe
  app/api/missions/route.ts        POST: create mission, start fake fleet
  app/api/missions/[id]/signal/route.ts   GET: final signal (202 until ready)
  app/api/events/route.ts          GET: SSE firehose of TraceEvents + signal
  lib/missionStore.ts              in-memory state + EventEmitter bus
  lib/fakeFleet.ts                 scripted TraceEvent sequence + hero signal

apps/internal/                     sealed chat (dispatch-only egress)
  package.json  tsconfig.json  next.config.mjs  Dockerfile
  app/layout.tsx  app/globals.css
  app/page.tsx                     chat UI: ask → dispatch → render brief
  app/api/dispatch/route.ts        POST: server-side proxy → external gateway
  app/api/signal/[id]/route.ts     GET: server-side proxy → external signal

docker-compose.yml                 internal:true + external networks; cage proof
```

---

## Task 1: Monorepo scaffold

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `turbo.json`, `tsconfig.base.json`, `.gitignore`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "altai",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.21.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "noEmit": false
  }
}
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules
.next
.turbo
dist
*.tsbuildinfo
.env*.local
```

- [ ] **Step 6: Install and verify the workspace resolves**

Run: `pnpm install`
Expected: completes without error; `pnpm-lock.yaml` is created.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml package.json turbo.json tsconfig.base.json .gitignore pnpm-lock.yaml
git commit -m "chore: scaffold pnpm + turborepo monorepo"
```

---

## Task 2: `packages/contracts` — the shared Zod contract (TDD)

**Files:**
- Create: `packages/contracts/package.json`, `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/index.test.ts`

- [ ] **Step 1: Create `packages/contracts/package.json`**

```json
{
  "name": "@altai/contracts",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "zod": "^3.23.0" },
  "devDependencies": { "typescript": "^5.7.0", "vitest": "^2.1.0" }
}
```

- [ ] **Step 2: Create `packages/contracts/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src"]
}
```

- [ ] **Step 3: Write the failing test `packages/contracts/src/index.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  MissionSchema, SignalSchema, AuditEntrySchema, TraceEventSchema, SignedBriefSchema,
} from "./index";

describe("contracts", () => {
  it("accepts a valid Mission and defaults scope", () => {
    const m = MissionSchema.parse({
      id: "m1", query: "Is issuer X compromised?", ticker: "LYV",
      allowed_sources: ["BreachForums"], data_classes: ["breach"], max_spend_usd: 5,
    });
    expect(m.scope).toBe("osint_readonly");
  });

  it("rejects a Mission missing required fields", () => {
    expect(() => MissionSchema.parse({ id: "m1" })).toThrow();
  });

  it("validates a Signal with fused confidence and sources", () => {
    const s = SignalSchema.parse({
      entity: "Live Nation", ticker: "LYV", event_type: "credential_dump",
      sources: [{ name: "BreachForums", type: "tor_forum", reliability: 0.7, observed_at: "2024-05-27" }],
      confidence: 0.88, confidence_method: "noisy_or",
      observed_at: "2024-05-27", disclosed_at: "2024-05-31", lead_time_days: 4,
      summary: "…",
    });
    expect(s.confidence).toBeCloseTo(0.88);
    expect(s.sources).toHaveLength(1);
  });

  it("rejects confidence outside 0..1", () => {
    expect(() => SignalSchema.parse({
      entity: "x", event_type: "y", sources: [], confidence: 1.5,
      confidence_method: "noisy_or", observed_at: "t", summary: "s",
    })).toThrow();
  });

  it("validates an AuditEntry, TraceEvent and SignedBrief", () => {
    expect(() => AuditEntrySchema.parse({
      seq: 0, ts: "t", actor: "Judge", action: "sign", hash: "h", prev_hash: "p",
    })).not.toThrow();
    expect(() => TraceEventSchema.parse({
      mission_id: "m1", ts: "t", layer: "execution", agent: "TorScout", level: "action", msg: "fetch",
    })).not.toThrow();
    expect(() => TraceEventSchema.parse({
      mission_id: "m1", ts: "t", layer: "BOGUS", agent: "x", level: "info", msg: "y",
    })).toThrow();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @altai/contracts test`
Expected: FAIL — cannot resolve `./index` / exports not defined.

- [ ] **Step 5: Implement `packages/contracts/src/index.ts`**

```ts
import { z } from "zod";

export const SourceContributionSchema = z.object({
  name: z.string(),
  type: z.enum(["tor_forum", "breach_api", "paste", "press", "filing"]),
  url: z.string().optional(),
  reliability: z.number().min(0).max(1),
  observed_at: z.string(),
});
export type SourceContribution = z.infer<typeof SourceContributionSchema>;

export const AlphaCardSchema = z.object({
  strategy: z.string(),
  entry_date: z.string(),
  exit_date: z.string(),
  entry_price: z.number().optional(),
  exit_price: z.number().optional(),
  return_pct: z.number().optional(),
  max_drawdown_pct: z.number().optional(),
  note: z.string().optional(),
});
export type AlphaCard = z.infer<typeof AlphaCardSchema>;

export const MissionSchema = z.object({
  id: z.string(),
  query: z.string(),
  target_entity: z.string().optional(),
  ticker: z.string().optional(),
  allowed_sources: z.array(z.string()),
  scope: z.literal("osint_readonly").default("osint_readonly"),
  data_classes: z.array(z.string()),
  max_spend_usd: z.number(),
});
export type Mission = z.infer<typeof MissionSchema>;

export const SignalSchema = z.object({
  entity: z.string(),
  ticker: z.string().optional(),
  event_type: z.string(),
  sources: z.array(SourceContributionSchema),
  confidence: z.number().min(0).max(1),
  confidence_method: z.literal("noisy_or"),
  observed_at: z.string(),
  disclosed_at: z.string().optional(),
  lead_time_days: z.number().optional(),
  alpha: AlphaCardSchema.optional(),
  summary: z.string(),
});
export type Signal = z.infer<typeof SignalSchema>;

export const AuditEntrySchema = z.object({
  seq: z.number(),
  ts: z.string(),
  actor: z.string(),
  action: z.string(),
  source: z.string().optional(),
  target: z.string().optional(),
  hash: z.string(),
  prev_hash: z.string(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const SignedBriefSchema = z.object({
  signal: SignalSchema,
  audit_root: z.string(),
  signature: z.string(),
  public_key: z.string(),
});
export type SignedBrief = z.infer<typeof SignedBriefSchema>;

export const TraceEventSchema = z.object({
  mission_id: z.string(),
  ts: z.string(),
  layer: z.enum(["dispatch", "policy", "identity", "execution", "membrane", "audit"]),
  agent: z.string(),
  level: z.enum(["info", "action", "warn", "block", "success"]),
  msg: z.string(),
  meta: z.record(z.unknown()).optional(),
});
export type TraceEvent = z.infer<typeof TraceEventSchema>;
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @altai/contracts test`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/contracts pnpm-lock.yaml
git commit -m "feat(contracts): shared Zod schemas (Mission, Signal, AuditEntry, TraceEvent, SignedBrief)"
```

---

## Task 3: `packages/fixtures` — hero case data + loader (TDD)

**Files:**
- Create: `packages/fixtures/package.json`, `packages/fixtures/tsconfig.json`
- Create: `packages/fixtures/hero_case.json`
- Create: `packages/fixtures/scripts/pull-prices.ts`
- Create: `packages/fixtures/src/index.ts`
- Test: `packages/fixtures/src/index.test.ts`

- [ ] **Step 1: Create `packages/fixtures/package.json`**

```json
{
  "name": "@altai/fixtures",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./hero_case.json": "./hero_case.json"
  },
  "scripts": {
    "pull-prices": "tsx scripts/pull-prices.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": { "@altai/contracts": "workspace:*" },
  "devDependencies": {
    "typescript": "^5.7.0", "vitest": "^2.1.0",
    "tsx": "^4.19.0", "yahoo-finance2": "^2.13.0"
  }
}
```

- [ ] **Step 2: Create `packages/fixtures/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 3: Create `packages/fixtures/hero_case.json` (dates locked; price_series filled by script)**

```json
{
  "primary": {
    "entity": "Live Nation Entertainment (Ticketmaster)",
    "ticker": "LYV",
    "exchange": "NYSE",
    "event_type": "credential_dump",
    "observed_at": "2024-05-27",
    "disclosed_at": "2024-05-31",
    "lead_time_days": 4,
    "sources": [
      { "name": "BreachForums", "type": "tor_forum", "reliability": 0.7, "observed_at": "2024-05-27", "url": "https://example.invalid/breachforums-listing" },
      { "name": "HIBP", "type": "breach_api", "reliability": 0.6, "observed_at": "2024-05-28" }
    ],
    "evidence_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=LYV&type=8-K",
    "summary": "ShinyHunters listed 560M Ticketmaster customer records ($500k) on the dark web 4 days before Live Nation's SEC 8-K confirmation.",
    "alpha": {
      "strategy": "short at observed_at close, cover at disclosed_at close",
      "entry_date": "2024-05-27",
      "exit_date": "2024-05-31",
      "note": "edge is informational lead-time; price impact muted (no material impact + DOJ antitrust noise)"
    },
    "price_series": []
  },
  "secondary": {
    "entity": "Medibank",
    "ticker": "MPL.AX",
    "exchange": "ASX",
    "event_type": "ransomware_breach",
    "observed_at": "2022-10-12",
    "disclosed_at": "2022-10-13",
    "magnitude": { "single_session_drop_pct": -15, "saga_drop_pct": -20, "from": 3.60, "to": 2.75 },
    "purpose": "magnitude beat",
    "price_series": []
  }
}
```

- [ ] **Step 4: Create `packages/fixtures/scripts/pull-prices.ts` (one-shot generator)**

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import yahooFinance from "yahoo-finance2";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "hero_case.json");

async function series(ticker: string, from: string, to: string) {
  const r = await yahooFinance.chart(ticker, { period1: from, period2: to, interval: "1d" });
  return r.quotes
    .filter((q) => q.close != null)
    .map((q) => ({ date: new Date(q.date).toISOString().slice(0, 10), close: Number(q.close) }));
}

const data = JSON.parse(readFileSync(file, "utf8"));
data.primary.price_series = await series("LYV", "2024-05-15", "2024-06-07");
data.secondary.price_series = await series("MPL.AX", "2022-10-05", "2022-11-15");
writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(
  `LYV points: ${data.primary.price_series.length}, MPL.AX points: ${data.secondary.price_series.length}`
);
```

- [ ] **Step 5: Generate the real price series (requires network)**

Run: `pnpm --filter @altai/fixtures pull-prices`
Expected: prints non-zero point counts for both tickers; `hero_case.json` now has populated `price_series` arrays.
If the network is unavailable in your environment, hand-enter ~3 anchor points per series so the array is non-empty (date+close around the event dates) and proceed; replace with real data before the demo.

- [ ] **Step 6: Write the failing test `packages/fixtures/src/index.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { SignalSchema } from "@altai/contracts";
import { heroSignal, heroCase } from "./index";

describe("fixtures", () => {
  it("primary case has the locked Ticketmaster dates and a non-empty price series", () => {
    expect(heroCase.primary.ticker).toBe("LYV");
    expect(heroCase.primary.observed_at).toBe("2024-05-27");
    expect(heroCase.primary.disclosed_at).toBe("2024-05-31");
    expect(heroCase.primary.price_series.length).toBeGreaterThan(0);
  });

  it("heroSignal() produces a contract-valid Signal", () => {
    const s = heroSignal();
    expect(() => SignalSchema.parse(s)).not.toThrow();
    expect(s.lead_time_days).toBe(4);
    expect(s.confidence).toBeGreaterThan(0);
    expect(s.confidence).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `pnpm --filter @altai/fixtures test`
Expected: FAIL — `./index` exports not defined.

- [ ] **Step 8: Implement `packages/fixtures/src/index.ts`**

```ts
import { createRequire } from "node:module";
import type { Signal, SourceContribution } from "@altai/contracts";

const require = createRequire(import.meta.url);
export const heroCase = require("../hero_case.json") as HeroCase;

interface PricePoint { date: string; close: number; }
interface HeroPrimary {
  entity: string; ticker: string; exchange: string; event_type: string;
  observed_at: string; disclosed_at: string; lead_time_days: number;
  sources: SourceContribution[]; evidence_url: string; summary: string;
  alpha: { strategy: string; entry_date: string; exit_date: string; note?: string };
  price_series: PricePoint[];
}
interface HeroCase { primary: HeroPrimary; secondary: { ticker: string; price_series: PricePoint[] } & Record<string, unknown>; }

/** Noisy-OR fusion over independent sources (mirrors spec §7.4). */
export function fuseConfidence(sources: SourceContribution[]): number {
  const p = sources.reduce((acc, s) => acc * (1 - s.reliability), 1);
  return Number((1 - p).toFixed(4));
}

export function heroSignal(): Signal {
  const c = heroCase.primary;
  return {
    entity: c.entity,
    ticker: c.ticker,
    event_type: c.event_type,
    sources: c.sources,
    confidence: fuseConfidence(c.sources),
    confidence_method: "noisy_or",
    observed_at: c.observed_at,
    disclosed_at: c.disclosed_at,
    lead_time_days: c.lead_time_days,
    alpha: { strategy: c.alpha.strategy, entry_date: c.alpha.entry_date, exit_date: c.alpha.exit_date, note: c.alpha.note },
    summary: c.summary,
  };
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `pnpm --filter @altai/fixtures test`
Expected: PASS (2 tests).

- [ ] **Step 10: Commit**

```bash
git add packages/fixtures pnpm-lock.yaml
git commit -m "feat(fixtures): hero_case (Ticketmaster + Medibank) + price puller + noisy-OR heroSignal()"
```

---

## Task 4: `apps/external` — Next app skeleton + mission store + fake fleet

**Files:**
- Create: `apps/external/package.json`, `apps/external/tsconfig.json`, `apps/external/next.config.mjs`
- Create: `apps/external/app/layout.tsx`, `apps/external/app/globals.css`, `apps/external/app/api/health/route.ts`
- Create: `apps/external/lib/missionStore.ts`, `apps/external/lib/fakeFleet.ts`

- [ ] **Step 1: Create `apps/external/package.json`**

```json
{
  "name": "@altai/external",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@altai/contracts": "workspace:*",
    "@altai/fixtures": "workspace:*",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `apps/external/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
```

- [ ] **Step 3: Create `apps/external/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ["@altai/contracts", "@altai/fixtures"],
};
```

- [ ] **Step 4: Create `apps/external/app/layout.tsx`**

```tsx
import "./globals.css";
export const metadata = { title: "Altai — Ops Center" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Create `apps/external/app/globals.css`**

```css
:root { color-scheme: dark; }
body { margin: 0; background: #0a0e14; color: #d7dce5; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
* { box-sizing: border-box; }
```

- [ ] **Step 6: Create `apps/external/app/api/health/route.ts`**

```ts
export function GET() {
  return Response.json({ ok: true, service: "external" });
}
```

- [ ] **Step 7: Create `apps/external/lib/missionStore.ts`**

```ts
import { EventEmitter } from "node:events";
import type { Signal, TraceEvent } from "@altai/contracts";

interface MissionState { id: string; events: TraceEvent[]; signal?: Signal; done: boolean; }

const missions = new Map<string, MissionState>();
export const bus = new EventEmitter();
bus.setMaxListeners(100);

export function createMission(id: string): MissionState {
  const m: MissionState = { id, events: [], done: false };
  missions.set(id, m);
  return m;
}
export function emitTrace(ev: TraceEvent): void {
  missions.get(ev.mission_id)?.events.push(ev);
  bus.emit("trace", ev);
}
export function completeMission(id: string, signal: Signal): void {
  const m = missions.get(id);
  if (m) { m.signal = signal; m.done = true; }
  bus.emit("signal", { id, signal });
}
export function getSignal(id: string): Signal | undefined {
  return missions.get(id)?.signal;
}
```

- [ ] **Step 8: Create `apps/external/lib/fakeFleet.ts`**

```ts
import type { Mission, TraceEvent } from "@altai/contracts";
import { heroSignal } from "@altai/fixtures";
import { completeMission, emitTrace } from "./missionStore";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Step = Pick<TraceEvent, "layer" | "agent" | "level" | "msg"> & { meta?: Record<string, unknown> };

const SCRIPT: Step[] = [
  { layer: "dispatch", agent: "Gateway", level: "info", msg: "Mission received via sealed egress" },
  { layer: "policy", agent: "PolicyAgent", level: "success", msg: "Mission within tenant policy (osint_readonly)" },
  { layer: "identity", agent: "IdentityIsolation", level: "info", msg: "Client identity stripped; acting under Altai egress" },
  { layer: "execution", agent: "Planner", level: "action", msg: "Decomposing mission → Web/Tor/Breach scouts" },
  { layer: "execution", agent: "WebScout", level: "action", msg: "Fetching open + blocked sources" },
  { layer: "execution", agent: "TorScout", level: "action", msg: "Tor circuit established; fetching .onion", meta: { exit_ip: "185.220.101.4", country: "DE", circuit: ["FR-guard", "DE-relay", "NL-exit"] } },
  { layer: "execution", agent: "BreachScout", level: "action", msg: "Cross-checking breach APIs (HIBP/IntelX)" },
  { layer: "execution", agent: "Planner", level: "success", msg: "Candidate signal synthesized from 2 independent sources" },
  { layer: "membrane", agent: "Sanitizer", level: "success", msg: "PII/secret/malware stripped" },
  { layer: "membrane", agent: "InjectionHunter", level: "success", msg: "No prompt-injection detected in payload" },
  { layer: "membrane", agent: "Judge", level: "success", msg: "Consensus PASS — signing brief" },
  { layer: "audit", agent: "AuditAgent", level: "success", msg: "Brief signed; audit ledger sealed" },
];

export async function runFakeFleet(mission: Mission): Promise<void> {
  for (const step of SCRIPT) {
    emitTrace({ mission_id: mission.id, ts: new Date().toISOString(), ...step });
    await sleep(600);
  }
  completeMission(mission.id, heroSignal());
}
```

- [ ] **Step 9: Verify the app boots and health responds**

Run (in one terminal): `pnpm --filter @altai/external dev`
Run (in another): `curl -s http://localhost:3000/api/health`
Expected: `{"ok":true,"service":"external"}`. Stop the dev server after verifying.

- [ ] **Step 10: Commit**

```bash
git add apps/external pnpm-lock.yaml
git commit -m "feat(external): Next skeleton + mission store + scripted fake fleet"
```

---

## Task 5: `apps/external` — gateway routes (dispatch, SSE firehose, signal)

**Files:**
- Create: `apps/external/app/api/missions/route.ts`
- Create: `apps/external/app/api/events/route.ts`
- Create: `apps/external/app/api/missions/[id]/signal/route.ts`

- [ ] **Step 1: Create `apps/external/app/api/missions/route.ts` (POST dispatch)**

```ts
import { randomUUID } from "node:crypto";
import { MissionSchema } from "@altai/contracts";
import { createMission } from "@/lib/missionStore";
import { runFakeFleet } from "@/lib/fakeFleet";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = MissionSchema.safeParse({ ...body, id: body?.id ?? randomUUID() });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const mission = parsed.data;
  createMission(mission.id);
  void runFakeFleet(mission); // fire-and-forget; trace streams over /api/events
  return Response.json({ id: mission.id });
}
```

- [ ] **Step 2: Create `apps/external/app/api/events/route.ts` (SSE firehose)**

```ts
import { bus } from "@/lib/missionStore";

export const dynamic = "force-dynamic";

export function GET() {
  const encoder = new TextEncoder();
  let onTrace: (ev: unknown) => void;
  let onSignal: (s: unknown) => void;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send("ready", { ok: true });
      onTrace = (ev) => send("trace", ev);
      onSignal = (s) => send("signal", s);
      bus.on("trace", onTrace);
      bus.on("signal", onSignal);
    },
    cancel() {
      bus.off("trace", onTrace);
      bus.off("signal", onSignal);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 3: Create `apps/external/app/api/missions/[id]/signal/route.ts`**

```ts
import { getSignal } from "@/lib/missionStore";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const signal = getSignal(id);
  if (!signal) return new Response(null, { status: 202 }); // not ready yet
  return Response.json(signal);
}
```

- [ ] **Step 4: Verify the full mock flow over HTTP**

Run (terminal 1): `pnpm --filter @altai/external dev`
Run (terminal 2): `curl -N -s http://localhost:3000/api/events &` then
`MID=$(curl -s -X POST http://localhost:3000/api/missions -H 'content-type: application/json' -d '{"query":"Is LYV compromised?","ticker":"LYV","allowed_sources":["BreachForums"],"data_classes":["breach"],"max_spend_usd":5}' | sed -E 's/.*"id":"([^"]+)".*/\1/')`
Expected (terminal 2): the `event: trace` lines stream in over ~7s, then an `event: signal`.
Then: `sleep 9 && curl -s "http://localhost:3000/api/missions/$MID/signal"`
Expected: the hero Signal JSON (entity "Live Nation…", lead_time_days 4). Stop servers after.

- [ ] **Step 5: Commit**

```bash
git add apps/external
git commit -m "feat(external): gateway routes — dispatch, SSE firehose, signal"
```

---

## Task 6: `apps/external` — ops-center UI

**Files:**
- Create: `apps/external/app/page.tsx`

- [ ] **Step 1: Create `apps/external/app/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import type { Signal, TraceEvent } from "@altai/contracts";

const LAYER_COLOR: Record<string, string> = {
  dispatch: "#7aa2f7", policy: "#e0af68", identity: "#9ece6a",
  execution: "#7dcfff", membrane: "#bb9af7", audit: "#f7768e",
};

export default function OpsCenter() {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [signal, setSignal] = useState<Signal | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("trace", (e) => setEvents((p) => [...p, JSON.parse((e as MessageEvent).data)]));
    es.addEventListener("signal", (e) => setSignal(JSON.parse((e as MessageEvent).data).signal));
    return () => es.close();
  }, []);

  return (
    <main style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, padding: 24, minHeight: "100vh" }}>
      <section>
        <h1 style={{ fontSize: 18, letterSpacing: 2 }}>🔭 ALTAI — OPS CENTER</h1>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
          {events.map((ev, i) => (
            <div key={i} style={{ fontSize: 13 }}>
              <span style={{ color: LAYER_COLOR[ev.layer] ?? "#888", textTransform: "uppercase" }}>
                [{ev.layer}]
              </span>{" "}
              <b>{ev.agent}</b> — {ev.msg}
              {ev.meta?.exit_ip ? (
                <span style={{ color: "#9ece6a" }}> · exit {String(ev.meta.exit_ip)} ({String(ev.meta.country)})</span>
              ) : null}
            </div>
          ))}
          {events.length === 0 && <em style={{ color: "#566" }}>Waiting for a dispatched mission…</em>}
        </div>
      </section>

      <aside>
        <h2 style={{ fontSize: 14, color: "#888" }}>SIGNAL</h2>
        {signal ? (
          <div style={{ border: "1px solid #233", borderRadius: 8, padding: 16, background: "#0d131c" }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{signal.entity} {signal.ticker ? `(${signal.ticker})` : ""}</div>
            <div style={{ marginTop: 8 }}>event: <b>{signal.event_type}</b></div>
            <div>confidence: <b>{(signal.confidence * 100).toFixed(0)}%</b> <span style={{ color: "#566" }}>({signal.confidence_method})</span></div>
            <div>observed: {signal.observed_at} · disclosed: {signal.disclosed_at}</div>
            {signal.lead_time_days != null && (
              <div style={{ marginTop: 8, fontSize: 22, color: "#e0af68" }}>{signal.lead_time_days} days early</div>
            )}
            <p style={{ color: "#9aa", fontSize: 12 }}>{signal.summary}</p>
            <div style={{ marginTop: 8, fontSize: 11, color: "#566" }}>
              sources: {signal.sources.map((s) => `${s.name}(${s.reliability})`).join(" + ")}
            </div>
          </div>
        ) : (
          <em style={{ color: "#566" }}>No signal yet.</em>
        )}
      </aside>
    </main>
  );
}
```

- [ ] **Step 2: Verify the ops-center renders the trace + signal**

Run: `pnpm --filter @altai/external dev`, open `http://localhost:3000`, then in another terminal POST a mission (command from Task 5 Step 4).
Expected: the left pane fills with color-coded trace lines (Tor line shows the exit IP), and the right Signal card appears showing "Live Nation… · 4 days early · 88% confidence". Stop the server after.

- [ ] **Step 3: Commit**

```bash
git add apps/external/app/page.tsx
git commit -m "feat(external): ops-center UI — live trace + signal card"
```

---

## Task 7: `apps/internal` — sealed chat with dispatch-only egress

**Files:**
- Create: `apps/internal/package.json`, `apps/internal/tsconfig.json`, `apps/internal/next.config.mjs`
- Create: `apps/internal/app/layout.tsx`, `apps/internal/app/globals.css`, `apps/internal/app/page.tsx`
- Create: `apps/internal/app/api/dispatch/route.ts`, `apps/internal/app/api/signal/[id]/route.ts`

- [ ] **Step 1: Create `apps/internal/package.json`**

```json
{
  "name": "@altai/internal",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3100",
    "build": "next build",
    "start": "next start -p 3100",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@altai/contracts": "workspace:*",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `apps/internal/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
```

- [ ] **Step 3: Create `apps/internal/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ["@altai/contracts"],
};
```

- [ ] **Step 4: Create `apps/internal/app/layout.tsx`**

```tsx
import "./globals.css";
export const metadata = { title: "Sealed Agent — Acme Bank" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Create `apps/internal/app/globals.css`**

```css
:root { color-scheme: light; }
body { margin: 0; background: #f6f7f9; color: #1a1f2b; font-family: ui-sans-serif, system-ui, sans-serif; }
* { box-sizing: border-box; }
```

- [ ] **Step 6: Create `apps/internal/app/api/dispatch/route.ts` (server-side egress to the gateway)**

```ts
import { randomUUID } from "node:crypto";
import { MissionSchema } from "@altai/contracts";

const GATEWAY = process.env.EXTERNAL_URL ?? "http://localhost:3000";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const mission = MissionSchema.parse({
    id: randomUUID(),
    query: String(body?.query ?? ""),
    ticker: body?.ticker,
    target_entity: body?.target_entity,
    allowed_sources: ["BreachForums", "HIBP", "Ahmia"],
    data_classes: ["breach", "press"],
    max_spend_usd: 5,
  });
  const res = await fetch(`${GATEWAY}/api/missions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mission),
  });
  const json = await res.json();
  return Response.json(json, { status: res.status });
}
```

- [ ] **Step 7: Create `apps/internal/app/api/signal/[id]/route.ts`**

```ts
const GATEWAY = process.env.EXTERNAL_URL ?? "http://localhost:3000";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await fetch(`${GATEWAY}/api/missions/${id}/signal`);
  if (res.status === 202) return new Response(null, { status: 202 });
  const json = await res.json();
  return Response.json(json, { status: res.status });
}
```

- [ ] **Step 8: Create `apps/internal/app/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import type { Signal } from "@altai/contracts";

export default function SealedChat() {
  const [q, setQ] = useState("Is issuer Live Nation (LYV) compromised?");
  const [status, setStatus] = useState<string>("");
  const [signal, setSignal] = useState<Signal | null>(null);

  async function ask() {
    setSignal(null);
    setStatus("Sealed agent: no internet — dispatching mission to Altai…");
    const r = await fetch("/api/dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: q, ticker: "LYV", target_entity: "Live Nation" }),
    });
    const { id } = await r.json();
    setStatus("Mission dispatched. Awaiting sanitized, signed brief…");
    for (let i = 0; i < 40; i++) {
      await new Promise((res) => setTimeout(res, 800));
      const sr = await fetch(`/api/signal/${id}`);
      if (sr.status === 200) { setSignal(await sr.json()); setStatus("Brief received."); return; }
    }
    setStatus("Timed out waiting for brief.");
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 24 }}>
      <h1 style={{ fontSize: 18 }}>🏦 Acme Bank — Sealed Internal Agent</h1>
      <p style={{ color: "#667", fontSize: 13 }}>This environment has no internet. Its only egress is Altai.</p>
      <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccd" }} />
      <button onClick={ask} style={{ marginTop: 8, padding: "8px 16px", borderRadius: 8, border: 0, background: "#1a1f2b", color: "white", cursor: "pointer" }}>
        Ask sealed agent
      </button>
      {status && <p style={{ marginTop: 12, color: "#445" }}>{status}</p>}
      {signal && (
        <div style={{ marginTop: 16, border: "1px solid #dde", borderRadius: 8, padding: 16, background: "white" }}>
          <b>{signal.entity} ({signal.ticker})</b> — {signal.event_type}
          <div>confidence {(signal.confidence * 100).toFixed(0)}% · {signal.lead_time_days} days before public disclosure</div>
          <p style={{ color: "#556", fontSize: 13 }}>{signal.summary}</p>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 9: Verify internal → external end-to-end (both apps local)**

Run (terminal 1): `pnpm --filter @altai/external dev`
Run (terminal 2): `pnpm --filter @altai/internal dev`
Open `http://localhost:3100`, click "Ask sealed agent". Open `http://localhost:3000` to watch the trace ignite.
Expected: internal shows "dispatching…" → after ~8s renders the brief ("Live Nation (LYV) … 4 days before public disclosure"); ops-center shows the full trace + signal card. Stop servers after.

- [ ] **Step 10: Commit**

```bash
git add apps/internal pnpm-lock.yaml
git commit -m "feat(internal): sealed chat with dispatch-only egress to the gateway"
```

---

## Task 8: Docker Compose — the real cage

**Files:**
- Create: `apps/external/Dockerfile`, `apps/internal/Dockerfile`, `apps/external/.dockerignore`, `apps/internal/.dockerignore`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create a shared `.dockerignore` in each app dir (`apps/external/.dockerignore` and `apps/internal/.dockerignore`)**

```
node_modules
.next
.turbo
```

- [ ] **Step 2: Create `apps/external/Dockerfile` (dev-mode, monorepo-aware)**

```dockerfile
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/external ./apps/external
RUN pnpm install --frozen-lockfile
WORKDIR /repo/apps/external
EXPOSE 3000
CMD ["pnpm", "dev"]
```

- [ ] **Step 3: Create `apps/internal/Dockerfile`**

```dockerfile
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/internal ./apps/internal
RUN pnpm install --frozen-lockfile
WORKDIR /repo/apps/internal
EXPOSE 3100
CMD ["pnpm", "dev"]
```

- [ ] **Step 4: Create `docker-compose.yml`**

```yaml
networks:
  internal: { internal: true }   # NO route to the internet
  external: {}                   # normal bridge, has internet

services:
  external-app:
    build: { context: ., dockerfile: apps/external/Dockerfile }
    networks: [internal, external]   # the single bridge
    ports: ["3000:3000"]

  internal-app:
    build: { context: ., dockerfile: apps/internal/Dockerfile }
    networks: [internal]             # sealed: can only reach external-app
    environment:
      EXTERNAL_URL: "http://external-app:3000"
    ports: ["3100:3100"]
    depends_on: [external-app]
```

- [ ] **Step 5: Build and bring the stack up**

Run: `docker compose up --build -d`
Then wait for boot: `until curl -sf http://localhost:3000/api/health; do sleep 2; done; echo " external up"`
Expected: prints the health JSON then "external up".

- [ ] **Step 6: Prove the cage is real (the money command)**

Run: `docker compose exec internal-app curl -m 5 -s -o /dev/null -w "%{http_code}\n" https://google.com || echo "BLOCKED (timeout) — cage holds"`
Expected: `BLOCKED (timeout) — cage holds` (no internet from the sealed container).
Run: `docker compose exec internal-app curl -m 5 -s -o /dev/null -w "%{http_code}\n" http://external-app:3000/api/health`
Expected: `200` (the only reachable host is the gateway).

> If port-publishing for `internal-app` fails because of `internal:true` (see spec §5 open question), remove `internal-app`'s `ports:` and access the internal UI via an `external-app` proxy route. The two `docker compose exec` cage proofs above do **not** depend on published ports and remain the demo's cage evidence.

- [ ] **Step 7: End-to-end through Docker**

Open `http://localhost:3100` (internal) and `http://localhost:3000` (ops-center). Click "Ask sealed agent".
Expected: brief renders on internal; trace + signal render on ops-center — all through the bridge, with the sealed container genuinely offline.
Then: `docker compose down`.

- [ ] **Step 8: Commit**

```bash
git add apps/external/Dockerfile apps/internal/Dockerfile apps/external/.dockerignore apps/internal/.dockerignore docker-compose.yml
git commit -m "feat(docker): 2-network compose — real cage (internal:true) + gateway bridge"
```

---

## Self-review (completed by plan author)

**Spec coverage (Phase 0 scope only):** monorepo ✓ (T1) · contract Zod schemas ✓ (T2) · hero_case Ticketmaster+Medibank + price puller + noisy-OR fusion ✓ (T3) · external gateway routes (dispatch/SSE/signal) ✓ (T5) · fake fleet streaming trace + hero signal ✓ (T4) · ops-center trace+signal UI ✓ (T6) · sealed internal chat with dispatch-only egress ✓ (T7) · 2-network Docker cage + cage proof ✓ (T8). Phase-1+ items (real OpenAI swarm, live Tor, membrane agents, Ed25519+Merkle, tamper-demo, AlphaCard chart) are intentionally **out of Phase 0** and will be planned next.

**Placeholder scan:** No TBD/TODO. The only `example.invalid` URL is a deliberate fixture placeholder for the BreachForums listing (real capture added by Malena pre-demo); the SEC evidence_url is real. Network-dependent steps (T3 S5, T5 S4) have explicit fallbacks.

**Type consistency:** `Mission`, `Signal`, `TraceEvent`, `SourceContribution`, `AlphaCard`, `AuditEntry`, `SignedBrief` defined in T2 are used verbatim in T3–T7. `emitTrace`/`completeMission`/`getSignal`/`createMission`/`bus` defined in T4 are used in T5. `heroSignal`/`fuseConfidence`/`heroCase` defined in T3 are used in T4. SSE event names (`trace`, `signal`) match between T5 producer and T6 consumer. `EXTERNAL_URL` env used consistently in T7 and T8.

---

## Notes for Phase 1+ (not in this plan)
- **Phase 1:** real AI SDK swarm (Planner + Scouts) on **OpenAI** (`@ai-sdk/openai`), gateway on-prem LLM proxy for the sealed agent's OpenAI brain, live Tor `tor` service + `tor_fetch`, breach/OSINT tools.
- **Phase 2:** core membrane (Sanitizer + Injection Hunter + Judge), `packages/crypto` (Ed25519 + Merkle), live injection catch, tamper-demo.
- **Phase 3:** AlphaCard + confidence-fusion UI, stock overlay chart, optional Compliance Auditor, rehearsal + backup video.
