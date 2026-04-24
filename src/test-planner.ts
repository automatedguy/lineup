import 'dotenv/config';
import { WebNavigator } from './services/web-navigator.js';
import { OllamaClient } from './services/ollama-client.js';
import { WebExplorer } from './agents/web-explorer.js';
import { WebDescriber } from './agents/web-describer.js';
import { WebPlanner } from './agents/web-planner.js';
import type { ExplorationPlan } from './types/exploration-plan.js';

const navigator = new WebNavigator({ headless: false });
const ollama = new OllamaClient();
const explorer = new WebExplorer(navigator);
const describer = new WebDescriber(navigator, ollama);
const planner = new WebPlanner(ollama);

const plan: ExplorationPlan = {
  url: 'https://www.google.com',
};

try {
  console.log('Initializing WebNavigator...');
  await navigator.init();

  console.log('Running WebExplorer...');
  const request = await explorer.run(plan);

  console.log('Running WebDescriber...');
  const description = await describer.run(request);

  // log the description
  console.log('\n--- PageDescription ---');
  console.log(`URL: ${description.url}`);
  console.log(`Screenshot: ${description.screenshot.length} bytes`);
  console.log(`\nElement Map:\n${JSON.stringify(description.elementMap, null, 2)}`);

  console.log('Running WebPlanner...');
  const testPlan = await planner.run({ pageDescription: description });

  console.log('\n--- TestPlan ---');
  console.log(`URL: ${testPlan.url}`);
  console.log(`Scenarios: ${testPlan.scenarios.length}\n`);

  for (const scenario of testPlan.scenarios) {
    console.log(`  ${scenario.name}`);
    for (const step of scenario.steps) {
      console.log(`    [${step.type}] ${step.instruction}`);
    }
    console.log();
  }
} catch (error) {
  console.error('Error:', error);
} finally {
  await navigator.close();
}
