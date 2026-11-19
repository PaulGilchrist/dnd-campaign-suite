/**
 * Authored defaults for the wizard's Quick Build path (quickBuildService.js).
 *
 * These tables hold ONLY what the rules JSON does not carry:
 *  - ability-score template arrays (point-buy-legal: every row is a
 *    permutation of {15,14,13,12,10,8} = exactly 27 points at 8–15 base,
 *    the cap rules-validation.json declares for both rulesets);
 *  - each class's primary ability (used to bias skill/top-up picks);
 *  - 2024 background defaults (the Background step needs one before the
 *    class is even picked, so the wizard prefills and the draft refines);
 *  - 5e starting equipment (public/data/classes.json carries no
 *    starting_equipment field; 2024 classes DO and the service parses
 *    that instead of using this table).
 *
 * Equipment names here reference REAL public/data/equipment.json entries.
 */

// Order of the six slots: [Str, Dex, Con, Int, Wis, Cha] — matches
// DEFAULT_FORM_DATA.abilities order in src/config/constants.js.
export const QUICK_BUILD_ABILITY_TEMPLATES = {
  Barbarian: { '5e': [15, 14, 13, 8, 12, 10], '2024': [15, 14, 13, 8, 12, 10] },
  Bard: { '5e': [8, 14, 13, 12, 10, 15], '2024': [8, 14, 13, 12, 10, 15] },
  Cleric: { '5e': [13, 8, 14, 10, 15, 12], '2024': [13, 8, 14, 10, 15, 12] },
  Druid: { '5e': [10, 12, 14, 13, 15, 8], '2024': [10, 12, 14, 13, 15, 8] },
  Fighter: { '5e': [15, 14, 13, 10, 12, 8], '2024': [15, 14, 13, 10, 12, 8] },
  Monk: { '5e': [10, 15, 13, 8, 14, 12], '2024': [10, 15, 13, 8, 14, 12] },
  Paladin: { '5e': [15, 10, 13, 8, 12, 14], '2024': [15, 10, 13, 8, 12, 14] },
  Ranger: { '5e': [13, 15, 12, 8, 14, 10], '2024': [13, 15, 12, 8, 14, 10] },
  Rogue: { '5e': [10, 15, 14, 12, 13, 8], '2024': [10, 15, 14, 12, 13, 8] },
  Sorcerer: { '5e': [8, 13, 14, 10, 12, 15], '2024': [8, 13, 14, 10, 12, 15] },
  Warlock: { '5e': [8, 12, 14, 10, 13, 15], '2024': [8, 12, 14, 10, 13, 15] },
  Wizard: { '5e': [8, 13, 14, 15, 12, 10], '2024': [8, 13, 14, 15, 12, 10] },
};

// Keyed by class name — used to bias "skill of your choice" top-ups and
// expertise picks toward the class's main ability.
export const QUICK_BUILD_PRIMARY_ABILITY = {
  Barbarian: 'Strength',
  Bard: 'Charisma',
  Cleric: 'Wisdom',
  Druid: 'Wisdom',
  Fighter: 'Strength',
  Monk: 'Dexterity',
  Paladin: 'Charisma',
  Ranger: 'Dexterity',
  Rogue: 'Dexterity',
  Sorcerer: 'Charisma',
  Warlock: 'Charisma',
  Wizard: 'Intelligence',
};

// 2024-only: the Background step (5) gates Next before the Class step (6)
// runs, so the wizard prefills QUICK_BUILD_GENERIC_BACKGROUND_2024 and the
// draft refines to the class-appropriate pick once the class is known.
// Chosen to avoid config-modal feats (Magic Initiate / Fey Touched).
export const QUICK_BUILD_BACKGROUNDS_2024 = {
  Barbarian: 'Soldier',
  Bard: 'Entertainer',
  Cleric: 'Hermit',
  Druid: 'Farmer',
  Fighter: 'Guard',
  Monk: 'Sailor',
  Paladin: 'Noble',
  Ranger: 'Farmer',
  Rogue: 'Criminal',
  Sorcerer: 'Entertainer',
  Warlock: 'Hermit',
  Wizard: 'Noble',
};

export const QUICK_BUILD_GENERIC_BACKGROUND_2024 = 'Guard';

