import type { Bug, Severity, ScanReport } from "../../models/schemas.js";
import { JiraClient } from "./client.js";
import type {
  JiraConfig,
  JiraAdfDocument,
  JiraAdfNode,
  JiraBugResult,
  JiraSyncResult,
} from "./types.js";

const SEVERITY_TO_PRIORITY: Record<Severity, string> = {
  critical: "Highest",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Lowest",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "severity-critical",
  high: "severity-high",
  medium: "severity-medium",
  low: "severity-low",
  info: "severity-info",
};

export class JiraService {
  private readonly client: JiraClient;

  constructor(config: JiraConfig) {
    this.client = new JiraClient(config);
  }

  static fromEnv(): JiraService {
    const baseUrl = process.env.JIRA_BASE_URL;
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;

    if (!baseUrl || !email || !apiToken) {
      throw new Error(
        "Missing Jira config. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN in .env"
      );
    }

    return new JiraService({ baseUrl, email, apiToken });
  }

  async listProjects(): Promise<{ key: string; name: string }[]> {
    const projects = await this.client.getProjects();
    return projects.map((p) => ({ key: p.key, name: p.name }));
  }

  async syncBugsToJira(
    report: ScanReport,
    projectKey: string,
    issueType = "Bug"
  ): Promise<JiraSyncResult> {
    const result: JiraSyncResult = {
      projectKey,
      issuesCreated: [],
      errors: [],
    };

    for (const bug of report.bugs) {
      try {
        const bugResult = await this.createBugIssue(
          bug,
          projectKey,
          issueType,
          report.targetUrl
        );
        result.issuesCreated.push(bugResult);
      } catch (error) {
        result.errors.push({
          bugId: bug.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  async createBugIssue(
    bug: Bug,
    projectKey: string,
    issueType = "Bug",
    targetUrl?: string
  ): Promise<JiraBugResult> {
    const description = this.buildDescription(bug, targetUrl);

    const created = await this.client.createIssue({
      fields: {
        summary: `[Lineup] ${bug.title}`,
        description,
        project: { key: projectKey },
        issuetype: { name: issueType },
        priority: { name: SEVERITY_TO_PRIORITY[bug.severity] },
        labels: ["lineup-automated", SEVERITY_LABELS[bug.severity]],
      },
    });

    let attachmentsUploaded = 0;

    for (let i = 0; i < bug.screenshots.length; i++) {
      try {
        const screenshot = bug.screenshots[i];
        const buffer = Buffer.from(screenshot, "base64");
        await this.client.addAttachmentFromBuffer(
          created.key,
          buffer,
          `lineup-bug-${bug.id}-screenshot-${i + 1}.png`
        );
        attachmentsUploaded++;
      } catch {
        // Screenshot attachment is best-effort
      }
    }

    return {
      bugId: bug.id,
      issueKey: created.key,
      issueUrl: this.client.getIssueUrl(created.key),
      attachmentsUploaded,
    };
  }

  private buildDescription(
    bug: Bug,
    targetUrl?: string
  ): JiraAdfDocument {
    const content: JiraAdfNode[] = [];

    // Severity & URL header
    content.push(heading(3, `Severity: ${bug.severity.toUpperCase()}`));

    if (targetUrl) {
      content.push(paragraph([text("Application: "), text(targetUrl, "strong")]));
    }
    content.push(paragraph([text("Page: "), text(bug.url, "strong")]));

    // Description
    content.push(heading(3, "Description"));
    content.push(paragraph([text(bug.description)]));

    // Expected vs Actual
    if (bug.expected || bug.actual) {
      content.push(heading(3, "Expected vs Actual"));
      if (bug.expected) {
        content.push(
          paragraph([text("Expected: ", "strong"), text(bug.expected)])
        );
      }
      if (bug.actual) {
        content.push(
          paragraph([text("Actual: ", "strong"), text(bug.actual)])
        );
      }
    }

    // Steps to reproduce
    if (bug.stepsToReproduce.length > 0) {
      content.push(heading(3, "Steps to Reproduce"));
      content.push({
        type: "orderedList",
        content: bug.stepsToReproduce.map((step) => ({
          type: "listItem",
          content: [paragraph([text(step)])],
        })),
      });
    }

    // Test details
    if (bug.testResult) {
      content.push(heading(3, "Test Details"));
      content.push(
        paragraph([
          text("Test: ", "strong"),
          text(bug.testResult.testCase.name),
        ])
      );
      content.push(
        paragraph([
          text("Result: ", "strong"),
          text(bug.testResult.passed ? "PASSED" : "FAILED"),
        ])
      );
      if (bug.testResult.errorMessage) {
        content.push(
          paragraph([
            text("Error: ", "strong"),
            text(bug.testResult.errorMessage),
          ])
        );
      }
      content.push(
        paragraph([
          text("Duration: ", "strong"),
          text(`${bug.testResult.durationSeconds.toFixed(2)}s`),
        ])
      );
    }

    // Footer
    content.push(rule());
    content.push(
      paragraph([
        text("Generated by ", "em"),
        text("Lineup", "strong"),
        text(` on ${new Date(bug.timestamp).toLocaleString()}`, "em"),
      ])
    );

    return { type: "doc", version: 1, content };
  }
}

// --- ADF helper functions ---

function heading(level: number, text: string): JiraAdfNode {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function text(value: string, mark?: "strong" | "em"): JiraAdfNode {
  const node: JiraAdfNode = { type: "text", text: value };
  if (mark) {
    node.marks = [{ type: mark }];
  }
  return node;
}

function paragraph(children: JiraAdfNode[]): JiraAdfNode {
  return { type: "paragraph", content: children };
}

function rule(): JiraAdfNode {
  return { type: "rule" };
}
