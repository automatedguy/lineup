import 'dotenv/config';

export { WebNavigator } from './services/web-navigator.js';
export type { WebNavigatorConfig, NetworkEntry } from './services/web-navigator.js';

export { OllamaClient } from './services/ollama-client.js';
export type { OllamaClientConfig, OllamaMessage } from './services/ollama-client.js';

export { WebExplorer } from './agents/web-explorer.js';
export { WebDescriber } from './agents/web-describer.js';

export type { Agent } from './types/agent.js';
export type { ExplorationPlan } from './types/exploration-plan.js';
export type { DescriptionRequest } from './types/description-request.js';
export type { PageDescription } from './types/page-description.js';
