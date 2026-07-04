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

function hasProp(rule, key) {
  const props = parseProperties(rule);
  return props.some((p) => p.key === key);
}

function getProp(rule, key) {
  const props = parseProperties(rule);
  return props.find((p) => p.key === key)?.value;
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

  describe('Layout structure', () => {
    it('should define .app as a full-viewport flex column', () => {
      const rule = extractRule(css, '.app');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        display: 'flex',
        'flex-direction': 'column',
        height: '100vh',
      });
    });

    it('should define .app-body as a flex container with sidebar offset', () => {
      const rule = extractRule(css, '.app-body');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        display: 'flex',
        flex: '1',
        'min-height': '0',
      });
      expect(getProp(rule, 'padding-left')).toBeTruthy();
    });
  });

  describe('Icon button states', () => {
    it('should define default, hover, and disabled states with distinct visual feedback', () => {
      const rule = extractRule(css, '.icon-button');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        cursor: 'pointer',
        opacity: '0.8',
      });

      const hoverRules = extractRules(css, '.icon-button:hover:not(:disabled)');
      expect(hoverRules.length).toBeGreaterThan(0);
      const hoverProps = parseProperties(hoverRules[0]);
      const hoverOpacity = hoverProps.find((p) => p.key === 'opacity')?.value;
      expect(parseFloat(hoverOpacity)).toBeGreaterThan(0.8);
    });

    it('should disable icon buttons with a not-allowed cursor', () => {
      const disabledRule = extractRule(css, '.icon-button:disabled');
      expect(disabledRule).not.toBeNull();
      assertProps(disabledRule, { cursor: 'not-allowed' });
    });
  });

  describe('Campaign action buttons', () => {
    it('should define rename and delete buttons with hover states', () => {
      const renameRule = extractRule(css, '.rename-campaign-btn');
      expect(renameRule).not.toBeNull();

      const renameHover = extractRule(css, '.rename-campaign-btn:hover:not(:disabled)');
      expect(renameHover).not.toBeNull();

      const deleteRule = extractRule(css, '.delete-campaign-btn');
      expect(deleteRule).not.toBeNull();

      const deleteHover = extractRule(css, '.delete-campaign-btn:hover:not(:disabled)');
      expect(deleteHover).not.toBeNull();
    });

    it('should define a back-to-campaigns button with hover state', () => {
      const rule = extractRule(css, '.back-to-campaigns-btn');
      expect(rule).not.toBeNull();

      const hoverRule = extractRule(css, '.back-to-campaigns-btn:hover:not(:disabled)');
      expect(hoverRule).not.toBeNull();
    });

    it('should push the theme toggle to the far right', () => {
      const rule = extractRule(css, '.theme-toggle-btn');
      expect(rule).not.toBeNull();
      expect(getProp(rule, 'margin-left')).toBe('auto');
    });
  });

  describe('Character button group', () => {
    it('should define a flex button group with styled buttons and hover', () => {
      const groupRule = extractRule(css, '.char-btn-group');
      expect(groupRule).not.toBeNull();
      assertProps(groupRule, { display: 'flex' });

      const btnRule = extractRule(css, '.char-btn');
      expect(btnRule).not.toBeNull();
      assertProps(btnRule, { cursor: 'pointer' });

      const hoverRule = extractRule(css, '.char-btn:hover');
      expect(hoverRule).not.toBeNull();
    });
  });

  describe('Download and hidden buttons', () => {
    it('should style the download button and hide the hidden button', () => {
      const downloadRule = extractRule(css, 'button.download');
      expect(downloadRule).not.toBeNull();

      const hiddenRule = extractRule(css, 'button.hidden');
      expect(hiddenRule).not.toBeNull();
      assertProps(hiddenRule, { display: 'none' });
    });
  });

  describe('Campaign tool container and header', () => {
    it('should define .ct-container as a flexible padded container', () => {
      const rule = extractRule(css, '.ct-container');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        flex: '1',
        width: '100%',
      });
    });

    it('should define .ct-header as a flex row with space-between layout', () => {
      const rule = extractRule(css, '.ct-container .ct-header');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        display: 'flex',
        'justify-content': 'space-between',
        'align-items': 'center',
      });
    });

    it('should define a styled title and primary action button', () => {
      const titleRule = extractRule(css, '.ct-container .ct-title');
      expect(titleRule).not.toBeNull();
      expect(getProp(titleRule, 'color')).toContain('var(--color-header)');

      const newBtnRule = extractRule(css, '.ct-container .ct-new-btn');
      expect(newBtnRule).not.toBeNull();
      assertProps(newBtnRule, { cursor: 'pointer' });

      const newBtnHover = extractRule(css, '.ct-container .ct-new-btn:hover');
      expect(newBtnHover).not.toBeNull();
    });
  });

  describe('Search bar components', () => {
    it('should define a flex search row with input and clear button', () => {
      const rowRule = extractRule(css, '.ct-container .ct-search-row');
      expect(rowRule).not.toBeNull();
      assertProps(rowRule, { display: 'flex' });

      const inputRule = extractRule(css, '.ct-container .ct-search-input');
      expect(inputRule).not.toBeNull();

      const focusRule = extractRule(css, '.ct-container .ct-search-input:focus');
      expect(focusRule).not.toBeNull();

      const clearRule = extractRule(css, '.ct-container .ct-search-clear');
      expect(clearRule).not.toBeNull();

      const clearHover = extractRule(css, '.ct-container .ct-search-clear:hover');
      expect(clearHover).not.toBeNull();
    });
  });

  describe('Empty state and list components', () => {
    it('should define a centered empty state layout', () => {
      const rule = extractRule(css, '.ct-container .ct-empty-state');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
      });
    });

    it('should define an icon inside empty state with reduced opacity', () => {
      const rule = extractRule(css, '.ct-container .ct-empty-state i');
      expect(rule).not.toBeNull();
      const opacity = getProp(rule, 'opacity');
      expect(parseFloat(opacity)).toBeLessThan(1);
    });

    it('should define a vertical list with clickable card items and hover', () => {
      const listRule = extractRule(css, '.ct-container .ct-list');
      expect(listRule).not.toBeNull();
      assertProps(listRule, {
        display: 'flex',
        'flex-direction': 'column',
      });

      const itemRule = extractRule(css, '.ct-container .ct-list-item');
      expect(itemRule).not.toBeNull();
      assertProps(itemRule, { cursor: 'pointer' });

      const hoverRule = extractRule(css, '.ct-container .ct-list-item:hover');
      expect(hoverRule).not.toBeNull();
    });

    it('should define list item header with flex layout', () => {
      const rule = extractRule(css, '.ct-container .ct-list-item-header');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        display: 'flex',
        'justify-content': 'space-between',
        'align-items': 'center',
      });
    });

    it('should define list name and preview typography', () => {
      const nameRule = extractRule(css, '.ct-container .ct-list-name');
      expect(nameRule).not.toBeNull();
      const fontWeight = getProp(nameRule, 'font-weight');
      expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(600);

      const previewRule = extractRule(css, '.ct-container .ct-list-preview');
      expect(previewRule).not.toBeNull();
    });

    it('should define meta and details flex rows', () => {
      const metaRule = extractRule(css, '.ct-container .ct-list-meta');
      expect(metaRule).not.toBeNull();
      assertProps(metaRule, { display: 'flex' });

      const detailsRule = extractRule(css, '.ct-container .ct-list-details');
      expect(detailsRule).not.toBeNull();
      assertProps(detailsRule, { display: 'flex' });
    });
  });

  describe('Modal structure', () => {
    it('should define a full-viewport overlay with high z-index', () => {
      const rule = extractRule(css, '.ct-container .ct-modal-overlay');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        position: 'fixed',
        display: 'flex',
      });
      expect(getProp(rule, 'z-index')).toBe('1000');
    });

    it('should define a centered modal with max-width constraints', () => {
      const rule = extractRule(css, '.ct-container .ct-modal');
      expect(rule).not.toBeNull();
      assertProps(rule, {
        display: 'flex',
        'flex-direction': 'column',
      });
      expect(getProp(rule, 'max-width')).toContain('vw');
    });

    it('should define modal header, body, and footer with borders and flex layout', () => {
      const headerRule = extractRule(css, '.ct-container .ct-modal-header');
      expect(headerRule).not.toBeNull();
      assertProps(headerRule, { display: 'flex' });

      const bodyRule = extractRule(css, '.ct-container .ct-modal-body');
      expect(bodyRule).not.toBeNull();
      expect(hasProp(bodyRule, 'overflow-y')).toBeTruthy();

      const footerRule = extractRule(css, '.ct-container .ct-modal-footer');
      expect(footerRule).not.toBeNull();
      assertProps(footerRule, { display: 'flex' });
    });

    it('should define a modal close button with hover state', () => {
      const rule = extractRule(css, '.ct-container .ct-modal-close');
      expect(rule).not.toBeNull();
      assertProps(rule, { cursor: 'pointer' });

      const hoverRule = extractRule(css, '.ct-container .ct-modal-close:hover');
      expect(hoverRule).not.toBeNull();
    });

    it('should define modal action and button groups with flex layout', () => {
      const actionsRule = extractRule(css, '.ct-container .ct-modal-actions');
      const buttonsRule = extractRule(css, '.ct-container .ct-modal-buttons');
      expect(actionsRule).not.toBeNull();
      expect(buttonsRule).not.toBeNull();
      assertProps(actionsRule, { display: 'flex' });
      assertProps(buttonsRule, { display: 'flex' });
    });
  });

  describe('Form fields', () => {
    it('should define form labels and required indicators', () => {
      const labelRule = extractRule(css, '.ct-container .ct-label');
      expect(labelRule).not.toBeNull();
      assertProps(labelRule, { display: 'block' });

      const requiredRule = extractRule(css, '.ct-container .ct-required');
      expect(requiredRule).not.toBeNull();
    });

    it('should define input, textarea, and select as full-width elements', () => {
      const inputRule = extractRule(css, '.ct-container .ct-input');
      expect(inputRule).not.toBeNull();
      assertProps(inputRule, { width: '100%' });

      const inputFocus = extractRule(css, '.ct-container .ct-input:focus');
      expect(inputFocus).not.toBeNull();

      const textareaRule = extractRule(css, '.ct-container .ct-textarea');
      expect(textareaRule).not.toBeNull();
      assertProps(textareaRule, { width: '100%' });

      const selectRule = extractRule(css, '.ct-container .ct-select');
      expect(selectRule).not.toBeNull();
      assertProps(selectRule, { width: '100%' });
    });
  });

  describe('Button styles', () => {
    it('should define secondary and primary button variants with disabled states', () => {
      const btnRule = extractRule(css, '.ct-container .ct-btn');
      expect(btnRule).not.toBeNull();
      assertProps(btnRule, { cursor: 'pointer' });

      const disabledRule = extractRule(css, '.ct-container .ct-btn:disabled');
      expect(disabledRule).not.toBeNull();

      const primaryRule = extractRule(css, '.ct-container .ct-btn-primary');
      expect(primaryRule).not.toBeNull();

      const primaryHover = extractRule(css, '.ct-container .ct-btn-primary:hover:not(:disabled)');
      expect(primaryHover).not.toBeNull();
    });

    it('should define a danger button variant with error color', () => {
      const rule = extractRule(css, '.ct-container .ct-btn-danger');
      expect(rule).not.toBeNull();
    });
  });

  describe('Navigation and utility buttons', () => {
    it('should define back and generate buttons with hover states', () => {
      const backBtnRule = extractRule(css, '.ct-container .ct-back-btn');
      expect(backBtnRule).not.toBeNull();
      assertProps(backBtnRule, { cursor: 'pointer' });

      const backHover = extractRule(css, '.ct-container .ct-back-btn:hover');
      expect(backHover).not.toBeNull();

      const genBtnRule = extractRule(css, '.ct-container .ct-generate-btn');
      expect(genBtnRule).not.toBeNull();
      assertProps(genBtnRule, { cursor: 'pointer' });
    });

    it('should define a muted search icon', () => {
      const rule = extractRule(css, '.ct-container .ct-search-icon');
      expect(rule).not.toBeNull();
      const color = getProp(rule, 'color');
      expect(color).toContain('var(--color-text-muted)');
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
});
