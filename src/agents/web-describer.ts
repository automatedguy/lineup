import type { DescriptionRequest } from '../types/description-request.js';
import type { PageDescription } from '../types/page-description.js';
import type { WebNavigator } from '../services/web-navigator.js';
import type { OllamaClient } from '../services/ollama-client.js';
import { BaseAgent } from './base-agent.js';

const SYSTEM_PROMPT = `You are documenting a web page by describing exactly what is visible on screen.

Describe in detail:
- Page layout and structure
- Navigation elements (menus, links, breadcrumbs) with their exact text labels
- Forms and input fields (types, labels, placeholders, required indicators)
- Buttons and interactive elements (CTAs, toggles, dropdowns) with their exact text
- Data display (tables, lists, cards) with visible text content
- Visual indicators (alerts, badges, loading states, error messages) with their exact text
- Modal dialogs or overlays if present

RULES:
- For each element, include its type in parentheses: (button), (link), (text input), (checkbox), (radio), (dropdown), (toggle), (icon), (image), (text), (heading).
- Group elements by page section (header, main content, sidebar, footer, etc.).
- Report only what you can see. Do not infer, assume, or guess hidden content.
- Use the exact text visible on each element — do not paraphrase or translate.
- Do not suggest what to test, do not generate test scenarios, do not give recommendations.
- Do not describe what a tester "should" do — only describe what is on the page.`;

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
      'Describe everything visible on this web page. List all elements with their exact text labels.',
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
