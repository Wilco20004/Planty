import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { LabelPrintResult, LabelSettings, LabelTemplate, LabelVariable, PlantWithTasks } from '../types';

export default function Labels() {
  const [params, setParams] = useSearchParams();
  const [plants, setPlants] = useState<PlantWithTasks[] | null>(null);
  const [settings, setSettings] = useState<LabelSettings | null>(null);
  const [variables, setVariables] = useState<LabelVariable[]>([]);
  const [templates, setTemplates] = useState<LabelTemplate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<LabelPrintResult[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const previewUrl = useRef<string | null>(null);

  useEffect(() => {
    api.listPlants().then(setPlants).catch((e) => setError(e.message));
    api.getLabelSettings().then(setSettings).catch((e) => setError(e.message));
    api.listLabelVariables().then(setVariables).catch(() => {});
  }, []);

  // Arriving from a plant's own page: that plant starts ticked.
  useEffect(() => {
    const id = params.get('plant');
    if (id) setSelected(new Set([id]));
  }, [params]);

  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);

  function showPreview(url: string | null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = url;
    setPreview(url);
  }

  const template = useMemo(
    () => templates?.find((t) => t.id === settings?.template_id) ?? null,
    [templates, settings?.template_id],
  );

  async function save(patch: Partial<LabelSettings>) {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      setSettings(await api.saveLabelSettings({ ...settings, ...patch }));
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadTemplates() {
    setLoadingTemplates(true);
    setError(null);
    try {
      const list = await api.listLabelTemplates();
      setTemplates(list);
      if (list.length && !list.some((t) => t.id === settings?.template_id)) {
        await save({ template_id: list[0].id });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function doPreview(plantId: string) {
    setPreviewing(true);
    setError(null);
    setResults(null);
    try {
      const { blob, warnings: w } = await api.previewLabel(plantId);
      showPreview(URL.createObjectURL(blob));
      setWarnings(w);
    } catch (e: any) {
      setError(e.message);
      showPreview(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function doPrint() {
    setPrinting(true);
    setError(null);
    setResults(null);
    try {
      const { results: r } = await api.printLabels([...selected]);
      setResults(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPrinting(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setParams({}, { replace: true });
  }

  if (!settings || !plants) return <p>Loading...</p>;

  const allSelected = plants.length > 0 && selected.size === plants.length;

  return (
    <>
      <div className="card form-card">
        <h2>Label printer</h2>
        <p className="muted">
          Planty prints plant labels through the{' '}
          <a href="https://github.com/wilco20004/LabelForge" target="_blank" rel="noreferrer">
            LabelForge
          </a>{' '}
          add-on, which drives a Brother QL over USB. Planty talks to it from the server, so this address only
          has to be reachable from the machine Planty runs on — not from your phone.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save({});
          }}
        >
          <label>
            LabelForge address
            <input
              value={settings.host}
              placeholder="homeassistant.local"
              onChange={(e) => setSettings({ ...settings, host: e.target.value })}
            />
          </label>
          <label>
            Port
            <input
              type="number"
              min={1}
              max={65535}
              value={settings.port}
              onChange={(e) => setSettings({ ...settings, port: Number(e.target.value) })}
            />
          </label>
          <label>
            This Planty's address
            <input
              value={settings.base_url}
              placeholder="http://homeassistant.local:8080"
              onChange={(e) => setSettings({ ...settings, base_url: e.target.value })}
            />
            <span className="muted small">
              Each label's QR code links to <code>&lt;this&gt;/plants/&lt;id&gt;</code>, so scanning it on your
              phone opens that plant. Leave it blank and the code holds only the plant id.
            </span>
          </label>
          <label>
            Copies of each label
            <input
              type="number"
              min={1}
              max={20}
              value={settings.copies}
              onChange={(e) => setSettings({ ...settings, copies: Number(e.target.value) })}
            />
          </label>
          <div className="actions">
            <button className="button" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="button secondary" type="button" disabled={loadingTemplates || !settings.host} onClick={loadTemplates}>
              {loadingTemplates ? 'Loading...' : templates ? 'Reload templates' : 'Load templates'}
            </button>
          </div>
          {saved && <p className="muted small">Saved.</p>}
        </form>

        {templates && templates.length === 0 && (
          <p className="muted">LabelForge has no templates yet. Design one there first.</p>
        )}
        {templates && templates.length > 0 && (
          <label>
            Template
            <select value={settings.template_id} onChange={(e) => save({ template_id: e.target.value })}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.label_size})
                </option>
              ))}
            </select>
          </label>
        )}
        {template && !template.image_variable && (
          <p className="error">
            This template's image has no override variable, so the QR code cannot be put on it. Give the image a
            variable name in LabelForge.
          </p>
        )}
      </div>

      <section className="card">
        <h2>Plants to label</h2>
        {plants.length === 0 ? (
          <p className="muted">No plants yet.</p>
        ) : (
          <>
            <div className="inline-form">
              <button
                type="button"
                className="button secondary small"
                onClick={() => setSelected(allSelected ? new Set() : new Set(plants.map((p) => p.id)))}
              >
                {allSelected ? 'Select none' : 'Select all'}
              </button>
              <span className="muted small">{selected.size} selected</span>
            </div>
            <ul className="label-plant-list">
              {plants.map((p) => (
                <li key={p.id}>
                  <label>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                    <span className="label-plant-name">{p.name}</span>
                    {p.location && <span className="muted small">{p.location}</span>}
                  </label>
                  <button
                    type="button"
                    className="button secondary small"
                    disabled={previewing || !settings.template_id}
                    onClick={() => doPreview(p.id)}
                  >
                    Preview
                  </button>
                </li>
              ))}
            </ul>
            <div className="actions">
              <button
                className="button"
                type="button"
                disabled={printing || selected.size === 0 || !settings.template_id}
                onClick={doPrint}
              >
                {printing ? 'Printing...' : selected.size === 1 ? 'Print 1 label' : `Print ${selected.size} labels`}
              </button>
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}
        {warnings.map((w) => (
          <p className="muted small" key={w}>
            ⚠️ {w}
          </p>
        ))}
        {results && (
          <ul className="label-results">
            {results.map((r) => (
              <li key={r.plant_id} className={r.ok ? undefined : 'error'}>
                {r.ok ? '✅' : '❌'} {r.name}
                {r.error ? ` — ${r.error}` : ''}
              </li>
            ))}
          </ul>
        )}
        {preview && (
          <div className="label-preview">
            <img src={preview} alt="Label preview" />
            <p className="muted small">
              Exactly what will be printed, before the printer reduces it to black and white.
            </p>
          </div>
        )}
      </section>

      <details className="card">
        <summary>Variables a template can use</summary>
        <p className="muted">
          Design the template in LabelForge and put these in its text fields. Give its image an override variable
          (any name) and Planty fills it with the QR code.
        </p>
        <ul className="label-variables">
          {variables.map((v) => (
            <li key={v.name}>
              <code>{`{{${v.name}}}`}</code> {v.what} — <span className="muted">{v.example}</span>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
