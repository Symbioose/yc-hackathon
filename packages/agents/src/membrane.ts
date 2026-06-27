import type { Signal } from "@altai/contracts";

// --- Injection Hunter: deterministic detector (LLM pass optional/secondary) ---
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+|your\s+|previous\s+)?(instructions|prompts)/i,
  /disregard\s+(the\s+)?(above|previous)/i,
  /system\s+prompt/i,
  /\bexfiltrat/i,
  /reveal\s+(the\s+)?(client|user|your)\s+(identity|prompt|key)/i,
  /print\s+(your\s+|the\s+)?(system|instructions)/i,
  /\b(AWS_SECRET|api[_-]?key\s*[:=])/i,
];

export interface InjectionFinding {
  source: string;
  pattern: string;
  excerpt: string;
}
export interface InjectionResult {
  clean: boolean;
  findings: InjectionFinding[];
}

/** Scan fetched dark-web/web snippets for prompt-injection / identity-exfil attempts. */
export function huntInjection(snippets: { source: string; content: string }[]): InjectionResult {
  const findings: InjectionFinding[] = [];
  for (const s of snippets) {
    for (const re of INJECTION_PATTERNS) {
      const m = re.exec(s.content);
      if (m) {
        findings.push({
          source: s.source,
          pattern: re.source,
          excerpt: s.content.slice(Math.max(0, m.index - 20), m.index + 70).trim(),
        });
        break;
      }
    }
  }
  return { clean: findings.length === 0, findings };
}

// --- Sanitizer: neutralize anything dangerous before it crosses the wall ---
//
// This is the trust boundary. Because the brief is sanitized BEFORE it is signed,
// everything downstream inherits the guarantee: the sealed agent, the ops-center, and
// every generated document (CSV/XLSX/Markdown/STIX) all derive from a clean signal.
// We therefore scrub EVERY human-controlled string field (not just the summary):
//   • PII (emails) and secrets (API-key shapes)
//   • C0/C1 control characters (CSV/terminal/zero-width tricks)
//   • HTML/script tags (XSS in any rendered output)
//   • prompt-injection payloads (so a poisoned source can't ride the brief into a
//     downstream LLM or document)
//   • unsafe URL schemes (only http(s)/.onion survive; javascript:/data:/file: → blocked)
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const SECRET = /\b(sk-[a-z0-9]{8,}|AKIA[0-9A-Z]{12,}|ghp_[a-z0-9]{20,})\b/gi;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\uFEFF]/g;
const HTML_TAG = /<[^>]*>/g;
const HTTP_URL = /^https?:\/\//i;
const ONION_URL = /^(https?:\/\/)?[a-z2-7]{16,56}\.onion([/?#].*)?$/i;

export interface SanitizeResult {
  signal: Signal;
  redactions: number;
}

/** Scrub a free-text field. Returns the cleaned string; `bump` counts each neutralization. */
function scrubText(s: string, bump: () => void): string {
  let out = s.replace(CONTROL, " ").replace(HTML_TAG, () => (bump(), ""));
  for (const re of INJECTION_PATTERNS) out = out.replace(new RegExp(re, "gi"), () => (bump(), "[REDACTED_INJECTION]"));
  out = out
    .replace(EMAIL, () => (bump(), "[REDACTED_EMAIL]"))
    .replace(SECRET, () => (bump(), "[REDACTED_SECRET]"));
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Allow only clear-web and .onion URLs through; anything else is replaced. */
function safeUrl(u: string, bump: () => void): string {
  const v = u.replace(CONTROL, "").trim();
  if (HTTP_URL.test(v) || ONION_URL.test(v)) return scrubText(v, bump);
  bump();
  return "[BLOCKED_URL]";
}

export function sanitize(signal: Signal): SanitizeResult {
  let redactions = 0;
  const bump = () => {
    redactions++;
  };
  const clean: Signal = {
    ...signal,
    entity: scrubText(signal.entity, bump),
    event_type: scrubText(signal.event_type, bump),
    summary: scrubText(signal.summary, bump),
    sources: signal.sources.map((src) => ({
      ...src,
      name: scrubText(src.name, bump),
      url: src.url ? safeUrl(src.url, bump) : src.url,
    })),
  };
  return { signal: clean, redactions };
}
