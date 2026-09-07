import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getDataRoot } from '../database/db.js';
// import { requireAuth } from '../middleware/auth.js';

export const fontsRouter = Router();

const WEIGHT_MAP: Record<string, string> = {
  Thin: '100', ExtraLight: '200', Light: '300', Regular: '400',
  Medium: '500', SemiBold: '600', Bold: '700', ExtraBold: '800', Black: '900',
};

function familyNameFromFile(name: string): { family: string; weight: string; style: string } {
  const base = path.basename(name, '.woff2');
  if (/\[wght]/.test(base)) {
    const label = base.replace(/\[wght].*$/, '');
    return { family: label.replace(/([A-Z])/g, ' $1').trim(), weight: '100 900', style: 'normal' };
  }
  const parts = base.split('-');
  if (parts.length === 1) return { family: base, weight: '400', style: 'normal' };
  const suffix = parts.pop() || '';
  const rawFamily = parts.join(' ');
  const family = rawFamily.replace(/([A-Z])/g, ' $1').trim();
  let weight = '400';
  let style: 'normal' | 'italic' = 'normal';
  if (suffix.endsWith('Italic')) {
    style = 'italic';
    const w = suffix.replace('Italic', '');
    weight = WEIGHT_MAP[w] || '400';
  } else if (WEIGHT_MAP[suffix]) {
    weight = WEIGHT_MAP[suffix];
  }
  return { family, weight, style };
}

fontsRouter.get('/', async (_req: any, res) => {
  try {
    const fontDir = path.resolve(getDataRoot(), '..', 'public', 'fonts');
    if (!fs.existsSync(fontDir)) return res.json([]);

    const jsonPath = path.join(fontDir, 'fonts.json');
    let metadata: Record<string, any> = {};
    if (fs.existsSync(jsonPath)) {
      try {
        metadata = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      } catch { }
    }

    const entries = fs.readdirSync(fontDir, { withFileTypes: true });
    const seen = new Set<string>();
    const fonts: any[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.woff2')) continue;
      const meta = metadata[entry.name] || familyNameFromFile(entry.name);
      const key = `${meta.family}|${meta.weight}|${meta.style}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fonts.push({
        family: meta.family,
        url: `/fonts/${entry.name}`,
        weight: meta.weight,
        style: meta.style,
        source: 'core' as const,
      });
    }

    res.json(fonts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
