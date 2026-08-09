import mqtt, { MqttClient } from 'mqtt';
import { db } from '../db';
import { CareTask, MqttSettings, Plant, Sensor } from '../types';
import { withStatus, TASK_TYPE_LABELS } from './schedule';

let client: MqttClient | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
let lastError: string | null = null;

const DEFAULT_SETTINGS: MqttSettings = {
  host: '',
  port: 1883,
  username: null,
  password: null,
  base_topic: 'planty',
  discovery_prefix: 'homeassistant',
};

export function getMqttSettings(): MqttSettings {
  const rows = db.prepare('SELECT key, value FROM settings WHERE key LIKE ?').all('mqtt_%') as {
    key: string;
    value: string;
  }[];
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return {
    host: map.mqtt_host ?? DEFAULT_SETTINGS.host,
    port: map.mqtt_port ? Number(map.mqtt_port) : DEFAULT_SETTINGS.port,
    username: map.mqtt_username ?? null,
    password: map.mqtt_password ?? null,
    base_topic: map.mqtt_base_topic ?? DEFAULT_SETTINGS.base_topic,
    discovery_prefix: map.mqtt_discovery_prefix ?? DEFAULT_SETTINGS.discovery_prefix,
  };
}

export function saveMqttSettings(settings: Partial<MqttSettings>) {
  const current = getMqttSettings();
  const merged = { ...current, ...settings };
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  upsert.run('mqtt_host', merged.host);
  upsert.run('mqtt_port', String(merged.port));
  upsert.run('mqtt_username', merged.username ?? '');
  upsert.run('mqtt_password', merged.password ?? '');
  upsert.run('mqtt_base_topic', merged.base_topic);
  upsert.run('mqtt_discovery_prefix', merged.discovery_prefix);
  reconnect();
  return merged;
}

export function getMqttStatus() {
  return { status: connectionStatus, error: lastError, connected: connectionStatus === 'connected' };
}

function deviceIdFor(plantId: string) {
  return `planty_${plantId.replace(/-/g, '')}`;
}

function taskTopicBase(plantId: string, taskId: string) {
  const { base_topic } = getMqttSettings();
  return `${base_topic}/${plantId}/${taskId}`;
}

function publishDiscoveryForTask(plant: Plant, task: CareTask) {
  if (!client || connectionStatus !== 'connected') return;
  const { discovery_prefix } = getMqttSettings();
  const deviceId = deviceIdFor(plant.id);
  const topicBase = taskTopicBase(plant.id, task.id);
  const label = task.label || TASK_TYPE_LABELS[task.task_type] || task.task_type;

  const device = {
    identifiers: [deviceId],
    name: plant.name,
    manufacturer: 'Planty',
    model: plant.species || 'House plant',
  };

  const nextDueConfig = {
    unique_id: `${deviceId}_${task.id}_next_due`,
    has_entity_name: true,
    name: `${label} next due`,
    state_topic: `${topicBase}/next_due`,
    device_class: 'date',
    device,
  };
  client.publish(
    `${discovery_prefix}/sensor/${deviceId}_${task.id}_next_due/config`,
    JSON.stringify(nextDueConfig),
    { retain: true }
  );

  const overdueConfig = {
    unique_id: `${deviceId}_${task.id}_overdue`,
    has_entity_name: true,
    name: `${label} overdue`,
    state_topic: `${topicBase}/overdue`,
    payload_on: 'ON',
    payload_off: 'OFF',
    device_class: 'problem',
    device,
  };
  client.publish(
    `${discovery_prefix}/binary_sensor/${deviceId}_${task.id}_overdue/config`,
    JSON.stringify(overdueConfig),
    { retain: true }
  );

  const withStat = withStatus(task);
  client.publish(`${topicBase}/next_due`, withStat.next_due_at.slice(0, 10), { retain: true });
  client.publish(`${topicBase}/overdue`, withStat.status === 'overdue' ? 'ON' : 'OFF', { retain: true });
}

function removeDiscoveryForTask(plantId: string, taskId: string) {
  if (!client) return;
  const { discovery_prefix } = getMqttSettings();
  const deviceId = deviceIdFor(plantId);
  client.publish(`${discovery_prefix}/sensor/${deviceId}_${taskId}_next_due/config`, '', { retain: true });
  client.publish(`${discovery_prefix}/binary_sensor/${deviceId}_${taskId}_overdue/config`, '', { retain: true });
}

