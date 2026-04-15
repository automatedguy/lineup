import type { DescriptionRequest } from '../types/description-request.js';
import type { PageDescription } from '../types/page-description.js';
import type { WebNavigator } from '../services/web-navigator.js';
import type { OllamaClient } from '../services/ollama-client.js';
import { BaseAgent } from './base-agent.js';

const SYSTEM_PROMPT = `You are a senior web application tester documenting a page for scripting test scenarios.
Describe the page in detail, including:
- Page layout and structure
- Navigation elements (menus, links, breadcrumbs)
- Forms and input fields (types, labels, placeholders, required fields)
- Buttons and interactive elements (CTAs, toggles, dropdowns)
- Data display (tables, lists, cards, text content)
- Visual indicators (alerts, badges, loading states, error messages)
- Modal dialogs or overlays if present

Focus on what a tester needs to know to write test scenarios. Be specific about element labels and text content.`;

const VISION_MODEL = 'qwen3-vl:8b';

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
    const description = await this.ollama.chatWithImage(
      VISION_MODEL,
      'Describe this web page in detail for test scenario scripting.',
      imageBase64,
      SYSTEM_PROMPT,
    );

    this.log(`Description complete (${description.length} chars)`);

    return {
      url: request.url,
      description,
      screenshot,
    };
  }
}
