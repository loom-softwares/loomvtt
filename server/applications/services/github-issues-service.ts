import logger from '../utils/logger.js';

interface IssuePayload {
  id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  worldId: string;
  reporterId?: string;
}

export interface GithubIssueResult {
  issueNumber: number;
  issueUrl: string;
}

export function isGithubIssuesConfigured(): boolean {
  return Boolean(process.env.GITHUB_ISSUES_TOKEN && process.env.GITHUB_ISSUES_REPO);
}

export async function createGithubIssue(payload: IssuePayload): Promise<GithubIssueResult> {
  const token = process.env.GITHUB_ISSUES_TOKEN;
  const repo = process.env.GITHUB_ISSUES_REPO;

  if (!token || !repo) {
    throw new Error('GITHUB_ISSUES_TOKEN ou GITHUB_ISSUES_REPO não estão configurados no servidor.');
  }

  const categoryLabel = payload.category || 'other';
  const severityLabel = payload.severity || 'medium';

  const bodyContent = [
    '### 🐛 Bug Report via LoomVTT',
    '',
    '**Descrição:**',
    payload.description?.trim() || '_Nenhuma descrição fornecida._',
    '',
    '---',
    '',
    `- **Categoria:** \`${categoryLabel}\``,
    `- **Severidade:** \`${severityLabel}\``,
    `- **Versão do Engine:** \`v1.0.0-alpha\``,
    `- **Report ID Local:** \`${payload.id}\``,
    `- **World ID:** \`${payload.worldId}\``,
  ].join('\n');

  const url = `https://api.github.com/repos/${repo}/issues`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'LoomVTT-Server',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `[${categoryLabel.toUpperCase()}] ${payload.title}`,
        body: bodyContent,
        labels: ['bug', categoryLabel, severityLabel],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error('Erro na chamada da GitHub API', { status: res.status, body: errorText });
      throw new Error(`GitHub API erro ${res.status}: ${errorText}`);
    }

    const data: any = await res.json();
    logger.info('Issue criada com sucesso no GitHub', { issueNumber: data.number, html_url: data.html_url });

    return {
      issueNumber: data.number,
      issueUrl: data.html_url,
    };
  } catch (err: any) {
    logger.error('Falha ao conectar ao GitHub Issues', { error: err.message });
    throw err;
  }
}
