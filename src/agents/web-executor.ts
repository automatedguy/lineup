import { z } from 'zod';
import type { TestPlan, TestStep } from '../types/test-plan.js';
import type { TestLog, StepResult, ScenarioResult } from '../types/test-log.js';
import type { WebNavigator } from '../services/web-navigator.js';
import { BaseAgent } from './base-agent.js';

const assertionSchema = z.object({
  pass: z.boolean(),
  reason: z.string(),
});

export class WebExecutor extends BaseAgent<TestPlan, TestLog> {
  readonly name = 'WebExecutor';

  constructor(navigator: WebNavigator) {
    super(navigator);
  }

  protected async execute(plan: TestPlan): Promise<TestLog> {
    const startTime = Date.now();
    const scenarioResults: ScenarioResult[] = [];

    this.log(`Executing ${plan.scenarios.length} scenarios on ${plan.url}`);

    for (const scenario of plan.scenarios) {
      this.log(`Navigating to ${plan.url}`);
      await this.navigator.navigate(plan.url);

      this.log(`Scenario: ${scenario.name}`);
      const stepResults: StepResult[] = [];
      let scenarioFailed = false;

      for (const step of scenario.steps) {
        const result = await this.executeStep(step);
        stepResults.push(result);

        const icon = result.status === 'pass' ? '\u2713' : '\u2717';
        this.log(`  ${icon} [${step.type}] ${step.instruction} (${result.durationMs}ms)`);
        if (result.status === 'fail') {
          this.log(`    Error: ${result.error}`);
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

    this.log(`${passed} passed, ${failed} failed`);

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
        await this.executeAssertion(step.instruction);
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

  private async executeAssertion(instruction: string): Promise<void> {
    // Try fast path: extract quoted text and use waitForElementVisible
    const quoted = instruction.match(/"([^"]+)"/);
    if (quoted) {
      try {
        await this.navigator.waitForElementVisible(quoted[1], 3000);
        return;
      } catch {
        // Fast path failed — fall through to LLM evaluation
      }
    }

    // Fallback: use extract() to ask the LLM to evaluate the assertion
    this.log('    (fallback: using extract for assertion)');
    const result = await this.navigator.extract(
      `Look at the current page and evaluate this assertion: "${instruction}". Is it true or false? Provide a brief reason.`,
      assertionSchema,
    );

    if (!result.pass) {
      throw new Error(`Assertion failed: ${result.reason}`);
    }
  }
}
