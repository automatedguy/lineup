# Lineup v1.0 — Technical Architecture Discussion

**Date:** 2026-04-04  
**Participants:** Gabriel Cespedes, Claude (AI Assistant)  
**Status:** Architecture decisions in progress

---

## 1. Project Overview

**Lineup** is a multi-agent UI testing automation desktop application, initially targeting Mac. The product will be commercialized and marketed via LinkedIn.

**v1.0 Scope:** Three agents (WebExplorer, WebExecutor, Reporter) with a pre-defined orchestration flow: `explore → execute → report`.

---

## 2. POC Technical Assessment

Four proof-of-concept implementations were analyzed:

### 2.1 lineup-poc (Python)
- **Stack:** Python 3.11+, async, Playwright, Ollama (llama3.1:8b)
- **Agents:** Explorer (BFS crawler), Generator (LLM test authoring), Executor (Playwright actions), Reporter (self-contained HTML)
- **Strengths:** Most complete POC, clean interface-driven architecture, excellent async patterns, production-quality HTML reports, full type hints with Pydantic
- **Weaknesses:** Sequential execution only, Ollama hard dependency, no unit tests, LLM JSON parsing is brittle
- **Lines of code:** ~1,559

### 2.2 lineup-poc-v2 (Python)
- **Stack:** Python 3.12, Playwright via MCP protocol, Ollama (qwen3-vl:8b vision model)
- **Agents:** Explorer (vision-based page analysis), Designer (test case generation)
- **Strengths:** Novel vision LLM for page analysis, MCP protocol adoption, robust multi-tier JSON parsing, clean async design
- **Weaknesses:** Only 2 agents (no executor/reporter), no error handling in critical paths, hard-coded models, synchronous LLM calls block event loop
- **Notable:** Uses Model Context Protocol (MCP) to wrap Playwright as a tool server