// Priority order for deterministic fighting-style picks when the class
// grants styles at level 1 (Fighter/Paladin in 5e, Fighter et al. in 2024).
// All names exist in public/data/fighting-styles.json.
export const QUICK_BUILD_FIGHTING_STYLE_PRIORITY = [
  'Defense',
  'Dueling',
  'Great Weapon Fighting',
  'Protection',
  'Archery',
  'Thrown Weapon Fighting',
  'Two-Weapon Fighting',
  'Unarmed Fighting',
  'Interception',
];

// 5e starting equipment (public/data/classes.json has no starting_equipment
// field). Names verified against public/data/equipment.json; `quantity`
// entries land in inventory.itemMeta so the sheet renders ×N.
export const QUICK_BUILD_STARTING_EQUIPMENT_5E = {
  Barbarian: {
    equipped: [{ name: 'Greataxe' }, { name: 'Handaxe', quantity: 2 }],
    backpack: [{ name: 'Javelin', quantity: 4 }, { name: "Explorer's Pack" }],
  },
  Bard: {
    equipped: [{ name: 'Rapier' }, { name: 'Dagger', quantity: 2 }],
    backpack: [{ name: "Diplomat's Pack" }, { name: 'Lute' }],
  },
  Cleric: {
    equipped: [{ name: 'Mace' }, { name: 'Scale Mail' }, { name: 'Shield' }],
    backpack: [{ name: "Priest's Pack" }, { name: 'Holy Water' }],
  },
  Druid: {
    equipped: [{ name: 'Leather' }, { name: 'Shield' }, { name: 'Scimitar' }, { name: 'Wooden staff' }],
    backpack: [{ name: "Explorer's Pack" }],
  },
  Fighter: {
    equipped: [{ name: 'Chain Mail' }, { name: 'Longsword' }, { name: 'Shield' }, { name: 'Javelin', quantity: 4 }],
    backpack: [{ name: "Dungeoneer's Pack" }],
  },
  Monk: {
    equipped: [{ name: 'Shortsword' }, { name: 'Quarterstaff' }, { name: 'Dart', quantity: 10 }],
    backpack: [{ name: "Dungeoneer's Pack" }],
  },
  Paladin: {
    equipped: [{ name: 'Chain Mail' }, { name: 'Longsword' }, { name: 'Shield' }, { name: 'Javelin', quantity: 5 }],
    backpack: [{ name: "Priest's Pack" }, { name: 'Holy Water' }],
  },
  Ranger: {
    equipped: [{ name: 'Studded Leather' }, { name: 'Longbow' }, { name: 'Arrow', quantity: 20 }, { name: 'Shortsword', quantity: 2 }],
    backpack: [{ name: "Explorer's Pack" }],
  },
  Rogue: {
    equipped: [{ name: 'Leather' }, { name: 'Dagger', quantity: 2 }, { name: 'Shortsword' }],
    backpack: [{ name: "Thieves' Tools" }, { name: "Burglar's Pack" }],
  },
  Sorcerer: {
    equipped: [{ name: 'Dagger', quantity: 2 }],
    backpack: [{ name: 'Component pouch' }, { name: "Dungeoneer's Pack" }, { name: 'Crystal' }],
  },
  Warlock: {
    equipped: [{ name: 'Leather' }, { name: 'Dagger', quantity: 2 }],
    backpack: [{ name: "Scholar's Pack" }, { name: 'Component pouch' }],
  },
  Wizard: {
    equipped: [{ name: 'Quarterstaff' }, { name: 'Dagger', quantity: 2 }],
    backpack: [{ name: 'Spellbook' }, { name: 'Component pouch' }, { name: "Scholar's Pack" }],
  },
};

// Fuzzy-name repair for the free-text 2024 `starting_equipment` strings,
// mapping to real equipment.json names ('Leather Armor' → 'Leather', …).
export const QUICK_BUILD_EQUIPMENT_NAME_FIXES = {
  'Leather Armor': 'Leather',
  'Studded Leather Armor': 'Studded Leather',
  'Robe': 'Robes',
  'Musical Instrument': 'Lute',
  "Artisan's Tools": "Carpenter's Tools",
  'Handaxes': 'Handaxe',
  'Daggers': 'Dagger',
  'Javelins': 'Javelin',
  'Arrows': 'Arrow',
  'Holy Symbol': 'Holy Symbol',
};
