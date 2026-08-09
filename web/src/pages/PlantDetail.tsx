import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { CareTaskType, LIGHT_LABELS, PlantWithTasks, SensorType, TASK_TYPE_LABELS } from '../types';
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

  function reload() {
    if (!id) return;
    api.getPlant(id).then(setPlant).catch((e) => setError(e.message));
  }

  useEffect(reload, [id]);

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
            <img src={`/uploads/${plant.photo_path}`} alt={plant.name} />
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