export function publishAllPlants() {
  if (!client || connectionStatus !== 'connected') return;
  const plants = db.prepare('SELECT * FROM plants').all() as Plant[];
  for (const plant of plants) {
    const tasks = db.prepare('SELECT * FROM care_tasks WHERE plant_id = ?').all(plant.id) as CareTask[];
    for (const task of tasks) publishDiscoveryForTask(plant, task);
  }
}

export function onPlantChanged(plantId: string) {
  if (!client || connectionStatus !== 'connected') return;
  const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(plantId) as Plant | undefined;
  if (!plant) return;
  const tasks = db.prepare('SELECT * FROM care_tasks WHERE plant_id = ?').all(plantId) as CareTask[];
  for (const task of tasks) publishDiscoveryForTask(plant, task);
}

export function onPlantDeleted(plantId: string) {
  if (!client) return;
  const tasks = db.prepare('SELECT id FROM care_tasks WHERE plant_id = ?').all(plantId) as { id: string }[];
  for (const task of tasks) removeDiscoveryForTask(plantId, task.id);
  const sensors = db.prepare('SELECT * FROM sensors WHERE plant_id = ?').all(plantId) as Sensor[];
  for (const sensor of sensors) unsubscribeSensor(sensor);
}

const subscribedTopics = new Map<string, string>(); // topic -> sensorId

export function subscribeSensor(sensor: Sensor) {
  if (!client || connectionStatus !== 'connected') return;
  client.subscribe(sensor.mqtt_topic, (err) => {
    if (!err) subscribedTopics.set(sensor.mqtt_topic, sensor.id);
  });
}

export function unsubscribeSensor(sensor: Sensor) {
  if (!client) return;
  client.unsubscribe(sensor.mqtt_topic);
  subscribedTopics.delete(sensor.mqtt_topic);
}

function subscribeAllSensors() {
  const sensors = db.prepare('SELECT * FROM sensors').all() as Sensor[];
  for (const sensor of sensors) subscribeSensor(sensor);
}

function parseValue(raw: string): number | null {
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber)) return asNumber;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'number') return parsed;
    if (typeof parsed === 'object' && parsed !== null) {
      if (typeof parsed.value === 'number') return parsed.value;
      if (typeof parsed.state === 'number') return parsed.state;
    }
  } catch {
    // not JSON, ignore
  }
  return null;
}

function handleIncomingMessage(topic: string, payload: Buffer) {
  const sensorId = subscribedTopics.get(topic);
  if (!sensorId) return;
  const raw = payload.toString();
  const now = new Date().toISOString();
  db.prepare('UPDATE sensors SET latest_value = ?, latest_seen_at = ? WHERE id = ?').run(raw, now, sensorId);
  const numeric = parseValue(raw);
  if (numeric !== null) {
    db.prepare('INSERT INTO sensor_readings (sensor_id, value, recorded_at) VALUES (?, ?, ?)').run(sensorId, numeric, now);
  }
}

export function disconnect() {
  if (client) {
    client.end(true);
    client = null;
  }
  connectionStatus = 'disconnected';
}

export function reconnect() {
  disconnect();
  const settings = getMqttSettings();
  if (!settings.host) {
    connectionStatus = 'disconnected';
    return;
  }
  connectionStatus = 'connecting';
  lastError = null;
  const url = `mqtt://${settings.host}:${settings.port}`;
  client = mqtt.connect(url, {
    username: settings.username || undefined,
    password: settings.password || undefined,
    reconnectPeriod: 5000,
  });

  client.on('connect', () => {
    connectionStatus = 'connected';
    lastError = null;
    subscribeAllSensors();
    publishAllPlants();
  });
  client.on('error', (err) => {
    connectionStatus = 'error';
    lastError = err.message;
  });
  client.on('close', () => {
    if (connectionStatus !== 'error') connectionStatus = 'disconnected';
  });
  client.on('message', (topic, payload) => handleIncomingMessage(topic, payload));
}

export function initMqtt() {
  reconnect();
}
