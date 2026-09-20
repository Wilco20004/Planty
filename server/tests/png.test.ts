import zlib from 'zlib';
import { describe, it, expect } from 'vitest';
import { encodeMonoPng } from '../src/labels/png';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Walks the chunk list, which also proves each length and CRC is right. */
function chunks(png: Buffer): { type: string; data: Buffer }[] {
  const out: { type: string; data: Buffer }[] = [];
  let i = SIGNATURE.length;
  while (i < png.length) {
    const length = png.readUInt32BE(i);
    const type = png.subarray(i + 4, i + 8).toString('ascii');
    const data = png.subarray(i + 8, i + 8 + length);
    const stored = png.readUInt32BE(i + 8 + length);
    expect(crc32(png.subarray(i + 4, i + 8 + length)), `CRC of ${type}`).toBe(stored);
    out.push({ type, data });
    i += 12 + length;
  }
  expect(i, 'chunks exactly fill the file').toBe(png.length);
  return out;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Back to one byte per pixel, so a round trip can be compared with the source. */
function decode(png: Buffer): { width: number; height: number; pixels: Uint8Array } {
  const parts = chunks(png);
  const ihdr = parts.find((c) => c.type === 'IHDR')!.data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  expect(ihdr[8], 'bit depth').toBe(1);
  expect(ihdr[9], 'colour type').toBe(0);
  const raw = zlib.inflateSync(Buffer.concat(parts.filter((c) => c.type === 'IDAT').map((c) => c.data)));
  const rowBytes = Math.ceil(width / 8);
  expect(raw.length).toBe((rowBytes + 1) * height);
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const start = y * (rowBytes + 1);
    expect(raw[start], `filter byte of row ${y}`).toBe(0);
    for (let x = 0; x < width; x++) {
      const bit = (raw[start + 1 + (x >> 3)] >> (7 - (x & 7))) & 1;
      pixels[y * width + x] = bit ? 255 : 0;
    }
  }
  return { width, height, pixels };
}

function pattern(w: number, h: number): Uint8Array {
  const px = new Uint8Array(w * h).fill(255);
  const black = (x: number, y: number) => { px[y * w + x] = 0; };
  black(0, 0); black(w - 1, 0); black(0, h - 1); black(w - 1, h - 1);
  for (let i = 0; i < Math.min(w, h); i++) black(i, i);
  for (let x = 0; x < w; x++) black(x, Math.floor(h / 2));
  return px;
}

describe('encodeMonoPng', () => {
  it('writes a real PNG: signature, then IHDR, IDAT and IEND', () => {
    const png = encodeMonoPng(pattern(16, 8), 16, 8);
    expect(png.subarray(0, 8).equals(SIGNATURE)).toBe(true);
    expect(chunks(png).map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it('round-trips every pixel', () => {
    const px = pattern(16, 8);
    const back = decode(encodeMonoPng(px, 16, 8));
    expect(back.width).toBe(16);
    expect(back.height).toBe(8);
    expect(Array.from(back.pixels)).toEqual(Array.from(px));
  });

  it('round-trips a width that does not fill its last byte', () => {
    // 37 px is 4 bytes and 5 bits, so the packing has to leave the tail alone.
    for (const w of [1, 7, 8, 9, 37, 130]) {
      const px = pattern(w, 5);
      expect(Array.from(decode(encodeMonoPng(px, w, 5)).pixels), `width ${w}`).toEqual(Array.from(px));
    }
  });

  it('treats any non-zero byte as white, so a raster of 0/255 survives unchanged', () => {
    const px = new Uint8Array([0, 255, 1, 128]);
    expect(Array.from(decode(encodeMonoPng(px, 4, 1)).pixels)).toEqual([0, 255, 255, 255]);
  });

  it('is deterministic, so reprinting a label gives the same bytes', () => {
    const px = pattern(24, 24);
    expect(encodeMonoPng(px, 24, 24).equals(encodeMonoPng(px, 24, 24))).toBe(true);
  });

  it('compresses rather than storing a byte a pixel', () => {
    const png = encodeMonoPng(new Uint8Array(200 * 200).fill(255), 200, 200);
    expect(png.length).toBeLessThan(200 * 200 / 8);
  });

  it('refuses a pixel count that does not match the dimensions', () => {
    expect(() => encodeMonoPng(new Uint8Array(10), 4, 4)).toThrow(/Expected 16 pixels/);
    expect(() => encodeMonoPng(new Uint8Array(0), 0, 4)).toThrow(/must be positive/);
  });
});
