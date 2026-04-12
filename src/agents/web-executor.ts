import type { Agent } from '../types/agent.js';
import type { TestPlan, TestStep } from '../types/test-plan.js';
import type { TestLog, StepResult, ScenarioResult } from '../types/test-log.js';
import type { WebNavigator } from '../services/web-navigator.js';

export class WebExecutor implements Agent<TestPlan, TestLog> {
  readonly name = 'WebExecutor';
  private readonly navigator: WebNavigator;

  constructor(navigator: WebNavigator) {
    this.navigator = navigator;
  }

  async run(plan: TestPlan): Promise<TestLog> {
    const startTime = Date.now();
    const scenarioResults: ScenarioResult[] = [];

    console.log(
      `[${this.name}] Executing ${plan.scenarios.length} scenarios on ${plan.url}`,
    );

    for (const scenario of plan.scenarios) {
      console.log(`[${this.name}] Navigating to ${plan.url}`);
      await this.navigator.navigate(plan.url);

      console.log(`[${this.name}] Scenario: ${scenario.name}`);
      const stepResults: StepResult[] = [];
      let scenarioFailed = false;

      for (const step of scenario.steps) {
        const result = await this.executeStep(step);
        stepResults.push(result);

        const icon = result.status === 'pass' ? '\u2713' : '\u2717';
        console.log(
          `[${this.name}]   ${icon} [${step.type}] ${step.instruction} (${result.durationMs}ms)`,
        );
        if (result.status === 'fail') {
          console.log(`[${this.name}]     Error: ${result.error}`);
          scenarioFailed = true;
          break;
        }
      }

      let screenshot: Buffer | undefined;
      try {
        screenshot = await this.navigator.screenshot();
      } catch {
        // screenshot failure shouldn't abort the run
      }

      scenarioResults.push({
        name: scenario.name,
        steps: stepResults,
        status: scenarioFailed ? 'fail' : 'pass',
        screenshot,
      });
    }

    const passed = scenarioResults.filter((s) => s.status === 'pass').length;
    const failed = scenarioResults.filter((s) => s.status === 'fail').length;

    console.log(
      `[${this.name}] Complete: ${passed} passed, ${failed} failed`,
    );

    return {
      url: plan.url,
      scenarios: scenarioResults,
      summary: {
        total: scenarioResults.length,
        passed,
        failed,
        durationMs: Date.now() - startTime,
      },
    };
  }

  private async executeStep(step: TestStep): Promise<StepResult> {
    const start = Date.now();
    try {
      if (step.type === 'action') {
        await this.navigator.act(step.instruction);
      } else {
        const text = this.extractAssertionText(step.instruction);
        await this.navigator.waitForElementVisible(text);
      }
      return {
        step,
        status: 'pass',
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        step,
        status: 'fail',
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
      };
    }
  }

  private extractAssertionText(instruction: string): string {
    // Extract text between quotes: Verify "Something" is displayed
    const quoted = instruction.match(/"([^"]+)"/);
    if (quoted) return quoted[1];

    // Extract text after common assertion prefixes
    const prefixed = instruction.match(
      /(?:verify|check|confirm|assert|ensure)\s+(?:that\s+)?(.+?)(?:\s+is\s+(?:displayed|visible|present|shown))?$/i,
    );
    if (prefixed) return prefixed[1];

    // Fallback: use the full instruction as search text
    return instruction;
  }
}
