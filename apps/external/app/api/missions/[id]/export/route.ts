import { getBrief } from "@/lib/missionStore";
import { buildArtifact, isArtifactFormat } from "@altai/artifacts";

/** The agent's deliverable surface: materialize a sealed brief as a downloadable file
 * (Excel · CSV · Markdown · JSON · STIX 2.1). The signed signal is the source of
 * truth; every artifact carries its Ed25519 provenance. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const format = new URL(req.url).searchParams.get("format") ?? "md";
  if (!isArtifactFormat(format)) {
    return Response.json({ error: `unknown format: ${format}` }, { status: 400 });
  }
  const brief = getBrief(id);
  if (!brief) return new Response(null, { status: 202 }); // signal not sealed yet

  const artifact = await buildArtifact(brief, format);
  // body is a string (text formats) or Uint8Array (xlsx) — both valid BodyInit at
  // runtime; the cast bridges the generic-Uint8Array lib typing.
  return new Response(artifact.body as BodyInit, {
    headers: {
      "Content-Type": artifact.mime,
      "Content-Disposition": `attachment; filename="${artifact.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
