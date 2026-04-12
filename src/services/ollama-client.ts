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

  constructor(config: OllamaClientConfig = {}) {
    this.baseUrl =
      config.baseUrl ??
      process.env.OLLAMA_BASE_URL ??
      'http://localhost:11434';
    this.timeoutMs = config.timeoutMs ?? 300_000; // 5 minutes — vision models need time to load
  }

  async chat(model: string, messages: OllamaMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: AbortSignal.timeout(this.timeoutMs),
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
