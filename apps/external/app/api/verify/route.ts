import { SignedBriefSchema } from "@altai/contracts";
import { verifyBrief, publicKeyFingerprint } from "@altai/crypto";

/** Independent, stateless verification — "don't trust, verify". Anyone holding an
 * exported brief can POST it back (or to any Altai instance) and cryptographically
 * confirm it is authentic and untampered, against the public key embedded in the file.
 * No mission lookup, no shared secret: the proof travels with the artifact. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SignedBriefSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Not a valid SignedBrief (expected { signal, audit_root, signature, public_key })" },
      { status: 400 },
    );
  }
  const brief = parsed.data;
  return Response.json({
    ok: true,
    signature_valid: verifyBrief(brief),
    public_key_fingerprint: publicKeyFingerprint(brief.public_key),
    signed_over: "canonical(signal) + audit_root",
    entity: brief.signal.entity,
    event_type: brief.signal.event_type,
    audit_root: brief.audit_root,
  });
}
