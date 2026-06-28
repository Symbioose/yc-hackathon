import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { gsap } from "gsap";
import { C, WORLD_W, WORLD_H, type Hex } from "./palette";
import { makeRobot, makeLoot, makeSkull, makeLock } from "./sprites";
import { sfx } from "./sfx";

const FONT = '"Press Start 2P", ui-monospace, monospace';

const L = {
  fortress: { x: 60, y: 250, w: 175, h: 360 },
  entranceTop: { x: 235, y: 320 },
  exitBottom: { x: 235, y: 540 },
  policy: { x: 365, y: 300 },
  identity: { x: 565, y: 300 },
  hub: { x: 765, y: 425, r: 66 },
  web: { x: 1150, y: 165 },
  tor: { x: 1215, y: 425 },
  breach: { x: 1150, y: 690 },
  membrane: { x: 660, y: 610 },
  judge: { x: 430, y: 610 },
  chainY: 150,
  chainStartX: 300,
} as const;

type ScoutKind = "web" | "tor" | "breach";
const SCOUT: Record<ScoutKind, { node: { x: number; y: number }; body: Hex; accent: Hex; name: string }> = {
  web: { node: L.web, body: 0x274b6b, accent: C.cyan, name: "WEB" },
  tor: { node: L.tor, body: 0x3a2a5e, accent: C.violet, name: "TOR" },
  breach: { node: L.breach, body: 0x5e4a1e, accent: C.amber, name: "BREACH" },
};

function label(text: string, color: Hex, size = 9, align: "left" | "center" | "right" = "center"): Text {
  const t = new Text({
    text,
    style: new TextStyle({ fontFamily: FONT, fontSize: size, fill: color, align, letterSpacing: 1 }),
  });
  t.anchor.set(align === "left" ? 0 : align === "right" ? 1 : 0.5, 0.5);
  return t;
}

/** The whole Mission Control scene. Built imperatively for tight 60fps choreography. */
export class Scene {
  app: Application;
  root = new Container();
  private worldLayer = new Container();
  private dynLayer = new Container();
  private fxLayer = new Container();

  // persistent references
  private fortressGlow!: Graphics;
  private fortressDoorTop!: Graphics;
  private fortressDoorBottom!: Graphics;
  private hubCore!: Container;
  private hubRing!: Graphics;
  private policyStamp!: Container;
  private identityLock!: Container;
  private membraneBar!: Graphics;
  private nodes: Record<ScoutKind, Container> = {} as never;
  private torTag!: Container;
  private statusText!: Text;

  // per-mission state
  private robots: Partial<Record<ScoutKind, Container>> = {};
  private loots: Container[] = [];
  private orb: Container | null = null;
  private chain: Container[] = [];
  private tampered = false;
  private tickers: gsap.core.Tween[] = [];

  constructor(app: Application) {
    this.app = app;
    this.root.addChild(this.worldLayer, this.dynLayer, this.fxLayer);
    app.stage.addChild(this.root);
    this.buildWorld();
    this.layout();
    this.app.renderer.on("resize", this.layout);
  }

  // ---- responsive: scale the fixed design world to fit the canvas (letterbox) --
  layout = () => {
    const { width, height } = this.app.renderer;
    const dpr = this.app.renderer.resolution;
    const cw = width / dpr;
    const ch = height / dpr;
    const s = Math.min(cw / WORLD_W, ch / WORLD_H);
    this.root.scale.set(s);
    this.root.position.set((cw - WORLD_W * s) / 2, (ch - WORLD_H * s) / 2);
  };

