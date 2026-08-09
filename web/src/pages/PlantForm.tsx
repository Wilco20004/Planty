import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { LIGHT_LABELS, LightRequirement, Plant } from '../types';

const LIGHT_OPTIONS = Object.keys(LIGHT_LABELS) as LightRequirement[];

export default function PlantForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<Partial<Plant>>({
    name: '',
    species: '',
    scientific_name: '',
    location: '',
    light_requirement: 'medium',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      api.getPlant(id).then((plant) => setForm(plant)).catch((e) => setError(e.message));
    }
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit && id) {
        await api.updatePlant(id, form);
        navigate(`/plants/${id}`);
      } else {
        const created = await api.createPlant(form);
        navigate(`/plants/${created.id}`);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card form-card">
      <h2>{isEdit ? 'Edit plant' : 'Add a plant'}</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input
            required
            value={form.name || ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Living room Monstera"
          />
        </label>
        <label>
          Species
          <input
            value={form.species || ''}
            onChange={(e) => setForm({ ...form, species: e.target.value })}
            placeholder="e.g. Monstera deliciosa"
          />
        </label>
        <label>
          Scientific name
          <input
            value={form.scientific_name || ''}
            onChange={(e) => setForm({ ...form, scientific_name: e.target.value })}
          />
        </label>
        <label>
          Location
          <input
            value={form.location || ''}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="e.g. Living room, north window"
          />
        </label>
        <label>
          Light requirement
          <select
            value={form.light_requirement || 'medium'}
            onChange={(e) => setForm({ ...form, light_requirement: e.target.value as LightRequirement })}
          >
            {LIGHT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {LIGHT_LABELS[opt]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Notes
          <textarea
            value={form.notes || ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
          />
        </label>
        <button className="button" type="submit" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add plant'}
        </button>
      </form>
    </div>
  );
}
