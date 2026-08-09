import { db } from '../db';
import { LightRequirement, PlantLookupDetail, PlantLookupMatch, PlantLookupSettings } from '../types';

const PERENUAL_BASE_URL = 'https://perenual.com/api';

export function getPlantLookupSettings(): PlantLookupSettings {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('perenual_api_key') as
    | { value: string }
    | undefined;
  return { api_key: row?.value || null };
}

export function savePlantLookupSettings(settings: Partial<PlantLookupSettings>): PlantLookupSettings {
  const current = getPlantLookupSettings();
  const merged = { ...current, ...settings };
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    'perenual_api_key',
    merged.api_key ?? ''
  );
  return merged;
}

function mapSunlightToLightRequirement(sunlight: string[] | undefined): LightRequirement | null {
  if (!sunlight || sunlight.length === 0) return null;
  const s = sunlight.map((x) => x.toLowerCase());
  if (s.some((x) => x.includes('full sun') || x.includes('full_sun'))) return 'direct';
  if (s.some((x) => x.includes('part shade') || x.includes('sun-part') || x.includes('filtered'))) {
    return 'bright_indirect';
  }
  if (s.some((x) => x.includes('full shade') || x.includes('full_shade'))) return 'low';
  return 'medium';
}

function mapWateringToIntervalDays(
  watering: string | undefined,
  benchmark: { value: string; unit: string } | undefined
): number | null {
  if (benchmark?.value) {
    const nums = benchmark.value.match(/\d+/g)?.map(Number);
    if (nums && nums.length > 0) {
      const avg = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
      const unit = (benchmark.unit || 'days').toLowerCase();
      return unit.startsWith('week') ? avg * 7 : avg;
    }
  }
  switch ((watering || '').toLowerCase()) {
    case 'frequent':
      return 3;
    case 'average':
      return 7;
    case 'minimum':
      return 14;
    case 'none':
      return 30;
    default:
      return null;
  }
}

// Perenual's "Personal" tier (and below) returns null for the structured `sunlight`/`watering`
// fields on /species/details — that data only shows up as free-text prose from the separate
// /species-care-guide-list endpoint ("Plant Care Guides & FAQ" access). These parse that prose.
function firstIndexOfAny(text: string, phrases: string[]): number {
  const found = phrases.map((p) => text.indexOf(p)).filter((i) => i >= 0);
  return found.length ? Math.min(...found) : -1;
}

function parseLightFromText(text: string | undefined): LightRequirement | null {
  if (!text) return null;
  const t = text.toLowerCase();
  const candidates: [LightRequirement, number][] = [
    ['low', firstIndexOfAny(t, ['low light', 'full shade'])],
    ['bright_indirect', firstIndexOfAny(t, ['bright indirect', 'bright, indirect', 'indirect and bright', 'part shade', 'partial shade'])],
    ['medium', firstIndexOfAny(t, ['medium light'])],
    ['direct', firstIndexOfAny(t, ['full sun', 'direct sun'])],
  ];
  const mentioned = candidates.filter(([, idx]) => idx >= 0).sort((a, b) => a[1] - b[1]);
  return mentioned.length ? mentioned[0][0] : null;
}

function parseWateringDaysFromText(text: string | undefined): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  const range = t.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*days?/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const everyDays = t.match(/every\s+(\d+)\s*days?/);
  if (everyDays) return Number(everyDays[1]);
  const everyWeeks = t.match(/every\s+(\d+)\s*weeks?/);
  if (everyWeeks) return Number(everyWeeks[1]) * 7;
  if (t.includes('once a day') || t.includes('daily')) return 1;
  if (t.includes('twice a week')) return 4;
  if (t.includes('once a week') || t.includes('weekly')) return 7;
  if (t.includes('every other week') || t.includes('biweekly') || t.includes('bi-weekly') || t.includes('every two weeks')) {
    return 14;
  }
  if (t.includes('once a month') || t.includes('monthly')) return 30;
  return null;
}

// Perenual returns "Upgrade Plan To Supreme For Access ..." as a literal string value for fields
// gated behind a higher paid tier than the caller has. Treat those exactly like the field being absent.
const GATED_FIELD_MARKER = 'Upgrade Plan To Supreme';

function gated<T>(value: T | undefined | null): T | null {
  if (typeof value === 'string' && value.startsWith(GATED_FIELD_MARKER)) return null;
  return value ?? null;
}

function joinList(value: unknown): string | null {
  const v = gated(value);
  if (!v) return null;
  return Array.isArray(v) ? v.filter(Boolean).join(', ') || null : String(v);
}

function formatDimensions(dims: unknown): string | null {
  const list = gated(dims);
  if (!Array.isArray(list) || list.length === 0) return null;
  const d = list[0];
  if (d?.min_value == null && d?.max_value == null) return null;
  const range =
    d.min_value != null && d.max_value != null && d.min_value !== d.max_value
      ? `${d.min_value}-${d.max_value}`
      : String(d.max_value ?? d.min_value);
  return `${range} ${d.unit || ''}`.trim();
}

