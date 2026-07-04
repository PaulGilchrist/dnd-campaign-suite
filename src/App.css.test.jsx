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

function assertProps(rule, assertions) {
  const props = parseProperties(rule);
  const propMap = Object.fromEntries(props.map((p) => [p.key, p.value]));
  for (const [key, expected] of Object.entries(assertions)) {
    if (typeof expected === 'string') {
      expect(propMap[key]).toBe(expected);
    } else {
      expect(expected(propMap[key])).toBeTruthy();
    }
  }
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
      assertProps(rule, {
        display: 'flex',
        'flex-direction': 'column',
        height: '100vh',
      });
    });
  });

  describe('.app-body', () => {
    it('should define a flex layout with left padding and fill remaining space', () => {
      const rule = extractRule(css, '.app-body');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        display: 'flex',
        flex: '1',
        'min-height': '0',
        'padding-left': '180px',
        gap: '0',
      });
    });
  });

  describe('.half-line', () => {
    it('should define half-em height and line-height', () => {
      const rule = extractRule(css, '.half-line');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        height: '0.5em',
        'line-height': '0.5em',
      });
    });
  });

  describe('.icon-button', () => {
    it('should define default, hover, and disabled states', () => {
      const rule = extractRule(css, '.icon-button');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        color: 'darkred',
        'background-color': 'transparent',
        border: 'none',
        cursor: 'pointer',
        opacity: '0.8',
      });
      expect(rule).toContain('transition');
      expect(rule).toContain('opacity');

      const hoverRules = extractRules(css, '.icon-button:hover:not(:disabled)');
      expect(hoverRules.length).toBeGreaterThan(0);
      assertProps(hoverRules[0], { color: 'red', opacity: '1' });

      const disabledRule = extractRule(css, '.icon-button:disabled');
      expect(disabledRule).not.toBeNull();
      assertProps(disabledRule, { cursor: 'not-allowed', opacity: '0.3' });
    });
  });

  describe('.char-btn-group and .char-btn', () => {
    it('should define a flex button group and button styling with hover', () => {
      const groupRule = extractRule(css, '.char-btn-group');
      expect(groupRule).not.toBeNull();
      assertProps(groupRule, {
        display: 'flex',
        gap: '4px',
        'align-items': 'center',
      });

      const btnRule = extractRule(css, '.char-btn');
      expect(btnRule).not.toBeNull();
      assertProps(btnRule, {
        'background-color': 'transparent',
        cursor: 'pointer',
        'white-space': 'nowrap',
      });
      expect(btnRule).toContain('var(--border-color)');

      const hoverRule = extractRule(css, '.char-btn:hover');
      expect(hoverRule).not.toBeNull();
      assertProps(hoverRule, { opacity: '1', 'border-color': 'var(--color-hover)' });
    });
  });

  describe('Download and hidden buttons', () => {
    it('should style button.download and hide button.hidden', () => {
      const downloadRule = extractRule(css, 'button.download');
      expect(downloadRule).not.toBeNull();
      assertProps(downloadRule, {
        'background-color': 'darkgreen',
        color: '#eee',
      });

      const hiddenRule = extractRule(css, 'button.hidden');
      expect(hiddenRule).not.toBeNull();
      assertProps(hiddenRule, { display: 'none' });
    });
  });

  describe('.theme-toggle-btn', () => {
    it('should push the theme toggle to the far right with auto margin', () => {
      const rule = extractRule(css, '.theme-toggle-btn');
      expect(rule).not.toBeNull();
      assertProps(rule, { 'margin-left': 'auto' });
    });
  });

  describe('.rename-campaign-btn and .delete-campaign-btn', () => {
    it('should define colors and hover states for rename and delete buttons', () => {
      const renameRule = extractRule(css, '.rename-campaign-btn');
      expect(renameRule).not.toBeNull();
      assertProps(renameRule, { color: 'var(--color-body)' });

      const renameHover = extractRule(css, '.rename-campaign-btn:hover:not(:disabled)');
      expect(renameHover).not.toBeNull();
      assertProps(renameHover, { color: 'var(--color-header)' });

      const deleteRule = extractRule(css, '.delete-campaign-btn');
      expect(deleteRule).not.toBeNull();
      assertProps(deleteRule, { color: 'darkred' });

      const deleteHover = extractRule(css, '.delete-campaign-btn:hover:not(:disabled)');
      expect(deleteHover).not.toBeNull();
      assertProps(deleteHover, { color: 'red' });
    });
  });

  describe('.back-to-campaigns-btn', () => {
    it('should define body color and hover to header color', () => {
      const rule = extractRule(css, '.back-to-campaigns-btn');
      expect(rule).not.toBeNull();
      assertProps(rule, { color: 'var(--color-body)' });

      const hoverRule = extractRule(css, '.back-to-campaigns-btn:hover:not(:disabled)');
      expect(hoverRule).not.toBeNull();
      assertProps(hoverRule, { color: 'var(--color-header)' });
    });
  });

  describe('Campaign tool shared styles', () => {
    describe('.ct-container', () => {
      it('should define a flexible container with padding', () => {
        const rule = extractRule(css, '.ct-container');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          flex: '1',
          padding: '20px',
          width: '100%',
        });
      });
    });

    describe('.ct-header', () => {
      it('should define a flex header with space-between and gap', () => {
        const rule = extractRule(css, '.ct-container .ct-header');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          display: 'flex',
          'justify-content': 'space-between',
          'align-items': 'center',
          gap: '16px',
          'margin-bottom': '16px',
        });
      });
    });

    describe('.ct-title', () => {
      it('should define header-colored title with no margin', () => {
        const rule = extractRule(css, '.ct-container .ct-title');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          margin: '0',
          color: 'var(--color-header)',
          'font-size': '1.6em',
        });
      });
    });

    describe('.ct-new-btn', () => {
      it('should define a primary action button style with hover', () => {
        const rule = extractRule(css, '.ct-container .ct-new-btn');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          background: 'var(--color-primary)',
          color: 'var(--color-text-inverse)',
          cursor: 'pointer',
        });
        expect(rule).toContain('var(--color-primary)');

        const hoverRule = extractRule(css, '.ct-container .ct-new-btn:hover');
        expect(hoverRule).not.toBeNull();
        assertProps(hoverRule, {
          background: 'var(--color-primary-hover)',
          'border-color': 'var(--color-primary-hover)',
        });
      });
    });

    describe('.ct-search-row', () => {
      it('should define a flex search bar with card styling', () => {
        const rule = extractRule(css, '.ct-container .ct-search-row');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          display: 'flex',
          gap: '8px',
          'margin-bottom': '16px',
          background: 'var(--background-color-card)',
          'border-radius': '6px',
        });
      });
    });

    describe('.ct-search-input', () => {
      it('should define a flex-grow search input with focus state', () => {
        const rule = extractRule(css, '.ct-container .ct-search-input');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          flex: '1',
          background: 'var(--background-color-input)',
        });
        expect(rule).toContain('var(--border-color)');

        const focusRule = extractRule(css, '.ct-container .ct-search-input:focus');
        expect(focusRule).not.toBeNull();
        assertProps(focusRule, { 'border-color': 'var(--color-primary)' });
      });
    });

    describe('.ct-search-clear', () => {
      it('should define a transparent clear button with error color on hover', () => {
        const rule = extractRule(css, '.ct-container .ct-search-clear');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        });

        const hoverRule = extractRule(css, '.ct-container .ct-search-clear:hover');
        expect(hoverRule).not.toBeNull();
        assertProps(hoverRule, { color: 'var(--color-error)' });
      });
    });

    describe('.ct-empty-state', () => {
      it('should define a centered empty state with flex column layout', () => {
        const rule = extractRule(css, '.ct-container .ct-empty-state');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          'text-align': 'center',
          display: 'flex',
          'flex-direction': 'column',
          'align-items': 'center',
          'font-style': 'italic',
        });
      });
    });

    describe('.ct-list', () => {
      it('should define a vertical list with gap', () => {
        const rule = extractRule(css, '.ct-container .ct-list');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          'list-style': 'none',
          display: 'flex',
          'flex-direction': 'column',
          gap: '8px',
        });
      });
    });

    describe('.ct-list-item', () => {
      it('should define a clickable card with hover state', () => {
        const rule = extractRule(css, '.ct-container .ct-list-item');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          cursor: 'pointer',
          'border-radius': '6px',
        });
        expect(rule).toContain('var(--border-color)');

        const hoverRule = extractRule(css, '.ct-container .ct-list-item:hover');
        expect(hoverRule).not.toBeNull();
        assertProps(hoverRule, {
          'border-color': 'var(--color-primary)',
          background: 'var(--background-color-card-hover)',
        });
      });
    });

    describe('.ct-list-item-header', () => {
      it('should define a flex header row with space-between, gap, and margin', () => {
        const rule = extractRule(css, '.ct-container .ct-list-item-header');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          display: 'flex',
          'justify-content': 'space-between',
          'align-items': 'center',
          gap: '12px',
          'margin-bottom': '6px',
        });
      });
    });

    describe('.ct-list-name and .ct-list-preview', () => {
      it('should define bold name text and muted preview text', () => {
        const nameRule = extractRule(css, '.ct-container .ct-list-name');
        expect(nameRule).not.toBeNull();
        assertProps(nameRule, {
          'font-weight': '600',
          'font-size': '0.95rem',
        });
        expect(nameRule).toContain('var(--color-text)');

        const previewRule = extractRule(css, '.ct-container .ct-list-preview');
        expect(previewRule).not.toBeNull();
        assertProps(previewRule, {
          'font-size': '0.82rem',
        });
        expect(previewRule).toContain('var(--color-text-secondary)');
      });
    });

    describe('.ct-list-meta and .ct-list-details', () => {
      it('should define a flex meta row and wrapping details row', () => {
        const metaRule = extractRule(css, '.ct-container .ct-list-meta');
        expect(metaRule).not.toBeNull();
        assertProps(metaRule, {
          display: 'flex',
          'align-items': 'center',
          'flex-shrink': '0',
        });

        const detailsRule = extractRule(css, '.ct-container .ct-list-details');
        expect(detailsRule).not.toBeNull();
        assertProps(detailsRule, {
          display: 'flex',
          'align-items': 'center',
          'flex-wrap': 'wrap',
        });
      });
    });
  });

  describe('Modal styles', () => {
    describe('.ct-modal-overlay', () => {
      it('should cover the full viewport with semi-transparent background', () => {
        const rule = extractRule(css, '.ct-container .ct-modal-overlay');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          background: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          'z-index': '1000',
        });
      });
    });

    describe('.ct-modal', () => {
      it('should define a centered modal with max-width constraints', () => {
        const rule = extractRule(css, '.ct-container .ct-modal');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          width: '520px',
          'max-width': '90vw',
          'max-height': '85vh',
          display: 'flex',
          'flex-direction': 'column',
          'border-radius': '8px',
        });
      });
    });

    describe('.ct-modal-header', () => {
      it('should define a flex header with bottom border', () => {
        const rule = extractRule(css, '.ct-container .ct-modal-header');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          display: 'flex',
          'justify-content': 'space-between',
          'border-bottom': '1px solid var(--border-color)',
        });
      });
    });

    describe('.ct-modal-header h3', () => {
      it('should define modal title styling', () => {
        const rule = extractRule(css, '.ct-container .ct-modal-header h3');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          margin: '0',
          'font-size': '1.1rem',
          'font-weight': '600',
        });
      });
    });

    describe('.ct-modal-close', () => {
      it('should define a transparent close button with hover state', () => {
        const rule = extractRule(css, '.ct-container .ct-modal-close');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          'font-size': '1.5rem',
        });

        const hoverRule = extractRule(css, '.ct-container .ct-modal-close:hover');
        expect(hoverRule).not.toBeNull();
        assertProps(hoverRule, { color: 'var(--color-text)' });
      });
    });

    describe('.ct-modal-body', () => {
      it('should define a scrollable body with flex column layout', () => {
        const rule = extractRule(css, '.ct-container .ct-modal-body');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          'overflow-y': 'auto',
          display: 'flex',
          'flex-direction': 'column',
          padding: '20px',
        });
      });
    });

    describe('.ct-modal-footer', () => {
      it('should define a flex footer with top border', () => {
        const rule = extractRule(css, '.ct-container .ct-modal-footer');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          display: 'flex',
          'justify-content': 'space-between',
          'border-top': '1px solid var(--border-color)',
        });
      });
    });

    describe('.ct-modal-actions and .ct-modal-buttons', () => {
      it('should define flex action button groups with gap', () => {
        const actionsRule = extractRule(css, '.ct-container .ct-modal-actions');
        const buttonsRule = extractRule(css, '.ct-container .ct-modal-buttons');

        expect(actionsRule).not.toBeNull();
        expect(buttonsRule).not.toBeNull();

        assertProps(actionsRule, { display: 'flex', gap: '8px' });
        assertProps(buttonsRule, { display: 'flex', gap: '8px' });
      });
    });
  });

  describe('Form field styles', () => {
    describe('.ct-label and .ct-required', () => {
      it('should define a block label with secondary text color', () => {
        const rule = extractRule(css, '.ct-container .ct-label');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          display: 'block',
          'font-weight': '600',
        });
        expect(rule).toContain('var(--color-text-secondary)');

        const requiredRule = extractRule(css, '.ct-container .ct-required');
        expect(requiredRule).not.toBeNull();
        assertProps(requiredRule, { color: 'var(--color-error)' });
      });
    });

    describe('.ct-input', () => {
      it('should define a full-width input with proper border and focus state', () => {
        const rule = extractRule(css, '.ct-container .ct-input');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          width: '100%',
          'box-sizing': 'border-box',
        });
        expect(rule).toContain('var(--border-color)');
        expect(rule).toContain('var(--background-color-input)');

        const focusRule = extractRule(css, '.ct-container .ct-input:focus');
        expect(focusRule).not.toBeNull();
        assertProps(focusRule, {
          'border-color': 'var(--color-primary)',
          outline: 'none',
        });
        expect(focusRule).toContain('var(--color-primary-rgb');
      });
    });

    describe('.ct-textarea', () => {
      it('should define a resizable textarea with min-height', () => {
        const rule = extractRule(css, '.ct-container .ct-textarea');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          width: '100%',
          'min-height': '80px',
          resize: 'vertical',
          'font-family': 'inherit',
          'line-height': '1.5',
        });
      });
    });

    describe('.ct-select', () => {
      it('should define a full-width select with pointer cursor', () => {
        const rule = extractRule(css, '.ct-container .ct-select');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          width: '100%',
          cursor: 'pointer',
        });
        expect(rule).toContain('var(--border-color)');
      });
    });
  });

  describe('Button styles', () => {
    describe('.ct-btn', () => {
      it('should define a secondary button with disabled state', () => {
        const rule = extractRule(css, '.ct-container .ct-btn');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          display: 'inline-flex',
          'align-items': 'center',
          cursor: 'pointer',
        });
        expect(rule).toContain('var(--border-color)');
        expect(rule).toContain('var(--background-color-button-secondary)');

        const disabledRule = extractRule(css, '.ct-container .ct-btn:disabled');
        expect(disabledRule).not.toBeNull();
        assertProps(disabledRule, {
          opacity: '0.5',
          cursor: 'not-allowed',
        });
      });
    });

    describe('.ct-btn-primary', () => {
      it('should define a primary button with hover state', () => {
        const rule = extractRule(css, '.ct-container .ct-btn-primary');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          background: 'var(--color-primary)',
          color: 'var(--color-text-inverse)',
        });
        expect(rule).toContain('var(--color-primary)');

        const hoverRule = extractRule(css, '.ct-container .ct-btn-primary:hover:not(:disabled)');
        expect(hoverRule).not.toBeNull();
        assertProps(hoverRule, {
          background: 'var(--color-primary-hover)',
          'border-color': 'var(--color-primary-hover)',
        });
      });
    });

    describe('.ct-btn-danger', () => {
      it('should define a danger button with error color', () => {
        const rule = extractRule(css, '.ct-container .ct-btn-danger');
        expect(rule).not.toBeNull();
        assertProps(rule, {
          color: 'var(--color-error)',
          'border-color': 'var(--color-error)',
        });
      });
    });
  });

  describe('CT back button', () => {
    it('should define a styled back button with hover state', () => {
      const rule = extractRule(css, '.ct-container .ct-back-btn');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        display: 'inline-flex',
        'align-items': 'center',
        cursor: 'pointer',
      });
      expect(rule).toContain('var(--border-color)');
      expect(rule).toContain('var(--background-color-button-secondary)');

      const hoverRule = extractRule(css, '.ct-container .ct-back-btn:hover');
      expect(hoverRule).not.toBeNull();
      assertProps(hoverRule, {
        background: 'var(--background-color-button-secondary-hover)',
      });
    });
  });

  describe('CT generate button', () => {
    it('should define a generate button with secondary styling', () => {
      const rule = extractRule(css, '.ct-container .ct-generate-btn');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        display: 'inline-flex',
        background: 'var(--background-color-surface)',
        color: 'var(--color-text)',
        cursor: 'pointer',
      });
    });
  });

  describe('CT empty state icon', () => {
    it('should define a muted icon with 2rem size', () => {
      const rule = extractRule(css, '.ct-container .ct-empty-state i');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        'font-size': '2rem',
        opacity: '0.4',
      });
    });
  });

  describe('CT search icon', () => {
    it('should define a muted search icon', () => {
      const rule = extractRule(css, '.ct-container .ct-search-icon');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        color: 'var(--color-text-muted)',
        'font-size': '0.9rem',
      });
    });
  });

  describe('Responsive media queries', () => {
    let mediaQueries;

    beforeAll(() => {
      mediaQueries = extractMediaQueries(css);
    });

    it('should have a max-width: 600px breakpoint with responsive adjustments', () => {
      const breakpoint = mediaQueries.find((mq) => mq.media.includes('max-width: 600px'));
      expect(breakpoint).toBeDefined();

      expect(breakpoint.body).toContain('padding: 12px');
      expect(breakpoint.body).toContain('flex-wrap: wrap');
      expect(breakpoint.body).toContain('width: 95vw');
      expect(breakpoint.body).toContain('max-height: 90vh');
      expect(breakpoint.body).toContain('flex-direction: column');
      expect(breakpoint.body).toContain('width: 100%');
      expect(breakpoint.body).toContain('justify-content: flex-end');
    });
  });

  describe('CSS variable usage', () => {
    it('should use --color-header in multiple rules', () => {
      const refs = css.match(/var\(--color-header\)/g);
      expect(refs).not.toBeNull();
      expect(refs.length).toBeGreaterThan(1);
    });

    it('should use --color-text in multiple rules', () => {
      const refs = css.match(/var\(--color-text\)/g);
      expect(refs).not.toBeNull();
      expect(refs.length).toBeGreaterThan(1);
    });

    it('should use --border-color in multiple rules', () => {
      const refs = css.match(/var\(--border-color\)/g);
      expect(refs).not.toBeNull();
      expect(refs.length).toBeGreaterThan(1);
    });

    it('should use --color-primary in multiple rules', () => {
      const refs = css.match(/var\(--color-primary\)/g);
      expect(refs).not.toBeNull();
      expect(refs.length).toBeGreaterThan(1);
    });

    it('should use --background-color-card in multiple rules', () => {
      const refs = css.match(/var\(--background-color-card\)/g);
      expect(refs).not.toBeNull();
      expect(refs.length).toBeGreaterThan(1);
    });

    it('should use --color-error in multiple rules', () => {
      const refs = css.match(/var\(--color-error\)/g);
      expect(refs).not.toBeNull();
      expect(refs.length).toBeGreaterThan(1);
    });

    it('should use --color-primary-hover in rules', () => {
      const refs = css.match(/var\(--color-primary-hover\)/g);
      expect(refs).not.toBeNull();
      expect(refs.length).toBeGreaterThan(0);
    });
  });

  describe('Transition properties', () => {
    it('should define transitions on interactive elements', () => {
      const refs = css.match(/transition:/g);
      expect(refs).not.toBeNull();
      expect(refs.length).toBeGreaterThan(3);
    });
  });
});