  // ============================ STATIC WORLD =================================
  private buildWorld() {
    // background grid
    const bg = new Graphics();
    bg.rect(0, 0, WORLD_W, WORLD_H).fill(C.bg);
    for (let x = 0; x <= WORLD_W; x += 40) bg.moveTo(x, 0).lineTo(x, WORLD_H);
    for (let y = 0; y <= WORLD_H; y += 40) bg.moveTo(0, y).lineTo(WORLD_W, y);
    bg.stroke({ width: 1, color: C.grid, alpha: 0.5 });
    this.worldLayer.addChild(bg);

    // zone captions
    this.worldLayer.addChild(this.zoneCaption("SEALED ENVIRONMENT", L.fortress.x + L.fortress.w / 2, 232, C.dim));
    this.worldLayer.addChild(this.zoneCaption("ALTAI HUB", L.hub.x, L.hub.y - 110, C.cyan));
    this.worldLayer.addChild(this.zoneCaption("OPEN INTERNET", 1150, 70, C.dim));
    this.worldLayer.addChild(this.zoneCaption("MEMBRANE", L.membrane.x, L.membrane.y - 95, C.violet));
    this.worldLayer.addChild(this.zoneCaption("AUDIT LEDGER · MERKLE", 540, L.chainY - 42, C.green));

    this.buildLanes();
    this.buildFortress();
    this.buildGate(L.policy.x, L.policy.y, "POLICY", C.green);
    this.buildIdentity();
    this.buildHub();
    this.buildNodes();
    this.buildMembrane();
    this.buildJudge();

    // global status ticker (top-center)
    this.statusText = label("AWAITING DISPATCH", C.dim, 12);
    this.statusText.position.set(WORLD_W / 2, 30);
    this.worldLayer.addChild(this.statusText);
  }

  private zoneCaption(text: string, x: number, y: number, color: Hex): Text {
    const t = label(text, color, 9);
    t.position.set(x, y);
    t.alpha = 0.8;
    return t;
  }

  private buildLanes() {
    const g = new Graphics();
    // outbound lane (top): fortress -> policy -> identity -> hub
    const pts = [
      [L.entranceTop.x, L.entranceTop.y],
      [L.policy.x, L.policy.y],
      [L.identity.x, L.identity.y],
      [L.hub.x, L.hub.y],
    ];
    g.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
    // hub -> world nodes
    for (const k of Object.keys(SCOUT) as ScoutKind[]) {
      g.moveTo(L.hub.x, L.hub.y).lineTo(SCOUT[k].node.x, SCOUT[k].node.y);
    }
    // return lane: hub -> membrane -> judge -> fortress exit
    g.moveTo(L.hub.x, L.hub.y).lineTo(L.membrane.x, L.membrane.y);
    g.lineTo(L.judge.x, L.judge.y).lineTo(L.exitBottom.x, L.exitBottom.y);
    g.stroke({ width: 2, color: C.line });
    // dotted overlay for life
    g.stroke({ width: 1, color: C.lineLit, alpha: 0.4 });
    this.worldLayer.addChild(g);
  }

  private buildFortress() {
    const { x, y, w, h } = L.fortress;
    const c = new Container();
    this.fortressGlow = new Graphics();
    this.fortressGlow.roundRect(x - 6, y - 6, w + 12, h + 12, 10).fill({ color: C.cyan, alpha: 0 });
    c.addChild(this.fortressGlow);

    const body = new Graphics();
    body.roundRect(x, y, w, h, 8).fill(C.fortress).stroke({ width: 3, color: C.steel });
    // crenellations
    for (let i = 0; i < 7; i++) body.rect(x + 10 + i * 24, y - 12, 14, 14).fill(C.fortress).stroke({ width: 2, color: C.steel });
    // windows grid (server racks)
    for (let r = 0; r < 5; r++)
      for (let cc = 0; cc < 4; cc++)
        body.rect(x + 22 + cc * 36, y + 40 + r * 50, 22, 30).fill(C.bg).stroke({ width: 1, color: C.lineLit });
    c.addChild(body);

    // NO INTERNET badge
    const badge = new Graphics();
    badge.roundRect(x + 18, y + h - 46, w - 36, 30, 4).fill(C.redDk).stroke({ width: 2, color: C.red });
    c.addChild(badge);
    const bl = label("NO INTERNET", C.red, 9);
    bl.position.set(x + w / 2, y + h - 31);
    c.addChild(bl);

    // doors on the right edge (entrance top / exit bottom)
    this.fortressDoorTop = new Graphics();
    this.fortressDoorTop.rect(x + w - 6, L.entranceTop.y - 26, 12, 52).fill(C.steel);
    this.fortressDoorBottom = new Graphics();
    this.fortressDoorBottom.rect(x + w - 6, L.exitBottom.y - 26, 12, 52).fill(C.steel);
    c.addChild(this.fortressDoorTop, this.fortressDoorBottom);

    const title = label("MERIDIAN CAPITAL", C.ink, 10);
    title.position.set(x + w / 2, y + 18);
    c.addChild(title);
    this.worldLayer.addChild(c);
  }

