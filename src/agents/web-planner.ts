import { z } from 'zod';
import type { Agent } from '../types/agent.js';
import type { PlannerInput } from '../types/planner-input.js';
import type { TestPlan, TestScenario } from '../types/test-plan.js';
import type { OllamaClient } from '../services/ollama-client.js';

const EXPLORATORY_PROMPT = `You are a senior QA test engineer. Given a Page Element Map (JSON), generate test scenarios.

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

[scenarios: [
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
], gaps: []]

Respond with JSON: { "scenarios": [...], "gaps": [] }`;

const SPEC_PROMPT = `You are a senior QA test engineer. You are given BOTH Jira acceptance criteria (what the page SHOULD have and do) AND a Page Element Map (what elements actually exist on the page).

Your job:
1. Generate test scenarios that verify the page meets its spec, grounded in the element map.
2. Identify GAPS — spec requirements that cannot be verified because the required element is absent from the element map.

The Page Element Map lists every visible element on the page grouped by section. Each element has:
- "description": the visible text or label
- "type": the element type (link, button, text input, icon, text, heading, etc.)
- "method": the allowed interaction (click, fill, type, press, scroll, select from dropdown, assert-visible)

RULES for scenarios:
- Every step MUST reference an element from the Page Element Map. Do NOT invent elements.
- Use the element's "method" to determine the step type:
  - "assert-visible" → assertion step: verify the element is displayed.
  - Any other method → action step.
- Assertion instructions MUST contain the element's exact description text in double quotes.
- Action instructions MUST be natural language that a browser automation tool can execute.
- Focus scenarios on verifying the acceptance criteria, not exhaustive element coverage.

RULES for gaps:
- A gap is a spec requirement that cannot be matched to any element in the Page Element Map.
- Express each gap as a short, human-readable description of what is missing (e.g. "Forgot Password link not found on page").
- If all spec requirements are satisfied by the element map, return an empty gaps array.

Respond with JSON: { "scenarios": [...], "gaps": [...] }`;

const TEXT_MODEL = 'qwen3:8b';

const testStepSchema = z.object({
  type: z.enum(['action', 'assertion']),
  instruction: z.string().min(1),
});

const testScenarioSchema = z.object({
  name: z.string().min(1),
  steps: z.array(testStepSchema).min(1),
});

const planSchema = z.object({
  scenarios: z.array(testScenarioSchema).min(1),
  gaps: z.array(z.string()).default([]),
});

const PLAN_FORMAT = {
  type: 'object',
  required: ['scenarios', 'gaps'],
  properties: {
    scenarios: {
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
    },
    gaps: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

export class WebPlanner implements Agent<PlannerInput, TestPlan> {
  readonly name = 'WebPlanner';
  private readonly ollama: OllamaClient;

  constructor(ollama: OllamaClient) {
    this.ollama = ollama;
  }

  async run(input: PlannerInput): Promise<TestPlan> {
    const { pageDescription, jiraSpec } = input;
    this.log(`Generating test plan for ${pageDescription.url}`);

    const systemPrompt = jiraSpec ? SPEC_PROMPT : EXPLORATORY_PROMPT;
    const elementMapJson = JSON.stringify(pageDescription.elementMap, null, 2);

    const userContent = jiraSpec
      ? `Jira ticket: ${jiraSpec.ticketKey} — ${jiraSpec.summary}\n\nAcceptance criteria / requirements:\n${jiraSpec.description}\n\nPage Element Map:\n${elementMapJson}`
      : `Generate test scenarios for this page:\n\n${elementMapJson}`;

    const response = await this.ollama.chat(
      TEXT_MODEL,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      PLAN_FORMAT,
    );

    this.log('Parsing test plan');
    const { scenarios, gaps } = this.parsePlan(response);
    this.log(`Generated ${scenarios.length} scenarios, ${gaps.length} gap(s)`);

    return {
      url: pageDescription.url,
      scenarios,
      ...(gaps.length > 0 ? { gaps } : {}),
    };
  }

  private parsePlan(response: string): { scenarios: TestScenario[]; gaps: string[] } {
    const parsed = JSON.parse(response);
    return planSchema.parse(parsed);
  }

  private log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}
