import { bus } from "@/lib/missionStore";

export const dynamic = "force-dynamic";

export function GET() {
  const encoder = new TextEncoder();
  let onTrace: (ev: unknown) => void;
  let onSignal: (s: unknown) => void;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      send("ready", { ok: true });
      onTrace = (ev) => send("trace", ev);
      onSignal = (s) => send("signal", s);
      bus.on("trace", onTrace);
      bus.on("signal", onSignal);
    },
    cancel() {
      bus.off("trace", onTrace);
      bus.off("signal", onSignal);
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
