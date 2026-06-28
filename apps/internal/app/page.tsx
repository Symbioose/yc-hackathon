"use client";
import { useEffect, useRef, useState } from "react";
import type { AuditEntry, SignedBrief, SourceContribution } from "@altai/contracts";

// ---- types ----------------------------------------------------------------
interface Research {
  mission_id?: string;
  status: "completed" | "blocked" | "timeout" | "error" | string;
  blocked_reason?: string;
  error?: string;
  brief?: SignedBrief;
  audit?: { entries: AuditEntry[]; signature_valid: boolean; ledger_ok: boolean };
}
interface ToolInput { query?: string; entity?: string; ticker?: string }
interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  text: string;
  pending?: boolean;
  error?: boolean;
  synthetic?: boolean;
  toolInput?: ToolInput | null;
  research?: Research | null;
}

// ---- desk widgets (no live prices — coverage only) ------------------------
const WATCHLIST = [
  { name: "Live Nation Ent.", ticker: "LYV", sector: "Live Events" },
  { name: "Okta", ticker: "OKTA", sector: "Identity / SaaS" },
  { name: "Snowflake", ticker: "SNOW", sector: "Data Cloud" },
  { name: "AT&T", ticker: "T", sector: "Telecom" },
  { name: "Progress Software", ticker: "PRGS", sector: "Enterprise SW" },
];
const EXAMPLES = [
  "Has Ticketmaster been breached and is the data on the dark web?",
  "Is Snowflake customer data being sold on the dark web?",
  "Who is the CEO of OpenAI?",
];
const WELCOME: ChatMsg = {
  id: "welcome",
  role: "assistant",
  synthetic: true,
  text:
    "Meridian Copilot online. I answer with cited, signed intelligence pulled through Altai's research gateway — the open web and, for security questions, the dark web. Ask me about a company, a breach, or anything outside this desk.",
};

const STAGES = [
  "Routing to Meridian Copilot…",
  "Dispatching mission to Altai gateway…",
  "Searching open web + dark web (Tor)…",
  "Sanitizing, sealing & signing the brief…",
];

// ---- helpers --------------------------------------------------------------
function srcMeta(type: SourceContribution["type"]): { label: string; color: string } {
  switch (type) {
    case "tor_forum": return { label: ".ONION", color: "var(--violet)" };
    case "breach_api": return { label: "BREACH", color: "var(--red)" };
    case "paste": return { label: "PASTE", color: "var(--amber)" };
    case "filing": return { label: "FILING", color: "var(--cyan)" };
    default: return { label: "WEB", color: "var(--dim)" };
  }
}
const isDarkLine = (e: AuditEntry) =>
  /(\.onion|\btor\b|exit ip|exit\s|dark.?web|onion|circuit)/i.test(`${e.actor} ${e.action}`);
const usedDarkWeb = (r?: Research | null) =>
  !!r?.brief?.signal.sources.some((s) => s.type === "tor_forum") ||
  !!r?.audit?.entries.some(isDarkLine);
const uid = () => Math.random().toString(36).slice(2);

/** What an assistant turn contributes to the model's history: its answer PLUS a compact
 * note of the research evidence it was based on, so later follow-ups can reference the
 * earlier findings/sources (real ChatGPT-style continuity) without re-researching. */
function historyContent(m: ChatMsg): string {
  if (m.role !== "assistant" || !m.research) return m.text;
  const s = m.research.brief?.signal;
  if (!s || s.sources.length === 0) return m.text;
  const srcs = s.sources.map((x, i) => `[${i + 1}] ${x.name}`).join(", ");
  return `${m.text}\n[altai_research evidence · ${s.event_type} · ${Math.round(s.confidence * 100)}% · sources: ${srcs}]`;
}

// ---- small components -----------------------------------------------------
function Clock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString("en-GB"));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);
  return <span>{t} UTC{/* local clock, labelled for terminal feel */}</span>;
}

