// @maintained-by-ai 2026-11-25
/**
 * Contract tests for index.css — the global theme-token sheet.
 *
 * F1 (visual audit 2026-11-25, High): the character-sheet section bands
 * (.sectionHeader + background-color-header, shared by Abilities / Actions /
 * Bonus Actions / Reactions / Inventory / Advancement / Spells) rendered
 * near-black ink on the deep-green band in the LIGHT theme (~1.3:1). Root
 * cause: `[data-theme="light"]` never defined `--color-section-heading`, and
 * a dead `prefers-color-scheme: light` rule pointed `.sectionHeader` at
 * `--color-section-heading-light` — a token defined NOWHERE. The invalid var
 * made `color` inherit body ink (#222) onto the band.
 *
 * These pins hold the cure at the TOKEN level (one shared law, no per-header
 * patches):
 *  - every theme face defines --color-section-heading;
 *  - its contrast against that theme's band token (--background-color-header)
 *    clears WCAG AA (4.5:1) — dark, explicit light, and the system-light
 *    fallback alike;
 *  - the dead `--color-section-heading-light` reference never comes back in
 *    ANY stylesheet of the tree;
 *  - the char-sheet band rules all ride the single shared band token (no
 *    private literals), so the token cure reaches every section.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

/** Read a stylesheet and strip /* ... *\/ comments before parsing. */
const readCss = (file) => readFileSync(file, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

const themeCss = readCss(join(SRC_DIR, 'index.css'));

const normalize = (s) => s.trim().replace(/\s+/g, ' ');
const normalizeSelector = (s) => normalize(s).toLowerCase();

function parseDeclarations(body) {
  const props = {};
  for (const decl of body.split(';')) {
    const colon = decl.indexOf(':');
    if (colon === -1) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const value = normalize(decl.slice(colon + 1)).toLowerCase();
    if (prop) props[prop] = value;
  }
  return props;
}

/** Parse a flat block of rules (used inside @media bodies). */
function parseRules(block) {
  const rules = [];
  const regex = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = regex.exec(block)) !== null) {
    rules.push({ selector: normalizeSelector(match[1]), props: parseDeclarations(match[2]) });
  }
  return rules;
}

/** Brace-depth stylesheet parser (same shape as App.css.test.jsx). */
function parseStylesheet(source) {
  const topRules = [];
  const mediaQueries = new Map();
  let i = 0;
  while (i < source.length) {
    const brace = source.indexOf('{', i);
    if (brace === -1) break;
    const prelude = normalize(source.slice(i, brace));
    let depth = 1;
    let j = brace + 1;
    while (j < source.length && depth > 0) {
      if (source[j] === '{') depth++;
      else if (source[j] === '}') depth--;
      j++;
    }
    const body = source.slice(brace + 1, j - 1);
    if (prelude.toLowerCase().startsWith('@media')) {
      mediaQueries.set(prelude, parseRules(body));
    } else {
      topRules.push({ selector: normalizeSelector(prelude), props: parseDeclarations(body) });
    }
    i = j;
  }
  return { topRules, mediaQueries };
}

const { topRules, mediaQueries } = parseStylesheet(themeCss);

/** Cascade merge across rules whose comma-grouped selector matches. */
function styleFor(selector, rules = topRules) {
  const target = normalizeSelector(selector);
  const props = {};
  let found = false;
  for (const rule of rules) {
    const parts = rule.selector.split(',').map((p) => p.trim());
    if (parts.includes(target)) {
      found = true;
      Object.assign(props, rule.props); // later declarations win (custom props included)
    }
  }
  return found ? props : null;
}

/** #rgb / #rrggbb / rgb(r, g, b) → [r, g, b]; null for anything else. */
function parseColor(value) {
  if (!value) return null;
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    const digits = hex[1];
    const expanded = digits.length === 3 ? digits.split('').map((c) => c + c).join('') : digits;
    return [0, 2, 4].map((i) => parseInt(expanded.slice(i, i + 2), 16));
  }
  const rgb = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgb) return [1, 2, 3].map((i) => Number(rgb[i]));
  return null;
}

