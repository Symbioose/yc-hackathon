// Document deliverables for the sealed terminal. The gateway already renders a research
// brief as a downloadable, Ed25519-signed file (Excel / CSV / Markdown / JSON / STIX 2.1);
// this route streams that file back through the sealed app's own origin so the chat can
// link to /bank/api/export?mission_id=…&format=… (works whether the browser is on the
// gateway's /bank proxy or the internal app directly).
const EXTERNAL_URL = process.env.EXTERNAL_URL ?? "http://localhost:3000";
const FORMATS = new Set(["xlsx", "csv", "md", "json", "stix"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("mission_id") ?? "";
  const format = (url.searchParams.get("format") ?? "md").toLowerCase();
  if (!id) return new Response("missing mission_id", { status: 400 });
  if (!FORMATS.has(format)) return new Response(`unknown format: ${format}`, { status: 400 });

  try {
    const res = await fetch(`${EXTERNAL_URL}/api/missions/${encodeURIComponent(id)}/export?format=${format}`);
    if (res.status === 202) return new Response("brief not sealed yet", { status: 202 });
    if (!res.ok) return new Response(`gateway export failed (${res.status})`, { status: res.status });
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/octet-stream",
        "content-disposition": res.headers.get("content-disposition") ?? `attachment; filename="altai-brief.${format}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return new Response(`export error: ${e instanceof Error ? e.message : String(e)}`, { status: 502 });
  }
}
