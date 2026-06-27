import type { Signal, AuditEntry, SignedBrief } from "@altai/contracts";
import { canonical } from "./canonical";
import { merkleRoot } from "./merkle";
import { keyPair, sign, verifySig } from "./sign";

function briefMessage(signal: Signal, auditRoot: string): string {
  return canonical(signal) + "|" + auditRoot;
}

/** Judge signs the Signal + Merkle audit root with the process Ed25519 key. */
export function signBrief(signal: Signal, auditRoot: string): SignedBrief {
  const kp = keyPair();
  return {
    signal,
    audit_root: auditRoot,
    signature: sign(briefMessage(signal, auditRoot), kp.privateKeyPem),
    public_key: kp.publicKeyPem,
  };
}

/** The brief is authentic (signature valid over signal + signed audit root). */
export function verifyBrief(brief: SignedBrief): boolean {
  return verifySig(briefMessage(brief.signal, brief.audit_root), brief.signature, brief.public_key);
}

/** The audit ledger is untampered (recomputed root matches the signed root). */
export function verifyLedger(entries: AuditEntry[], auditRoot: string): boolean {
  return merkleRoot(entries) === auditRoot;
}
