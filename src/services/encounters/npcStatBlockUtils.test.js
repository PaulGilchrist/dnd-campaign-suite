// @maintained-by-ai
// Lane: custom-NPC combat-readiness guards + NPC→monster stat-block byte contract.
//
// OWNED HERE (other lanes cite, do not re-drive):
//   - npcHasStatBlock / npcHasAttacks guard matrix — npcCombatService.test.js mocks
//     these (seam only), NPCListItem.test.jsx cites "guard matrix lives elsewhere".
//   - npcToMonsterFormat output bytes — createNpcClickHandler-npc-path.test.jsx:48
//     explicitly routes the formatter's bytes here; monsterUtils.test.js mocks the
//     formatter. getMonsterData's local-vs-bestiary resolution (#1078) relies on
//     these bytes for the CUSTOM-NPC leg (AGENTS.md: npcs.json is CUSTOM NPCs only).
//   - Initiative *assembly* is NOT here: initiativeService.test.js #1079 (real rollD20
//     seam), encounterToInitiative.test.js #1078 (assembly byte contract),
//     combatData.test.js #1074 (campaign-key-miss → null).
//
// Fixtures are production-shaped per NPCStatBlockForm.js: AC arrives as a parsed
// number (null when blank), save/skill bonuses arrive as RAW STRINGS, traits and
// reactions are textarea STRINGS, resistances are trimmed arrays, and objects carry
// junk keys (id/race/tags/imagePath) that the formatter must not forward.
//
// Old → new map (35 tests → 12):
//   npcHasStatBlock ×3            → one branch table
//   npcHasAttacks ×2              → one branch table
//   calculateAbilityModifier      → it.each score/mod pairs (parity boundaries kept)
//   findNPCByName ×7              → one lookup table (tautological non-trailing-digit
//                                   leg replaced with real falsifier: 'Bandit' vs npc
//                                   named '123 Bandit' must miss)
//   full-integration + forwards ×9 (name/size/type, abilityScores, defaults, immunities,
//     traits/actions, hitPoints/hitDice, speed) → two full-object toEqual byte pins
//     (production-shape + minimal-shape)
//   saves/skills ×2               → one filter table (+ zero-is-data and junk-key legs)
//   initiative ×2                 → one format table
//   AC ×2                         → one spy test (numeric path must NOT log)
//   passive perception ×2         → one table
//   unarmed ×3 (incl. defaultUnarmedStrike direct call) → one scaling table; the exact
//     full fallback object (incl. description + secondary slots) is byte-pinned inside
//     the minimal-shape pin, so the direct-call test was redundant.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  findNPCByName,
  npcHasStatBlock,
  npcHasAttacks,
  calculateAbilityModifier,
  npcToMonsterFormat,
} from './npcStatBlockUtils.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function makeNPC(overrides = {}) {
  return {
    name: 'Test NPC',
    armorClass: 15,
    hitPoints: 20,
    classRole: 'Warrior',
    abilityScores: { str: 16, dex: 14, con: 12, int: 10, wis: 8, cha: 18 },
    ...overrides,
  };
}

describe('npcHasStatBlock', () => {
  // Combat-ready = tracker can run them: finite numeric AC + positive numeric HP.
  it.each([
    { label: 'numeric AC and HP', npc: { armorClass: 15, hitPoints: 20 }, expected: true },
    { label: 'AC 0 is data', npc: { armorClass: 0, hitPoints: 20 }, expected: true },
    { label: 'negative AC is data', npc: { armorClass: -5, hitPoints: 1 }, expected: true },
    { label: 'numeric-string HP', npc: { armorClass: 15, hitPoints: '7' }, expected: true },
    { label: 'null npc', npc: null, expected: false },
    { label: 'empty object', npc: {}, expected: false },
    { label: 'string AC', npc: { armorClass: '15', hitPoints: 20 }, expected: false },
    { label: 'missing AC', npc: { hitPoints: 20 }, expected: false },
    { label: 'NaN AC', npc: { armorClass: NaN, hitPoints: 20 }, expected: false },
    { label: 'Infinity AC', npc: { armorClass: Infinity, hitPoints: 20 }, expected: false },
    { label: 'missing HP', npc: { armorClass: 15 }, expected: false },
    { label: 'null HP', npc: { armorClass: 15, hitPoints: null }, expected: false },
    { label: 'empty-string HP', npc: { armorClass: 15, hitPoints: '' }, expected: false },
    { label: 'HP 0 is not alive', npc: { armorClass: 15, hitPoints: 0 }, expected: false },
    { label: 'negative HP', npc: { armorClass: 15, hitPoints: -3 }, expected: false },
    { label: 'dice-expression HP', npc: { armorClass: 15, hitPoints: '6d8+2' }, expected: false },
    { label: 'Infinity HP', npc: { armorClass: 15, hitPoints: Infinity }, expected: false },
  ])('$label → $expected', ({ npc, expected }) => {
    expect(npcHasStatBlock(npc)).toBe(expected);
  });
});

