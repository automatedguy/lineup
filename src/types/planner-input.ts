import type { PageDescription } from './page-description.js';
import type { JiraSpec } from './jira-spec.js';

export interface PlannerInput {
  pageDescription: PageDescription;
  jiraSpec?: JiraSpec;
}
