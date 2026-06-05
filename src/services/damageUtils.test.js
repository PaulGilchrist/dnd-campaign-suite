import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────
// Use inline vi.fn() — no closure over external variables

vi.mock('./dataLoader.js', () => ({
  loadEquipment: vi.fn(),
  clearDataCache: vi.fn(),
}));

vi.mock('./attackCalc.js', () => ({
  parseMagicItemName: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ─────────────────────

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

import { loadEquipment, clearDataCache } from './dataLoader.js';
import { parseMagicItemName } from './attackCalc.js';

// ── Globals ────────────────────────────────────────────────────

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function makeCreature(name, extra = {}) {
  return { name, ...extra };
}

function makeCharacter(abilities) {
  return { abilities };
}

// ── extractDamageTypes ────────────────────────────────────────

describe('extractDamageTypes', () => {
  it('returns empty array when description is null', () => {
    expect(extractDamageTypes(null)).toEqual([]);
  });

  it('returns empty array when description is undefined', () => {
    expect(extractDamageTypes(undefined)).toEqual([]);
  });

  it('returns empty array when description is not a string', () => {
    expect(extractDamageTypes(42)).toEqual([]);
    expect(extractDamageTypes({})).toEqual([]);
    expect(extractDamageTypes([])).toEqual([]);
  });

  it('finds single damage type in description', () => {
    expect(extractDamageTypes('The blade deals 1d8 slashing damage')).toEqual(['Slashing']);
  });

  it('finds multiple damage types in description', () => {
    const result = extractDamageTypes('Deals 2d6 fire and lightning damage');
    expect(result).toContain('Fire');
    expect(result).toContain('Lightning');
  });

  it('matches case-insensitively', () => {
    expect(extractDamageTypes('Necrotic blast')).toEqual(['Necrotic']);
    expect(extractDamageTypes('cold damage')).toEqual(['Cold']);
  });

  it('uses word boundaries — does not partially match', () => {
    // 'Thunder' should NOT match inside 'Thunderbolt sword' when followed by non-word chars is OK, but "Thundering" should not match
    expect(extractDamageTypes('Thundering noise')).toEqual([]);
    expect(extractDamageTypes('slashing attack')).toEqual(['Slashing']);
  });

  it('returns empty array when no damage type words are present', () => {
    expect(extractDamageTypes('This deals psychic energy and radiant power to the target')).toContain('Psychic');
    // Actually let me just test a clean miss
    expect(extractDamageTypes('The monster roars aggressively')).toEqual([]);
  });

  it('matches all known damage types', () => {
    // Test at least a few from each end of the DAMAGE_TYPES list
    expect(extractDamageTypes('Acid splashes everywhere')).toContain('Acid');
    expect(extractDamageTypes('Bludgeoning force hits hard')).toContain('Bludgeoning');
    expect(extractDamageTypes('Thunder shakes the ground')).toContain('Thunder');
  });
});

// ── formatDamageTypes ──────────────────────────────────────────

describe('formatDamageTypes', () => {
  it('returns null when types is null', () => {
    expect(formatDamageTypes(null)).toBeNull();
  });

  it('returns null when types is undefined', () => {
    expect(formatDamageTypes(undefined)).toBeNull();
  });

  it('returns null when types is an empty array', () => {
    expect(formatDamageTypes([])).toBeNull();
  });

  it('joins single type with no separator', () => {
    expect(formatDamageTypes(['Fire'])).toBe('Fire');
  });

  it('joins multiple types with / separator', () => {
    expect(formatDamageTypes(['Fire', 'Necrotic'])).toBe('Fire/Necrotic');
  });

  it('handles three or more types', () => {
    expect(formatDamageTypes(['Cold', 'Thunder', 'Force'])).toBe('Cold/Thunder/Force');
  });
});

// ── getResistanceNotice ────────────────────────────────────────

describe('getResistanceNotice', () => {
  it('returns null when damageTypes is null', () => {
    expect(getResistanceNotice(null, [], [], 'Orc')).toBeNull();
  });

  it('returns null when damageTypes is undefined', () => {
    expect(getResistanceNotice(undefined, [], [], 'Orc')).toBeNull();
  });

  it('returns null when damageTypes is empty array', () => {
    expect(getResistanceNotice([], [], [], 'Orc')).toBeNull();
  });

  it('checks immunity first (case-insensitive)', () => {
    const msg = getResistanceNotice(['Fire'], ['fire'], ['fire'], 'Dragon');
    expect(msg).toBe('Dragon is IMMUNE to Fire');
  });

  it('checks resistance when no immunity match (case-insensitive)', () => {
    const msg = getResistanceNotice(['Cold'], ['Cold'], [], 'Ice Golem');
    expect(msg).toBe('Ice Golem resists Cold');
  });

  it('returns null when no immunity or resistance matches', () => {
    const msg = getResistanceNotice(['Fire'], ['cold'], ['lightning'], 'Orc');
    expect(msg).toBeNull();
  });

  it('handles upper/lower case damage type lookup for immunities', () => {
    const msg = getResistanceNotice(['NECROTIC'], [], ['necrotic'], 'Skeleton');
    expect(msg).toBe('Skeleton is IMMUNE to NECROTIC');
  });

  it('handles upper/lower case damage type lookup for resistances', () => {
    const msg = getResistanceNotice(['THUNDER'], ['Thunder'], [], 'Ogre');
    expect(msg).toBe('Ogre resists THUNDER');
  });

  it('stops at the first matching damage type (early exit)', () => {
    // First damage type matches immunity -> returns immediately
    const msg = getResistanceNotice(['Fire', 'Cold'], [], ['fire'], 'Dragon');
    expect(msg).toBe('Dragon is IMMUNE to Fire');
  });

  it('handles undefined resistances and immunities', () => {
    const msg = getResistanceNotice(['Fire'], undefined, undefined, 'Goblin');
    expect(msg).toBeNull();
  });

  it('handles empty string targetName', () => {
    const msg = getResistanceNotice(['Fire'], [], ['fire'], '');
    expect(msg).toBe(' is IMMUNE to Fire');
  });
});

// ── getCombatContext ────────────────────────────────────────────

describe('getCombatContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  it('returns null when campaignName is falsy', async () => {
    expect(await getCombatContext(null)).toBeNull();
    expect(await getCombatContext(undefined)).toBeNull();
    expect(await getCombatContext('')).toBeNull();
  });

  it('fetches from correct URL with encoded campaign name', async () => {
    const mockResponse = Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ combatSummary: { creatures: [] } }),
    });
    global.fetch.mockResolvedValueOnce(mockResponse);

    await getCombatContext('My Campaign 2024');
    expect(global.fetch).toHaveBeenCalledWith('/api/campaigns/My%20Campaign%202024/combatSummary');
  });

  it('returns combatSummary from response body', async () => {
    const summary = { creatures: [{ name: 'Goblin' }] };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ combatSummary: summary }),
    });

    const result = await getCombatContext('test');
    expect(result).toBe(summary);
  });

  it('returns null when response is not ok', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false });
    const result = await getCombatContext('test');
    expect(result).toBeNull();
  });

  it('returns null when combatSummary field is missing from response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ otherField: 'data' }),
    });
    const result = await getCombatContext('test');
    expect(result).toBeNull();
  });

  it('returns null on fetch error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));
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

  it('returns exact match first', () => {
    const cs = makeCombatSummary([
      makeCreature('Goblin Grunt'),
      makeCreature('Goblin'),
    ]);
    const result = findCreatureByName(cs, 'Goblin');
    expect(result.name).toBe('Goblin');
  });

  it('falls back to startsWith + space match', () => {
    const cs = makeCombatSummary([
      makeCreature('Goblin Leader'),
      makeCreature('Orc'),
    ]);
    const result = findCreatureByName(cs, 'Goblin');
    expect(result.name).toBe('Goblin Leader');
  });

  it('returns undefined when neither exact nor prefix match found', () => {
    const cs = makeCombatSummary([makeCreature('Orc')]);
    const result = findCreatureByName(cs, 'Goblin');
    expect(result).toBeUndefined();
   });

  it('does not match substring without trailing space', () => {
    const cs = makeCombatSummary([makeCreature('Dungeon Master')]);
     // "Dune" — "Dungeon Master".startsWith("Dune ") → false
    expect(findCreatureByName(cs, 'Dune')).toBeUndefined();
     // "Master" — not a start match
    expect(findCreatureByName(cs, 'Master')).toBeUndefined();
     // Partial that doesn't form a word boundary followed by space
    expect(findCreatureByName(cs, 'Dun')).toBeUndefined();
   });
});

