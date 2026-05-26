import { describe, it, expect } from 'vitest';
import { VIEWS, SIDEBAR_BUTTONS, SIDEBAR_VIEWS } from './config.js';

describe('routes config', () => {
  describe('VIEWS', () => {
    it('should be defined and non-empty', () => {
      expect(VIEWS).toBeDefined();
      expect(Object.keys(VIEWS).length).toBeGreaterThan(0);
    });

    it('should have all views with required fields', () => {
      Object.values(VIEWS).forEach(view => {
        expect(view).toHaveProperty('name');
        expect(view).toHaveProperty('stateVar');
        expect(view).toHaveProperty('type');
        expect(view).toHaveProperty('component');

        expect(typeof view.name).toBe('string');
        expect(typeof view.stateVar).toBe('string');
        expect(typeof view.type).toBe('string');
        expect(typeof view.component).toBe('string');
      });
    });

    it('should have correct stateVar for sidebar views', () => {
      const sidebarViewKeys = [
        'CHAR_SHEET', 'INITIATIVE', 'MAPS_MANAGER', 'MAP',
        'ENCOUNTER', 'FACTIONS', 'NOTES', 'QUESTS', 'NPCS',
        'CAMPAIGN_LOG',
      ];

      sidebarViewKeys.forEach(key => {
        expect(VIEWS[key].stateVar).toBe('activeView');
        expect(VIEWS[key].type).toBe('string');
      });
    });

    it('should have overlay views with boolean stateVars', () => {
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

    it('should have correct component names for sidebar views', () => {
      expect(VIEWS.CHAR_SHEET.component).toBe('CharSheet');
      expect(VIEWS.INITIATIVE.component).toBe('Initiative');
      expect(VIEWS.MAPS_MANAGER.component).toBe('MapsManager');
      expect(VIEWS.MAP.component).toBe('Map');
      expect(VIEWS.ENCOUNTER.component).toBe('EncounterBuilder');
      expect(VIEWS.FACTIONS.component).toBe('Factions');
      expect(VIEWS.NOTES.component).toBe('Notes');
      expect(VIEWS.QUESTS.component).toBe('Quests');
      expect(VIEWS.NPCS.component).toBe('NPCs');
      expect(VIEWS.CAMPAIGN_LOG.component).toBe('Log');
    });

    it('should have overlay views with correct component names', () => {
      expect(VIEWS.CAMPAIGN_SELECTION.component).toBe('CampaignSelection');
      expect(VIEWS.CHARACTER_WIZARD.component).toBe('CharacterCreationWizard');
      expect(VIEWS.EDIT_CHARACTER_WIZARD.component).toBe('CharacterCreationWizard');
    });

    it('should have descriptions on all views', () => {
      Object.values(VIEWS).forEach(view => {
        expect(view).toHaveProperty('description');
        expect(typeof view.description).toBe('string');
        expect(view.description.length).toBeGreaterThan(0);
      });
    });

    it('should have needsActiveCharacter only on edit wizard', () => {
      expect(VIEWS.CHARACTER_WIZARD.needsActiveCharacter).toBe(false);
      expect(VIEWS.EDIT_CHARACTER_WIZARD.needsActiveCharacter).toBe(true);
    });

    it('should have exactly 13 views defined', () => {
      expect(Object.keys(VIEWS).length).toBe(13);
    });
  });

  describe('SIDEBAR_BUTTONS', () => {
    it('should be defined and non-empty', () => {
      expect(SIDEBAR_BUTTONS).toBeDefined();
      expect(Array.isArray(SIDEBAR_BUTTONS)).toBe(true);
      expect(SIDEBAR_BUTTONS.length).toBeGreaterThan(0);
    });

    it('should have 9 sidebar buttons', () => {
      expect(SIDEBAR_BUTTONS.length).toBe(9);
    });

    it('should have required fields on each button', () => {
      SIDEBAR_BUTTONS.forEach(button => {
        expect(button).toHaveProperty('label');
        expect(button).toHaveProperty('icon');
        expect(button).toHaveProperty('view');

        expect(typeof button.label).toBe('string');
        expect(typeof button.icon).toBe('string');
        expect(typeof button.view).toBe('string');

        expect(button.label.length).toBeGreaterThan(0);
        expect(button.icon.length).toBeGreaterThan(0);
        expect(button.view.length).toBeGreaterThan(0);
      });
    });

    it('should have correct button structure', () => {
      expect(SIDEBAR_BUTTONS[0]).toEqual({ label: 'Character', icon: 'fa-user', view: 'charSheet' });
      expect(SIDEBAR_BUTTONS[1]).toEqual({ label: 'Encounter', icon: 'fa-skull-crossbones', view: 'encounter' });
      expect(SIDEBAR_BUTTONS[2]).toEqual({ label: 'Factions', icon: 'fa-handshake', view: 'factions' });
      expect(SIDEBAR_BUTTONS[3]).toEqual({ label: 'Initiative', icon: 'fa-gavel', view: 'initiative' });
      expect(SIDEBAR_BUTTONS[4]).toEqual({ label: 'Maps', icon: 'fa-map', view: 'mapsManager' });
      expect(SIDEBAR_BUTTONS[5]).toEqual({ label: 'Notes', icon: 'fa-sticky-note', view: 'notes' });
      expect(SIDEBAR_BUTTONS[6]).toEqual({ label: 'Quests', icon: 'fa-scroll', view: 'quests' });
      expect(SIDEBAR_BUTTONS[7]).toEqual({ label: 'NPCs', icon: 'fa-users', view: 'npcs' });
      expect(SIDEBAR_BUTTONS[8]).toEqual({ label: 'Log', icon: 'fa-book-journal-whills', view: 'campaignLog' });
    });

    it('should have all view values reference valid VIEWS entries', () => {
      const allViewNames = Object.values(VIEWS).map(v => v.name);
      SIDEBAR_BUTTONS.forEach(button => {
        expect(allViewNames).toContain(button.view);
      });
    });
  });

  describe('SIDEBAR_VIEWS', () => {
    it('should be defined and non-empty', () => {
      expect(SIDEBAR_VIEWS).toBeDefined();
      expect(Array.isArray(SIDEBAR_VIEWS)).toBe(true);
      expect(SIDEBAR_VIEWS.length).toBeGreaterThan(0);
    });

    it('should have 9 sidebar views', () => {
      expect(SIDEBAR_VIEWS.length).toBe(9);
    });

    it('should contain all sidebar view names', () => {
      expect(SIDEBAR_VIEWS).toContain('charSheet');
      expect(SIDEBAR_VIEWS).toContain('initiative');
      expect(SIDEBAR_VIEWS).toContain('mapsManager');
      expect(SIDEBAR_VIEWS).toContain('encounter');
      expect(SIDEBAR_VIEWS).toContain('factions');
      expect(SIDEBAR_VIEWS).toContain('notes');
      expect(SIDEBAR_VIEWS).toContain('quests');
      expect(SIDEBAR_VIEWS).toContain('npcs');
      expect(SIDEBAR_VIEWS).toContain('campaignLog');
    });

    it('should not include overlay view names', () => {
      expect(SIDEBAR_VIEWS).not.toContain('campaignSelection');
      expect(SIDEBAR_VIEWS).not.toContain('characterWizard');
      expect(SIDEBAR_VIEWS).not.toContain('editCharacterWizard');
    });

    it('should have unique view names', () => {
      const uniqueViews = [...new Set(SIDEBAR_VIEWS)];
      expect(uniqueViews).toHaveLength(SIDEBAR_VIEWS.length);
    });

    it('should match sidebar button views', () => {
      const buttonViews = SIDEBAR_BUTTONS.map(b => b.view);
      expect(SIDEBAR_VIEWS.sort()).toEqual([...buttonViews].sort());
    });
  });
});
