import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import type { LabelSettings } from '../src/types';

// db.ts picks its directory up from the environment when it is first imported,
// so the module is pulled in only after that points at a throwaway directory.
let labels: typeof import('../src/services/labels');

beforeAll(async () => {
  process.env.PLANTY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'planty-labels-'));
  labels = await import('../src/services/labels');
});

describe('label settings', () => {
  it('start empty, with a usable port and one copy', () => {
    expect(labels.getLabelSettings()).toEqual<LabelSettings>({
      host: '',
      port: labels.DEFAULT_LABELFORGE_PORT,
      template_id: '',
      base_url: '',
      copies: 1,
    });
  });

  it('are not configured until there is a host', () => {
    expect(labels.labelForgeConfigured(labels.getLabelSettings())).toBe(false);
    expect(labels.labelForgeConfigured({ ...labels.getLabelSettings(), host: 'planty.local' })).toBe(true);
    expect(labels.labelForgeConfigured({ ...labels.getLabelSettings(), host: '  ' })).toBe(false);
  });

  it('survive a round trip through the database', () => {
    labels.saveLabelSettings({ host: 'labelforge.local', port: 9000, template_id: 'tpl', copies: 3 });
    expect(labels.getLabelSettings()).toMatchObject({
      host: 'labelforge.local',
      port: 9000,
      template_id: 'tpl',
      copies: 3,
    });
  });

  it('merge a patch rather than blanking what it leaves out', () => {
    labels.saveLabelSettings({ copies: 2 });
    expect(labels.getLabelSettings()).toMatchObject({ host: 'labelforge.local', port: 9000, copies: 2 });
  });

  it('are not blanked by a patch that simply leaves a field out', () => {
    // An Express body destructures missing fields to `undefined`, so saving
    // only the template used to wipe the address that had just been entered.
    labels.saveLabelSettings({ host: 'labelforge.local', port: 9000, base_url: 'http://planty.local:8080' });
    labels.saveLabelSettings({
      host: undefined,
      port: undefined,
      base_url: undefined,
      copies: undefined,
      template_id: 'tpl1',
    });
    expect(labels.getLabelSettings()).toMatchObject({
      host: 'labelforge.local',
      port: 9000,
      base_url: 'http://planty.local:8080',
      template_id: 'tpl1',
    });
  });

  it("strip a trailing slash off Planty's address, which would double up in the link", () => {
    expect(labels.saveLabelSettings({ base_url: 'http://planty.local:8080///' }).base_url)
      .toBe('http://planty.local:8080');
  });

  it('keep the copy count somewhere sane', () => {
    expect(labels.saveLabelSettings({ copies: 0 }).copies).toBe(1);
    expect(labels.saveLabelSettings({ copies: -4 }).copies).toBe(1);
    expect(labels.saveLabelSettings({ copies: 500 }).copies).toBe(20);
  });

  it('fall back to the default port rather than storing a nonsense one', () => {
    expect(labels.saveLabelSettings({ port: 0 }).port).toBe(labels.DEFAULT_LABELFORGE_PORT);
    expect(labels.saveLabelSettings({ port: Number.NaN }).port).toBe(labels.DEFAULT_LABELFORGE_PORT);
  });

  it('address LabelForge over plain HTTP, which the server may do and a browser may not', () => {
    const s = labels.saveLabelSettings({ host: '  labelforge.local  ', port: 8095 });
    expect(labels.labelForgeUrl(s, 'api/templates')).toBe('http://labelforge.local:8095/api/templates');
    expect(labels.labelForgeUrl(s, '/api/labels/print')).toBe('http://labelforge.local:8095/api/labels/print');
  });
});
