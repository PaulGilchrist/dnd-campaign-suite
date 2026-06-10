import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  it('returns true when npc has armorClass of zero', () => {
    expect(npcHasStatBlock({ armorClass: 0 })).toBe(true);
  });

  it('returns true when npc has negative armorClass', () => {
    expect(npcHasStatBlock({ armorClass: -5 })).toBe(true);
  });

  it('returns a falsy value when npc is null', () => {
    expect(npcHasStatBlock(null)).toBeFalsy();
   });

  it('returns a falsy value when npc is undefined', () => {
    expect(npcHasStatBlock(undefined)).toBeFalsy();
   });

  it('returns false when npc is an empty object', () => {
    expect(npcHasStatBlock({})).toBe(false);
  });

  it('returns false when armorClass is a string', () => {
    expect(npcHasStatBlock({ armorClass: '15' })).toBe(false);
  });

  it('returns false when armorClass is undefined', () => {
    expect(npcHasStatBlock({ armorClass: undefined })).toBe(false);
  });

  it('returns a falsy value when npc is 0, empty string, or boolean false', () => {
     // npc && typeof … short-circuits to the falsy value itself
    expect(npcHasStatBlock(0)).toBeFalsy();
    expect(npcHasStatBlock('')).toBeFalsy();
    expect(npcHasStatBlock(false)).toBeFalsy();
   });
});

// ===================================================================
// calculateAbilityModifier
// ===================================================================
describe('calculateAbilityModifier', () => {
  it('returns -5 for score 1', () => {
    expect(calculateAbilityModifier(1)).toBe(-5);
  });

  it('returns the correct modifier for score 4', () => {
      // Math.floor((4-10)/2) = Math.floor(-3) = -3
    expect(calculateAbilityModifier(4)).toBe(-3);
   });

  it('returns the correct modifier for score 5', () => {
      // Math.floor((5-10)/2) = Math.floor(-2.5) = -3
    expect(calculateAbilityModifier(5)).toBe(-3);
   });

  it('returns the correct modifier for score 10', () => {
    expect(calculateAbilityModifier(10)).toBe(0);
  });

  it('returns the correct modifier for score 11', () => {
    expect(calculateAbilityModifier(11)).toBe(0);
  });

  it('returns 1 for score 12', () => {
    expect(calculateAbilityModifier(12)).toBe(1);
  });

  it('returns -5 for score 0', () => {
    // floor((0-10)/2) = floor(-5) = -5
    expect(calculateAbilityModifier(0)).toBe(-5);
  });

  it('uses Math.floor so odd scores round down', () => {
    // Score 9: floor((9-10)/2) = floor(-0.5) = -1
    expect(calculateAbilityModifier(9)).toBe(-1);
    // Score 3: floor((3-10)/2) = floor(-3.5) = -4
    expect(calculateAbilityModifier(3)).toBe(-4);
  });

  it('handles high scores', () => {
    expect(calculateAbilityModifier(20)).toBe(5);
    expect(calculateAbilityModifier(21)).toBe(5);
    expect(calculateAbilityModifier(22)).toBe(6);
  });

  it('handles negative scores', () => {
    // floor((-1-10)/2) = floor(-11/2) = floor(-5.5) = -6
    expect(calculateAbilityModifier(-1)).toBe(-6);
  });
});

