import { getBrief, getEntries } from "@/lib/missionStore";
import { verifyBrief, verifyLedger } from "@altai/crypto";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const brief = getBrief(id);
  const entries = getEntries(id);
  if (!brief || !entries) return new Response(null, { status: 202 });
  return Response.json({
    entries,
    audit_root: brief.audit_root,
    signature: brief.signature,
    public_key: brief.public_key,
    signature_valid: verifyBrief(brief),
    ledger_ok: verifyLedger(entries, brief.audit_root),
  });
}
