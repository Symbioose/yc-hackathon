const GATEWAY = process.env.EXTERNAL_URL ?? "http://localhost:3000";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await fetch(`${GATEWAY}/api/missions/${id}/signal`);
  if (res.status === 202) return new Response(null, { status: 202 });
  const json = await res.json();
  return Response.json(json, { status: res.status });
}
