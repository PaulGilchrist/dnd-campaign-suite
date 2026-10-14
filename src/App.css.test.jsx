// @maintained-by-ai
/**
 * Contract tests for App.css.
 *
 * These verify the styling contracts the app's JSX relies on (app shell
 * layout and the shared `ct-*` campaign-tool component family used by
 * Factions, Notes, NPCs, Quests, Settlements, Sessions and PartyInventory),
 * not incidental formatting:
 *
 *  - Rules are parsed into selector → property maps, so assertions match
 *    exact normalized declaration values instead of brittle substrings
 *    (`toContain('flex: 1')` would also pass `flex: 1 0 auto`).
 *  - CSS comments are stripped before parsing, so commented-out rules can
 *    never satisfy an assertion.
 *  - Assertions test semantics (layout modes, viewport units, positive
 *    feedback relationships like "hover brighter than resting"), not exact
 *    cosmetic values — designer nudges shouldn't break the contract, but
 *    removing an interaction affordance or breakpoint should.
 *  - The `!important` guard removes @media blocks by parse position rather
 *    than fragile string replacement, and is kept honest by asserting the
 *    print block DOES use !important.
 *  - Theme tokens consumed via `var()` must be declared in the global
 *    theme (index.css) or carry an inline fallback — a rename in either
 *    file breaks the contract loudly.
 *
 * Selectors with no JSX consumer (e.g. legacy .icon-button, campaign
 * action buttons, .theme-toggle-btn, button.download/.hidden) are
 * deliberately NOT covered here — dead CSS gets no contract.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

/** Read a stylesheet and strip /* ... *\/ comments before parsing. */
const readCss = (file) => readFileSync(file, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

const css = readCss(join(SRC_DIR, 'App.css'));

/** index.css holds the light/dark theme custom properties App.css consumes. */
const themeCss = readCss(join(SRC_DIR, 'index.css'));

/** Fixed sidebar lives in its own file; its width reserves .app-body's gutter. */
const sidebarCss = readCss(join(SRC_DIR, 'components/sidebar/Sidebar.css'));

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
    rules.push({
      selector: normalizeSelector(match[1]),
      props: parseDeclarations(match[2]),
    });
  }
  return rules;
}

/**
 * Parse a stylesheet into top-level rules and @media blocks.
 * Block extents are found by brace-depth tracking so nested rules and the
 * print block's !important never confuse downstream extraction.
 */
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

const { topRules, mediaQueries } = parseStylesheet(css);

/**
 * Cascade-aware lookup: merges declarations from every top-level rule whose
 * (possibly comma-grouped) selector matches, later rules winning.
 */
function styleFor(selector, rules = topRules) {
  const target = normalizeSelector(selector);
  const props = {};
  let found = false;
  for (const rule of rules) {
    const parts = rule.selector.split(',').map((p) => p.trim());
    if (parts.includes(target)) {
      found = true;
      Object.assign(props, rule.props);
    }
  }
  return found ? props : null;
}

/** Same lookup, scoped to a parsed @media block. */
function styleInMedia(query, selector) {
  const rules = mediaQueries.get(normalize(query));
  if (!rules) return null;
  return styleFor(selector, rules);
}

/** Assert every expected declaration holds, naming the offending selector. */
function expectStyles(selector, expected, source = 'App.css') {
  const props = source === 'App.css' ? styleFor(selector) : styleInMedia(source, selector);
  expect(props, `${source}: rule for "${selector}" should exist`).not.toBeNull();
  for (const [prop, value] of Object.entries(expected)) {
    expect(props[prop], `${source}: "${selector}" should declare "${prop}: ${value}"`).toBe(value);
  }
}

/** Assert a hover/state rule visibly changes a property from its resting value. */
function expectChanges(selector, hoverSelector, prop) {
  expectStyles(selector, {});
  const hoverProps = styleFor(hoverSelector);
  expect(hoverProps, `rule for "${hoverSelector}" should exist`).not.toBeNull();
  expect(
    hoverProps[prop],
    `"${hoverSelector}" should change "${prop}" from its resting value`
  ).toBeTruthy();
  expect(hoverProps[prop]).not.toBe(styleFor(selector)[prop]);
}

