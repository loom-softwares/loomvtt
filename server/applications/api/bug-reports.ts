import { Router } from 'express';
import { randomUUID } from 'crypto';
import { BugReportsDocument } from '../schemas/bug-reports.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';
import { createGithubIssue, isGithubIssuesConfigured } from '../services/github-issues-service.js';

export const bugReportsRouter = Router();
bugReportsRouter.use(requireAuth, requireWorldMatch);

bugReportsRouter.get('/status/github', async (_req, res) => {
  res.json({ configured: isGithubIssuesConfigured() });
});

bugReportsRouter.get('/', async (req, res) => {
  try {
    const { worldId } = req.query;
    if (!worldId) return res.status(400).json({ error: 'worldId is required' });
    const bugs = await BugReportsDocument.find({
      worldId: String(worldId),
      orderBy: [{ column: 'createdAt', dir: 'desc' }],
    });
    res.json(bugs);
  } catch (err: any) {
    logger.error('GET /bug-reports failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

bugReportsRouter.get('/:id', async (req, res) => {
  try {
    const bug = await BugReportsDocument.findOne({ id: req.params.id });
    if (!bug) return res.status(404).json({ error: 'Bug report not found' });
    res.json(bug);
  } catch (err: any) {
    logger.error('GET /bug-reports/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

bugReportsRouter.post('/', async (req, res) => {
  try {
    const { worldId, title, description, severity, category, syncToGithub } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!worldId) return res.status(400).json({ error: 'worldId is required' });

    const id = `bug-${randomUUID()}`;
    let metadata: Record<string, any> = {};

    if (syncToGithub && isGithubIssuesConfigured()) {
      try {
        const gh = await createGithubIssue({
          id,
          worldId,
          title,
          description: description ?? '',
          severity: severity ?? 'medium',
          category: category ?? 'other',
          reporterId: (req as any).userId ?? '',
        });
        metadata = {
          githubIssueNumber: gh.issueNumber,
          githubIssueUrl: gh.issueUrl,
        };
      } catch (ghErr: any) {
        logger.warn('Falha ao sincronizar com GitHub Issues durante criacao', { error: ghErr.message });
      }
    }

    const result = await BugReportsDocument.create({
      id,
      worldId,
      title,
      description: description ?? '',
      severity: severity ?? 'medium',
      category: category ?? 'other',
      status: 'open',
      reporterId: (req as any).userId || (req as any).auth?.userId || 'gm',
      metadata,
    });
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('bug-report.created', result.data);
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /bug-reports failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

bugReportsRouter.post('/:id/github', async (req, res) => {
  try {
    const bug = await BugReportsDocument.findOne({ id: req.params.id });
    if (!bug) return res.status(404).json({ error: 'Bug report not found' });

    const currentMeta = typeof (bug as any).metadata === 'string'
      ? JSON.parse((bug as any).metadata || '{}')
      : ((bug as any).metadata || {});

    if (currentMeta.githubIssueUrl) {
      return res.json({ message: 'Bug ja publicado no GitHub', data: bug });
    }

    const gh = await createGithubIssue({
      id: (bug as any).id,
      worldId: (bug as any).worldId,
      title: (bug as any).title,
      description: (bug as any).description ?? '',
      severity: (bug as any).severity ?? 'medium',
      category: (bug as any).category ?? 'other',
      reporterId: (bug as any).reporterId,
    });

    const updatedMeta = {
      ...currentMeta,
      githubIssueNumber: gh.issueNumber,
      githubIssueUrl: gh.issueUrl,
    };

    const result = await BugReportsDocument.update(req.params.id, {
      metadata: updatedMeta,
    });

    if (result.error) return res.status(500).json({ error: result.error });
    Signal.broadcast('bug-report.updated', result.data);
    res.json(result.data);
  } catch (err: any) {
    logger.error('POST /bug-reports/:id/github failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

bugReportsRouter.put('/:id', async (req, res) => {
  try {
    const { title, description, severity, category, status } = req.body;
    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (severity !== undefined) updates.severity = severity;
    if (category !== undefined) updates.category = category;
    if (status !== undefined) updates.status = status;

    const result = await BugReportsDocument.update(req.params.id, updates);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('bug-report.updated', result.data);
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /bug-reports/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

bugReportsRouter.delete('/:id', async (req, res) => {
  try {
    const result = await BugReportsDocument.delete(req.params.id);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('bug-report.deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE /bug-reports/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