### 2.3 lineup-stagehand-poc (TypeScript) ⭐ Best Architecture
- **Stack:** TypeScript 5.5, Stagehand v3.0, Ollama + Cloud LLMs, Zod schemas
- **Agents:** Explorer (.extract() for element discovery + vision), Generator (structured test case creation), Executor (.act() for natural language actions), Analyzer (bug deduplication)
- **Strengths:** Best agent architecture, full TypeScript + Zod type safety, natural language test steps (no selectors), multi-model support, graceful degradation
- **Weaknesses:** Session-less (can't test auth flows), non-deterministic, JSON-only reporting, hardcoded timeouts
- **Key Innovation:** Stagehand's `.act()` eliminates CSS selector maintenance; `.extract()` provides structured data with schema validation

### 2.4 stagehand-test (TypeScript)
- **Stack:** TypeScript, Stagehand v3.2, Google Gemini, Gherkin BDD
- **Agents:** Monolithic (parser + executor + reporter in one)
- **Strengths:** Hybrid AI-symbolic execution (pattern-match known steps, AI fallback for unknown), BDD-readable tests, vision-based assertions
- **Weaknesses:** Committed API keys in .env (!), fail-fast with no recovery, regex-based pattern matching is brittle, no screenshots on failure
- **Interesting:** Gherkin as bridge between non-technical QA and technical implementation

---

## 3. Key Technical Decisions

### 3.1 Language: TypeScript ✅

**Decision:** TypeScript over Python.

**Rationale:**
- Python Stagehand SDK requires Browserbase cloud (dealbreaker for a desktop app — users would need a separate cloud subscription)
- TypeScript Stagehand supports local Chromium via Playwright (zero cloud dependency)
- TypeScript SDK is the original/most mature implementation
- Already proven in two POCs (lineup-stagehand-poc, stagehand-test)

### 3.2 Browser Interaction Library: Stagehand ✅

**Decision:** Stagehand v3.2 (local mode) built on Playwright.

**Rationale:**
- `.act(instruction)` — natural language actions, no CSS selectors to maintain, self-healing
- `.extract(prompt, zodSchema)` — structured data extraction with type safety
- `.observe()` — page state analysis and interactive element identification
- Access to raw Playwright APIs when needed
- Multi-model support (Ollama local, OpenAI, Anthropic, Google)

**Risks & Mitigations:**
| Risk | Impact | Mitigation |
|------|--------|------------|
| Non-determinism | High | Retry logic + screenshot evidence |
| LLM cost per run | Medium | Local Ollama default, cloud optional |
| Session/auth handling | High | Cookie injection layer |
| Stagehand breaking changes | Medium | Pin version, abstract behind interface |
| Slow execution | Medium | Parallel page exploration, caching |

### 3.3 Orchestration: Pre-defined for v1.0 ✅

**Decision:** Deterministic pipeline (explore → execute → report) for v1.0, with interfaces designed to support AI-driven orchestration in v2.0.

**Rationale:**
- Stagehand already introduces non-determinism at the action level (`.act()`, `.extract()`). Adding AI at orchestration level would stack two layers of unpredictability
- Pre-defined flow is predictable, debuggable, and easier to sell to enterprise buyers
- Clean agent interfaces (`Agent<TInput, TOutput>`) allow swapping in an AI orchestrator later without rewriting agents

**Architecture:**
```
v1.0: Deterministic Pipeline
┌──────────┐    ┌──────────┐    ┌──────────┐
│ WebExplorer   │───▶│ WebExecutor   │───▶│ Reporter │
└───────────────┘    └───────────────┘    └──────────┘

v2.0 (future): AI Orchestrator
              ┌──────────────┐
              │ Orchestrator │
              └──────┬───────┘
         ┌───────────┼───────────┐
         ▼           ▼           ▼
┌───────────────┐ ┌───────────────┐ ┌──────────┐
│ WebExplorer   │ │ WebExecutor   │ │ Reporter │
└───────────────┘ └───────────────┘ └──────────┘
```

---

## 4. Agent Design (v1.0)

### WebExplorer Agent
- **Purpose:** Discover web app structure — pages, routes, interactive elements
- **Stagehand APIs:** `.extract()` for structured element discovery, optional vision analysis via screenshots
- **Output:** AppMap (structured inventory of routes, pages, elements, forms, network calls)

### WebExecutor Agent
- **Purpose:** Execute test actions against discovered web elements
- **Stagehand APIs:** `.act()` for natural language browser actions, `.extract()` for assertion verification
- **Output:** TestResults (pass/fail per test case, screenshots, step timings, error details)

### Reporter Agent
- **Purpose:** Synthesize results into human-readable report
- **Output:** Self-contained HTML report with embedded screenshots, metrics, and severity classification
- **Inspiration:** HTML report pattern from lineup-poc (inline CSS, base64 screenshots, responsive grid)

### Interface Pattern
```typescript
interface Agent<TInput, TOutput> {
  name: string;
  run(input: TInput): Promise<TOutput>;
}
```

---

## 5. Next Steps

- [ ] Define detailed agent interfaces and data contracts (AppMap, TestCase, TestResult, Report schemas)
- [ ] Set up v1.0 project structure in `/lineup`
- [ ] Implement WebExplorer agent (carry from lineup-stagehand-poc)
- [ ] Implement WebExecutor agent
- [ ] Implement Reporter agent (carry HTML template from lineup-poc)
- [ ] Wire orchestration pipeline
- [ ] Add configuration management (env + CLI)

---

## 6. References

- **Stagehand docs:** https://docs.stagehand.dev
- **Stagehand GitHub:** https://github.com/browserbase/stagehand
- **POC repos:** lineup-poc, lineup-poc-v2, lineup-stagehand-poc, stagehand-test (all in ~/projects/)
- **Confluence folder:** https://lineupautomation.atlassian.net/wiki/spaces/~557058e9cceeb6db1943b7832f4a5ce8346321/folder/950273
