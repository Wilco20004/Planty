import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { Sensor } from '../types';
import { subscribeSensor, unsubscribeSensor } from '../services/mqtt';

// Mounted at /api/plants/:plantId/sensors
export const plantSensorsRouter = Router({ mergeParams: true });

plantSensorsRouter.post('/', (req, res) => {
  const plantId = (req.params as any).plantId as string;
  const plant = db.prepare('SELECT id FROM plants WHERE id = ?').get(plantId);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });

  const { type, name, mqtt_topic, unit } = req.body;
  if (!type || !mqtt_topic) {
    return res.status(400).json({ error: 'type and mqtt_topic are required' });
  }
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO sensors (id, plant_id, type, name, mqtt_topic, unit, latest_value, latest_seen_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?)`
  ).run(id, plantId, type, name ?? null, mqtt_topic, unit ?? null, now);
  const sensor = db.prepare('SELECT * FROM sensors WHERE id = ?').get(id) as Sensor;
  subscribeSensor(sensor);
  res.status(201).json(sensor);
});

// Mounted at /api/sensors
export const sensorsRouter = Router();

sensorsRouter.get('/:id/readings', (req, res) => {
  const rows = db
    .prepare('SELECT value, recorded_at FROM sensor_readings WHERE sensor_id = ? ORDER BY recorded_at DESC LIMIT 100')
    .all(req.params.id);
  res.json(rows);
});

sensorsRouter.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM sensors WHERE id = ?').get(req.params.id) as Sensor | undefined;
  if (!existing) return res.status(404).json({ error: 'Sensor not found' });
  unsubscribeSensor(existing);
  db.prepare('DELETE FROM sensors WHERE id = ?').run(req.params.id);
  res.status(204).end();
});
