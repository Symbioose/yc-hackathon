# Periscope Phase 2 — Membrane + Crypto Attestation + Tamper-Demo — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. (This phase was executed inline; commits are the record.) Steps use `- [ ]`.

**Goal:** Make the inbound boundary *prove* itself. A real multi-agent **Membrane** (Sanitizer + Injection Hunter + Judge) gates everything crossing back; the result is **cryptographically attested** (Ed25519 signature over the Signal + a Merkle-rooted audit ledger); the sealed side **independently verifies** the signature; and a live **tamper-demo** shows editing one audit entry breaking the Merkle root → verification flips RED.

**Architecture:** New `packages/crypto` (canonical JSON · Merkle ledger · Ed25519 sign/verify · SignedBrief). Membrane added to `@periscope/agents` (`sanitize`, `huntInjection`, deterministic so the injection catch fires every demo; LLM optional). The external mission flow, after the swarm, runs the membrane → builds an `AuditEntry[]` ledger from the emitted trace → computes the Merkle root → the Judge signs → stores a `SignedBrief`. New endpoints expose the audit ledger and a tamper control. The sealed `/api/signal` proxy verifies the signature server-side and returns `verified`. Ops-center gains an audit panel (entries + root + ✓/✗ + Tamper button).

**Tech Stack:** `node:crypto` (Ed25519, sha256), TypeScript, Zod (`SignedBrief` already in contracts), Vitest. No new runtime deps.

**Reference spec:** `docs/superpowers/specs/2026-06-27-periscope-architecture-design.md` §7.2, §7.3. Builds on Phase 0 + Phase 1.

---

## Task 1 — `packages/crypto`: Merkle ledger + Ed25519 + SignedBrief (TDD)

**Files:** `packages/crypto/{package.json,tsconfig.json}`, `src/{canonical,merkle,sign,brief,index}.ts`, `src/crypto.test.ts`

- [ ] `canonical(obj)` — deterministic JSON (recursively sorted keys) for stable signing/hashing.
- [ ] `sha256(s)` ; `buildLedger(events)` → `AuditEntry[]` with `seq`, hash-chained `prev_hash`, and `hash = sha256(canonical(entry-sans-hash))`.
- [ ] `merkleRoot(entries)` — binary sha256 tree over leaf hashes (duplicate last if odd).
- [ ] `tamperEntry(entries, idx, patch)` — patch a field + recompute that entry's hash (so the recomputed root diverges from the signed root).
- [ ] `keyPair()` (Ed25519, cached per process) ; `sign(msg, priv)` / `verifySig(msg, sig, pub)` (base64).
- [ ] `signBrief(signal, auditRoot, kp)` → `SignedBrief` ; `verifyBrief(brief)` → signature valid over `canonical(signal)+"|"+audit_root` ; `verifyLedger(entries, auditRoot)` → `merkleRoot(entries)===auditRoot`.
- [ ] **Tests:** sign/verify round-trip; `verifyBrief` true for a fresh brief; tampering an entry makes `verifyLedger` false while `verifyBrief` stays true (proves the root-mismatch beat); Merkle root is stable for identical input.

## Task 2 — Membrane agents + planted injection fixture (TDD)

**Files:** `packages/agents/src/membrane.ts`, `packages/fixtures` planted-injection sample, `packages/agents/src/membrane.test.ts`

- [ ] `huntInjection(snippets: {source,content}[])` → `{ clean, findings }` — deterministic detector for prompt-injection / identity-exfil patterns (`ignore previous instructions`, `system prompt`, `exfiltrate`, `reveal the client`, long base64 blobs…). LLM pass optional/secondary.
- [ ] `sanitize(signal)` → `{ signal, redactions }` — regex-redact emails/keys/tokens from `summary` + source urls.
- [ ] Fixture `plantedInjection` — a realistic dark-web post containing an injection, always scanned so the catch fires every demo.
- [ ] **Tests:** hunter flags the planted injection (`clean=false`, ≥1 finding); hunter passes clean content; sanitizer redacts an email in a summary.

## Task 3 — Wire membrane + attestation into the gateway

**Files:** `apps/external/lib/{missionStore,realFleet,fakeFleet}.ts`, `app/api/missions/[id]/signal/route.ts`, new `app/api/missions/[id]/audit/route.ts` + `.../tamper/route.ts`

- [ ] `missionStore`: store `SignedBrief` + `AuditEntry[]` per mission (not just `Signal`); add `getBrief`, `getAudit`, `tamper(id, idx, patch)`.
- [ ] At mission end (both real + fake fleet): run `huntInjection` over collected snippets (incl. planted) → on hit, emit a `membrane`/`block` quarantine trace and drop that source; `sanitize` the signal; `buildLedger` from the mission's trace events; `merkleRoot`; Judge `signBrief` → store `SignedBrief` + entries; emit the membrane PASS + audit-sealed traces (replacing Phase-1's scripted membrane lines).
- [ ] `GET /signal` → returns the `SignedBrief`.
- [ ] `GET /audit` → `{ entries, audit_root, signature, public_key, verified, ledger_ok }` (verified computed live).
- [ ] `POST /tamper` `{idx,patch}` → mutate an entry, recompute, return the now-`verified:false` state.

## Task 4 — UI: audit panel + tamper-demo + sealed verify badge

**Files:** `apps/external/app/page.tsx`, `apps/internal/app/page.tsx` + `app/api/signal/[id]/route.ts`

- [ ] Ops-center: audit panel — list `AuditEntry`s, the **Merkle root**, **Ed25519 ✓/✗**, and a **Tamper** button (POST `/tamper` → re-fetch `/audit` → flips RED). The injection quarantine line shows in the trace.
- [ ] Sealed app: `/api/signal` proxy calls `verifyBrief` server-side and returns `{ brief, verified }`; the chat shows "✓ signature valid — provably from Periscope, untampered".

---

## Self-review checklist
- [ ] `SignedBrief` contract (already defined) used end-to-end; `getSignal` consumers migrated to `getBrief`/`brief.signal`.
- [ ] Injection catch is deterministic (planted fixture) → fires every run regardless of keys/Tor.
- [ ] Tamper-demo: `verifyLedger` flips false on edit; signature stays valid (root-mismatch is the tell).
- [ ] Fake-fleet fallback still completes (membrane + signing run on both paths).
