import { priceSeriesFor } from "@altai/fixtures";

/** Daily close series for the hero overlay chart (beat 4). Market data only —
 * intentionally outside the signed Signal payload. */
export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  const series = priceSeriesFor(ticker);
  if (!series.length) return Response.json({ ticker, series: [] }, { status: 404 });
  return Response.json({ ticker, series });
}
