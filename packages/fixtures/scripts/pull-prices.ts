import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import yahooFinance from "yahoo-finance2";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "hero_case.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch daily closes, retrying through Yahoo's transient 429s with backoff. */
async function series(ticker: string, from: string, to: string, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await yahooFinance.chart(ticker, { period1: from, period2: to, interval: "1d" });
      return r.quotes
        .filter((q) => q.close != null)
        .map((q) => ({ date: new Date(q.date).toISOString().slice(0, 10), close: Number(Number(q.close).toFixed(2)) }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (i === attempts - 1) throw new Error(`${ticker}: ${msg}`);
      const wait = 1500 * (i + 1);
      console.warn(`[pull-prices] ${ticker} attempt ${i + 1} failed (${msg}); retrying in ${wait}ms`);
      await sleep(wait);
    }
  }
  return [];
}

const data = JSON.parse(readFileSync(file, "utf8"));
data.primary.price_series = await series("LYV", "2024-05-15", "2024-06-07");
data.primary.price_series_verified = true;
data.secondary.price_series = await series("MPL.AX", "2022-10-05", "2022-11-15");
data.secondary.price_series_verified = true;
writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(
  `✓ verified — LYV points: ${data.primary.price_series.length}, MPL.AX points: ${data.secondary.price_series.length}`,
);
