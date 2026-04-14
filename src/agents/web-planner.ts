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

Respond ONLY with a JSON array of scenarios. No markdown, no explanation, no code fences. Example:

[
  {
    "name": "Button interaction",
    "steps": [
      { "type": "action", "instruction": "Click the Submit button" },
      { "type": "assertion", "instruction": "Verify \\"Form submitted successfully\\" is displayed" }
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

  async run(pageDescription: PageDescription): Promise<TestPlan> {
    console.log(`[${this.name}] Generating test plan for ${pageDescription.url}`);

    const response = await this.ollama.chat(TEXT_MODEL, [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Generate test scenarios for this page:\n\n${pageDescription.description}`,
      },
    ]);

    console.log(`[${this.name}] Parsing test scenarios`);
    const scenarios = this.parseScenarios(response);
    console.log(`[${this.name}] Generated ${scenarios.length} scenarios`);

    const testPlan: TestPlan = {
      url: pageDescription.url,
      scenarios,
      pageDescription: pageDescription.description,
    };

    console.log('\n--- TestPlan ---');
    console.log(`URL: ${testPlan.url}`);
    for (const scenario of testPlan.scenarios) {
      console.log(`\n  Scenario: ${scenario.name}`);
      for (const step of scenario.steps) {
        console.log(`    [${step.type}] ${step.instruction}`);
      }
    }

    return testPlan;
  }

  private parseScenarios(response: string): TestScenario[] {
    // Strip <think>...</think> blocks emitted by qwen3 before the actual JSON
    const stripped = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    const jsonMatch = stripped.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error(
        `WebPlanner: failed to parse scenarios from model response:\n${response}`,
      );
    }

    // Clean up common LLM JSON issues: trailing commas, comments, control chars
    const cleaned = jsonMatch[0]
      .replace(/[\x00-\x1f\x7f]/g, (ch) => (ch === '\n' || ch === '\r' || ch === '\t' ? ch : '')) // strip control chars
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
