import qrcode from 'qrcode-generator';

/**
 * The library's own stringToBytes keeps only the low byte of each UTF-16 unit,
 * which turns any non-ASCII character into a different one. Plant names are
 * full of them, so everything is encoded as UTF-8 instead.
 */
qrcode.stringToBytes = (s: string) => Array.from(Buffer.from(s, 'utf8'));

export type QrEcc = 'L' | 'M' | 'Q' | 'H';

export interface QrMatrix {
  /** Side in modules, excluding the quiet zone. */
  size: number;
  /** Row-major, `size * size` entries; true is a dark module. */
  modules: boolean[];
}

export function encodeQr(text: string, ecc: QrEcc = 'M'): QrMatrix {
  if (!text) throw new Error('Nothing to encode in the QR code');
  const qr = qrcode(0, ecc); // 0: smallest version the data fits in
  qr.addData(text, 'Byte');
  qr.make();
  const size = qr.getModuleCount();
  const modules = new Array<boolean>(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) modules[r * size + c] = qr.isDark(r, c);
  }
  return { size, modules };
}

export function qrDark(m: QrMatrix, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row >= m.size || col >= m.size) return false;
  return m.modules[row * m.size + col];
}
