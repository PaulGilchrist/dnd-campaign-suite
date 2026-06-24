// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => 0),
  },
}));

describe('spellCalc2024 - Order bonuses', () => {
  it('adds +1 cantrip for Cleric Divine Order Thaumaturge', () => {
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

    const result = getSpellAbilities([], playerStats);

    expect(result.cantrips_known).toBe(4);
    expect(result.spellCastingAbility).toBe('Wisdom');
    expect(result.modifier).toBe(2);
    expect(result.toHit).toBe(4);
    expect(result.saveDc).toBe(12);
  });

  it('does not add cantrip bonus for non-Thaumaturge Cleric', () => {
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

    const result = getSpellAbilities([], playerStats);

    expect(result.cantrips_known).toBe(3);
  });

  it('does not add cantrip bonus when class is not Cleric', () => {
    const playerStats = {
      level: 1,
      class: {
        name: 'Wizard',
        divineOrder: 'Thaumaturge',
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } },
        }],
        spell_casting_ability: 'Intelligence',
      },
      abilities: [{ name: 'Intelligence', baseScore: 16, bonus: 3 }],
      spells: [],
      proficiency: 2,
    };

    const result = getSpellAbilities([], playerStats);

    expect(result.cantrips_known).toBe(3);
  });

  it('adds +1 cantrip for Druid Primal Order Magician', () => {
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

    const result = getSpellAbilities([], playerStats);

    expect(result.cantrips_known).toBe(3);
    expect(result.spellCastingAbility).toBe('Wisdom');
  });

  it('does not add cantrip bonus when class is not Druid', () => {
    const playerStats = {
      level: 1,
      class: {
        name: 'Cleric',
        primalOrder: 'Magician',
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } },
        }],
        spell_casting_ability: 'Wisdom',
      },
      abilities: [{ name: 'Wisdom', baseScore: 14, bonus: 2 }],
      spells: [],
      proficiency: 2,
    };

    const result = getSpellAbilities([], playerStats);

    expect(result.cantrips_known).toBe(3);
  });

  it('applies both Thaumaturge and Magician bonuses when both conditions are present', () => {
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

    const result = getSpellAbilities([], playerStats);

    expect(result.cantrips_known).toBe(4);
  });
});

// ── Subclass (major) spells 2024 format ──

