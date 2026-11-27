// @maintained-by-ai 2026-11-26
// Deterministic contract tests over the static view config in ./config.js.
// Property/convention checks (not hard-coded lists), so adding or removing
// views that follow the conventions requires no churn here. The tab-title
// derivation itself is pinned in config.document-title.test.js; the
// NAV_ITEMS↔VIEW_LABELS sync law is pinned stronger in sidebarNav.test.js.
import { describe, it, expect } from 'vitest';
import { VIEWS, SIDEBAR_VIEWS } from './config.js';
import { VIEW_LABELS } from '../services/ui/sidebarNav.js';

describe('routes config', () => {
  describe('VIEWS', () => {
    it('every entry is a complete, uniquely named view: uppercase key, non-empty required string fields', () => {
      const names = Object.entries(VIEWS).map(([key, view]) => {
        expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
        for (const field of ['name', 'stateVar', 'type', 'component', 'description']) {
          expect(view[field], `${key}.${field}`).toBeTypeOf('string');
          expect(view[field], `${key}.${field}`).not.toBe('');
        }
        return view.name;
      });
      expect(names.length).toBeGreaterThan(0);
      // Duplicate names would make activeView lookups ambiguous.
      expect(new Set(names).size).toBe(names.length);
    });

    it('string views are mutually exclusive via activeView; boolean views are overlays with unique stateVars', () => {
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
  });

  describe('sidebar label law (F13, Item 7)', () => {
    // The old SIDEBAR_BUTTONS list in config.js was a DUPLICATE of the live
    // nav and drifted ("Encounter" vs the sidebar's "Encounters"). It was
    // deleted; VIEW_LABELS in services/ui/sidebarNav.js is the single source
    // of truth the sidebar renders AND the tab title derives.
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
      // Duplicate labels would make two views indistinguishable in the tab title.
      expect(new Set(labels).size).toBe(labels.length);
      expect(new Set(icons).size).toBe(icons.length);
    });
  });

  describe('SIDEBAR_VIEWS', () => {
    it('is a unique list of string-type view names, exactly the labeled sidebar views (F13 set equality)', () => {
      expect(Array.isArray(SIDEBAR_VIEWS)).toBe(true);
      expect(new Set(SIDEBAR_VIEWS).size).toBe(SIDEBAR_VIEWS.length);

      // Every entry must be backed by a real string-type view (catches typos
      // that the VIEW_LABELS set equality below would miss, since both lists
      // could drift together).
      const stringViewNames = new Set(
        Object.values(VIEWS)
          .filter(v => v.type === 'string')
          .map(v => v.name)
      );
      SIDEBAR_VIEWS.forEach(name => {
        expect(stringViewNames).toContain(name);
      });

      // Uniqueness of both sides is asserted above, so sorted-array equality
      // here is a true set comparison — no sidebar entry without a label,
      // and no label without a sidebar entry.
      expect([...SIDEBAR_VIEWS].sort()).toEqual(
        Object.keys(VIEW_LABELS).sort()
      );
    });
  });
});
