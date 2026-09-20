import { encodeQr, qrDark, QrEcc, QrMatrix } from './qr';
import { encodeMonoPng } from './png';

/**
 * The picture that goes on a plant label: a QR code linking back to the plant.
 *
 * A LabelForge template carries exactly one image and the caller supplies it.
 * Two things about how LabelForge and brother_ql treat that image decide how it
 * is built here:
 *
 * 1. LabelForge resizes whatever it is given to the template block's exact
 *    pixel size before pasting it. At any other size it is bicubically
 *    resampled, which smears the QR modules into grey and it stops scanning —
 *    so it is generated at exactly the block's size and the resize is a no-op.
 * 2. brother_ql reduces the finished label to one bit per pixel, keeping
 *    whatever started darker than luminance 179. Producing pure black and white
 *    here means nothing is left for that step to decide.
 *
 * A QR module also has to be a whole number of pixels: measured through the
 * real pipeline, 3 px a module always scanned back, 2 px scanned for some block
 * sizes and not others, and 1 px never did.
 */

/** Module size below which a 300dpi thermal label stops scanning reliably. */
export const MIN_COMFORTABLE_MODULE = 3;

/** Blank modules the QR specification asks for around a code. */
const QUIET_MODULES = 4;

export interface LabelArtOptions {
  /** Pixel size of the template's image block. */
  width: number;
  height: number;
  qrText: string;
  ecc?: QrEcc;
}

export interface LabelArt {
  width: number;
  height: number;
  qr: {
    x: number;
    y: number;
    moduleSize: number;
    quietModules: number;
    matrix: QrMatrix;
  } | null;
  /** Why the result may not scan, for the UI to pass on. */
  warning: string | null;
}

/** Largest module size that fits `side` pixels, keeping the widest quiet zone that costs nothing. */
function fitQr(matrix: QrMatrix, side: number): { moduleSize: number; quietModules: number } | null {
  let best: { moduleSize: number; quietModules: number } | null = null;
  for (const quiet of [QUIET_MODULES, 3, 2, 1]) {
    const moduleSize = Math.floor(side / (matrix.size + 2 * quiet));
    if (moduleSize < 1) continue;
    if (!best || moduleSize > best.moduleSize) best = { moduleSize, quietModules: quiet };
  }
  return best;
}

export function layoutLabelArt(o: LabelArtOptions): LabelArt {
  const width = Math.max(1, Math.floor(o.width));
  const height = Math.max(1, Math.floor(o.height));
  const text = (o.qrText ?? '').trim();
  const art: LabelArt = { width, height, qr: null, warning: null };
  if (!text) return art;

  const matrix = encodeQr(text, o.ecc ?? 'M');
  const side = Math.min(width, height);
  const fit = fitQr(matrix, side);
  if (!fit) {
    art.warning = `The QR code needs at least ${matrix.size + 2} px and the image block only offers ${side}. It has been left off.`;
    return art;
  }

  const drawn = fit.moduleSize * (matrix.size + 2 * fit.quietModules);
  art.qr = {
    x: Math.floor((width - drawn) / 2),
    y: Math.floor((height - drawn) / 2),
    moduleSize: fit.moduleSize,
    quietModules: fit.quietModules,
    matrix,
  };
  if (fit.moduleSize < MIN_COMFORTABLE_MODULE) {
    art.warning = `Each QR module is only ${fit.moduleSize} px. Give the template's image block more room, or shorten the label link, if it does not scan.`;
  }
  return art;
}

/** One byte per pixel, 0 (black) or 255 (white), row-major. Nothing in between. */
export function rasterizeLabelArt(art: LabelArt): Uint8Array {
  const px = new Uint8Array(art.width * art.height).fill(255);
  if (!art.qr) return px;
  const { matrix, moduleSize, quietModules, x: ox, y: oy } = art.qr;
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (!qrDark(matrix, r, c)) continue;
      const x0 = ox + (c + quietModules) * moduleSize;
      const y0 = oy + (r + quietModules) * moduleSize;
      for (let dy = 0; dy < moduleSize; dy++) {
        for (let dx = 0; dx < moduleSize; dx++) {
          const x = x0 + dx;
          const y = y0 + dy;
          if (x < 0 || y < 0 || x >= art.width || y >= art.height) continue;
          px[y * art.width + x] = 0;
        }
      }
    }
  }
  return px;
}

/** Bare base64 (no data: prefix) PNG of the art, which is what LabelForge wants. */
export function labelArtPng(o: LabelArtOptions): { base64: string; art: LabelArt } {
  const art = layoutLabelArt(o);
  const png = encodeMonoPng(rasterizeLabelArt(art), art.width, art.height);
  return { base64: png.toString('base64'), art };
}