describe('spellCalc2024 - Subclass spells 2024', () => {

  it('adds subclass spells when level >= spellLevel', () => {
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

    const result = getSpellAbilities([], playerStats);

    expect(result.spells).toHaveLength(1);
    const burningHands = result.spells.find(s => s.name === 'Burning Hands');
    expect(burningHands).toBeDefined();
    expect(burningHands.prepared).toBe('Always');
  });

  it('does not add subclass spells when level <= 2', () => {
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

    const result = getSpellAbilities([], playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).not.toContain('Burning Hands');
    expect(result.spells).toHaveLength(0);
  });

  it('does not add subclass spells when level equals 2', () => {
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

    const result = getSpellAbilities([], playerStats);

    expect(result.spells).toHaveLength(0);
  });

  it('adds multiple subclass spells when level is sufficient for all', () => {
    const playerStats = {
      level: 5,
      class: {
        name: 'Wizard',
        major: {
          name: 'Evoker',
          spells: [
            { name: 'Burning Hands', level: 1 },
            { name: 'Lightning Bolt', level: 3 },
          ],
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

    const result = getSpellAbilities([], playerStats);

    expect(result.spells).toHaveLength(2);
    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).toContain('Burning Hands');
    expect(spellNames).toContain('Lightning Bolt');
    expect(result.spells[0].prepared).toBe('Always');
    expect(result.spells[1].prepared).toBe('Always');
  });

  it('does not add subclass spells with level higher than player level', () => {
    const playerStats = {
      level: 3,
      class: {
        name: 'Wizard',
        major: {
          name: 'Evoker',
          spells: [
            { name: 'Burning Hands', level: 1 },
            { name: 'Lightning Bolt', level: 3 },
            { name: 'Wall of Fire', level: 4 },
          ],
        },
        class_levels: [
          null, null, {
            spellcasting: { cantrips_known: 3, spell_slots: { '1': 4, '2': 3 } },
          },
        ],
        spell_casting_ability: 'Intelligence',
      },
      abilities: [{ name: 'Intelligence', baseScore: 16, bonus: 3 }],
      spells: [],
      proficiency: 2,
    };

    const result = getSpellAbilities([], playerStats);

    // At level 3, Burning Hands (level 1) and Lightning Bolt (level 3) are added,
    // but Wall of Fire (level 4) is not. The level > 2 gate allows the block to run.
    expect(result.spells).toHaveLength(2);
    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).toContain('Burning Hands');
    expect(spellNames).toContain('Lightning Bolt');
    expect(spellNames).not.toContain('Wall of Fire');
  });

  it('marks subclass spell as Always prepared when already in known spells', () => {
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
      spells: ['Burning Hands'],
      proficiency: 3,
    };

    const result = getSpellAbilities([], playerStats);

    expect(result.spells).toHaveLength(1);
    const burningHands = result.spells.find(s => s.name === 'Burning Hands');
    expect(burningHands.prepared).toBe('Always');
  });

  it('does not duplicate subclass spell when already known via major', () => {
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
      spells: ['Burning Hands'],
      proficiency: 3,
    };

    const result = getSpellAbilities([], playerStats);

    const burningHandsCount = result.spells.filter(s => s.name === 'Burning Hands').length;
    expect(burningHandsCount).toBe(1);
  });

  it('handles subclass spells with nested spell.name format', () => {
    const playerStats = {
      level: 5,
      class: {
        name: 'Wizard',
        major: {
          name: 'Evoker',
          spells: [{ spell: { name: 'Burning Hands' }, level: 1 }],
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

    const result = getSpellAbilities([], playerStats);

    expect(result.spells).toHaveLength(1);
    expect(result.spells[0].name).toBe('Burning Hands');
  });

  it('does not add subclass spells when major is missing', () => {
    const playerStats = {
      level: 5,
      class: {
        name: 'Wizard',
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

    const result = getSpellAbilities([], playerStats);

    expect(result.spells).toHaveLength(0);
  });
});

// ── Casting ability from major ──

describe('spellCalc2024 - Casting ability from major', () => {

  it('uses major.spell_casting_ability when class.spell_casting_ability is not set', () => {
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

    const result = getSpellAbilities([], playerStats);

    expect(result.spellCastingAbility).toBe('Intelligence');
    expect(result.modifier).toBe(3);
    expect(result.toHit).toBe(5);
    expect(result.saveDc).toBe(13);
  });

  it('prefers class.spell_casting_ability over major.spell_casting_ability', () => {
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

    const result = getSpellAbilities([], playerStats);

    expect(result.spellCastingAbility).toBe('Intelligence');
    expect(result.modifier).toBe(3);
  });

  it('falls back to 0 modifier when casting ability is not in abilities array', () => {
    const playerStats = {
      level: 1,
      class: {
        name: 'Wizard',
        major: {
          name: 'Order',
          spell_casting_ability: 'Charisma',
        },
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } },
        }],
      },
      abilities: [{ name: 'Intelligence', baseScore: 16, bonus: 3 }],
      spells: [],
      proficiency: 2,
    };

    const result = getSpellAbilities([], playerStats);

    expect(result.spellCastingAbility).toBe('Charisma');
    expect(result.modifier).toBe(0);
    expect(result.toHit).toBe(2);
    expect(result.saveDc).toBe(10);
  });

  it('uses major casting ability when class has none and abilities match major', () => {
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
      },
      abilities: [{ name: 'Wisdom', baseScore: 14, bonus: 2 }],
      spells: [],
      proficiency: 2,
    };

    const result = getSpellAbilities([], playerStats);

    expect(result.spellCastingAbility).toBe('Wisdom');
    expect(result.modifier).toBe(2);
  });
});

// ── Fey Reinforcements ──

describe('spellCalc2024 - Fey Reinforcements', () => {

  it('adds spells from fey_reinforcements passive', () => {
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

    const result = getSpellAbilities([], playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).toContain('Fire Bolt');
    expect(spellNames).toContain('Faerie Fire');
    expect(result.spells).toHaveLength(2);
  });

  it('adds multiple spells from fey_reinforcements array', () => {
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
          { type: 'fey_reinforcements', spell: ['Faerie Fire', 'Shield'] },
        ],
      },
    };

    const result = getSpellAbilities([], playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).toContain('Fire Bolt');
    expect(spellNames).toContain('Faerie Fire');
    expect(spellNames).toContain('Shield');
    expect(result.spells).toHaveLength(3);
  });

  it('does not duplicate fey_reinforcements spell already known', () => {
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
      spells: ['Faerie Fire'],
      proficiency: 2,
      automation: {
        passives: [
          { type: 'fey_reinforcements', spell: 'Faerie Fire' },
        ],
      },
    };

    const result = getSpellAbilities([], playerStats);

    const faerieFireCount = result.spells.filter(s => s.name === 'Faerie Fire').length;
    expect(faerieFireCount).toBe(1);
    expect(result.spells).toHaveLength(1);
  });

  it('does not add fey_reinforcements spells when feature is absent', () => {
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
    };

    const result = getSpellAbilities([], playerStats);

    expect(result.spells).toHaveLength(1);
    expect(result.spells[0].name).toBe('Fire Bolt');
  });

  it('adds fey_reinforcements from automation bonusActions', () => {
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
        bonusActions: [
          { type: 'fey_reinforcements', spell: 'Shield' },
        ],
      },
    };

    const result = getSpellAbilities([], playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).toContain('Fire Bolt');
    expect(spellNames).toContain('Shield');
    expect(result.spells).toHaveLength(2);
  });
});

// ── Spell Breaker ──

