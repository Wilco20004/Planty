import zlib from 'zlib';

/**
 * A one-bit PNG encoder.
 *
 * The label bitmap is built pixel by pixel on the server, where there is no
 * canvas to hand it to, and the only thing that ever needs encoding is pure
 * black and white — so this writes the smallest PNG that says exactly that
 * (colour type 0, bit depth 1) rather than pulling in an image library.
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** CRC-32 with the polynomial PNG and zlib share, table built once. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** length, type, data, CRC over type+data — the PNG chunk layout. */
function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head, body, crc]);
}

/**
 * @param pixels One byte per pixel, row-major: 0 is black, anything else white.
 * @returns A greyscale PNG, one bit per pixel.
 */
export function encodeMonoPng(pixels: Uint8Array, width: number, height: number): Buffer {
  if (width <= 0 || height <= 0) throw new Error('PNG dimensions must be positive');
  if (pixels.length !== width * height) {
    throw new Error(`Expected ${width * height} pixels for ${width}x${height}, got ${pixels.length}`);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 1; // bit depth
  ihdr[9] = 0; // colour type 0: greyscale
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlacing

  // Each scanline is a filter byte followed by the row packed most significant
  // bit first, the leftmost pixel in the top bit. A 1 bit is white, so the rows
  // start white and only black pixels clear a bit.
  const rowBytes = Math.ceil(width / 8);
  const raw = Buffer.alloc((rowBytes + 1) * height, 0);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0; // filter: none
    raw.fill(0xff, rowStart + 1, rowStart + 1 + rowBytes);
    for (let x = 0; x < width; x++) {
      if (pixels[y * width + x] !== 0) continue;
      raw[rowStart + 1 + (x >> 3)] &= ~(0x80 >> (x & 7));
    }
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
