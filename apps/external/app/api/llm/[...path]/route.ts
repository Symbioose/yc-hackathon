// On-prem LLM proxy (gateway side). The sealed internal-app has no internet, so the
// Meridian Copilot can't reach OpenAI directly. It points its OpenAI-compatible client
// at the gateway (OPENAI_BASE_URL=http://external-app:3000/api/llm/v1); this route
// forwards the call to the upstream provider and injects the API key here, so the key
// lives only in the gateway and never enters the sealed container.
//
// It is a transparent pass-through: whatever path the SDK hits under /api/llm/* (e.g.
// /v1/chat/completions) is forwarded verbatim to the upstream, including streaming.

export const dynamic = "force-dynamic";

const UPSTREAM = (process.env.OPENAI_PROXY_UPSTREAM ?? "https://api.openai.com").replace(/\/+$/, "");

async function forward(req: Request, path: string[]): Promise<Response> {
  const key = process.env.OPENAI_API_KEY ?? "";
  const search = new URL(req.url).search;
  const url = `${UPSTREAM}/${path.join("/")}${search}`;

  const headers = new Headers();
  headers.set("authorization", `Bearer ${key}`);
  for (const h of ["content-type", "accept", "openai-organization", "openai-project"]) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  try {
    const upstream = await fetch(url, { method: req.method, headers, body });
    const respHeaders = new Headers();
    for (const h of ["content-type", "cache-control"]) {
      const v = upstream.headers.get(h);
      if (v) respHeaders.set(h, v);
    }
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  } catch (e) {
    return Response.json(
      { error: { message: `LLM proxy upstream error: ${e instanceof Error ? e.message : String(e)}` } },
      { status: 502 },
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function POST(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function GET(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
