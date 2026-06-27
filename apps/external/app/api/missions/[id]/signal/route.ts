import { getBrief } from "@/lib/missionStore";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const brief = getBrief(id);
  if (!brief) return new Response(null, { status: 202 }); // not ready yet
  return Response.json(brief); // SignedBrief: { signal, audit_root, signature, public_key }
}
