/**
 * Minimal QR Code encoder (byte mode, ECC M, versions 1–10).
 * No npm dependency — sufficient for machine serial / qrPayload stickers.
 */

type Ecc = 'L' | 'M' | 'Q' | 'H';

const ECC_CODE: Record<Ecc, number> = { L: 1, M: 0, Q: 3, H: 2 };

/** Capacity in data codewords for versions 1–10 at each ECC (from ISO/IEC 18004). */
const DATA_CODEWORDS: Record<Ecc, number[]> = {
  L: [19, 34, 55, 80, 108, 136, 156, 194, 232, 274],
  M: [16, 28, 44, 64, 86, 108, 124, 154, 182, 216],
  Q: [13, 22, 34, 48, 62, 76, 88, 110, 132, 156],
  H: [9, 16, 26, 36, 46, 60, 66, 86, 100, 122],
};

/** EC codewords per block × [num blocks group1, data/block g1, num blocks g2, data/block g2] */
const EC_BLOCKS: Record<Ecc, Array<[number, number, number, number, number]>> = {
  // [ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data]
  L: [
    [7, 1, 19, 0, 0],
    [10, 1, 34, 0, 0],
    [15, 1, 55, 0, 0],
    [20, 1, 80, 0, 0],
    [26, 1, 108, 0, 0],
    [18, 2, 68, 0, 0],
    [20, 2, 78, 0, 0],
    [24, 2, 97, 0, 0],
    [30, 2, 116, 0, 0],
    [18, 2, 68, 2, 69],
  ],
  M: [
    [10, 1, 16, 0, 0],
    [16, 1, 28, 0, 0],
    [26, 1, 44, 0, 0],
    [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0],
    [18, 4, 31, 0, 0],
    [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37],
    [26, 4, 43, 1, 44],
  ],
  Q: [
    [13, 1, 13, 0, 0],
    [22, 1, 22, 0, 0],
    [18, 2, 17, 0, 0],
    [26, 2, 24, 0, 0],
    [18, 2, 15, 2, 16],
    [24, 4, 19, 0, 0],
    [18, 2, 14, 4, 15],
    [22, 4, 18, 2, 19],
    [20, 4, 16, 4, 17],
    [24, 6, 19, 2, 20],
  ],
  H: [
    [17, 1, 9, 0, 0],
    [28, 1, 16, 0, 0],
    [22, 2, 13, 0, 0],
    [16, 4, 9, 0, 0],
    [22, 2, 11, 2, 12],
    [28, 4, 15, 0, 0],
    [26, 4, 13, 1, 14],
    [26, 4, 14, 2, 15],
    [24, 4, 12, 4, 13],
    [28, 6, 15, 2, 16],
  ],
};

const ALIGNMENT_POSITIONS: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

function gfExpTable(): Uint8Array {
  const exp = new Uint8Array(512);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  return exp;
}

function gfLogTable(exp: Uint8Array): Int16Array {
  const log = new Int16Array(256);
  for (let i = 0; i < 255; i++) log[exp[i]!] = i;
  return log;
}

const GF_EXP = gfExpTable();
const GF_LOG = gfLogTable(GF_EXP);

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!;
}

function rsGenerator(ecLen: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < ecLen; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] = next[j]! ^ poly[j]!;
      next[j + 1] = next[j + 1]! ^ gfMul(poly[j]!, GF_EXP[i]!);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGenerator(ecLen);
  const res = new Uint8Array(data.length + ecLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i]!;
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      res[i + j] = res[i + j]! ^ gfMul(gen[j]!, coef);
    }
  }
  return res.slice(data.length);
}

function toUtf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function chooseVersion(byteLen: number, ecc: Ecc): number {
  for (let v = 1; v <= 10; v++) {
    const capacity = DATA_CODEWORDS[ecc][v - 1]!;
    const charCountBits = v <= 9 ? 8 : 16;
    const totalBits = 4 + charCountBits + byteLen * 8;
    const totalCodewords = Math.ceil(totalBits / 8);
    if (totalCodewords + 0 <= capacity) {
      // need room for terminator / padding inside capacity
      if (Math.ceil((4 + charCountBits + byteLen * 8) / 8) <= capacity) return v;
    }
  }
  throw new Error('QR payload too long for versions 1–10');
}