// ===================================================================
// findNPCByName
// ===================================================================
describe('findNPCByName', () => {
  const npcWithStats = makeNPC();
  const npcNoStats = { name: 'Bandit' }; // no armorClass

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

  it('returns the matching NPC by exact name (case-insensitive)', () => {
    const result = findNPCByName('Test NPC', [npcWithStats]);
    expect(result).toBe(npcWithStats);
  });

  it('is case-insensitive for matching', () => {
    expect(findNPCByName('test npc', [npcWithStats])).toBe(npcWithStats);
    expect(findNPCByName('TEST NPC', [npcWithStats])).toBe(npcWithStats);
    expect(findNPCByName('TeSt NpC', [npcWithStats])).toBe(npcWithStats);
  });

  it('strips trailing numeric suffix from search name', () => {
    const result = findNPCByName('Test NPC 123', [npcWithStats]);
    expect(result).toBe(npcWithStats);
  });

  it('strips multiple space-number groups at end', () => {
    // The regex \s+\d+$ matches trailing whitespace+digits once
    // "Test NPC  42" -> baseName = "Test NPC" (the spaces before 42 are captured)
    const result = findNPCByName('Test NPC  42', [npcWithStats]);
    expect(result).toBe(npcWithStats);
  });

  it('does not strip non-trailing numbers', () => {
    // "Goblin 5" — baseName becomes "Goblin" only if " 5" is trailing
    const goblin = makeNPC({ name: 'Goblin' });
    expect(findNPCByName('Goblin 5', [goblin])).toBe(goblin);

    // "123 Bandit" — regex \s+\d+$ won't match, no strip
    const numbered = makeNPC({ name: '123 Bandit' });
    expect(findNPCByName('123 Bandit', [numbered])).toBe(numbered);
  });

  it('skips NPCs without stat blocks', () => {
    const result = findNPCByName('Bandit', [npcNoStats]);
    expect(result).toBeNull();
  });

  it('finds the correct NPC when one has stats and another does not', () => {
    const result = findNPCByName('Test NPC', [npcNoStats, npcWithStats]);
    expect(result).toBe(npcWithStats);
  });

  it('returns null when no NPC matches', () => {
    expect(findNPCByName('Nonexistent', [npcWithStats])).toBeNull();
  });

  it('returns the first matching NPC with stats', () => {
    const npc1 = makeNPC({ name: 'Guard' });
    const npc2 = makeNPC({ name: 'Guard' });
    expect(findNPCByName('Guard', [npc1, npc2])).toBe(npc1);
  });

  it('handles NPC with undefined or missing name property', () => {
    const noNameNpc = { ...npcWithStats, name: undefined };
    expect(findNPCByName('Test NPC', [noNameNpc])).toBeNull();
  });
});

