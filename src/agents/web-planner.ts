import { z } from 'zod';
import type { Agent } from '../types/agent.js';
import type { PageDescription } from '../types/page-description.js';
import type { TestPlan, TestScenario } from '../types/test-plan.js';
import type { OllamaClient } from '../services/ollama-client.js';

const SYSTEM_PROMPT = `You are a senior QA test engineer. Given a detailed description of a web page, generate test scenarios.

Each scenario has a name and a list of steps. Each step has a type and an instruction:
- type "action": a browser action (click, type, scroll, select). Must be a natural language instruction that a browser automation tool can execute. Do NOT use "leave empty" or "do nothing" as actions — if a field should be empty, skip it.
- type "assertion": a verification that checks expected state.

CRITICAL ASSERTION RULES:
1. Assertion instructions MUST contain the exact expected text in double quotes.
2. You may ONLY use text that appears in the page description provided to you. NEVER invent, guess, or assume text that is not explicitly mentioned in the description.
3. If the page description does not mention specific error messages, validation text, or UI text — do NOT create assertions for them. Only assert what you can verify from the description.
4. For assertions about state changes (selected, redirected, visual style), omit the quotes and describe what to check — these will be evaluated by a fallback mechanism.

GOOD assertions (text from the description):
- Verify "Click Me" is displayed
- Verify "A paragraph of text" is visible on the page
- Verify "Basic Web Page" is displayed in the heading

BAD assertions (invented text NOT in the description):
- Verify "Please enter a valid email" is displayed (made up error message)
- Verify "ZIP code must be numeric." is displayed (guessed validation text)
- Verify "Loading..." is visible (assumed loading text)

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
