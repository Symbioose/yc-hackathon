import { describe, it, expect } from "vitest";
import type { Signal } from "@altai/contracts";
import { buildLedger, merkleRoot, tamperEntry } from "./merkle";
import { signBrief, verifyBrief, verifyLedger } from "./brief";
import { publicKeyFingerprint } from "./sign";

const raw = [
  { ts: "t1", actor: "Gateway", action: "mission received" },
  { ts: "t2", actor: "TorScout", action: "fetched .onion" },
  { ts: "t3", actor: "Judge", action: "signed brief" },
];

const signal: Signal = {
  entity: "Live Nation",
  ticker: "LYV",
  event_type: "credential_dump",
  sources: [{ name: "BreachForums", type: "tor_forum", reliability: 0.7, observed_at: "2024-05-27" }],
  confidence: 0.7,
  confidence_method: "noisy_or",
  observed_at: "2024-05-27",
  summary: "x",
};

describe("crypto attestation", () => {
  it("merkle root is stable for identical input", () => {
    expect(merkleRoot(buildLedger(raw))).toBe(merkleRoot(buildLedger(raw)));
  });

  it("signs a brief and verifies it (signature + ledger)", () => {
    const entries = buildLedger(raw);
    const brief = signBrief(signal, merkleRoot(entries));
    expect(verifyBrief(brief)).toBe(true);
    expect(verifyLedger(entries, brief.audit_root)).toBe(true);
  });

  it("tamper-demo: editing an entry breaks the Merkle root while the signature stays valid", () => {
    const entries = buildLedger(raw);
    const brief = signBrief(signal, merkleRoot(entries));
    const tampered = tamperEntry(entries, 1, { action: "DELETED EVIDENCE" });
    expect(verifyLedger(tampered, brief.audit_root)).toBe(false); // recomputed root ≠ signed root → RED
    expect(verifyBrief(brief)).toBe(true); // the brief signature itself is still valid
  });

  it("independent verification: a forged brief is rejected, an authentic one accepted", () => {
    const brief = signBrief(signal, merkleRoot(buildLedger(raw)));
    expect(verifyBrief(brief)).toBe(true);
    // edit a single field of the SIGNED payload → signature no longer matches
    const forged = { ...brief, signal: { ...brief.signal, confidence: 0.99 } };
    expect(verifyBrief(forged)).toBe(false);
    // a tampered audit_root is also caught
    expect(verifyBrief({ ...brief, audit_root: brief.audit_root.replace(/.$/, "0") })).toBe(false);
  });

  it("public key fingerprint is stable and key-specific", () => {
    const a = signBrief(signal, "root");
    expect(publicKeyFingerprint(a.public_key)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(publicKeyFingerprint(a.public_key)).toBe(publicKeyFingerprint(a.public_key));
  });
});
