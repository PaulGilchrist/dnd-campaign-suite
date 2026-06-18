// @improved-by-ai
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseProperties(block) {
  const clean = stripComments(block);
  return clean
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((prop) => {
      const colonIndex = prop.indexOf(':');
      if (colonIndex === -1) return null;
      const key = prop.slice(0, colonIndex).trim();
      const value = prop.slice(colonIndex + 1).trim();
      return { key, value };
    })
    .filter((p) => p && p.key && p.value);
}

function escapeSelector(selector) {
  return selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractRule(css, selector) {
  const cleanCss = stripComments(css);
  const escaped = escapeSelector(selector);
  const regex = new RegExp(`${escaped}\\s*{([^}]+)}`, 's');
  const match = cleanCss.match(regex);
  return match ? match[1].trim() : null;
}

function extractRules(css, selector) {
  const cleanCss = stripComments(css);
  const escaped = escapeSelector(selector);
  const regex = new RegExp(`${escaped}\\s*{([^}]+)}`, 'gs');
  const results = [];
  let match;
  while ((match = regex.exec(cleanCss)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

function extractMediaQueries(css) {
  const cleanCss = stripComments(css);
  const regex = /@media\s*\(([^)]+)\)\s*{((?:[^{}]|\{[^{}]*\})*)}/g;
  const results = [];
  let match;
  while ((match = regex.exec(cleanCss)) !== null) {
    results.push({ media: match[1].trim(), body: match[2].trim() });
  }
  return results;
}

describe('App.css', () => {
  let css;

  beforeAll(() => {
    css = readFileSync(join(__dirname, 'App.css'), 'utf-8');
  });

  describe('.app', () => {
    it('should define a flex column layout with full viewport height', () => {
      const rule = extractRule(css, '.app');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['display']).toBe('flex');
      expect(propMap['flex-direction']).toBe('column');
      expect(propMap['height']).toBe('100vh');
    });

    it('should have exactly the expected properties and no extras', () => {
      const rule = extractRule(css, '.app');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      expect(props).toHaveLength(3);

      const propKeys = props.map((p) => p.key);
      expect(propKeys).toContain('height');
      expect(propKeys).toContain('display');
      expect(propKeys).toContain('flex-direction');
    });

    it('should not match a non-existent selector', () => {
      expect(extractRule(css, '.nonexistent-class')).toBeNull();
    });
  });

  describe('.app-body', () => {
    it('should define a flex layout with left padding and fill remaining space', () => {
      const rule = extractRule(css, '.app-body');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['display']).toBe('flex');
      expect(propMap['flex']).toBe('1');
      expect(propMap['min-height']).toBe('0');
      expect(propMap['padding-left']).toBe('180px');
      expect(propMap['gap']).toBe('0');
    });
  });

  describe('.half-line', () => {
    it('should define half-em height and line-height', () => {
      const rule = extractRule(css, '.half-line');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['height']).toBe('0.5em');
      expect(propMap['line-height']).toBe('0.5em');
    });
  });

  describe('.icon-button', () => {
    it('should define default styling with transparent background', () => {
      const rule = extractRule(css, '.icon-button');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['color']).toBe('darkred');
      expect(propMap['background-color']).toBe('transparent');
      expect(propMap['border']).toBe('none');
      expect(propMap['cursor']).toBe('pointer');
      expect(propMap['opacity']).toBe('0.8');
      expect(propMap['transition']).toContain('opacity');
    });

    it('should define hover state with brighter color and full opacity', () => {
      const rules = extractRules(css, '.icon-button:hover:not(:disabled)');
      expect(rules.length).toBeGreaterThan(0);

      const props = parseProperties(rules[0]);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['color']).toBe('red');
      expect(propMap['opacity']).toBe('1');
    });

    it('should define disabled state with reduced opacity and not-allowed cursor', () => {
      const rule = extractRule(css, '.icon-button:disabled');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['cursor']).toBe('not-allowed');
      expect(propMap['opacity']).toBe('0.3');
    });
  });

  describe('.char-btn-group and .char-btn', () => {
    it('should define a flex button group with gap and centered items', () => {
      const rule = extractRule(css, '.char-btn-group');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['display']).toBe('flex');
      expect(propMap['gap']).toBe('4px');
      expect(propMap['align-items']).toBe('center');
    });

    it('should define button styling with transparent background and border', () => {
      const rule = extractRule(css, '.char-btn');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['background-color']).toBe('transparent');
      expect(propMap['cursor']).toBe('pointer');
      expect(propMap['white-space']).toBe('nowrap');
      expect(propMap['border']).toContain('var(--border-color)');
    });

    it('should define hover state with full opacity and hover border color', () => {
      const rule = extractRule(css, '.char-btn:hover');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['opacity']).toBe('1');
      expect(propMap['border-color']).toBe('var(--color-hover)');
    });
  });

  describe('Download and hidden buttons', () => {
    it('should style button.download with dark green background', () => {
      const rule = extractRule(css, 'button.download');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['background-color']).toBe('darkgreen');
      expect(propMap['color']).toBe('#eee');
    });

    it('should hide button.hidden via display none', () => {
      const rule = extractRule(css, 'button.hidden');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['display']).toBe('none');
    });
  });

  describe('.theme-toggle-btn', () => {
    it('should push the theme toggle to the far right with auto margin', () => {
      const rule = extractRule(css, '.theme-toggle-btn');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['margin-left']).toBe('auto');
    });
  });

  describe('Campaign tool shared styles', () => {
    describe('.ct-container', () => {
      it('should define a flexible container with padding', () => {
        const rule = extractRule(css, '.ct-container');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['flex']).toBe('1');
        expect(propMap['padding']).toBe('20px');
        expect(propMap['width']).toBe('100%');
      });
    });

    describe('.ct-header', () => {
      it('should define a flex header with space-between and gap', () => {
        const rule = extractRule(css, '.ct-container .ct-header');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['display']).toBe('flex');
        expect(propMap['justify-content']).toBe('space-between');
        expect(propMap['align-items']).toBe('center');
        expect(propMap['gap']).toBe('16px');
        expect(propMap['margin-bottom']).toBe('16px');
      });
    });

    describe('.ct-title', () => {
      it('should define header-colored title with no margin', () => {
        const rule = extractRule(css, '.ct-container .ct-title');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['margin']).toBe('0');
        expect(propMap['color']).toBe('var(--color-header)');
        expect(propMap['font-size']).toBe('1.6em');
      });
    });

    describe('.ct-new-btn', () => {
      it('should define a primary action button style', () => {
        const rule = extractRule(css, '.ct-container .ct-new-btn');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['background']).toBe('var(--color-primary)');
        expect(propMap['color']).toBe('var(--color-text-inverse)');
        expect(propMap['border']).toBe('1px solid var(--color-primary)');
        expect(propMap['cursor']).toBe('pointer');
      });

      it('should define hover state with primary-hover colors', () => {
        const rule = extractRule(css, '.ct-container .ct-new-btn:hover');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['background']).toBe('var(--color-primary-hover)');
        expect(propMap['border-color']).toBe('var(--color-primary-hover)');
      });
    });

    describe('.ct-search-row', () => {
      it('should define a flex search bar with card styling', () => {
        const rule = extractRule(css, '.ct-container .ct-search-row');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['display']).toBe('flex');
        expect(propMap['gap']).toBe('8px');
        expect(propMap['margin-bottom']).toBe('16px');
        expect(propMap['background']).toBe('var(--background-color-card)');
        expect(propMap['border-radius']).toBe('6px');
      });
    });

    describe('.ct-search-input', () => {
      it('should define a flex-grow search input with focus state', () => {
        const rule = extractRule(css, '.ct-container .ct-search-input');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['flex']).toBe('1');
        expect(propMap['background']).toBe('var(--background-color-input)');
        expect(propMap['border']).toBe('1px solid var(--border-color)');
      });
    });

    describe('.ct-search-input:focus', () => {
    it('should change border color to primary on focus', () => {
      const rule = extractRule(css, '.ct-container .ct-search-input:focus');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['border-color']).toBe('var(--color-primary)');
    });
    });

    describe('.ct-search-clear', () => {
      it('should define a transparent clear button with error color on hover', () => {
        const rule = extractRule(css, '.ct-container .ct-search-clear');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['background']).toBe('none');
        expect(propMap['border']).toBe('none');
        expect(propMap['cursor']).toBe('pointer');
      });
    });

    describe('.ct-search-clear:hover', () => {
      it('should change to error color on hover', () => {
        const rule = extractRule(css, '.ct-container .ct-search-clear:hover');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['color']).toBe('var(--color-error)');
      });
    });

    describe('.ct-empty-state', () => {
      it('should define a centered empty state with flex column layout', () => {
        const rule = extractRule(css, '.ct-container .ct-empty-state');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['text-align']).toBe('center');
        expect(propMap['display']).toBe('flex');
        expect(propMap['flex-direction']).toBe('column');
        expect(propMap['align-items']).toBe('center');
        expect(propMap['font-style']).toBe('italic');
      });
    });

    describe('.ct-list', () => {
      it('should define a vertical list with gap', () => {
        const rule = extractRule(css, '.ct-container .ct-list');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['list-style']).toBe('none');
        expect(propMap['display']).toBe('flex');
        expect(propMap['flex-direction']).toBe('column');
        expect(propMap['gap']).toBe('8px');
      });
    });

    describe('.ct-list-item', () => {
      it('should define a clickable card with hover state', () => {
        const rule = extractRule(css, '.ct-container .ct-list-item');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['cursor']).toBe('pointer');
        expect(propMap['border-radius']).toBe('6px');
        expect(propMap['border']).toBe('1px solid var(--border-color)');
      });
    });

    describe('.ct-list-item:hover', () => {
      it('should highlight with primary border and hover background', () => {
        const rule = extractRule(css, '.ct-container .ct-list-item:hover');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['border-color']).toBe('var(--color-primary)');
        expect(propMap['background']).toBe('var(--background-color-card-hover)');
      });
    });

    describe('.ct-list-item-header', () => {
      it('should define a flex header row with space-between', () => {
        const rule = extractRule(css, '.ct-container .ct-list-item-header');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['display']).toBe('flex');
        expect(propMap['justify-content']).toBe('space-between');
        expect(propMap['align-items']).toBe('center');
      });
    });

    describe('.ct-list-name', () => {
      it('should define bold text with proper color', () => {
        const rule = extractRule(css, '.ct-container .ct-list-name');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['font-weight']).toBe('600');
        expect(propMap['color']).toBe('var(--color-text)');
        expect(propMap['font-size']).toBe('0.95rem');
      });
    });

    describe('.ct-list-preview', () => {
      it('should define muted secondary text', () => {
        const rule = extractRule(css, '.ct-container .ct-list-preview');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['color']).toBe('var(--color-text-secondary)');
        expect(propMap['font-size']).toBe('0.82rem');
      });
    });
  });

  describe('Modal styles', () => {
    describe('.ct-modal-overlay', () => {
      it('should cover the full viewport with semi-transparent background', () => {
        const rule = extractRule(css, '.ct-container .ct-modal-overlay');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['position']).toBe('fixed');
        expect(propMap['top']).toBe('0');
        expect(propMap['left']).toBe('0');
        expect(propMap['right']).toBe('0');
        expect(propMap['bottom']).toBe('0');
        expect(propMap['background']).toBe('rgba(0, 0, 0, 0.6)');
        expect(propMap['display']).toBe('flex');
        expect(propMap['z-index']).toBe('1000');
      });
    });

    describe('.ct-modal', () => {
      it('should define a centered modal with max-width constraints', () => {
        const rule = extractRule(css, '.ct-container .ct-modal');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['width']).toBe('520px');
        expect(propMap['max-width']).toBe('90vw');
        expect(propMap['max-height']).toBe('85vh');
        expect(propMap['display']).toBe('flex');
        expect(propMap['flex-direction']).toBe('column');
        expect(propMap['border-radius']).toBe('8px');
      });
    });

    describe('.ct-modal-header', () => {
      it('should define a flex header with bottom border', () => {
        const rule = extractRule(css, '.ct-container .ct-modal-header');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['display']).toBe('flex');
        expect(propMap['justify-content']).toBe('space-between');
        expect(propMap['border-bottom']).toBe('1px solid var(--border-color)');
      });
    });

    describe('.ct-modal-header h3', () => {
      it('should define modal title styling', () => {
        const rule = extractRule(css, '.ct-container .ct-modal-header h3');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['margin']).toBe('0');
        expect(propMap['font-size']).toBe('1.1rem');
        expect(propMap['font-weight']).toBe('600');
      });
    });

    describe('.ct-modal-close', () => {
      it('should define a transparent close button', () => {
        const rule = extractRule(css, '.ct-container .ct-modal-close');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['background']).toBe('none');
        expect(propMap['border']).toBe('none');
        expect(propMap['cursor']).toBe('pointer');
        expect(propMap['font-size']).toBe('1.5rem');
      });
    });

    describe('.ct-modal-body', () => {
      it('should define a scrollable body with flex column layout', () => {
        const rule = extractRule(css, '.ct-container .ct-modal-body');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['overflow-y']).toBe('auto');
        expect(propMap['display']).toBe('flex');
        expect(propMap['flex-direction']).toBe('column');
        expect(propMap['padding']).toBe('20px');
      });
    });

    describe('.ct-modal-footer', () => {
      it('should define a flex footer with top border', () => {
        const rule = extractRule(css, '.ct-container .ct-modal-footer');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['display']).toBe('flex');
        expect(propMap['justify-content']).toBe('space-between');
        expect(propMap['border-top']).toBe('1px solid var(--border-color)');
      });
    });

    describe('.ct-modal-actions and .ct-modal-buttons', () => {
      it('should define flex action button groups with gap', () => {
        const actionsRule = extractRule(css, '.ct-container .ct-modal-actions');
        const buttonsRule = extractRule(css, '.ct-container .ct-modal-buttons');

        expect(actionsRule).not.toBeNull();
        expect(buttonsRule).not.toBeNull();

        const actionsProps = parseProperties(actionsRule);
        const actionsMap = Object.fromEntries(actionsProps.map((p) => [p.key, p.value]));
        expect(actionsMap['display']).toBe('flex');
        expect(actionsMap['gap']).toBe('8px');

        const buttonsProps = parseProperties(buttonsRule);
        const buttonsMap = Object.fromEntries(buttonsProps.map((p) => [p.key, p.value]));
        expect(buttonsMap['display']).toBe('flex');
        expect(buttonsMap['gap']).toBe('8px');
      });
    });
  });

  describe('Form field styles', () => {
    describe('.ct-label', () => {
      it('should define a block label with secondary text color', () => {
        const rule = extractRule(css, '.ct-container .ct-label');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['display']).toBe('block');
        expect(propMap['font-weight']).toBe('600');
        expect(propMap['color']).toBe('var(--color-text-secondary)');
      });
    });

    describe('.ct-required', () => {
      it('should define error color for required field indicators', () => {
        const rule = extractRule(css, '.ct-container .ct-required');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['color']).toBe('var(--color-error)');
      });
    });

    describe('.ct-input', () => {
      it('should define a full-width input with proper border and focus state', () => {
        const rule = extractRule(css, '.ct-container .ct-input');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['width']).toBe('100%');
        expect(propMap['border']).toBe('1px solid var(--border-color)');
        expect(propMap['background']).toBe('var(--background-color-input)');
        expect(propMap['box-sizing']).toBe('border-box');
      });
    });

    describe('.ct-input:focus', () => {
      it('should show primary border and box-shadow on focus', () => {
        const rule = extractRule(css, '.ct-container .ct-input:focus');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['border-color']).toBe('var(--color-primary)');
        expect(propMap['outline']).toBe('none');
        expect(propMap['box-shadow']).toContain('var(--color-primary-rgb');
      });
    });

    describe('.ct-textarea', () => {
      it('should define a resizable textarea with min-height', () => {
        const rule = extractRule(css, '.ct-container .ct-textarea');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['width']).toBe('100%');
        expect(propMap['min-height']).toBe('80px');
        expect(propMap['resize']).toBe('vertical');
        expect(propMap['font-family']).toBe('inherit');
        expect(propMap['line-height']).toBe('1.5');
      });
    });

    describe('.ct-select', () => {
      it('should define a full-width select with pointer cursor', () => {
        const rule = extractRule(css, '.ct-container .ct-select');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['width']).toBe('100%');
        expect(propMap['cursor']).toBe('pointer');
        expect(propMap['border']).toBe('1px solid var(--border-color)');
      });
    });
  });

  describe('Button styles', () => {
    describe('.ct-btn', () => {
      it('should define a secondary button with hover state', () => {
        const rule = extractRule(css, '.ct-container .ct-btn');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['display']).toBe('inline-flex');
        expect(propMap['align-items']).toBe('center');
        expect(propMap['cursor']).toBe('pointer');
        expect(propMap['border']).toBe('1px solid var(--border-color)');
        expect(propMap['background']).toBe('var(--background-color-button-secondary)');
      });
    });

    describe('.ct-btn:disabled', () => {
      it('should show reduced opacity and not-allowed cursor for disabled buttons', () => {
        const rule = extractRule(css, '.ct-container .ct-btn:disabled');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['opacity']).toBe('0.5');
        expect(propMap['cursor']).toBe('not-allowed');
      });
    });

    describe('.ct-btn-primary', () => {
      it('should define a primary button with inverse text color', () => {
        const rule = extractRule(css, '.ct-container .ct-btn-primary');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['background']).toBe('var(--color-primary)');
        expect(propMap['color']).toBe('var(--color-text-inverse)');
        expect(propMap['border-color']).toBe('var(--color-primary)');
      });

      it('should define hover state with primary-hover colors', () => {
        const rule = extractRule(css, '.ct-container .ct-btn-primary:hover:not(:disabled)');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['background']).toBe('var(--color-primary-hover)');
        expect(propMap['border-color']).toBe('var(--color-primary-hover)');
      });
    });

    describe('.ct-btn-danger', () => {
      it('should define a danger button with error color', () => {
        const rule = extractRule(css, '.ct-container .ct-btn-danger');
        expect(rule).not.toBeNull();

        const props = parseProperties(rule);
        const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

        expect(propMap['color']).toBe('var(--color-error)');
        expect(propMap['border-color']).toBe('var(--color-error)');
      });
    });
  });

  describe('Rename and delete campaign buttons', () => {
    it('should define rename button with body color and hover to header color', () => {
      const rule = extractRule(css, '.rename-campaign-btn');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));
      expect(propMap['color']).toBe('var(--color-body)');
    });

    it('should define delete button with darkred color', () => {
      const rule = extractRule(css, '.delete-campaign-btn');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));
      expect(propMap['color']).toBe('darkred');
    });

    it('should define hover states for rename and delete buttons', () => {
      const renameHover = extractRule(css, '.rename-campaign-btn:hover:not(:disabled)');
      const deleteHover = extractRule(css, '.delete-campaign-btn:hover:not(:disabled)');

      expect(renameHover).not.toBeNull();
      expect(deleteHover).not.toBeNull();

      const renameProps = parseProperties(renameHover);
      const renameMap = Object.fromEntries(renameProps.map((p) => [p.key, p.value]));
      expect(renameMap['color']).toBe('var(--color-header)');

      const deleteProps = parseProperties(deleteHover);
      const deleteMap = Object.fromEntries(deleteProps.map((p) => [p.key, p.value]));
      expect(deleteMap['color']).toBe('red');
    });
  });

  describe('Back to campaigns button', () => {
    it('should define back button with body color and hover to header color', () => {
      const rule = extractRule(css, '.back-to-campaigns-btn');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));
      expect(propMap['color']).toBe('var(--color-body)');
    });

    it('should hover to header color', () => {
      const hoverRule = extractRule(css, '.back-to-campaigns-btn:hover:not(:disabled)');
      expect(hoverRule).not.toBeNull();

      const props = parseProperties(hoverRule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));
      expect(propMap['color']).toBe('var(--color-header)');
    });
  });

  describe('CT back button', () => {
    it('should define a styled back button with hover state', () => {
      const rule = extractRule(css, '.ct-container .ct-back-btn');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['display']).toBe('inline-flex');
      expect(propMap['align-items']).toBe('center');
      expect(propMap['cursor']).toBe('pointer');
      expect(propMap['border']).toBe('1px solid var(--border-color)');
      expect(propMap['background']).toBe('var(--background-color-button-secondary)');
    });

    it('should define hover state with secondary-hover background', () => {
      const rule = extractRule(css, '.ct-container .ct-back-btn:hover');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['background']).toBe('var(--background-color-button-secondary-hover)');
    });
  });

  describe('CT generate button', () => {
    it('should define a generate button with secondary styling', () => {
      const rule = extractRule(css, '.ct-container .ct-generate-btn');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['display']).toBe('inline-flex');
      expect(propMap['background']).toBe('var(--background-color-surface)');
      expect(propMap['color']).toBe('var(--color-text)');
      expect(propMap['cursor']).toBe('pointer');
    });
  });

  describe('CT list meta', () => {
    it('should define a flex meta row with shrinking disabled', () => {
      const rule = extractRule(css, '.ct-container .ct-list-meta');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['display']).toBe('flex');
      expect(propMap['align-items']).toBe('center');
      expect(propMap['flex-shrink']).toBe('0');
    });
  });

  describe('CT list details', () => {
    it('should define a wrapping flex details row', () => {
      const rule = extractRule(css, '.ct-container .ct-list-details');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['display']).toBe('flex');
      expect(propMap['align-items']).toBe('center');
      expect(propMap['flex-wrap']).toBe('wrap');
    });
  });

  describe('CT modal close hover', () => {
    it('should change to text color on hover', () => {
      const rule = extractRule(css, '.ct-container .ct-modal-close:hover');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['color']).toBe('var(--color-text)');
    });
  });

  describe('CT empty state icon', () => {
    it('should define a muted icon with 2rem size', () => {
      const rule = extractRule(css, '.ct-container .ct-empty-state i');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['font-size']).toBe('2rem');
      expect(propMap['opacity']).toBe('0.4');
    });
  });

  describe('CT search icon', () => {
    it('should define a muted search icon', () => {
      const rule = extractRule(css, '.ct-container .ct-search-icon');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['color']).toBe('var(--color-text-muted)');
      expect(propMap['font-size']).toBe('0.9rem');
    });
  });

  describe('Responsive media queries', () => {
    let mediaQueries;

    beforeAll(() => {
      mediaQueries = extractMediaQueries(css);
    });

    it('should have at least one media query', () => {
      expect(mediaQueries.length).toBeGreaterThan(0);
    });

    it('should have a max-width: 600px breakpoint', () => {
      const breakpoint = mediaQueries.find((mq) => mq.media.includes('max-width: 600px'));
      expect(breakpoint).toBeDefined();
    });

    it('should reduce container padding on small screens', () => {
      const breakpoint = mediaQueries.find((mq) => mq.media.includes('max-width: 600px'));
      expect(breakpoint).toBeDefined();
      expect(breakpoint.body).toContain('padding: 12px');
    });

    it('should flex-wrap the header on small screens', () => {
      const breakpoint = mediaQueries.find((mq) => mq.media.includes('max-width: 600px'));
      expect(breakpoint).toBeDefined();
      expect(breakpoint.body).toContain('flex-wrap: wrap');
    });

    it('should make modal wider and taller on small screens', () => {
      const breakpoint = mediaQueries.find((mq) => mq.media.includes('max-width: 600px'));
      expect(breakpoint).toBeDefined();
      expect(breakpoint.body).toContain('width: 95vw');
      expect(breakpoint.body).toContain('max-height: 90vh');
    });

    it('should stack modal footer buttons vertically on small screens', () => {
      const breakpoint = mediaQueries.find((mq) => mq.media.includes('max-width: 600px'));
      expect(breakpoint).toBeDefined();
      expect(breakpoint.body).toContain('flex-direction: column');
    });

    it('should make modal action buttons full-width on small screens', () => {
      const breakpoint = mediaQueries.find((mq) => mq.media.includes('max-width: 600px'));
      expect(breakpoint).toBeDefined();
      expect(breakpoint.body).toContain('width: 100%');
    });

    it('should justify modal buttons to the end on small screens', () => {
      const breakpoint = mediaQueries.find((mq) => mq.media.includes('max-width: 600px'));
      expect(breakpoint).toBeDefined();
      expect(breakpoint.body).toContain('justify-content: flex-end');
    });
  });

  describe('CSS variable usage', () => {
    it('should use --color-header in multiple rules', () => {
      const headerRefs = css.match(/var\(--color-header\)/g);
      expect(headerRefs).not.toBeNull();
      expect(headerRefs.length).toBeGreaterThan(1);
    });

    it('should use --color-text in multiple rules', () => {
      const textRefs = css.match(/var\(--color-text\)/g);
      expect(textRefs).not.toBeNull();
      expect(textRefs.length).toBeGreaterThan(1);
    });

    it('should use --border-color in multiple rules', () => {
      const borderRefs = css.match(/var\(--border-color\)/g);
      expect(borderRefs).not.toBeNull();
      expect(borderRefs.length).toBeGreaterThan(1);
    });

    it('should use --color-primary in multiple rules', () => {
      const primaryRefs = css.match(/var\(--color-primary\)/g);
      expect(primaryRefs).not.toBeNull();
      expect(primaryRefs.length).toBeGreaterThan(1);
    });

    it('should use --background-color-card in multiple rules', () => {
      const cardRefs = css.match(/var\(--background-color-card\)/g);
      expect(cardRefs).not.toBeNull();
      expect(cardRefs.length).toBeGreaterThan(1);
    });

    it('should use --color-error in multiple rules', () => {
      const errorRefs = css.match(/var\(--color-error\)/g);
      expect(errorRefs).not.toBeNull();
      expect(errorRefs.length).toBeGreaterThan(1);
    });

    it('should use --color-primary-hover in multiple rules', () => {
      const hoverRefs = css.match(/var\(--color-primary-hover\)/g);
      expect(hoverRefs).not.toBeNull();
      expect(hoverRefs.length).toBeGreaterThan(0);
    });
  });

  describe('Transition properties', () => {
    it('should define transitions on interactive elements', () => {
      const transitionRefs = css.match(/transition:/g);
      expect(transitionRefs).not.toBeNull();
      expect(transitionRefs.length).toBeGreaterThan(3);
    });

    it('should use transition for hover effects on icon-button', () => {
      const rule = extractRule(css, '.icon-button');
      expect(rule).not.toBeNull();

      expect(rule).toContain('transition');
      expect(rule).toContain('opacity');
    });

    it('should use transition for hover effects on ct-btn', () => {
      const rule = extractRule(css, '.ct-container .ct-btn');
      expect(rule).not.toBeNull();

      expect(rule).toContain('transition');
      expect(rule).toContain('background');
    });
  });

  describe('CT list item header meta', () => {
    it('should define proper gap and margin', () => {
      const rule = extractRule(css, '.ct-container .ct-list-item-header');
      expect(rule).not.toBeNull();

      const props = parseProperties(rule);
      const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));

      expect(propMap['gap']).toBe('12px');
      expect(propMap['margin-bottom']).toBe('6px');
    });
  });
});
