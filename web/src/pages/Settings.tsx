import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { MqttSettings, MqttStatus, PlantLookupSettings } from '../types';

export default function Settings() {
  const [form, setForm] = useState<MqttSettings | null>(null);
  const [status, setStatus] = useState<MqttStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [lookupForm, setLookupForm] = useState<PlantLookupSettings | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupSaved, setLookupSaved] = useState(false);
  const [lookupSaving, setLookupSaving] = useState(false);

  function loadStatus() {
    api.getMqttStatus().then(setStatus).catch(() => {});
  }

  useEffect(() => {
    api.getMqttSettings().then(setForm).catch((e) => setError(e.message));
    api.getPlantLookupSettings().then(setLookupForm).catch((e) => setLookupError(e.message));
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

  async function handleLookupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lookupForm) return;
    setLookupSaving(true);
    setLookupError(null);
    setLookupSaved(false);
    try {
      const saved = await api.savePlantLookupSettings(lookupForm);
      setLookupForm(saved);
      setLookupSaved(true);
    } catch (e: any) {
      setLookupError(e.message);
    } finally {
      setLookupSaving(false);
    }
  }

  if (!form) return <p>Loading...</p>;

  return (
    <>
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

    <div className="card form-card">
      <h2>Plant lookup (Perenual)</h2>
      <p className="muted">
        Powers the species autocomplete on the "Add a plant" form: as you type a plant name, Planty fixes the
        spelling and pulls its scientific name, light needs, and a suggested watering interval from{' '}
        <a href="https://perenual.com/docs/api" target="_blank" rel="noreferrer">
          Perenual's plant database
        </a>
        . Sign up there for a free API key (100 requests/day) and paste it below.
      </p>
      {lookupError && <p className="error">{lookupError}</p>}
      {lookupForm && (
        <form onSubmit={handleLookupSubmit}>
          <label>
            Perenual API key
            <input
              value={lookupForm.api_key || ''}
              onChange={(e) => {
                setLookupSaved(false);
                setLookupForm({ ...lookupForm, api_key: e.target.value });
              }}
              placeholder="paste your API key here"
            />
          </label>
          <button className="button" type="submit" disabled={lookupSaving}>
            {lookupSaving ? 'Saving...' : 'Save'}
          </button>
          {lookupSaved && <span className="muted small" style={{ marginLeft: '0.6rem' }}>Saved.</span>}
        </form>
      )}
    </div>

    <div className="card form-card">
      <h2>Calendar export</h2>
      <p className="muted">
        Every care task (watering, fertilizing, etc.) is available as a recurring event in a standard{' '}
        <code>.ics</code> calendar feed — one event per task, starting on its next due date and repeating on
        its interval.
      </p>
      <p>
        <a href="api/calendar.ics" download="planty.ics" className="button secondary">
          Download .ics file
        </a>
      </p>
      <p className="muted small">
        To keep it in sync automatically in Home Assistant, add it as a{' '}
        <strong>Remote Calendar</strong> integration (Settings → Devices & Services → Add Integration →
        "Remote Calendar") using this URL — Home Assistant fetches it directly, so use the add-on's direct
        port rather than the ingress panel address:
        <br />
        <code>{`http://${window.location.hostname}:8080/api/calendar.ics`}</code>
      </p>
    </div>
    </>
  );
}