function buildDataCodewords(bytes: number[], version: number, ecc: Ecc): Uint8Array {
  const capacity = DATA_CODEWORDS[ecc][version - 1]!;
  const charCountBits = version <= 9 ? 8 : 16;
  const bits: number[] = [];
  const pushBits = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  pushBits(0b0100, 4); // byte mode
  pushBits(bytes.length, charCountBits);
  for (const b of bytes) pushBits(b, 8);

  // terminator
  const capacityBits = capacity * 8;
  const term = Math.min(4, capacityBits - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]!;
    codewords.push(v);
  }

  const pad = [0xec, 0x11];
  let pi = 0;
  while (codewords.length < capacity) {
    codewords.push(pad[pi % 2]!);
    pi++;
  }
  return Uint8Array.from(codewords);
}

function interleave(data: Uint8Array, version: number, ecc: Ecc): Uint8Array {
  const [ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data] = EC_BLOCKS[ecc][version - 1]!;
  const blocks: { data: Uint8Array; ec: Uint8Array }[] = [];
  let offset = 0;
  for (let i = 0; i < g1Blocks; i++) {
    const blockData = data.slice(offset, offset + g1Data);
    offset += g1Data;
    blocks.push({ data: blockData, ec: rsEncode(blockData, ecPerBlock) });
  }
  for (let i = 0; i < g2Blocks; i++) {
    const blockData = data.slice(offset, offset + g2Data);
    offset += g2Data;
    blocks.push({ data: blockData, ec: rsEncode(blockData, ecPerBlock) });
  }

  const maxData = Math.max(g1Data, g2Data);
  const out: number[] = [];
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.data.length) out.push(b.data[i]!);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const b of blocks) out.push(b.ec[i]!);
  }
  return Uint8Array.from(out);
}

function moduleSize(version: number): number {
  return 21 + (version - 1) * 4;
}

function placeFinder(matrix: (number | null)[][], r: number, c: number) {
  for (let y = -1; y <= 7; y++) {
    for (let x = -1; x <= 7; x++) {
      const rr = r + y;
      const cc = c + x;
      if (rr < 0 || cc < 0 || rr >= matrix.length || cc >= matrix.length) continue;
      const inFinder = x >= 0 && x <= 6 && y >= 0 && y <= 6;
      const dark =
        inFinder &&
        (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
      matrix[rr]![cc] = inFinder ? (dark ? 1 : 0) : 0; // separator = light
    }
  }
}

function placeAlignment(matrix: (number | null)[][], centers: number[]) {
  for (const r of centers) {
    for (const c of centers) {
      if (matrix[r]![c] !== null) continue;
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          const ring = Math.max(Math.abs(x), Math.abs(y));
          matrix[r + y]![c + x] = ring === 0 || ring === 2 ? 1 : 0;
        }
      }
    }
  }
}

function placeTiming(matrix: (number | null)[][]) {
  const n = matrix.length;
  for (let i = 8; i < n - 8; i++) {
    const bit = i % 2 === 0 ? 1 : 0;
    if (matrix[6]![i] === null) matrix[6]![i] = bit;
    if (matrix[i]![6] === null) matrix[i]![6] = bit;
  }
}

function reserveFormat(matrix: (number | null)[][]) {
  const n = matrix.length;
  for (let i = 0; i < 9; i++) {
    if (matrix[8]![i] === null) matrix[8]![i] = 0;
    if (matrix[i]![8] === null) matrix[i]![8] = 0;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8]![n - 1 - i] === null) matrix[8]![n - 1 - i] = 0;
    if (matrix[n - 1 - i]![8] === null) matrix[n - 1 - i]![8] = 0;
  }
  matrix[n - 8]![8] = 1; // dark module
}

