import { Router } from 'express';
import { SettingsDocument } from '../schemas/settings.schema.js';
import logger from '../utils/logger.js';
import { requireAdminSession } from './setup.js';

export const settingsRouter = Router();

settingsRouter.get('/', requireAdminSession, async (_req, res) => {
  try {
    const rows = await SettingsDocument.find();
    const map: Record<string, any> = {};
    for (const row of rows) {
      if (row.key === 'admin_password') continue;
      map[row.key] = row.value;
    }
    res.json(map);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.post('/', requireAdminSession, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });
    const result = await SettingsDocument.create({ key, value }, undefined, { upsert: true });
    if (result.error) return res.status(400).json({ error: result.error });
    logger.info('Setting saved', { key });
    res.json({ key, value });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.get('/:key', requireAdminSession, async (req, res) => {
  try {
    const row = await SettingsDocument.findById(req.params.key);
    if (!row) return res.status(404).json({ error: 'Setting not found' });
    res.json({ key: row.key, value: row.value });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
