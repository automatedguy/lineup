import type { DescriptionRequest } from '../types/description-request.js';
import type { PageDescription, PageElementMap } from '../types/page-description.js';
import type { WebNavigator } from '../services/web-navigator.js';
import type { OllamaClient } from '../services/ollama-client.js';
import { BaseAgent } from './base-agent.js';

const SYSTEM_PROMPT = `You are documenting a web page by listing every visible element as structured JSON.

Return a JSON array of page sections. Each section has a name and a list of elements.
Each element has:
- "description": the exact visible text label, or a short description for non-text elements (e.g., "Search by voice icon")
- "type": one of: link, button, text input, checkbox, radio, dropdown, toggle, icon, image, text, heading
- "method": the allowed interaction — one of: click, fill, type, press, scroll, select from dropdown, assert-visible

Method rules (from Stagehand suggested actions):
- link, button, icon, image, checkbox, radio, toggle → "click"
- text input → "fill" (set a field's value)
- dropdown → "select from dropdown"
- scrollable area → "scroll"
- keyboard shortcut target → "press" (press a key like Enter, Tab, Escape)
- text, heading → "assert-visible" (non-actionable, can only be verified as present)

RULES:
- Group elements by page section (header, main content, sidebar, footer, etc.).
- Within each section, list elements in the order they appear on screen: top-to-bottom, left-to-right.
- Do NOT move elements between sections. An element belongs to the section where it visually appears on the page.
- Report only what you can see. Do not infer, assume, or guess hidden content.
- Use the exact text visible on each element — do not paraphrase or translate.
- Include ALL elements: actionable (links, buttons, inputs) AND non-actionable (text, headings).
- Do NOT skip elements. Every visible link, button, icon, text, and input must be listed.`;

const VISION_MODEL = 'qwen3-vl:8b';

const ELEMENT_MAP_FORMAT = {
  type: 'array',
  items: {
    type: 'object',
    required: ['section', 'elements'],
    properties: {
      section: { type: 'string' },
      elements: {
        type: 'array',
        items: {
          type: 'object',
          required: ['description', 'type', 'method'],
          properties: {
            description: { type: 'string' },
            type: { type: 'string' },
            method: { type: 'string', enum: ['click', 'fill', 'type', 'press', 'scroll', 'select from dropdown', 'assert-visible'] },
          },
        },
      },
    },
  },
};

export class WebDescriber extends BaseAgent<DescriptionRequest, PageDescription> {
  readonly name = 'WebDescriber';
  private readonly ollama: OllamaClient;

  constructor(navigator: WebNavigator, ollama: OllamaClient) {
    super(navigator);
    this.ollama = ollama;
  }

  protected async execute(request: DescriptionRequest): Promise<PageDescription> {
    this.log(`Taking screenshot of ${request.url}`);
    const screenshot = await this.navigator.screenshot();

    const imageBase64 = screenshot.toString('base64');

    this.log(`Sending screenshot to ${VISION_MODEL} for visual analysis`);
    const response = await this.ollama.chatWithImage(
      VISION_MODEL,
      'List every visible element on this web page as structured JSON grouped by page section.',
      imageBase64,
      SYSTEM_PROMPT,
      ELEMENT_MAP_FORMAT,
    );

    this.log(`Raw response length: ${response.length} chars`);

    let elementMap: PageElementMap;
    try {
      elementMap = JSON.parse(response);
    } catch {
      this.log(`Failed to parse response. Raw output:\n${response}`);
      throw new Error('Vision model returned invalid JSON — response may have been truncated');
    }

    const totalElements = elementMap.reduce((sum, s) => sum + s.elements.length, 0);
    this.log(`Element map complete: ${elementMap.length} sections, ${totalElements} elements`);

    return {
      url: request.url,
      elementMap,
      screenshot,
    };
  }
}
