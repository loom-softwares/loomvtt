/**
 * core/src/api/assets.ts
 *
 * REST routes for Asset uploads.
 * Mounted at /api/assets in core/src/index.ts
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';

import fs from 'fs';
import { getDataRoot } from '../database/db.js';
import logger from '../utils/logger.js';
import { requireAuth, requireWorldMatch } from '../middleware/auth.js';

const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  'image/png': [new Uint8Array([0x89, 0x50, 0x4E, 0x47])],
  'image/jpeg': [new Uint8Array([0xFF, 0xD8, 0xFF])],
  'image/webp': [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  'image/gif': [new Uint8Array([0x47, 0x49, 0x46, 0x38])],
  'audio/mpeg': [new Uint8Array([0xFF, 0xFB]), new Uint8Array([0x49, 0x44, 0x33])],
  'audio/ogg': [new Uint8Array([0x4F, 0x67, 0x67, 0x53])],
  'audio/wav': [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  'video/mp4': [new Uint8Array([0x00, 0x00, 0x00]), new Uint8Array([0x66, 0x74, 0x79, 0x70])],
  'video/webm': [new Uint8Array([0x1A, 0x45, 0xDF, 0xA3])],
};

function validateMagicBytes(filePath: string, mimeType: string): boolean {
  const expectedList = MAGIC_BYTES[mimeType];
  if (!expectedList) return true;
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(8);
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);
  return expectedList.some(sig =>
    sig.every((byte, i) => buf[i] === byte)
  );
}

const DISALLOWED_EXTENSIONS = /\.(svg|html|js|exe|bat|cmd|ps1|sh|php|py)$/i;

const WORLD_ID_RE = /^[\w-]+$/;

// Target upload directory resolved to user AppData / DataRoot
const UPLOADS_DIR = path.resolve(getDataRoot(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    // O multer chama `destination` antes de `filename`, entao guardamos aqui o
    // diretorio ja resolvido — `filename` precisa dele pra checar colisao de
    // nome sem ter que refazer toda a resolucao de caminho.
    const remember = (dir: string) => {
      (req as any).__uploadDir = dir;
      return dir;
    };
    // `?dir=` deixa escrever em qualquer pasta sob getDataRoot() por caminho
    // livre — nao passa pelo `requireWorldMatch` (que so olha `worldId`), entao
    // um jogador comum poderia mandar `?dir=worlds/<outroMundo>/assets` e
    // escrever fora do proprio mundo. So sessao de admin (Setup Hub) pode usar
    // caminho livre; sessao de jogador/GM sempre cai no branch de `worldId` (que
    // ja e validado contra o token pelo requireWorldMatch).
    const dirParam = (req as any).auth?.admin ? ((req.query.dir as string) || '') : '';
    const dataRoot = path.resolve(getDataRoot()) + path.sep;
    if (dirParam) {
      const safeDir = path.normalize(dirParam).replace(/^(\.\.(\/|\\|$))+/g, '');
      const targetDir = path.resolve(getDataRoot(), safeDir);
      if ((targetDir + path.sep).startsWith(dataRoot)) {
        try {
          fs.mkdirSync(targetDir, { recursive: true });
        } catch { /* best-effort */ }
        return cb(null, remember(targetDir));
      }
    }

    // Fallback if no valid dir is provided
    const worldId = (req.query.worldId as string) || '';
    if (worldId && WORLD_ID_RE.test(worldId)) {
      const worldDir = path.join(getDataRoot(), 'worlds', worldId, 'assets');
      try {
        fs.mkdirSync(worldDir, { recursive: true });
      } catch { /* best-effort */ }
      cb(null, remember(worldDir));
    } else {
      cb(null, remember(UPLOADS_DIR));
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    // Sanitizacao minima: tira apenas o que e perigoso num nome de arquivo —
    // separadores de caminho, caracteres proibidos no Windows e caracteres de
    // controle. Acento, espaco e parenteses ficam.
    //
    // Antes o filtro era `[^a-zA-Z0-9_-] -> _`, que transformava todo espaco e
    // todo acento em underscore: "Mapa da Taverna (final).png" chegava no
    // servidor como "Mapa_da_Taverna__final_-83741.png". Num projeto pt-BR isso
    // desfigurava praticamente qualquer upload.
    let baseName = path
      .basename(file.originalname, ext)
      .replace(/[/\\]/g, '_')
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"|?*\x00-\x1f]/g, '_')
      .replace(/^\.+/, '')       // sem nome oculto / travessia
      .trim();

    if (!baseName) baseName = 'arquivo';
    baseName = baseName.slice(0, 120);   // margem pro limite de caminho do SO

    // O sufixo aleatorio deixou de ser incondicional: so entra quando o nome ja
    // existe no destino. Upload unico mantem o nome exato que o usuario enviou.
    const dir = (req as any).__uploadDir as string | undefined;
    let candidate = `${baseName}${ext}`;

    if (dir) {
      let n = 1;
      while (fs.existsSync(path.join(dir, candidate))) {
        candidate = `${baseName} (${n})${ext}`;
        n++;
      }
    }

    cb(null, candidate);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit (videos can be large)
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (DISALLOWED_EXTENSIONS.test(ext)) {
      return cb(new Error('SVG, HTML, and executable files are not allowed.'));
    }
    const allowed = /jpeg|jpg|png|webp|gif|mp3|ogg|wav|mp4|webm|mov/i;
    const isAllowed = allowed.test(ext) || allowed.test(file.mimetype);
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Only images, audio, and video assets are allowed.'));
    }
  }
});

