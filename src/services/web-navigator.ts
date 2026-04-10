import { Stagehand } from '@browserbasehq/stagehand';
import type { ActResult, Action } from '@browserbasehq/stagehand';
import type { z } from 'zod';

export interface NetworkEntry {
  url: string;
  resourceType: string;
  startTime: number;
  duration: number;
  transferSize: number;
}

export interface WebNavigatorConfig {
  headless?: boolean;
}

export class WebNavigator {
  private stagehand: Stagehand | null = null;
  private readonly headless: boolean;
  private initialized = false;

  constructor(config: WebNavigatorConfig = {}) {
    this.headless = config.headless ?? true;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    this.stagehand = new Stagehand({
      env: 'LOCAL',
      model: 'groq-llama-3.3-70b-versatile',
      localBrowserLaunchOptions: {
        headless: this.headless,
      },
    });

    await this.stagehand.init();
    this.initialized = true;
  }

  async close(): Promise<void> {
    if (!this.initialized || !this.stagehand) return;
    await this.stagehand.close();
    this.stagehand = null;
    this.initialized = false;
  }

  async navigate(url: string): Promise<void> {
    await this.getPage().goto(url, { waitUntil: 'domcontentloaded' });
  }

  async act(instruction: string): Promise<ActResult> {
    return this.getStagehand().act(instruction);
  }

  async extract<T extends z.ZodTypeAny>(
    instruction: string,
    schema: T,
  ): Promise<z.infer<T>> {
    return this.getStagehand().extract(instruction, schema) as Promise<
      z.infer<T>
    >;
  }

  async observe(instruction?: string): Promise<Action[]> {
    if (instruction) {
      return this.getStagehand().observe(instruction);
    }
    return this.getStagehand().observe();
  }

  async screenshot(): Promise<Buffer> {
    return this.getPage().screenshot({ type: 'png', fullPage: false });
  }

  async getHtmlSnapshot(): Promise<string> {
    return this.getPage().evaluate(() => document.documentElement.outerHTML);
  }

  async getNetworkActivity(): Promise<NetworkEntry[]> {
    return this.getPage().evaluate(() => {
      return performance.getEntriesByType('resource').map((entry) => {
        const e = entry as PerformanceResourceTiming;
        return {
          url: e.name,
          resourceType: e.initiatorType,
          startTime: e.startTime,
          duration: e.duration,
          transferSize: e.transferSize,
        };
      });
    });
  }

  private getStagehand(): Stagehand {
    if (!this.initialized || !this.stagehand) {
      throw new Error('WebNavigator is not initialized. Call init() first.');
    }
    return this.stagehand;
  }

  private getPage() {
    const stagehand = this.getStagehand();
    const page = stagehand.context.pages()[0];
    if (!page) {
      throw new Error('No page available in browser context.');
    }
    return page;
  }
}