// ===================================================================
// npcToMonsterFormat
// ===================================================================
describe('npcToMonsterFormat', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // --- Null / undefined input ---
  it('returns null when npc is null', () => {
    expect(npcToMonsterFormat(null)).toBeNull();
  });

  it('returns null when npc is undefined', () => {
    expect(npcToMonsterFormat(undefined)).toBeNull();
  });

  // --- Defaults ---
  it('uses default values for missing fields', () => {
    const npc = { armorClass: 10 };
    const monster = npcToMonsterFormat(npc);
    expect(monster.name).toBe('Unknown');
    expect(monster.size).toBe('Medium');
    expect(monster.type).toBe('NPC'); // classRole not provided
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

  it('uses provided name', () => {
    const npc = makeNPC({ name: 'Orc Warrior' });
    expect(npcToMonsterFormat(npc).name).toBe('Orc Warrior');
  });

  it('uses provided size', () => {
    const npc = makeNPC({ size: 'Large' });
    expect(npcToMonsterFormat(npc).size).toBe('Large');
  });

  it('uses classRole as type, defaults to NPC', () => {
    const npc1 = makeNPC({ classRole: 'Cleric' });
    expect(npcToMonsterFormat(npc1).type).toBe('Cleric');

    const npc2 = { armorClass: 10 }; // no classRole
    expect(npcToMonsterFormat(npc2).type).toBe('NPC');
  });

  // --- Ability scores ---
  it('uses provided abilityScores', () => {
    const npc = makeNPC();
    const monster = npcToMonsterFormat(npc);
    expect(monster.ability_scores.str).toBe(16);
    expect(monster.ability_scores.dex).toBe(14);
    expect(monster.ability_scores.con).toBe(12);
  });

  it('defaults ability scores to all 10 when not provided', () => {
    const npc = { armorClass: 10 }; // no abilityScores
    const monster = npcToMonsterFormat(npc);
    expect(monster.ability_scores).toEqual({
      str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    });
  });

  it('calculates ability_score_modifiers from abilityScores', () => {
    const npc = makeNPC();
    const monster = npcToMonsterFormat(npc);
    // str 16 -> +3, dex 14 -> +2, con 12 -> +1, int 10 -> 0, wis 8 -> -1, cha 18 -> +4
    expect(monster.ability_score_modifiers).toEqual({
      str: 3, dex: 2, con: 1, int: 0, wis: -1, cha: 4,
    });
  });

  it('calculates modifiers correctly from default scores (all 10)', () => {
    const npc = { armorClass: 5 };
    const monster = npcToMonsterFormat(npc);
    // All scores are 10, so all modifiers should be 0
    expect(monster.ability_score_modifiers).toEqual({
      str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0,
    });
  });

  // --- Saving throws ---
  it('includes saving throws with defined bonuses', () => {
    const npc = makeNPC({ savingThrowBonuses: { str: 3, con: 1 } });
    const monster = npcToMonsterFormat(npc);
    expect(monster.saving_throws.str).toEqual({ modifier: 3 });
    expect(monster.saving_throws.con).toEqual({ modifier: 1 });
    // dex should NOT be present (no saving throw bonus defined)
    expect(Object.prototype.hasOwnProperty.call(monster.saving_throws, 'dex')).toBe(false);
  });

  it('excludes saving throws with undefined or null bonuses', () => {
    const npc = makeNPC({
      savingThrowBonuses: { str: undefined, dex: null },
    });
    expect(Object.keys(npcToMonsterFormat(npc).saving_throws)).toEqual([]);
  });

  it('excludes saving throws with empty string bonuses', () => {
    const npc = makeNPC({ savingThrowBonuses: { str: '' } });
    expect(Object.keys(npcToMonsterFormat(npc).saving_throws)).toEqual([]);
  });

  it('converts saving throw bonus to number via Number()', () => {
    const npc = makeNPC({ savingThrowBonuses: { int: '2' } });
    const monster = npcToMonsterFormat(npc);
    expect(monster.saving_throws.int.modifier).toBe(2);
    expect(typeof monster.saving_throws.int.modifier).toBe('number');
  });

  // --- Skills ---
  it('includes skills with defined bonuses', () => {
    const npc = makeNPC({ skillBonuses: { Stealth: 4, Perception: 2 } });
    const monster = npcToMonsterFormat(npc);
    expect(monster.skills.Stealth).toEqual({ modifier: 4 });
    expect(monster.skills.Perception).toEqual({ modifier: 2 });
  });

  it('excludes skills with undefined, null, or empty string bonuses', () => {
    const npc = makeNPC({ skillBonuses: { Acrobatics: undefined, Athletics: null, History: '' } });
    expect(Object.keys(npcToMonsterFormat(npc).skills)).toEqual([]);
  });

  it('converts skill bonus values to numbers via Number()', () => {
    const npc = makeNPC({ skillBonuses: { Insight: '-1' } });
    const monster = npcToMonsterFormat(npc);
    expect(monster.skills.Insight.modifier).toBe(-1);
  });

  it('omits skills and saving_throws when not provided on npc', () => {
    const npc = { armorClass: 10 }; // no skillBonuses, no savingThrowBonuses
    const monster = npcToMonsterFormat(npc);
    expect(monster.skills).toEqual({});
    expect(monster.saving_throws).toEqual({});
  });

  // --- Initiative ---
  it('includes initiative_details for a positive bonus', () => {
    const npc = makeNPC({ initiativeBonus: 5 });
    expect(npcToMonsterFormat(npc).initiative_details).toBe('+5');
  });

  it('includes initiative_details for a negative bonus without plus sign', () => {
    const npc = makeNPC({ initiativeBonus: -3 });
    expect(npcToMonsterFormat(npc).initiative_details).toBe('-3');
  });

  it('includes initiative_details for zero bonus', () => {
    const npc = makeNPC({ initiativeBonus: 0 });
    expect(npcToMonsterFormat(npc).initiative_details).toBe('+0');
  });

  it('omits initiative_details when bonus is undefined, null, or empty string', () => {
    expect(npcToMonsterFormat(makeNPC({ initiativeBonus: undefined })).initiative_details).toBeNull();
    expect(npcToMonsterFormat(makeNPC({ initiativeBonus: null })).initiative_details).toBeNull();
    expect(npcToMonsterFormat(makeNPC({ initiativeBonus: '' })).initiative_details).toBeNull();
  });

  it('formats initiative_details for string bonus input', () => {
    const npc = makeNPC({ initiativeBonus: '4' });
    expect(npcToMonsterFormat(npc).initiative_details).toBe('+4');
  });

  // --- Armor class ---
  it('uses the numeric armorClass directly', () => {
    const npc = makeNPC({ armorClass: 18 });
    expect(npcToMonsterFormat(npc).armor_class).toBe(18);
  });

  it('defaults AC to 10 and logs a console.error when armorClass is not a number', () => {
    const npc = { name: 'Broken NPC', armorClass: undefined };
    const monster = npcToMonsterFormat(npc);
    expect(monster.armor_class).toBe(10);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[AC] NPC "Broken NPC" has no armorClass defined. Defaulting to 10.'
    );
  });

  it('does not log console.error when armorClass is a valid number', () => {
    npcToMonsterFormat(makeNPC({ armorClass: 15 }));
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // --- Passive perception ---
  it('computes passive_perception from wis modifier + 10', () => {
    const npc = makeNPC({ abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 } });
    // wis 14 -> modifier +2, passive = 10 + 2 = 12
    expect(npcToMonsterFormat(npc).senses.passive_perception).toBe(12);
  });

  it('defaults passive_perception to 10 when wis modifier is 0', () => {
    const npc = makeNPC({ abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
    // wis 10 -> modifier 0, passive = 10 + 0 = 10
    expect(npcToMonsterFormat(npc).senses.passive_perception).toBe(10);
  });

  it('handles negative wisdom modifier for passive perception', () => {
    const npc = makeNPC({ abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 6, cha: 10 } });
    // wis 6 -> modifier -2, passive = 10 + (-2) = 8
    expect(npcToMonsterFormat(npc).senses.passive_perception).toBe(8);
  });

  // --- Damage immunities / resistances / condition immunities ---
  it('forwards damageResistances', () => {
    const npc = makeNPC({ damageResistances: ['cold', 'fire'] });
    expect(npcToMonsterFormat(npc).damage_resistances).toEqual(['cold', 'fire']);
  });

  it('defaults damage_resistances to empty array', () => {
    const npc = { armorClass: 10 };
    expect(npcToMonsterFormat(npc).damage_resistances).toEqual([]);
  });

  it('forwards damageImmunities', () => {
    const npc = makeNPC({ damageImmunities: ['psychic'] });
    expect(npcToMonsterFormat(npc).damage_immunities).toEqual(['psychic']);
  });

  it('defaults damage_immunities to empty array', () => {
    const npc = { armorClass: 10 };
    expect(npcToMonsterFormat(npc).damage_immunities).toEqual([]);
  });

  it('forwards conditionImmunities', () => {
    const npc = makeNPC({ conditionImmunities: ['charmed', 'poisoned'] });
    expect(npcToMonsterFormat(npc).condition_immunities).toEqual(['charmed', 'poisoned']);
  });

  it('defaults condition_immunities to empty array', () => {
    const npc = { armorClass: 10 };
    expect(npcToMonsterFormat(npc).condition_immunities).toEqual([]);
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
    const npc = { armorClass: 10 };
    const monster = npcToMonsterFormat(npc);
    expect(monster.traits).toEqual([]);
    expect(monster.actions).toEqual([]);
    expect(monster.reactions).toEqual([]);
  });

  // --- hitPoints, hitDice, speed ---
  it('forwards hitPoints and hitDice', () => {
    const npc = makeNPC({ hitPoints: 50, hitDice: '10d8' });
    const monster = npcToMonsterFormat(npc);
    expect(monster.hit_points).toBe(50);
    expect(monster.hit_dice).toBe('10d8');
  });

  it('defaults hit_points to empty string when not provided', () => {
    const npc = { armorClass: 10 };
    expect(npcToMonsterFormat(npc).hit_points).toBe('');
    expect(npcToMonsterFormat(npc).hit_dice).toBe('');
  });

  it('uses default speed when not provided', () => {
    const npc = { armorClass: 10 };
    expect(npcToMonsterFormat(npc).speed).toEqual({ walk: '30 ft.' });
  });

  it('forwards custom speed object', () => {
    const npc = makeNPC({ speed: { walk: '40 ft.', fly: '30 ft.' } });
    expect(npcToMonsterFormat(npc).speed).toEqual({ walk: '40 ft.', fly: '30 ft.' });
  });

  // --- Full integration test ---
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
    expect(monster.ability_score_modifiers.dex).toBe(3); // 16 -> +3
    expect(monster.saving_throws.dex.modifier).toBe(4);
    expect(monster.skills.Stealth.modifier).toBe(5);
    expect(monster.skills.Perception.modifier).toBe(2);
    expect(monster.damage_resistances).toEqual(['cold']);
    expect(monster.traits).toEqual([{ name: 'Darkvision' }]);
    expect(monster.actions).toEqual([{ name: 'Shortsword' }]);
    expect(monster.reactions).toEqual([]);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // --- NPC with no name but has armorClass ---
  it('handles an NPC with undefined name', () => {
    const npc = { armorClass: 10, name: undefined };
    const monster = npcToMonsterFormat(npc);
    expect(monster.name).toBe('Unknown');
  });

   // --- Edge case: armorClass is NaN (typeof NaN === 'number' in JS) ---
  it('passes through NaN armorClass without logging (typeof NaN === "number")', () => {
      // In JavaScript, typeof NaN === 'number', so the ternary takes the true branch
    const npc = { name: 'NaN NPC', armorClass: NaN };
    const monster = npcToMonsterFormat(npc);
    expect(Number.isNaN(monster.armor_class)).toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
   });

   // --- Edge case: armorClass is a string despite the type guard ---
  it('defaults AC to 10 and logs when armorClass is a string', () => {
    const npc = { name: 'String AC NPC', armorClass: '15' };
    const monster = npcToMonsterFormat(npc);
    expect(monster.armor_class).toBe(10);
    expect(consoleErrorSpy).toHaveBeenCalled();
   });
});