export const assetsRouter = Router();
assetsRouter.use(requireAuth, requireWorldMatch);

// POST /api/assets/upload — Single file upload endpoint
assetsRouter.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided.' });
  }

  // Validate magic bytes (reject files that lie about their extension)
  const savedPath = req.file.path;
  if (!validateMagicBytes(savedPath, req.file.mimetype)) {
    fs.unlinkSync(savedPath);
    return res.status(400).json({ error: 'File content does not match its declared type.' });
  }

  // Generate web path reflecting the actual destination.
  // O nome agora preserva espaco e acento, entao precisa ir codificado na URL —
  // sem isso um "Mapa da Taverna.png" vira caminho quebrado, e um '#' no nome
  // truncaria a URL inteira. `express.static` decodifica do outro lado.
  const encodedName = encodeURIComponent(req.file.filename);
  // Mesmo gate do multer.destination acima — o path devolvido tem que refletir
  // onde o arquivo REALMENTE foi salvo, senao (nao-admin com ?dir= ignorado
  // na gravacao) a resposta mentiria um caminho que nao existe.
  const dirParam = (req as any).auth?.admin ? ((req.query.dir as string) || '') : '';
  let webPath = '';
  if (dirParam) {
    const safeDir = path.normalize(dirParam).replace(/^(\.\.(\/|\\|$))+/g, '').replace(/\\/g, '/');
    webPath = `/${safeDir}${safeDir.endsWith('/') ? '' : '/'}${encodedName}`;
  } else {
    const worldId = (req.query.worldId as string) || '';
    const usedWorldDir = worldId && WORLD_ID_RE.test(worldId);
    webPath = usedWorldDir
      ? `/worlds/${worldId}/assets/${encodedName}`
      : `/uploads/${encodedName}`;
  }
  logger.info('File uploaded successfully', { originalName: req.file.originalname, savedAs: req.file.filename, path: webPath });

  res.json({
    success: true,
    path: webPath,
    name: req.file.originalname,
    size: req.file.size
  });
});

// GET /api/assets/list?dir=uploads/ — list files and subdirectories
assetsRouter.get('/list', (req, res) => {
  try {
    const dirParam = (req.query.dir as string) || 'uploads/';
    const safeDir = path.normalize(dirParam).replace(/^(\.\.(\/|\\|$))+/g, '');
    const LIST_ROOT = path.resolve(getDataRoot());
    const targetDir = path.resolve(LIST_ROOT, safeDir);

    if (!(targetDir + path.sep).startsWith(LIST_ROOT + path.sep)) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    // Sessao de jogador/GM so pode listar a pasta compartilhada (`uploads/`) ou
    // a do proprio mundo (`worlds/<worldId>/...`) — nunca a de outro mundo.
    // So sessao de admin (Setup Hub) navega livre.
    if (!(req as any).auth?.admin) {
      const worldId = (req as any).auth?.worldId || '';
      const normalized = safeDir.replace(/\\/g, '/').replace(/^\/+/, '');
      const allowed = normalized.startsWith('uploads') ||
        (worldId && normalized.startsWith(`worlds/${worldId}`));
      if (!allowed) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }
    if (!fs.existsSync(targetDir)) {
      return res.json({ directories: [], files: [] });
    }

    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const directories: string[] = [];
    const files: { name: string; path: string; type: string; size: number }[] = [];
    const IMAGE_EXT = /\.(png|jpg|jpeg|webp|gif|svg|avif)$/i;
    const AUDIO_EXT = /\.(mp3|ogg|wav)$/i;
    const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

    for (const entry of entries) {
      const relPath = path.join(safeDir, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        directories.push(entry.name + '/');
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        let type = 'unknown';
        if (IMAGE_EXT.test(ext)) type = 'image';
        else if (AUDIO_EXT.test(ext)) type = 'audio';
        else if (VIDEO_EXT.test(ext)) type = 'video';
        const stat = fs.statSync(path.join(targetDir, entry.name));
        files.push({ name: entry.name, path: '/' + relPath, type, size: stat.size });
      }
    }

    res.json({ directories: directories.sort(), files: files.sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (err: any) {
    logger.error('GET /api/assets/list failed', { error: err.message });
    res.status(500).json({ error: 'Failed to list assets.' });
  }
});

// Error boundary for Multer size limits or file filters
assetsRouter.use((err: any, _req: any, res: any, _next: any) => {
  logger.error('Multer file upload error', { error: err.message });
  res.status(400).json({ error: err.message });
});