describe('npcHasAttacks', () => {
  // A usable attack: non-blank name AND (attack bonus OR damage dice).
  it.each([
    { label: 'name + bonus + damage', npc: { actions: [{ name: 'Longsword', attack_bonus: '+5', damage_dice_primary: '1d8' }] }, expected: true },
    { label: 'bonus +0 is data', npc: { actions: [{ name: 'Bite', attack_bonus: '+0' }] }, expected: true },
    { label: 'damage only', npc: { actions: [{ name: 'Breath', damage_dice_primary: '2d6' }] }, expected: true },
    { label: 'numeric 0 bonus survives ??', npc: { actions: [{ name: 'Slam', attack_bonus: 0 }] }, expected: true },
    { label: 'padded name still detected', npc: { actions: [{ name: ' Claw ', damage_dice_primary: '1d6' }] }, expected: true },
    { label: 'no npc', npc: null, expected: false },
    { label: 'no actions', npc: {}, expected: false },
    { label: 'null actions', npc: { actions: null }, expected: false },
    { label: 'name-only is not an attack', npc: { actions: [{ name: 'Shout' }] }, expected: false },
    { label: 'blank bonus + blank damage', npc: { actions: [{ name: 'Rearrange', attack_bonus: '', damage_dice_primary: '' }] }, expected: false },
    { label: 'bonus without name', npc: { actions: [{ attack_bonus: '+3' }] }, expected: false },
    { label: 'blank name with bonus', npc: { actions: [{ name: '  ', attack_bonus: '+3' }] }, expected: false },
  ])('$label → $expected', ({ npc, expected }) => {
    expect(npcHasAttacks(npc)).toBe(expected);
  });
});

describe('calculateAbilityModifier', () => {
  // floor((score - 10) / 2) — one leg per parity boundary.
  it.each([
    [-1, -6], [0, -5], [1, -5], [4, -3], [9, -1], [10, 0],
    [11, 0], [12, 1], [14, 2], [20, 5], [21, 5], [22, 6],
  ])('score %i → modifier %s', (score, mod) => {
    expect(calculateAbilityModifier(score)).toBe(mod);
  });
});

describe('findNPCByName', () => {
  const ready = makeNPC();
  const blank = { name: 'Bandit' };
  const frontNumbered = makeNPC({ name: '123 Bandit' });
  const other = makeNPC({ name: 'Guard' });

  it.each([
    { label: 'null name', name: null, npcs: [ready], expected: null },
    { label: 'empty name', name: '', npcs: [ready], expected: null },
    { label: 'null list', name: 'Test NPC', npcs: null, expected: null },
    { label: 'empty list', name: 'Test NPC', npcs: [], expected: null },
    { label: 'exact match', name: 'Test NPC', npcs: [ready], expected: ready },
    { label: 'case-insensitive', name: 'tEsT NpC', npcs: [ready], expected: ready },
    { label: 'trailing digit stripped', name: 'Test NPC 123', npcs: [ready], expected: ready },
    { label: 'multi-space trailing digits stripped', name: 'Test NPC  42', npcs: [ready], expected: ready },
    { label: 'leading digits are NOT stripped', name: 'Bandit', npcs: [frontNumbered], expected: null },
    { label: 'leading-digit name still matches verbatim', name: '123 Bandit', npcs: [frontNumbered], expected: frontNumbered },
    { label: 'statless NPC skipped, later ready NPC found', name: 'Test NPC', npcs: [blank, ready], expected: ready },
    { label: 'only statless match → null', name: 'Bandit', npcs: [blank], expected: null },
    { label: 'first ready match wins', name: 'Guard', npcs: [other, makeNPC({ name: 'Guard' })], expected: other },
    { label: 'no match → null', name: 'Nonexistent', npcs: [ready], expected: null },
  ])('$label', ({ name, npcs, expected }) => {
    expect(findNPCByName(name, npcs)).toBe(expected);
  });
});

