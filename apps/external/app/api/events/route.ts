import { bus, getLastMemoryReport } from "@/lib/missionStore";

export const dynamic = "force-dynamic";

export function GET() {
  const encoder = new TextEncoder();
  let onTrace: (ev: unknown) => void = () => {};
  let onSignal: (s: unknown) => void = () => {};
  let onMemory: (r: unknown) => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  // Hoisted so cancel() can tear down the same listeners start() registered.
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        bus.off("trace", onTrace);
        bus.off("signal", onSignal);
        bus.off("memory", onMemory);
      };
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup(); // client went away — stop listening so we don't enqueue to a dead stream
        }
      };

      send("ready", { ok: true });
      // Replay the latest Intelligence Network snapshot so a fresh client immediately
      // sees the trained network, not an empty panel.
      const last = getLastMemoryReport();
      if (last) send("memory", last);

      onTrace = (ev) => send("trace", ev);
      onSignal = (s) => send("signal", s);
      onMemory = (r) => send("memory", r);
      bus.on("trace", onTrace);
      bus.on("signal", onSignal);
      bus.on("memory", onMemory);

      // Keep the connection alive through proxies/timeouts (comment frames are ignored by EventSource).
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
        }
      }, 15000);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
