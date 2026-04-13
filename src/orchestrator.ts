import { WebNavigator } from './services/web-navigator.js';
import { OllamaClient } from './services/ollama-client.js';
import type { OllamaClientConfig } from './services/ollama-client.js';
import { WebExplorer } from './agents/web-explorer.js';
import { WebDescriber } from './agents/web-describer.js';
import { WebPlanner } from './agents/web-planner.js';
import { WebExecutor } from './agents/web-executor.js';
import { Reporter } from './agents/reporter.js';
import type { ExplorationPlan } from './types/exploration-plan.js';
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
      console.log('[Orchestrator] Starting pipeline...');

      console.log('[Orchestrator] Running WebExplorer...');
      const descriptionRequest = await this.explorer.run(explorationPlan);

      console.log('[Orchestrator] Running WebDescriber...');
      const pageDescription = await this.describer.run(descriptionRequest);

      console.log('[Orchestrator] Running WebPlanner...');
      const testPlan = await this.planner.run(pageDescription);

      console.log(
        `[Orchestrator] TestPlan: ${testPlan.scenarios.length} scenarios`,
      );

      console.log('[Orchestrator] Running WebExecutor...');
      const testLog = await this.executor.run(testPlan);

      console.log(
        `[Orchestrator] Execution complete: ${testLog.summary.passed}/${testLog.summary.total} passed`,
      );

      console.log('[Orchestrator] Running Reporter...');
      const report = await this.reporter.run(testLog);

      console.log('[Orchestrator] Pipeline complete.');
      return report;
    } finally {
      await this.navigator.close();
    }
  }

  async close(): Promise<void> {
    await this.navigator.close();
  }
}