function Citations({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[\d+\]$/.test(p) ? (
          <sup className="cite" key={i}>{p}</sup>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function ToolChip({ toolInput, research }: { toolInput: ToolInput; research?: Research | null }) {
  const dark = usedDarkWeb(research);
  const status =
    research?.status === "completed" ? <span className="ok">✓ signed brief returned</span>
    : research?.status === "blocked" ? <span style={{ color: "var(--red)" }}>blocked by policy</span>
    : research?.status === "timeout" ? <span style={{ color: "var(--amber)" }}>timed out</span>
    : <span style={{ color: "var(--amber)" }}>no brief</span>;
  return (
    <div className="toolchip">
      <span>⚙ tool</span>
      <b>altai_research</b>
      <span className="q">{toolInput.query ? `"${toolInput.query}"` : ""}</span>
      {dark && <span style={{ color: "var(--violet)" }}>🧅 dark-web hop</span>}
      {status}
    </div>
  );
}

function SignedBadge({ audit, brief }: { audit: NonNullable<Research["audit"]>; brief: SignedBrief }) {
  const ok = audit.signature_valid && audit.ledger_ok;
  const fp = (brief.public_key || "").replace(/[^A-Za-z0-9]/g, "").slice(-12);
  if (ok) {
    return (
      <div className="badge ok">
        <span>✓ Signed by Altai · Ed25519</span>
        {fp && <span className="fp">key …{fp}</span>}
      </div>
    );
  }
  return (
    <div className="badge bad">
      ✗ {audit.signature_valid ? "ledger tampered — Merkle root mismatch" : "signature invalid"} — do not trust
    </div>
  );
}

function AuditLog({ entries, missionId }: { entries: AuditEntry[]; missionId?: string }) {
  return (
    <details className="audit">
      <summary>▸ AUDIT LEDGER · {entries.length} ENTRIES{missionId ? ` · ${missionId.slice(0, 8)}` : ""}</summary>
      <div className="audit-list">
        {entries.map((e) => {
          const dark = isDarkLine(e);
          return (
            <div className={`audit-line${dark ? " dark" : ""}`} key={e.seq}>
              <span className="seq">#{String(e.seq).padStart(2, "0")}</span> {dark ? "🧅 " : ""}
              <span className="actor">{e.actor}</span> · {e.action}
            </div>
          );
        })}
      </div>
    </details>
  );
}

function Evidence({ research }: { research: Research }) {
  if (research.status === "blocked") {
    return (
      <div className="callout block">
        <b>⛔ Blocked by Altai policy.</b>
        <div>{research.blocked_reason ?? "Out-of-scope or unsafe mission."}</div>
      </div>
    );
  }
  if (research.status === "timeout") return <div className="callout warn">Research timed out before a brief was sealed.</div>;
  if (research.status !== "completed" || !research.brief) {
    return <div className="callout warn">Research could not complete{research.error ? `: ${research.error}` : ""}.</div>;
  }

  const s = research.brief.signal;
  const { audit } = research;
  return (
    <div className="evidence">
      {s.sources.length > 0 ? (
        <>
          <div className="ev-h">SOURCES · CONFIDENCE {(s.confidence * 100).toFixed(0)}%</div>
          {s.sources.map((src, i) => {
            const m = srcMeta(src.type);
            return (
              <div className="src" key={i}>
                <span className="src-ref">[{i + 1}]</span>
                <span className="tag" style={{ color: m.color }}>{m.label}</span>
                {src.url ? (
                  <a href={src.url} target="_blank" rel="noreferrer">{src.name}</a>
                ) : (
                  <span className="host">{src.name}</span>
                )}
              </div>
            );
          })}
        </>
      ) : (
        <div className="callout muted">
          No corroborating sources — Altai returned an honest <b>inconclusive</b> brief (confidence 0). Nothing was fabricated.
        </div>
      )}
      {audit && <SignedBadge audit={audit} brief={research.brief} />}
      {audit && audit.entries.length > 0 && <AuditLog entries={audit.entries} missionId={research.mission_id} />}
    </div>
  );
}

function PendingBubble() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => Math.min(v + 1, STAGES.length - 1)), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="msg asst fade-up">
      <div style={{ width: "100%" }}>
        <div className="who">MERIDIAN COPILOT</div>
        <div className="bubble asst">
          <div className="pending">
            <span className="ring spin" />
            <span>{STAGES[i]}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Message({ m }: { m: ChatMsg }) {
  if (m.role === "user") {
    return (
      <div className="msg user fade-up">
        <div>
          <div className="who" style={{ textAlign: "right" }}>ANALYST</div>
          <div className="bubble user">{m.text}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="msg asst fade-up">
      <div style={{ width: "100%" }}>
        <div className="who">MERIDIAN COPILOT</div>
        <div className={`bubble asst${m.error ? " err" : ""}`}>
          {m.toolInput && <ToolChip toolInput={m.toolInput} research={m.research} />}
          <div style={{ whiteSpace: "pre-wrap" }}><Citations text={m.text} /></div>
          {m.research && <Evidence research={m.research} />}
        </div>
      </div>
    </div>
  );
}

// ---- main -----------------------------------------------------------------
export default function MeridianTerminal() {
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [missions, setMissions] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput("");

    const userMsg: ChatMsg = { id: uid(), role: "user", text: q };
    const history = [...messages, userMsg]
      .filter((m) => !m.synthetic && !m.pending && m.text)
      .map((m) => ({ role: m.role, content: historyContent(m) }));

    const pendingId = uid();
    setMessages((prev) => [...prev, userMsg, { id: pendingId, role: "assistant", text: "", pending: true }]);

    try {
      const r = await fetch("/bank/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const json = await r.json();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                pending: false,
                text: String(json.text ?? ""),
                toolInput: json.toolInput ?? null,
                research: json.research ?? null,
                error: !!json.error,
              }
            : m,
        ),
      );
      if (json.research) setMissions((c) => c + 1);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId ? { ...m, pending: false, error: true, text: "Network error reaching the copilot." } : m,
        ),
      );
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function fill(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  return (
    <div className="term">
      <header className="topbar">
        <div className="brand">
          <b>MERIDIAN CAPITAL</b>
          <span>RESEARCH TERMINAL</span>
        </div>
        <div className="topbar-right">
          <span className="pill">
            <span className="dot pulse" style={{ background: "var(--green)" }} />
            ALTAI LINK · SECURE
          </span>
          <span style={{ color: "var(--faint)" }}>MISSIONS {String(missions).padStart(2, "0")}</span>
          <Clock />
        </div>
      </header>

      <div className="body">
        {/* ---------- left: sober desk widgets ---------- */}
        <aside className="sidebar">
          <div className="widget">
            <div className="widget-h">WATCHLIST · COVERAGE</div>
            {WATCHLIST.map((w) => (
              <div
                key={w.ticker}
                className="watch-row"
                onClick={() => fill(`Any breach or leaked data on the dark web affecting ${w.name} (${w.ticker})?`)}
              >
                <div>
                  <div className="watch-name">{w.name}</div>
                  <div className="watch-sub">{w.sector}</div>
                </div>
                <span className="ticker">{w.ticker}</span>
              </div>
            ))}
          </div>

          <div className="widget">
            <div className="widget-h">EXAMPLE PROMPTS</div>
            {EXAMPLES.map((ex, i) => (
              <button key={i} className="ex-prompt" onClick={() => send(ex)} disabled={busy}>
                <b>{String(i + 1).padStart(2, "0")}</b>
                {ex}
              </button>
            ))}
          </div>

          <div className="widget">
            <div className="widget-h">EGRESS</div>
            <div className="note">
              Meridian Copilot can&rsquo;t research on its own. External questions are dispatched to{" "}
              <span className="mono">altai_research()</span> — a governed gateway that returns a source-cited,
              <span className="mono"> Ed25519-signed</span> brief.
            </div>
          </div>
        </aside>

        {/* ---------- right: copilot chat ---------- */}
        <section className="chat">
          <div className="chat-scroll" ref={scrollRef}>
            {messages.map((m) => (m.pending ? <PendingBubble key={m.id} /> : <Message key={m.id} m={m} />))}
          </div>

          <div className="composer">
            <div className="composer-row">
              <textarea
                ref={inputRef}
                value={input}
                rows={2}
                placeholder="Ask Meridian Copilot…  (e.g. Has Ticketmaster been breached and is the data on the dark web?)"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <button className="send" onClick={() => send(input)} disabled={busy || !input.trim()}>
                {busy ? "WORKING…" : "SEND ▸"}
              </button>
            </div>
            <div className="hint">Enter to send · Shift+Enter for a new line · answers are cited & cryptographically signed by Altai</div>
          </div>
        </section>
      </div>
    </div>
  );
}
