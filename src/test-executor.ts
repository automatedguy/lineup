import dotenv from 'dotenv';
dotenv.config({ override: true });
import { writeFileSync, mkdirSync } from 'node:fs';
import { WebNavigator } from './services/web-navigator.js';
import { OllamaClient } from './services/ollama-client.js';
import { fetchJiraSpec } from './services/fetch-jira-spec.js';
import { WebExplorer } from './agents/web-explorer.js';
import { WebDescriber } from './agents/web-describer.js';
import { WebPlanner } from './agents/web-planner.js';
import { WebExecutor } from './agents/web-executor.js';
import { Reporter } from './agents/reporter.js';
import type { ExplorationPlan } from './types/exploration-plan.js';
import type { JiraSpec } from './types/jira-spec.js';

const navigator = new WebNavigator({ headless: false });
const ollama = new OllamaClient();
const explorer = new WebExplorer(navigator);
const describer = new WebDescriber(navigator, ollama);
const planner = new WebPlanner(ollama);
const executor = new WebExecutor(navigator);
const reporter = new Reporter();

const plan: ExplorationPlan = {
  url: 'https://www.google.com',
  jiraTicket: 'BA-1',
};

// Fetch Jira spec before starting the browser to avoid Playwright network interference
let jiraSpec: JiraSpec | undefined;
if (plan.jiraTicket) {
  console.log(`Fetching Jira spec for ${plan.jiraTicket}...`);
  jiraSpec = await fetchJiraSpec(plan.jiraTicket);
  console.log(`Jira spec: "${jiraSpec.summary}"`);
}

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
  console.log(`\nElement Map:\n${JSON.stringify(description.elementMap, null, 2)}`);

  console.log('Running WebPlanner...');
  const testPlan = await planner.run({ pageDescription: description, jiraSpec });

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

  console.log('Running WebExecutor...');
  const testLog = await executor.run(testPlan);

  console.log('\n--- TestLog ---');
  console.log(
    `Summary: ${testLog.summary.passed}/${testLog.summary.total} passed, ${testLog.summary.failed} failed (${testLog.summary.durationMs}ms)`,
  );

  console.log('Running Reporter...');
  const report = await reporter.run({ ...testLog, gaps: testPlan.gaps });

  const reportDir = 'reports';
  mkdirSync(reportDir, { recursive: true });
  const reportPath = `${reportDir}/report-${Date.now()}.html`;
  writeFileSync(reportPath, report.html);
  console.log(`\nReport saved to ${reportPath}`);
} catch (error) {
  console.error('Error:', error);
} finally {
  await navigator.close();
}
