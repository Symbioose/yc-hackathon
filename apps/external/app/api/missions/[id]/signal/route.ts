import { getSignal } from "@/lib/missionStore";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const signal = getSignal(id);
  if (!signal) return new Response(null, { status: 202 }); // not ready yet
  return Response.json(signal);
}
