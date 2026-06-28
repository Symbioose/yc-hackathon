import { bus } from "@/lib/missionStore";

export const dynamic = "force-dynamic";

export function GET() {
  const encoder = new TextEncoder();
  let onTrace: (ev: unknown) => void = () => {};
  let onSignal: (s: unknown) => void = () => {};
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

      onTrace = (ev) => send("trace", ev);
      onSignal = (s) => send("signal", s);
      bus.on("trace", onTrace);
      bus.on("signal", onSignal);

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
