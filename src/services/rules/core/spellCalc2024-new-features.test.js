import { describe, it, expect } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

// ── Order Bonuses ──

describe('spellCalc2024 - Order bonuses', () => {
  it('adds +1 cantrip for Cleric Divine Order Thaumaturge', () => {
    const allSpells = [{ name: 'Fire Bolt', level: 0, casting_time: '1 action' }];
    const playerStats = {
      level: 1,
      class: {
        name: 'Cleric',
        divineOrder: 'Thaumaturge',
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } },
        }],
        spell_casting_ability: 'Wisdom',
      },
      abilities: [{ name: 'Wisdom', baseScore: 14, bonus: 2 }],
      spells: ['Fire Bolt'],
      proficiency: 2,
    };

    const result = getSpellAbilities(allSpells, playerStats);

    expect(result.cantrips_known).toBe(4);
  });

  it('does not add cantrip for non-Thaumaturge Cleric', () => {
    const allSpells = [{ name: 'Fire Bolt', level: 0, casting_time: '1 action' }];
    const playerStats = {
      level: 1,
      class: {
        name: 'Cleric',
        divineOrder: 'Protector',
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } },
        }],
        spell_casting_ability: 'Wisdom',
      },
      abilities: [{ name: 'Wisdom', baseScore: 14, bonus: 2 }],
      spells: ['Fire Bolt'],
      proficiency: 2,
    };

    const result = getSpellAbilities(allSpells, playerStats);

    expect(result.cantrips_known).toBe(3);
  });

  it('adds +1 cantrip for Druid Primal Order Magician', () => {
    const allSpells = [{ name: 'Druidcraft', level: 0, casting_time: '1 action' }];
    const playerStats = {
      level: 1,
      class: {
        name: 'Druid',
        primalOrder: 'Magician',
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 2, spell_slots: { '1': 2 } },
        }],
        spell_casting_ability: 'Wisdom',
      },
      abilities: [{ name: 'Wisdom', baseScore: 14, bonus: 2 }],
      spells: ['Druidcraft'],
      proficiency: 2,
    };

    const result = getSpellAbilities(allSpells, playerStats);

    expect(result.cantrips_known).toBe(3);
  });
});

// ── Subclass (major) spells 2024 format ──

describe('spellCalc2024 - Subclass spells 2024', () => {
  it('adds subclass spells with {name, level} format when level >= spellLevel', () => {
    const allSpells = [{ name: 'Burning Hands', level: 1, casting_time: '1 action' }];
    const playerStats = {
      level: 5,
      class: {
        name: 'Wizard',
        major: {
          name: 'Evoker',
          spells: [{ name: 'Burning Hands', level: 1 }],
        },
        class_levels: [
          null, null, null, null, {
            spellcasting: { cantrips_known: 3, spell_slots: { '1': 4 } },
          },
        ],
        spell_casting_ability: 'Intelligence',
      },
      abilities: [{ name: 'Intelligence', baseScore: 16, bonus: 3 }],
      spells: [],
      proficiency: 3,
    };

    const result = getSpellAbilities(allSpells, playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).toContain('Burning Hands');
    const burningHands = result.spells.find(s => s.name === 'Burning Hands');
    expect(burningHands.prepared).toBe('Always');
  });

  it('does not add subclass spells when level <= 2', () => {
    const allSpells = [{ name: 'Burning Hands', level: 1, casting_time: '1 action' }];
    const playerStats = {
      level: 2,
      class: {
        name: 'Wizard',
        major: {
          name: 'Evoker',
          spells: [{ name: 'Burning Hands', level: 1 }],
        },
        class_levels: [
          null, {
            spellcasting: { cantrips_known: 3, spell_slots: { '1': 3 } },
          },
        ],
        spell_casting_ability: 'Intelligence',
      },
      abilities: [{ name: 'Intelligence', baseScore: 16, bonus: 3 }],
      spells: [],
      proficiency: 2,
    };

    const result = getSpellAbilities(allSpells, playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).not.toContain('Burning Hands');
  });
});

// ── Casting ability from major ──

describe('spellCalc2024 - Casting ability from major', () => {
  it('uses major.spell_casting_ability when class.spell_casting_ability is not set', () => {
    const allSpells = [{ name: 'Fire Bolt', level: 0, casting_time: '1 action' }];
    const playerStats = {
      level: 1,
      class: {
        name: 'Wizard',
        major: {
          name: 'Order',
          spell_casting_ability: 'Intelligence',
        },
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } },
        }],
      },
      abilities: [{ name: 'Intelligence', baseScore: 16, bonus: 3 }],
      spells: ['Fire Bolt'],
      proficiency: 2,
    };

    const result = getSpellAbilities(allSpells, playerStats);

    expect(result.spellCastingAbility).toBe('Intelligence');
    expect(result.modifier).toBe(3);
  });

  it('prefers class.spell_casting_ability over major.spell_casting_ability', () => {
    const allSpells = [{ name: 'Fire Bolt', level: 0, casting_time: '1 action' }];
    const playerStats = {
      level: 1,
      class: {
        name: 'Wizard',
        major: {
          name: 'Order',
          spell_casting_ability: 'Wisdom',
        },
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } },
        }],
        spell_casting_ability: 'Intelligence',
      },
      abilities: [{ name: 'Intelligence', baseScore: 16, bonus: 3 }],
      spells: ['Fire Bolt'],
      proficiency: 2,
    };

    const result = getSpellAbilities(allSpells, playerStats);

    expect(result.spellCastingAbility).toBe('Intelligence');
  });
});

