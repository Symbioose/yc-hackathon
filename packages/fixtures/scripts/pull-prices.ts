import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import yahooFinance from "yahoo-finance2";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "hero_case.json");

async function series(ticker: string, from: string, to: string) {
  const r = await yahooFinance.chart(ticker, { period1: from, period2: to, interval: "1d" });
  return r.quotes
    .filter((q) => q.close != null)
    .map((q) => ({ date: new Date(q.date).toISOString().slice(0, 10), close: Number(q.close) }));
}

const data = JSON.parse(readFileSync(file, "utf8"));
data.primary.price_series = await series("LYV", "2024-05-15", "2024-06-07");
data.secondary.price_series = await series("MPL.AX", "2022-10-05", "2022-11-15");
writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(
  `LYV points: ${data.primary.price_series.length}, MPL.AX points: ${data.secondary.price_series.length}`
);
