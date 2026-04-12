import type { Agent } from '../types/agent.js';
import type { PageDescription } from '../types/page-description.js';
import type { TestPlan, TestScenario } from '../types/test-plan.js';
import type { OllamaClient } from '../services/ollama-client.js';

const SYSTEM_PROMPT = `You are a senior QA test engineer. Given a detailed description of a web page, generate test scenarios.

Each scenario has a name and a list of steps. Each step has a type and an instruction:
- type "action": a browser action (click, type, scroll, select). Must be a natural language instruction that a browser automation tool can execute. Do NOT use "leave empty" or "do nothing" as actions — if a field should be empty, skip it.
- type "assertion": a verification that checks expected state. IMPORTANT: assertion instructions MUST contain the exact expected text in double quotes. Example: Verify "Email is required" is displayed. Do NOT describe behavior — reference the actual text visible on the page.

ASSERTION RULES:
- GOOD: Verify "Please enter a valid email" is displayed
- GOOD: Verify "Success!" is visible on the page
- GOOD: Verify "Transfer Vehicle Title" is displayed
- BAD: Verify error message appears for invalid email (no quoted text)
- BAD: Verify the URL changes to a new page (not visible text)
- BAD: Verify red border appears around the field (visual state, not text)

If you cannot reference exact visible text for an assertion, describe what to check as: Verify the page contains "some actual text from the page".

Respond ONLY with a JSON array of scenarios. No markdown, no explanation, no code fences. Example:

[
  {
    "name": "Login form validation",
    "steps": [
      { "type": "action", "instruction": "Click the Submit button" },
      { "type": "assertion", "instruction": "Verify \\"Email is required\\" is displayed" }
    ]
  }
]`;

const TEXT_MODEL = 'qwen3:8b';

export class WebPlanner implements Agent<PageDescription, TestPlan> {
  readonly name = 'WebPlanner';
  private readonly ollama: OllamaClient;

  constructor(ollama: OllamaClient) {
    this.ollama = ollama;
  }

  async run(description: PageDescription): Promise<TestPlan> {
    console.log(`[${this.name}] Generating test plan for ${description.url}`);

    const response = await this.ollama.chat(TEXT_MODEL, [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Generate test scenarios for this page:\n\n${description.description}`,
      },
    ]);

    console.log(`[${this.name}] Parsing test scenarios`);
    const scenarios = this.parseScenarios(response);
    console.log(`[${this.name}] Generated ${scenarios.length} scenarios`);

    return {
      url: description.url,
      scenarios,
      pageDescription: description.description,
    };
  }

  private parseScenarios(response: string): TestScenario[] {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error(
        `WebPlanner: failed to parse scenarios from model response:\n${response}`,
      );
    }

    // Clean up common LLM JSON issues: trailing commas, comments
    const cleaned = jsonMatch[0]
      .replace(/,\s*([}\]])/g, '$1') // trailing commas
      .replace(/\/\/.*$/gm, '')       // line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // block comments

    const parsed = JSON.parse(cleaned) as TestScenario[];

    return parsed.map((scenario) => ({
      name: scenario.name,
      steps: scenario.steps.map((step) => ({
        type: step.type === 'assertion' ? 'assertion' : 'action',
        instruction: step.instruction,
      })),
    }));
  }
}
