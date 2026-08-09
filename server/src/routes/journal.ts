import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { db, UPLOADS_DIR } from '../db';
import { JournalEntry } from '../types';

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

// Mounted at /api/plants/:plantId/journal
export const plantJournalRouter = Router({ mergeParams: true });

plantJournalRouter.get('/', (req, res) => {
  const plantId = (req.params as any).plantId as string;
  const entries = db
    .prepare('SELECT * FROM plant_journal_entries WHERE plant_id = ? ORDER BY entry_date ASC, created_at ASC')
    .all(plantId) as JournalEntry[];
  res.json(entries);
});

plantJournalRouter.post('/', upload.single('photo'), (req, res) => {
  const plantId = (req.params as any).plantId as string;
  const plant = db.prepare('SELECT id FROM plants WHERE id = ?').get(plantId);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });

  const { entry_date, note } = req.body;
  if (!note && !req.file) {
    return res.status(400).json({ error: 'Provide a note, a photo, or both' });
  }
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO plant_journal_entries (id, plant_id, entry_date, note, photo_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, plantId, entry_date || now.slice(0, 10), note || null, req.file?.filename ?? null, now);
  res.status(201).json(db.prepare('SELECT * FROM plant_journal_entries WHERE id = ?').get(id));
});

// Mounted at /api/journal
export const journalRouter = Router();

journalRouter.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM plant_journal_entries WHERE id = ?').get(req.params.id) as
    | JournalEntry
    | undefined;
  if (!existing) return res.status(404).json({ error: 'Journal entry not found' });
  if (existing.photo_path) {
    fs.unlink(path.join(UPLOADS_DIR, existing.photo_path), () => {});
  }
  db.prepare('DELETE FROM plant_journal_entries WHERE id = ?').run(req.params.id);
  res.status(204).end();
});
