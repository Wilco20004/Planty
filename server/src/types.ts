export type LightRequirement = 'low' | 'medium' | 'bright_indirect' | 'direct';

export type CareTaskType = 'watering' | 'light_move' | 'fertilizing' | 'custom';

export type SensorType = 'moisture' | 'light';

export interface Plant {
  id: string;
  name: string;
  species: string | null;
  scientific_name: string | null;
  location: string | null;
  light_requirement: LightRequirement | null;
  photo_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

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

export type TaskStatus = 'overdue' | 'due_soon' | 'ok';

export interface CareTaskWithStatus extends CareTask {
  next_due_at: string;
  status: TaskStatus;
  days_until_due: number;
}

export interface PlantWithTasks extends Plant {
  care_tasks: CareTaskWithStatus[];
  worst_status: TaskStatus | null;
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

export interface MqttSettings {
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  base_topic: string;
  discovery_prefix: string;
}