describe('App.css', () => {
  describe('file hygiene', () => {
    it('keeps !important confined to the print media block', () => {
      // The print block legitimately needs !important to override the app
      // layout on paper; nothing else may use it.
      const printRules = mediaQueries.get('@media print');
      expect(printRules, 'expected an @media print block').toBeDefined();
      const printUsesImportant = printRules.some((rule) =>
        Object.values(rule.props).some((v) => v.includes('!important'))
      );
      expect(printUsesImportant, 'print block should still force display: none with !important').toBe(true);

      // Rebuild the non-print CSS from the parse (comments already gone).
      const nonPrint =
        topRules.map((r) => Object.values(r.props).join(';')).join(';') +
        [...mediaQueries.entries()]
          .filter(([query]) => normalize(query) !== '@media print')
          .flatMap(([, rules]) => rules.flatMap((r) => Object.values(r.props)))
          .join(';');
      expect(nonPrint).not.toMatch(/!important/);
    });

    it('only consumes theme tokens that are globally defined or have a fallback', () => {
      const definedTokens = new Set(
        [...themeCss.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1])
      );

      const used = [...css.matchAll(/var\(\s*(--[\w-]+)((?:[^()]|\([^()]*\))*)\)/g)];
      expect(used.length, 'App.css should consume theme tokens via var()').toBeGreaterThan(0);

      for (const match of used) {
        const [, token, rest] = match;
        const hasFallback = rest.trim().startsWith(',');
        expect(
          hasFallback || definedTokens.has(token),
          `theme token ${token} is used without fallback but never declared in index.css`
        ).toBe(true);
      }
    });
  });

  describe('app shell layout', () => {
    it('stacks the shell at full viewport height and keeps main content scrollable', () => {
      expectStyles('.app', {
        height: '100vh',
        display: 'flex',
        'flex-direction': 'column',
      });
      // min-height: 0 lets the flex child scroll instead of overflowing.
      expectStyles('.app-body', {
        display: 'flex',
        flex: '1',
        'min-height': '0',
      });
    });

    it('reserves a gutter in .app-body exactly as wide as the fixed sidebar', () => {
      // A mismatch slides page content under (or leaves a gap beside) the sidebar.
      const sidebar = styleFor('.sidebar', parseRules(sidebarCss));
      expect(sidebar, 'Sidebar.css should style .sidebar').not.toBeNull();
      expect(sidebar.position, 'sidebar should be fixed').toBe('fixed');
      expect(styleFor('.app-body')['padding-left'], 'gutter must match .sidebar width').toBe(sidebar.width);
    });

    it('renders .half-line as a half-em vertical spacer', () => {
      expectStyles('.half-line', {
        height: '0.5em',
        'line-height': '0.5em',
      });
    });
  });

  describe('character summary buttons', () => {
    it('lays out compact, clickable character buttons that brighten on hover', () => {
      expectStyles('.char-btn-group', { display: 'flex', 'align-items': 'center' });
      const btn = styleFor('.char-btn');
      expectStyles('.char-btn', {
        border: '1px solid var(--border-color)',
        cursor: 'pointer',
        'white-space': 'nowrap',
      });
      expect(btn['background-color'], '.char-btn should sit unobtrusively in the bar').toBe('transparent');
      expectStyles('.char-btn:hover', { opacity: '1' });
      expect(parseFloat(btn.opacity), 'resting .char-btn should be dimmed below its hover state').toBeLessThan(1);
    });
  });

  describe('campaign tool container and header', () => {
    it('fills the content area with a spread header and actionable back/new buttons', () => {
      expectStyles('.ct-container', { flex: '1', width: '100%' });
      expectStyles('.ct-container .ct-header', {
        display: 'flex',
        'justify-content': 'space-between',
        'align-items': 'center',
      });
      expectStyles('.ct-container .ct-title', { color: 'var(--color-header)' });
      expectStyles('.ct-container .ct-back-btn', {
        cursor: 'pointer',
        border: '1px solid var(--border-color)',
      });
      expectChanges('.ct-container .ct-back-btn', '.ct-container .ct-back-btn:hover', 'background');
      expectStyles('.ct-container .ct-new-btn', {
        background: 'var(--color-primary)',
        color: 'var(--color-text-inverse)',
        cursor: 'pointer',
      });
      expectChanges('.ct-container .ct-new-btn', '.ct-container .ct-new-btn:hover', 'background');
    });
  });

  describe('campaign tool search bar', () => {
    it('grows the input in a flex row with focus feedback and a reddening clear control', () => {
      expectStyles('.ct-container .ct-search-row', { display: 'flex' });
      expectStyles('.ct-container .ct-search-input', { flex: '1' });
      expectStyles('.ct-container .ct-search-input:focus', { 'border-color': 'var(--color-primary)' });
      expectStyles('.ct-container .ct-search-clear', {
        cursor: 'pointer',
        border: 'none',
      });
      expectStyles('.ct-container .ct-search-clear:hover', { color: 'var(--color-error)' });
    });
  });

  describe('campaign tool list', () => {
    it('stacks clickable card items with hover feedback and unclipped layout', () => {
      expectStyles('.ct-container .ct-list', {
        'list-style': 'none',
        display: 'flex',
        'flex-direction': 'column',
      });
      expectStyles('.ct-container .ct-list-item', { cursor: 'pointer' });
      expectChanges(
        '.ct-container .ct-list-item',
        '.ct-container .ct-list-item:hover',
        'background'
      );
      expectStyles('.ct-container .ct-list-item-header', {
        display: 'flex',
        'justify-content': 'space-between',
      });
      expectStyles('.ct-container .ct-list-meta', { 'flex-shrink': '0' });
      expectStyles('.ct-container .ct-list-details', { 'flex-wrap': 'wrap' });
    });
  });

  describe('campaign tool modal', () => {
    it('overlays the viewport and keeps the modal scrollable within it', () => {
      expectStyles('.ct-container .ct-modal-overlay', {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        display: 'flex',
      });
      expect(
        parseInt(styleFor('.ct-container .ct-modal-overlay')['z-index'], 10),
        'overlay must sit above app content'
      ).toBeGreaterThan(0);
      expect(
        styleFor('.ct-container .ct-modal-overlay').background,
        'overlay should dim the page behind the modal'
      ).not.toMatch(/^(none|transparent)$/);

      const modal = styleFor('.ct-container .ct-modal');
      expectStyles('.ct-container .ct-modal', {
        display: 'flex',
        'flex-direction': 'column',
      });
      expect(modal['max-width'], 'modal should be constrained to the viewport').toMatch(/vw$/);
      expect(modal['max-height'], 'modal should be constrained to the viewport').toMatch(/vh$/);

      expectStyles('.ct-container .ct-modal-body', { 'overflow-y': 'auto' });
      expectStyles('.ct-container .ct-modal-close', { cursor: 'pointer' });
    });
  });

  describe('campaign tool form fields', () => {
    it('sizes every field type to its container without overflowing', () => {
      for (const selector of ['.ct-input', '.ct-textarea', '.ct-select']) {
        expectStyles(`.ct-container ${selector}`, {
          width: '100%',
          'box-sizing': 'border-box',
        });
      }
    });

    it('highlights focused fields with the primary color and a glow ring', () => {
      for (const selector of ['.ct-input:focus', '.ct-textarea:focus', '.ct-select:focus']) {
        const full = `.ct-container ${selector}`;
        expectStyles(full, { 'border-color': 'var(--color-primary)' });
        const shadow = styleFor(full)['box-shadow'];
        expect(shadow, `${full} should declare a focus box-shadow`).toBeTruthy();
        expect(shadow, `${full} focus glow should use the primary rgb token`).toContain(
          'var(--color-primary-rgb'
        );
      }
    });

    it('marks required labels in the error color and keeps field affordances usable', () => {
      expectStyles('.ct-container .ct-label', {
        display: 'block',
        color: 'var(--color-text-secondary)',
      });
      expectStyles('.ct-container .ct-required', { color: 'var(--color-error)' });
      expectStyles('.ct-container .ct-textarea', { resize: 'vertical' });
      expectStyles('.ct-container .ct-select', { cursor: 'pointer' });
    });
  });

  describe('campaign tool buttons', () => {
    it('defaults to secondary styling, overrides via variants, and disables visibly', () => {
      expectStyles('.ct-container .ct-btn', { cursor: 'pointer' });
      expectChanges(
        '.ct-container .ct-btn',
        '.ct-container .ct-btn:hover:not(:disabled)',
        'background'
      );
      expectStyles('.ct-container .ct-btn-primary', {
        background: 'var(--color-primary)',
        color: 'var(--color-text-inverse)',
      });
      expectChanges(
        '.ct-container .ct-btn-primary',
        '.ct-container .ct-btn-primary:hover:not(:disabled)',
        'background'
      );
      const danger = styleFor('.ct-container .ct-btn-danger');
      expect(danger.color, 'danger buttons should read as error-colored').toBe('var(--color-error)');
      expectChanges(
        '.ct-container .ct-btn-danger',
        '.ct-container .ct-btn-danger:hover:not(:disabled)',
        'background'
      );
      expectStyles('.ct-container .ct-btn:disabled', {
        cursor: 'not-allowed',
        opacity: '0.5',
      });
    });
  });

  describe('responsive styles (max-width: 600px)', () => {
    const MEDIA = '@media (max-width: 600px)';

    it('tightens the gutter, wraps the header, and stretches the modal to the viewport', () => {
      // Tighter than desktop proves the breakpoint actually overrides.
      const desktop = parseFloat(styleFor('.ct-container').padding);
      const mobile = styleInMedia(MEDIA, '.ct-container');
      expect(mobile, `expected ${MEDIA} to restyle .ct-container`).not.toBeNull();
      expect(
        parseFloat(mobile.padding),
        'small screens should reduce .ct-container padding'
      ).toBeLessThan(desktop);
      expectStyles('.ct-container .ct-header', { 'flex-wrap': 'wrap' }, MEDIA);
      const mobileModal = styleInMedia(MEDIA, '.ct-container .ct-modal');
      expect(mobileModal.width, 'modal should size to the viewport on small screens').toMatch(/vw$/);
      expect(
        parseFloat(mobileModal['max-height']),
        'modal should grow taller on small screens'
      ).toBeGreaterThan(parseFloat(styleFor('.ct-container .ct-modal')['max-height']));
    });

    it('stacks the modal footer and stretches its action rows full width', () => {
      expectStyles('.ct-container .ct-modal-footer', { 'flex-direction': 'column' }, MEDIA);
      expectStyles('.ct-container .ct-modal-actions', { width: '100%' }, MEDIA);
      expectStyles('.ct-container .ct-modal-buttons', {
        width: '100%',
        'justify-content': 'flex-end',
      }, MEDIA);
    });
  });

  describe('print styles', () => {
    const MEDIA = '@media print';

    it('flattens an open modal into a full-page scroll-free document', () => {
      expectStyles(
        '.ct-container:has(.ct-modal) > :not(.ct-modal-overlay)',
        { display: 'none !important' },
        MEDIA
      );
      expectStyles('.ct-container .ct-modal-overlay:has(.ct-modal)', {
        position: 'static',
        background: 'none',
        display: 'block',
        'z-index': 'auto',
      }, MEDIA);
      expectStyles('.ct-container .ct-modal', {
        width: '100%',
        'max-width': '100%',
        'max-height': 'none',
        'box-shadow': 'none',
        display: 'block',
      }, MEDIA);
      expectStyles('.ct-container .ct-modal .ct-modal-body', {
        overflow: 'visible',
      }, MEDIA);
    });
  });
});
