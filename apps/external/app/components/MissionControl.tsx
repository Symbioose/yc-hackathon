"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Application } from "pixi.js";
import type { TraceEvent } from "@altai/contracts";
import { Scene } from "@/lib/scene/engine";
import { Choreographer } from "@/lib/scene/choreography";
import { sfx } from "@/lib/scene/sfx";
import { C } from "@/lib/scene/palette";

export interface MissionControlHandle {
  tamper(): void;
  unlockAudio(): void;
}

interface Props {
  events: TraceEvent[];
  muted: boolean;
}

const MissionControl = forwardRef<MissionControlHandle, Props>(function MissionControl({ events, muted }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const choreoRef = useRef<Choreographer | null>(null);
  const processed = useRef(0);
  const eventsRef = useRef<TraceEvent[]>(events);
  const readyRef = useRef(false);

  eventsRef.current = events;

  const flush = () => {
    const ch = choreoRef.current;
    if (!ch || !readyRef.current) return;
    const all = eventsRef.current;
    while (processed.current < all.length) {
      ch.handle(all[processed.current]);
      processed.current += 1;
    }
  };

  useImperativeHandle(ref, () => ({
    tamper: () => sceneRef.current?.tamper(),
    unlockAudio: () => sfx.unlock(),
  }));

  // mount Pixi once
  useEffect(() => {
    let cancelled = false;
    let app: Application | null = null;
    const host = hostRef.current;
    if (!host) return;

    (async () => {
      const application = new Application();
      await application.init({
        resizeTo: host,
        background: C.bg,
        antialias: false,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        preference: "webgl",
      });
      if (cancelled) {
        application.destroy(true, { children: true });
        return;
      }
      app = application;
      host.appendChild(application.canvas);
      application.canvas.style.width = "100%";
      application.canvas.style.height = "100%";
      try {
        await document.fonts.load('10px "Press Start 2P"');
      } catch {
        /* font optional */
      }
      if (cancelled) {
        application.destroy(true, { children: true });
        return;
      }
      const scene = new Scene(application);
      sceneRef.current = scene;
      choreoRef.current = new Choreographer(scene);
      readyRef.current = true;
      flush(); // replay anything that arrived before we were ready
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      choreoRef.current = null;
      processed.current = 0;
      app?.destroy(true, { children: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // feed new events
  useEffect(() => {
    flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  useEffect(() => {
    sfx.setMuted(muted);
  }, [muted]);

  return <div ref={hostRef} style={{ position: "absolute", inset: 0 }} className="scanlines" />;
});

export default MissionControl;
