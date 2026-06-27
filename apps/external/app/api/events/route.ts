import { bus, getLastMemoryReport } from "@/lib/missionStore";

export const dynamic = "force-dynamic";

export function GET() {
  const encoder = new TextEncoder();
  let onTrace: (ev: unknown) => void;
  let onSignal: (s: unknown) => void;
  let onMemory: (r: unknown) => void;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
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
    },
    cancel() {
      bus.off("trace", onTrace);
      bus.off("signal", onSignal);
      bus.off("memory", onMemory);
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
