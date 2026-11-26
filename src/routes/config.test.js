// @maintained-by-ai
// Deterministic contract tests over the static view config in ./config.js.
// Property/convention checks (not hard-coded lists), so adding or removing
// views that follow the conventions requires no churn here.
import { describe, it, expect } from 'vitest';
import { VIEWS, SIDEBAR_VIEWS } from './config.js';
import { VIEW_LABELS, NAV_ITEMS } from '../services/ui/sidebarNav.js';

describe('routes config', () => {
  describe('VIEWS', () => {
    it('should export a non-empty object with uppercase identifier keys', () => {
      expect(VIEWS).toBeTypeOf('object');
      expect(Object.keys(VIEWS).length).toBeGreaterThan(0);
      Object.keys(VIEWS).forEach(key => {
        expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
      });
    });

    it('should have required non-empty fields on every view', () => {
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

    it('should enforce the view-type contract: string views share activeView, boolean views are overlays with unique stateVars', () => {
      const booleanStateVars = [];
      Object.values(VIEWS).forEach(view => {
        if (view.type === 'string') {
          expect(view.stateVar).toBe('activeView');
          expect(view.overlay).not.toBe(true);
        } else if (view.type === 'boolean') {
          expect(view.stateVar).not.toBe('activeView');
          expect(view.overlay).toBe(true);
          booleanStateVars.push(view.stateVar);
        }
      });
      // Two overlays sharing one stateVar would toggle together.
      expect(new Set(booleanStateVars).size).toBe(booleanStateVars.length);
    });

    it('should have PascalCase component names', () => {
      Object.values(VIEWS).forEach(view => {
        expect(view.component).toMatch(/^[A-Z][a-zA-Z]*$/);
      });
    });

    it('should declare needsActiveCharacter only on boolean overlay views, and on every wizard overlay', () => {
      Object.values(VIEWS).forEach(view => {
        if ('needsActiveCharacter' in view) {
          expect(view.needsActiveCharacter).toBeTypeOf('boolean');
          expect(view.type).toBe('boolean');
          expect(view.overlay).toBe(true);
        }
        if (view.name.includes('Wizard')) {
          expect(view.needsActiveCharacter).toBeTypeOf('boolean');
        }
      });
    });
  });

  describe('sidebar label law (F13, Item 7)', () => {
    // The old SIDEBAR_BUTTONS list in config.js was a DUPLICATE of the live
    // nav and drifted ("Encounter" vs the sidebar's "Encounters"). It was
    // deleted; VIEW_LABELS/NAV_ITEMS in services/ui/sidebarNav.js are the
    // single source of truth the sidebar renders AND the tab title derives.
    it('VIEW_LABELS carry a unique non-empty label and fa-* icon per view', () => {
      const entries = Object.entries(VIEW_LABELS);
      expect(entries.length).toBeGreaterThan(0);
      const labels = entries.map(([, { label }]) => label);
      const icons = entries.map(([, { icon }]) => icon);
      labels.forEach(label => {
        expect(label).not.toBe('');
      });
      icons.forEach(icon => {
        expect(icon).toMatch(/^fa-/);
      });
      expect(new Set(labels).size).toBe(labels.length);
      expect(new Set(icons).size).toBe(icons.length);
    });

    it('every NAV_ITEMS destination references a labeled view; openers carry their own icon+label', () => {
      NAV_ITEMS.forEach(item => {
        if (item.view) {
          expect(VIEW_LABELS[item.view], `nav view ${item.view} must have a label`).toBeTruthy();
        } else {
          expect(item.icon).toMatch(/^fa-/);
          expect(item.label).not.toBe('');
        }
      });
    });
  });

  describe('SIDEBAR_VIEWS', () => {
    it('should be a unique list of string-type view names from VIEWS', () => {
      expect(Array.isArray(SIDEBAR_VIEWS)).toBe(true);
      expect(new Set(SIDEBAR_VIEWS).size).toBe(SIDEBAR_VIEWS.length);

      const stringViewNames = new Set(
        Object.values(VIEWS)
          .filter(v => v.type === 'string')
          .map(v => v.name)
      );
      SIDEBAR_VIEWS.forEach(name => {
        expect(stringViewNames).toContain(name);
      });
    });

    it('should exactly match the labeled sidebar views (set equality)', () => {
      // Uniqueness of both sides is asserted above, so sorted-array
      // equality here is a true set comparison. The label source is now
      // sidebarNav.js VIEW_LABELS (F13) — every SIDEBAR_VIEWS entry must
      // be labeled there and vice versa.
      expect([...SIDEBAR_VIEWS].sort()).toEqual(
        Object.keys(VIEW_LABELS).sort()
      );
    });
  });
});
