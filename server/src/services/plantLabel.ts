import { CareTaskWithStatus, LabelArtRequest, LabelTemplate, LIGHT_LABELS, Plant } from '../types';
import { TASK_TYPE_LABELS } from './schedule';

/**
 * What a plant tells a LabelForge template.
 *
 * Pure: the QR image is described rather than drawn, so the mapping can be
 * tested on its own and the drawing stays in labels/art.ts.
 */

/** The text variables a template can use, for the UI to list. */
export const PLANT_LABEL_VARIABLES: { name: string; example: string; what: string }[] = [
  { name: 'name', example: 'Kitchen monstera', what: 'What you called the plant' },
  { name: 'species', example: 'Swiss cheese plant', what: 'Common species name' },
  { name: 'scientific', example: 'Monstera deliciosa', what: 'Scientific name' },
  { name: 'location', example: 'Kitchen windowsill', what: 'Where it lives' },
  { name: 'light', example: 'Bright, indirect light', what: 'Light requirement, spelled out' },
  { name: 'watering', example: 'every 7 days', what: 'Interval of the watering task' },
  { name: 'next_water', example: '2026-09-27', what: 'When watering is next due' },
  { name: 'tasks', example: 'Watering every 7 d · Fertilizing every 30 d', what: 'Every care task and its interval' },
  { name: 'notes', example: 'Rotate a quarter turn weekly', what: 'The plant’s notes' },
  { name: 'added', example: '2026-03-14', what: 'When the plant was added to Planty' },
  { name: 'id', example: 'a1b2c3d4', what: 'The plant’s id, also carried in the QR code' },
  { name: 'link', example: 'http://homeassistant.local:8080/plants/a1b2…', what: 'Exactly what the QR code encodes' },
];

/** Where a scanned label sends you: the plant's own page in Planty. */
export function plantLabelLink(baseUrl: string, plantId: string): string {
  const base = (baseUrl ?? '').trim().replace(/\/+$/, '');
  return base ? `${base}/plants/${plantId}` : plantId;
}

function interval(days: number): string {
  if (days === 1) return 'every day';
  if (days === 7) return 'every week';
  if (days % 7 === 0) return `every ${days / 7} weeks`;
  return `every ${days} days`;
}

function taskName(task: CareTaskWithStatus): string {
  return task.label?.trim() || TASK_TYPE_LABELS[task.task_type] || task.task_type;
}

export function plantLabelVariables(
  plant: Plant,
  tasks: CareTaskWithStatus[],
  link: string
): Record<string, string> {
  const watering = tasks.find((t) => t.task_type === 'watering');
  return {
    name: plant.name,
    species: plant.species ?? '',
    scientific: plant.scientific_name ?? '',
    location: plant.location ?? '',
    light: plant.light_requirement ? LIGHT_LABELS[plant.light_requirement] : '',
    watering: watering ? interval(watering.interval_days) : '',
    next_water: watering ? watering.next_due_at.slice(0, 10) : '',
    tasks: tasks.map((t) => `${taskName(t)} ${interval(t.interval_days)}`).join(' · '),
    notes: plant.notes ?? '',
    added: plant.created_at.slice(0, 10),
    id: plant.id,
    link,
  };
}

export interface PlantLabelPlan {
  /** Text variables, ready to post. The image still has to be rendered in. */
  variables: Record<string, string>;
  /** Which variable takes the image, or null when this template cannot carry one. */
  imageVariable: string | null;
  /** How to draw that image, or null when there is nowhere to put it. */
  art: LabelArtRequest | null;
  /** Anything about this combination the user should know before printing. */
  warnings: string[];
}

export function planPlantLabel(
  plant: Plant,
  tasks: CareTaskWithStatus[],
  template: LabelTemplate,
  baseUrl: string
): PlantLabelPlan {
  const link = plantLabelLink(baseUrl, plant.id);
  const variables = plantLabelVariables(plant, tasks, link);
  const warnings: string[] = [];

  if (!baseUrl.trim()) {
    warnings.push(
      'No Planty address is set, so the QR code holds only the plant id. Set one and scanning a label opens the plant.'
    );
  }

  // Variables the template asks for that a plant has nothing to say about: the
  // render substitutes an empty string, which reads as a design mistake on the
  // finished label rather than as a missing value.
  const unknown = (template.variables ?? []).filter((v) => v !== template.image_variable && !(v in variables));
  if (unknown.length) {
    warnings.push(
      `This template asks for ${unknown.map((v) => `{{${v}}}`).join(', ')}, which a plant does not provide — those will print blank.`
    );
  }

  let art: LabelArtRequest | null = null;
  if (template.image_variable && template.image) {
    art = { width: template.image.width, height: template.image.height, qrText: link };
  } else if (template.image) {
    warnings.push(
      "The template's image has no override variable, so the QR code cannot be supplied. Give the image a variable name in LabelForge."
    );
  } else {
    warnings.push('The template has no image block, so this label is text only. Add one in LabelForge for the QR code.');
  }

  return { variables, imageVariable: template.image_variable, art, warnings };
}
