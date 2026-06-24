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

  it('finds a single damage type in the description', () => {
    expect(extractDamageTypes('The blade deals 1d8 slashing damage')).toEqual(['Slashing']);
  });

  it('finds multiple damage types in the description', () => {
    const result = extractDamageTypes('Deals 2d6 fire and lightning damage');
    expect(result).toContain('Fire');
    expect(result).toContain('Lightning');
    expect(result).toHaveLength(2);
  });

  it('matches damage types case-insensitively', () => {
    expect(extractDamageTypes('necrotic blast')).toEqual(['Necrotic']);
    expect(extractDamageTypes('COLD DAMAGE')).toEqual(['Cold']);
  });

  it('uses word boundaries to avoid partial matches', () => {
    expect(extractDamageTypes('Thundering noise')).toEqual([]);
    expect(extractDamageTypes('Acidic')).toEqual([]);
    expect(extractDamageTypes('Fireball')).toEqual([]);
  });

  it('matches when damage type word is followed by a space and valid damage word', () => {
    expect(extractDamageTypes('slashing attack')).toEqual(['Slashing']);
    expect(extractDamageTypes('fire damage and cold damage')).toEqual(['Cold', 'Fire']);
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

  it('returns the single type as a string', () => {
    expect(formatDamageTypes(['Fire'])).toBe('Fire');
  });

  it('joins multiple types with / separator', () => {
    expect(formatDamageTypes(['Fire', 'Necrotic'])).toBe('Fire/Necrotic');
  });

  it('joins three or more types with / separator', () => {
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

  it('reports immunity when a damage type matches targetImmunities', () => {
    const msg = getResistanceNotice(['Fire'], [], ['fire'], 'Dragon');
    expect(msg).toBe('Dragon is IMMUNE to Fire');
  });

  it('reports resistance when a damage type matches targetResistances (no immunity)', () => {
    const msg = getResistanceNotice(['Cold'], ['Cold'], [], 'Ice Golem');
    expect(msg).toBe('Ice Golem resists Cold');
  });

  it('prioritizes immunity over resistance when both match', () => {
    const msg = getResistanceNotice(['Fire'], ['fire'], ['fire'], 'Dragon');
    expect(msg).toBe('Dragon is IMMUNE to Fire');
  });

  it('returns null when no immunity or resistance matches', () => {
    const msg = getResistanceNotice(['Fire'], ['cold'], ['lightning'], 'Orc');
    expect(msg).toBeNull();
  });

  it('matches damage types case-insensitively but preserves original casing in output', () => {
    const msg = getResistanceNotice(['NECROTIC'], [], ['necrotic'], 'Skeleton');
    expect(msg).toBe('Skeleton is IMMUNE to NECROTIC');
  });

  it('reports multiple damage types when several match immunities', () => {
    const msg = getResistanceNotice(['Fire', 'Cold'], [], ['fire', 'cold'], 'Dragon');
    expect(msg).toBe('Dragon is IMMUNE to Fire, Cold');
  });

  it('reports multiple damage types when several match resistances', () => {
    const msg = getResistanceNotice(['Fire', 'Cold'], ['fire', 'cold'], [], 'Orc');
    expect(msg).toBe('Orc resists Fire, Cold');
  });

  it('handles undefined resistances and immunities', () => {
    const msg = getResistanceNotice(['Fire'], undefined, undefined, 'Goblin');
    expect(msg).toBeNull();
  });

  it('handles empty string targetName', () => {
    const msg = getResistanceNotice(['Fire'], [], ['fire'], '');
    expect(msg).toBe(' is IMMUNE to Fire');
  });

  it('reports only the first matching type (immune types take precedence)', () => {
    const msg = getResistanceNotice(['Fire', 'Cold'], ['cold'], ['fire'], 'Dragon');
    expect(msg).toBe('Dragon is IMMUNE to Fire');
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
    expect(global.fetch).toHaveBeenCalledWith('/api/campaigns/My%20Campaign%202024/combatSummary');
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

  it('returns null when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const result = await getCombatContext('test');
    expect(result).toBeNull();
  });

  it('returns null when combatSummary field is missing from response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ otherField: 'data' }),
    });
    const result = await getCombatContext('test');
    expect(result).toBeNull();
  });

  it('returns null on fetch error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'));
    const result = await getCombatContext('test');
    expect(result).toBeNull();
  });
});

