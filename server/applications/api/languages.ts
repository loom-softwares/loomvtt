import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const languagesRouter = Router();

// GET /api/languages/:lang — Retrieve localization dictionary for a language
languagesRouter.get('/:lang', async (req, res) => {
  const { lang } = req.params;
  try {
    // 1. Try to read main locales.json from project root/dist or src
    const localesPath = path.resolve(__dirname, '..', 'locales.json');
    let data: any = {};
    
    try {
      const raw = await fs.readFile(localesPath, 'utf8');
      data = JSON.parse(raw);
    } catch {
      // Fallback if not found in root (e.g. running in built dist)
      const fallbackPath = path.resolve(__dirname, '..', '..', 'src', 'locales.json');
      const rawFallback = await fs.readFile(fallbackPath, 'utf8');
      data = JSON.parse(rawFallback);
    }

    const dict = data[lang] || data['en'] || {};
    res.json(dict);
  } catch (err: any) {
    res.status(500).json({ error: 'Language file not found or invalid' });
  }
});

// GET /api/languages — List supported language codes
languagesRouter.get('/', async (_req, res) => {
  try {
    const localesPath = path.resolve(__dirname, '..', 'locales.json');
    let data: any = {};
    
    try {
      const raw = await fs.readFile(localesPath, 'utf8');
      data = JSON.parse(raw);
    } catch {
      const fallbackPath = path.resolve(__dirname, '..', '..', 'src', 'locales.json');
      const rawFallback = await fs.readFile(fallbackPath, 'utf8');
      data = JSON.parse(rawFallback);
    }

    res.json(Object.keys(data));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve languages list' });
  }
});
