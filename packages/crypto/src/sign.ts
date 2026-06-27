import { generateKeyPairSync, sign as nodeSign, verify as nodeVerify, createPublicKey } from "node:crypto";

export interface KeyPair {
  privateKeyPem: string;
  publicKeyPem: string;
}

let cached: KeyPair | null = null;

/** Ed25519 keypair, generated once per process. The public key travels in the
 * SignedBrief, so the sealed side verifies without any shared secret. */
export function keyPair(): KeyPair {
  if (cached) return cached;
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  cached = {
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
  return cached;
}

export function sign(msg: string, privateKeyPem: string): string {
  return nodeSign(null, Buffer.from(msg), privateKeyPem).toString("base64");
}

export function verifySig(msg: string, signatureB64: string, publicKeyPem: string): boolean {
  try {
    return nodeVerify(null, Buffer.from(msg), createPublicKey(publicKeyPem), Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}
