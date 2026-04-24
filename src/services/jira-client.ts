import https from 'node:https';
import type { JiraSpec } from '../types/jira-spec.js';

interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
}

function adfToText(node: AdfNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';

  const children = (node.content ?? []).map(adfToText).join('');

  if (node.type === 'paragraph' || node.type === 'heading') return `${children}\n`;
  if (node.type === 'listItem') return `- ${children}`;
  if (node.type === 'codeBlock') return `\`\`\`\n${children}\`\`\`\n`;

  return children;
}

function httpsGet(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
}

export class JiraClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor() {
    const baseUrl = process.env.JIRA_BASE_URL;
    const email = process.env.JIRA_EMAIL;
    const token = process.env.JIRA_API_TOKEN;

    if (!baseUrl || !email || !token) {
      throw new Error('Missing JIRA_BASE_URL, JIRA_EMAIL, or JIRA_API_TOKEN env vars');
    }

    this.baseUrl = baseUrl;
    this.authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
  }

  async getSpec(ticketKey: string): Promise<JiraSpec> {
    const url = `${this.baseUrl}/rest/api/3/issue/${ticketKey}?fields=summary,description`;

    const { status, body } = await httpsGet(url, {
      Authorization: this.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });

    if (status !== 200) {
      throw new Error(`Jira API error for ${ticketKey}: ${status}\n${body}`);
    }

    const data = JSON.parse(body) as {
      fields: { summary: string; description: AdfNode | null };
    };

    const description = data.fields.description
      ? adfToText(data.fields.description).trim()
      : '';

    return {
      ticketKey,
      summary: data.fields.summary,
      description,
    };
  }
}
