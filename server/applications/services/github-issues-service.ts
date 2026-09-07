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
  // Configurado se houver token direto OU se houver URL do LoomSite para proxy
  return Boolean(
    (process.env.GITHUB_ISSUES_TOKEN && process.env.GITHUB_ISSUES_REPO) ||
    process.env.LOOM_SITE_URL ||
    true // O fallback para https://loomsite.vercel.app é sempre ativo
  );
}

export async function createGithubIssue(payload: IssuePayload): Promise<GithubIssueResult> {
  const token = process.env.GITHUB_ISSUES_TOKEN;
  const repo = process.env.GITHUB_ISSUES_REPO || 'loom-softwares/loomvtt';
  const loomSiteUrl = process.env.LOOM_SITE_URL || 'https://loomsite.vercel.app';

  const categoryLabel = payload.category || 'other';
  const severityLabel = payload.severity || 'medium';
  const platformName = process.platform === 'win32' ? 'Desktop app (Windows)' : 'Desktop app / Browser';

  // 1. Se tiver token configurado localmente (ex: ambiente de desenvolvimento), posta direto:
  if (token) {
    const bodyContent = [
      '### LoomVTT Version',
      'v1.0.0-alpha',
      '',
      '### Platform',
      platformName,
      '',
      '### What happened?',
      payload.description?.trim() || payload.title,
      '',
      '### What did you expect to happen?',
      'Funcionamento esperado sem erros ou falhas.',
      '',
      '### Additional Context',
      `- **Category:** \`${categoryLabel}\``,
      `- **Severity:** \`${severityLabel}\``,
      `- **Local Report ID:** \`${payload.id}\``,
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
          title: `[Bug]: ${payload.title}`,
          body: bodyContent,
          labels: ['bug', categoryLabel, severityLabel],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        logger.error('Erro na chamada direta da GitHub API', { status: res.status, body: errorText });
        throw new Error(`GitHub API erro ${res.status}: ${errorText}`);
      }

      const data: any = await res.json();
      logger.info('Issue criada com sucesso no GitHub (direto)', { issueNumber: data.number, html_url: data.html_url });

      return {
        issueNumber: data.number,
        issueUrl: data.html_url,
      };
    } catch (err: any) {
      logger.error('Falha ao conectar ao GitHub Issues diretamente', { error: err.message });
      throw err;
    }
  }

  // 2. Se NÃO tiver token local (caso dos jogadores/release), passa pelo proxy seguro do LoomSite:
  logger.info('[GithubIssues] Sem token local, enviando via LoomSite central...', { loomSiteUrl });
  try {
    const res = await fetch(`${loomSiteUrl}/api/report-bug`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: payload.title,
        description: payload.description,
        category: categoryLabel,
        severity: severityLabel,
        version: 'v1.0.0-alpha',
        platform: platformName,
        source: 'app',
        reporter: payload.reporterId,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error('Erro ao enviar report via LoomSite', { status: res.status, body: errorText });
      throw new Error(`LoomSite proxy erro ${res.status}: ${errorText}`);
    }

    const data: any = await res.json();
    logger.info('Issue criada com sucesso no GitHub (via LoomSite)', { issueNumber: data.issueNumber, html_url: data.issueUrl });

    return {
      issueNumber: data.issueNumber,
      issueUrl: data.issueUrl,
    };
  } catch (err: any) {
    logger.error('Falha ao enviar report para o LoomSite proxy', { error: err.message });
    throw err;
  }
}