// ── getTargetFromAttacker ──────────────────────────────────────

describe('getTargetFromAttacker', () => {
  it('returns null when combatSummary is falsy', () => {
    expect(getTargetFromAttacker(null, 'Goblin')).toBeNull();
  });

  it('returns null when attacker not found', () => {
    const cs = makeCombatSummary([makeCreature('Orc')]);
    expect(getTargetFromAttacker(cs, 'Ghost')).toBeNull();
  });

  it('returns null when attacker has no targetName', () => {
    const cs = makeCombatSummary([makeCreature('Goblin')]); // no targetName
    expect(getTargetFromAttacker(cs, 'Goblin')).toBeNull();
  });

  it('returns the target creature by attacker targetName', () => {
    const cs = makeCombatSummary([
      makeCreature('Goblin'),
      makeCreature('Fighter', { name: 'Fighter' }),
    ]);
    const goblin = cs.creatures[0];
    goblin.targetName = 'Fighter';

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
    clearDataCache(); // reset any cached equipment between tests
  });

  it('returns 10 when character is null', async () => {
    expect(await computePlayerAc(null)).toBe(10);
  });

  it('returns 10 + dex bonus when loadEquipment returns empty array', async () => {
    loadEquipment.mockResolvedValueOnce([]);
    const char = makeCharacter([{ name: 'Dexterity', baseScore: 16 }]); // bonus = 3
    const result = await computePlayerAc(char);
    expect(result).toBe(13); // 10 + Math.floor((16-10)/2) = 3
  });

  it('returns 10 + dex bonus when loadEquipment returns null', async () => {
    loadEquipment.mockResolvedValueOnce(null);
    const char = makeCharacter([{ name: 'Dexterity', baseScore: 14 }]); // bonus = 2
    expect(await computePlayerAc(char)).toBe(12);
  });

  it('uses ab.bonus directly when available instead of computing from baseScore', async () => {
    loadEquipment.mockResolvedValueOnce([]);
    const char = makeCharacter([{ name: 'Dexterity', bonus: 4 }]);
    expect(await computePlayerAc(char)).toBe(14); // 10 + 4
  });

  it('handles missing abilities array gracefully', async () => {
    loadEquipment.mockResolvedValueOnce([]);
    const char = {}; // no abilities property
    expect(await computePlayerAc(char)).toBe(10);
  });

  // ── Armor paths with equipment ──

   it('computes AC with armor (no dex cap) — ac = base armor only', async () => {
    loadEquipment.mockResolvedValueOnce([
       { name: 'Chain Mail', equipment_category: 'Armor', armor_class: { base: 16 } },
     ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Chain Mail' });
    const char = {
      abilities: [{ name: 'Dexterity', baseScore: 20 }], // dexBonus=5 but no dex_bonus flag → armor only.
      inventory: { equipped: ['Chain Mail'] },
     };
    expect(await computePlayerAc(char)).toBe(16);
   });

  it('computes AC with armor + dex bonus (no max_bonus)', async () => {
    loadEquipment.mockResolvedValueOnce([
       { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true } },
     ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Leather Armor' });
      // dexBonus = Math.floor((18-10)/2) = 4. No max_bonus so cap is 99
    const char = {
      abilities: [{ name: 'Dexterity', baseScore: 18 }],
      inventory: { equipped: ['Leather Armor'] },
     };
    expect(await computePlayerAc(char)).toBe(15); // 11 + 4
   });

  it('computes AC with armor + capped dex bonus (max_bonus < actual)', async () => {
    loadEquipment.mockResolvedValueOnce([
       { name: 'Studded Leather', equipment_category: 'Armor', armor_class: { base: 12, dex_bonus: true, max_bonus: 2 } },
     ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Studded Leather' });
      // dexBonus = 5 but capped at 2
    const char = {
      abilities: [{ name: 'Dexterity', bonus: 5 }],
      inventory: { equipped: ['Studded Leather'] },
     };
    expect(await computePlayerAc(char)).toBe(14); // 12 + Math.min(5, 2) = 14
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
    expect(await computePlayerAc(char)).toBe(16); // 14 armor + 2 shield
   });

  it('uses parseMagicItemName to strip magic prefixes from equipped items', async () => {
    loadEquipment.mockResolvedValueOnce([
       { name: 'Plate Armor', equipment_category: 'Armor', armor_class: { base: 18 } },
     ]);
      // Equipped item has +2 prefix
    parseMagicItemName.mockReturnValue({ baseName: 'Plate Armor' });
    const char = {
      abilities: [{ name: 'Dexterity', baseScore: 10 }],
      inventory: { equipped: ['+2 Plate Armor'] },
     };
    expect(await computePlayerAc(char)).toBe(18);
    expect(parseMagicItemName).toHaveBeenCalled();
   });

  it('ignores equipped items not found in equipment list', async () => {
    loadEquipment.mockResolvedValueOnce([
       // empty — no items match
     ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Ghost Armor' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: 3 }],
      inventory: { equipped: ['Ghost Armor'] },
     };
    // No armor found → falls through to naked AC = 10 + dexBonus
    expect(await computePlayerAc(char)).toBe(13);
   });

  it('falls back to 10 + dex when no armor but shield present (no hasArmor)', async () => {
      // Only a shield equipped — not armor, so hasArmor stays false
    loadEquipment.mockResolvedValueOnce([
       { name: 'Shield', equipment_category: 'Shield' },
     ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Shield' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: 3 }],
      inventory: { equipped: ['Shield'] },
     };
    // Shield adds 2 to AC from the loop, but then hasArmor is false so it overwrites ac = 10 + dexBonus
    expect(await computePlayerAc(char)).toBe(13); // 10 + 3 — shield alone triggers no-armor path
   });

  it('handles multiple equipped items including non-armor/non-shield', async () => {
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
    // Chain Shirt: 13 + min(5,2) = 15. Potion is ignored (not Armor or Shield).
    expect(await computePlayerAc(char)).toBe(15);
   });

  it('handles zero dex bonus correctly', async () => {
    loadEquipment.mockResolvedValueOnce([]);
    const char = makeCharacter([{ name: 'Dexterity', baseScore: 10 }]); // bonus = 0
    expect(await computePlayerAc(char)).toBe(10);
  });

  it('handles negative dex bonus correctly (no armor)', async () => {
    loadEquipment.mockResolvedValueOnce([]);
    const char = makeCharacter([{ name: 'Dexterity', baseScore: 7 }]); // bonus = -2
    expect(await computePlayerAc(char)).toBe(8); // 10 + (-2) = 8
  });

   it('handles negative dex bonus with armor cap', async () => {
    loadEquipment.mockResolvedValueOnce([
       { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true } },
      ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Leather Armor' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: -2 }],
      inventory: { equipped: ['Leather Armor'] },
      };
    expect(await computePlayerAc(char)).toBe(9); // 11 + (-2)
    });

  it('handles max_bonus of 0 (no dex bonus allowed)', async () => {
    loadEquipment.mockResolvedValueOnce([
        { name: 'Heavy Plate', equipment_category: 'Armor', armor_class: { base: 18, dex_bonus: true, max_bonus: 0 } },
      ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Heavy Plate' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: 5 }],
      inventory: { equipped: ['Heavy Plate'] },
      };
    expect(await computePlayerAc(char)).toBe(18); // 18 + Math.min(5, 0) = 18
    });

  it('handles max_bonus of null (defaults to 99 cap)', async () => {
    loadEquipment.mockResolvedValueOnce([
        { name: 'Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
      ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Armor' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: 5 }],
      inventory: { equipped: ['Armor'] },
      };
       // max_bonus is null → defaults to 99 → Math.min(5, 99) = 5
    expect(await computePlayerAc(char)).toBe(16);
    });

  it('handles armor_class being undefined on item', async () => {
    loadEquipment.mockResolvedValueOnce([
        { name: 'Magic Sword', equipment_category: 'Armor' }, // no armor_class property
      ]);
    parseMagicItemName.mockReturnValue({ baseName: 'Magic Sword' });
    const char = {
      abilities: [{ name: 'Dexterity', bonus: 3 }],
      inventory: { equipped: ['Magic Sword'] },
      };
     // item.armor_class?.base → undefined → 0, item.armor_class?.dex_bonus → undefined → no dex path
     // ac = 0, hasArmor = true so no naked fallback
    expect(await computePlayerAc(char)).toBe(0);
    });

  it('handles inventory.equipped being undefined on character', async () => {
    loadEquipment.mockResolvedValueOnce([
        { name: 'Chain Mail', equipment_category: 'Armor', armor_class: { base: 16 } },
      ]);
       // No inventory at all — equipped defaults to [] via char.inventory?.equipped || []
    const char = makeCharacter([{ name: 'Dexterity', bonus: 2 }]);
     // equipped = [], loop never runs, hasArmor = false → ac = 10 + 2 = 12
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

  it('returns 10 + dex bonus computed from baseScore when no ab.bonus', () => {
    const char = makeCharacter([{ name: 'Dexterity', baseScore: 18 }]); // floor((18-10)/2) = 4
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
    // ab.bonus is set so it returns that (3) instead of floor((20-10)/2)=5
    expect(computeAcEstimate(char)).toBe(13);
  });
});
