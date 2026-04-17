import 'dotenv/config';
import { WebNavigator } from './services/web-navigator.js';
import { WebExplorer } from './agents/web-explorer.js';
import type { ExplorationPlan } from './types/exploration-plan.js';

const navigator = new WebNavigator({ headless: false });
const explorer = new WebExplorer(navigator);

const plan: ExplorationPlan = {
  url: 'https://www.google.com',
  actions: [
    'Type "click on "Click Me" button"',
    'Click the Search button',
  ],
};

try {
  console.log('Initializing WebNavigator...');
  await navigator.init();

  console.log('Running WebExplorer...');
  const result = await explorer.run(plan);

  console.log('\n--- DescriptionRequest ---');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Error:', error);
} finally {
  await navigator.close();
}
