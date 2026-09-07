import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { requireGM } from '../middleware/permissions.js';
import { getAccountStatus, connectWithGoogleExchange, disconnectAccount } from '../licensing/loom-account.js';
import logger from '../utils/logger.js';

export const loomAccountRouter = Router();

// Qualquer GM de qualquer mundo desta instalacao pode ver o status (a conta e
// por instalacao, nao por mundo) e usar o que ja esta comprado. Conectar/
// desconectar mexe em algo que representa dinheiro/pareamento real — fica
// restrito ao Admin de verdade (sessao do Setup Hub), nao a qualquer GM.
loomAccountRouter.get('/status', requireAuth, requireGM, async (_req, res) => {
  res.json(await getAccountStatus());
});

loomAccountRouter.post('/connect-google', requireAdmin, async (req, res) => {
  const { exchangeCode, refreshToken } = req.body as { exchangeCode?: string; refreshToken?: string };
  if (!exchangeCode || typeof exchangeCode !== 'string') {
    return res.status(400).json({ error: 'exchangeCode e obrigatorio' });
  }
  try {
    const result = await connectWithGoogleExchange(exchangeCode.trim(), refreshToken?.trim());
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('POST /loom-account/connect-google failed', { error: err.message });
    res.status(500).json({ error: 'Falha ao conectar' });
  }
});

loomAccountRouter.post('/disconnect', requireAdmin, async (_req, res) => {
  await disconnectAccount();
  res.json({ ok: true });
});

