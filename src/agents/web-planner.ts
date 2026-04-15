import { z } from 'zod';
import type { Agent } from '../types/agent.js';
import type { PageDescription } from '../types/page-description.js';
import type { TestPlan, TestScenario } from '../types/test-plan.js';
import type { OllamaClient } from '../services/ollama-client.js';

const SYSTEM_PROMPT = `You are a senior QA test engineer. Given a detailed description of a web page, generate test scenarios that verify all visible elements are present.

SCENARIO STRUCTURE:
- Create one scenario per page section (e.g., "Header elements", "Main content", "Footer elements").
- Each scenario contains only assertion steps that verify elements in that section are displayed.
- Do NOT click links, buttons, or navigate away from the page.
- Do NOT create interaction flows — only verify what is visible.

ASSERTION RULES:
1. Each assertion MUST contain the exact expected text in double quotes.
2. You may ONLY use text that appears in the page description. NEVER invent or guess text.
3. One assertion per element — verify it is displayed on the page.

Example for a page with a header containing "Gmail" (link), "Sign In" (button) and a footer containing "About" (link), "Privacy" (link):

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
    console.log(`[${this.name}] Generating test plan for ${pageDescription.url}`);

    const response = await this.ollama.chat(
      TEXT_MODEL,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate test scenarios for this page:\n\n${pageDescription.description}`,
        },
      ],
      SCENARIOS_FORMAT,
    );

    console.log(`[${this.name}] Parsing test scenarios`);
    const scenarios = this.parseScenarios(response);
    console.log(`[${this.name}] Generated ${scenarios.length} scenarios`);

    return {
      url: pageDescription.url,
      scenarios,
      pageDescription: pageDescription.description,
    };
  }

  private parseScenarios(response: string): TestScenario[] {
    const parsed = JSON.parse(response);
    return scenariosSchema.parse(parsed);
  }
}