function cacheGet<T>(key: string): T | null {
  const row = db.prepare('SELECT value FROM plant_lookup_cache WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as T) : null;
}

function cacheSet(key: string, value: unknown) {
  db.prepare(
    'INSERT INTO plant_lookup_cache (key, value, created_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, created_at = excluded.created_at'
  ).run(key, JSON.stringify(value), new Date().toISOString());
}

class PlantLookupError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

async function perenualFetch(path: string): Promise<any> {
  const { api_key } = getPlantLookupSettings();
  if (!api_key) {
    throw new PlantLookupError('Plant lookup API key not configured. Add it in Settings.', 400);
  }
  const url = new URL(`${PERENUAL_BASE_URL}${path}`);
  url.searchParams.set('key', api_key);
  const res = await fetch(url.toString());
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new PlantLookupError('Perenual rejected the API key. Check it in Settings.', 401);
    }
    if (res.status === 429) {
      throw new PlantLookupError('Perenual rate limit hit — wait a moment and try again.', 429);
    }
    throw new PlantLookupError(`Perenual lookup failed (${res.status})`, 502);
  }
  return res.json();
}

export async function searchSpecies(query: string): Promise<PlantLookupMatch[]> {
  const cacheKey = `search:${query.trim().toLowerCase()}`;
  const cached = cacheGet<PlantLookupMatch[]>(cacheKey);
  if (cached) return cached;

  const data = await perenualFetch(`/species-list?q=${encodeURIComponent(query)}`);
  const rows = Array.isArray(data?.data) ? data.data : [];
  const matches: PlantLookupMatch[] = rows.slice(0, 10).map((row: any) => ({
    id: row.id,
    source: 'perenual',
    common_name: row.common_name || row.scientific_name?.[0] || 'Unknown',
    scientific_name: row.scientific_name?.[0] ?? null,
    thumbnail: row.default_image?.thumbnail ?? null,
  }));
  cacheSet(cacheKey, matches);
  return matches;
}

export async function getSpeciesDetail(id: number): Promise<PlantLookupDetail> {
  const cacheKey = `detail:v2:${id}`;
  const cached = cacheGet<PlantLookupDetail>(cacheKey);
  if (cached) return cached;

  const row = await perenualFetch(`/v2/species/details/${id}`);
  const sunlight: string[] | null = gated(row.sunlight);
  const watering: string | null = gated(row.watering);
  const wateringBenchmark = gated(row.watering_general_benchmark);
  let light_requirement = mapSunlightToLightRequirement(sunlight ?? undefined);
  let watering_interval_days = mapWateringToIntervalDays(watering ?? undefined, wateringBenchmark ?? undefined);
  let sunlight_description: string | null = joinList(sunlight);
  let watering_description: string | null = watering;

  if (light_requirement === null || watering_interval_days === null) {
    try {
      const guide = await perenualFetch(`/species-care-guide-list?species_id=${id}`);
      const sections: any[] = guide?.data?.[0]?.section ?? [];
      const sunlightText = sections.find((s) => s.type === 'sunlight')?.description;
      const wateringText = sections.find((s) => s.type === 'watering')?.description;
      if (light_requirement === null && sunlightText) {
        light_requirement = parseLightFromText(sunlightText);
        sunlight_description = sunlightText;
      }
      if (watering_interval_days === null && wateringText) {
        watering_interval_days = parseWateringDaysFromText(wateringText);
        watering_description = wateringText;
      }
    } catch {
      // no care guide available for this species/tier — leave whatever we already had
    }
  }

  const detail: PlantLookupDetail = {
    id: row.id,
    common_name: row.common_name || row.scientific_name?.[0] || 'Unknown',
    scientific_name: row.scientific_name?.[0] ?? null,
    thumbnail: gated(row.default_image)?.thumbnail ?? null,
    light_requirement,
    sunlight_description,
    watering_interval_days,
    watering_description,
    family: gated(row.family),
    plant_type: gated(row.type),
    cycle: gated(row.cycle),
    origin: joinList(row.origin),
    dimensions: formatDimensions(row.dimensions),
    description: gated(row.description),
    care_level: gated(row.care_level),
    growth_rate: gated(row.growth_rate),
    drought_tolerant: typeof row.drought_tolerant === 'boolean' ? row.drought_tolerant : null,
    indoor: typeof row.indoor === 'boolean' ? row.indoor : null,
    poisonous_to_humans: typeof row.poisonous_to_humans === 'boolean' ? row.poisonous_to_humans : null,
    poisonous_to_pets: typeof row.poisonous_to_pets === 'boolean' ? row.poisonous_to_pets : null,
    pruning_months: joinList(row.pruning_month),
  };
  cacheSet(cacheKey, detail);
  return detail;
}

export { PlantLookupError };
