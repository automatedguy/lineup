# WebNavigator Service — Code Review

**Date:** 2026-04-11
**Scope:** `src/services/web-navigator.ts`, `src/index.ts`

---

## Bugs

**1. ~~Race condition on `init()`~~** (FIXED 2026-04-11) — If two callers invoke `init()` concurrently, both pass the `if (this.stagehand) return` guard before either assigns the field. Two Stagehand instances get created; one is leaked along with its browser process. **Fix:** promise lock via `initPromise` field — concurrent callers await the same promise; `close()` resets it.

```typescript
// Both callers reach here simultaneously, both see null
if (this.stagehand) return;
this.stagehand = new Stagehand({...}); // caller A
// caller B also creates one, overwrites A's reference
```

**2. ~~Stale reference after browser crash~~** (FIXED 2026-04-11) — If the Chromium process dies unexpectedly (OOM, kill, etc.), `this.stagehand` remains non-null. All subsequent calls throw from Stagehand internals with cryptic errors, and `init()` silently returns thinking everything is fine. **Fix:** `close()` uses try/finally to always reset state; `withBrowserGuard()` wraps all public methods to detect browser death, reset state, and throw a clear error so `init()` can restart.

**3. ~~`getPage()` always takes index `[0]`~~** (FIXED 2026-04-14) — If an `act()` instruction opens a new tab or popup, the relevant page moves to a different index. `pages()[0]` still returns the original (now-stale) page, so subsequent actions operate on the wrong page. **Fix:** replaced `stagehand.context.pages()[0]` with `stagehand.context.activePage()`, which returns the most-recently active page.

---

## Improvement Opportunities

**4. Stagehand types not re-exported** — Consumers like WebExecutor need `ActResult` and `Action` but would have to import them directly from `@browserbasehq/stagehand`. These should be re-exported from `index.ts` so the rest of the codebase depends only on your boundary.

**5. Model is hardcoded** — `'groq/meta-llama/llama-4-scout-17b-16e-instruct'` is a string literal. If Groq deprecates it or you want to experiment with a different model, it requires a code change. It belongs in `WebNavigatorConfig`.

**6. `screenshot()` hardcodes `fullPage: false`** — Not configurable per-call. Some test scenarios (long scrollable pages) will need full-page captures.

**7. `getNetworkActivity()` limitations are invisible to callers:**
   - `transferSize` is `0` for cross-origin requests without `Timing-Allow-Origin` header
   - No HTTP method, status code, or response headers
   - The browser's resource timing buffer has a default cap (~250 entries), after which entries are silently dropped
   - Only captures completed requests, not in-flight ones

**8. `extract()` leaks `cacheStatus`** — The cast hides `cacheStatus` at the type level, but it's still present at runtime. If a consumer spreads or serializes the result, the extra field appears.

**9. `dotenv/config` in barrel export** — Loading dotenv as a side-effect in `index.ts` is fragile. Anyone who imports `WebNavigator` from `./services/web-navigator.js` directly (e.g., tests) bypasses it.

---

## Risks

**10. Groq free-tier rate limits** — Groq imposes ~30 RPM on free-tier models. A test plan with many steps calls `act()` per step with no retry/backoff. A moderately sized test plan will hit 429s and fail mid-execution.

**11. Process leak on unclean shutdown** — If the Node.js process exits without calling `close()` (uncaught exception, SIGKILL, etc.), the spawned Chromium process is orphaned. No `process.on('exit')` or `process.on('SIGINT')` cleanup is registered.

**12. No input validation** — `navigate()` accepts any string, including non-URLs. `act()` accepts arbitrarily long strings. Both will surface as cryptic Playwright/LLM errors rather than clear validation messages.

**13. `GROQ_API_KEY` in Stagehand config** — The key is passed in the config object. If Stagehand logs its initialization config at any verbosity level, the key could appear in stdout/log files.

**14. Design change** - WebDescriber will be in charge of requesting screenshots to WebNavigator service. WebDescriber will receive a "Description request", perform a take screenshot call via WebNavigator Service, receive the screenshot and then perform visual description using the perspective of a senior web application tester documenting a page for scripting test scenarios.

## Refactors:

**15. Orchestrator design (LINEUP-13)** — The Orchestrator is not an agent — it is plain TypeScript code that wires the 5-agent deterministic pipeline. It owns the WebNavigator lifecycle (init/close), instantiates all agents with the shared WebNavigator via DI, and chains their outputs sequentially: `ExplorationPlan → WebExplorer → DescriptionRequest → WebDescriber → PageDescription → WebPlanner → TestPlan → WebExecutor → TestLog → Reporter → TestReport`. Blocked by LINEUP-7, 8, 9, 10.

**16. Review coding standards (LINEUP-15)** — Review and establish coding standards across the codebase. Task priority: Medium.

---

## Summary

The core design is clean and the service works. The critical items are **#1** (init race — a simple promise lock fixes it), **#10** (rate limits — will bite during real test execution), and **#11** (orphaned browsers). The rest are hardening items to address as the pipeline matures.
