import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { UPLOADS_DIR } from '../db';
import { Plant } from '../types';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only jpg, png, or webp images are allowed'));
  },
});

export const uploadsRouter = Router();

uploadsRouter.post('/plants/:id/photo', upload.single('photo'), (req, res) => {
  const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(req.params.id) as Plant | undefined;
  if (!plant) return res.status(404).json({ error: 'Plant not found' });
  if (!req.file) return res.status(400).json({ error: 'photo file is required' });

  if (plant.photo_path) {
    const oldPath = path.join(UPLOADS_DIR, plant.photo_path);
    fs.unlink(oldPath, () => {});
  }

  db.prepare('UPDATE plants SET photo_path = ?, updated_at = ? WHERE id = ?').run(
    req.file.filename,
    new Date().toISOString(),
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM plants WHERE id = ?').get(req.params.id));
});
