// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { VIEWS, SIDEBAR_BUTTONS, SIDEBAR_VIEWS } from './config.js';

describe('routes config', () => {
  describe('VIEWS', () => {
    it('should export a non-empty object', () => {
      expect(VIEWS).toBeTypeOf('object');
      expect(Object.keys(VIEWS).length).toBeGreaterThan(0);
    });

    it('should have all views with required fields and correct types', () => {
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

    it('should have sidebar views whose names match SIDEBAR_VIEWS entries', () => {
      const sidebarViews = Object.values(VIEWS).filter(v => v.type === 'string');
      const viewNames = sidebarViews.map(v => v.name);
      SIDEBAR_VIEWS.forEach(name => {
        expect(viewNames).toContain(name);
      });
    });

    it('should have consistent component names for all sidebar views', () => {
      expect(VIEWS.CHAR_SHEET.component).toBe('CharSheet');
      expect(VIEWS.INITIATIVE.component).toBe('Initiative');
      expect(VIEWS.MAPS_MANAGER.component).toBe('MapsManager');
      expect(VIEWS.MAP.component).toBe('Map');
      expect(VIEWS.ENCOUNTER.component).toBe('EncounterBuilder');
      expect(VIEWS.FACTIONS.component).toBe('Factions');
      expect(VIEWS.NOTES.component).toBe('Notes');
      expect(VIEWS.QUESTS.component).toBe('Quests');
      expect(VIEWS.NPCS.component).toBe('NPCs');
      expect(VIEWS.SETTLEMENTS.component).toBe('Settlements');
      expect(VIEWS.CAMPAIGN_LOG.component).toBe('Log');
    });

    it('should have overlay views using CharacterCreationWizard component', () => {
      expect(VIEWS.CHARACTER_WIZARD.component).toBe('CharacterCreationWizard');
      expect(VIEWS.EDIT_CHARACTER_WIZARD.component).toBe('CharacterCreationWizard');
    });
  });

  describe('SIDEBAR_BUTTONS', () => {
    it('should export an array', () => {
      expect(Array.isArray(SIDEBAR_BUTTONS)).toBe(true);
    });

    it('should have required fields with correct types on each button', () => {
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

    it('should have all button views reference valid VIEWS entries by name', () => {
      const allViewNames = Object.values(VIEWS).map(v => v.name);
      SIDEBAR_BUTTONS.forEach(button => {
        expect(allViewNames).toContain(button.view);
      });
    });

    it('should have unique view references', () => {
      const views = SIDEBAR_BUTTONS.map(b => b.view);
      expect(new Set(views).size).toBe(views.length);
    });

    it('should have unique labels', () => {
      const labels = SIDEBAR_BUTTONS.map(b => b.label);
      expect(new Set(labels).size).toBe(labels.length);
    });

    it('should have unique icons', () => {
      const icons = SIDEBAR_BUTTONS.map(b => b.icon);
      expect(new Set(icons).size).toBe(icons.length);
    });

    it('should cover all sidebar views', () => {
      const buttonViews = new Set(SIDEBAR_BUTTONS.map(b => b.view));
      SIDEBAR_VIEWS.forEach(name => {
        expect(buttonViews).toContain(name);
      });
    });

    it('should cover all sidebar views in same order as SIDEBAR_VIEWS', () => {
      const buttonViews = SIDEBAR_BUTTONS.map(b => b.view);
      const buttonSet = new Set(buttonViews);
      SIDEBAR_VIEWS.forEach(name => {
        expect(buttonSet).toContain(name);
      });
    });
  });

  describe('SIDEBAR_VIEWS', () => {
    it('should export an array', () => {
      expect(Array.isArray(SIDEBAR_VIEWS)).toBe(true);
    });

    it('should contain all expected sidebar view names', () => {
      expect(SIDEBAR_VIEWS).toContain('charSheet');
      expect(SIDEBAR_VIEWS).toContain('initiative');
      expect(SIDEBAR_VIEWS).toContain('mapsManager');
      expect(SIDEBAR_VIEWS).toContain('encounter');
      expect(SIDEBAR_VIEWS).toContain('factions');
      expect(SIDEBAR_VIEWS).toContain('notes');
      expect(SIDEBAR_VIEWS).toContain('quests');
      expect(SIDEBAR_VIEWS).toContain('npcs');
      expect(SIDEBAR_VIEWS).toContain('settlements');
      expect(SIDEBAR_VIEWS).toContain('campaignLog');
    });

    it('should not include overlay view names', () => {
      expect(SIDEBAR_VIEWS).not.toContain('campaignSelection');
      expect(SIDEBAR_VIEWS).not.toContain('characterWizard');
      expect(SIDEBAR_VIEWS).not.toContain('editCharacterWizard');
    });

    it('should have unique view names', () => {
      expect(new Set(SIDEBAR_VIEWS).size).toBe(SIDEBAR_VIEWS.length);
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

    it('should have all sidebar views covered by buttons', () => {
      const buttonViews = new Set(SIDEBAR_BUTTONS.map(b => b.view));
      SIDEBAR_VIEWS.forEach(name => {
        expect(buttonViews).toContain(name);
      });
    });
  });
});
