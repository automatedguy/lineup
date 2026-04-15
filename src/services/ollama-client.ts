import { Agent } from 'undici';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

export interface OllamaChatResponse {
  message: {
    role: string;
    content: string;
  };
}

export interface OllamaClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly dispatcher: Agent;

  constructor(config: OllamaClientConfig = {}) {
    this.baseUrl =
      config.baseUrl ??
      process.env.OLLAMA_BASE_URL ??
      'http://localhost:11434';
    this.timeoutMs = config.timeoutMs ?? 600_000; // 10 minutes — vision models need time to load on cold start
    this.dispatcher = new Agent({
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
    });
  }

  async chat(
    model: string,
    messages: OllamaMessage[],
    format?: Record<string, unknown>,
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false, think: false, ...(format && { format }) }),
      signal: AbortSignal.timeout(this.timeoutMs),
      // @ts-expect-error -- dispatcher is a valid undici option for Node's fetch
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as OllamaChatResponse;
    return data.message.content;
  }

  async chatWithImage(
    model: string,
    prompt: string,
    imageBase64: string,
    systemPrompt?: string,
  ): Promise<string> {
    const messages: OllamaMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({
      role: 'user',
      content: prompt,
      images: [imageBase64],
    });

    return this.chat(model, messages);
  }
}
