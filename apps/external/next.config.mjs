import { readFileSync } from "node:fs";

// Local-dev convenience: load the monorepo-root .env so `pnpm --filter @altai/external dev`
// picks up OPENAI_API_KEY / model ids / Tor settings without manual exporting. Never
// overrides an existing env var, and silently no-ops under Docker (env is injected there).
try {
  const raw = readFileSync(new URL("../../.env", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* no root .env (e.g. Docker) — ignore */
}

/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ["@altai/contracts", "@altai/fixtures", "@altai/tools", "@altai/agents", "@altai/crypto"],
  async rewrites() {
    const internal = process.env.INTERNAL_URL ?? "http://localhost:3100";
    return [{ source: "/bank/:path*", destination: `${internal}/bank/:path*` }];
  },
};
