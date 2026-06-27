import type { RouteEdge, SourceType } from "@altai/contracts";
import { START, type Genome } from "./types";

interface EdgeStat {
  from: string; // START | SourceType
  to: SourceType;
  visits: number;
  successes: number; // outcome === "signed"
  rewardSum: number;
  confSum: number;
  costSum: number;
  latSum: number;
}

/** Reward from the membrane oracle — the only trustworthy training signal.
 *
 * A route is reinforced ONLY when its signal was corroborated by independent
 * sources (noisy-OR), passed the Judge, and was signed. The positive reward scales
 * with fused confidence, so a 0.94 win teaches more than a barely-passed 0.55 one.
 * Quarantine (walked into poison the membrane rejected) is penalized hard;
 * dead-ends (never reached a signed brief) are down-weighted. */
export function reward(g: Genome): number {
  if (g.outcome === "quarantine") return -1;
  if (g.outcome === "dead_end") return -0.25;
  // "signed" only counts as a win if it was actually corroborated — two independent
  // sources OR a high fused confidence. A lone weak source barely moves the route.
  const corroborated = g.corroborating_types.length >= 2 || g.confidence >= 0.7;
  return corroborated ? g.confidence : 0.1;
}

/** The learned discovery graph: source_type → source_type edges with reward stats,
 * scoped per mission_type (a route is recalled for *this kind* of mission). This is
 * procedural memory — how to search — not a fact store. */
export class RouteGraph {
  private byType = new Map<string, Map<string, EdgeStat>>();

  private edgesFor(missionType: string): Map<string, EdgeStat> {
    let m = this.byType.get(missionType);
    if (!m) {
      m = new Map();
      this.byType.set(missionType, m);
    }
    return m;
  }

  /** Fold one finished mission into the graph. Walk START → s0 → s1 → … over the
   * trajectory actually taken and attribute the reward to each edge: wins reinforce
   * the path, quarantine/dead-ends down-weight it. */
  observe(g: Genome): void {
    const r = reward(g);
    const edges = this.edgesFor(g.mission_type);
    const path: string[] = [START, ...g.source_sequence];
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1] as SourceType;
      const key = `${from}->${to}`;
      const e = edges.get(key) ?? {
        from, to, visits: 0, successes: 0, rewardSum: 0, confSum: 0, costSum: 0, latSum: 0,
      };
      e.visits += 1;
      e.successes += g.outcome === "signed" ? 1 : 0;
      e.rewardSum += r;
      e.confSum += g.confidence;
      e.costSum += g.cost_usd;
      e.latSum += g.latency_ms;
      edges.set(key, e);
    }
  }

  private avgReward(e: EdgeStat): number {
    return e.rewardSum / e.visits;
  }

  /** Greedy max-average-reward walk from START → the best learned route for a
   * mission_type. Stops when the next edge's average reward falls below `minReward`,
   * a node repeats, or the route hits `maxLen`. Ties break toward more-visited edges. */
  bestRoute(missionType: string, maxLen = 4, minReward = 0.15): SourceType[] {
    const edges = this.byType.get(missionType);
    if (!edges) return [];
    const route: SourceType[] = [];
    const seen = new Set<SourceType>();
    let node: string = START;
    while (route.length < maxLen) {
      let best: EdgeStat | null = null;
      for (const e of edges.values()) {
        if (e.from !== node || seen.has(e.to)) continue;
        if (!best) {
          best = e;
          continue;
        }
        const a = this.avgReward(e);
        const b = this.avgReward(best);
        if (a > b || (a === b && e.visits > best.visits)) best = e;
      }
      if (!best || this.avgReward(best) < minReward) break;
      route.push(best.to);
      seen.add(best.to);
      node = best.to;
    }
    return route;
  }

  /** The edges for a mission_type as the contract type, ranked best-first — drives
   * the ops-center network graph. */
  edgesReport(missionType: string): RouteEdge[] {
    const edges = this.byType.get(missionType);
    if (!edges) return [];
    return [...edges.values()]
      .map((e) => ({
        from: e.from,
        to: e.to,
        visits: e.visits,
        success_rate: Number((e.successes / e.visits).toFixed(2)),
        avg_confidence: Number((e.confSum / e.visits).toFixed(2)),
        avg_cost_usd: Number((e.costSum / e.visits).toFixed(3)),
        avg_latency_ms: Math.round(e.latSum / e.visits),
        reward: Number(this.avgReward(e).toFixed(2)),
      }))
      .sort((a, b) => b.reward - a.reward || b.visits - a.visits);
  }
}
