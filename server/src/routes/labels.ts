import { Router } from 'express';
import { db } from '../db';
import { CareTask, LabelPrintResult, LabelTemplate, Plant } from '../types';
import { withStatus } from '../services/schedule';
import {
  getLabelSettings,
  getTemplate,
  labelForgeConfigured,
  listTemplates,
  printLabel,
  renderLabel,
  saveLabelSettings,
} from '../services/labels';
import { planPlantLabel, PLANT_LABEL_VARIABLES } from '../services/plantLabel';
import { labelArtPng } from '../labels/art';

export const labelsRouter = Router();

function loadPlantForLabel(id: string) {
  const plant = db.prepare('SELECT * FROM plants WHERE id = ?').get(id) as Plant | undefined;
  if (!plant) return null;
  const tasks = db
    .prepare('SELECT * FROM care_tasks WHERE plant_id = ? ORDER BY created_at ASC')
    .all(id) as CareTask[];
  return { plant, tasks: tasks.map(withStatus) };
}

/** Text variables plus the rendered QR, ready to post to LabelForge. */
function buildVariables(plantId: string, template: LabelTemplate) {
  const loaded = loadPlantForLabel(plantId);
  if (!loaded) return null;
  const settings = getLabelSettings();
  const plan = planPlantLabel(loaded.plant, loaded.tasks, template, settings.base_url);
  const variables = { ...plan.variables };
  const warnings = [...plan.warnings];
  if (plan.imageVariable && plan.art) {
    const { base64, art } = labelArtPng(plan.art);
    variables[plan.imageVariable] = base64;
    if (art.warning) warnings.push(art.warning);
  }
  return { plant: loaded.plant, variables, warnings };
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

labelsRouter.get('/settings', (_req, res) => {
  res.json(getLabelSettings());
});

labelsRouter.put('/settings', (req, res) => {
  const { host, port, template_id, base_url, copies } = req.body ?? {};
  res.json(
    saveLabelSettings({
      host: typeof host === 'string' ? host : undefined,
      port: port !== undefined ? Number(port) : undefined,
      template_id: typeof template_id === 'string' ? template_id : undefined,
      base_url: typeof base_url === 'string' ? base_url : undefined,
      copies: copies !== undefined ? Number(copies) : undefined,
    })
  );
});

/** The variables a template can use, so the UI does not have to hard-code them. */
labelsRouter.get('/variables', (_req, res) => {
  res.json(PLANT_LABEL_VARIABLES);
});

labelsRouter.get('/templates', async (_req, res) => {
  const settings = getLabelSettings();
  if (!labelForgeConfigured(settings)) {
    return res.status(400).json({ error: 'LabelForge has no address configured yet.' });
  }
  try {
    res.json(await listTemplates(settings));
  } catch (e) {
    res.status(502).json({ error: message(e) });
  }
});

/** A PNG of the label for one plant, exactly as it would print. */
labelsRouter.post('/preview', async (req, res) => {
  const settings = getLabelSettings();
  const plantId = String(req.body?.plant_id ?? '');
  const templateId = String(req.body?.template_id || settings.template_id);
  if (!templateId) return res.status(400).json({ error: 'Pick a label template first.' });
  try {
    const template = await getTemplate(settings, templateId);
    const built = buildVariables(plantId, template);
    if (!built) return res.status(404).json({ error: 'Plant not found' });
    const png = await renderLabel(settings, templateId, built.variables);
    // The warnings travel in a header so the body can stay a plain image.
    res.setHeader('X-Label-Warnings', encodeURIComponent(JSON.stringify(built.warnings)));
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (e) {
    res.status(502).json({ error: message(e) });
  }
});

/**
 * Prints a label for each plant given. LabelForge serialises prints behind one
 * lock, so these go one at a time, and one failure does not abandon the rest —
 * the caller gets a result per plant.
 */
labelsRouter.post('/print', async (req, res) => {
  const settings = getLabelSettings();
  const ids: string[] = Array.isArray(req.body?.plant_ids) ? req.body.plant_ids.map(String) : [];
  const templateId = String(req.body?.template_id || settings.template_id);
  const copies = Math.min(20, Math.max(1, Number(req.body?.copies) || settings.copies));
  if (!ids.length) return res.status(400).json({ error: 'No plants selected.' });
  if (!templateId) return res.status(400).json({ error: 'Pick a label template first.' });

  let template: LabelTemplate;
  try {
    template = await getTemplate(settings, templateId);
  } catch (e) {
    return res.status(502).json({ error: message(e) });
  }

  const results: LabelPrintResult[] = [];
  for (const id of ids) {
    const built = buildVariables(id, template);
    if (!built) {
      results.push({ plant_id: id, name: id, ok: false, error: 'Plant not found', warnings: [] });
      continue;
    }
    try {
      await printLabel(settings, templateId, built.variables, copies);
      results.push({ plant_id: id, name: built.plant.name, ok: true, warnings: built.warnings });
    } catch (e) {
      results.push({ plant_id: id, name: built.plant.name, ok: false, error: message(e), warnings: built.warnings });
    }
  }
  res.json({ results });
});
