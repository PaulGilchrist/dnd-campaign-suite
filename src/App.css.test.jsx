
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

/**
 * Extract a single CSS rule block by selector.
 * Handles multi-line property declarations where `[^}]*` would fail.
 */
function extractRule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm');
  const match = css.match(regex);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Extract a @media block by its query string, correctly handling
 * nested braces via depth tracking instead of fragile regex.
 */
function extractMediaBlock(css, query) {
  const idx = css.indexOf(query);
  if (idx === -1) return null;

  const start = css.indexOf('{', idx);
  if (start === -1) return null;

  let depth = 0;
  let end = start;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return css.slice(start + 1, end);
}

describe('App.css', () => {
  let css;

  beforeEach(() => {
    css = readFileSync(join(__dirname, 'App.css'), 'utf-8');
  });

  describe('file integrity', () => {
    it('should not contain !important declarations outside print media queries', () => {
      const printContent = extractMediaBlock(css, '@media print');
      const nonPrintCss = printContent
        ? css.replace(printContent, '').replace(/@media print\s*\{[\s\S]*?\}/, '')
        : css;

      const importantMatches = nonPrintCss.match(/!important/g);
      expect(importantMatches ? importantMatches.length : 0).toBe(0);
    });
  });

  describe('CSS custom properties', () => {
    const requiredVars = [
      '--color-body', '--color-header', '--color-text', '--color-text-muted',
      '--color-text-secondary', '--color-text-inverse', '--color-primary',
      '--color-primary-hover', '--color-primary-rgb', '--color-secondary',
      '--color-hover', '--color-error', '--border-color', '--background-color',
      '--background-color-button-secondary', '--background-color-button-secondary-hover',
      '--background-color-card', '--background-color-card-hover',
      '--background-color-input', '--background-color-surface', '--background-color-error',
    ];

    it('should define all required CSS variables', () => {
      for (const variable of requiredVars) {
        expect(css).toContain(variable);
      }
    });
  });

  describe('layout', () => {
    it('should define .app with flex column layout', () => {
      const props = extractRule(css, '.app');
      expect(props).not.toBeNull();
      expect(props).toContain('display: flex');
      expect(props).toContain('flex-direction: column');
    });

    it('should define .app-body with left padding', () => {
      const props = extractRule(css, '.app-body');
      expect(props).not.toBeNull();
      expect(props).toContain('padding-left: 180px');
    });

    it('should define .half-line with half-line spacing', () => {
      const props = extractRule(css, '.half-line');
      expect(props).not.toBeNull();
      expect(props).toContain('height: 0.5em');
    });

    it('should define .char-btn-group with flex layout', () => {
      const props = extractRule(css, '.char-btn-group');
      expect(props).not.toBeNull();
      expect(props).toContain('display: flex');
    });
  });

  describe('icon button', () => {
    it('should define pointer cursor and opacity transition', () => {
      const props = extractRule(css, '.icon-button');
      expect(props).not.toBeNull();
      expect(props).toContain('cursor: pointer');
      expect(props).toContain('transition: opacity 0.2s ease');
    });

    it('should define hover state with full opacity', () => {
      const props = extractRule(css, '.icon-button:hover:not(:disabled)');
      expect(props).not.toBeNull();
      expect(props).toContain('opacity: 1');
    });

    it('should define disabled state with not-allowed cursor and reduced opacity', () => {
      const props = extractRule(css, '.icon-button:disabled');
      expect(props).not.toBeNull();
      expect(props).toContain('cursor: not-allowed');
      expect(props).toContain('opacity: 0.3');
    });
  });

  describe('campaign action buttons', () => {
    it('should define rename, delete, and back buttons with expected colors', () => {
      const rename = extractRule(css, '.rename-campaign-btn');
      const deleteBtn = extractRule(css, '.delete-campaign-btn');
      const back = extractRule(css, '.back-to-campaigns-btn');

      expect(rename).not.toBeNull();
      expect(rename).toContain('color: var(--color-body)');
      expect(deleteBtn).not.toBeNull();
      expect(deleteBtn).toContain('color: darkred');
      expect(back).not.toBeNull();
      expect(back).toContain('color: var(--color-body)');
    });
  });

  describe('character summary buttons', () => {
    it('should define border, pointer cursor, and hover opacity', () => {
      const props = extractRule(css, '.char-btn');
      expect(props).not.toBeNull();
      expect(props).toMatch(/border:\s*1px\s+solid\s+var\(--border-color\)/);
      expect(props).toContain('cursor: pointer');
      const hover = extractRule(css, '.char-btn:hover');
      expect(hover).not.toBeNull();
      expect(hover).toContain('opacity: 1');
    });
  });

  describe('utility elements', () => {
    it('should define download, hidden, and theme-toggle buttons', () => {
      const download = extractRule(css, 'button.download');
      const hidden = extractRule(css, 'button.hidden');
      const themeToggle = extractRule(css, '.theme-toggle-btn');

      expect(download).not.toBeNull();
      expect(download).toContain('background-color: darkgreen');
      expect(hidden).not.toBeNull();
      expect(hidden).toContain('display: none');
      expect(themeToggle).not.toBeNull();
      expect(themeToggle).toContain('margin-left: auto');
    });
  });

  describe('campaign tool container', () => {
    it('should define .ct-container with flex layout and padding', () => {
      const props = extractRule(css, '.ct-container');
      expect(props).not.toBeNull();
      expect(props).toContain('flex: 1');
      expect(props).toContain('padding: 20px');
    });

    it('should define .ct-header with flex row layout', () => {
      const props = extractRule(css, '.ct-container .ct-header');
      expect(props).not.toBeNull();
      expect(props).toContain('display: flex');
      expect(props).toContain('justify-content: space-between');
    });

    it('should define .ct-title with header styling', () => {
      const props = extractRule(css, '.ct-container .ct-title');
      expect(props).not.toBeNull();
      expect(props).toContain('color: var(--color-header)');
      expect(props).toContain('font-size: 1.6em');
    });

    it('should define .ct-new-btn with primary color scheme', () => {
      const props = extractRule(css, '.ct-container .ct-new-btn');
      expect(props).not.toBeNull();
      expect(props).toContain('background: var(--color-primary)');
      expect(props).toContain('color: var(--color-text-inverse)');
    });

    it('should define .ct-search-row with flex layout and rounded border', () => {
      const props = extractRule(css, '.ct-container .ct-search-row');
      expect(props).not.toBeNull();
      expect(props).toContain('display: flex');
      expect(props).toContain('border-radius: 6px');
    });

    it('should define .ct-search-input with flex layout', () => {
      const props = extractRule(css, '.ct-container .ct-search-input');
      expect(props).not.toBeNull();
      expect(props).toContain('flex: 1');
    });

    it('should define .ct-empty-state with centered text', () => {
      const props = extractRule(css, '.ct-container .ct-empty-state');
      expect(props).not.toBeNull();
      expect(props).toContain('text-align: center');
    });

    it('should define .ct-list with flex column layout and list sub-elements', () => {
      const list = extractRule(css, '.ct-container .ct-list');
      expect(list).not.toBeNull();
      expect(list).toContain('display: flex');
      expect(list).toContain('flex-direction: column');

      const header = extractRule(css, '.ct-container .ct-list-item-header');
      const name = extractRule(css, '.ct-container .ct-list-name');
      const meta = extractRule(css, '.ct-container .ct-list-meta');
      const details = extractRule(css, '.ct-container .ct-list-details');
      const preview = extractRule(css, '.ct-container .ct-list-preview');

      expect(header).not.toBeNull();
      expect(name).not.toBeNull();
      expect(name).toContain('font-weight: 600');
      expect(meta).not.toBeNull();
      expect(details).not.toBeNull();
      expect(details).toContain('flex-wrap: wrap');
      expect(preview).not.toBeNull();
      expect(preview).toContain('color: var(--color-text-secondary)');
    });

    it('should define .ct-list-item with hover state', () => {
      const props = extractRule(css, '.ct-container .ct-list-item');
      expect(props).not.toBeNull();
      expect(props).toContain('cursor: pointer');
    });
  });

  describe('modal', () => {
    it('should define .ct-modal-overlay with fixed positioning and z-index', () => {
      const props = extractRule(css, '.ct-container .ct-modal-overlay');
      expect(props).not.toBeNull();
      expect(props).toContain('position: fixed');
      expect(props).toContain('z-index: 1000');
    });

    it('should define .ct-modal with max-width constraint', () => {
      const props = extractRule(css, '.ct-container .ct-modal');
      expect(props).not.toBeNull();
      expect(props).toContain('max-width: 90vw');
    });

    it('should define header, close, body, and footer sections', () => {
      const header = extractRule(css, '.ct-container .ct-modal-header');
      const close = extractRule(css, '.ct-container .ct-modal-close');
      const body = extractRule(css, '.ct-container .ct-modal-body');
      const footer = extractRule(css, '.ct-container .ct-modal-footer');

      expect(header).not.toBeNull();
      expect(header).toMatch(/border-bottom:\s*1px\s+solid/);
      expect(close).not.toBeNull();
      expect(close).toContain('cursor: pointer');
      expect(body).not.toBeNull();
      expect(body).toContain('overflow-y: auto');
      expect(footer).not.toBeNull();
      expect(footer).toMatch(/border-top:\s*1px\s+solid/);
    });

    it('should define modal actions and buttons with flex layout', () => {
      const actions = extractRule(css, '.ct-container .ct-modal-actions');
      const buttons = extractRule(css, '.ct-container .ct-modal-buttons');

      expect(actions).not.toBeNull();
      expect(actions).toContain('display: flex');
      expect(buttons).not.toBeNull();
      expect(buttons).toContain('display: flex');
    });
  });

  describe('form fields', () => {
    it('should define label, input, textarea, and select with expected properties', () => {
      const label = extractRule(css, '.ct-container .ct-label');
      const required = extractRule(css, '.ct-container .ct-required');
      expect(label).not.toBeNull();
      expect(label).toContain('color: var(--color-text-secondary)');
      expect(required).not.toBeNull();
      expect(required).toContain('color: var(--color-error)');

      const input = extractRule(css, '.ct-container .ct-input');
      const inputFocus = extractRule(css, '.ct-container .ct-input:focus');
      expect(input).not.toBeNull();
      expect(input).toContain('box-sizing: border-box');
      expect(inputFocus).not.toBeNull();
      expect(inputFocus).toContain('border-color: var(--color-primary)');
      expect(inputFocus).toContain('box-shadow');

      const textarea = extractRule(css, '.ct-container .ct-textarea');
      const textareaFocus = extractRule(css, '.ct-container .ct-textarea:focus');
      expect(textarea).not.toBeNull();
      expect(textarea).toContain('resize: vertical');
      expect(textareaFocus).not.toBeNull();
      expect(textareaFocus).toContain('border-color: var(--color-primary)');
      expect(textareaFocus).toContain('box-shadow');

      const select = extractRule(css, '.ct-container .ct-select');
      const selectFocus = extractRule(css, '.ct-container .ct-select:focus');
      expect(select).not.toBeNull();
      expect(select).toContain('cursor: pointer');
      expect(selectFocus).not.toBeNull();
      expect(selectFocus).toContain('border-color: var(--color-primary)');
      expect(selectFocus).toContain('box-shadow');
    });
  });

  describe('buttons', () => {
    it('should define .ct-btn, .ct-btn-primary, and .ct-btn-danger', () => {
      const btn = extractRule(css, '.ct-container .ct-btn');
      const btnPrimary = extractRule(css, '.ct-container .ct-btn-primary');
      const btnDanger = extractRule(css, '.ct-container .ct-btn-danger');

      expect(btn).not.toBeNull();
      expect(btn).toContain('background: var(--background-color-button-secondary)');
      expect(btnPrimary).not.toBeNull();
      expect(btnPrimary).toContain('background: var(--color-primary)');
      expect(btnDanger).not.toBeNull();
      expect(btnDanger).toContain('color: var(--color-error)');
    });

    it('should disable .ct-btn with reduced opacity and not-allowed cursor', () => {
      const disabled = extractRule(css, '.ct-container .ct-btn:disabled');
      expect(disabled).not.toBeNull();
      expect(disabled).toContain('cursor: not-allowed');
      expect(disabled).toContain('opacity: 0.5');
    });
  });

  describe('responsive styles', () => {
    it('should include flex-wrap and adjusted modal width', () => {
      const content = extractMediaBlock(css, '@media (max-width: 600px)');
      expect(content).not.toBeNull();
      expect(content).toContain('flex-wrap');
      expect(content).toContain('95vw');
    });
  });

  describe('print styles', () => {
    it('should hide non-modal content and show modal full page', () => {
      const content = extractMediaBlock(css, '@media print');
      expect(content).not.toBeNull();
      expect(content).toContain(':has(.ct-modal)');
      expect(content).toContain('display: none');
      expect(content).toContain('max-width: 100%');
      expect(content).toContain('width: 100%');
    });
  });
});
