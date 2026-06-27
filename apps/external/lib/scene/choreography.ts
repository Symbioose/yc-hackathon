import type { TraceEvent } from "@altai/contracts";
import type { Scene } from "./engine";

type Beat = { run: () => void; gap: number };

/** Translates the live TraceEvent stream into scene beats.
 *
 * The backend emits some stages (membrane → audit) in a sub-10ms burst, so we
 * queue beats and play them out with a minimum spacing. This decouples the
 * cinematic pacing from event-arrival timing and guarantees every beat — above
 * all the quarantine — gets its full moment on screen. Tolerant to both the
 * scripted fake fleet and the noisier real swarm. */
export class Choreographer {
  private launched = false;
  private fused = false;
  private torReported = false;
  private membraneEntered = false;

  private queue: Beat[] = [];
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private scene: Scene) {}

  private hardReset() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue = [];
    this.running = false;
    this.launched = false;
    this.fused = false;
    this.torReported = false;
    this.membraneEntered = false;
  }

  private enqueue(run: () => void, gap: number) {
    this.queue.push({ run, gap });
    this.pump();
  }

  private pump() {
    if (this.running) return;
    const next = this.queue.shift();
    if (!next) return;
    this.running = true;
    try {
      next.run();
    } finally {
      this.timer = setTimeout(() => {
        this.running = false;
        this.pump();
      }, next.gap);
    }
  }

  handle(ev: TraceEvent) {
    // Tor exit ip is a side-channel flourish — fire immediately, never queued.
    if (!this.torReported && ev.meta && typeof ev.meta.exit_ip === "string") {
      this.torReported = true;
      const ip = ev.meta.exit_ip;
      const country = typeof ev.meta.country === "string" ? ev.meta.country : undefined;
      this.enqueue(() => this.scene.torExit(ip, country), 0);
    }

    switch (ev.layer) {
      case "dispatch":
        this.hardReset();
        this.enqueue(() => this.scene.dispatch(), 1000);
        break;

      case "policy": {
        const ok = ev.level !== "block";
        this.enqueue(() => this.scene.policy(ok), 700);
        break;
      }

      case "identity":
        this.enqueue(() => this.scene.identity(), 1700);
        break;

      case "execution":
        if (ev.agent === "Planner" && /decompos/i.test(ev.msg)) {
          if (!this.launched) {
            this.launched = true;
            this.enqueue(() => this.scene.launchScouts(), 2500);
          }
        } else if (ev.agent === "Planner" && (ev.level === "success" || /synthe|candidate/i.test(ev.msg))) {
          if (!this.fused) {
            this.fused = true;
            this.enqueue(() => this.scene.returnAndFuse(), 2100);
          }
        }
        break;

      case "membrane":
        if (ev.agent === "InjectionHunter") {
          this.membraneEntered = true;
          if (ev.level === "block") {
            const excerpt = ev.meta && typeof ev.meta.excerpt === "string" ? ev.meta.excerpt : undefined;
            this.enqueue(() => this.scene.quarantine(excerpt), 2700);
          } else {
            this.enqueue(() => this.scene.cleanMembrane(), 1300);
          }
        } else if (ev.agent === "Sanitizer") {
          if (!this.membraneEntered) {
            this.membraneEntered = true;
            this.enqueue(() => this.scene.cleanMembrane(), 1300);
          }
          const m = ev.msg.match(/(\d+)\s*redaction/i);
          const n = m ? Number(m[1]) : 0;
          this.enqueue(() => this.scene.sanitize(n), 1000);
        } else if (ev.agent === "Judge") {
          this.enqueue(() => this.scene.sign(), 1500);
        }
        break;

      case "audit":
        this.enqueue(() => this.scene.buildChain(), 1800);
        break;

      case "memory":
        // The warm-start recall: light up the learned route before the scouts deploy.
        if (ev.level === "action" && ev.meta && Array.isArray(ev.meta.route)) {
          const route = (ev.meta.route as unknown[]).filter((s): s is string => typeof s === "string");
          this.enqueue(() => this.scene.recallRoute(route), 1500);
        }
        break;
    }
  }
}
