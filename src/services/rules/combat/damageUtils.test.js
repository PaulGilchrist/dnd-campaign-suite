// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(),
  clearDataCache: vi.fn(),
}));

vi.mock('../core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import {
  extractDamageTypes,
  formatDamageTypes,
  getResistanceNotice,
  getCombatContext,
  findCreatureByName,
  getTargetFromAttacker,
  getAttackerTargetName,
  computePlayerAc,
  computeAcEstimate,
} from './damageUtils.js';

import { loadEquipment, clearDataCache } from '../../ui/dataLoader.js';
import { parseMagicItemName } from '../core/attackCalc.js';

// ── Helpers ─────────────────────────────────────────────────────

function makeCreature(name, extra = {}) {
  return { name, ...extra };
}

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function makeCharacter(abilities) {
  return { abilities };
}

// ── extractDamageTypes ────────────────────────────────────────

describe('extractDamageTypes', () => {
  const allDamageTypes = [
    'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning',
    'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder',
  ];

  it('returns empty array for null, undefined, and non-string types', () => {
    expect(extractDamageTypes(null)).toEqual([]);
    expect(extractDamageTypes(undefined)).toEqual([]);
    expect(extractDamageTypes(42)).toEqual([]);
    expect(extractDamageTypes({})).toEqual([]);
    expect(extractDamageTypes([])).toEqual([]);
  });

  it('finds damage types in descriptions (single, multiple, case-insensitive)', () => {
    expect(extractDamageTypes('The blade deals 1d8 slashing damage')).toEqual(['Slashing']);
    expect(extractDamageTypes('necrotic blast')).toEqual(['Necrotic']);
    expect(extractDamageTypes('COLD DAMAGE')).toEqual(['Cold']);

    const multi = extractDamageTypes('Deals 2d6 fire and lightning damage');
    expect(multi).toContain('Fire');
    expect(multi).toContain('Lightning');
    expect(multi).toHaveLength(2);

    expect(extractDamageTypes('slashing attack')).toEqual(['Slashing']);
    expect(extractDamageTypes('fire damage and cold damage')).toEqual(['Cold', 'Fire']);
  });

  it('uses word boundaries to avoid partial matches', () => {
    expect(extractDamageTypes('Thundering noise')).toEqual([]);
    expect(extractDamageTypes('Acidic')).toEqual([]);
    expect(extractDamageTypes('Fireball')).toEqual([]);
  });

  it('returns empty array when no damage type words are present', () => {
    expect(extractDamageTypes('The monster roars aggressively')).toEqual([]);
    expect(extractDamageTypes('The target takes no damage')).toEqual([]);
  });

  it('matches all known damage types from the rules', () => {
    for (const dt of allDamageTypes) {
      const result = extractDamageTypes(`${dt} damage`);
      expect(result).toContain(dt);
    }
  });
});

// ── formatDamageTypes ──────────────────────────────────────────

describe('formatDamageTypes', () => {
  it('returns null for null, undefined, and empty array', () => {
    expect(formatDamageTypes(null)).toBeNull();
    expect(formatDamageTypes(undefined)).toBeNull();
    expect(formatDamageTypes([])).toBeNull();
  });

  it('joins types with / separator (single, multiple, three+)', () => {
    expect(formatDamageTypes(['Fire'])).toBe('Fire');
    expect(formatDamageTypes(['Fire', 'Necrotic'])).toBe('Fire/Necrotic');
    expect(formatDamageTypes(['Cold', 'Thunder', 'Force'])).toBe('Cold/Thunder/Force');
  });
});

// ── getResistanceNotice ────────────────────────────────────────

