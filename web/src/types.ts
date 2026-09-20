export type LightRequirement = 'low' | 'medium' | 'bright_indirect' | 'direct';
export type CareTaskType = 'watering' | 'light_move' | 'fertilizing' | 'custom';
export type SensorType = 'moisture' | 'light';
export type TaskStatus = 'overdue' | 'due_soon' | 'ok';

export interface CareTask {
  id: string;
  plant_id: string;
  task_type: CareTaskType;
  label: string | null;
  interval_days: number;
  last_completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CareTaskWithStatus extends CareTask {
  next_due_at: string;
  status: TaskStatus;
  days_until_due: number;
}

export interface Sensor {
  id: string;
  plant_id: string;
  type: SensorType;
  name: string | null;
  mqtt_topic: string;
  unit: string | null;
  latest_value: string | null;
  latest_seen_at: string | null;
  created_at: string;
}

export interface Plant {
  id: string;
  name: string;
  species: string | null;
  scientific_name: string | null;
  location: string | null;
  light_requirement: LightRequirement | null;
  photo_path: string | null;
  notes: string | null;
  perenual_species_id: number | null;
  custom_species_id: string | null;
  fertilizer_type: string | null;
  fertilizer_next_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  plant_id: string;
  entry_date: string;
  note: string | null;
  photo_path: string | null;
  created_at: string;
}

export interface PlantWithTasks extends Plant {
  care_tasks: CareTaskWithStatus[];
  sensors: Sensor[];
  journal_entries: JournalEntry[];
  worst_status: TaskStatus | null;
}

export interface MqttSettings {
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  base_topic: string;
  discovery_prefix: string;
}

export interface MqttStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
  connected: boolean;
}

export interface PlantLookupSettings {
  api_key: string | null;
}

export type PlantLookupSource = 'perenual' | 'custom';

export interface PlantLookupMatch {
  id: number | string;
  source: PlantLookupSource;
  common_name: string;
  scientific_name: string | null;
  thumbnail: string | null;
}

export interface SpeciesInfo {
  common_name: string;
  scientific_name: string | null;
  thumbnail: string | null;
  light_requirement: LightRequirement | null;
  sunlight_description: string | null;
  watering_interval_days: number | null;
  watering_description: string | null;
  family: string | null;
  plant_type: string | null;
  cycle: string | null;
  origin: string | null;
  dimensions: string | null;
  description: string | null;
  care_level: string | null;
  growth_rate: string | null;
  soil: string | null;
  drought_tolerant: boolean | null;
  indoor: boolean | null;
  poisonous_to_humans: boolean | null;
  poisonous_to_pets: boolean | null;
  pruning_months: string | null;
}

export interface PlantLookupDetail extends SpeciesInfo {
  id: number;
}

export interface CustomSpecies extends SpeciesInfo {
  id: string;
  created_at: string;
  updated_at: string;
}

export const LIGHT_LABELS: Record<LightRequirement, string> = {
  low: 'Low light',
  medium: 'Medium light',
  bright_indirect: 'Bright, indirect light',
  direct: 'Direct sun',
};

export const TASK_TYPE_LABELS: Record<CareTaskType, string> = {
  watering: 'Watering',
  light_move: 'Move to brighter light',
  fertilizing: 'Fertilizing',
  custom: 'Custom',
};

export interface LabelSettings {
  host: string;
  port: number;
  template_id: string;
  /** Where this Planty is reachable; a label's QR links to `<base_url>/plants/<id>`. */
  base_url: string;
  copies: number;
}

export interface LabelTemplate {
  id: string;
  name: string;
  label_size: string;
  variables: string[];
  image_variable: string | null;
  image: { variable: string | null; x: number; y: number; width: number; height: number } | null;
}

export interface LabelVariable {
  name: string;
  example: string;
  what: string;
}

export interface LabelPrintResult {
  plant_id: string;
  name: string;
  ok: boolean;
  error?: string;
  warnings: string[];
}
