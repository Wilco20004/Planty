import { CareTask, MqttSettings, MqttStatus, Plant, PlantWithTasks, Sensor } from '../types';

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
  listPlants: () => request<PlantWithTasks[]>('/api/plants'),
  getPlant: (id: string) => request<PlantWithTasks>(`/api/plants/${id}`),
  createPlant: (data: Partial<Plant>) =>
    request<PlantWithTasks>('/api/plants', { method: 'POST', body: JSON.stringify(data) }),
  updatePlant: (id: string, data: Partial<Plant>) =>
    request<PlantWithTasks>(`/api/plants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlant: (id: string) => request<void>(`/api/plants/${id}`, { method: 'DELETE' }),
  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    return request<Plant>(`/api/plants/${id}/photo`, { method: 'POST', body: form });
  },

  createTask: (plantId: string, data: Partial<CareTask>) =>
    request<CareTask>(`/api/plants/${plantId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: string, data: Partial<CareTask>) =>
    request<CareTask>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  completeTask: (id: string, completedAt?: string) =>
    request<CareTask>(`/api/tasks/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ completed_at: completedAt }),
    }),
  deleteTask: (id: string) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),

  createSensor: (plantId: string, data: Partial<Sensor>) =>
    request<Sensor>(`/api/plants/${plantId}/sensors`, { method: 'POST', body: JSON.stringify(data) }),
  deleteSensor: (id: string) => request<void>(`/api/sensors/${id}`, { method: 'DELETE' }),
  getSensorReadings: (id: string) =>
    request<{ value: number; recorded_at: string }[]>(`/api/sensors/${id}/readings`),

  getMqttSettings: () => request<MqttSettings>('/api/settings/mqtt'),
  saveMqttSettings: (data: Partial<MqttSettings>) =>
    request<MqttSettings>('/api/settings/mqtt', { method: 'PUT', body: JSON.stringify(data) }),
  getMqttStatus: () => request<MqttStatus>('/api/settings/mqtt/status'),
};
