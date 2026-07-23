// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { WIZARD_STEPS, getTotalSteps, getStepConfig } from './steps-config.js';
import WizardStepRules from '../components/character-creation/WizardStepRules.jsx';
import WizardStepBasic from '../components/character-creation/WizardStepBasic.jsx';
import WizardStepRace from '../components/character-creation/WizardStepRace.jsx';
import WizardStepSubrace from '../components/character-creation/WizardStepSubrace.jsx';
import WizardStepBackground from '../components/character-creation/WizardStepBackground.jsx';
import WizardStepClass from '../components/character-creation/WizardStepClass.jsx';
import WizardStepSubclass from '../components/character-creation/WizardStepSubclass.jsx';
import WizardStepFeats from '../components/character-creation/WizardStepFeats.jsx';
import WizardStepAbilities from '../components/character-creation/WizardStepAbilities.jsx';
import WizardStepSkills from '../components/character-creation/WizardStepSkills.jsx';
import WizardStepLanguages from '../components/character-creation/WizardStepLanguages.jsx';
import WizardStepResistances from '../components/character-creation/WizardStepResistances.jsx';
import WizardStepSpells from '../components/character-creation/WizardStepSpells.jsx';
import WizardStepMagicItems from '../components/character-creation/WizardStepMagicItems.jsx';
import WizardStepInventory from '../components/character-creation/WizardStepInventory.jsx';
import WizardStepSpecial from '../components/character-creation/WizardStepSpecial.jsx';

