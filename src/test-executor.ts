import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { Orchestrator } from './orchestrator.js';
import type { ExplorationPlan } from './types/exploration-plan.js';

const orchestrator = new Orchestrator({ headless: false });

const explorationPlan: ExplorationPlan = {
  url: 'https://www.google.com',
};

try {
  const report = await orchestrator.run(explorationPlan);

  console.log('\n--- TestReport ---');
  console.log(`URL: ${report.url}`);
  console.log(
    `Summary: ${report.summary.passed}/${report.summary.total} passed, ${report.summary.failed} failed (${report.summary.durationMs}ms)`,
  );

  const reportDir = 'reports';
  mkdirSync(reportDir, { recursive: true });
  const reportPath = `${reportDir}/report-${Date.now()}.html`;
  writeFileSync(reportPath, report.html);
  report.filePath = reportPath;
  console.log(`\nReport saved to ${reportPath}`);
} catch (error) {
  console.error('Error:', error);
}