describe('npcToMonsterFormat', () => {
  it('returns null for null or undefined npc', () => {
    expect(npcToMonsterFormat(null)).toBeNull();
    expect(npcToMonsterFormat(undefined)).toBeNull();
  });

  it('produces the full monster byte contract from a production-shaped NPC form save', () => {
    // Shape mirrors what NPCStatBlockForm/NPCFormModal actually persist:
    // raw-string save/skill bonuses, textarea-string traits/reactions, junk keys.
    const npc = {
      id: 'npc-1',
      name: 'Bardima',
      race: 'Half-Elf',
      classRole: 'Bard',
      attitude: 'friendly',
      tags: 'ally',
      imagePath: 'images/bardima.png',
      armorClass: 14,
      hitPoints: 27,
      hitDice: '6d8',
      speed: { walk: '30 ft.', fly: '' },
      initiativeBonus: 3,
      abilityScores: { str: 8, dex: 16, con: 12, int: 14, wis: 10, cha: 17 },
      savingThrowBonuses: { dex: '5', cha: '6' },
      skillBonuses: { Performance: '7', Stealth: '5' },
      damageResistances: ['cold'],
      damageImmunities: [],
      conditionImmunities: ['charmed'],
      traits: 'Magnetic Personality\nCutting Wit',
      reactions: '',
      actions: [{ name: 'Rapier', attack_bonus: '5', damage_dice_primary: '1d8+3', damage_type_primary: 'piercing', damage_dice_secondary: '', damage_type_secondary: '', description: '' }],
    };

    expect(npcToMonsterFormat(npc)).toEqual({
      name: 'Bardima',
      size: 'Medium',
      type: 'Bard',
      subtype: null,
      alignment: 'Unaligned',
      armor_class: 14,
      hit_points: 27,
      hit_dice: '6d8',
      speed: { walk: '30 ft.', fly: '' },
      initiative_details: '+3',
      ability_scores: { str: 8, dex: 16, con: 12, int: 14, wis: 10, cha: 17 },
      ability_score_modifiers: { str: -1, dex: 3, con: 1, int: 2, wis: 0, cha: 3 },
      saving_throws: { dex: { modifier: 5 }, cha: { modifier: 6 } },
      skills: { Performance: { modifier: 7 }, Stealth: { modifier: 5 } },
      senses: { passive_perception: 10 },
      languages: '',
      damage_vulnerabilities: [],
      damage_resistances: ['cold'],
      damage_immunities: [],
      condition_immunities: ['charmed'],
      traits: 'Magnetic Personality\nCutting Wit',
      actions: [{ name: 'Rapier', attack_bonus: '5', damage_dice_primary: '1d8+3', damage_type_primary: 'piercing', damage_dice_secondary: '', damage_type_secondary: '', description: '' }],
      reactions: [],
      legendary_actions: [],
      lair_actions: null,
      regional_effects: null,
      desc: null,
      challenge_rating: null,
      xp: null,
      legendary_resistance: null,
    });
  });

  it('produces the full defaults byte contract from a minimal NPC (incl. exact Unarmed Strike fallback)', () => {
    expect(npcToMonsterFormat({ armorClass: 10 })).toEqual({
      name: 'Unknown',
      size: 'Medium',
      type: 'NPC',
      subtype: null,
      alignment: 'Unaligned',
      armor_class: 10,
      hit_points: '',
      hit_dice: '',
      speed: { walk: '30 ft.' },
      initiative_details: null,
      ability_scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ability_score_modifiers: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      saving_throws: {},
      skills: {},
      senses: { passive_perception: 10 },
      languages: '',
      damage_vulnerabilities: [],
      damage_resistances: [],
      damage_immunities: [],
      condition_immunities: [],
      traits: [],
      actions: [{
        name: 'Unarmed Strike',
        attack_bonus: '+0',
        damage_dice_primary: '1',
        damage_type_primary: 'bludgeoning',
        damage_dice_secondary: '',
        damage_type_secondary: '',
        description: 'Fallback attack — add a real weapon in the NPC Stats tab to replace it.',
      }],
      reactions: [],
      legendary_actions: [],
      lair_actions: null,
      regional_effects: null,
      desc: null,
      challenge_rating: null,
      xp: null,
      legendary_resistance: null,
    });
  });

  it('uses numeric AC silently; defaults to 10 with a byte-pinned error when not a number', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(npcToMonsterFormat(makeNPC({ armorClass: 18 })).armor_class).toBe(18);
    expect(spy).not.toHaveBeenCalled();

    expect(npcToMonsterFormat({ name: 'Broken NPC' }).armor_class).toBe(10);
    expect(spy).toHaveBeenCalledWith(
      '[AC] NPC "Broken NPC" has no armorClass defined. Defaulting to 10.'
    );
  });

  it.each([
    [5, '+5'],
    [0, '+0'],
    [-3, '-3'],
    ['4', '+4'],
    ['-1', '-1'],
  ])('initiative bonus %s formats to %s', (bonus, expected) => {
    expect(npcToMonsterFormat(makeNPC({ initiativeBonus: bonus })).initiative_details).toBe(expected);
  });

  it.each([
    [undefined],
    [null],
    [''],
  ])('initiative bonus %s is omitted as null', (bonus) => {
    expect(npcToMonsterFormat(makeNPC({ initiativeBonus: bonus })).initiative_details).toBeNull();
  });

  // saving_throws iterates fixed ABILITY_KEYS; skills keeps arbitrary names.
  it.each([
    { field: 'savingThrowBonuses', out: 'saving_throws', bonuses: { str: 3, con: 1 }, expected: { str: { modifier: 3 }, con: { modifier: 1 } } },
    { field: 'savingThrowBonuses', out: 'saving_throws', bonuses: { str: undefined, dex: null, con: '' }, expected: {} },
    { field: 'savingThrowBonuses', out: 'saving_throws', bonuses: { str: 0 }, expected: { str: { modifier: 0 } } },
    { field: 'savingThrowBonuses', out: 'saving_throws', bonuses: { int: '2' }, expected: { int: { modifier: 2 } } },
    { field: 'savingThrowBonuses', out: 'saving_throws', bonuses: { bogus: 9, wis: -2 }, expected: { wis: { modifier: -2 } } },
    { field: 'skillBonuses', out: 'skills', bonuses: { Stealth: 4, Insight: '-1' }, expected: { Stealth: { modifier: 4 }, Insight: { modifier: -1 } } },
    { field: 'skillBonuses', out: 'skills', bonuses: { Acrobatics: undefined, History: '' }, expected: {} },
    { field: 'skillBonuses', out: 'skills', bonuses: { SleightOfHand: 0 }, expected: { SleightOfHand: { modifier: 0 } } },
    { field: 'skillBonuses', out: 'skills', bonuses: { 'Custom Tool Check': 3 }, expected: { 'Custom Tool Check': { modifier: 3 } } },
  ])('$field → $out', ({ field, out, bonuses, expected }) => {
    expect(npcToMonsterFormat(makeNPC({ [field]: bonuses }))[out]).toEqual(expected);
  });

  // Fallback strike: attack = str modifier, damage = max(1 + str mod, 1).
  it.each([
    [6, '-2', '1'],
    [8, '-1', '1'],
    [10, '+0', '1'],
    [16, '+3', '4'],
    [20, '+5', '6'],
  ])('str %i → attack %s, damage %s bludgeoning', (str, attackBonus, damage) => {
    const npc = makeNPC({
      actions: [],
      abilityScores: { str, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    });
    const [strike] = npcToMonsterFormat(npc).actions;
    expect(strike).toMatchObject({
      name: 'Unarmed Strike',
      attack_bonus: attackBonus,
      damage_dice_primary: damage,
      damage_type_primary: 'bludgeoning',
    });
  });

  it.each([
    [14, 12],
    [10, 10],
    [6, 8],
  ])('passive_perception with wis %i is %i', (wis, expected) => {
    const npc = makeNPC({ abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis, cha: 10 } });
    expect(npcToMonsterFormat(npc).senses.passive_perception).toBe(expected);
  });
});