  private buildGate(x: number, y: number, name: string, color: Hex) {
    const c = new Container();
    const frame = new Graphics();
    frame.roundRect(x - 34, y - 44, 68, 88, 6).fill(C.bgPanel).stroke({ width: 2, color: C.line });
    frame.rect(x - 22, y - 30, 10, 60).fill(C.steel);
    frame.rect(x + 12, y - 30, 10, 60).fill(C.steel);
    c.addChild(frame);
    const nm = label(name, color, 8);
    nm.position.set(x, y - 56);
    c.addChild(nm);

    // stamp (hidden until used)
    const stamp = new Container();
    const ring = new Graphics();
    ring.circle(0, 0, 26).stroke({ width: 5, color });
    const tick = label("OK", color, 11);
    stamp.addChild(ring, tick);
    stamp.position.set(x, y);
    stamp.scale.set(0);
    c.addChild(stamp);
    this.policyStamp = stamp;

    this.worldLayer.addChild(c);
  }

  private buildIdentity() {
    const { x, y } = L.identity;
    const c = new Container();
    const frame = new Graphics();
    frame.roundRect(x - 34, y - 44, 68, 88, 6).fill(C.bgPanel).stroke({ width: 2, color: C.line });
    c.addChild(frame);
    const nm = label("IDENTITY", C.green, 8);
    nm.position.set(x, y - 56);
    c.addChild(nm);
    const lock = makeLock(C.green, C.greenDk, 5);
    lock.position.set(x, y);
    lock.scale.set(0);
    c.addChild(lock);
    this.identityLock = lock;
    this.worldLayer.addChild(c);
  }

  private buildHub() {
    const { x, y, r } = L.hub;
    const c = new Container();
    this.hubRing = new Graphics();
    this.hubRing.circle(x, y, r + 14).stroke({ width: 2, color: C.cyanDk, alpha: 0.6 });
    c.addChild(this.hubRing);

    const core = new Container();
    const g = new Graphics();
    g.circle(0, 0, r).fill(C.hub).stroke({ width: 3, color: C.cyan });
    g.circle(0, 0, r - 16).stroke({ width: 1, color: C.cyanDk });
    // octagon launchpad detail
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.rect(Math.cos(a) * (r - 8) - 3, Math.sin(a) * (r - 8) - 3, 6, 6).fill(C.cyan);
    }
    core.addChild(g);
    core.addChild(label("ALTAI", C.cyan, 12));
    core.position.set(x, y);
    this.hubCore = core;
    c.addChild(core);
    this.worldLayer.addChild(c);