describe('spellCalc2024 - Spell Breaker', () => {

  it('adds spells from spell_breaker feature', () => {
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

    const result = getSpellAbilities([], playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).toContain('Fire Bolt');
    expect(spellNames).toContain('Counterspell');
    expect(result.spells).toHaveLength(2);
  });

  it('does not duplicate spell_breaker spell already known', () => {
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
      spells: ['Counterspell'],
      proficiency: 2,
      automation: {
        actions: [
          { type: 'spell_breaker', alwaysPreparedSpells: ['Counterspell'] },
        ],
      },
    };

    const result = getSpellAbilities([], playerStats);

    const counterspellCount = result.spells.filter(s => s.name === 'Counterspell').length;
    expect(counterspellCount).toBe(1);
    expect(result.spells).toHaveLength(1);
  });

  it('adds multiple spells from spell_breaker alwaysPreparedSpells', () => {
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
          { type: 'spell_breaker', alwaysPreparedSpells: ['Counterspell', 'Dispel Magic'] },
        ],
      },
    };

    const result = getSpellAbilities([], playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).toContain('Fire Bolt');
    expect(spellNames).toContain('Counterspell');
    expect(spellNames).toContain('Dispel Magic');
    expect(result.spells).toHaveLength(3);
  });

  it('does not add spell_breaker spells when alwaysPreparedSpells is empty', () => {
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
          { type: 'spell_breaker', alwaysPreparedSpells: [] },
        ],
      },
    };

    const result = getSpellAbilities([], playerStats);

    expect(result.spells).toHaveLength(1);
    expect(result.spells[0].name).toBe('Fire Bolt');
  });

  it('does not add spell_breaker spells when feature is absent', () => {
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
    };

    const result = getSpellAbilities([], playerStats);

    expect(result.spells).toHaveLength(1);
    expect(result.spells[0].name).toBe('Fire Bolt');
  });
});

// ── Phantasmal Creatures ──

describe('spellCalc2024 - Phantasmal Creatures', () => {

  it('adds Summon Beast and Summon Fey from phantasmal_creatures passive', () => {
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

    const result = getSpellAbilities([], playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).toContain('Fire Bolt');
    expect(spellNames).toContain('Summon Beast');
    expect(spellNames).toContain('Summon Fey');
    expect(result.spells).toHaveLength(3);
  });

  it('does not duplicate phantasmal_creatures spells already known', () => {
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
      spells: ['Summon Beast'],
      proficiency: 2,
      automation: {
        passives: [
          { type: 'phantasmal_creatures', alwaysPreparedSpells: ['Summon Beast', 'Summon Fey'] },
        ],
      },
    };

    const result = getSpellAbilities([], playerStats);

    const summonBeastCount = result.spells.filter(s => s.name === 'Summon Beast').length;
    expect(summonBeastCount).toBe(1);
    expect(result.spells).toHaveLength(2);
  });

  it('does not add phantasmal_creatures spells when alwaysPreparedSpells is empty', () => {
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
          { type: 'phantasmal_creatures' },
        ],
      },
    };

    const result = getSpellAbilities([], playerStats);

    expect(result.spells).toHaveLength(1);
    expect(result.spells[0].name).toBe('Fire Bolt');
  });

  it('does not add phantasmal_creatures spells when feature is absent', () => {
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
    };

    const result = getSpellAbilities([], playerStats);

    expect(result.spells).toHaveLength(1);
    expect(result.spells[0].name).toBe('Fire Bolt');
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
    expect(result.spells).toHaveLength(2);
  });

  it('adds Minor Illusion with casting_time from allSpells when already known', () => {
    const allSpells = [
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
      spells: ['Minor Illusion'],
      proficiency: 2,
      automation: {
        passives: [{ type: 'improved_illusions' }],
      },
    };

    const result = getSpellAbilities(allSpells, playerStats);

    expect(result.spells).toHaveLength(1);
    const minorIllusion = result.spells.find(s => s.name === 'Minor Illusion');
    expect(minorIllusion.casting_time).toBe('1 action');
  });

  it('preserves casting_time when Minor Illusion already has bonus action', () => {
    const allSpells = [
      { name: 'Minor Illusion', level: 0, casting_time: '1 bonus action', range: '30 feet' },
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
      spells: ['Minor Illusion'],
      proficiency: 2,
      automation: {
        passives: [{ type: 'improved_illusions' }],
      },
    };

    const result = getSpellAbilities(allSpells, playerStats);

    expect(result.spells).toHaveLength(1);
    const minorIllusion = result.spells.find(s => s.name === 'Minor Illusion');
    expect(minorIllusion.casting_time).toBe('1 bonus action');
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

  it('does not add Minor Illusion when allSpells is empty', () => {
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

    const result = getSpellAbilities([], playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).not.toContain('Minor Illusion');
    expect(result.spells).toHaveLength(1);
  });

  it('does not add Minor Illusion when feature is absent', () => {
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
    };

    const result = getSpellAbilities(allSpells, playerStats);

    const spellNames = result.spells.map(s => s.name);
    expect(spellNames).not.toContain('Minor Illusion');
    expect(result.spells).toHaveLength(1);
  });
});
