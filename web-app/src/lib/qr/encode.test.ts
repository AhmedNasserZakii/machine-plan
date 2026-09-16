import { describe, expect, it } from 'vitest';

import { encodeQrMatrix, qrMatrixToSvg } from './encode';

describe('encodeQrMatrix', () => {
  it('encodes a short payload into a square matrix', () => {
    const matrix = encodeQrMatrix('MCH-0001');
    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true);
    expect(matrix.some((row) => row.some(Boolean))).toBe(true);
  });

  it('renders svg markup', () => {
    const svg = qrMatrixToSvg(encodeQrMatrix('serial-abc'));
    expect(svg).toContain('<svg');
    expect(svg).toContain('fill="black"');
  });

  it('encodes an empty string', () => {
    const matrix = encodeQrMatrix('');
    expect(matrix.length).toBeGreaterThanOrEqual(21);
  });
});
