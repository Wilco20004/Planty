import { Router } from 'express';
import { getMqttSettings, getMqttStatus, saveMqttSettings } from '../services/mqtt';

export const settingsRouter = Router();

settingsRouter.get('/mqtt', (_req, res) => {
  res.json(getMqttSettings());
});

settingsRouter.put('/mqtt', (req, res) => {
  const { host, port, username, password, base_topic, discovery_prefix } = req.body;
  const updated = saveMqttSettings({
    host,
    port: port ? Number(port) : undefined,
    username,
    password,
    base_topic,
    discovery_prefix,
  });
  res.json(updated);
});

settingsRouter.get('/mqtt/status', (_req, res) => {
  res.json(getMqttStatus());
});
