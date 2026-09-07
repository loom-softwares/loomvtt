import { Router } from 'express';
import { randomUUID } from 'crypto';
import { CampaignsDocument } from '../schemas/campaigns.schema.js';
import { Signal } from '../signals/index.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

export const campaignsRouter = Router();
campaignsRouter.use(requireAuth, requireWorldMatch);

// GET /api/campaigns — List all campaign packages
campaignsRouter.get('/', async (_req, res) => {
  try {
    const campaigns = await CampaignsDocument.find({
      orderBy: [{ column: 'createdAt', dir: 'asc' }],
    });
    res.json(campaigns);
  } catch (err: any) {
    logger.error('GET /campaigns failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/campaigns/:id — Get details of a campaign package
campaignsRouter.get('/:id', async (req, res) => {
  try {
    const campaign = await CampaignsDocument.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json(campaign);
  } catch (err: any) {
    logger.error('GET /campaigns/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns — Create a campaign package
campaignsRouter.post('/', async (req, res) => {
  try {
    const { name, description, manifest } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const id = `camp-${randomUUID()}`;
    const result = await CampaignsDocument.create({
      id,
      name,
      description: description ?? '',
      manifest: manifest ?? {},
    });
    if (result.error) return res.status(400).json({ error: result.error });
    Signal.broadcast('campaign.created', result.data);
    res.status(201).json(result.data);
  } catch (err: any) {
    logger.error('POST /campaigns failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/campaigns/:id — Update campaign package metadata
campaignsRouter.put('/:id', async (req, res) => {
  try {
    const { name, description, manifest } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (manifest !== undefined) updates.manifest = manifest;

    const result = await CampaignsDocument.update(req.params.id, updates);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('campaign.updated', result.data);
    res.json(result.data);
  } catch (err: any) {
    logger.error('PUT /campaigns/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/campaigns/:id — Delete a campaign package
campaignsRouter.delete('/:id', async (req, res) => {
  try {
    const result = await CampaignsDocument.delete(req.params.id);
    if (result.error) return res.status(404).json({ error: result.error });
    Signal.broadcast('campaign.deleted', { id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    logger.error('DELETE /campaigns/:id failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});
