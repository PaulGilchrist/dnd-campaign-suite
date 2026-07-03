// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { VIEWS, SIDEBAR_BUTTONS, SIDEBAR_VIEWS } from './config.js';

describe('routes config', () => {
  describe('VIEWS', () => {
    it('should export a non-empty object with required fields on every view', () => {
      expect(VIEWS).toBeTypeOf('object');
      expect(Object.keys(VIEWS).length).toBeGreaterThan(0);

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

    it('should classify sidebar views as activeView string type', () => {
      const sidebarViewKeys = [
        'CHAR_SHEET', 'INITIATIVE', 'MAPS_MANAGER', 'MAP',
        'ENCOUNTER', 'FACTIONS', 'NOTES', 'QUESTS', 'NPCS',
        'SETTLEMENTS', 'CAMPAIGN_LOG',
      ];

      sidebarViewKeys.forEach(key => {
        expect(VIEWS[key].stateVar).toBe('activeView');
        expect(VIEWS[key].type).toBe('string');
        expect(VIEWS[key].overlay).not.toBe(true);
      });
    });

    it('should classify overlay views as boolean type with overlay flag', () => {
      const overlayViewKeys = [
        'CAMPAIGN_SELECTION',
        'CHARACTER_WIZARD',
        'EDIT_CHARACTER_WIZARD',
      ];

      overlayViewKeys.forEach(key => {
        expect(VIEWS[key].stateVar).not.toBe('activeView');
        expect(VIEWS[key].type).toBe('boolean');
        expect(VIEWS[key].overlay).toBe(true);
      });
    });

    it('should have unique view names across all views', () => {
      const names = Object.values(VIEWS).map(v => v.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('should have unique stateVar values within each category', () => {
      const booleanStateVars = Object.values(VIEWS)
        .filter(v => v.type === 'boolean')
        .map(v => v.stateVar);
      expect(new Set(booleanStateVars).size).toBe(booleanStateVars.length);
    });

    it('should map overlay views to correct component and needsActiveCharacter flags', () => {
      expect(VIEWS.CAMPAIGN_SELECTION.component).toBe('CampaignSelection');
      expect(VIEWS.CHARACTER_WIZARD.needsActiveCharacter).toBe(false);
      expect(VIEWS.EDIT_CHARACTER_WIZARD.needsActiveCharacter).toBe(true);
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
  });

  describe('SIDEBAR_VIEWS', () => {
    it('should export an array of unique view names without overlay views', () => {
      expect(Array.isArray(SIDEBAR_VIEWS)).toBe(true);
      expect(new Set(SIDEBAR_VIEWS).size).toBe(SIDEBAR_VIEWS.length);

      const overlayNames = ['campaignSelection', 'characterWizard', 'editCharacterWizard'];
      overlayNames.forEach(name => {
        expect(SIDEBAR_VIEWS).not.toContain(name);
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
