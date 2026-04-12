import 'dotenv/config';
import { WebNavigator } from './services/web-navigator.js';
import { OllamaClient } from './services/ollama-client.js';
import { WebExplorer } from './agents/web-explorer.js';
import { WebDescriber } from './agents/web-describer.js';
import type { ExplorationPlan } from './types/exploration-plan.js';

const navigator = new WebNavigator({ headless: false });
const ollama = new OllamaClient();
const explorer = new WebExplorer(navigator);
const describer = new WebDescriber(navigator, ollama);

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

  console.log('\n--- PageDescription ---');
  console.log(`URL: ${description.url}`);
  console.log(`Screenshot: ${description.screenshot.length} bytes`);
  console.log(`\nDescription:\n${description.description}`);
} catch (error) {
  console.error('Error:', error);
} finally {
  await navigator.close();
}
