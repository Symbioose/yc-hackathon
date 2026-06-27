import type { SignedBrief } from "@altai/contracts";
import { verifyBrief } from "@altai/crypto";

const GATEWAY = process.env.EXTERNAL_URL ?? "http://localhost:3000";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await fetch(`${GATEWAY}/api/missions/${id}/signal`);
  if (res.status === 202) return new Response(null, { status: 202 });
  if (!res.ok) return new Response(null, { status: res.status });
  const brief = (await res.json()) as SignedBrief;
  // The sealed side independently verifies the Ed25519 signature against the brief's public key.
  const verified = verifyBrief(brief);
  return Response.json({ brief, verified });
}
