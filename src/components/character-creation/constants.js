export { default as CharacterCreationWizard } from './character-creation-wizard';
export { default as WizardHeader } from './wizard-header';
export { default as WizardProgressBar } from './wizard-progress-bar';
export { default as WizardFooter } from './wizard-footer';
export { default as WizardStepRules } from './wizard-step-rules';
export { default as WizardStepBasic } from './wizard-step-basic';
export { default as WizardStepRaceClass } from './wizard-step-race-class';
export { default as WizardStepAbilities } from './wizard-step-abilities';
export { default as WizardStepSkills } from './wizard-step-skills';
export { default as WizardStepLanguages } from './wizard-step-languages';
export { default as WizardStepInventory } from './wizard-step-inventory';
export { default as WizardStepSpecial } from './wizard-step-special';
export { default as WizardStepResistances } from './wizard-step-resistances';
export { default as WizardStepMagicItems } from './wizard-step-magic-items';

export const REQUIRED_FIELDS = [
        'name',
        'level',
     'alignment',
     'race',
     'class',
     'abilities',
     'inventory',
     'skillProficiencies',
     'expertSkills',
 ];

// POINT_BUY_COSTS is now loaded from public/data/rules-validation.json
// Use getPointBuyCosts() from utils.js instead

export const DEFAULT_FORM_DATA = {
    name: '',
    level: 1,
    alignment: 'True Neutral',
    abilities: ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'].map((name) => ({
        name,
        baseScore: 8,
        abilityImprovements: 0,
        miscBonus: 0,
      })),
    background: '',
    class: {
        name: 'Fighter',
        subclass: { name: '' },
      },
    expertSkills: [],
    feats: [],
    fightingStyles: [],
    race: { name: 'Human', subrace: { name: '' } },
    immunities: [],
    inventory: {
        backpack: [],
        equipped: [],
        gold: 10,
        magicItems: [],
      },
    languages: [],
    resistances: [],
    skillProficiencies: [],
    specialActions: [],
    spells: [],
    rules: '5e',
};