// ── Fey Reinforcements ──

describe('spellCalc2024 - Fey Reinforcements', () => {
  it('adds spells from fey_reinforcements feature', () => {
    const allSpells = [
      { name: 'Fire Bolt', level: 0, casting_time: '1 action' },
      { name: 'Faerie Fire', level: 1, casting_time: '1 action' },
    ];
    const playerStats = {
      level: 1,
      class: {
        name: 'Sorcerer',
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 4, spell_slots: { '1': 2 } },
        }],
        spell_casting_ability: 'Charisma',
      },
      abilities: [{ name: 'Charisma', baseScore: 16, bonus: 3 }],
      spells: ['Fire Bolt'],
      proficiency: 2,
      automation: {
        passives: [
          { type: 'fey_reinforcements', spell: 'Faerie Fire' },
        ],
      },
    };

    const result = getSpellAbilities(allSpells, playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).toContain('Fire Bolt');
    expect(spellNames).toContain('Faerie Fire');
  });
});

// ── Spell Breaker ──

describe('spellCalc2024 - Spell Breaker', () => {
  it('adds spells from spell_breaker feature', () => {
    const allSpells = [
      { name: 'Fire Bolt', level: 0, casting_time: '1 action' },
      { name: 'Counterspell', level: 1, casting_time: '1 reaction' },
    ];
    const playerStats = {
      level: 1,
      class: {
        name: 'Wizard',
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } },
        }],
        spell_casting_ability: 'Intelligence',
      },
      abilities: [{ name: 'Intelligence', baseScore: 16, bonus: 3 }],
      spells: ['Fire Bolt'],
      proficiency: 2,
      automation: {
        actions: [
          { type: 'spell_breaker', alwaysPreparedSpells: ['Counterspell'] },
        ],
      },
    };

    const result = getSpellAbilities(allSpells, playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).toContain('Fire Bolt');
    expect(spellNames).toContain('Counterspell');
  });
});

// ── Phantasmal Creatures ──

describe('spellCalc2024 - Phantasmal Creatures', () => {
  it('adds Summon Beast and Summon Fey from phantasmal_creatures passive', () => {
    const allSpells = [{ name: 'Fire Bolt', level: 0, casting_time: '1 action' }];
    const playerStats = {
      level: 1,
      class: {
        name: 'Wizard',
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } },
        }],
        spell_casting_ability: 'Intelligence',
      },
      abilities: [{ name: 'Intelligence', baseScore: 16, bonus: 3 }],
      spells: ['Fire Bolt'],
      proficiency: 2,
      automation: {
        passives: [
          { type: 'phantasmal_creatures', alwaysPreparedSpells: ['Summon Beast', 'Summon Fey'] },
        ],
      },
    };

    const result = getSpellAbilities(allSpells, playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).toContain('Fire Bolt');
    expect(spellNames).toContain('Summon Beast');
    expect(spellNames).toContain('Summon Fey');
  });
});

// ── Improved Illusions ──

describe('spellCalc2024 - Improved Illusions', () => {
  it('adds Minor Illusion when Improved Illusions is present and spell not known', () => {
    const allSpells = [
      { name: 'Fire Bolt', level: 0, casting_time: '1 action' },
      { name: 'Minor Illusion', level: 0, casting_time: '1 action', range: '30 feet' },
    ];
    const playerStats = {
      level: 1,
      class: {
        name: 'Wizard',
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } },
        }],
        spell_casting_ability: 'Intelligence',
      },
      abilities: [{ name: 'Intelligence', baseScore: 16, bonus: 3 }],
      spells: ['Fire Bolt'],
      proficiency: 2,
      automation: {
        passives: [{ type: 'improved_illusions' }],
      },
    };

    const result = getSpellAbilities(allSpells, playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).toContain('Fire Bolt');
    expect(spellNames).toContain('Minor Illusion');
  });

  it('does not add Minor Illusion when allSpells is null', () => {
    const playerStats = {
      level: 1,
      class: {
        name: 'Wizard',
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } },
        }],
        spell_casting_ability: 'Intelligence',
      },
      abilities: [{ name: 'Intelligence', baseScore: 16, bonus: 3 }],
      spells: [],
      proficiency: 2,
      automation: {
        passives: [{ type: 'improved_illusions' }],
      },
    };

    const result = getSpellAbilities(null, playerStats);

    expect(result.spells).toHaveLength(0);
  });
});
