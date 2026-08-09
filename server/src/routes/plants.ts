import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { CareTask, Plant, Sensor } from '../types';
import { withStatus, worstStatus } from '../services/schedule';
import { onPlantChanged, onPlantDeleted } from '../services/mqtt';

export const plantsRouter = Router();

function loadPlant(id: string) {
  const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(id) as Plant | undefined;
  if (!plant) return null;
  const tasks = db
    .prepare('SELECT * FROM care_tasks WHERE plant_id = ? ORDER BY created_at ASC')
    .all(id) as CareTask[];
  const sensors = db
    .prepare('SELECT * FROM sensors WHERE plant_id = ? ORDER BY created_at ASC')
    .all(id) as Sensor[];
  const tasksWithStatus = tasks.map(withStatus);
  return {
    ...plant,
    care_tasks: tasksWithStatus,
    sensors,
    worst_status: worstStatus(tasksWithStatus.map((t) => t.status)),
  };
}

plantsRouter.get('/', (_req, res) => {
  const rows = db.prepare('SELECT id FROM plants ORDER BY name ASC').all() as { id: string }[];
  const plants = rows.map((r) => loadPlant(r.id));
  res.json(plants);
});

plantsRouter.get('/:id', (req, res) => {
  const plant = loadPlant(req.params.id);
  if (!plant) return res.status(404).json({ error: 'Plant not found' });
  res.json(plant);
});

plantsRouter.post('/', (req, res) => {
  const { name, species, scientific_name, location, light_requirement, notes, perenual_species_id, custom_species_id } =
    req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO plants (id, name, species, scientific_name, location, light_requirement, photo_path, notes, perenual_species_id, custom_species_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    species ?? null,
    scientific_name ?? null,
    location ?? null,
    light_requirement ?? null,
    notes ?? null,
    perenual_species_id ?? null,
    custom_species_id ?? null,
    now,
    now
  );
  res.status(201).json(loadPlant(id));
});

plantsRouter.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM plants WHERE id = ?').get(req.params.id) as Plant | undefined;
  if (!existing) return res.status(404).json({ error: 'Plant not found' });

  const { name, species, scientific_name, location, light_requirement, notes, perenual_species_id, custom_species_id } =
    req.body;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE plants SET name = ?, species = ?, scientific_name = ?, location = ?, light_requirement = ?, notes = ?, perenual_species_id = ?, custom_species_id = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    name !== undefined ? name : existing.name,
    species !== undefined ? species : existing.species,
    scientific_name !== undefined ? scientific_name : existing.scientific_name,
    location !== undefined ? location : existing.location,
    light_requirement !== undefined ? light_requirement : existing.light_requirement,
    notes !== undefined ? notes : existing.notes,
    perenual_species_id !== undefined ? perenual_species_id : existing.perenual_species_id,
    custom_species_id !== undefined ? custom_species_id : existing.custom_species_id,
    now,
    req.params.id
  );
  const plant = loadPlant(req.params.id);
  onPlantChanged(req.params.id);
  res.json(plant);
});

plantsRouter.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM plants WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Plant not found' });
  onPlantDeleted(req.params.id);
  db.prepare('DELETE FROM plants WHERE id = ?').run(req.params.id);
  res.status(204).end();
});
