# LineUp Multi-Agent System Design

# Architecture Decision — 5-Agent Pipeline & WebNavigator

**Date:** 2026-04-09  
**Participants:** Gabriel Cespedes, Claude (AI Assistant)  
**Status:** Decision made  
**Last updated:** 2026-04-10  

---

## Context

### The 5-Agent Architecture

```
WebNavigator → WebDescriber → WebPlanner → WebExecutor → Reporter
```

### WebNavigator *(Stagehand wrapper with Groq API free tier — Cloud)*

| Aspect | Detail |
|--------|--------|
| **Input** | Navigation steps in natural language |
| **Actions** | Open URLs, navigate, interact with page elements, take snapshots, capture DOM, capture Network traffic via Stagehand APIs |
| **Output** | Page screenshot (`PageScreenshot`) if required. |

### WebDescriber *(Ollama Qwen3-VL:8b — Local)*

| Aspect | Detail |
|--------|--------|
| **Input** | `PageScreenshot` |
| **Actions** | Perform visual analysis and create a detailed description in natural language from the perspective of a web application testing expert |
| **Output** | Page description in natural language (`PageDescription`) |

### WebPlanner *(Ollama Qwen3:8b — Local)*

| Aspect | Detail |
|--------|--------|
| **Input** | `PageDescription` |
| **Actions** | Create a test plan strategy from the perspective of a web application testing expert |
| **Output** | Test plan in natural language (`TestPlan`) |

### WebExecutor *(WebNavigator APIs)*

| Aspect | Detail |
|--------|--------|
| **Input** | `TestPlan` |
| **Actions** | Execute test steps, validations and assertions through WebNavigator agent API |
| **Output** | Tests trace, logs and assertions results (`TestLog`) |

### Reporter

| Aspect | Detail |
|--------|--------|
| **Input** | `TestLog` |
| **Actions** | Create HTML report |
| **Output** | `TestReport` |

---

## Pipeline

```
WebNavigator ──▶ WebDescriber ──▶ WebPlanner ──▶ WebExecutor ──▶ Reporter
  (browser)        (eyes)          (brain)        (hands)        (writer)
```

### Product Differentiator

**Zero selectors end to end.** Vision in, natural language plan out, natural language execution. A manual tester LOOKS at the page, not at the DOM — Lineup does the same.

---

## Agent Responsibilities (Detailed)

### WebNavigator — the browser

A wrapper around [Stagehand v3.2](https://github.com/browserbase/stagehand). All browser interaction flows through this single agent. Other agents never touch Stagehand directly.

**Scope:** Browser lifecycle, navigation, screenshots, DOM snapshots, network capture, and Stagehand's act/extract/observe APIs.

| Capability | Stagehand API | Description |
|-----------|---------------|-------------|
| Navigate | `page.goto(url)` | Go to a URL |
| Act | `stagehand.act(instruction)` | Natural language browser action |
| Extract | `stagehand.extract(prompt, schema)` | Structured data extraction with Zod |
| Observe | `stagehand.observe(instruction)` | Discover actionable elements |
| Screenshot | `page.screenshot()` | Capture page as PNG buffer |
| DOM Snapshot | `page.evaluate()` | Capture full HTML document |
| Network Capture | `page.on("request"/"response")` | Record network activity |
| Lifecycle | `stagehand.init()` / `stagehand.close()` | Browser session management |

### WebDescriber — the eyes

Receives a page screenshot from WebNavigator. Performs visual analysis via the vision model. Produces a `PageDescription`.

**Scope:** One screenshot in, one PageDescription out. No navigation, no planning.  
**Vision model:** Qwen3-VL:8b (local via Ollama)

**Output:** `PageDescription`

### WebPlanner — the brain

Receives `PageDescription` and thinks like a QA tester. Generates test scenarios in natural language.

**Model:** Qwen3:8b (text-only, local via Ollama)

**Output:** `TestPlan`

### WebExecutor — the hands

Takes the TestPlan, executes each scenario step by step using WebNavigator's `act()` with natural language instructions. No selectors.

**Output:** `TestLog`

### Reporter — the writer

Receives TestLog, generates a self-contained HTML report with embedded screenshots, metrics, and severity classification. Platform-agnostic.

**Output:** `TestReport`

---

## Separation of Concerns

| Agent | Responsibility | Uses | Does NOT do |
|-------|---------------|------|-------------|
| **WebNavigator** | Browser interaction | Stagehand v3.2 (all APIs) | Analysis, planning, reporting |
| **WebDescriber** | See and describe | Qwen3-VL (vision model) | Planning, navigation, test execution |
| **WebPlanner** | Think and plan | Qwen3 (text LLM) | Browser interaction |
| **WebExecutor** | Act and verify | WebNavigator's act() | Planning, page analysis |
| **Reporter** | Summarize | Template engine | Browser interaction, planning |

---

## Why WebNavigator?

The previous 4-agent design had Stagehand calls scattered across WebDescriber and WebExecutor. Adding WebNavigator as a dedicated wrapper provides:

- **Single point of coupling** — If Stagehand releases breaking changes, only WebNavigator needs updating
- **Testability** — Other agents can be tested with a mock WebNavigator, no real browser needed
- **Shared browser session** — WebNavigator manages one Stagehand instance; all agents share cookies, state, and context
- **Swappability** — Could replace Stagehand with Playwright, Puppeteer, or any other tool without touching agent logic

---

## Why This Matters

Traditional testing tools (Selenium, Cypress, Playwright) require selectors — CSS, XPath, test IDs. They break when the UI changes. They require developer involvement to maintain.

Lineup's approach:

1. **Navigate** to the page (WebNavigator)
2. **See** the page like a human (vision model via WebDescriber)
3. **Plan** tests like a QA tester (natural language via WebPlanner)
4. **Execute** tests like a human (natural language actions via WebExecutor)
5. **Report** results in plain English (Reporter)

No selectors. No code. No maintenance when the UI changes.

---

## Interface Pattern

```typescript
interface Agent<TInput, TOutput> {
  name: string;
  run(input: TInput): Promise<TOutput>;
}

// WebNavigator is a shared service, not a pipeline agent.
// Other agents receive it via dependency injection.
interface WebNavigator {
  // Lifecycle
  init(): Promise<void>;
  close(): Promise<void>;

  // Navigation
  navigate(url: string): Promise<void>;

  // Stagehand core APIs
  act(instruction: string): Promise<ActResult>;
  extract<T>(instruction: string, schema: ZodSchema<T>): Promise<T>;
  observe(instruction: string): Promise<ObserveResult[]>;

  // Page capture
  screenshot(): Promise<Buffer>;
  getHtmlSnapshot(): Promise<string>;
  getNetworkActivity(): Promise<NetworkEntry[]>;
}
```

---

## Integrations

- **Jira** — Automatic bug ticket creation from scan results (severity → priority mapping, screenshot attachments)
- **Confluence** — Architecture documentation and decision records

---

## References

- [Stagehand docs](https://docs.stagehand.dev)
- [Stagehand GitHub](https://github.com/browserbase/stagehand)
- Previous decision: Architecture Decision — 4-Agent Pipeline (2026-04-07)
