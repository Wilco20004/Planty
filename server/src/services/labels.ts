import { db } from '../db';
import { LabelSettings, LabelTemplate } from '../types';

/**
 * Client for a LabelForge add-on, which prints on a Brother QL over USB.
 *
 * This lives on the server rather than in the browser on purpose: Planty is
 * usually reached over Home Assistant's Ingress, which is HTTPS, and a page
 * served over HTTPS cannot call a plain-HTTP add-on on the LAN. The server has
 * no such restriction, and it also means the printer's address is configured
 * once rather than per device.
 *
 * LabelForge knows templates, variables and pixels — nothing about plants. The
 * mapping from a plant to a template's variables is in plantLabel.ts.
 */

export const DEFAULT_LABELFORGE_PORT = 8095;
/** LabelForge can be slow to answer while the printer is busy. */
const REQUEST_TIMEOUT_MS = 20000;

const KEYS = {
  host: 'labelforge_host',
  port: 'labelforge_port',
  templateId: 'labelforge_template_id',
  baseUrl: 'labelforge_base_url',
  copies: 'labelforge_copies',
} as const;

function readSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function writeSetting(key: string, value: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

export function getLabelSettings(): LabelSettings {
  const port = Number(readSetting(KEYS.port));
  const copies = Number(readSetting(KEYS.copies));
  return {
    host: readSetting(KEYS.host) ?? '',
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_LABELFORGE_PORT,
    template_id: readSetting(KEYS.templateId) ?? '',
    base_url: readSetting(KEYS.baseUrl) ?? '',
    copies: Number.isFinite(copies) && copies > 0 ? Math.min(20, Math.round(copies)) : 1,
  };
}

export function saveLabelSettings(patch: Partial<LabelSettings>): LabelSettings {
  // Applied field by field rather than spread: a request body that simply left
  // a field out arrives here as an explicit `undefined`, and spreading that
  // over the stored settings would blank them. Saving only the template would
  // otherwise wipe the address that had just been entered.
  const merged = getLabelSettings();
  if (patch.host !== undefined) merged.host = patch.host;
  if (patch.port !== undefined) merged.port = patch.port;
  if (patch.template_id !== undefined) merged.template_id = patch.template_id;
  if (patch.base_url !== undefined) merged.base_url = patch.base_url;
  if (patch.copies !== undefined) merged.copies = patch.copies;
  writeSetting(KEYS.host, (merged.host ?? '').trim());
  writeSetting(KEYS.port, String(merged.port > 0 ? Math.round(merged.port) : DEFAULT_LABELFORGE_PORT));
  writeSetting(KEYS.templateId, (merged.template_id ?? '').trim());
  // A trailing slash here would double up against the path appended to it.
  writeSetting(KEYS.baseUrl, (merged.base_url ?? '').trim().replace(/\/+$/, ''));
  writeSetting(KEYS.copies, String(Math.min(20, Math.max(1, Math.round(merged.copies || 1)))));
  return getLabelSettings();
}

export function labelForgeConfigured(s: LabelSettings): boolean {
  return Boolean(s.host.trim());
}

export function labelForgeUrl(s: LabelSettings, path: string): string {
  return `http://${s.host.trim()}:${s.port}/${path.replace(/^\/+/, '')}`;
}

async function request(s: LabelSettings, path: string, init?: RequestInit): Promise<Response> {
  if (!labelForgeConfigured(s)) throw new Error('LabelForge has no address configured yet.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(labelForgeUrl(s, path), { ...init, signal: controller.signal });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    throw new Error(
      aborted
        ? `LabelForge at ${s.host}:${s.port} did not answer within ${REQUEST_TIMEOUT_MS / 1000} s.`
        : `Could not reach LabelForge at ${s.host}:${s.port}. Check the address and that the add-on is running.`
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    // LabelForge reports failures as {"detail": "..."} — a printer that is off
    // or a wrong device path arrives that way, and is worth passing on as is.
    let detail = '';
    try {
      const body = (await res.clone().json()) as { detail?: unknown };
      if (typeof body?.detail === 'string') detail = body.detail;
    } catch {
      /* not JSON; the status is all there is */
    }
    throw new Error(`LabelForge returned ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return res;
}

export async function listTemplates(s: LabelSettings): Promise<LabelTemplate[]> {
  const res = await request(s, 'api/templates');
  const list = (await res.json()) as LabelTemplate[];
  return Array.isArray(list) ? list : [];
}

export async function getTemplate(s: LabelSettings, id: string): Promise<LabelTemplate> {
  const list = await listTemplates(s);
  const found = list.find((t) => t.id === id);
  if (!found) throw new Error('That label template no longer exists in LabelForge.');
  return found;
}

/** PNG of the label exactly as it would print. */
export async function renderLabel(
  s: LabelSettings,
  templateId: string,
  variables: Record<string, string>
): Promise<Buffer> {
  const res = await request(s, 'api/labels/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: templateId, variables }),
  });
  return Buffer.from(await res.arrayBuffer());
}

export async function printLabel(
  s: LabelSettings,
  templateId: string,
  variables: Record<string, string>,
  copies = 1
): Promise<void> {
  await request(s, 'api/labels/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: templateId, variables, copies: Math.max(1, copies) }),
  });
}
