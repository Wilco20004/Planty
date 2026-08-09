import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { CustomSpecies, PlantLookupMatch, SpeciesInfo } from '../types';

function boolToInt(v: boolean | null | undefined): number | null {
  if (v === true) return 1;
  if (v === false) return 0;
  return null;
}

function intToBool(v: number | null): boolean | null {
  if (v === 1) return true;
  if (v === 0) return false;
  return null;
}

function rowToSpecies(row: any): CustomSpecies {
  return {
    id: row.id,
    common_name: row.common_name,
    scientific_name: row.scientific_name,
    thumbnail: row.thumbnail,
    light_requirement: row.light_requirement,
    sunlight_description: row.sunlight_description,
    watering_interval_days: row.watering_interval_days,
    watering_description: row.watering_description,
    family: row.family,
    plant_type: row.plant_type,
    cycle: row.cycle,
    origin: row.origin,
    dimensions: row.dimensions,
    description: row.description,
    care_level: row.care_level,
    growth_rate: row.growth_rate,
    drought_tolerant: intToBool(row.drought_tolerant),
    indoor: intToBool(row.indoor),
    poisonous_to_humans: intToBool(row.poisonous_to_humans),
    poisonous_to_pets: intToBool(row.poisonous_to_pets),
    pruning_months: row.pruning_months,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function listCustomSpecies(): CustomSpecies[] {
  const rows = db.prepare('SELECT * FROM custom_species ORDER BY common_name ASC').all();
  return rows.map(rowToSpecies);
}

export function getCustomSpecies(id: string): CustomSpecies | null {
  const row = db.prepare('SELECT * FROM custom_species WHERE id = ?').get(id);
  return row ? rowToSpecies(row) : null;
}

export function searchCustomSpecies(query: string): PlantLookupMatch[] {
  const like = `%${query}%`;
  const rows = db
    .prepare('SELECT * FROM custom_species WHERE common_name LIKE ? OR scientific_name LIKE ? ORDER BY common_name ASC LIMIT 10')
    .all(like, like);
  return rows.map((row: any) => ({
    id: row.id,
    source: 'custom' as const,
    common_name: row.common_name,
    scientific_name: row.scientific_name,
    thumbnail: row.thumbnail,
  }));
}

export function createCustomSpecies(data: Partial<SpeciesInfo>): CustomSpecies {
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO custom_species (
      id, common_name, scientific_name, thumbnail, light_requirement, sunlight_description,
      watering_interval_days, watering_description, family, plant_type, cycle, origin, dimensions,
      description, care_level, growth_rate, drought_tolerant, indoor, poisonous_to_humans,
      poisonous_to_pets, pruning_months, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.common_name || 'Unnamed plant',
    data.scientific_name ?? null,
    data.thumbnail ?? null,
    data.light_requirement ?? null,
    data.sunlight_description ?? null,
    data.watering_interval_days ?? null,
    data.watering_description ?? null,
    data.family ?? null,
    data.plant_type ?? null,
    data.cycle ?? null,
    data.origin ?? null,
    data.dimensions ?? null,
    data.description ?? null,
    data.care_level ?? null,
    data.growth_rate ?? null,
    boolToInt(data.drought_tolerant),
    boolToInt(data.indoor),
    boolToInt(data.poisonous_to_humans),
    boolToInt(data.poisonous_to_pets),
    data.pruning_months ?? null,
    now,
    now
  );
  return getCustomSpecies(id)!;
}

export function updateCustomSpecies(id: string, data: Partial<SpeciesInfo>): CustomSpecies | null {
  const existing = getCustomSpecies(id);
  if (!existing) return null;
  const merged = { ...existing, ...data };
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE custom_species SET
      common_name = ?, scientific_name = ?, thumbnail = ?, light_requirement = ?, sunlight_description = ?,
      watering_interval_days = ?, watering_description = ?, family = ?, plant_type = ?, cycle = ?, origin = ?,
      dimensions = ?, description = ?, care_level = ?, growth_rate = ?, drought_tolerant = ?, indoor = ?,
      poisonous_to_humans = ?, poisonous_to_pets = ?, pruning_months = ?, updated_at = ?
    WHERE id = ?`
  ).run(
    merged.common_name,
    merged.scientific_name,
    merged.thumbnail,
    merged.light_requirement,
    merged.sunlight_description,
    merged.watering_interval_days,
    merged.watering_description,
    merged.family,
    merged.plant_type,
    merged.cycle,
    merged.origin,
    merged.dimensions,
    merged.description,
    merged.care_level,
    merged.growth_rate,
    boolToInt(merged.drought_tolerant),
    boolToInt(merged.indoor),
    boolToInt(merged.poisonous_to_humans),
    boolToInt(merged.poisonous_to_pets),
    merged.pruning_months,
    now,
    id
  );
  return getCustomSpecies(id);
}

export function deleteCustomSpecies(id: string): boolean {
  const result = db.prepare('DELETE FROM custom_species WHERE id = ?').run(id);
  return result.changes > 0;
}