// ── findCreatureByName ─────────────────────────────────────────

describe('findCreatureByName', () => {
  it('returns null when combatSummary is falsy', () => {
    expect(findCreatureByName(null, 'Goblin')).toBeNull();
    expect(findCreatureByName(undefined, 'Goblin')).toBeNull();
  });

  it('returns null when combatSummary has no creatures array', () => {
    expect(findCreatureByName({}, 'Goblin')).toBeNull();
  });

  it('returns null when name is falsy', () => {
    const cs = makeCombatSummary([makeCreature('Goblin')]);
    expect(findCreatureByName(cs, null)).toBeNull();
    expect(findCreatureByName(cs, undefined)).toBeNull();
    expect(findCreatureByName(cs, '')).toBeNull();
  });

  it('returns the exact matching creature', () => {
    const cs = makeCombatSummary([
      makeCreature('Goblin Grunt'),
      makeCreature('Goblin'),
    ]);
    const result = findCreatureByName(cs, 'Goblin');
    expect(result.name).toBe('Goblin');
  });

  it('falls back to prefix match when name is followed by a space', () => {
    const cs = makeCombatSummary([
      makeCreature('Goblin Leader'),
      makeCreature('Orc'),
    ]);
    const result = findCreatureByName(cs, 'Goblin');
    expect(result.name).toBe('Goblin Leader');
  });

  it('prefers exact match over prefix match', () => {
    const cs = makeCombatSummary([
      makeCreature('Goblin'),
      makeCreature('Goblin Grunt'),
    ]);
    const result = findCreatureByName(cs, 'Goblin');
    expect(result.name).toBe('Goblin');
  });

  it('returns null/undefined when neither exact nor prefix match found', () => {
    const cs = makeCombatSummary([makeCreature('Orc')]);
    const result = findCreatureByName(cs, 'Goblin');
    expect(result).toBeFalsy();
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
  it('returns null when combatSummary is falsy', () => {
    expect(getTargetFromAttacker(null, 'Goblin')).toBeNull();
  });

  it('returns null when attacker not found in combatSummary', () => {
    const cs = makeCombatSummary([makeCreature('Orc')]);
    expect(getTargetFromAttacker(cs, 'Ghost')).toBeNull();
  });

  it('returns null when attacker has no targetName', () => {
    const cs = makeCombatSummary([makeCreature('Goblin')]);
    expect(getTargetFromAttacker(cs, 'Goblin')).toBeNull();
  });

  it('returns the target creature found by attacker targetName', () => {
    const cs = makeCombatSummary([
      makeCreature('Goblin'),
      makeCreature('Fighter'),
    ]);
    cs.creatures[0].targetName = 'Fighter';

    const result = getTargetFromAttacker(cs, 'Goblin');
    expect(result.name).toBe('Fighter');
  });

  it('returns null when target creature not found in creatures array', () => {
    const cs = makeCombatSummary([
      makeCreature('Goblin', { targetName: 'MissingTarget' }),
    ]);
    expect(getTargetFromAttacker(cs, 'Goblin')).toBeNull();
  });
});

// ── getAttackerTargetName ──────────────────────────────────────

describe('getAttackerTargetName', () => {
  it('returns null when combatSummary is null', () => {
    expect(getAttackerTargetName(null, 'Goblin')).toBeNull();
  });

  it('returns null when attacker not found', () => {
    const cs = makeCombatSummary([makeCreature('Orc')]);
    expect(getAttackerTargetName(cs, 'Ghost')).toBeNull();
  });

  it('returns targetName when attacker has one', () => {
    const cs = makeCombatSummary([makeCreature('Goblin', { targetName: 'Fighter' })]);
    expect(getAttackerTargetName(cs, 'Goblin')).toBe('Fighter');
  });

  it('returns null when attacker has no targetName property', () => {
    const cs = makeCombatSummary([makeCreature('Goblin')]);
    expect(getAttackerTargetName(cs, 'Goblin')).toBeNull();
  });

  it('returns null when targetName is explicitly undefined', () => {
    const cs = makeCombatSummary([makeCreature('Goblin', { targetName: undefined })]);
    expect(getAttackerTargetName(cs, 'Goblin')).toBeNull();
  });

  it('returns null when targetName is an empty string', () => {
    const cs = makeCombatSummary([makeCreature('Goblin', { targetName: '' })]);
    expect(getAttackerTargetName(cs, 'Goblin')).toBeNull();
  });
});

// ── computePlayerAc (async, uses loadEquipment + parseMagicItemName) ────

describe('computePlayerAc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDataCache();
  });

  it('returns 10 when character is null', async () => {
    expect(await computePlayerAc(null)).toBe(10);
  });

  it('returns 10 when character has no abilities and no equipment', async () => {
    loadEquipment.mockResolvedValueOnce([]);
    expect(await computePlayerAc({})).toBe(10);
  });

  it('returns 10 + dex bonus when loadEquipment returns empty array', async () => {
    loadEquipment.mockResolvedValueOnce([]);
    const char = makeCharacter([{ name: 'Dexterity', baseScore: 16 }]);
    expect(await computePlayerAc(char)).toBe(13);
  });

  it('returns 10 + dex bonus when loadEquipment returns null', async () => {
    loadEquipment.mockResolvedValueOnce(null);
    const char = makeCharacter([{ name: 'Dexterity', baseScore: 14 }]);
    expect(await computePlayerAc(char)).toBe(12);
  });

  it('uses ab.bonus directly when available instead of computing from baseScore', async () => {
    loadEquipment.mockResolvedValueOnce([]);
    const char = makeCharacter([{ name: 'Dexterity', bonus: 4 }]);
    expect(await computePlayerAc(char)).toBe(14);
  });

  it('handles missing abilities array gracefully', async () => {
    loadEquipment.mockResolvedValueOnce([]);
    const char = {};
    expect(await computePlayerAc(char)).toBe(10);
  });

  // ── Armor paths with equipment ──

  it('computes AC with armor that has no dex_bonus (armor base only)', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Chain Mail', equipment_category: 'Armor', armor_class: { base: 16 } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Chain Mail' });
    const char = {
      abilities: [{ name: 'Dexterity', baseScore: 20 }],
      inventory: { equipped: ['Chain Mail'] },
    };
    expect(await computePlayerAc(char)).toBe(16);
  });

  it('computes AC with armor + dex bonus when dex_bonus is true and no max_bonus', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Leather Armor' });
    const char = {
      abilities: [{ name: 'Dexterity', baseScore: 18 }],
      inventory: { equipped: ['Leather Armor'] },
    };
    expect(await computePlayerAc(char)).toBe(15);
  });

  it('caps dex bonus at max_bonus when specified', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Studded Leather', equipment_category: 'Armor', armor_class: { base: 12, dex_bonus: true, max_bonus: 2 } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Studded Leather' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: 5 }],
      inventory: { equipped: ['Studded Leather'] },
    };
    expect(await computePlayerAc(char)).toBe(14);
  });

  it('adds shield bonus on top of armor AC', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Scale Mail', equipment_category: 'Armor', armor_class: { base: 14 } },
      { name: 'Shield', equipment_category: 'Shield' },
    ]);
    parseMagicItemName
      .mockReturnValueOnce({ baseName: 'Scale Mail' })
      .mockReturnValueOnce({ baseName: 'Shield' });
    const char = {
      abilities: [{ name: 'Dexterity', baseScore: 10 }],
      inventory: { equipped: ['Scale Mail', 'Shield'] },
    };
    expect(await computePlayerAc(char)).toBe(16);
  });

  it('uses parseMagicItemName to strip magic prefixes from equipped items', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Plate Armor', equipment_category: 'Armor', armor_class: { base: 18 } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Plate Armor' });
    const char = {
      abilities: [{ name: 'Dexterity', baseScore: 10 }],
      inventory: { equipped: ['+2 Plate Armor'] },
    };
    expect(await computePlayerAc(char)).toBe(18);
  });

  it('ignores equipped items not found in equipment list', async () => {
    loadEquipment.mockResolvedValueOnce([]);
    parseMagicItemName.mockReturnValue({ baseName: 'Ghost Armor' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: 3 }],
      inventory: { equipped: ['Ghost Armor'] },
    };
    expect(await computePlayerAc(char)).toBe(13);
  });

  it('falls back to 10 + dex when only shield equipped (no armor)', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Shield', equipment_category: 'Shield' },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Shield' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: 3 }],
      inventory: { equipped: ['Shield'] },
    };
    expect(await computePlayerAc(char)).toBe(13);
  });

  it('ignores non-armor and non-shield equipped items', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Chain Shirt', equipment_category: 'Armor', armor_class: { base: 13, dex_bonus: true, max_bonus: 2 } },
      { name: 'Potion', equipment_category: 'Other' },
    ]);
    parseMagicItemName
      .mockReturnValueOnce({ baseName: 'Chain Shirt' })
      .mockReturnValueOnce({ baseName: 'Potion' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: 5 }],
      inventory: { equipped: ['Chain Shirt', 'Potion'] },
    };
    expect(await computePlayerAc(char)).toBe(15);
  });

  it('handles zero dex bonus with armor', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Chain Mail', equipment_category: 'Armor', armor_class: { base: 16 } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Chain Mail' });
    const char = {
      abilities: [{ name: 'Dexterity', baseScore: 10 }],
      inventory: { equipped: ['Chain Mail'] },
    };
    expect(await computePlayerAc(char)).toBe(16);
  });

  it('handles negative dex bonus with armor', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Leather Armor' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: -2 }],
      inventory: { equipped: ['Leather Armor'] },
    };
    expect(await computePlayerAc(char)).toBe(9);
  });

  it('handles negative dex bonus without armor', async () => {
    loadEquipment.mockResolvedValueOnce([]);
    const char = makeCharacter([{ name: 'Dexterity', baseScore: 7 }]);
    expect(await computePlayerAc(char)).toBe(8);
  });

  it('respects max_bonus of 0 (no dex bonus allowed)', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Heavy Plate', equipment_category: 'Armor', armor_class: { base: 18, dex_bonus: true, max_bonus: 0 } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Heavy Plate' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: 5 }],
      inventory: { equipped: ['Heavy Plate'] },
    };
    expect(await computePlayerAc(char)).toBe(18);
  });

  it('defaults max_bonus to 99 when null (no effective cap)', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Armor' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: 5 }],
      inventory: { equipped: ['Armor'] },
    };
    expect(await computePlayerAc(char)).toBe(16);
  });

  it('handles armor_class being undefined on an Armor-item (falls back to base 0)', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Magic Sword', equipment_category: 'Armor' },
    ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Magic Sword' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: 3 }],
      inventory: { equipped: ['Magic Sword'] },
    };
    expect(await computePlayerAc(char)).toBe(0);
  });

  it('handles inventory.equipped being undefined on character', async () => {
    loadEquipment.mockResolvedValueOnce([
      { name: 'Chain Mail', equipment_category: 'Armor', armor_class: { base: 16 } },
    ]);
    const char = makeCharacter([{ name: 'Dexterity', bonus: 2 }]);
    expect(await computePlayerAc(char)).toBe(12);
  });
});

