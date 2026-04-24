export interface TestStep {
  type: 'action' | 'assertion';
  instruction: string;
}

export interface TestScenario {
  name: string;
  steps: TestStep[];
}

export interface TestPlan {
  url: string;
  scenarios: TestScenario[];
  gaps?: string[];
}
