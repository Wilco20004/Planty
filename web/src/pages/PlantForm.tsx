import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { LIGHT_LABELS, LightRequirement, Plant, PlantLookupMatch } from '../types';

const LIGHT_OPTIONS = Object.keys(LIGHT_LABELS) as LightRequirement[];
const LOOKUP_DEBOUNCE_MS = 300;

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

  const [matches, setMatches] = useState<PlantLookupMatch[]>([]);
  const [showMatches, setShowMatches] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState(-1);
  const [suggestedWateringDays, setSuggestedWateringDays] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const requestSeq = useRef(0);

  useEffect(() => {
    if (id) {
      api.getPlant(id).then((plant) => setForm(plant)).catch((e) => setError(e.message));
    }
  }, [id]);

  function handleSpeciesChange(value: string) {
    setForm({ ...form, species: value, perenual_species_id: null, custom_species_id: null });
    setSuggestedWateringDays(null);
    setActiveMatch(-1);
    clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setMatches([]);
      setShowMatches(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const seq = ++requestSeq.current;
      try {
        const results = await api.searchPlantLookup(value.trim());
        if (seq !== requestSeq.current) return; // a newer keystroke's request already landed
        setMatches(results);
        setShowMatches(true);
        setLookupError(null);
      } catch (e: any) {
        if (seq !== requestSeq.current) return;
        setLookupError(e.message);
        setMatches([]);
      }
    }, LOOKUP_DEBOUNCE_MS);
  }

  async function handlePickMatch(match: PlantLookupMatch) {
    setShowMatches(false);
    setForm((prev) => ({
      ...prev,
      species: match.common_name,
      scientific_name: match.scientific_name ?? prev.scientific_name,
      name: prev.name?.trim() ? prev.name : match.common_name,
      perenual_species_id: match.source === 'perenual' ? (match.id as number) : null,
      custom_species_id: match.source === 'custom' ? (match.id as string) : null,
    }));
    try {
      const detail =
        match.source === 'custom' ? await api.getCustomSpecies(match.id as string) : await api.getPlantLookupDetail(match.id as number);
      setForm((prev) => ({
        ...prev,
        light_requirement: detail.light_requirement ?? prev.light_requirement,
      }));
      setSuggestedWateringDays(detail.watering_interval_days ?? null);
    } catch (e: any) {
      setLookupError(e.message);
    }
  }

  function handleSpeciesKeyDown(e: React.KeyboardEvent) {
    if (!showMatches || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveMatch((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveMatch((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeMatch >= 0) {
      e.preventDefault();
      handlePickMatch(matches[activeMatch]);
    } else if (e.key === 'Escape') {
      setShowMatches(false);
    }
  }

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
        if (suggestedWateringDays) {
          await api.createTask(created.id, { task_type: 'watering', interval_days: suggestedWateringDays });
        }
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
        <label className="autocomplete-field">
          Species
          <input
            value={form.species || ''}
            onChange={(e) => handleSpeciesChange(e.target.value)}
            onKeyDown={handleSpeciesKeyDown}
            onFocus={() => matches.length > 0 && setShowMatches(true)}
            onBlur={() => setTimeout(() => setShowMatches(false), 100)}
            placeholder="Start typing, e.g. monstera deliciosa"
            autoComplete="off"
          />
          {showMatches && matches.length > 0 && (
            <ul className="autocomplete-list">
              {matches.map((match, i) => (
                <li key={match.id}>
                  <button
                    type="button"
                    className={i === activeMatch ? 'active' : ''}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePickMatch(match)}
                  >
                    {match.common_name}
                    {match.scientific_name && <span className="italic muted"> — {match.scientific_name}</span>}
                    {match.source === 'custom' && <span className="muted small"> (my database)</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {lookupError && <span className="muted small autocomplete-hint">{lookupError}</span>}
          {suggestedWateringDays && !isEdit && (
            <span className="muted small autocomplete-hint">
              Will add a watering task every {suggestedWateringDays} days once saved.
            </span>
          )}
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
          Fertilizer type
          <input
            value={form.fertilizer_type || ''}
            onChange={(e) => setForm({ ...form, fertilizer_type: e.target.value })}
            placeholder="e.g. Balanced 10-10-10 liquid"
          />
        </label>
        <label>
          Fertilizer next date
          <input
            type="date"
            value={form.fertilizer_next_date?.slice(0, 10) || ''}
            onChange={(e) => setForm({ ...form, fertilizer_next_date: e.target.value || null })}
          />
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