function maskFn(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function placeData(matrix: (number | null)[][], data: Uint8Array, mask: number) {
  const n = matrix.length;
  let bitIndex = 0;
  const totalBits = data.length * 8;
  let upward = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < n; i++) {
      const row = upward ? n - 1 - i : i;
      for (let dx = 0; dx < 2; dx++) {
        const c = col - dx;
        if (matrix[row]![c] !== null) continue;
        let bit = 0;
        if (bitIndex < totalBits) {
          const byte = data[bitIndex >> 3]!;
          bit = (byte >>> (7 - (bitIndex & 7))) & 1;
          bitIndex++;
        }
        if (maskFn(mask, row, c)) bit ^= 1;
        matrix[row]![c] = bit;
      }
    }
    upward = !upward;
  }
}

function formatBits(ecc: Ecc, mask: number): number {
  const data = (ECC_CODE[ecc] << 3) | mask;
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function drawFormat(matrix: (number | null)[][], ecc: Ecc, mask: number) {
  const bits = formatBits(ecc, mask);
  const n = matrix.length;
  const positions = [
    // horizontal around finder
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const bit = (bits >>> (14 - i)) & 1;
    const [r, c] = positions[i]!;
    matrix[r]![c] = bit;
  }
  // other copy
  for (let i = 0; i < 8; i++) {
    const bit = (bits >>> (14 - i)) & 1;
    matrix[8]![n - 1 - i] = bit;
  }
  for (let i = 0; i < 7; i++) {
    const bit = (bits >>> (6 - i)) & 1;
    matrix[n - 7 + i]![8] = bit;
  }
}

function penalty(matrix: number[][]): number {
  const n = matrix.length;
  let score = 0;
  // adjacent modules in row/col
  for (let r = 0; r < n; r++) {
    let run = 1;
    for (let c = 1; c < n; c++) {
      if (matrix[r]![c] === matrix[r]![c - 1]) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else run = 1;
    }
  }
  for (let c = 0; c < n; c++) {
    let run = 1;
    for (let r = 1; r < n; r++) {
      if (matrix[r]![c] === matrix[r - 1]![c]) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else run = 1;
    }
  }
  // 2x2 blocks
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = matrix[r]![c];
      if (v === matrix[r]![c + 1] && v === matrix[r + 1]![c] && v === matrix[r + 1]![c + 1]) {
        score += 3;
      }
    }
  }
  // dark proportion
  let dark = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (matrix[r]![c]) dark++;
  const pct = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

function buildMatrix(data: Uint8Array, version: number, ecc: Ecc, mask: number): number[][] {
  const n = moduleSize(version);
  const matrix: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));
  placeFinder(matrix, 0, 0);
  placeFinder(matrix, 0, n - 7);
  placeFinder(matrix, n - 7, 0);
  placeAlignment(matrix, ALIGNMENT_POSITIONS[version - 1] ?? []);
  placeTiming(matrix);
  reserveFormat(matrix);
  placeData(matrix, data, mask);
  drawFormat(matrix, ecc, mask);
  return matrix.map((row) => row.map((v) => (v ? 1 : 0)));
}

export function encodeQrMatrix(text: string, ecc: Ecc = 'M'): boolean[][] {
  const bytes = toUtf8(text);
  const version = chooseVersion(bytes.length, ecc);
  const dataCw = buildDataCodewords(bytes, version, ecc);
  const interleaved = interleave(dataCw, version, ecc);

  let best: number[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = buildMatrix(interleaved, version, ecc, mask);
    const score = penalty(m);
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best!.map((row) => row.map((v) => v === 1));
}

export function qrMatrixToSvg(
  matrix: boolean[][],
  options?: { size?: number; margin?: number },
): string {
  const margin = options?.margin ?? 4;
  const modules = matrix.length;
  const dim = modules + margin * 2;
  const size = options?.size ?? dim * 4;
  const scale = size / dim;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${size}" height="${size}" shape-rendering="crispEdges">`,
    `<rect width="100%" height="100%" fill="white"/>`,
  ];
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (!matrix[r]![c]) continue;
      parts.push(`<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="black"/>`);
    }
  }
  parts.push('</svg>');
  void scale;
  return parts.join('');
}
