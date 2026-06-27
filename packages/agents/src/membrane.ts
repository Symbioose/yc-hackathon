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

// --- Sanitizer: strip PII / secrets from anything that would cross the wall ---
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const SECRET = /\b(sk-[a-z0-9]{8,}|AKIA[0-9A-Z]{12,}|ghp_[a-z0-9]{20,})\b/gi;

export interface SanitizeResult {
  signal: Signal;
  redactions: number;
}

export function sanitize(signal: Signal): SanitizeResult {
  let redactions = 0;
  const redact = (s: string) =>
    s
      .replace(EMAIL, () => {
        redactions++;
        return "[REDACTED_EMAIL]";
      })
      .replace(SECRET, () => {
        redactions++;
        return "[REDACTED_SECRET]";
      });
  const summary = redact(signal.summary);
  const sources = signal.sources.map((src) => (src.url ? { ...src, url: redact(src.url) } : src));
  return { signal: { ...signal, summary, sources }, redactions };
}
