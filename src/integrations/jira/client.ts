import * as fs from "node:fs";
import type {
  JiraConfig,
  JiraProject,
  JiraIssueType,
  JiraPriority,
  JiraCreatedIssue,
  JiraCreateIssueRequest,
} from "./types.js";

export class JiraClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(private readonly config: JiraConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    const credentials = Buffer.from(
      `${config.email}:${config.apiToken}`
    ).toString("base64");
    this.authHeader = `Basic ${credentials}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/rest/api/3${path}`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: "application/json",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Jira API error ${response.status} ${method} ${path}: ${errorText}`
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  async getProjects(): Promise<JiraProject[]> {
    return this.request<JiraProject[]>("GET", "/project");
  }

  async getIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
    const result = await this.request<{ issueTypes: JiraIssueType[] }>(
      "GET",
      `/project/${projectKey}`
    );
    return result.issueTypes;
  }

  async getPriorities(): Promise<JiraPriority[]> {
    return this.request<JiraPriority[]>("GET", "/priority");
  }

  async createIssue(
    issueData: JiraCreateIssueRequest
  ): Promise<JiraCreatedIssue> {
    return this.request<JiraCreatedIssue>("POST", "/issue", issueData);
  }

  async addAttachment(
    issueKey: string,
    filePath: string,
    fileName: string
  ): Promise<void> {
    const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}/attachments`;
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append("file", blob, fileName);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "X-Atlassian-Token": "no-check",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Jira attachment error ${response.status} for ${issueKey}: ${errorText}`
      );
    }
  }

  async addAttachmentFromBuffer(
    issueKey: string,
    buffer: Buffer,
    fileName: string
  ): Promise<void> {
    const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}/attachments`;
    const uint8 = new Uint8Array(buffer);
    const blob = new Blob([uint8]);

    const formData = new FormData();
    formData.append("file", blob, fileName);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "X-Atlassian-Token": "no-check",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Jira attachment error ${response.status} for ${issueKey}: ${errorText}`
      );
    }
  }

  getIssueUrl(issueKey: string): string {
    return `${this.baseUrl}/browse/${issueKey}`;
  }
}
