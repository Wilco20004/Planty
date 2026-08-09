import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { CareTask } from '../types';
import { onPlantChanged } from '../services/mqtt';

// Mounted at /api/plants/:plantId/tasks
export const plantTasksRouter = Router({ mergeParams: true });

plantTasksRouter.post('/', (req, res) => {
  const plantId = (req.params as any).plantId as string;
  const plant = db.prepare('SELECT id FROM plants WHERE id = ?').get(plantId);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });

  const { task_type, label, interval_days, notes, last_completed_at } = req.body;
  if (!task_type || !interval_days || Number(interval_days) <= 0) {
    return res.status(400).json({ error: 'task_type and a positive interval_days are required' });
  }
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO care_tasks (id, plant_id, task_type, label, interval_days, last_completed_at, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, plantId, task_type, label ?? null, Number(interval_days), last_completed_at ?? null, notes ?? null, now, now);
  onPlantChanged(plantId);
  res.status(201).json(db.prepare('SELECT * FROM care_tasks WHERE id = ?').get(id));
});

// Mounted at /api/tasks
export const tasksRouter = Router();

tasksRouter.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM care_tasks WHERE id = ?').get(req.params.id) as CareTask | undefined;
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const { task_type, label, interval_days, notes, last_completed_at } = req.body;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE care_tasks SET task_type = ?, label = ?, interval_days = ?, notes = ?, last_completed_at = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    task_type ?? existing.task_type,
    label ?? null,
    interval_days ? Number(interval_days) : existing.interval_days,
    notes ?? null,
    last_completed_at !== undefined ? last_completed_at : existing.last_completed_at,
    now,
    req.params.id
  );
  onPlantChanged(existing.plant_id);
  res.json(db.prepare('SELECT * FROM care_tasks WHERE id = ?').get(req.params.id));
});

tasksRouter.post('/:id/complete', (req, res) => {
  const existing = db.prepare('SELECT * FROM care_tasks WHERE id = ?').get(req.params.id) as CareTask | undefined;
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const completedAt = req.body?.completed_at || new Date().toISOString();
  db.prepare('UPDATE care_tasks SET last_completed_at = ?, updated_at = ? WHERE id = ?').run(
    completedAt,
    new Date().toISOString(),
    req.params.id
  );
  onPlantChanged(existing.plant_id);
  res.json(db.prepare('SELECT * FROM care_tasks WHERE id = ?').get(req.params.id));
});

tasksRouter.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM care_tasks WHERE id = ?').get(req.params.id) as CareTask | undefined;
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM care_tasks WHERE id = ?').run(req.params.id);
  onPlantChanged(existing.plant_id);
  res.status(204).end();
});