describe('getResistanceNotice', () => {
  it('returns null for null, undefined, and empty damageTypes', () => {
    expect(getResistanceNotice(null, [], [], 'Orc')).toBeNull();
    expect(getResistanceNotice(undefined, [], [], 'Orc')).toBeNull();
    expect(getResistanceNotice([], [], [], 'Orc')).toBeNull();
  });

  it('reports immunity or resistance correctly, prioritizes immunity over resistance', () => {
    expect(getResistanceNotice(['Fire'], [], ['fire'], 'Dragon')).toBe('Dragon is IMMUNE to Fire');
    expect(getResistanceNotice(['Cold'], ['Cold'], [], 'Ice Golem')).toBe('Ice Golem resists Cold');
    expect(getResistanceNotice(['Fire'], ['fire'], ['fire'], 'Dragon')).toBe('Dragon is IMMUNE to Fire');
  });

  it('returns null when no immunity or resistance matches', () => {
    expect(getResistanceNotice(['Fire'], ['cold'], ['lightning'], 'Orc')).toBeNull();
  });

  it('matches case-insensitively but preserves original casing in output', () => {
    expect(getResistanceNotice(['NECROTIC'], [], ['necrotic'], 'Skeleton')).toBe('Skeleton is IMMUNE to NECROTIC');
  });

  it('reports multiple damage types when several match immunities or resistances', () => {
    expect(getResistanceNotice(['Fire', 'Cold'], [], ['fire', 'cold'], 'Dragon')).toBe('Dragon is IMMUNE to Fire, Cold');
    expect(getResistanceNotice(['Fire', 'Cold'], ['fire', 'cold'], [], 'Orc')).toBe('Orc resists Fire, Cold');
  });

  it('handles undefined resistances/immunities and empty string targetName', () => {
    expect(getResistanceNotice(['Fire'], undefined, undefined, 'Goblin')).toBeNull();
    expect(getResistanceNotice(['Fire'], [], ['fire'], '')).toBe(' is IMMUNE to Fire');
  });

  it('reports only the first matching type (immune types take precedence)', () => {
    expect(getResistanceNotice(['Fire', 'Cold'], ['cold'], ['fire'], 'Dragon')).toBe('Dragon is IMMUNE to Fire');
  });
});

// ── getCombatContext ────────────────────────────────────────────

describe('getCombatContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when campaignName is falsy', async () => {
    expect(await getCombatContext(null)).toBeNull();
    expect(await getCombatContext(undefined)).toBeNull();
    expect(await getCombatContext('')).toBeNull();
  });

  it('fetches from the correct URL with encoded campaign name', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ combatSummary: { creatures: [] } }),
    });

    await getCombatContext('My Campaign 2024');
    expect(global.fetch).toHaveBeenCalledWith('/api/campaigns/My%20Campaign%202024/change-data');
  });

  it('returns combatSummary from response body', async () => {
    const summary = { creatures: [{ name: 'Goblin' }] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ combatSummary: summary }),
    });

    const result = await getCombatContext('test');
    expect(result).toBe(summary);
  });

  it('returns null when response is not ok, combatSummary is missing, or fetch errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    expect(await getCombatContext('test')).toBeNull();

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ otherField: 'data' }),
    });
    expect(await getCombatContext('test')).toBeNull();

    global.fetch.mockRejectedValue(new Error('network error'));
    expect(await getCombatContext('test')).toBeNull();
  });
});

// ── findCreatureByName ─────────────────────────────────────────

