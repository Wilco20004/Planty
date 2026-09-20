import { describe, it, expect } from 'vitest';
import { encodeQr, qrDark, QrMatrix } from '../src/labels/qr';

/** The 7x7 finder pattern: dark ring, light ring, solid 3x3 core. */
function isFinder(m: QrMatrix, row: number, col: number): boolean {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const ring = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      if (qrDark(m, row + r, col + c) !== (ring || core)) return false;
    }
  }
  return true;
}

const LINK = 'http://homeassistant.local:8080/plants/a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

describe('encodeQr', () => {
  it('produces a square of the version size', () => {
    const m = encodeQr('a1b2c3d4');
    expect(m.size).toBe(21); // version 1; every version adds 4
    expect(m.modules.length).toBe(21 * 21);
  });

  it('places the three finder patterns the right way round', () => {
    const m = encodeQr(LINK);
    expect(isFinder(m, 0, 0)).toBe(true);
    expect(isFinder(m, 0, m.size - 7)).toBe(true);
    expect(isFinder(m, m.size - 7, 0)).toBe(true);
    // The fourth corner is data. This is what catches a transposed matrix,
    // which would otherwise still look like a plausible QR code.
    expect(isFinder(m, m.size - 7, m.size - 7)).toBe(false);
  });

  it('runs the timing patterns along row and column 6', () => {
    const m = encodeQr(LINK);
    for (let i = 8; i < m.size - 8; i++) {
      expect(qrDark(m, 6, i)).toBe(i % 2 === 0);
      expect(qrDark(m, i, 6)).toBe(i % 2 === 0);
    }
  });

  it('encodes as UTF-8, not one byte per UTF-16 unit', () => {
    // The library's own stringToBytes keeps the low byte of each unit, so these
    // ten characters would be ten bytes and fit version 1 (14 data bytes at
    // level M). As UTF-8 they are twenty bytes and need version 2.
    expect(encodeQr('é'.repeat(10)).size).toBe(25);
    expect(encodeQr('Grünlilie · Fensterbank').size).toBeGreaterThanOrEqual(21);
  });

  it('grows to a bigger version as the link grows', () => {
    expect(encodeQr(LINK).size).toBeGreaterThan(encodeQr('a1b2c3d4').size);
  });

  it('refuses an empty payload rather than printing a meaningless code', () => {
    expect(() => encodeQr('')).toThrow(/nothing to encode/i);
  });

  it('reads outside the matrix as light', () => {
    const m = encodeQr('bounds');
    expect(qrDark(m, -1, 0)).toBe(false);
    expect(qrDark(m, 0, m.size)).toBe(false);
  });
});
