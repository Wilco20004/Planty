import { describe, it, expect } from 'vitest';
import { plantLabelLink, plantLabelVariables, planPlantLabel } from '../src/services/plantLabel';
import { CareTaskWithStatus, LabelTemplate, Plant } from '../src/types';

const plant = (over: Partial<Plant> = {}): Plant => ({
  id: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  name: 'Kitchen monstera',
  species: 'Swiss cheese plant',
  scientific_name: 'Monstera deliciosa',
  location: 'Kitchen windowsill',
  light_requirement: 'bright_indirect',
  photo_path: null,
  notes: 'Rotate a quarter turn weekly',
  perenual_species_id: null,
  custom_species_id: null,
  fertilizer_type: null,
  fertilizer_next_date: null,
  created_at: '2026-03-14T10:00:00.000Z',
  updated_at: '2026-03-14T10:00:00.000Z',
  ...over,
});

const task = (over: Partial<CareTaskWithStatus> = {}): CareTaskWithStatus => ({
  id: 't1',
  plant_id: plant().id,
  task_type: 'watering',
  label: null,
  interval_days: 7,
  last_completed_at: '2026-09-20T08:00:00.000Z',
  notes: null,
  created_at: '2026-03-14T10:00:00.000Z',
  updated_at: '2026-03-14T10:00:00.000Z',
  next_due_at: '2026-09-27T08:00:00.000Z',
  status: 'ok',
  days_until_due: 7,
  ...over,
});

const template = (over: Partial<LabelTemplate> = {}): LabelTemplate => ({
  id: 'tpl',
  name: 'Plant label 62x29',
  label_size: '62x29',
  variables: ['name', 'scientific', 'qr'],
  image_variable: 'qr',
  image: { variable: 'qr', x: 12, y: 8, width: 180, height: 255 },
  ...over,
});

describe('the link a label carries', () => {
  it('points at the plant inside Planty', () => {
    expect(plantLabelLink('http://homeassistant.local:8080', 'abc')).toBe('http://homeassistant.local:8080/plants/abc');
  });

  it('does not double the slash when the address has a trailing one', () => {
    expect(plantLabelLink('http://planty.local:8080///', 'abc')).toBe('http://planty.local:8080/plants/abc');
  });

  it('falls back to the bare id when no address is configured', () => {
    expect(plantLabelLink('', 'abc')).toBe('abc');
    expect(plantLabelLink('   ', 'abc')).toBe('abc');
  });
});

describe('what a plant tells a template', () => {
  it('fills in every field a label might want', () => {
    const v = plantLabelVariables(plant(), [task()], 'http://x/plants/a');
    expect(v).toMatchObject({
      name: 'Kitchen monstera',
      species: 'Swiss cheese plant',
      scientific: 'Monstera deliciosa',
      location: 'Kitchen windowsill',
      light: 'Bright, indirect light',
      watering: 'every week',
      next_water: '2026-09-27',
      notes: 'Rotate a quarter turn weekly',
      added: '2026-03-14',
      link: 'http://x/plants/a',
    });
  });

  it('says intervals the way a person would', () => {
    const days = (n: number) => plantLabelVariables(plant(), [task({ interval_days: n })], '').watering;
    expect(days(1)).toBe('every day');
    expect(days(7)).toBe('every week');
    expect(days(14)).toBe('every 2 weeks');
    expect(days(10)).toBe('every 10 days');
  });

  it('lists every care task, using a custom label where there is one', () => {
    const v = plantLabelVariables(plant(), [
      task(),
      task({ id: 't2', task_type: 'fertilizing', interval_days: 30 }),
      task({ id: 't3', task_type: 'custom', label: 'Mist leaves', interval_days: 3 }),
    ], '');
    expect(v.tasks).toBe('Watering every week · Fertilizing every 30 days · Mist leaves every 3 days');
  });

  it('leaves blanks blank rather than printing "null"', () => {
    const v = plantLabelVariables(
      plant({ species: null, scientific_name: null, location: null, light_requirement: null, notes: null }),
      [],
      '',
    );
    expect(v).toMatchObject({ species: '', scientific: '', location: '', light: '', notes: '', tasks: '' });
    // No watering task means no interval and no next date, not "every NaN days".
    expect(v.watering).toBe('');
    expect(v.next_water).toBe('');
  });
});

describe('planning a label', () => {
  it("sizes the QR to the template's own image block", () => {
    const plan = planPlantLabel(plant(), [task()], template(), 'http://planty.local:8080');
    expect(plan.imageVariable).toBe('qr');
    expect(plan.art).toEqual({
      width: 180,
      height: 255,
      qrText: 'http://planty.local:8080/plants/a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    });
    expect(plan.warnings).toEqual([]);
  });

  it('warns that a label without an address is not scannable back to the plant', () => {
    const plan = planPlantLabel(plant(), [task()], template(), '');
    expect(plan.warnings.join(' ')).toMatch(/No Planty address/);
  });

  it('warns about a variable a plant cannot fill, which would print blank', () => {
    const plan = planPlantLabel(plant(), [task()], template({ variables: ['name', 'shelf', 'qr'] }), 'http://x');
    expect(plan.warnings.join(' ')).toMatch(/\{\{shelf\}\}/);
  });

  it('says so when the image cannot be overridden', () => {
    const plan = planPlantLabel(plant(), [task()], template({ image_variable: null }), 'http://x');
    expect(plan.art).toBeNull();
    expect(plan.warnings.join(' ')).toMatch(/no override variable/);
  });

  it('says so when there is no image block at all', () => {
    const plan = planPlantLabel(
      plant(), [task()],
      template({ image: null, image_variable: null, variables: ['name'] }),
      'http://x',
    );
    expect(plan.art).toBeNull();
    expect(plan.warnings.join(' ')).toMatch(/text only/);
  });
});
