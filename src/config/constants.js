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
    xp: 0,
    xpMode: 'milestone',
};
