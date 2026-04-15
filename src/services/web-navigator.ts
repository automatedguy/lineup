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
  private initPromise: Promise<void> | null = null;
  private readonly headless: boolean;

  constructor(config: WebNavigatorConfig = {}) {
    this.headless = config.headless ?? true;
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInit();
    }
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    this.stagehand = new Stagehand({
      env: 'LOCAL',
      model: {
        modelName: 'groq/meta-llama/llama-4-scout-17b-16e-instruct',
        apiKey: process.env.GROQ_API_KEY,
      },
      localBrowserLaunchOptions: {
        headless: this.headless,
      },
    });

    await this.stagehand.init();
  }

  async close(): Promise<void> {
    if (!this.stagehand) return;
    try {
      await this.stagehand.close();
    } finally {
      this.stagehand = null;
      this.initPromise = null;
    }
  }

  async navigate(url: string): Promise<void> {
    return this.withBrowserGuard(async () => {
      await this.getPage().goto(url, { waitUntil: 'domcontentloaded' });
    });
  }

  async act(instruction: string): Promise<ActResult> {
    return this.withBrowserGuard(() => this.getStagehand().act(instruction));
  }

  async extract<T extends z.ZodTypeAny>(
    instruction: string,
    schema: T,
  ): Promise<z.infer<T>> {
    return this.withBrowserGuard(
      () =>
        this.getStagehand().extract(instruction, schema) as Promise<
          z.infer<T>
        >,
    );
  }

  async observe(instruction?: string): Promise<Action[]> {
    return this.withBrowserGuard(() => {
      if (instruction) {
        return this.getStagehand().observe(instruction);
      }
      return this.getStagehand().observe();
    });
  }

  async waitForPageLoad(): Promise<void> {
    return this.withBrowserGuard(() =>
      this.getPage().waitForLoadState('domcontentloaded'),
    );
  }

  async waitForElementVisible(text: string, timeout = 10000): Promise<void> {
    await this.withBrowserGuard(async () => {
      await this.getPage().waitForSelector(`text="${text}"`, {
        state: 'visible',
        timeout,
      });
    });
  }

  async waitForElementNotVisible(
    text: string,
    timeout = 10000,
  ): Promise<void> {
    await this.withBrowserGuard(async () => {
      await this.getPage().waitForSelector(`text="${text}"`, {
        state: 'hidden',
        timeout,
      });
    });
  }

  async screenshot(): Promise<Buffer> {
    return this.withBrowserGuard(() =>
      this.getPage().screenshot({ type: 'png', fullPage: false, scale: 'css' }),
    );
  }

  async getHtmlSnapshot(): Promise<string> {
    return this.withBrowserGuard(() =>
      this.getPage().evaluate(() => document.documentElement.outerHTML),
    );
  }

  async getNetworkActivity(): Promise<NetworkEntry[]> {
    return this.withBrowserGuard(() =>
      this.getPage().evaluate(() => {
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
      }),
    );
  }

  private async withBrowserGuard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (this.isBrowserDead(error)) {
        this.stagehand = null;
        this.initPromise = null;
        throw new Error(
          'Browser crashed or was closed unexpectedly. Call init() to restart.',
        );
      }
      throw error;
    }
  }

  private isBrowserDead(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : '';
    return /target closed|browser.*closed|connection closed|protocol error/i.test(
      msg,
    );
  }

  private getStagehand(): Stagehand {
    if (!this.stagehand) {
      throw new Error('WebNavigator is not initialized. Call init() first.');
    }
    return this.stagehand;
  }

  private getPage() {
    const stagehand = this.getStagehand();
    const page = stagehand.context.activePage();
    if (!page) {
      throw new Error('No page available in browser context.');
    }
    return page;
  }
}
