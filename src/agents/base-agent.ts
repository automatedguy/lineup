import type { Agent } from '../types/agent.js';
import type { WebNavigator } from '../services/web-navigator.js';

export abstract class BaseAgent<TInput, TOutput> implements Agent<TInput, TOutput> {
  abstract readonly name: string;
  protected readonly navigator: WebNavigator;

  constructor(navigator: WebNavigator) {
    this.navigator = navigator;
  }

  async run(input: TInput): Promise<TOutput> {
    this.log('Starting');
    const start = Date.now();
    try {
      const result = await this.execute(input);
      this.log(`Complete (${Date.now() - start}ms)`);
      return result;
    } catch (error) {
      this.log(`Failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  protected abstract execute(input: TInput): Promise<TOutput>;

  protected log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}
