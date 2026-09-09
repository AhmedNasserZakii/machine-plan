import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Cairo (SIL Open Font License, see `assets/fonts/OFL.txt`) — chosen for `17`'s "Arabic-capable
 * font (Cairo / Noto Naskh Arabic)" requirement, and because it ships full Latin coverage too, so
 * one embedded font renders both an Arabic report and an English one without a fallback that
 * could come out as boxes on a container with no system fonts installed.
 *
 * Read once and cached as base64: every PDF render embeds the same bytes as a data URI so the
 * renderer never depends on a font being present on the host, but re-reading and re-encoding a
 * ~600KB file on every export would be wasted work.
 */
let cachedBase64: string | null = null;

export function cairoFontBase64(): string {
  if (cachedBase64 === null) {
    const path = join(__dirname, 'assets', 'fonts', 'Cairo-Variable.ttf');
    cachedBase64 = readFileSync(path).toString('base64');
  }
  return cachedBase64;
}

/**
 * `@font-face` block embedding Cairo as a data URI. Included as its own CSS block (rather than
 * folded into the main stylesheet) because Puppeteer's header/footer templates are separate
 * documents that do not inherit the main page's `<style>` — page-numbering text needs this too.
 *
 * `font-weight: 200 1000` declares the full variable-font weight range in one `@font-face` rule,
 * so `font-weight: 700` in ordinary CSS resolves to the font's own bold instance instead of a
 * synthetic (and, for Arabic script, often broken) faux-bold.
 */
export function cairoFontFace(): string {
  return `
    @font-face {
      font-family: 'Cairo';
      src: url(data:font/ttf;base64,${cairoFontBase64()}) format('truetype-variations');
      font-weight: 200 1000;
      font-style: normal;
    }
  `;
}