describe('findCreatureByName', () => {
  it('returns null when combatSummary or name is falsy', () => {
    expect(findCreatureByName(null, 'Goblin')).toBeNull();
    expect(findCreatureByName(undefined, 'Goblin')).toBeNull();
    expect(findCreatureByName({}, 'Goblin')).toBeNull();
    const cs = makeCombatSummary([makeCreature('Goblin')]);
    expect(findCreatureByName(cs, null)).toBeNull();
    expect(findCreatureByName(cs, undefined)).toBeNull();
    expect(findCreatureByName(cs, '')).toBeNull();
  });

  it('returns exact match, prefix match, or null', () => {
    const cs = makeCombatSummary([
      makeCreature('Goblin Grunt'),
      makeCreature('Goblin'),
    ]);

    // exact match
    const exact = findCreatureByName(cs, 'Goblin');
    expect(exact.name).toBe('Goblin');

    // prefix match
    const prefix = findCreatureByName(cs, 'Goblin Grunt');
    expect(prefix.name).toBe('Goblin Grunt');

    // no match
    expect(findCreatureByName(cs, 'Orc')).toBeFalsy();
  });

  it('prefers exact match over prefix match', () => {
    const cs = makeCombatSummary([
      makeCreature('Goblin'),
      makeCreature('Goblin Grunt'),
    ]);
    expect(findCreatureByName(cs, 'Goblin').name).toBe('Goblin');
  });

  it('does not match substrings without a trailing space word boundary', () => {
    const cs = makeCombatSummary([makeCreature('Dungeon Master')]);
    expect(findCreatureByName(cs, 'Dune')).toBeFalsy();
    expect(findCreatureByName(cs, 'Master')).toBeFalsy();
    expect(findCreatureByName(cs, 'Dun')).toBeFalsy();
  });
});

// ── getTargetFromAttacker ──────────────────────────────────────

describe('getTargetFromAttacker', () => {
  it('returns null when combatSummary is falsy, attacker not found, or attacker has no targetName', () => {
    expect(getTargetFromAttacker(null, 'Goblin')).toBeNull();
    const cs = makeCombatSummary([makeCreature('Orc')]);
    expect(getTargetFromAttacker(cs, 'Ghost')).toBeNull();
    expect(getTargetFromAttacker(cs, 'Orc')).toBeNull();
  });

  it('returns the target creature found by attacker targetName, or null when target not found', () => {
    const cs = makeCombatSummary([
      makeCreature('Goblin'),
      makeCreature('Fighter'),
    ]);
    cs.creatures[0].targetName = 'Fighter';
    expect(getTargetFromAttacker(cs, 'Goblin').name).toBe('Fighter');

    const cs2 = makeCombatSummary([
      makeCreature('Goblin', { targetName: 'MissingTarget' }),
    ]);
    expect(getTargetFromAttacker(cs2, 'Goblin')).toBeNull();
  });
});

// ── getAttackerTargetName ──────────────────────────────────────

describe('getAttackerTargetName', () => {
  it('returns null when combatSummary is null or attacker not found', () => {
    expect(getAttackerTargetName(null, 'Goblin')).toBeNull();
    expect(getAttackerTargetName(makeCombatSummary([makeCreature('Orc')]), 'Ghost')).toBeNull();
  });

  it('returns targetName when attacker has one, null otherwise', () => {
    expect(getAttackerTargetName(makeCombatSummary([makeCreature('Goblin', { targetName: 'Fighter' })]), 'Goblin')).toBe('Fighter');
    expect(getAttackerTargetName(makeCombatSummary([makeCreature('Goblin')]), 'Goblin')).toBeNull();
    expect(getAttackerTargetName(makeCombatSummary([makeCreature('Goblin', { targetName: undefined })]), 'Goblin')).toBeNull();
    expect(getAttackerTargetName(makeCombatSummary([makeCreature('Goblin', { targetName: '' })]), 'Goblin')).toBeNull();
  });
});

// ── computePlayerAc (async, uses loadEquipment + parseMagicItemName) ────

