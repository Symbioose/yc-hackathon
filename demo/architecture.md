# Altai — global architecture

A sealed agent dispatches a mission through one audited door; an isolated fleet acts on the
outside; a cryptographically signed brief crosses back into the air-gap. The firm never
touches the wire.

```mermaid
flowchart TB
  subgraph SEALED["🔒 SEALED ENVIRONMENT · no route to the internet"]
    direction TB
    AGENT["Meridian Copilot · internal agent<br/>holds NO keys · cannot browse · only egress = altai_research"]
    VERIFY["✓ Verify brief OFFLINE — Ed25519 vs embedded public key"]
  end

  MCP["MCP adapter · research-mcp — forwards every call to the gateway"]

  subgraph GW["🛰️ ALTAI GATEWAY · the one audited door"]
    direction TB
    L1["1 · Dispatch — sole ingress · Mission contract"]
    L2["2 · Policy — scope · allow/deny · spend cap → 403"]
    L3["3 · Identity isolation — client identity / IP / query stripped"]
    L4["4 · Execution — Planner → Web · Tor · Breach scouts → Analyst (cited)"]
    L5["5 · Membrane — Injection Hunter · Sanitizer · Judge"]
    L6["6 · Audit — Merkle ledger + Ed25519 signature"]
    PROXY["on-prem LLM proxy · API key never leaves the gateway"]
    L1 --> L2 --> L3 --> L4 --> L5 --> L6
  end

  subgraph OUT["🌐 OUTSIDE WORLD · internet + Tor"]
    direction TB
    WEB["Open + firewall-blocked web"]
    TOR["Tor SOCKS5 → .onion · dark web"]
    BREACH["Breach APIs · HIBP / IntelX"]
    WEB ~~~ TOR ~~~ BREACH
  end

  DNA[("Search DNA · learning store (roadmap)<br/>records the winning route → reused · cheaper")]

  AGENT -->|"dispatch · the only hole in the wall"| MCP
  MCP --> L1
  L4 --> OUT
  L6 ==>|"SignedBrief · signed · sourced"| VERIFY
  AGENT -. "LLM · key stays in gateway" .-> PROXY
  DNA -. "reuse route" .-> L4
  L6 -. "record route" .-> DNA

  classDef sealed fill:#13203a,stroke:#33425f,color:#cdd9f2;
  classDef gw fill:#0a1322,stroke:#38d0ff,color:#cdd9f2;
  classDef out fill:#140e26,stroke:#b596ff,color:#cdd9f2;
  classDef mcp fill:#0a1322,stroke:#54e8a0,color:#cdd9f2;
  classDef proxy fill:#1a1530,stroke:#ffc857,color:#f0e6cf;
  classDef dna fill:#0e1c14,stroke:#54e8a0,color:#cfeede,stroke-dasharray:5 4;
  class AGENT,VERIFY sealed
  class L1,L2,L3,L4,L5,L6 gw
  class WEB,TOR,BREACH out
  class MCP mcp
  class PROXY proxy
  class DNA dna
```

## Security model — defense in depth (not a proxy)

```mermaid
flowchart TB
  A["🧱 Network air-gap — no route to the internet"]
  B["🚪 Single governed egress — dispatch is the only hole"]
  C["🛡️ Policy at ingress — scope · allowlist · spend · 403"]
  D["🥷 Identity isolation — the firm is never on the wire"]
  E["🧬 Adversarial membrane — de-inject · sanitize before signing"]
  F["✍️ Signed provenance — Ed25519 + Merkle · verifiable offline"]
  G["🔑 Key custody — keys only on the gateway"]
  A --> B --> C --> D --> E --> F --> G
  classDef s fill:#0a1322,stroke:#38d0ff,color:#cdd9f2;
  class A,B,C,D,E,F,G s;
```
