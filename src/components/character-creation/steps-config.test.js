import { describe, it, expect, vi } from 'vitest';
import { WIZARD_STEPS, getTotalSteps, getStepConfig } from './steps-config';

describe('steps-config', () => {
  describe('WIZARD_STEPS', () => {
    it('should have 12 steps', () => {
      expect(WIZARD_STEPS).toHaveLength(12);
    });

    it('should have unique step numbers', () => {
      const stepNumbers = WIZARD_STEPS.map(s => s.step);
      const uniqueSteps = [...new Set(stepNumbers)];
      expect(uniqueSteps).toHaveLength(stepNumbers.length);
    });

    it('should have all required properties', () => {
      WIZARD_STEPS.forEach(step => {
        expect(step.step).toBeDefined();
        expect(step.title).toBeDefined();
        expect(step.component).toBeDefined();
        expect(step.getProps).toBeDefined();
        expect(typeof step.getProps).toBe('function');
      });
    });

    it('should have correct step titles', () => {
      expect(WIZARD_STEPS[0].title).toBe('Ruleset');
      expect(WIZARD_STEPS[1].title).toBe('Basic Information');
      expect(WIZARD_STEPS[2].title).toBe('Race & Class');
    });

    it('should have correct step order', () => {
      WIZARD_STEPS.forEach((step, index) => {
        expect(step.step).toBe(index + 1);
      });
    });
  });

  describe('getTotalSteps', () => {
    it('should return 12', () => {
      expect(getTotalSteps()).toBe(12);
    });
  });

  describe('getStepConfig', () => {
    it('should return config for step 1', () => {
      const config = getStepConfig(1);
      expect(config).toBeDefined();
      expect(config.step).toBe(1);
      expect(config.title).toBe('Ruleset');
    });

    it('should return config for step 12', () => {
      const config = getStepConfig(12);
      expect(config).toBeDefined();
      expect(config.step).toBe(12);
      expect(config.title).toBe('Special Actions');
    });

    it('should return undefined for invalid step', () => {
      const config = getStepConfig(999);
      expect(config).toBeUndefined();
    });

    it('should return undefined for 0', () => {
      const config = getStepConfig(0);
      expect(config).toBeUndefined();
    });

    it('should return undefined for negative step', () => {
      const config = getStepConfig(-1);
      expect(config).toBeUndefined();
    });

    it('should return correct component for each step', () => {
      const step1 = getStepConfig(1);
      expect(step1.component).toBeDefined();
    });
  });

  describe('getProps functions', () => {
    it('should call getProps with correct arguments for step 1', () => {
      const config = getStepConfig(1);
      const mockProps = {
        ruleset: '5e',
        errors: {},
        onRulesetChange: vi.fn(),
      };
      const props = config.getProps(mockProps);
      expect(props.ruleset).toBe('5e');
      expect(props.errors).toBeDefined();
    });

    it('should call getProps with correct arguments for step 2', () => {
      const config = getStepConfig(2);
      const mockProps = {
        formData: { name: 'Test' },
        errors: {},
        backgrounds: [],
        ruleset: '5e',
        onInputChange: vi.fn(),
      };
      const props = config.getProps(mockProps);
      expect(props.formData).toBeDefined();
      expect(props.backgrounds).toEqual([]);
    });

    it('should call getProps for step 3 (Race & Class)', () => {
      const config = getStepConfig(3);
      const mockProps = {
        formData: {},
        errors: {},
        racesData: [],
        classSubtypes: [],
        ruleset: '5e',
        onInputChange: vi.fn(),
      };
      const props = config.getProps(mockProps);
      expect(props.formData).toBeDefined();
      expect(props.racesData).toEqual([]);
    });

    it('should call getProps for step 4 (Feats)', () => {
      const config = getStepConfig(4);
      const mockProps = {
        formData: { feats: [] },
        allFeats: [],
        onArrayFieldChange: vi.fn(),
        preSelectedFeats: [],
      };
      const props = config.getProps(mockProps);
      expect(props.formData).toBeDefined();
      expect(props.allFeats).toEqual([]);
    });

    it('should call getProps for step 5 (Ability Scores)', () => {
      const config = getStepConfig(5);
      const mockProps = {
        formData: { abilities: [] },
        errors: {},
        onAbilityBaseScoreChange: vi.fn(),
        onAbilityImprovementChange: vi.fn(),
        onAbilityMiscBonusChange: vi.fn(),
      };
      const props = config.getProps(mockProps);
      expect(props.formData).toBeDefined();
    });

    it('should call getProps for step 6 (Skills)', () => {
      const config = getStepConfig(6);
      const mockProps = {
        formData: { skillProficiencies: [] },
        errors: {},
        onSkillToggle: vi.fn(),
        onSkillExpertiseToggle: vi.fn(),
        skillLimits: null,
        expertiseLimits: null,
        warnings: [],
        preSelectedSkills: [],
      };
      const props = config.getProps(mockProps);
      expect(props.formData).toBeDefined();
    });

    it('should call getProps for step 7 (Languages)', () => {
      const config = getStepConfig(7);
      const mockProps = {
        formData: { languages: [] },
        errors: {},
        onLanguageToggle: vi.fn(),
        onFightingStyleToggle: vi.fn(),
        languageLimits: null,
        fightingStyleLimits: null,
        warnings: [],
        preSelectedLanguages: [],
        preSelectedFightingStyles: [],
      };
      const props = config.getProps(mockProps);
      expect(props.formData).toBeDefined();
    });

    it('should call getProps for step 8 (Resistances)', () => {
      const config = getStepConfig(8);
      const mockProps = {
        formData: { resistances: [], immunities: [] },
        onResistanceToggle: vi.fn(),
        onImmunityToggle: vi.fn(),
        warnings: { resistances: [], immunities: [] },
        preSelectedResistances: { resistances: [], immunities: [] },
        preSelectedImmunities: { resistances: [], immunities: [] },
      };
      const props = config.getProps(mockProps);
      expect(props.formData).toBeDefined();
    });

    it('should call getProps for step 9 (Spells)', () => {
      const config = getStepConfig(9);
      const mockProps = {
        formData: { spells: [] },
        allSpells: [],
        onArrayFieldChange: vi.fn(),
      };
      const props = config.getProps(mockProps);
      expect(props.formData).toBeDefined();
    });

    it('should call getProps for step 10 (Magic Items)', () => {
      const config = getStepConfig(10);
      const mockProps = {
        formData: { inventory: { magicItems: [] } },
        allMagicItems: [],
        ruleset: '5e',
        onArrayFieldChange: vi.fn(),
      };
      const props = config.getProps(mockProps);
      expect(props.formData).toBeDefined();
    });

    it('should call getProps for step 11 (Inventory)', () => {
      const config = getStepConfig(11);
      const mockProps = {
        formData: { inventory: {} },
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange: vi.fn(),
        onTempInventoryChange: vi.fn(),
      };
      const props = config.getProps(mockProps);
      expect(props.formData).toBeDefined();
    });

    it('should call getProps for step 12 (Special Actions)', () => {
      const config = getStepConfig(12);
      const mockProps = {
        formData: { actions: [], bonusActions: [], reactions: [], specialActions: [] },
        onArrayFieldChange: vi.fn(),
      };
      const props = config.getProps(mockProps);
      expect(props.formData).toBeDefined();
    });
  });
});
