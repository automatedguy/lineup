import { z } from 'zod';
import type { Agent } from '../types/agent.js';
import type { PageDescription } from '../types/page-description.js';
import type { TestPlan, TestScenario } from '../types/test-plan.js';
import type { OllamaClient } from '../services/ollama-client.js';

const SYSTEM_PROMPT = `You are a senior QA test engineer. Given a Page Element Map (JSON), generate test scenarios.

The Page Element Map lists every visible element on the page grouped by section. Each element has:
- "description": the visible text or label
- "type": the element type (link, button, text input, icon, text, heading, etc.)
- "method": the allowed interaction (click, fill, type, press, scroll, select from dropdown, assert-visible)

RULES:
- You may create multiple scenarios per section — group steps logically.
- Every step MUST reference an element from the map. Do NOT invent elements.
- Use the element's "method" to determine the step type:
  - "assert-visible" → assertion step: verify the element is displayed.
  - Any other method (click, fill, type, press, scroll, select from dropdown) → action step.
- Assertion instructions MUST contain the element's exact description text in double quotes.
- Action instructions MUST be natural language that a browser automation tool can execute.

Example for a map with a Header section containing "Gmail" (link, click) and "Sign In" (button, click), and a Footer section containing "About" (link, click) and "Privacy" (link, click):

[
  {
    "name": "Header elements",
    "steps": [
      { "type": "assertion", "instruction": "Verify \\"Gmail\\" is displayed" },
      { "type": "assertion", "instruction": "Verify \\"Sign In\\" is displayed" }
    ]
  },
  {
    "name": "Footer elements",
    "steps": [
      { "type": "assertion", "instruction": "Verify \\"About\\" is displayed" },
      { "type": "assertion", "instruction": "Verify \\"Privacy\\" is displayed" }
    ]
  }
]

Respond with a JSON array of scenarios.`;

const TEXT_MODEL = 'qwen3:8b';

const testStepSchema = z.object({
  type: z.enum(['action', 'assertion']),
  instruction: z.string().min(1),
});

const testScenarioSchema = z.object({
  name: z.string().min(1),
  steps: z.array(testStepSchema).min(1),
});

const scenariosSchema = z.array(testScenarioSchema).min(1);

// JSON schema passed to Ollama's format parameter to constrain output
const SCENARIOS_FORMAT = {
  type: 'array',
  items: {
    type: 'object',
    required: ['name', 'steps'],
    properties: {
      name: { type: 'string' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'instruction'],
          properties: {
            type: { type: 'string', enum: ['action', 'assertion'] },
            instruction: { type: 'string' },
          },
        },
      },
    },
  },
};

export class WebPlanner implements Agent<PageDescription, TestPlan> {
  readonly name = 'WebPlanner';
  private readonly ollama: OllamaClient;

  constructor(ollama: OllamaClient) {
    this.ollama = ollama;
  }

  async run(pageDescription: PageDescription): Promise<TestPlan> {
    this.log(`Generating test plan for ${pageDescription.url}`);

    const elementMapJson = JSON.stringify(pageDescription.elementMap, null, 2);

    const response = await this.ollama.chat(
      TEXT_MODEL,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate test scenarios for this page:\n\n${elementMapJson}`,
        },
      ],
      SCENARIOS_FORMAT,
    );

    this.log('Parsing test scenarios');
    const scenarios = this.parseScenarios(response);
    this.log(`Generated ${scenarios.length} scenarios`);

    return {
      url: pageDescription.url,
      scenarios,
    };
  }

  private parseScenarios(response: string): TestScenario[] {
    const parsed = JSON.parse(response);
    return scenariosSchema.parse(parsed);
  }

  private log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}
