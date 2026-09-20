import { describe, it, expect } from 'vitest';
import { layoutLabelArt, rasterizeLabelArt, labelArtPng, LabelArt } from '../src/labels/art';

const LINK = 'http://homeassistant.local:8080/plants/a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const render = (width: number, height: number, qrText = LINK) => {
  const art = layoutLabelArt({ width, height, qrText });
  return { art, px: rasterizeLabelArt(art) };
};

/** Every pixel of the QR's own quiet zone, on all four sides. */
function quietZoneIsClear(art: LabelArt, px: Uint8Array): boolean {
  const q = art.qr!;
  const band = q.quietModules * q.moduleSize;
  const side = q.matrix.size * q.moduleSize + 2 * band;
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      if (x >= band && y >= band && x < side - band && y < side - band) continue;
      if (px[(q.y + y) * art.width + (q.x + x)] === 0) return false;
    }
  }
  return true;
}

describe('the bitmap LabelForge is handed', () => {
  it("is exactly the size of the template's image block", () => {
    // Anything else gets bicubically resampled on the way in, which turns the
    // QR modules to mush before the printer's threshold ever sees them.
    const { art, px } = render(180, 255);
    expect([art.width, art.height]).toEqual([180, 255]);
    expect(px.length).toBe(180 * 255);
  });

  it('is pure black and white, with no tone for the printer to decide about', () => {
    expect([...new Set(render(180, 255).px)].sort()).toEqual([0, 255]);
  });

  it('floors the QR to whole pixels per module', () => {
    const { art } = render(180, 255);
    expect(Number.isInteger(art.qr!.moduleSize)).toBe(true);
    expect(art.qr!.moduleSize).toBeGreaterThanOrEqual(1);
  });

  it('keeps the quiet zone genuinely blank', () => {
    const { art, px } = render(180, 255);
    expect(quietZoneIsClear(art, px)).toBe(true);
  });

  it('centres the code in the block', () => {
    const { art } = render(300, 200);
    const drawn = art.qr!.moduleSize * (art.qr!.matrix.size + 2 * art.qr!.quietModules);
    expect(art.qr!.x).toBe(Math.floor((300 - drawn) / 2));
    expect(art.qr!.y).toBe(Math.floor((200 - drawn) / 2));
  });

  it('is deterministic, so reprinting a plant gives the same label', () => {
    expect(Array.from(render(180, 255).px)).toEqual(Array.from(render(180, 255).px));
  });

  it('is blank when there is nothing to encode', () => {
    const { art, px } = render(64, 64, '');
    expect(art.qr).toBeNull();
    expect(art.warning).toBeNull();
    expect(px.every((v) => v === 255)).toBe(true);
  });
});

describe('when the image block is too small', () => {
  it('warns while the code is still just about drawable', () => {
    const art = layoutLabelArt({ width: 90, height: 90, qrText: LINK });
    expect(art.qr!.moduleSize).toBeLessThan(3);
    expect(art.warning).toMatch(/module is only \d+ px/);
  });

  it('leaves the code off entirely rather than emitting an unreadable smear', () => {
    const art = layoutLabelArt({ width: 12, height: 12, qrText: LINK });
    expect(art.qr).toBeNull();
    expect(art.warning).toMatch(/left off/);
  });

  it('says nothing when the block is comfortable', () => {
    // 180 x 255 is the block in the template the docs suggest: 4 px a module.
    const art = layoutLabelArt({ width: 180, height: 255, qrText: LINK });
    expect(art.qr!.moduleSize).toBeGreaterThanOrEqual(3);
    expect(art.warning).toBeNull();
  });
});

describe('labelArtPng', () => {
  it('returns base64 with no data: prefix, which is what LabelForge wants', () => {
    const { base64 } = labelArtPng({ width: 180, height: 255, qrText: LINK });
    expect(base64.startsWith('data:')).toBe(false);
    expect(Buffer.from(base64, 'base64').subarray(1, 4).toString('ascii')).toBe('PNG');
  });
});
