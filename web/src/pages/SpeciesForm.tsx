import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { LIGHT_LABELS, LightRequirement, SpeciesInfo } from '../types';

const LIGHT_OPTIONS = Object.keys(LIGHT_LABELS) as LightRequirement[];

function TriStateSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <label>
      {label}
      <select
        value={value === true ? 'yes' : value === false ? 'no' : ''}
        onChange={(e) => onChange(e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null)}
      >
        <option value="">Unknown</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
  );
}

export default function SpeciesForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<Partial<SpeciesInfo>>({
    common_name: '',
    scientific_name: '',
    light_requirement: null,
    watering_interval_days: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      api.getCustomSpecies(id).then(setForm).catch((e) => setError(e.message));
    }
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit && id) {
        await api.updateCustomSpecies(id, form);
      } else {
        await api.createCustomSpecies(form);
      }
      navigate('/species');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card form-card">
      <h2>{isEdit ? 'Edit species' : 'Add a species'}</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Common name
          <input
            required
            value={form.common_name || ''}
            onChange={(e) => setForm({ ...form, common_name: e.target.value })}
            placeholder="e.g. Golden pothos"
          />
        </label>
        <label>
          Scientific name
          <input
            value={form.scientific_name || ''}
            onChange={(e) => setForm({ ...form, scientific_name: e.target.value })}
            placeholder="e.g. Epipremnum aureum"
          />
        </label>
        <label>
          Light requirement
          <select
            value={form.light_requirement || ''}
            onChange={(e) => setForm({ ...form, light_requirement: (e.target.value || null) as LightRequirement | null })}
          >
            <option value="">Unknown</option>
            {LIGHT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {LIGHT_LABELS[opt]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Watering interval (days)
          <input
            type="number"
            min={1}
            value={form.watering_interval_days ?? ''}
            onChange={(e) => setForm({ ...form, watering_interval_days: e.target.value ? Number(e.target.value) : null })}
          />
        </label>
        <label>
          Sunlight notes
          <textarea
            value={form.sunlight_description || ''}
            onChange={(e) => setForm({ ...form, sunlight_description: e.target.value })}
            rows={2}
          />
        </label>
        <label>
          Watering notes
          <textarea
            value={form.watering_description || ''}
            onChange={(e) => setForm({ ...form, watering_description: e.target.value })}
            rows={2}
          />
        </label>
        <label>
          Description
          <textarea
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
          />
        </label>
        <label>
          Family
          <input value={form.family || ''} onChange={(e) => setForm({ ...form, family: e.target.value })} />
        </label>
        <label>
          Type
          <input
            value={form.plant_type || ''}
            onChange={(e) => setForm({ ...form, plant_type: e.target.value })}
            placeholder="e.g. Vine, Succulent, Tree"
          />
        </label>
        <label>
          Cycle
          <input
            value={form.cycle || ''}
            onChange={(e) => setForm({ ...form, cycle: e.target.value })}
            placeholder="e.g. Perennial"
          />
        </label>
        <label>
          Origin
          <input value={form.origin || ''} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
        </label>
        <label>
          Mature size
          <input
            value={form.dimensions || ''}
            onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
            placeholder="e.g. 20-40 feet"
          />
        </label>
        <label>
          Care level
          <input value={form.care_level || ''} onChange={(e) => setForm({ ...form, care_level: e.target.value })} />
        </label>
        <label>
          Growth rate
          <input value={form.growth_rate || ''} onChange={(e) => setForm({ ...form, growth_rate: e.target.value })} />
        </label>
        <label>
          Best pruned in
          <input
            value={form.pruning_months || ''}
            onChange={(e) => setForm({ ...form, pruning_months: e.target.value })}
            placeholder="e.g. March, April, May"
          />
        </label>
        <TriStateSelect
          label="Drought tolerant"
          value={form.drought_tolerant}
          onChange={(v) => setForm({ ...form, drought_tolerant: v })}
        />
        <TriStateSelect label="Indoor" value={form.indoor} onChange={(v) => setForm({ ...form, indoor: v })} />
        <TriStateSelect
          label="Toxic to humans"
          value={form.poisonous_to_humans}
          onChange={(v) => setForm({ ...form, poisonous_to_humans: v })}
        />
        <TriStateSelect
          label="Toxic to pets"
          value={form.poisonous_to_pets}
          onChange={(v) => setForm({ ...form, poisonous_to_pets: v })}
        />
        <button className="button" type="submit" disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add species'}
        </button>
      </form>
    </div>
  );
}