describe('steps-config', () => {
  describe('WIZARD_STEPS', () => {
    it('should have exactly 16 steps', () => {
      expect(WIZARD_STEPS.length).toBe(16);
    });

    it('should have steps numbered 1 through 16 with no gaps', () => {
      const stepNumbers = WIZARD_STEPS.map((step) => step.step);
      for (let i = 1; i <= 16; i++) {
        expect(stepNumbers).toContain(i);
      }
    });

    it('should have unique step numbers', () => {
      const stepNumbers = WIZARD_STEPS.map((step) => step.step);
      const unique = new Set(stepNumbers);
      expect(unique.size).toBe(stepNumbers.length);
    });

    it('should have all required properties on each step', () => {
      for (const step of WIZARD_STEPS) {
        expect(step).toHaveProperty('step');
        expect(step).toHaveProperty('title');
        expect(step).toHaveProperty('component');
        expect(step).toHaveProperty('getProps');
        expect(typeof step.getProps).toBe('function');
      }
    });

    it('should have non-empty titles for all steps', () => {
      for (const step of WIZARD_STEPS) {
        expect(typeof step.title).toBe('string');
        expect(step.title.length).toBeGreaterThan(0);
      }
    });

    it('should export correct component types', () => {
      const expectedComponents = [
        WizardStepRules,
        WizardStepBasic,
        WizardStepRace,
        WizardStepSubrace,
        WizardStepBackground,
        WizardStepClass,
        WizardStepSubclass,
        WizardStepFeats,
        WizardStepAbilities,
        WizardStepSkills,
        WizardStepLanguages,
        WizardStepResistances,
        WizardStepSpells,
        WizardStepMagicItems,
        WizardStepInventory,
        WizardStepSpecial,
      ];
      for (let i = 0; i < WIZARD_STEPS.length; i++) {
        expect(WIZARD_STEPS[i].component).toBe(expectedComponents[i]);
      }
    });

    it('should have steps in ascending order', () => {
      for (let i = 1; i < WIZARD_STEPS.length; i++) {
        expect(WIZARD_STEPS[i].step).toBe(WIZARD_STEPS[i - 1].step + 1);
      }
    });
  });

  describe('Step titles', () => {
    it('should have correct titles for all steps', () => {
      const expectedTitles = [
        { step: 1, title: 'Ruleset' },
        { step: 2, title: 'Basic Information' },
        { step: 3, title: 'Race' },
        { step: 4, title: 'Subrace' },
        { step: 5, title: 'Background' },
        { step: 6, title: 'Class' },
        { step: 7, title: 'Subclass / Major' },
        { step: 8, title: 'Feats' },
        { step: 9, title: 'Ability Scores' },
        { step: 10, title: 'Skill Proficiencies' },
        { step: 11, title: 'Languages & Fighting Styles' },
        { step: 12, title: 'Resistances & Immunities' },
        { step: 13, title: 'Spells' },
        { step: 14, title: 'Magic Items' },
        { step: 15, title: 'Inventory' },
        { step: 16, title: 'Special Actions' },
      ];
      for (const expected of expectedTitles) {
        const step = getStepConfig(expected.step);
        expect(step.title).toBe(expected.title);
      }
    });
  });

  describe('getTotalSteps', () => {
    it('should return the number of wizard steps', () => {
      expect(getTotalSteps()).toBe(WIZARD_STEPS.length);
    });

    it('should return 16', () => {
      expect(getTotalSteps()).toBe(16);
    });
  });

  describe('getStepConfig', () => {
    it('should return config for all valid step numbers 1-16', () => {
      for (let i = 1; i <= 16; i++) {
        const step = getStepConfig(i);
        expect(step).toBeDefined();
        expect(step.step).toBe(i);
      }
    });

    it('should return undefined for invalid step numbers', () => {
      expect(getStepConfig(0)).toBeUndefined();
      expect(getStepConfig(-1)).toBeUndefined();
      expect(getStepConfig(17)).toBeUndefined();
      expect(getStepConfig(100)).toBeUndefined();
    });

    it('should return undefined for non-numeric input', () => {
      expect(getStepConfig(null)).toBeUndefined();
      expect(getStepConfig(undefined)).toBeUndefined();
      expect(getStepConfig('1')).toBeUndefined();
    });

    it('should return the same object reference for repeated calls', () => {
      const config1 = getStepConfig(1);
      const config2 = getStepConfig(1);
      expect(config1).toBe(config2);
    });

    it('should return correct step config for step 1 (Ruleset)', () => {
      const step = getStepConfig(1);
      expect(step.step).toBe(1);
      expect(step.title).toBe('Ruleset');
      expect(step.component).toBe(WizardStepRules);
    });

    it('should return correct step config for step 2 (Basic Information)', () => {
      const step = getStepConfig(2);
      expect(step.step).toBe(2);
      expect(step.title).toBe('Basic Information');
      expect(step.component).toBe(WizardStepBasic);
    });

    it('should return correct step config for step 3 (Race)', () => {
      const step = getStepConfig(3);
      expect(step.step).toBe(3);
      expect(step.title).toBe('Race');
      expect(step.component).toBe(WizardStepRace);
    });

    it('should return correct step config for step 4 (Subrace)', () => {
      const step = getStepConfig(4);
      expect(step.step).toBe(4);
      expect(step.title).toBe('Subrace');
      expect(step.component).toBe(WizardStepSubrace);
    });

    it('should return correct step config for step 5 (Background)', () => {
      const step = getStepConfig(5);
      expect(step.step).toBe(5);
      expect(step.title).toBe('Background');
      expect(step.component).toBe(WizardStepBackground);
    });

    it('should return correct step config for step 6 (Class)', () => {
      const step = getStepConfig(6);
      expect(step.step).toBe(6);
      expect(step.title).toBe('Class');
      expect(step.component).toBe(WizardStepClass);
    });

    it('should return correct step config for step 7 (Subclass / Major)', () => {
      const step = getStepConfig(7);
      expect(step.step).toBe(7);
      expect(step.title).toBe('Subclass / Major');
      expect(step.component).toBe(WizardStepSubclass);
    });

    it('should return correct step config for step 8 (Feats)', () => {
      const step = getStepConfig(8);
      expect(step.step).toBe(8);
      expect(step.title).toBe('Feats');
      expect(step.component).toBe(WizardStepFeats);
    });

    it('should return correct step config for step 9 (Ability Scores)', () => {
      const step = getStepConfig(9);
      expect(step.step).toBe(9);
      expect(step.title).toBe('Ability Scores');
      expect(step.component).toBe(WizardStepAbilities);
    });

    it('should return correct step config for step 10 (Skill Proficiencies)', () => {
      const step = getStepConfig(10);
      expect(step.step).toBe(10);
      expect(step.title).toBe('Skill Proficiencies');
      expect(step.component).toBe(WizardStepSkills);
    });

    it('should return correct step config for step 11 (Languages & Fighting Styles)', () => {
      const step = getStepConfig(11);
      expect(step.step).toBe(11);
      expect(step.title).toBe('Languages & Fighting Styles');
      expect(step.component).toBe(WizardStepLanguages);
    });

    it('should return correct step config for step 12 (Resistances & Immunities)', () => {
      const step = getStepConfig(12);
      expect(step.step).toBe(12);
      expect(step.title).toBe('Resistances & Immunities');
      expect(step.component).toBe(WizardStepResistances);
    });

    it('should return correct step config for step 13 (Spells)', () => {
      const step = getStepConfig(13);
      expect(step.step).toBe(13);
      expect(step.title).toBe('Spells');
      expect(step.component).toBe(WizardStepSpells);
    });

    it('should return correct step config for step 14 (Magic Items)', () => {
      const step = getStepConfig(14);
      expect(step.step).toBe(14);
      expect(step.title).toBe('Magic Items');
      expect(step.component).toBe(WizardStepMagicItems);
    });

    it('should return correct step config for step 15 (Inventory)', () => {
      const step = getStepConfig(15);
      expect(step.step).toBe(15);
      expect(step.title).toBe('Inventory');
      expect(step.component).toBe(WizardStepInventory);
    });

    it('should return correct step config for step 16 (Special Actions)', () => {
      const step = getStepConfig(16);
      expect(step.step).toBe(16);
      expect(step.title).toBe('Special Actions');
      expect(step.component).toBe(WizardStepSpecial);
    });
  });

  describe('getProps functions', () => {
    describe('Step 1 - Ruleset getProps', () => {
      it('should return correct props object', () => {
        const step = getStepConfig(1);
        const props = step.getProps({
          ruleset: '5e',
          errors: { ruleset: 'Invalid ruleset' },
          onRulesetChange: vi.fn(),
        });
        expect(props).toEqual({
          ruleset: '5e',
          errors: { ruleset: 'Invalid ruleset' },
          onRulesetChange: expect.any(Function),
        });
      });
    });

    describe('Step 2 - Basic Information getProps', () => {
      it('should return correct props object', () => {
        const step = getStepConfig(2);
        const props = step.getProps({
          formData: { name: 'Test' },
          errors: {},
          backgrounds: [{ name: 'Acolyte' }],
          campaignName: 'test',
          onInputChange: vi.fn(),
        });
        expect(props).toEqual({
          formData: { name: 'Test' },
          errors: {},
          backgrounds: [{ name: 'Acolyte' }],
          campaignName: 'test',
          onInputChange: expect.any(Function),
        });
      });
    });

    describe('Step 3 - Race getProps', () => {
      it('should return correct props object', () => {
        const step = getStepConfig(3);
        const props = step.getProps({
          formData: { race: { name: 'Human' } },
          errors: {},
          allRacesData: [{ name: 'Human' }],
          racesData: [{ name: 'Human' }],
          ruleset: '5e',
          onInputChange: vi.fn(),
        });
        expect(props).toEqual({
          formData: { race: { name: 'Human' } },
          errors: {},
          allRacesData: [{ name: 'Human' }],
          racesData: [{ name: 'Human' }],
          ruleset: '5e',
          onInputChange: expect.any(Function),
        });
      });
    });

    describe('Step 4 - Subrace getProps', () => {
      it('should return correct props object', () => {
        const step = getStepConfig(4);
        const props = step.getProps({
          formData: { race: { name: 'Dragonborn', subrace: { name: 'Red' } } },
          errors: {},
          allRacesData: [{ name: 'Dragonborn' }],
          racesData: [{ name: 'Dragonborn' }],
          ruleset: '5e',
          onInputChange: vi.fn(),
        });
        expect(props).toEqual({
          formData: { race: { name: 'Dragonborn', subrace: { name: 'Red' } } },
          errors: {},
          allRacesData: [{ name: 'Dragonborn' }],
          racesData: [{ name: 'Dragonborn' }],
          ruleset: '5e',
          onInputChange: expect.any(Function),
        });
      });
    });

    describe('Step 5 - Background getProps', () => {
      it('should return correct props object', () => {
        const step = getStepConfig(5);
        const props = step.getProps({
          formData: { background: 'Acolyte' },
          errors: {},
          backgrounds: [{ name: 'Acolyte' }],
          ruleset: '2024',
          onInputChange: vi.fn(),
        });
        expect(props).toEqual({
          formData: { background: 'Acolyte' },
          errors: {},
          backgrounds: [{ name: 'Acolyte' }],
          ruleset: '2024',
          onInputChange: expect.any(Function),
        });
      });
    });

    describe('Step 6 - Class getProps', () => {
      it('should return correct props object', () => {
        const step = getStepConfig(6);
        const props = step.getProps({
          formData: { class: { name: 'Fighter' } },
          errors: {},
          allClassesData: [{ name: 'Fighter' }],
          ruleset: '5e',
          onInputChange: vi.fn(),
        });
        expect(props).toEqual({
          formData: { class: { name: 'Fighter' } },
          errors: {},
          allClassesData: [{ name: 'Fighter' }],
          ruleset: '5e',
          onInputChange: expect.any(Function),
        });
      });
    });

    describe('Step 7 - Subclass / Major getProps', () => {
      it('should return correct props object', () => {
        const step = getStepConfig(7);
        const props = step.getProps({
          formData: { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } },
          errors: {},
          classSubtypes: [{ className: 'Fighter', subtypes: [{ name: 'Battle Master' }] }],
          ruleset: '5e',
          onInputChange: vi.fn(),
          allClassesData: [{ name: 'Fighter' }],
        });
        expect(props).toEqual({
          formData: { class: { name: 'Fighter', subclass: { name: 'Battle Master' } } },
          errors: {},
          classSubtypes: [{ className: 'Fighter', subtypes: [{ name: 'Battle Master' }] }],
          ruleset: '5e',
          onInputChange: expect.any(Function),
          allClassesData: [{ name: 'Fighter' }],
        });
      });
    });

    describe('Step 8 - Feats getProps', () => {
      it('should return correct props object', () => {
        const step = getStepConfig(8);
        const props = step.getProps({
          formData: {},
          allFeats: [{ name: 'Great Weapon Master' }],
          onArrayFieldChange: vi.fn(),
          preSelectedFeats: [],
          computedBuffs: {},
        });
        expect(props).toEqual({
          formData: {},
          allFeats: [{ name: 'Great Weapon Master' }],
          onArrayFieldChange: expect.any(Function),
          preSelectedFeats: [],
          computedBuffs: {},
        });
      });
    });

    describe('Step 9 - Ability Scores getProps', () => {
      it('should return correct props object with all aliased props', () => {
        const step = getStepConfig(9);
        const props = step.getProps({
          formData: {},
          errors: {},
          onAbilityBaseScoreChange: vi.fn(),
          onAbilityMiscIncreaseChange: vi.fn(),
          updateBackgroundIncrease: vi.fn(),
          backgroundAbilityNames: ['Strength'],
          backgroundAbilityAssignments: {},
          backgroundValidationWarnings: {},
          allFeats: [],
          featAbilityChoices: {},
          featAbilityAssignments: {},
          handleFeatAbilityChoice: vi.fn(),
        });
        expect(props).toEqual({
          formData: {},
          errors: {},
          onAbilityBaseScoreChange: expect.any(Function),
          onAbilityMiscIncreaseChange: expect.any(Function),
          onBackgroundIncreaseChange: expect.any(Function),
          backgroundAbilityChoices: ['Strength'],
          backgroundAbilityAssignments: {},
          backgroundValidationWarnings: {},
          allFeats: [],
          featAbilityChoices: {},
          featAbilityAssignments: {},
          onFeatAbilityChoiceChange: expect.any(Function),
        });
      });

      it('should map onBackgroundIncreaseChange to updateBackgroundIncrease param', () => {
        const step = getStepConfig(9);
        const mockFn = vi.fn();
        const props = step.getProps({
          updateBackgroundIncrease: mockFn,
        });
        expect(props.onBackgroundIncreaseChange).toBe(mockFn);
      });

      it('should map onFeatAbilityChoiceChange to handleFeatAbilityChoice param', () => {
        const step = getStepConfig(9);
        const mockFn = vi.fn();
        const props = step.getProps({
          handleFeatAbilityChoice: mockFn,
        });
        expect(props.onFeatAbilityChoiceChange).toBe(mockFn);
      });

      it('should map backgroundAbilityChoices to backgroundAbilityNames param', () => {
        const step = getStepConfig(9);
        const names = ['Dexterity', 'Constitution'];
        const props = step.getProps({
          backgroundAbilityNames: names,
        });
        expect(props.backgroundAbilityChoices).toBe(names);
      });
    });

    describe('Step 10 - Skill Proficiencies getProps', () => {
      it('should return correct props object', () => {
        const step = getStepConfig(10);
        const props = step.getProps({
          formData: {},
          errors: {},
          onSkillToggle: vi.fn(),
          onSkillExpertiseToggle: vi.fn(),
          skillLimits: {},
          expertiseLimits: {},
          warnings: [],
          preSelectedSkills: [],
        });
        expect(props).toEqual({
          formData: {},
          errors: {},
          onSkillToggle: expect.any(Function),
          onSkillExpertiseToggle: expect.any(Function),
          skillLimits: {},
          expertiseLimits: {},
          warnings: [],
          preSelectedSkills: [],
        });
      });
    });

    describe('Step 11 - Languages & Fighting Styles getProps', () => {
      it('should return correct props object with warnings alias', () => {
        const step = getStepConfig(11);
        const mockWarnings = ['Too many languages'];
        const props = step.getProps({
          formData: {},
          errors: {},
          onLanguageToggle: vi.fn(),
          onFightingStyleToggle: vi.fn(),
          languageLimits: {},
          fightingStyleLimits: {},
          languageWarnings: mockWarnings,
          preSelectedLanguages: [],
          preSelectedFightingStyles: [],
        });
        expect(props.warnings).toBe(mockWarnings);
        expect(props).toHaveProperty('preSelectedLanguages');
        expect(props).toHaveProperty('preSelectedFightingStyles');
      });
    });

    describe('Step 12 - Resistances & Immunities getProps', () => {
      it('should return correct props object with warnings alias', () => {
        const step = getStepConfig(12);
        const mockWarnings = ['Too many resistances'];
        const props = step.getProps({
          formData: {},
          onResistanceToggle: vi.fn(),
          onImmunityToggle: vi.fn(),
          resistanceWarnings: mockWarnings,
          preSelectedResistances: [],
          preSelectedImmunities: [],
        });
        expect(props.warnings).toBe(mockWarnings);
        expect(props).toHaveProperty('preSelectedResistances');
        expect(props).toHaveProperty('preSelectedImmunities');
      });
    });

    describe('Step 13 - Spells getProps', () => {
      it('should return correct props object', () => {
        const step = getStepConfig(13);
        const props = step.getProps({
          formData: {},
          allSpells: [{ name: 'Fireball' }],
          onArrayFieldChange: vi.fn(),
          preSelectedSpells: [],
        });
        expect(props).toEqual({
          formData: {},
          allSpells: [{ name: 'Fireball' }],
          onArrayFieldChange: expect.any(Function),
          preSelectedSpells: [],
        });
      });
    });

    describe('Step 14 - Magic Items getProps', () => {
      it('should return correct props object', () => {
        const step = getStepConfig(14);
        const props = step.getProps({
          formData: {},
          allMagicItems: [{ name: 'Ring of Protection' }],
          ruleset: '5e',
          classSubtypes: [],
          onArrayFieldChange: vi.fn(),
        });
        expect(props).toEqual({
          formData: {},
          allMagicItems: [{ name: 'Ring of Protection' }],
          ruleset: '5e',
          classSubtypes: [],
          onArrayFieldChange: expect.any(Function),
        });
      });
    });

    describe('Step 15 - Inventory getProps', () => {
      it('should return correct props object', () => {
        const step = getStepConfig(15);
        const props = step.getProps({
          formData: {},
          tempInventory: [],
          onInventoryChange: vi.fn(),
          onTempInventoryChange: vi.fn(),
        });
        expect(props).toEqual({
          formData: {},
          tempInventory: [],
          onInventoryChange: expect.any(Function),
          onTempInventoryChange: expect.any(Function),
        });
      });
    });

    describe('Step 16 - Special Actions getProps', () => {
      it('should return correct props object', () => {
        const step = getStepConfig(16);
        const props = step.getProps({
          formData: {},
          onArrayFieldChange: vi.fn(),
        });
        expect(props).toEqual({
          formData: {},
          onArrayFieldChange: expect.any(Function),
        });
      });
    });
  });
});
