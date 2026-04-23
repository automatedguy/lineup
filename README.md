# Lineup

Autonomous UI testing automation. Point it at a URL, and it explores the page, plans test scenarios, executes them, and produces a self-contained HTML report — no CSS selectors, no hand-written test scripts.

Lineup works the way a manual tester does: it **looks** at the page, reasons about what to test, and drives the browser with natural-language actions.

## How it works

A deterministic five-agent pipeline coordinated by a single shared browser service:

```
                  ┌──────────────┐
                  │ WebNavigator │  (service — browser access)
                  └──────┬───────┘
                         │ consumed by
            ┌────────────┼────────────┐
            ▼            ▼            ▼
       WebExplorer  WebDescriber  WebExecutor
         (feet)       (eyes)       (hands)
            │            │            ▲
            └──▶ describe ──▶ plan ──▶┘──▶ Reporter
                                           (writer)
```

| Agent | Role | Model |
|-------|------|-------|
| **WebNavigator** | Shared service — wraps Stagehand for `navigate`, `act`, `extract`, `observe`, `screenshot` | Llama 4 Scout (Groq) |
| **WebExplorer** | Navigates to the target URL and runs pre-navigation actions (login, cookies) | — |
| **WebDescriber** | Screenshots the page and produces a visual description from a QA tester's perspective | Qwen3-VL:8b (Ollama) |
| **WebPlanner** | Generates test scenarios from the visual description | Qwen3:8b (Ollama) |
| **WebExecutor** | Runs each scenario step, captures screenshots, verifies assertions | — |
| **Reporter** | Emits a self-contained HTML report with embedded screenshots and severity | — |

## Design principles

- **Zero selectors.** No CSS or XPath in the test pipeline — only vision and natural language.
- **Mostly local.** Only the WebNavigator calls a cloud LLM (Groq free tier). Description and planning run locally via Ollama.
- **Self-contained reports.** Embedded base64 images and inline CSS — open offline, share by file.
- **Typed agent boundaries.** Every agent implements `Agent<TInput, TOutput>` with Zod-validated outputs.

## Requirements

- Node.js `^20.19.0 || >=22.12.0` (see `.nvmrc`)
- [Ollama](https://ollama.com) running locally with the models pulled:
  ```bash
  ollama pull qwen3-vl:8b
  ollama pull qwen3:8b
  ```
- A Groq API key (free tier is sufficient)

## Setup

```bash
npm install
cp .env.example .env   # then fill in the values below
```

`.env`:

```
GROQ_API_KEY=...
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=...
```

## Usage

### Run the full pipeline

```typescript
import { Orchestrator } from 'lineup';

const orchestrator = new Orchestrator({ headless: false });
const report = await orchestrator.run({ url: 'https://example.com' });

// report.html is a self-contained HTML document
```

### Run a single agent in isolation

Each agent has a standalone runner under `src/test-*.ts`:

```bash
./runtest.sh explorer     # WebExplorer
./runtest.sh describer    # WebDescriber
./runtest.sh planner      # WebPlanner
./runtest.sh executor     # WebExecutor
./runtest.sh navigator    # WebNavigator service
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run dev` | Run `src/index.ts` with tsx |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run format` / `npm run format:check` | Prettier |

## Project layout

```
src/
├── agents/           # WebExplorer, WebDescriber, WebPlanner, WebExecutor, Reporter, BaseAgent
├── services/         # WebNavigator (Stagehand wrapper), OllamaClient
├── types/            # Agent interface + data models (ExplorationPlan, PageDescription, TestPlan, …)
├── orchestrator.ts   # Deterministic pipeline coordinator
├── test-*.ts         # Standalone runners for each agent
└── index.ts          # Public exports
docs/                 # System design and integration notes
reports/              # Generated HTML reports
```

## Integrations

- **Jira** — create bug tickets from failed scenarios, attach screenshots, map severity to priority.
- **Confluence** — architecture documentation.

## Further reading

- [`CLAUDE.md`](./CLAUDE.md) — architectural constraints and agent responsibilities
- [`docs/system-design.md`](./docs/system-design.md) — detailed system design
- [Stagehand](https://docs.stagehand.dev) — the browser-automation library behind WebNavigator

## Status

v0.1.0 — early development. v1.0 scope is the five-agent deterministic pipeline described above; v2.0 will explore AI-driven orchestration on top of the same agent interfaces.
