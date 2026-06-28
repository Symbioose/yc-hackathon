import { readFileSync } from "node:fs";

// Local-dev convenience: load the monorepo-root .env so `pnpm --filter @altai/internal dev`
// picks up OPENAI_API_KEY / OPENAI_MODEL_FAST without manual exporting. Never overrides a
// value already in the environment, and silently no-ops under Docker (env is injected there).
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
  basePath: "/bank",
  transpilePackages: ["@altai/contracts", "@altai/crypto"],
};
