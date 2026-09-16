import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const srcRoot = join(webRoot, 'src');
const tokensPath = join(srcRoot, 'styles/tokens.css');
const dartColors = join(webRoot, '../mobile-app/lib/core/theme/styles/app_colors.dart');
const dartSpacing = join(webRoot, '../mobile-app/lib/core/theme/styles/app_spacing.dart');

const HEX = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const DART_COLOR = /Color\(0x(?:ff|cc)([0-9a-fA-F]{6})\)/g;
const PHYSICAL =
  /(^|[^a-zA-Z-])((?:pl|pr|ml|mr|scroll-pl|scroll-pr|scroll-ml|scroll-mr|border-l|border-r|rounded-l|rounded-r|inset-x)-[^\s"'`]|text-left|text-right|(?:left|right)-[0-9]|float-left|float-right|clear-left|clear-right)/g;

const DART_TO_TOKEN: Record<string, string> = {
  '1B4965': '--color-primary',
  '3E7CA6': '--color-primary-light',
  '5FA8D3': '--color-secondary',
  F7F9FB: '--color-background',
  FFFFFF: '--color-surface',
  EDFff2: '--unused',
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (name === 'ui' && dir.endsWith('components')) continue;
      if (name === 'generated' || name === 'messages') continue;
      walk(path, acc);
    } else if (/\.(ts|tsx|css|js|jsx)$/.test(name)) {
      acc.push(path);
    }
  }
  return acc;
}

function normalizeHex(hex: string): string {
  return hex.replace(/^#/, '').toUpperCase();
}

const errors: string[] = [];

const tokensCss = readFileSync(tokensPath, 'utf8');
const dartColorSrc = readFileSync(dartColors, 'utf8');
const dartSpacingSrc = readFileSync(dartSpacing, 'utf8');

const dartHexes = [...dartColorSrc.matchAll(DART_COLOR)].map((m) => m[1].toUpperCase());
const uniqueDart = [...new Set(dartHexes)].filter((h) => h !== '000000');

for (const hex of uniqueDart) {
  if (hex === 'FFFFFF') {
    if (!/#ffffff/i.test(tokensCss)) {
      errors.push(`Dart colour #${hex} is missing from tokens.css`);
    }
    continue;
  }
  if (!new RegExp(`#${hex}`, 'i').test(tokensCss)) {
    errors.push(`Dart colour #${hex} is missing from tokens.css`);
  }
}

const spacingExpected: Record<string, string> = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
};
const radiusExpected: Record<string, string> = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  pill: '999px',
};

for (const [name, px] of Object.entries(spacingExpected)) {
  if (!new RegExp(`--spacing-${name}:\\s*${px}`).test(tokensCss)) {
    errors.push(`Spacing token --spacing-${name} must be ${px} (AppSpacing.${name})`);
  }
}
for (const [name, px] of Object.entries(radiusExpected)) {
  if (!new RegExp(`--radius-${name}:\\s*${px}`).test(tokensCss)) {
    errors.push(`Radius token --radius-${name} must be ${px} (AppRadius.${name})`);
  }
}

if (!/0\.8[0]?/.test(tokensCss) && !/#000000cc/i.test(tokensCss)) {
  if (!/rgb\(0 0 0 \/ 0\.8/.test(tokensCss)) {
    errors.push('Scrim token must match Dart 0xcc000000 (80% black)');
  }
}

for (const file of walk(srcRoot)) {
  if (file === tokensPath) continue;
  const rel = relative(webRoot, file);
  const text = readFileSync(file, 'utf8');
  const hexes = text.match(HEX);
  if (hexes?.length) {
    errors.push(`${rel}: raw hex ${hexes.join(', ')} — only tokens.css may define colours`);
  }
  if (file.includes(`${join('components', 'ui')}`)) continue;
  PHYSICAL.lastIndex = 0;
  if (PHYSICAL.test(text)) {
    errors.push(`${rel}: physical direction utility — use ps-/pe-/ms-/me-/start-/end-/text-start`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log('Token usage check passed.');
void dartSpacingSrc;
void DART_TO_TOKEN;
void normalizeHex;
