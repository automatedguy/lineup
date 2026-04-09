export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  subtask: boolean;
}

export interface JiraPriority {
  id: string;
  name: string;
}

export interface JiraCreatedIssue {
  id: string;
  key: string;
  self: string;
}

export interface JiraIssueFields {
  summary: string;
  description: JiraAdfDocument;
  project: { key: string };
  issuetype: { name: string };
  priority?: { name: string };
  labels?: string[];
}

export interface JiraCreateIssueRequest {
  fields: JiraIssueFields;
}

/** Atlassian Document Format (ADF) types */
export interface JiraAdfDocument {
  type: "doc";
  version: 1;
  content: JiraAdfNode[];
}

export interface JiraAdfNode {
  type: string;
  content?: JiraAdfNode[];
  text?: string;
  marks?: { type: string }[];
  attrs?: Record<string, unknown>;
}

export interface JiraBugResult {
  bugId: string;
  issueKey: string;
  issueUrl: string;
  attachmentsUploaded: number;
}

export interface JiraSyncResult {
  projectKey: string;
  issuesCreated: JiraBugResult[];
  errors: { bugId: string; error: string }[];
}
