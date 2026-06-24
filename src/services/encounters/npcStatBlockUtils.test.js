// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';
import {
  findNPCByName,
  npcHasStatBlock,
  calculateAbilityModifier,
  npcToMonsterFormat,
} from './npcStatBlockUtils.js';

// ---- Helper fixtures ----
function makeNPC(overrides = {}) {
  return {
    name: 'Test NPC',
    armorClass: 15,
    hitPoints: 20,
    hitDice: '4d8',
    speed: { walk: '30 ft.' },
    size: 'Medium',
    classRole: 'Warrior',
    abilityScores: {
      str: 16,
      dex: 14,
      con: 12,
      int: 10,
      wis: 8,
      cha: 18,
    },
    savingThrowBonuses: {},
    skillBonuses: {},
    initiativeBonus: undefined,
    damageResistances: [],
    damageImmunities: [],
    conditionImmunities: [],
    traits: [],
    actions: [],
    reactions: [],
    ...overrides,
  };
}

// ===================================================================
// npcHasStatBlock
// ===================================================================
describe('npcHasStatBlock', () => {
  it('returns true when npc has a numeric armorClass', () => {
    expect(npcHasStatBlock({ armorClass: 15 })).toBe(true);
  });

  it('returns true for zero or negative armorClass', () => {
    expect(npcHasStatBlock({ armorClass: 0 })).toBe(true);
    expect(npcHasStatBlock({ armorClass: -5 })).toBe(true);
  });

  it('returns false for non-numeric armorClass types', () => {
    expect(npcHasStatBlock({ armorClass: '15' })).toBe(false);
    expect(npcHasStatBlock({ armorClass: undefined })).toBe(false);
    expect(npcHasStatBlock({ armorClass: null })).toBe(false);
    expect(npcHasStatBlock({})).toBe(false);
  });

  it('returns false when npc is falsy', () => {
    expect(npcHasStatBlock(null)).toBeFalsy();
    expect(npcHasStatBlock(undefined)).toBeFalsy();
    expect(npcHasStatBlock(0)).toBeFalsy();
    expect(npcHasStatBlock('')).toBeFalsy();
    expect(npcHasStatBlock(false)).toBeFalsy();
  });
});

// ===================================================================
// calculateAbilityModifier
// ===================================================================
describe('calculateAbilityModifier', () => {
  it('returns the correct modifier for standard ability scores', () => {
    // D&D standard scores: floor((score - 10) / 2)
    expect(calculateAbilityModifier(1)).toBe(-5);
    expect(calculateAbilityModifier(3)).toBe(-4);
    expect(calculateAbilityModifier(4)).toBe(-3);
    expect(calculateAbilityModifier(5)).toBe(-3);
    expect(calculateAbilityModifier(8)).toBe(-1);
    expect(calculateAbilityModifier(9)).toBe(-1);
    expect(calculateAbilityModifier(10)).toBe(0);
    expect(calculateAbilityModifier(11)).toBe(0);
    expect(calculateAbilityModifier(12)).toBe(1);
    expect(calculateAbilityModifier(14)).toBe(2);
    expect(calculateAbilityModifier(16)).toBe(3);
    expect(calculateAbilityModifier(18)).toBe(4);
    expect(calculateAbilityModifier(20)).toBe(5);
  });

  it('rounds down via Math.floor for odd scores and negatives', () => {
    // Score 0: floor(-5) = -5
    expect(calculateAbilityModifier(0)).toBe(-5);
    // Score 21: floor(5.5) = 5
    expect(calculateAbilityModifier(21)).toBe(5);
    // Score 22: floor(6) = 6
    expect(calculateAbilityModifier(22)).toBe(6);
    // Negative score: floor(-5.5) = -6
    expect(calculateAbilityModifier(-1)).toBe(-6);
  });
});

