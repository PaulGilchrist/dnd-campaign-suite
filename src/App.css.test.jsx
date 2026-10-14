// @improved-by-ai
/**
 * Contract tests for App.css.
 *
 * These verify the styling contracts the app's JSX relies on (app shell
 * layout, icon/char buttons, and the shared `ct-*` campaign-tool component
 * family used by Factions, Notes, NPCs, Quests, Settlements, Sessions and
 * PartyInventory), not incidental formatting:
 *
 *  - Rules are parsed into selector → property maps, so assertions match
 *    exact normalized declaration values instead of brittle substrings
 *    (`toContain('flex: 1')` would also pass `flex: 1 0 auto`).
 *  - CSS comments are stripped before parsing, so commented-out rules can
 *    never satisfy an assertion.
 *  - The `!important` guard removes @media blocks by parse position rather
 *    than fragile string replacement, and is kept honest by asserting the
 *    print block DOES use !important.
 *  - Theme tokens consumed via `var()` must be declared in the global
 *    theme (index.css) or carry an inline fallback — a rename in either
 *    file breaks the build-time contract loudly.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

/** Read the stylesheet once and strip /* ... *\/ comments before parsing. */
const rawCss = readFileSync(join(SRC_DIR, 'App.css'), 'utf-8');
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');

/** index.css holds the light/dark theme custom properties App.css consumes. */
const themeCss = readFileSync(join(SRC_DIR, 'index.css'), 'utf-8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

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
function styleFor(selector) {
  const target = normalizeSelector(selector);
  const props = {};
  let found = false;
  for (const rule of topRules) {
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

/** Assert every expected declaration holds, naming the offending selector. */
function expectStyles(selector, expected, source = 'App.css') {
  const props = source === 'App.css' ? styleFor(selector) : styleInMedia(source, selector);
  expect(props, `${source}: rule for "${selector}" should exist`).not.toBeNull();
  for (const [prop, value] of Object.entries(expected)) {
    expect(props[prop], `${source}: "${selector}" should declare "${prop}: ${value}"`).toBe(value);
  }
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

    it('resolves key structural selectors used by the app shell and campaign tools', () => {
      // A typo here would silently unstyle every campaign tool page.
      expect(styleFor('.app')).not.toBeNull();
      expect(styleFor('.app-body')).not.toBeNull();
      expect(styleFor('.ct-container')).not.toBeNull();
      expect(styleFor('.icon-button')).not.toBeNull();
      expect(styleFor('.char-btn')).not.toBeNull();
    });
  });

  describe('app shell layout', () => {
    it('stacks the app vertically at full viewport height', () => {
      expectStyles('.app', {
        height: '100vh',
        display: 'flex',
        'flex-direction': 'column',
      });
    });

    it('reserves a sidebar gutter in .app-body and lets it grow', () => {
      expectStyles('.app-body', {
        display: 'flex',
        'padding-left': '180px',
        flex: '1',
        'min-height': '0',
      });
    });

    it('renders .half-line as a half-em vertical spacer', () => {
      expectStyles('.half-line', {
        height: '0.5em',
        'line-height': '0.5em',
      });
    });
  });

  describe('icon buttons', () => {
    it('shows a pointer cursor and a subtle base opacity with a hover transition', () => {
      expectStyles('.icon-button', {
        cursor: 'pointer',
        opacity: '0.8',
        transition: 'opacity 0.2s ease',
      });
    });

    it('brightens on hover only when enabled', () => {
      expectStyles('.icon-button:hover:not(:disabled)', { opacity: '1' });
      const base = parseFloat(styleFor('.icon-button').opacity);
      const hover = parseFloat(styleFor('.icon-button:hover:not(:disabled)').opacity);
      expect(hover).toBeGreaterThan(base);
    });

    it('marks disabled buttons as not-allowed and dimmer than the resting state', () => {
      expectStyles('.icon-button:disabled', { cursor: 'not-allowed' });
      const base = parseFloat(styleFor('.icon-button').opacity);
      const disabled = parseFloat(styleFor('.icon-button:disabled').opacity);
      expect(disabled).toBeLessThan(base);
    });
  });

  describe('campaign action buttons', () => {
    it('uses theme text colors for rename and back buttons, brightening on hover', () => {
      expectStyles('.rename-campaign-btn', { color: 'var(--color-body)' });
      expectStyles('.rename-campaign-btn:hover:not(:disabled)', { color: 'var(--color-header)' });
      expectStyles('.back-to-campaigns-btn', { color: 'var(--color-body)' });
      expectStyles('.back-to-campaigns-btn:hover:not(:disabled)', { color: 'var(--color-header)' });
    });

    it('flags the destructive delete button in red, intensifying on hover', () => {
      expectStyles('.delete-campaign-btn', { color: 'darkred' });
      expectStyles('.delete-campaign-btn:hover:not(:disabled)', { color: 'red' });
    });
  });

  describe('character summary buttons', () => {
    it('lays out .char-btn-group as a compact inline flex row', () => {
      expectStyles('.char-btn-group', { display: 'flex', 'align-items': 'center' });
    });

    it('gives .char-btn a bordered, clickable, unobtrusive resting state', () => {
      expectStyles('.char-btn', {
        border: '1px solid var(--border-color)',
        'background-color': 'transparent',
        color: 'var(--color-text)',
        cursor: 'pointer',
        opacity: '0.7',
        transition: 'opacity 0.2s ease',
        'white-space': 'nowrap',
      });
    });

    it('brings .char-btn to full opacity with a hover border on hover', () => {
      expectStyles('.char-btn:hover', {
        opacity: '1',
        'border-color': 'var(--color-hover)',
      });
    });
  });

  describe('utility classes', () => {
    it('styles download buttons as green with readable text', () => {
      expectStyles('button.download', {
        'background-color': 'darkgreen',
        color: '#eee',
      });
    });

    it('fully hides elements marked button.hidden', () => {
      expectStyles('button.hidden', { display: 'none' });
    });

    it('pushes the theme toggle to the far right of its flex header', () => {
      expectStyles('.theme-toggle-btn', { 'margin-left': 'auto' });
    });
  });

  describe('campaign tool container and header', () => {
    it('lets .ct-container fill available width with breathing room', () => {
      expectStyles('.ct-container', {
        flex: '1',
        padding: '20px',
        width: '100%',
      });
    });

    it('spreads header title and actions apart on one row', () => {
      expectStyles('.ct-container .ct-header', {
        display: 'flex',
        'justify-content': 'space-between',
        'align-items': 'center',
      });
      expectStyles('.ct-container .ct-title', {
        color: 'var(--color-header)',
        'font-size': '1.6em',
      });
    });

    it('provides working back and primary new buttons with hover feedback', () => {
      expectStyles('.ct-container .ct-back-btn', {
        cursor: 'pointer',
        border: '1px solid var(--border-color)',
        background: 'var(--background-color-button-secondary)',
      });
      expectStyles('.ct-container .ct-back-btn:hover', {
        background: 'var(--background-color-button-secondary-hover)',
      });
      expectStyles('.ct-container .ct-new-btn', {
        background: 'var(--color-primary)',
        color: 'var(--color-text-inverse)',
        cursor: 'pointer',
      });
      expectStyles('.ct-container .ct-new-btn:hover', {
        background: 'var(--color-primary-hover)',
      });
    });
  });

  describe('campaign tool search bar', () => {
    it('renders a rounded flex search row with a growing input', () => {
      expectStyles('.ct-container .ct-search-row', {
        display: 'flex',
        'border-radius': '6px',
        background: 'var(--background-color-card)',
      });
      expectStyles('.ct-container .ct-search-input', {
        flex: '1',
        background: 'var(--background-color-input)',
      });
      expectStyles('.ct-container .ct-search-input:focus', {
        'border-color': 'var(--color-primary)',
      });
    });

    it('offers a clickable clear control that turns red on hover', () => {
      expectStyles('.ct-container .ct-search-clear', {
        cursor: 'pointer',
        'border': 'none',
        color: 'var(--color-text-muted)',
      });
      expectStyles('.ct-container .ct-search-clear:hover', {
        color: 'var(--color-error)',
      });
    });
  });

  describe('campaign tool list', () => {
    it('centers and dims the empty state message', () => {
      expectStyles('.ct-container .ct-empty-state', {
        'text-align': 'center',
        'font-style': 'italic',
        color: 'var(--color-text-muted)',
      });
    });

    it('stacks list items in a gap-separated column', () => {
      expectStyles('.ct-container .ct-list', {
        'list-style': 'none',
        display: 'flex',
        'flex-direction': 'column',
      });
    });

    it('makes list items clickable with a highlighted hover state', () => {
      expectStyles('.ct-container .ct-list-item', {
        cursor: 'pointer',
        background: 'var(--background-color-card)',
      });
      expectStyles('.ct-container .ct-list-item:hover', {
        'border-color': 'var(--color-primary)',
        background: 'var(--background-color-card-hover)',
      });
    });

    it('emphasizes the item name and wraps its details without clipping', () => {
      expectStyles('.ct-container .ct-list-item-header', {
        display: 'flex',
        'justify-content': 'space-between',
      });
      expectStyles('.ct-container .ct-list-name', { 'font-weight': '600' });
      expectStyles('.ct-container .ct-list-meta', {
        display: 'flex',
        'flex-shrink': '0',
      });
      expectStyles('.ct-container .ct-list-details', {
        display: 'flex',
        'flex-wrap': 'wrap',
      });
      expectStyles('.ct-container .ct-list-preview', {
        color: 'var(--color-text-secondary)',
      });
    });
  });

  describe('campaign tool modal', () => {
    it('overlays the viewport with a dimmed, above-content layer', () => {
      expectStyles('.ct-container .ct-modal-overlay', {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        background: 'rgba(0, 0, 0, 0.6)',
        'z-index': '1000',
      });
    });

    it('constrains the modal to the viewport and stacks its sections', () => {
      expectStyles('.ct-container .ct-modal', {
        width: '520px',
        'max-width': '90vw',
        'max-height': '85vh',
        display: 'flex',
        'flex-direction': 'column',
      });
    });

    it('separates header, scrollable body, and footer with borders', () => {
      expectStyles('.ct-container .ct-modal-header', {
        display: 'flex',
        'border-bottom': '1px solid var(--border-color)',
      });
      expectStyles('.ct-container .ct-modal-body', {
        'overflow-y': 'auto',
        padding: '20px',
      });
      expectStyles('.ct-container .ct-modal-footer', {
        display: 'flex',
        'border-top': '1px solid var(--border-color)',
      });
    });

    it('provides a clickable close control and flex action rows', () => {
      expectStyles('.ct-container .ct-modal-close', {
        cursor: 'pointer',
        border: 'none',
        background: 'none',
      });
      expectStyles('.ct-container .ct-modal-actions', { display: 'flex', gap: '8px' });
      expectStyles('.ct-container .ct-modal-buttons', { display: 'flex', gap: '8px' });
    });
  });

  describe('campaign tool form fields', () => {
    it('labels fields in secondary text and marks required ones in error color', () => {
      expectStyles('.ct-container .ct-label', {
        display: 'block',
        color: 'var(--color-text-secondary)',
      });
      expectStyles('.ct-container .ct-required', { color: 'var(--color-error)' });
    });

    it('sizes every field type to its container without overflowing', () => {
      for (const selector of ['.ct-input', '.ct-textarea', '.ct-select']) {
        const full = `.ct-container ${selector}`;
        expectStyles(full, {
          width: '100%',
          'box-sizing': 'border-box',
          background: 'var(--background-color-input)',
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

    it('keeps textareas vertically resizable and selects clickable', () => {
      expectStyles('.ct-container .ct-textarea', { resize: 'vertical' });
      expectStyles('.ct-container .ct-select', { cursor: 'pointer' });
    });
  });

  describe('campaign tool buttons', () => {
    it('defaults to secondary styling with a hover fill', () => {
      expectStyles('.ct-container .ct-btn', {
        background: 'var(--background-color-button-secondary)',
        cursor: 'pointer',
      });
      expectStyles('.ct-container .ct-btn:hover:not(:disabled)', {
        background: 'var(--background-color-button-secondary-hover)',
      });
    });

    it('variants override color: primary filled, danger outlined red', () => {
      expectStyles('.ct-container .ct-btn-primary', {
        background: 'var(--color-primary)',
        color: 'var(--color-text-inverse)',
        'border-color': 'var(--color-primary)',
      });
      expectStyles('.ct-container .ct-btn-primary:hover:not(:disabled)', {
        background: 'var(--color-primary-hover)',
      });
      expectStyles('.ct-container .ct-btn-danger', {
        color: 'var(--color-error)',
        'border-color': 'var(--color-error)',
      });
      expectStyles('.ct-container .ct-btn-danger:hover:not(:disabled)', {
        background: 'var(--background-color-error)',
      });
    });

    it('visually disables buttons with reduced opacity and not-allowed cursor', () => {
      expectStyles('.ct-container .ct-btn:disabled', {
        cursor: 'not-allowed',
        opacity: '0.5',
      });
    });
  });

  describe('responsive styles (max-width: 600px)', () => {
    const MEDIA = '@media (max-width: 600px)';

    it('exists as a small-screen breakpoint', () => {
      expect(mediaQueries.has(MEDIA), `expected ${MEDIA} block`).toBe(true);
    });

    it('tightens container padding and wraps the header instead of overflowing', () => {
      expectStyles('.ct-container', { padding: '12px' }, MEDIA);
      expectStyles('.ct-container .ct-header', { 'flex-wrap': 'wrap' }, MEDIA);
    });

    it('expands the modal to nearly full viewport width', () => {
      expectStyles('.ct-container .ct-modal', {
        width: '95vw',
        'max-height': '90vh',
      }, MEDIA);
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

    it('hides everything behind an open modal with !important authority', () => {
      expectStyles(
        '.ct-container:has(.ct-modal) > :not(.ct-modal-overlay)',
        { display: 'none !important' },
        MEDIA
      );
    });

    it('flattens the overlay into static document flow', () => {
      expectStyles('.ct-container .ct-modal-overlay:has(.ct-modal)', {
        position: 'static',
        background: 'none',
        display: 'block',
        'z-index': 'auto',
      }, MEDIA);
    });

    it('lets the modal span the full page without scroll or chrome', () => {
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