// ── computeAcEstimate (sync, no IO) ────────────────────────────

describe('computeAcEstimate', () => {
  it('returns 10 when character is null', () => {
    expect(computeAcEstimate(null)).toBe(10);
  });

  it('returns 10 when character has no abilities', () => {
    expect(computeAcEstimate({})).toBe(10);
  });

  it('returns 10 + dex bonus from ab.bonus field', () => {
    const char = makeCharacter([{ name: 'Dexterity', bonus: 3 }]);
    expect(computeAcEstimate(char)).toBe(13);
  });

  it('computes dex bonus from baseScore when ab.bonus is absent', () => {
    const char = makeCharacter([{ name: 'Dexterity', baseScore: 18 }]);
    expect(computeAcEstimate(char)).toBe(14);
  });

  it('returns 10 when Dexterity ability not found in abilities array', () => {
    const char = makeCharacter([{ name: 'Strength', bonus: 5 }]);
    expect(computeAcEstimate(char)).toBe(10);
  });

  it('handles negative dex bonus', () => {
    const char = makeCharacter([{ name: 'Dexterity', bonus: -2 }]);
    expect(computeAcEstimate(char)).toBe(8);
  });

  it('handles zero dex bonus', () => {
    const char = makeCharacter([{ name: 'Dexterity', baseScore: 10 }]);
    expect(computeAcEstimate(char)).toBe(10);
  });

  it('prefers ab.bonus over computing from baseScore', () => {
    const char = makeCharacter([{ name: 'Dexterity', bonus: 3, baseScore: 20 }]);
    expect(computeAcEstimate(char)).toBe(13);
  });
});