/** WCAG 2.1 contrast ratio between two parsed colors. */
function contrast(a, b) {
  const lum = ([r, g, b_]) => {
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b_);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Assert an ink/background pair from one token block clears WCAG AA. */
function expectPairReadable(props, inkToken, bgToken, label) {
  const ink = parseColor(props[inkToken]);
  const bg = parseColor(props[bgToken]);
  expect(ink, `${label}: ${inkToken} must be a parseable color`).not.toBeNull();
  expect(bg, `${label}: ${bgToken} must be a parseable color`).not.toBeNull();
  const ratio = contrast(ink, bg);
  expect(
    ratio,
    `${label}: ${inkToken} on ${bgToken} is ${ratio.toFixed(2)}:1 (needs ≥ 4.5:1 — F1)`
  ).toBeGreaterThanOrEqual(4.5);
}

describe('index.css theme tokens', () => {
  describe('.sectionHeader band family (F1)', () => {
    it('colors section headings from the dedicated band-ink token', () => {
      const header = styleFor('.sectionHeader');
      expect(header, '.sectionHeader rule must exist').not.toBeNull();
      // Band ink is its own token: one color cannot clear AA on BOTH the
      // dark band and the page surface in light mode, so .sectionHeader
      // must never be repointed at the page-surface heading token.
      expect(header.color).toBe('var(--color-band-heading)');
    });

    it('defines a readable band-ink pair in the DARK theme', () => {
      const root = styleFor(':root');
      expect(root, ':root theme block must exist').not.toBeNull();
      expectPairReadable(root, '--color-band-heading', '--background-color-header', 'dark :root band pair');
      expectPairReadable(root, '--color-section-heading', '--background-color-main', 'dark page-surface heading');
    });

    it('defines readable band AND page-surface heading inks in the explicit LIGHT theme', () => {
      const light = styleFor('[data-theme="light"]');
      expect(light, '[data-theme="light"] block must exist').not.toBeNull();
      expect(
        light['--color-band-heading'],
        'light theme must define --color-band-heading (F1: the missing ink token let body ink leak onto the dark-green band)'
      ).toBeTruthy();
      expectPairReadable(light, '--color-band-heading', '--background-color-header', 'explicit light band pair');
      // Chronicle's session headers ride --color-section-heading on the
      // PAGE surface — the light value must clear AA on white, or the band
      // cure regresses Chronicle (caught live during the Item 6 pass).
      expectPairReadable(light, '--color-section-heading', '--background-color-main', 'explicit light page-surface heading');
    });

    it('defines readable heading inks in the system-light fallback', () => {
      const query = [...mediaQueries.keys()].find((q) => normalize(q).startsWith('@media (prefers-color-scheme: light)'));
      expect(query, 'system-light media block must exist').toBeTruthy();
      const fallback = styleFor('body:not([data-theme])', mediaQueries.get(query));
      expect(fallback, 'system-light body:not([data-theme]) token block must exist').not.toBeNull();
      expectPairReadable(fallback, '--color-band-heading', '--background-color-header', 'system-light band pair');
      expectPairReadable(fallback, '--color-section-heading', '--background-color-main', 'system-light page-surface heading');
    });

    it('keeps the dead --color-section-heading-light reference out of every stylesheet', () => {
      // F1 root cause guard: that token was NEVER defined; any var() pointing
      // at it silently inherits body ink. The token cascade owns light faces
      // now — a resurrection anywhere in the tree is a regression.
      const offenders = [];
      for (const entry of readdirSync(SRC_DIR, { recursive: true })) {
        if (!String(entry).endsWith('.css')) continue;
        const file = join(SRC_DIR, String(entry));
        if (readCss(file).includes('--color-section-heading-light')) {
          offenders.push(String(entry));
        }
      }
      expect(offenders, 'no stylesheet may reference --color-section-heading-light').toEqual([]);
    });

    it('declares every var()-consumed theme token in index.css itself', () => {
      // The two-token heading split must stay honest: index.css may not
      // consume a token it never declares (the F1 failure mode in situ).
      const declared = new Set([...themeCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
      const used = [...themeCss.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);
      expect(used.length).toBeGreaterThan(0);
      const missing = [...new Set(used)].filter((t) => !declared.has(t));
      expect(missing, 'index.css consumes undeclared tokens').toEqual([]);
    });

    it('paints every char-sheet band with the single shared band token', () => {      // The token cure reaches all sections ONLY while each lane keeps
      // taking its band background from --background-color-header (no
      // private literals, no per-section variants).
      const sheetDir = join(SRC_DIR, 'components/char-sheet');
      const bandRules = [];
      for (const entry of readdirSync(sheetDir, { recursive: true })) {
        if (!String(entry).endsWith('.css')) continue;
        for (const rule of parseRules(readCss(join(sheetDir, String(entry))))) {
          if (rule.selector.endsWith('.sectionheader') && 'background-color' in rule.props) {
            bandRules.push([String(entry), rule]);
          }
        }
      }
      expect(bandRules.length, 'the sheet bands must declare their background').toBeGreaterThanOrEqual(5);
      for (const [file, rule] of bandRules) {
        expect(
          rule.props['background-color'],
          `${file}: "${rule.selector}" must ride var(--background-color-header)`
        ).toBe('var(--background-color-header)');
      }
    });
  });

  describe('disabled/ghost control family (Item 7, audit F9/F21)', () => {
    // Light mode renders cards/inputs near-WHITE; the audit's ghost family
    // (Initiative Init inputs, dashed add buttons, disabled selects) was
    // white-on-white. The cure is two tokens with contract-pinned faces.
    const faces = [
      ['dark :root', () => styleFor(':root')],
      ['explicit light', () => styleFor('[data-theme="light"]')],
      ['system-light fallback', () => {
        const query = [...mediaQueries.keys()].find((q) => normalize(q).startsWith('@media (prefers-color-scheme: light)'));
        return styleFor('body:not([data-theme])', mediaQueries.get(query));
      }],
    ];

    for (const [label, get] of faces) {
      it(`${label} defines a readable disabled-ink pair`, () => {
        const props = get();
        expect(props, `${label} token block must exist`).not.toBeNull();
        expectPairReadable(props, '--color-disabled-text', '--background-color-card', `${label} disabled ink on card`);
        expectPairReadable(props, '--color-disabled-text', '--background-color-input', `${label} disabled ink on input`);
        // WCAG non-text UI contrast floor for the visible control border.
        const border = parseColor(props['--color-disabled-border']);
        const card = parseColor(props['--background-color-card']);
        expect(border && card, `${label} border/card colors must parse`).toBeTruthy();
        const ratio = contrast(border, card);
        expect(ratio, `${label}: disabled border is ${ratio.toFixed(2)}:1 (needs ≥ 3:1)`).toBeGreaterThanOrEqual(3);
      });
    }
  });
});
