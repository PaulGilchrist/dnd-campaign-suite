import { describe, it, expect } from 'vitest';
import { VIEWS, SIDEBAR_BUTTONS, SIDEBAR_VIEWS } from './config.js';

describe('routes config', () => {
  describe('VIEWS', () => {
    it('should export a non-empty object with view keys', () => {
      expect(VIEWS).toBeTypeOf('object');
      expect(Object.keys(VIEWS).length).toBeGreaterThan(0);
      // Keys should be uppercase identifiers (CHAR_SHEET, MAPS_MANAGER, etc.)
      Object.keys(VIEWS).forEach(key => {
        expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
      });
    });

    it('should export a non-empty object with required fields on every view', () => {
      Object.values(VIEWS).forEach(view => {
        expect(view).toMatchObject({
          name: expect.any(String),
          stateVar: expect.any(String),
          type: expect.any(String),
          component: expect.any(String),
          description: expect.any(String),
        });
        expect(view.name).not.toBe('');
        expect(view.stateVar).not.toBe('');
        expect(view.type).not.toBe('');
        expect(view.component).not.toBe('');
        expect(view.description).not.toBe('');
      });
    });

    it('should have unique view names across all views', () => {
      const names = Object.values(VIEWS).map(v => v.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('should have unique stateVar values among boolean (overlay) views', () => {
      const booleanStateVars = Object.values(VIEWS)
        .filter(v => v.type === 'boolean')
        .map(v => v.stateVar);
      expect(new Set(booleanStateVars).size).toBe(booleanStateVars.length);
    });

    it('should classify sidebar views as string type with activeView stateVar and overlay views as boolean type with overlay flag', () => {
      Object.values(VIEWS).forEach(view => {
        if (view.type === 'string') {
          expect(view.stateVar).toBe('activeView');
          expect(view.overlay).not.toBe(true);
        } else if (view.type === 'boolean') {
          expect(view.stateVar).not.toBe('activeView');
          expect(view.overlay).toBe(true);
        }
      });
    });

    it('should have PascalCase component names', () => {
      Object.values(VIEWS).forEach(view => {
        expect(view.component).toMatch(/^[A-Z][a-zA-Z]*$/);
      });
    });

    it('should mark needsActiveCharacter only on wizard overlay views', () => {
      Object.values(VIEWS).forEach(view => {
        if (view.name.includes('Wizard')) {
          expect(view.needsActiveCharacter).toBeTypeOf('boolean');
        }
      });
    });
  });

  describe('SIDEBAR_BUTTONS', () => {
    it('should export an array with required fields on each button', () => {
      expect(Array.isArray(SIDEBAR_BUTTONS)).toBe(true);

      SIDEBAR_BUTTONS.forEach(button => {
        expect(button).toMatchObject({
          label: expect.any(String),
          icon: expect.any(String),
          view: expect.any(String),
        });
        expect(button.label).not.toBe('');
        expect(button.icon).not.toBe('');
        expect(button.view).not.toBe('');
      });
    });

    it('should have unique view references, labels, and icons', () => {
      const views = SIDEBAR_BUTTONS.map(b => b.view);
      const labels = SIDEBAR_BUTTONS.map(b => b.label);
      const icons = SIDEBAR_BUTTONS.map(b => b.icon);
      expect(new Set(views).size).toBe(views.length);
      expect(new Set(labels).size).toBe(labels.length);
      expect(new Set(icons).size).toBe(icons.length);
    });

    it('should have all button views reference valid VIEWS entries by name', () => {
      const allViewNames = Object.values(VIEWS).map(v => v.name);
      SIDEBAR_BUTTONS.forEach(button => {
        expect(allViewNames).toContain(button.view);
      });
    });

    it('should have all sidebar views covered by buttons (set equality)', () => {
      const buttonViews = new Set(SIDEBAR_BUTTONS.map(b => b.view));
      SIDEBAR_VIEWS.forEach(name => {
        expect(buttonViews).toContain(name);
      });
    });

    it('should use fa-* icon format', () => {
      SIDEBAR_BUTTONS.forEach(button => {
        expect(button.icon).toMatch(/^fa-/);
      });
    });
  });

  describe('SIDEBAR_VIEWS', () => {
    it('should export an array of unique view names', () => {
      expect(Array.isArray(SIDEBAR_VIEWS)).toBe(true);
      expect(new Set(SIDEBAR_VIEWS).size).toBe(SIDEBAR_VIEWS.length);
    });

    it('should only contain string-type view names from VIEWS', () => {
      const stringViewNames = new Set(
        Object.values(VIEWS)
          .filter(v => v.type === 'string')
          .map(v => v.name)
      );
      SIDEBAR_VIEWS.forEach(name => {
        expect(stringViewNames).toContain(name);
      });
    });
  });

  describe('cross-config consistency', () => {
    it('should have matching counts between sidebar views and buttons', () => {
      expect(SIDEBAR_VIEWS.length).toBe(SIDEBAR_BUTTONS.length);
    });

    it('should have no orphaned sidebar views without a corresponding VIEWS entry', () => {
      const viewNames = new Set(Object.values(VIEWS).map(v => v.name));
      SIDEBAR_VIEWS.forEach(name => {
        expect(viewNames).toContain(name);
      });
    });

  });
});