    // gentle idle pulse
    this.tickers.push(gsap.to(this.hubRing.scale, { x: 1.04, y: 1.04, duration: 1.6, yoyo: true, repeat: -1, ease: "sine.inOut", transformOrigin: "center" }));
    this.hubRing.pivot.set(x, y);
    this.hubRing.position.set(x, y);
  }

  private buildNodes() {
    (Object.keys(SCOUT) as ScoutKind[]).forEach((k) => {
      const { node, accent, name } = SCOUT[k];
      const c = new Container();
      const g = new Graphics();
      g.roundRect(-46, -36, 92, 72, 8).fill(C.bgPanel).stroke({ width: 2, color: accent });
      c.addChild(g);
      // icon
      const icon = new Graphics();
      if (k === "web") {
        icon.circle(0, -2, 18).stroke({ width: 2, color: accent });
        icon.moveTo(-18, -2).lineTo(18, -2).moveTo(0, -20).lineTo(0, 16);
        icon.ellipse(0, -2, 9, 18).stroke({ width: 2, color: accent });
        icon.stroke({ width: 2, color: accent });
      } else if (k === "tor") {
        for (let i = 3; i >= 1; i--) icon.ellipse(0, 2, i * 6, i * 8).stroke({ width: 2, color: accent });
        icon.moveTo(0, -22).lineTo(0, -10).stroke({ width: 2, color: accent });
      } else {
        for (let i = 0; i < 3; i++) icon.ellipse(0, -14 + i * 13, 20, 7).stroke({ width: 2, color: accent });
        icon.moveTo(-20, -14).lineTo(-20, 12).moveTo(20, -14).lineTo(20, 12).stroke({ width: 2, color: accent });
      }
      c.addChild(icon);
      const nm = label(name, accent, 8);
      nm.position.set(0, 50);
      c.addChild(nm);
      c.position.set(node.x, node.y);
      this.nodes[k] = c;
      this.worldLayer.addChild(c);
    });

    // tor exit-ip tag (hidden until tor scout reports)
    const tag = new Container();
    const tg = new Graphics();
    tg.roundRect(-78, -16, 156, 32, 4).fill(C.bgPanel).stroke({ width: 1, color: C.violet });
    tag.addChild(tg);
    const tt = label("EXIT ——", C.violet, 8);
    tag.addChild(tt);
    (tag as Container & { _txt?: Text })._txt = tt;
    tag.position.set(L.tor.x, L.tor.y + 78);
    tag.alpha = 0;
    this.torTag = tag;
    this.worldLayer.addChild(tag);
  }

  private buildMembrane() {
    const { x, y } = L.membrane;
    const g = new Graphics();
    g.roundRect(x - 10, y - 90, 20, 180, 6).fill({ color: C.violet, alpha: 0.12 }).stroke({ width: 2, color: C.violet });
    for (let i = -80; i <= 80; i += 16) g.moveTo(x - 8, y + i).lineTo(x + 8, y + i).stroke({ width: 1, color: C.violet, alpha: 0.5 });
    this.membraneBar = g;
    this.worldLayer.addChild(g);
    const nm = label("SANITIZER", C.violet, 7);
    nm.position.set(x, y + 104);
    this.worldLayer.addChild(nm);
    // idle shimmer
    this.tickers.push(gsap.to(g, { alpha: 0.7, duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut" }));
  }

  private buildJudge() {
    const { x, y } = L.judge;
    const c = new Container();
    const g = new Graphics();
    g.roundRect(x - 38, y - 38, 76, 76, 8).fill(C.bgPanel).stroke({ width: 2, color: C.amber });
    // gavel-ish seal mark
    g.circle(x, y, 18).stroke({ width: 3, color: C.amber });
    g.moveTo(x - 9, y).lineTo(x + 9, y).moveTo(x, y - 9).lineTo(x, y + 9).stroke({ width: 2, color: C.amber });
    c.addChild(g);
    const nm = label("JUDGE", C.amber, 8);
    nm.position.set(x, y - 52);
    c.addChild(nm);
    this.worldLayer.addChild(c);
  }

  // ============================ BEATS / API =================================
  setStatus(text: string, color: Hex = C.cyan) {
    this.statusText.text = text;
    this.statusText.style.fill = color;
  }

  private spark(x: number, y: number, color: Hex, count = 14, spread = 70) {
    for (let i = 0; i < count; i++) {
      const p = new Graphics().rect(0, 0, 5, 5).fill(color);
      p.position.set(x, y);
      this.fxLayer.addChild(p);
      const a = Math.random() * Math.PI * 2;
      const d = spread * (0.4 + Math.random() * 0.8);
      gsap.to(p, {
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        alpha: 0,
        duration: 0.5 + Math.random() * 0.4,
        ease: "power2.out",
        onComplete: () => p.destroy(),
      });
    }
  }

  private floatText(text: string, x: number, y: number, color: Hex, size = 9) {
    const t = label(text, color, size);
    t.position.set(x, y);
    this.fxLayer.addChild(t);
    gsap.fromTo(t, { y: y + 8, alpha: 0 }, { y: y - 26, alpha: 1, duration: 0.5, ease: "back.out(2)" });
    gsap.to(t, { alpha: 0, duration: 0.5, delay: 1.4, onComplete: () => t.destroy() });
  }

  reset() {
    gsap.killTweensOf(this.dynLayer.children);
    this.dynLayer.removeChildren().forEach((c) => c.destroy());
    this.fxLayer.removeChildren().forEach((c) => c.destroy());
    this.robots = {};
    this.loots = [];
    this.orb = null;
    this.chain = [];
    this.tampered = false;
    this.policyStamp.scale.set(0);
    this.identityLock.scale.set(0);
    this.torTag.alpha = 0;
    (this.membraneBar as Graphics).tint = 0xffffff;
  }

  // beat 1: fortress dispatches a mission packet -> heads to gates
  dispatch() {
    this.reset();
    this.setStatus("MISSION DISPATCHED", C.cyan);
    sfx.dispatch();
    gsap.to(this.fortressGlow, { alpha: 0.5, duration: 0.3, yoyo: true, repeat: 1 });
    gsap.to(this.fortressDoorTop, { x: "+=0", alpha: 0.3, duration: 0.25, yoyo: true, repeat: 1 });

    const pkt = this.makePacket();
    pkt.position.set(L.entranceTop.x, L.entranceTop.y);
    this.dynLayer.addChild(pkt);
    (this as { _packet?: Container })._packet = pkt;
    gsap.to(pkt.position, { x: L.policy.x, y: L.policy.y, duration: 0.8, ease: "power1.inOut" });
  }

  private makePacket(): Container {
    const c = new Container();
    const g = new Graphics();
    g.roundRect(-14, -10, 28, 20, 3).fill(C.bgPanel).stroke({ width: 2, color: C.cyan });
    g.moveTo(-14, -10).lineTo(0, 0).lineTo(14, -10).stroke({ width: 2, color: C.cyan });
    c.addChild(g);
    return c;
  }

  // beat 2a: policy gate stamps green (ok) or red (reject)
  policy(ok: boolean) {
    const color = ok ? C.green : C.red;
    (this.policyStamp.children[1] as Text).text = ok ? "OK" : "X";
    (this.policyStamp.children[1] as Text).style.fill = color;
    (this.policyStamp.children[0] as Graphics).clear().circle(0, 0, 26).stroke({ width: 5, color });
    this.setStatus(ok ? "POLICY: WITHIN SCOPE" : "POLICY: REJECTED", color);
    ok ? sfx.stampOk() : sfx.stampBad();
    gsap.fromTo(this.policyStamp.scale, { x: 1.8, y: 1.8 }, { x: 1, y: 1, duration: 0.35, ease: "back.out(3)" });
    this.spark(L.policy.x, L.policy.y, color, 12, 50);
    if (!ok) {
      this.setStatus("MISSION HALTED AT POLICY", C.red);
      const pkt = (this as { _packet?: Container })._packet;
      if (pkt) gsap.to(pkt, { alpha: 0, duration: 0.4, onComplete: () => pkt.destroy() });
    }
  }

  // beat 2b: identity gate masks the client identity
  identity() {
    this.setStatus("IDENTITY STRIPPED", C.green);
    sfx.mask();
    const pkt = (this as { _packet?: Container })._packet;
    if (pkt) {
      gsap.to(pkt.position, {
        x: L.identity.x,
        y: L.identity.y,
        duration: 0.6,
        ease: "power1.inOut",
        onComplete: () => {
          gsap.fromTo(this.identityLock.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(3)" });
          this.spark(L.identity.x, L.identity.y, C.green, 10, 40);
          this.floatText("anon-egress", L.identity.x, L.identity.y - 40, C.green, 8);
          // recolor packet to "anonymous"
          const g = pkt.children[0] as Graphics;
          g.tint = C.dim;
          gsap.to(pkt.position, { x: L.hub.x, y: L.hub.y, duration: 0.7, delay: 0.2, ease: "power1.in", onComplete: () => {
            this.spark(L.hub.x, L.hub.y, C.cyan, 16, 60);
            sfx.blip();
            gsap.to(pkt, { alpha: 0, duration: 0.3, onComplete: () => pkt.destroy() });
          } });
        },
      });
    }
  }

  // beat 3: planner decomposes -> spawn + launch 3 scouts to the world
  launchScouts() {
    this.setStatus("DEPLOYING SCOUT FLEET", C.cyan);
    gsap.to(this.hubCore.scale, { x: 1.15, y: 1.15, duration: 0.2, yoyo: true, repeat: 1 });
    (Object.keys(SCOUT) as ScoutKind[]).forEach((k, i) => {
      const r = makeRobot({ body: SCOUT[k].body, accent: SCOUT[k].accent }, 4);
      r.position.set(L.hub.x, L.hub.y);
      r.scale.set(0);
      this.dynLayer.addChild(r);
      this.robots[k] = r;
      const node = SCOUT[k].node;
      gsap.to(r.scale, { x: 1, y: 1, duration: 0.25, delay: i * 0.12, ease: "back.out(2)" });
      gsap.to(r.position, {
        x: node.x,
        y: node.y - 60,
        duration: 1.0,
        delay: 0.2 + i * 0.18,
        ease: "power2.inOut",
        onStart: () => sfx.launch(),
        onComplete: () => this.scoutSearch(k),
      });
    });
  }

  private scoutSearch(k: ScoutKind) {
    const r = this.robots[k];
    if (!r) return;
    const node = SCOUT[k].node;
    // hover + scan pulses over the node
    this.tickers.push(gsap.to(r.position, { y: node.y - 72, duration: 0.5, yoyo: true, repeat: 5, ease: "sine.inOut" }));
    gsap.to(this.nodes[k].scale, { x: 1.08, y: 1.08, duration: 0.3, yoyo: true, repeat: 3, ease: "sine.inOut" });
    for (let i = 0; i < 3; i++) setTimeout(() => { this.spark(node.x, node.y, SCOUT[k].accent, 4, 30); sfx.blip(); }, i * 260);
  }

  // tor reports its exit ip + country (from real TraceEvent meta)
  torExit(ip: string, country?: string) {
    const tt = (this.torTag as Container & { _txt?: Text })._txt;
    if (tt) tt.text = `EXIT ${ip}${country ? ` (${country})` : ""}`;
    gsap.fromTo(this.torTag, { alpha: 0, y: L.tor.y + 64 }, { alpha: 1, y: L.tor.y + 78, duration: 0.4, ease: "back.out(2)" });
    sfx.loot();
  }

  // beat 3->4: scouts return to hub carrying loot, then loot fuses into the orb
  returnAndFuse() {
    this.setStatus("FINDINGS RETURNED", C.green);
    const kinds = Object.keys(this.robots) as ScoutKind[];
    kinds.forEach((k, i) => {
      const r = this.robots[k];
      if (!r) return;
      gsap.killTweensOf(r.position);
      const loot = makeLoot(SCOUT[k].accent, 4);
      loot.position.copyFrom(r.position);
      this.dynLayer.addChild(loot);
      this.loots.push(loot);
      // robot heads home
      gsap.to(r.position, { x: L.hub.x + (i - 1) * 26, y: L.hub.y, duration: 0.9, delay: i * 0.1, ease: "power2.inOut" });
      gsap.to(r, { alpha: 0, duration: 0.3, delay: 0.9 + i * 0.1, onComplete: () => r.destroy() });
      // loot flies to hub then fuses
      gsap.to(loot.position, {
        x: L.hub.x,
        y: L.hub.y,
        duration: 0.95,
        delay: 0.15 + i * 0.1,
        ease: "power2.in",
        onStart: () => sfx.loot(),
        onComplete: () => {
          this.spark(L.hub.x, L.hub.y, SCOUT[k].accent, 10, 40);
          gsap.to(loot, { alpha: 0, duration: 0.2, onComplete: () => loot.destroy() });
          if (i === kinds.length - 1) this.formOrb();
        },
      });
    });
  }

  // beat 4: the signal orb materializes at the hub
  formOrb() {
    this.setStatus("SIGNAL ORB FUSED", C.cyan);
    sfx.orb();
    const orb = new Container();
    const halo = new Graphics().circle(0, 0, 34).fill({ color: C.cyan, alpha: 0.18 });
    const core = new Graphics().circle(0, 0, 18).fill(C.cyan).stroke({ width: 3, color: C.white });
    const inner = new Graphics().circle(0, 0, 8).fill(C.white);
    orb.addChild(halo, core, inner);
    orb.position.set(L.hub.x, L.hub.y);
    orb.scale.set(0);
    this.dynLayer.addChild(orb);
    this.orb = orb;
    gsap.fromTo(orb.scale, { x: 0, y: 0 }, { x: 1, y: 1, duration: 0.5, ease: "elastic.out(1,0.5)" });
    this.tickers.push(gsap.to(halo.scale, { x: 1.25, y: 1.25, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" }));
    this.spark(L.hub.x, L.hub.y, C.cyan, 20, 80);
  }

  // beat 5: orb crosses the membrane; injection hunter intercepts a pirate packet
  quarantine(excerpt?: string) {
    if (!this.orb) return;
    this.setStatus("ORB → MEMBRANE", C.violet);
    const orb = this.orb;
    // move orb toward the membrane
    gsap.to(orb.position, {
      x: L.membrane.x,
      y: L.membrane.y,
      duration: 1.0,
      ease: "power1.inOut",
      onComplete: () => {
        // a pirate skull packet rides in alongside the data
        const skull = makeSkull(5);
        skull.position.set(L.membrane.x + 120, L.membrane.y - 40);
        this.dynLayer.addChild(skull);
        gsap.to(skull.position, {
          x: L.membrane.x,
          y: L.membrane.y,
          duration: 0.5,
          ease: "power2.in",
          onComplete: () => {
            // INTERCEPT
            this.setStatus("⚠ PROMPT INJECTION INTERCEPTED", C.red);
            sfx.alarm();
            (this.membraneBar as Graphics).tint = C.red;
            this.flashScreen(C.red);
            gsap.to(this.membraneBar.scale, { x: 1.2, duration: 0.1, yoyo: true, repeat: 5 });
            // incinerate the skull
            this.spark(L.membrane.x, L.membrane.y, C.red, 26, 90);
            this.floatText("QUARANTINED", L.membrane.x, L.membrane.y - 70, C.red, 11);
            sfx.incinerate();
            gsap.to(skull, { rotation: 0.6, alpha: 0, duration: 0.6, ease: "power2.in", onComplete: () => skull.destroy() });
            gsap.to(skull.scale, { x: 0, y: 0, duration: 0.6 });
            (this.membraneBar as Graphics);
            gsap.delayedCall(0.7, () => { (this.membraneBar as Graphics).tint = 0xffffff; });
          },
        });
      },
    });
  }

  // beat 5 (clean path): no injection found — orb simply crosses the membrane
  cleanMembrane() {
    if (!this.orb) return;
    this.setStatus("MEMBRANE: NO INJECTION", C.violet);
    gsap.to(this.orb.position, { x: L.membrane.x, y: L.membrane.y, duration: 0.9, ease: "power1.inOut" });
    this.spark(L.membrane.x, L.membrane.y, C.violet, 10, 40);
  }

  // beat 5b: sanitizer scrubs PII/secrets from the orb
  sanitize(redactions: number) {
    if (!this.orb) return;
    this.setStatus(`SANITIZED · ${redactions} REDACTION${redactions === 1 ? "" : "S"}`, C.violet);
    sfx.sanitize();
    this.spark(this.orb.x, this.orb.y, C.violet, 14, 50);
    gsap.fromTo(this.orb.scale, { x: 1.25, y: 1.25 }, { x: 1, y: 1, duration: 0.4, ease: "power2.out" });
    this.floatText(`-${redactions} PII`, this.orb.x, this.orb.y - 44, C.violet, 8);
  }

  // beat 6: judge signs the orb (Ed25519 seal)
  sign() {
    if (!this.orb) return;
    const orb = this.orb;
    this.setStatus("ORB → JUDGE", C.amber);
    gsap.to(orb.position, {
      x: L.judge.x,
      y: L.judge.y,
      duration: 0.9,
      ease: "power1.inOut",
      onComplete: () => {
        this.setStatus("SIGNED · Ed25519", C.amber);
        sfx.sign();
        // recolor orb to "signed gold"
        (orb.children[1] as Graphics).tint = C.amber;
        (orb.children[0] as Graphics).tint = C.amber;
        const seal = label("Ed25519", C.amber, 8);
        seal.position.set(L.judge.x, L.judge.y + 58);
        this.fxLayer.addChild(seal);
        gsap.fromTo(seal.scale, { x: 0, y: 0 }, { x: 1, y: 1, duration: 0.4, ease: "back.out(3)" });
        this.spark(L.judge.x, L.judge.y, C.amber, 22, 70);
      },
    });
  }

  // beat 6b: build the merkle audit chain along the bottom
  buildChain(blocks = 5) {
    this.setStatus("AUDIT LEDGER SEALED", C.green);
    for (let i = 0; i < blocks; i++) {
      const x = L.chainStartX + i * 150;
      gsap.delayedCall(i * 0.18, () => {
        const b = this.makeBlock(i);
        b.position.set(x, L.chainY);
        b.scale.set(0);
        this.dynLayer.addChild(b);
        this.chain.push(b);
        gsap.to(b.scale, { x: 1, y: 1, duration: 0.3, ease: "back.out(2.5)" });
        sfx.block();
        if (i > 0) {
          // connector from the previous block's right edge to this one (block-local coords)
          const link = new Graphics().moveTo(-95, 0).lineTo(-55, 0).stroke({ width: 3, color: C.greenDk });
          b.addChildAt(link, 0);
        }
        if (i === blocks - 1) gsap.delayedCall(0.3, () => this.returnBrief());
      });
    }
  }

  private makeBlock(i: number): Container {
    const c = new Container();
    const g = new Graphics();
    g.roundRect(-55, -26, 110, 52, 4).fill(C.bgPanel).stroke({ width: 2, color: C.green });
    g.moveTo(-55, -10).lineTo(55, -10).stroke({ width: 1, color: C.greenDk });
    c.addChild(g);
    c.addChild((() => { const t = label(`#${i}`, C.green, 8); t.position.set(0, -16); return t; })());
    const h = Math.random().toString(16).slice(2, 8);
    c.addChild((() => { const t = label(`0x${h}`, C.dim, 7); t.position.set(0, 6); return t; })());
    (c as Container & { _frame?: Graphics })._frame = g;
    return c;
  }

  // beat 6c: the signed brief flies back into the fortress
  returnBrief() {
    if (!this.orb) return;
    const orb = this.orb;
    this.setStatus("SIGNED BRIEF → SEALED ENV", C.green);
    gsap.to(this.fortressGlow, { alpha: 0.6, duration: 0.3, yoyo: true, repeat: 3 });
    gsap.to(orb.position, {
      x: L.exitBottom.x,
      y: L.exitBottom.y,
      duration: 1.0,
      ease: "power2.in",
      onComplete: () => {
        sfx.sealed();
        this.spark(L.exitBottom.x, L.exitBottom.y, C.green, 18, 60);
        if (!this.tampered) this.setStatus("✓ BRIEF DELIVERED · FIREWALL NEVER OPENED", C.green);
        gsap.to(orb, { alpha: 0, duration: 0.3, onComplete: () => { orb.destroy(); this.orb = null; } });
      },
    });
  }

  // beat 7: tamper -> a chain block cracks red
  tamper() {
    if (!this.chain.length) return;
    this.tampered = true;
    this.setStatus("✗ TAMPER DETECTED · MERKLE ROOT MISMATCH", C.red);
    sfx.tamper();
    this.flashScreen(C.red);
    const idx = Math.min(1, this.chain.length - 1);
    const b = this.chain[idx];
    const frame = (b as Container & { _frame?: Graphics })._frame;
    if (frame) frame.clear().roundRect(-55, -26, 110, 52, 4).fill(C.redDk).stroke({ width: 3, color: C.red });
    // crack lines
    const crack = new Graphics();
    crack.moveTo(-30, -26).lineTo(-10, 0).lineTo(-24, 26).moveTo(20, -26).lineTo(6, 4).lineTo(24, 26);
    crack.stroke({ width: 2, color: C.red });
    b.addChild(crack);
    gsap.fromTo(b, { x: b.x - 4 }, { x: b.x + 4, duration: 0.05, yoyo: true, repeat: 9, onComplete: () => gsap.to(b, { x: L.chainStartX + idx * 150 }) });
    this.floatText("TAMPER DETECTED", b.x, b.y - 44, C.red, 9);
  }

  private flashScreen(color: Hex) {
    const f = new Graphics().rect(0, 0, WORLD_W, WORLD_H).fill({ color, alpha: 0.35 });
    this.fxLayer.addChild(f);
    gsap.to(f, { alpha: 0, duration: 0.4, onComplete: () => f.destroy() });
  }

  destroy() {
    this.app.renderer.off("resize", this.layout);
    this.tickers.forEach((t) => t.kill());
    gsap.killTweensOf("*");
  }
}
