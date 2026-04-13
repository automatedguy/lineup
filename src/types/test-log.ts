import type { TestStep } from './test-plan.js';

export interface StepResult {
  step: TestStep;
  status: 'pass' | 'fail';
  error?: string;
  durationMs: number;
}

export interface ScenarioResult {
  name: string;
  steps: StepResult[];
  status: 'pass' | 'fail';
  screenshot?: Buffer;
}

export interface TestLog {
  url: string;
  scenarios: ScenarioResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  };
}
