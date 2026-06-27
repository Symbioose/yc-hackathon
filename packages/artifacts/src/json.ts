import type { SignedBrief } from "@altai/contracts";

/** The full Ed25519-signed brief, pretty-printed. The signature + public key + audit
 * root travel with the file, so the artifact is independently verifiable. */
export function briefToJSON(brief: SignedBrief): string {
  return JSON.stringify(brief, null, 2) + "\n";
}