// ===================================================================
// findNPCByName
// ===================================================================
describe('findNPCByName', () => {
  const npcWithStats = makeNPC();
  const npcNoStats = { name: 'Bandit' };

  it('returns null when npcName is falsy', () => {
    expect(findNPCByName(null, [npcWithStats])).toBeNull();
    expect(findNPCByName(undefined, [npcWithStats])).toBeNull();
    expect(findNPCByName('', [npcWithStats])).toBeNull();
  });

  it('returns null when npcs is falsy or empty', () => {
    expect(findNPCByName('Test NPC', null)).toBeNull();
    expect(findNPCByName('Test NPC', undefined)).toBeNull();
    expect(findNPCByName('Test NPC', [])).toBeNull();
  });

  it('finds an NPC by exact name match (case-insensitive)', () => {
    expect(findNPCByName('Test NPC', [npcWithStats])).toBe(npcWithStats);
    expect(findNPCByName('test npc', [npcWithStats])).toBe(npcWithStats);
    expect(findNPCByName('TEST NPC', [npcWithStats])).toBe(npcWithStats);
    expect(findNPCByName('TeSt NpC', [npcWithStats])).toBe(npcWithStats);
  });

  it('strips trailing numeric suffix from search name', () => {
    expect(findNPCByName('Test NPC 123', [npcWithStats])).toBe(npcWithStats);
    expect(findNPCByName('Test NPC  42', [npcWithStats])).toBe(npcWithStats);
  });

  it('does not strip non-trailing numbers from search name', () => {
    const numbered = makeNPC({ name: '123 Bandit' });
    expect(findNPCByName('123 Bandit', [numbered])).toBe(numbered);
  });

  it('returns the first matching NPC with a stat block', () => {
    const npc1 = makeNPC({ name: 'Guard' });
    const npc2 = makeNPC({ name: 'Guard' });
    expect(findNPCByName('Guard', [npc1, npc2])).toBe(npc1);
  });

  it('skips NPCs without stat blocks', () => {
    expect(findNPCByName('Bandit', [npcNoStats])).toBeNull();
    expect(findNPCByName('Test NPC', [npcNoStats, npcWithStats])).toBe(npcWithStats);
  });

  it('returns null when no NPC matches', () => {
    expect(findNPCByName('Nonexistent', [npcWithStats])).toBeNull();
  });

  it('returns null when NPC has undefined or missing name', () => {
    const noNameNpc = { ...npcWithStats, name: undefined };
    expect(findNPCByName('Test NPC', [noNameNpc])).toBeNull();
  });
});

