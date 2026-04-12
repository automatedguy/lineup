import type { Agent } from '../types/agent.js';
import type { ExplorationPlan } from '../types/exploration-plan.js';
import type { DescriptionRequest } from '../types/description-request.js';
import type { WebNavigator } from '../services/web-navigator.js';

export class WebExplorer implements Agent<ExplorationPlan, DescriptionRequest> {
  readonly name = 'WebExplorer';
  private readonly navigator: WebNavigator;

  constructor(navigator: WebNavigator) {
    this.navigator = navigator;
  }

  async run(plan: ExplorationPlan): Promise<DescriptionRequest> {
    console.log(`[${this.name}] Navigating to ${plan.url}`);
    await this.navigator.navigate(plan.url);

    if (plan.actions) {
      for (const action of plan.actions) {
        console.log(`[${this.name}] Acting: ${action}`);
        await this.navigator.act(action);
      }
    }

    console.log(`[${this.name}] Exploration complete — requesting description`);

    return { url: plan.url };
  }
}
