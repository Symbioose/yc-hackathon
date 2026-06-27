import { Container, Graphics } from "pixi.js";
import { C, type Hex } from "./palette";

/** Draw a pixel grid into a Graphics. `.` = transparent. Returns the Graphics. */
export function drawPixels(grid: string[], map: Record<string, Hex>, px = 4): Graphics {
  const g = new Graphics();
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "." || !(ch in map)) return;
      g.rect(x * px, y * px, px, px).fill(map[ch]);
    });
  });
  return g;
}

// --- Scout robot (cute chunky bot). B=body, A=accent, W=eye, D=dark ----------
const ROBOT = [
  "...D..D...",
  "...B..B...",
  "..BBBBBB..",
  ".BBBBBBBB.",
  ".BWAAAAWB.",
  ".BBBBBBBB.",
  "..BBBBBB..",
  ".BBBBBBBB.",
  ".BBBBBBBB.",
  ".BBAAAABB.",
  "..B....B..",
  "..D....D..",
];

export interface RobotColors { body: Hex; accent: Hex; }

export function makeRobot(colors: RobotColors, px = 4): Container {
  const c = new Container();
  // soft glow plate behind
  const glow = new Graphics();
  glow.roundRect(-px, px, 12 * px, 11 * px, 6).fill({ color: colors.accent, alpha: 0.12 });
  c.addChild(glow);
  const body = drawPixels(ROBOT, { B: colors.body, A: colors.accent, W: C.white, D: C.steel }, px);
  c.addChild(body);
  // center the pivot
  c.pivot.set((10 * px) / 2, (12 * px) / 2);
  return c;
}

// --- Loot data-chip carried home by a scout ----------------------------------
const LOOT = [
  ".AAAA.",
  "AWWWWA",
  "AWBBWA",
  "AWBBWA",
  "AWWWWA",
  ".AAAA.",
];

export function makeLoot(accent: Hex, px = 4): Container {
  const c = new Container();
  const g = drawPixels(LOOT, { A: accent, W: C.white, B: C.bgPanel }, px);
  c.addChild(g);
  c.pivot.set((6 * px) / 2, (6 * px) / 2);
  return c;
}

// --- Pirate / injection packet (skull) ---------------------------------------
const SKULL = [
  ".WWWWWW.",
  "WWWWWWWW",
  "WKKWWKKW",
  "WWWWWWWW",
  "WWWKKWWW",
  "WKWKWKWW",
  ".WWWWWW.",
  "..W..W..",
];

export function makeSkull(px = 4): Container {
  const c = new Container();
  const glow = new Graphics();
  glow.circle((8 * px) / 2, (8 * px) / 2, 7 * px).fill({ color: C.red, alpha: 0.18 });
  c.addChild(glow);
  const g = drawPixels(SKULL, { W: 0xf2f5ff, K: C.black }, px);
  c.addChild(g);
  c.pivot.set((8 * px) / 2, (8 * px) / 2);
  return c;
}

// --- Small lock icon (identity masking) --------------------------------------
const LOCK = [
  ".AAAA.",
  ".A..A.",
  ".A..A.",
  "BBBBBB",
  "BBWWBB",
  "BBWWBB",
  "BBBBBB",
];

export function makeLock(accent: Hex, body: Hex, px = 4): Container {
  const c = new Container();
  const g = drawPixels(LOCK, { A: accent, B: body, W: C.bgPanel }, px);
  c.addChild(g);
  c.pivot.set((6 * px) / 2, (7 * px) / 2);
  return c;
}