describe('computePlayerAc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDataCache();
  });

  it('returns 10 when character is null or has no abilities/equipment', async () => {
    expect(await computePlayerAc(null)).toBe(10);
    loadEquipment.mockResolvedValueOnce([]);
    expect(await computePlayerAc({})).toBe(10);
  });

  it('returns 10 + dex bonus when no armor equipped', async () => {
    loadEquipment.mockResolvedValueOnce([]);
    expect(await computePlayerAc(makeCharacter([{ name: 'Dexterity', baseScore: 16 }]))).toBe(13);
    expect(await computePlayerAc(makeCharacter([{ name: 'Dexterity', baseScore: 14 }]))).toBe(12);
    expect(await computePlayerAc(makeCharacter([{ name: 'Dexterity', bonus: 4 }]))).toBe(14);
    expect(await computePlayerAc(makeCharacter([{ name: 'Dexterity', bonus: 3 }]))).toBe(13);
  });

  it('handles negative dex bonus with and without armor', async () => {
    loadEquipment.mockResolvedValueOnce([]);
    expect(await computePlayerAc(makeCharacter([{ name: 'Dexterity', baseScore: 7 }]))).toBe(8);

    loadEquipment.mockResolvedValueOnce([
      { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Leather Armor' });
    expect(await computePlayerAc({
      abilities: [{ name: 'Dexterity', bonus: -2 }],
      inventory: { equipped: ['Leather Armor'] },
    })).toBe(9);
  });

  it('computes AC with armor (base only, dex bonus, capped dex bonus)', async () => {
    // armor base only (no dex)
    loadEquipment.mockResolvedValueOnce([
      { name: 'Chain Mail', equipment_category: 'Armor', armor_class: { base: 16 } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Chain Mail' });
    expect(await computePlayerAc({
      abilities: [{ name: 'Dexterity', baseScore: 20 }],
      inventory: { equipped: ['Chain Mail'] },
    })).toBe(16);

    // armor + full dex bonus
    loadEquipment.mockResolvedValueOnce([
      { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Leather Armor' });
    expect(await computePlayerAc({
      abilities: [{ name: 'Dexterity', baseScore: 18 }],
      inventory: { equipped: ['Leather Armor'] },
    })).toBe(15);

    // armor + capped dex bonus
    loadEquipment.mockResolvedValueOnce([
      { name: 'Studded Leather', equipment_category: 'Armor', armor_class: { base: 12, dex_bonus: true, max_bonus: 2 } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Studded Leather' });
    expect(await computePlayerAc({
      abilities: [{ name: 'Dexterity', bonus: 5 }],
      inventory: { equipped: ['Studded Leather'] },
    })).toBe(14);
  });

  it('adds shield bonus on top of armor AC', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Scale Mail', equipment_category: 'Armor', armor_class: { base: 14 } },
      { name: 'Shield', equipment_category: 'Shield' },
    ]);
    parseMagicItemName
      .mockReturnValueOnce({ baseName: 'Scale Mail' })
      .mockReturnValueOnce({ baseName: 'Shield' });
    expect(await computePlayerAc({
      abilities: [{ name: 'Dexterity', baseScore: 10 }],
      inventory: { equipped: ['Scale Mail', 'Shield'] },
    })).toBe(16);
  });

  it('strips magic prefixes via parseMagicItemName, ignores unknown items, and ignores non-armor/shield items', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Plate Armor', equipment_category: 'Armor', armor_class: { base: 18 } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Plate Armor' });
    expect(await computePlayerAc({
      abilities: [{ name: 'Dexterity', baseScore: 10 }],
      inventory: { equipped: ['+2 Plate Armor'] },
    })).toBe(18);

    loadEquipment.mockResolvedValueOnce([]);
    parseMagicItemName.mockReturnValue({ baseName: 'Ghost Armor' });
    expect(await computePlayerAc({
      abilities: [{ name: 'Dexterity', bonus: 3 }],
      inventory: { equipped: ['Ghost Armor'] },
    })).toBe(13);

    loadEquipment.mockResolvedValueOnce([
      { name: 'Chain Shirt', equipment_category: 'Armor', armor_class: { base: 13, dex_bonus: true, max_bonus: 2 } },
      { name: 'Potion', equipment_category: 'Other' },
    ]);
    parseMagicItemName
      .mockReturnValueOnce({ baseName: 'Chain Shirt' })
      .mockReturnValueOnce({ baseName: 'Potion' });
    expect(await computePlayerAc({
      abilities: [{ name: 'Dexterity', bonus: 5 }],
      inventory: { equipped: ['Chain Shirt', 'Potion'] },
    })).toBe(15);
  });

  it('handles edge cases: zero/negative dex, max_bonus 0, null max_bonus, missing inventory', async () => {
    // zero dex
    loadEquipment.mockResolvedValueOnce([
      { name: 'Chain Mail', equipment_category: 'Armor', armor_class: { base: 16 } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Chain Mail' });
    expect(await computePlayerAc({
      abilities: [{ name: 'Dexterity', baseScore: 10 }],
      inventory: { equipped: ['Chain Mail'] },
    })).toBe(16);

    // max_bonus 0
    loadEquipment.mockResolvedValueOnce([
      { name: 'Heavy Plate', equipment_category: 'Armor', armor_class: { base: 18, dex_bonus: true, max_bonus: 0 } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Heavy Plate' });
    expect(await computePlayerAc({
      abilities: [{ name: 'Dexterity', bonus: 5 }],
      inventory: { equipped: ['Heavy Plate'] },
    })).toBe(18);

    // null max_bonus (defaults to 99, no effective cap)
    loadEquipment.mockResolvedValueOnce([
      { name: 'Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Armor' });
    expect(await computePlayerAc({
      abilities: [{ name: 'Dexterity', bonus: 5 }],
      inventory: { equipped: ['Armor'] },
    })).toBe(16);

    // missing inventory.equipped
    loadEquipment.mockResolvedValueOnce([
      { name: 'Chain Mail', equipment_category: 'Armor', armor_class: { base: 16 } },
    ]);
    expect(await computePlayerAc(makeCharacter([{ name: 'Dexterity', bonus: 2 }]))).toBe(12);
  });

  it('falls back to 10+dex when only shield equipped, and handles undefined armor_class', async () => {
    // only shield
    loadEquipment.mockResolvedValueOnce([
      { name: 'Shield', equipment_category: 'Shield' },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Shield' });
    expect(await computePlayerAc({
      abilities: [{ name: 'Dexterity', bonus: 3 }],
      inventory: { equipped: ['Shield'] },
    })).toBe(13);

    // undefined armor_class on Armor item
    loadEquipment.mockResolvedValueOnce([
      { name: 'Magic Sword', equipment_category: 'Armor' },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Magic Sword' });
    expect(await computePlayerAc({
      abilities: [{ name: 'Dexterity', bonus: 3 }],
      inventory: { equipped: ['Magic Sword'] },
    })).toBe(0);
  });
});

// ── computeAcEstimate (sync, no IO) ────────────────────────────

describe('computeAcEstimate', () => {
  it('returns 10 when character is null or has no abilities', () => {
    expect(computeAcEstimate(null)).toBe(10);
    expect(computeAcEstimate({})).toBe(10);
  });

  it('returns 10 + dex bonus from ab.bonus or computed from baseScore', () => {
    expect(computeAcEstimate(makeCharacter([{ name: 'Dexterity', bonus: 3 }]))).toBe(13);
    expect(computeAcEstimate(makeCharacter([{ name: 'Dexterity', baseScore: 18 }]))).toBe(14);
  });

  it('returns 10 when Dexterity not found, handles negative and zero dex', () => {
    expect(computeAcEstimate(makeCharacter([{ name: 'Strength', bonus: 5 }]))).toBe(10);
    expect(computeAcEstimate(makeCharacter([{ name: 'Dexterity', bonus: -2 }]))).toBe(8);
    expect(computeAcEstimate(makeCharacter([{ name: 'Dexterity', baseScore: 10 }]))).toBe(10);
  });

  it('prefers ab.bonus over computing from baseScore', () => {
    expect(computeAcEstimate(makeCharacter([{ name: 'Dexterity', bonus: 3, baseScore: 20 }]))).toBe(13);
  });
});
