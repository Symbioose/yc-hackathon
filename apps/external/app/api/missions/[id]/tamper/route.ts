import { getBrief, getEntries, tamperMission } from "@/lib/missionStore";
import { verifyBrief, verifyLedger } from "@altai/crypto";

/** Tamper-demo: edit one audit entry; the recomputed Merkle root diverges from the
 * signed root, so ledger verification flips to false while the signature stays valid. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const idx = Number.isInteger(body?.idx) ? body.idx : 0;
  const patch = body?.patch ?? { action: "⚠ EVIDENCE ALTERED" };
  const entries = tamperMission(id, idx, patch);
  const brief = getBrief(id);
  if (!entries || !brief) return new Response(null, { status: 404 });
  return Response.json({
    entries,
    audit_root: brief.audit_root,
    signature: brief.signature,
    public_key: brief.public_key,
    signature_valid: verifyBrief(brief),
    ledger_ok: verifyLedger(getEntries(id)!, brief.audit_root),
  });
}
