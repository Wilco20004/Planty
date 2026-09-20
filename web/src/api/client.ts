import {
  CareTask,
  CustomSpecies,
  JournalEntry,
  LabelPrintResult,
  LabelSettings,
  LabelTemplate,
  LabelVariable,
  MqttSettings,
  MqttStatus,
  Plant,
  PlantLookupDetail,
  PlantLookupMatch,
  PlantLookupSettings,
  PlantWithTasks,
  Sensor,
  SpeciesInfo,
} from '../types';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listPlants: () => request<PlantWithTasks[]>('api/plants'),
  getPlant: (id: string) => request<PlantWithTasks>(`api/plants/${id}`),
  createPlant: (data: Partial<Plant>) =>
    request<PlantWithTasks>('api/plants', { method: 'POST', body: JSON.stringify(data) }),
  updatePlant: (id: string, data: Partial<Plant>) =>
    request<PlantWithTasks>(`api/plants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlant: (id: string) => request<void>(`api/plants/${id}`, { method: 'DELETE' }),
  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    return request<Plant>(`api/plants/${id}/photo`, { method: 'POST', body: form });
  },

  createTask: (plantId: string, data: Partial<CareTask>) =>
    request<CareTask>(`api/plants/${plantId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<CareTask>) =>
    request<CareTask>(`api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  completeTask: (id: string, completedAt?: string) =>
    request<CareTask>(`api/tasks/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ completed_at: completedAt }),
    }),
  deleteTask: (id: string) => request<void>(`api/tasks/${id}`, { method: 'DELETE' }),

  createSensor: (plantId: string, data: Partial<Sensor>) =>
    request<Sensor>(`api/plants/${plantId}/sensors`, { method: 'POST', body: JSON.stringify(data) }),
  deleteSensor: (id: string) => request<void>(`api/sensors/${id}`, { method: 'DELETE' }),
  getSensorReadings: (id: string) =>
    request<{ value: number; recorded_at: string }[]>(`api/sensors/${id}/readings`),

  getMqttSettings: () => request<MqttSettings>('api/settings/mqtt'),
  saveMqttSettings: (data: Partial<MqttSettings>) =>
    request<MqttSettings>('api/settings/mqtt', { method: 'PUT', body: JSON.stringify(data) }),
  getMqttStatus: () => request<MqttStatus>('api/settings/mqtt/status'),

  getPlantLookupSettings: () => request<PlantLookupSettings>('api/settings/plant-lookup'),
  savePlantLookupSettings: (data: Partial<PlantLookupSettings>) =>
    request<PlantLookupSettings>('api/settings/plant-lookup', { method: 'PUT', body: JSON.stringify(data) }),
  searchPlantLookup: (q: string) =>
    request<PlantLookupMatch[]>(`api/plant-lookup/search?q=${encodeURIComponent(q)}`),
  getPlantLookupDetail: (id: number) => request<PlantLookupDetail>(`api/plant-lookup/${id}`),

  listCustomSpecies: () => request<CustomSpecies[]>('api/custom-species'),
  getCustomSpecies: (id: string) => request<CustomSpecies>(`api/custom-species/${id}`),
  createCustomSpecies: (data: Partial<SpeciesInfo>) =>
    request<CustomSpecies>('api/custom-species', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomSpecies: (id: string, data: Partial<SpeciesInfo>) =>
    request<CustomSpecies>(`api/custom-species/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomSpecies: (id: string) => request<void>(`api/custom-species/${id}`, { method: 'DELETE' }),

  addJournalEntry: (plantId: string, data: { entry_date: string; note?: string; photo?: File }) => {
    const form = new FormData();
    form.append('entry_date', data.entry_date);
    if (data.note) form.append('note', data.note);
    if (data.photo) form.append('photo', data.photo);
    return request<JournalEntry>(`api/plants/${plantId}/journal`, { method: 'POST', body: form });
  },
  deleteJournalEntry: (id: string) => request<void>(`api/journal/${id}`, { method: 'DELETE' }),

  getLabelSettings: () => request<LabelSettings>('api/labels/settings'),
  saveLabelSettings: (data: Partial<LabelSettings>) =>
    request<LabelSettings>('api/labels/settings', { method: 'PUT', body: JSON.stringify(data) }),
  listLabelTemplates: () => request<LabelTemplate[]>('api/labels/templates'),
  listLabelVariables: () => request<LabelVariable[]>('api/labels/variables'),
  printLabels: (plantIds: string[], copies?: number) =>
    request<{ results: LabelPrintResult[] }>('api/labels/print', {
      method: 'POST',
      body: JSON.stringify({ plant_ids: plantIds, copies }),
    }),

  /** The label as it would print, plus anything the server wants to warn about. */
  previewLabel: async (plantId: string): Promise<{ blob: Blob; warnings: string[] }> => {
    const res = await fetch('api/labels/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: plantId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }
    let warnings: string[] = [];
    try {
      const raw = res.headers.get('X-Label-Warnings');
      if (raw) warnings = JSON.parse(decodeURIComponent(raw));
    } catch {
      /* the picture matters more than the warnings */
    }
    return { blob: await res.blob(), warnings };
  },
};
