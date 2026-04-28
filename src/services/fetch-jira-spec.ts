import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
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

export async function fetchJiraSpec(ticketKey: string): Promise<JiraSpec> {
  const siteUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!siteUrl || !email || !token) {
    throw new Error('Missing JIRA_BASE_URL, JIRA_EMAIL, or JIRA_API_TOKEN env vars');
  }

  const siteName = new URL(siteUrl).hostname.split('.')[0];

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', '@aashari/mcp-server-atlassian-jira'],
    env: {
      ...process.env,
      ATLASSIAN_SITE_NAME: siteName,
      ATLASSIAN_USER_EMAIL: email,
      ATLASSIAN_API_TOKEN: token,
    } as Record<string, string>,
  });

  const client = new Client({ name: 'lineup', version: '1.0.0' }, {});
  await client.connect(transport);

  try {
    const result = await client.callTool({
      name: 'jira_get',
      arguments: {
        path: `/rest/api/3/issue/${ticketKey}`,
        queryParams: { fields: 'summary,description' },
        outputFormat: 'json',
      },
    });

    const text = (result.content as Array<{ type: string; text: string }>)
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');

    const data = JSON.parse(text) as {
      fields: { summary: string; description: AdfNode | null };
    };

    const description = data.fields.description
      ? adfToText(data.fields.description).trim()
      : '';

    return { ticketKey, summary: data.fields.summary, description };
  } finally {
    await client.close();
  }
}
