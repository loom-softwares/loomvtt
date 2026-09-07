/**
 * core/src/api/export.ts
 *
 * Route to export offline standalone static site package.
 * Mounted at /api/export in core/src/index.ts
 */

import { Router } from 'express';
import { CastsDocument } from '../schemas/cast.schema.js';
import logger from '../utils/logger.js';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const exportRouter = Router();

// GET /api/export/offline — Returns a single self-contained HTML page containing all characters (cast) and notes
exportRouter.get('/offline', async (_req, res) => {
  try {
    const characters = await CastsDocument.find();

    const escape = escapeHtml;
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LoomVTT — Standalone Offline Guild Log</title>
  <style>
    :root {
      --bg-dark: #0f111a;
      --bg-card: #151824;
      --accent: #6366f1;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --border: rgba(255,255,255,0.08);
    }
    body {
      background-color: var(--bg-dark);
      color: var(--text);
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    header h1 {
      margin: 0;
      color: #fff;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 15px;
    }
    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--accent);
      object-fit: cover;
    }
    .name-kind h2 {
      margin: 0;
      font-size: 1.1rem;
      color: #fff;
    }
    .name-kind span {
      font-size: 0.8rem;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    .traits-list {
      margin-top: 15px;
      border-top: 1px solid var(--border);
      padding-top: 10px;
    }
    .trait-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 0.85rem;
    }
    .trait-label {
      color: var(--text-muted);
    }
    .trait-value {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>LoomVTT Standalone Guild Log</h1>
      <p style="color: var(--text-muted); margin: 5px 0 0 0;">Offline backup. Generated on ${new Date().toLocaleDateString()}</p>
    </header>

    <main class="grid">
      ${characters.map(char => `
        <article class="card">
          <div class="card-header">
            ${char.avatarUrl ? `<img src="${escape(char.avatarUrl)}" class="avatar" alt="${escape(char.name)}" />` : `<div class="avatar" style="background: ${escape(char.ringColor || '#6366f1')}"></div>`}
            <div class="name-kind">
              <h2>${escape(char.name)}</h2>
              <span>${escape(char.kind || 'Adventurer')}</span>
            </div>
          </div>
          <div class="traits-list">
            ${Object.entries(char.traits).map(([key, val]) => `
              <div class="trait-row">
                <span class="trait-label">${escape(key)}</span>
                <span class="trait-value">${escape(String(val))}</span>
              </div>
            `).join('')}
          </div>
        </article>
      `).join('')}
    </main>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename=offline-guild-log.html');
    res.send(htmlContent);
  } catch (err: any) {
    logger.error('Offline export failed', { error: err.message });
    res.status(500).json({ error: 'Failed to generate offline export package' });
  }
});
