import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.PLANTY_DATA_DIR || path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const dbPath = path.join(DATA_DIR, 'planty.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS plants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    species TEXT,
    scientific_name TEXT,
    location TEXT,
    light_requirement TEXT,
    photo_path TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS care_tasks (
    id TEXT PRIMARY KEY,
    plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL,
    label TEXT,
    interval_days INTEGER NOT NULL,
    last_completed_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sensors (
    id TEXT PRIMARY KEY,
    plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT,
    mqtt_topic TEXT NOT NULL,
    unit TEXT,
    latest_value TEXT,
    latest_seen_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id TEXT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    value REAL,
    recorded_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS plant_lookup_cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS custom_species (
    id TEXT PRIMARY KEY,
    common_name TEXT NOT NULL,
    scientific_name TEXT,
    thumbnail TEXT,
    light_requirement TEXT,
    sunlight_description TEXT,
    watering_interval_days INTEGER,
    watering_description TEXT,
    family TEXT,
    plant_type TEXT,
    cycle TEXT,
    origin TEXT,
    dimensions TEXT,
    description TEXT,
    care_level TEXT,
    growth_rate TEXT,
    drought_tolerant INTEGER,
    indoor INTEGER,
    poisonous_to_humans INTEGER,
    poisonous_to_pets INTEGER,
    pruning_months TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_care_tasks_plant ON care_tasks(plant_id);
  CREATE INDEX IF NOT EXISTS idx_sensors_plant ON sensors(plant_id);
  CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor ON sensor_readings(sensor_id);
`);

const plantColumns = db.prepare('PRAGMA table_info(plants)').all() as { name: string }[];
if (!plantColumns.some((c) => c.name === 'perenual_species_id')) {
  db.exec('ALTER TABLE plants ADD COLUMN perenual_species_id INTEGER');
}
if (!plantColumns.some((c) => c.name === 'custom_species_id')) {
  db.exec('ALTER TABLE plants ADD COLUMN custom_species_id TEXT');
}
