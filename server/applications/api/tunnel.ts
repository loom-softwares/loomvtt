import { Router } from 'express';
import { requireAdminSession } from './setup.js';
import { tunnelManager } from '../services/tunnel-manager.js';
import fs from 'fs/promises';
import { getConfigPath } from '../database/db.js';

export const tunnelRouter = Router();

// Túnel é escopo de SERVIDOR (expõe a instância inteira, config vive em
// loom.config.json) — logo a gate é a sessão de admin do Setup Hub, não a
// sessão de mundo (requireAuth/requireGM), que nem existe no painel de admin.
tunnelRouter.use(requireAdminSession);

tunnelRouter.post('/start', async (req, res) => {
  const { mode, name } = req.body;
  
  if (mode !== 'quick' && mode !== 'named') {
    return res.status(400).json({ error: 'Invalid mode. Must be "quick" or "named".' });
  }

  try {
    const status = await tunnelManager.start(mode, name);
    
    // Save state to loom.config.json
    try {
      const raw = await fs.readFile(getConfigPath(), 'utf8');
      const fileConfig = JSON.parse(raw);
      fileConfig.tunnelMode = mode;
      if (mode === 'named' && name) {
        fileConfig.tunnelName = name;
      }
      await fs.writeFile(getConfigPath(), `${JSON.stringify(fileConfig, null, 2)}\n`, 'utf8');
    } catch (e) {
      console.warn('Failed to persist tunnel state to loom.config.json', e);
    }
    
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

tunnelRouter.post('/stop', async (req, res) => {
  try {
    tunnelManager.stop();
    
    // Save to loom.config.json
    try {
      const raw = await fs.readFile(getConfigPath(), 'utf8');
      const fileConfig = JSON.parse(raw);
      fileConfig.tunnelMode = 'off';
      await fs.writeFile(getConfigPath(), `${JSON.stringify(fileConfig, null, 2)}\n`, 'utf8');
    } catch (e) {
      console.warn('Failed to persist tunnel state to loom.config.json', e);
    }

    res.json(tunnelManager.getStatus());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

tunnelRouter.get('/status', (req, res) => {
  res.json(tunnelManager.getStatus());
});
