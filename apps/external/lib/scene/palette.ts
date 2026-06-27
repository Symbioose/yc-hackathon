// Central neon palette for the Mission Control scene. Hex numbers for PixiJS.
export const C = {
  bg: 0x070b14,
  bgPanel: 0x0a1120,
  grid: 0x12203c,
  line: 0x1b2740,
  lineLit: 0x2f4670,
  ink: 0xc8d6f5,
  dim: 0x5b6b8c,

  cyan: 0x36e0ff,
  cyanDk: 0x1c7f99,
  green: 0x5dff9b,
  greenDk: 0x1f7a4d,
  amber: 0xffcf4d,
  amberDk: 0x8a6a14,
  violet: 0xb78bff,
  violetDk: 0x5b3f99,
  red: 0xff4d6d,
  redDk: 0x8a1f33,
  pink: 0xff6ad5,
  white: 0xffffff,
  black: 0x000000,

  fortress: 0x18233f,
  fortressLit: 0x2a3c66,
  hub: 0x132240,
  steel: 0x33425f,
} as const;

// Design-space resolution. The whole scene is laid out in this fixed coordinate
// system and then scaled to fit the canvas (letterbox) so layout math stays simple.
export const WORLD_W = 1320;
export const WORLD_H = 860;

export type Hex = number;