// ===================================================================
// npcToMonsterFormat
// ===================================================================
describe('npcToMonsterFormat', () => {
  // --- Null / undefined input ---
  it('returns null when npc is null or undefined', () => {
    expect(npcToMonsterFormat(null)).toBeNull();
    expect(npcToMonsterFormat(undefined)).toBeNull();
  });

  // --- Identity defaults ---
  it('returns correct defaults for minimal NPC', () => {
    const npc = { armorClass: 10 };
    const monster = npcToMonsterFormat(npc);

    expect(monster.name).toBe('Unknown');
    expect(monster.size).toBe('Medium');
    expect(monster.type).toBe('NPC');
    expect(monster.subtype).toBeNull();
    expect(monster.alignment).toBe('Unaligned');
    expect(monster.languages).toBe('');
    expect(monster.damage_vulnerabilities).toEqual([]);
    expect(monster.challenge_rating).toBeNull();
    expect(monster.xp).toBeNull();
    expect(monster.legendary_resistance).toBeNull();
    expect(monster.legendary_actions).toEqual([]);
    expect(monster.lair_actions).toBeNull();
    expect(monster.regional_effects).toBeNull();
    expect(monster.desc).toBeNull();
  });

  // --- Named fields ---
  it('forwards custom name, size, and classRole', () => {
    const npc = makeNPC({ name: 'Orc Warrior', size: 'Large', classRole: 'Cleric' });
    const monster = npcToMonsterFormat(npc);
    expect(monster.name).toBe('Orc Warrior');
    expect(monster.size).toBe('Large');
    expect(monster.type).toBe('Cleric');
  });

  // --- Ability scores & modifiers ---
  it('forwards abilityScores and calculates modifiers', () => {
    const npc = makeNPC();
    const monster = npcToMonsterFormat(npc);
    expect(monster.ability_scores).toEqual({ str: 16, dex: 14, con: 12, int: 10, wis: 8, cha: 18 });
    expect(monster.ability_score_modifiers).toEqual({ str: 3, dex: 2, con: 1, int: 0, wis: -1, cha: 4 });
  });

  it('defaults ability scores to all 10 when not provided', () => {
    const npc = { armorClass: 10 };
    const monster = npcToMonsterFormat(npc);
    expect(monster.ability_scores).toEqual({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
    expect(monster.ability_score_modifiers).toEqual({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
  });

  // --- Saving throws ---
  it('includes saving throws with defined numeric bonuses', () => {
    const npc = makeNPC({ savingThrowBonuses: { str: 3, con: 1 } });
    const monster = npcToMonsterFormat(npc);
    expect(monster.saving_throws.str).toEqual({ modifier: 3 });
    expect(monster.saving_throws.con).toEqual({ modifier: 1 });
    expect(monster.saving_throws.dex).toBeUndefined();
  });

  it('excludes saving throws with undefined, null, or empty string bonuses', () => {
    const npc = makeNPC({ savingThrowBonuses: { str: undefined, dex: null, con: '' } });
    expect(Object.keys(npcToMonsterFormat(npc).saving_throws)).toEqual([]);
  });

  it('converts saving throw bonus string values to numbers', () => {
    const npc = makeNPC({ savingThrowBonuses: { int: '2' } });
    expect(npcToMonsterFormat(npc).saving_throws.int.modifier).toBe(2);
  });

  it('omits saving_throws key when no bonuses provided', () => {
    const monster = npcToMonsterFormat({ armorClass: 10 });
    expect(monster.saving_throws).toEqual({});
  });

  // --- Skills ---
  it('includes skills with defined numeric bonuses', () => {
    const npc = makeNPC({ skillBonuses: { Stealth: 4, Perception: 2 } });
    const monster = npcToMonsterFormat(npc);
    expect(monster.skills.Stealth).toEqual({ modifier: 4 });
    expect(monster.skills.Perception).toEqual({ modifier: 2 });
  });

  it('excludes skills with undefined, null, or empty string bonuses', () => {
    const npc = makeNPC({ skillBonuses: { Acrobatics: undefined, Athletics: null, History: '' } });
    expect(Object.keys(npcToMonsterFormat(npc).skills)).toEqual([]);
  });

  it('converts skill bonus string values to numbers', () => {
    const npc = makeNPC({ skillBonuses: { Insight: '-1' } });
    expect(npcToMonsterFormat(npc).skills.Insight.modifier).toBe(-1);
  });

  it('omits skills key when no bonuses provided', () => {
    const monster = npcToMonsterFormat({ armorClass: 10 });
    expect(monster.skills).toEqual({});
  });

  // --- Initiative ---
  it('formats initiative_details for positive, zero, and negative bonuses', () => {
    expect(npcToMonsterFormat(makeNPC({ initiativeBonus: 5 })).initiative_details).toBe('+5');
    expect(npcToMonsterFormat(makeNPC({ initiativeBonus: 0 })).initiative_details).toBe('+0');
    expect(npcToMonsterFormat(makeNPC({ initiativeBonus: -3 })).initiative_details).toBe('-3');
  });

  it('handles string initiative bonus input', () => {
    expect(npcToMonsterFormat(makeNPC({ initiativeBonus: '4' })).initiative_details).toBe('+4');
  });

  it('omits initiative_details for undefined, null, or empty string bonuses', () => {
    expect(npcToMonsterFormat(makeNPC({ initiativeBonus: undefined })).initiative_details).toBeNull();
    expect(npcToMonsterFormat(makeNPC({ initiativeBonus: null })).initiative_details).toBeNull();
    expect(npcToMonsterFormat(makeNPC({ initiativeBonus: '' })).initiative_details).toBeNull();
  });

  // --- Armor class ---
  it('uses numeric armorClass directly', () => {
    expect(npcToMonsterFormat(makeNPC({ armorClass: 18 })).armor_class).toBe(18);
  });

  it('defaults AC to 10 and logs an error when armorClass is not a number', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const npc = { name: 'Broken NPC', armorClass: undefined };
    const monster = npcToMonsterFormat(npc);
    expect(monster.armor_class).toBe(10);
    expect(spy).toHaveBeenCalledWith(
      '[AC] NPC "Broken NPC" has no armorClass defined. Defaulting to 10.'
    );
    spy.mockRestore();
  });

  it('does not log when armorClass is a valid number', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    npcToMonsterFormat(makeNPC({ armorClass: 15 }));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('passes through NaN armorClass without logging', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const npc = { name: 'NaN NPC', armorClass: NaN };
    const monster = npcToMonsterFormat(npc);
    expect(Number.isNaN(monster.armor_class)).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  // --- Passive perception ---
  it('computes passive_perception from wis modifier + 10', () => {
    const npc = makeNPC({ abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 } });
    expect(npcToMonsterFormat(npc).senses.passive_perception).toBe(12);
  });

  it('handles negative wisdom modifier for passive perception', () => {
    const npc = makeNPC({ abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 6, cha: 10 } });
    expect(npcToMonsterFormat(npc).senses.passive_perception).toBe(8);
  });

  // --- Damage / condition immunities and resistances ---
  it('forwards damage and condition arrays, defaults to empty', () => {
    const npc = makeNPC({
      damageResistances: ['cold', 'fire'],
      damageImmunities: ['psychic'],
      conditionImmunities: ['charmed', 'poisoned'],
    });
    const monster = npcToMonsterFormat(npc);
    expect(monster.damage_resistances).toEqual(['cold', 'fire']);
    expect(monster.damage_immunities).toEqual(['psychic']);
    expect(monster.condition_immunities).toEqual(['charmed', 'poisoned']);
  });

  it('defaults damage and condition arrays to empty when not provided', () => {
    const monster = npcToMonsterFormat({ armorClass: 10 });
    expect(monster.damage_resistances).toEqual([]);
    expect(monster.damage_immunities).toEqual([]);
    expect(monster.condition_immunities).toEqual([]);
  });

  // --- Traits, actions, reactions ---
  it('forwards traits, actions, and reactions arrays', () => {
    const npc = makeNPC({
      traits: [{ name: 'Keen Sense' }],
      actions: [{ name: 'Slash' }],
      reactions: [{ name: 'Opportunity Attack' }],
    });
    const monster = npcToMonsterFormat(npc);
    expect(monster.traits).toEqual([{ name: 'Keen Sense' }]);
    expect(monster.actions).toEqual([{ name: 'Slash' }]);
    expect(monster.reactions).toEqual([{ name: 'Opportunity Attack' }]);
  });

  it('defaults traits, actions, reactions to empty arrays', () => {
    const monster = npcToMonsterFormat({ armorClass: 10 });
    expect(monster.traits).toEqual([]);
    expect(monster.actions).toEqual([]);
    expect(monster.reactions).toEqual([]);
  });

  // --- HP, hit dice, speed ---
  it('forwards hitPoints and hitDice', () => {
    const npc = makeNPC({ hitPoints: 50, hitDice: '10d8' });
    const monster = npcToMonsterFormat(npc);
    expect(monster.hit_points).toBe(50);
    expect(monster.hit_dice).toBe('10d8');
  });

  it('defaults hit_points and hit_dice to empty string', () => {
    const monster = npcToMonsterFormat({ armorClass: 10 });
    expect(monster.hit_points).toBe('');
    expect(monster.hit_dice).toBe('');
  });

  it('forwards custom speed object', () => {
    const npc = makeNPC({ speed: { walk: '40 ft.', fly: '30 ft.' } });
    expect(npcToMonsterFormat(npc).speed).toEqual({ walk: '40 ft.', fly: '30 ft.' });
  });

  it('defaults speed to { walk: "30 ft." }', () => {
    expect(npcToMonsterFormat({ armorClass: 10 }).speed).toEqual({ walk: '30 ft.' });
  });

  // --- NPC with undefined name ---
  it('defaults name to "Unknown" when npc.name is undefined', () => {
    const monster = npcToMonsterFormat({ armorClass: 10, name: undefined });
    expect(monster.name).toBe('Unknown');
  });

  // --- Full integration ---
  it('produces a complete monster object from a full NPC', () => {
    const npc = makeNPC({
      name: 'Dark Elf Rogue',
      size: 'Small',
      classRole: 'Rogue',
      armorClass: 14,
      hitPoints: 27,
      hitDice: '6d8',
      speed: { walk: '30 ft.' },
      abilityScores: { str: 8, dex: 16, con: 12, int: 14, wis: 10, cha: 12 },
      savingThrowBonuses: { dex: 4 },
      skillBonuses: { Stealth: 5, Perception: 2 },
      initiativeBonus: 3,
      damageResistances: ['cold'],
      damageImmunities: [],
      conditionImmunities: [],
      traits: [{ name: 'Darkvision' }],
      actions: [{ name: 'Shortsword' }],
      reactions: [],
    });

    const monster = npcToMonsterFormat(npc);

    expect(monster.name).toBe('Dark Elf Rogue');
    expect(monster.size).toBe('Small');
    expect(monster.type).toBe('Rogue');
    expect(monster.subtype).toBeNull();
    expect(monster.alignment).toBe('Unaligned');
    expect(monster.armor_class).toBe(14);
    expect(monster.hit_points).toBe(27);
    expect(monster.hit_dice).toBe('6d8');
    expect(monster.speed.walk).toBe('30 ft.');
    expect(monster.initiative_details).toBe('+3');
    expect(monster.ability_scores.dex).toBe(16);
    expect(monster.ability_score_modifiers.dex).toBe(3);
    expect(monster.saving_throws.dex.modifier).toBe(4);
    expect(monster.skills.Stealth.modifier).toBe(5);
    expect(monster.skills.Perception.modifier).toBe(2);
    expect(monster.damage_resistances).toEqual(['cold']);
    expect(monster.traits).toEqual([{ name: 'Darkvision' }]);
    expect(monster.actions).toEqual([{ name: 'Shortsword' }]);
    expect(monster.reactions).toEqual([]);
  });
});
