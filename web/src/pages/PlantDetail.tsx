import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { CareTaskType, LIGHT_LABELS, PlantWithTasks, SensorType, SpeciesInfo, TASK_TYPE_LABELS } from '../types';
import StatusBadge from '../components/StatusBadge';

const TASK_TYPES = Object.keys(TASK_TYPE_LABELS) as CareTaskType[];

export default function PlantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [plant, setPlant] = useState<PlantWithTasks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [newTask, setNewTask] = useState({ task_type: 'watering' as CareTaskType, label: '', interval_days: 7 });
  const [newSensor, setNewSensor] = useState({ type: 'moisture' as SensorType, name: '', mqtt_topic: '', unit: '' });

  const [speciesInfo, setSpeciesInfo] = useState<SpeciesInfo | null>(null);
  const [speciesInfoError, setSpeciesInfoError] = useState<string | null>(null);
  const [speciesInfoLoading, setSpeciesInfoLoading] = useState(false);
  const [savingToDatabase, setSavingToDatabase] = useState(false);

  function reload() {
    if (!id) return;
    api.getPlant(id).then(setPlant).catch((e) => setError(e.message));
  }

  useEffect(reload, [id]);

  function loadSpeciesInfo() {
    if (!plant) return;
    setSpeciesInfoLoading(true);
    setSpeciesInfoError(null);
    const request = plant.custom_species_id
      ? api.getCustomSpecies(plant.custom_species_id)
      : plant.perenual_species_id
        ? api.getPlantLookupDetail(plant.perenual_species_id)
        : null;
    request
      ?.then(setSpeciesInfo)
      .catch((e) => setSpeciesInfoError(e.message))
      .finally(() => setSpeciesInfoLoading(false));
  }

  useEffect(() => {
    setSpeciesInfo(null);
    setSpeciesInfoError(null);
    if (plant?.custom_species_id || plant?.perenual_species_id) {
      loadSpeciesInfo();
    }
  }, [plant?.custom_species_id, plant?.perenual_species_id]);

  async function handleSaveToMyDatabase() {
    if (!speciesInfo || !id) return;
    setSavingToDatabase(true);
    try {
      const saved = await api.createCustomSpecies(speciesInfo);
      await api.updatePlant(id, { custom_species_id: saved.id, perenual_species_id: null });
      reload();
    } catch (e: any) {
      setSpeciesInfoError(e.message);
    } finally {
      setSavingToDatabase(false);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!plant) return <p>Loading...</p>;

  async function handlePhotoChange() {
    if (!id || !fileInput.current?.files?.[0]) return;
    await api.uploadPhoto(id, fileInput.current.files[0]);
    reload();
  }

  async function handleDeletePlant() {
    if (!id) return;
    if (!confirm(`Delete ${plant?.name}? This cannot be undone.`)) return;
    await api.deletePlant(id);
    navigate('/');
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    await api.createTask(id, newTask);
    setNewTask({ task_type: 'watering', label: '', interval_days: 7 });
    reload();
  }

  async function handleAddSensor(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !newSensor.mqtt_topic) return;
    await api.createSensor(id, newSensor);
    setNewSensor({ type: 'moisture', name: '', mqtt_topic: '', unit: '' });
    reload();
  }

  return (
    <div className="plant-detail">
      <div className="plant-detail-header">
        <div className="plant-detail-photo">
          {plant.photo_path ? (
            <img src={`uploads/${plant.photo_path}`} alt={plant.name} />
          ) : (
            <div className="plant-card-photo-placeholder">🪴</div>
          )}
          <input ref={fileInput} type="file" accept="image/*" onChange={handlePhotoChange} />
        </div>
        <div>
          <h1>{plant.name}</h1>
          {plant.species && <p className="muted">{plant.species}</p>}
          {plant.scientific_name && <p className="muted italic">{plant.scientific_name}</p>}
          {plant.location && <p>📍 {plant.location}</p>}
          {plant.light_requirement && <p>☀️ {LIGHT_LABELS[plant.light_requirement]}</p>}
          {plant.notes && <p className="notes">{plant.notes}</p>}
          <div className="actions">
            <Link to={`/plants/${plant.id}/edit`} className="button secondary">
              Edit
            </Link>
            <button className="button danger" onClick={handleDeletePlant}>
              Delete
            </button>
          </div>
        </div>
      </div>

      {(plant.perenual_species_id || plant.custom_species_id) && (
        <section className="card">
          <h2>About this plant</h2>
          {speciesInfoError && (
            <p className="error">
              {speciesInfoError}{' '}
              <button type="button" className="button small secondary" disabled={speciesInfoLoading} onClick={loadSpeciesInfo}>
                {speciesInfoLoading ? 'Retrying...' : 'Retry'}
              </button>
            </p>
          )}
          {!speciesInfo && !speciesInfoError && <p className="muted">Loading...</p>}
          {speciesInfo && (
            <div className="species-info">
              {(speciesInfo.poisonous_to_humans || speciesInfo.poisonous_to_pets) && (
                <p className="species-warning">
                  ⚠️ Toxic to {[
                    speciesInfo.poisonous_to_humans && 'humans',
                    speciesInfo.poisonous_to_pets && 'pets',
                  ]
                    .filter(Boolean)
                    .join(' and ')}
                </p>
              )}
              {speciesInfo.description && <p>{speciesInfo.description}</p>}
              <dl className="species-facts">
                {speciesInfo.family && (
                  <>
                    <dt>Family</dt>
                    <dd>{speciesInfo.family}</dd>
                  </>
                )}
                {speciesInfo.plant_type && (
                  <>
                    <dt>Type</dt>
                    <dd>{speciesInfo.plant_type}</dd>
                  </>
                )}
                {speciesInfo.cycle && (
                  <>
                    <dt>Cycle</dt>
                    <dd>{speciesInfo.cycle}</dd>
                  </>
                )}
                {speciesInfo.origin && (
                  <>
                    <dt>Origin</dt>
                    <dd>{speciesInfo.origin}</dd>
                  </>
                )}
                {speciesInfo.dimensions && (
                  <>
                    <dt>Mature size</dt>
                    <dd>{speciesInfo.dimensions}</dd>
                  </>
                )}
                {speciesInfo.care_level && (
                  <>
                    <dt>Care level</dt>
                    <dd>{speciesInfo.care_level}</dd>
                  </>
                )}
                {speciesInfo.growth_rate && (
                  <>
                    <dt>Growth rate</dt>
                    <dd>{speciesInfo.growth_rate}</dd>
                  </>
                )}
                {speciesInfo.drought_tolerant !== null && (
                  <>
                    <dt>Drought tolerant</dt>
                    <dd>{speciesInfo.drought_tolerant ? 'Yes' : 'No'}</dd>
                  </>
                )}
                {speciesInfo.pruning_months && (
                  <>
                    <dt>Best pruned in</dt>
                    <dd>{speciesInfo.pruning_months}</dd>
                  </>
                )}
              </dl>
              {speciesInfo.sunlight_description && (
                <p className="muted small">☀️ {speciesInfo.sunlight_description}</p>
              )}
              {speciesInfo.watering_description && (
                <p className="muted small">💧 {speciesInfo.watering_description}</p>
              )}
              <div className="actions">
                {plant.custom_species_id ? (
                  <Link to={`/species/${plant.custom_species_id}/edit`} className="button small secondary">
                    Edit species info
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="button small secondary"
                    disabled={savingToDatabase}
                    onClick={handleSaveToMyDatabase}
                  >
                    {savingToDatabase ? 'Saving...' : 'Save a copy to my database'}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h2>Care schedule</h2>
        {plant.care_tasks.length === 0 && <p className="muted">No care tasks yet.</p>}
        <ul className="task-list">
          {plant.care_tasks.map((task) => (
            <li key={task.id} className="task-row">
              <div>
                <strong>{task.label || TASK_TYPE_LABELS[task.task_type]}</strong>
                <span className="muted"> every {task.interval_days} days</span>
                <div>
                  <StatusBadge status={task.status} />
                  <span className="muted"> next due {task.next_due_at.slice(0, 10)}</span>
                </div>
                {task.last_completed_at && (
                  <span className="muted small">last done {task.last_completed_at.slice(0, 10)}</span>
                )}
              </div>
              <div className="actions">
                <button className="button small" onClick={() => api.completeTask(task.id).then(reload)}>
                  Mark done
                </button>
                <button className="button small danger" onClick={() => api.deleteTask(task.id).then(reload)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddTask} className="inline-form">
          <select
            value={newTask.task_type}
            onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value as CareTaskType })}
          >
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>
                {TASK_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {newTask.task_type === 'custom' && (
            <input
              placeholder="Label"
              value={newTask.label}
              onChange={(e) => setNewTask({ ...newTask, label: e.target.value })}
            />
          )}
          <input
            type="number"
            min={1}
            value={newTask.interval_days}
            onChange={(e) => setNewTask({ ...newTask, interval_days: Number(e.target.value) })}
            style={{ width: '5rem' }}
          />
          <span className="muted">days</span>
          <button className="button small" type="submit">
            Add task
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Sensors</h2>
        <p className="muted">
          Link a light or moisture sensor already publishing to your MQTT broker (e.g. via Zigbee2MQTT or Home
          Assistant's MQTT statestream) by entering the topic it reports its value on.
        </p>
        {plant.sensors.length === 0 && <p className="muted">No sensors linked yet.</p>}
        <ul className="task-list">
          {plant.sensors.map((sensor) => (
            <li key={sensor.id} className="task-row">
              <div>
                <strong>{sensor.name || sensor.type}</strong>
                <span className="muted"> ({sensor.type})</span>
                <div className="muted small">{sensor.mqtt_topic}</div>
                <div>
                  {sensor.latest_value !== null
                    ? `${sensor.latest_value}${sensor.unit || ''} — ${sensor.latest_seen_at?.slice(0, 16).replace('T', ' ')}`
                    : 'No reading yet'}
                </div>
              </div>
              <div className="actions">
                <button className="button small danger" onClick={() => api.deleteSensor(sensor.id).then(reload)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddSensor} className="inline-form">
          <select
            value={newSensor.type}
            onChange={(e) => setNewSensor({ ...newSensor, type: e.target.value as SensorType })}
          >
            <option value="moisture">Moisture</option>
            <option value="light">Light</option>
          </select>
          <input
            placeholder="Name (optional)"
            value={newSensor.name}
            onChange={(e) => setNewSensor({ ...newSensor, name: e.target.value })}
          />
          <input
            placeholder="MQTT topic"
            value={newSensor.mqtt_topic}
            onChange={(e) => setNewSensor({ ...newSensor, mqtt_topic: e.target.value })}
            style={{ minWidth: '14rem' }}
          />
          <input
            placeholder="Unit (e.g. %, lux)"
            value={newSensor.unit}
            onChange={(e) => setNewSensor({ ...newSensor, unit: e.target.value })}
            style={{ width: '7rem' }}
          />
          <button className="button small" type="submit">
            Add sensor
          </button>
        </form>
      </section>
    </div>
  );
}
