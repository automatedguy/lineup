import 'dotenv/config';
import { WebNavigator } from './services/web-navigator.js';
import { OllamaClient } from './services/ollama-client.js';
import { WebExplorer } from './agents/web-explorer.js';
import { WebDescriber } from './agents/web-describer.js';
import { WebPlanner } from './agents/web-planner.js';
import { WebExecutor } from './agents/web-executor.js';
import type { ExplorationPlan } from './types/exploration-plan.js';

const navigator = new WebNavigator({ headless: false });
const ollama = new OllamaClient();
const explorer = new WebExplorer(navigator);
const describer = new WebDescriber(navigator, ollama);
const planner = new WebPlanner(ollama);
const executor = new WebExecutor(navigator);

const plan: ExplorationPlan = {
  url: 'https://www.carregistration.com/',
};

try {
  console.log('Initializing WebNavigator...');
  await navigator.init();

  console.log('Running WebExplorer...');
  const request = await explorer.run(plan);

  console.log('Running WebDescriber...');
  const description = await describer.run(request);

  console.log('Running WebPlanner...');
  const testPlan = await planner.run(description);

  console.log(`\n--- TestPlan: ${testPlan.scenarios.length} scenarios ---\n`);

  console.log('Running WebExecutor...');
  const testLog = await executor.run(testPlan);

  console.log('\n--- TestLog ---');
  console.log(`URL: ${testLog.url}`);
  console.log(
    `Summary: ${testLog.summary.passed}/${testLog.summary.total} passed, ${testLog.summary.failed} failed (${testLog.summary.durationMs}ms)`,
  );
  console.log();

  for (const scenario of testLog.scenarios) {
    const icon = scenario.status === 'pass' ? '\u2713' : '\u2717';
    console.log(`  ${icon} ${scenario.name}`);
    for (const step of scenario.steps) {
      const stepIcon = step.status === 'pass' ? '\u2713' : '\u2717';
      console.log(
        `    ${stepIcon} [${step.step.type}] ${step.step.instruction} (${step.durationMs}ms)`,
      );
      if (step.error) {
        console.log(`      Error: ${step.error}`);
      }
    }
    console.log();
  }
} catch (error) {
  console.error('Error:', error);
} finally {
  await navigator.close();
}
