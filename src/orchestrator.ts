import { WebNavigator } from './services/web-navigator.js';
import { OllamaClient } from './services/ollama-client.js';
import type { OllamaClientConfig } from './services/ollama-client.js';
import { WebExplorer } from './agents/web-explorer.js';
import { WebDescriber } from './agents/web-describer.js';
import { WebPlanner } from './agents/web-planner.js';
import { WebExecutor } from './agents/web-executor.js';
import { Reporter } from './agents/reporter.js';
import type { ExplorationPlan } from './types/exploration-plan.js';
import type { TestPlan } from './types/test-plan.js';
import type { TestReport } from './types/test-report.js';

export interface OrchestratorConfig {
  headless?: boolean;
  ollama?: OllamaClientConfig;
}

export class Orchestrator {
  private readonly navigator: WebNavigator;
  private readonly explorer: WebExplorer;
  private readonly describer: WebDescriber;
  private readonly planner: WebPlanner;
  private readonly executor: WebExecutor;
  private readonly reporter: Reporter;

  constructor(config?: OrchestratorConfig) {
    this.navigator = new WebNavigator({ headless: config?.headless });
    const ollama = new OllamaClient(config?.ollama);

    this.explorer = new WebExplorer(this.navigator);
    this.describer = new WebDescriber(this.navigator, ollama);
    this.planner = new WebPlanner(ollama);
    this.executor = new WebExecutor(this.navigator);
    this.reporter = new Reporter();
  }

  async run(explorationPlan: ExplorationPlan): Promise<TestReport> {
    await this.navigator.init();
    try {
      this.log('Starting pipeline...');

      const descriptionRequest = await this.explorer.run(explorationPlan);
      this.log(`ExplorationPlan: ${descriptionRequest.url}`);

      const pageDescription = await this.describer.run(descriptionRequest);
      this.log(`PageDescription: ${pageDescription.url} (${pageDescription.description.length} chars)`);
      this.log(`Description:\n${pageDescription.description}`);

      const rawPlan = await this.planner.run(pageDescription);
      this.log(`TestPlan: ${rawPlan.scenarios.length} scenarios`);

      const testPlan = this.filterHallucinatedAssertions(rawPlan, pageDescription.description);
      for (const scenario of testPlan.scenarios) {
        this.log(`  Scenario: ${scenario.name} (${scenario.steps.length} steps)`);
        for (const step of scenario.steps) {
          this.log(`    [${step.type}] ${step.instruction}`);
        }
      }

      const testLog = await this.executor.run(testPlan);
      this.log(`TestLog: ${testLog.summary.passed}/${testLog.summary.total} passed, ${testLog.summary.failed} failed (${testLog.summary.durationMs}ms)`);

      const report = await this.reporter.run(testLog);
      this.log(`Report: ${report.html.length} chars`);

      this.log('Pipeline complete.');
      return report;
    } finally {
      await this.navigator.close();
    }
  }

  private filterHallucinatedAssertions(plan: TestPlan, description: string): TestPlan {
    const descLower = description.toLowerCase();
    let dropped = 0;

    const scenarios = plan.scenarios
      .map((scenario) => {
        const steps = scenario.steps.filter((step) => {
          if (step.type !== 'assertion') return true;

          // Extract all quoted text from the assertion instruction
          const quotes = step.instruction.match(/"([^"]+)"/g);
          if (!quotes) return true; // no quoted text — keep (state-change assertion)

          // Every quoted string must appear in the page description
          const grounded = quotes.every((q) => {
            const text = q.slice(1, -1).toLowerCase();
            return descLower.includes(text);
          });

          if (!grounded) {
            this.log(`  [filtered] ${step.instruction}`);
            dropped++;
          }
          return grounded;
        });

        return { ...scenario, steps };
      })
      .filter((scenario) => scenario.steps.length > 0);

    if (dropped > 0) {
      this.log(`Filtered ${dropped} hallucinated assertion(s)`);
    }

    return { ...plan, scenarios };
  }

  private log(message: string): void {
    console.log(`[Orchestrator] ${message}`);
  }

  async close(): Promise<void> {
    await this.navigator.close();
  }
}
