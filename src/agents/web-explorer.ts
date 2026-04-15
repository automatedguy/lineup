import type { ExplorationPlan } from '../types/exploration-plan.js';
import type { DescriptionRequest } from '../types/description-request.js';
import type { WebNavigator } from '../services/web-navigator.js';
import { BaseAgent } from './base-agent.js';

export class WebExplorer extends BaseAgent<ExplorationPlan, DescriptionRequest> {
  readonly name = 'WebExplorer';

  constructor(navigator: WebNavigator) {
    super(navigator);
  }

  protected async execute(plan: ExplorationPlan): Promise<DescriptionRequest> {
    this.log(`Navigating to ${plan.url}`);

    this.log(`ExplorationPlan: ${plan.url}, ${plan.actions?.length || 0} actions`);

    await this.navigator.navigate(plan.url);

    if (plan.actions) {
      for (const action of plan.actions) {
        this.log(`Acting: ${action}`);
        await this.navigator.act(action);
      }
    }

    return { url: plan.url };
  }
}
