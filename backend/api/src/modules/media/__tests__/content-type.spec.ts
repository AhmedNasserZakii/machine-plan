import { AppException } from 'src/common/errors';
import { assertContentMatchesMime } from '../media.service';

/** Minimal byte headers for each format we accept. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const PDF = Buffer.from('%PDF-1.7\n', 'ascii');
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
]);

describe('assertContentMatchesMime', () => {
  it.each([
    ['image/jpeg', JPEG],
    ['image/png', PNG],
    ['image/webp', WEBP],
    ['application/pdf', PDF],
  ])('accepts %s when the bytes agree', (mimeType, body) => {
    expect(() => assertContentMatchesMime(body, mimeType)).not.toThrow();
  });

  /**
   * The declared MIME type is a string the client chose, and `/media/blob` serves objects
   * with the Content-Type their extension implies. An HTML payload announced as a PNG would
   * otherwise be hosted, and served, under a trusted origin.
   */
  it('rejects an HTML payload dressed as a PNG', () => {
    const html = Buffer.from('<html><script>alert(1)</script>', 'utf8');

    expect(() => assertContentMatchesMime(html, 'image/png')).toThrow(AppException);
  });

  it('rejects a JPEG announced as a PNG', () => {
    expect(() => assertContentMatchesMime(JPEG, 'image/png')).toThrow(AppException);
  });

  /** WEBP is a RIFF container; a four-byte check alone would let any RIFF (e.g. AVI) pass. */
  it('rejects a RIFF container that is not actually WEBP', () => {
    const avi = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('AVI ', 'ascii'),
    ]);

    expect(() => assertContentMatchesMime(avi, 'image/webp')).toThrow(AppException);
  });

  it('rejects an empty body', () => {
    expect(() => assertContentMatchesMime(Buffer.alloc(0), 'image/png')).toThrow(AppException);
  });

  it('reports the refusal as 415 rather than a generic failure', () => {
    try {
      assertContentMatchesMime(Buffer.from('nope'), 'image/jpeg');
      throw new Error('expected a rejection');
    } catch (error) {
      expect((error as AppException).getStatus()).toBe(415);
    }
  });

  /** A type with no known signature is passed through rather than guessed at. */
  it('does not police formats it has no signature for', () => {
    expect(() => assertContentMatchesMime(Buffer.from('x'), 'text/csv')).not.toThrow();
  });
});
