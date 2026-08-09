import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { MqttSettings, MqttStatus } from '../types';

export default function Settings() {
  const [form, setForm] = useState<MqttSettings | null>(null);
  const [status, setStatus] = useState<MqttStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function loadStatus() {
    api.getMqttStatus().then(setStatus).catch(() => {});
  }

  useEffect(() => {
    api.getMqttSettings().then(setForm).catch((e) => setError(e.message));
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await api.saveMqttSettings(form);
      setForm(saved);
      setTimeout(loadStatus, 1000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <p>Loading...</p>;

  return (
    <div className="card form-card">
      <h2>Home Assistant / MQTT</h2>
      <p className="muted">
        Planty publishes each plant's care schedule to your MQTT broker using Home Assistant's MQTT discovery
        format, so entities like "next watering date" and "overdue" show up automatically in Home Assistant for
        you to build automations and notifications on. This is also used to subscribe to light/moisture sensor
        topics you link on a plant's page.
      </p>
      {error && <p className="error">{error}</p>}
      {status && (
        <p className={`status-line status-${status.status}`}>
          Status: {status.status}
          {status.error ? ` — ${status.error}` : ''}
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <label>
          MQTT host
          <input
            value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })}
            placeholder="e.g. homeassistant.local or 192.168.1.10"
          />
        </label>
        <label>
          Port
          <input
            type="number"
            value={form.port}
            onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
          />
        </label>
        <label>
          Username
          <input value={form.username || ''} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password || ''}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <label>
          Base topic
          <input value={form.base_topic} onChange={(e) => setForm({ ...form, base_topic: e.target.value })} />
        </label>
        <label>
          Discovery prefix
          <input
            value={form.discovery_prefix}
            onChange={(e) => setForm({ ...form, discovery_prefix: e.target.value })}
          />
        </label>
        <button className="button" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save & connect'}
        </button>
      </form>
    </div>
  );
}
