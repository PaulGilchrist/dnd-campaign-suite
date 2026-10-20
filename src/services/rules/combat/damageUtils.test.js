// @maintained-by-ai
// Base unit lane for damageUtils.js: damage-type extraction/formatting, resistance
// notices, change-data envelope handling (falsy campaign / URL encoding / not-ok /
// missing summary), creature+target lookup, and AC math.
// The LIVE-vs-baked activeCreatureName precedence is owned by
// damageUtils.live-active-boundary.test.js — deliberately not re-driven here.
// Legendary-uses economy truth-table lives in monsterLegendaryUses.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(),
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

import { loadEquipment } from '../../ui/dataLoader.js';
import { parseMagicItemName } from '../core/attackCalc.js';

// ── Helpers ─────────────────────────────────────────────────────

const armor = (name, base, dex = {}) => ({
  name,
  equipment_category: 'Armor',
  armor_class: { base, ...dex },
});

const shield = (name = 'Shield') => ({ name, equipment_category: 'Shield' });

const cs = (...creatures) => ({ round: 1, creatures });

const dexChar = (dex, equipped) => ({
  abilities: [dex],
  ...(equipped ? { inventory: { equipped } } : {}),
});

function stubFetch(payload) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(payload),
  })));
}

// ── extractDamageTypes ────────────────────────────────────────

describe('extractDamageTypes', () => {
  it('returns [] for missing, non-string, or type-free descriptions', () => {
    for (const input of [null, undefined, 42, {}, [], 'The monster roars aggressively', 'The target takes no damage']) {
      expect(extractDamageTypes(input)).toEqual([]);
    }
  });

  it('finds one or more damage types in a description, case-insensitively', () => {
    expect(extractDamageTypes('The blade deals 1d8 slashing damage')).toEqual(['Slashing']);
    expect(extractDamageTypes('necrotic blast')).toEqual(['Necrotic']);
    expect(extractDamageTypes('COLD DAMAGE')).toEqual(['Cold']);
    expect(extractDamageTypes('Deals 2d6 fire and lightning damage')).toEqual(['Fire', 'Lightning']);
    // Output order is the fixed rules-table order, not mention order.
    expect(extractDamageTypes('fire damage and cold damage')).toEqual(['Cold', 'Fire']);
  });

  it('respects word boundaries so longer words are not partial matches', () => {
    expect(extractDamageTypes('Thundering noise')).toEqual([]);
    expect(extractDamageTypes('Acidic')).toEqual([]);
    expect(extractDamageTypes('Fireball')).toEqual([]);
  });

  it('recognises every published damage type', () => {
    const allDamageTypes = [
      'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning',
      'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder',
    ];
    for (const dt of allDamageTypes) {
      expect(extractDamageTypes(`${dt} damage`)).toEqual([dt]);
    }
  });
});

// ── formatDamageTypes ──────────────────────────────────────────

describe('formatDamageTypes', () => {
  it('joins types with / and returns null when there is nothing to join', () => {
    expect(formatDamageTypes(null)).toBeNull();
    expect(formatDamageTypes(undefined)).toBeNull();
    expect(formatDamageTypes([])).toBeNull();
    expect(formatDamageTypes(['Fire'])).toBe('Fire');
    expect(formatDamageTypes(['Fire', 'Necrotic'])).toBe('Fire/Necrotic');
    expect(formatDamageTypes(['Cold', 'Thunder', 'Force'])).toBe('Cold/Thunder/Force');
  });
});

// ── getResistanceNotice ────────────────────────────────────────

describe('getResistanceNotice', () => {
  it('returns null when nothing matches or there is nothing to match', () => {
    expect(getResistanceNotice(null, [], [], 'Orc')).toBeNull();
    expect(getResistanceNotice(undefined, [], [], 'Orc')).toBeNull();
    expect(getResistanceNotice([], [], [], 'Orc')).toBeNull();
    expect(getResistanceNotice([undefined], ['Fire'], [], 'Dragon')).toBeNull();
    expect(getResistanceNotice([''], ['Fire'], [], 'Dragon')).toBeNull();
    expect(getResistanceNotice(['Fire'], undefined, undefined, 'Goblin')).toBeNull();
    expect(getResistanceNotice(['Fire'], ['cold'], ['lightning'], 'Orc')).toBeNull();
  });

  it('reports IMMUNE / resists case-insensitively, preserving input casing and joining matches', () => {
    expect(getResistanceNotice(['Fire'], [], ['fire'], 'Dragon')).toBe('Dragon is IMMUNE to Fire');
    expect(getResistanceNotice(['Cold'], ['Cold'], [], 'Ice Golem')).toBe('Ice Golem resists Cold');
    expect(getResistanceNotice(['NECROTIC'], [], ['necrotic'], 'Skeleton')).toBe('Skeleton is IMMUNE to NECROTIC');
    expect(getResistanceNotice(['Fire', 'Cold'], [], ['fire', 'cold'], 'Dragon')).toBe('Dragon is IMMUNE to Fire, Cold');
    expect(getResistanceNotice(['Fire', 'Cold'], ['fire', 'cold'], [], 'Orc')).toBe('Orc resists Fire, Cold');
  });

  it('immunity beats resistance per type, and any immunity suppresses the resist line', () => {
    expect(getResistanceNotice(['Fire'], ['fire'], ['fire'], 'Dragon')).toBe('Dragon is IMMUNE to Fire');
    // Mixed lists: immune types reported, resisted types dropped entirely.
    expect(getResistanceNotice(['Fire', 'Cold'], ['cold'], ['fire'], 'Dragon')).toBe('Dragon is IMMUNE to Fire');
    // [undefined, 'Fire'] skips the empty entry and still notices the immunity.
    expect(getResistanceNotice([undefined, 'Fire'], [], ['fire'], 'Dragon')).toBe('Dragon is IMMUNE to Fire');
  });
});

// ── getCombatContext ────────────────────────────────────────────

describe('getCombatContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null without fetching when campaignName is falsy', async () => {
    vi.stubGlobal('fetch', vi.fn());
    for (const name of [null, undefined, '']) {
      expect(await getCombatContext(name)).toBeNull();
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches change-data from the URL-encoded campaign path', async () => {
    stubFetch({ combatSummary: { creatures: [] } });
    await getCombatContext('My Campaign 2024');
    expect(fetch).toHaveBeenCalledWith('/api/campaigns/My%20Campaign%202024/change-data');
  });

  it('returns the combatSummary verbatim on ok, null on not-ok / missing summary / fetch error', async () => {
    const summary = { creatures: [{ name: 'Goblin' }] };
    stubFetch({ combatSummary: summary });
    expect(await getCombatContext('test')).toBe(summary);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' }));
    expect(await getCombatContext('test')).toBeNull();

    stubFetch({ otherField: 'data' });
    expect(await getCombatContext('test')).toBeNull();

    fetch.mockRejectedValueOnce(new Error('network error'));
    expect(await getCombatContext('test')).toBeNull();
  });
});

// ── findCreatureByName ─────────────────────────────────────────

describe('findCreatureByName', () => {
  it('returns null when combatSummary has no creatures list or name is falsy', () => {
    expect(findCreatureByName(null, 'Goblin')).toBeNull();
    expect(findCreatureByName({}, 'Goblin')).toBeNull();
    const summary = cs({ name: 'Goblin' });
    expect(findCreatureByName(summary, null)).toBeNull();
    expect(findCreatureByName(summary, '')).toBeNull();
  });

  it('prefers an exact match (even listed after a prefix candidate), then the first prefix match', () => {
    // Prefix candidate is listed FIRST; exact must still win.
    const summary = cs({ name: 'Goblin Grunt' }, { name: 'Goblin' });
    expect(findCreatureByName(summary, 'Goblin').name).toBe('Goblin');
    expect(findCreatureByName(summary, 'Goblin Grunt').name).toBe('Goblin Grunt');

    // No exact — first prefix match wins.
    const prefixOnly = cs({ name: 'Goblin Grunt' }, { name: 'Goblin Boss' });
    expect(findCreatureByName(prefixOnly, 'Goblin').name).toBe('Goblin Grunt');

    // No match at all: raw Array#find miss → falsy (undefined, not guarded to null).
    expect(findCreatureByName(summary, 'Orc')).toBeFalsy();
  });

  it('requires a word boundary after the prefix', () => {
    const summary = cs({ name: 'Dungeon Master' });
    expect(findCreatureByName(summary, 'Dune')).toBeFalsy();
    expect(findCreatureByName(summary, 'Master')).toBeFalsy();
    expect(findCreatureByName(summary, 'Dun')).toBeFalsy();
  });
});

// ── getTargetFromAttacker / getAttackerTargetName ─────────────

describe('getTargetFromAttacker', () => {
  it('returns null when the attacker is unresolvable or has no resolvable target', () => {
    expect(getTargetFromAttacker(null, 'Goblin')).toBeNull();
    const summary = cs({ name: 'Orc' }, { name: 'Goblin', targetName: 'MissingTarget' });
    expect(getTargetFromAttacker(summary, 'Ghost')).toBeNull();  // attacker absent
    expect(getTargetFromAttacker(summary, 'Orc')).toBeNull();    // no targetName
    expect(getTargetFromAttacker(summary, 'Goblin')).toBeNull(); // target not in initiative
  });

  it('resolves the attacker targetName to the target creature object', () => {
    const fighter = { name: 'Fighter' };
    const summary = cs({ name: 'Goblin', targetName: 'Fighter' }, fighter);
    expect(getTargetFromAttacker(summary, 'Goblin')).toBe(fighter);
  });
});

describe('getAttackerTargetName', () => {
  it('returns the attacker targetName when present, null otherwise', () => {
    expect(getAttackerTargetName(cs({ name: 'Goblin', targetName: 'Fighter' }), 'Goblin')).toBe('Fighter');
    expect(getAttackerTargetName(null, 'Goblin')).toBeNull();
    expect(getAttackerTargetName(cs({ name: 'Orc' }), 'Ghost')).toBeNull();
    expect(getAttackerTargetName(cs({ name: 'Goblin' }), 'Goblin')).toBeNull();
    expect(getAttackerTargetName(cs({ name: 'Goblin', targetName: undefined }), 'Goblin')).toBeNull();
    expect(getAttackerTargetName(cs({ name: 'Goblin', targetName: '' }), 'Goblin')).toBeNull();
  });
});

// ── computePlayerAc (loadEquipment + parseMagicItemName stubs) ────

describe('computePlayerAc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Contract stub for the OTHER module: strip "+N " magic prefixes.
    parseMagicItemName.mockImplementation(name => ({
      baseName: String(name).replace(/^\+\d+\s/, ''),
    }));
  });

  it('returns 10 for a null character WITHOUT loading equipment; 10 + Dex when equipment list is empty', async () => {
    expect(await computePlayerAc(null)).toBe(10);
    expect(loadEquipment).not.toHaveBeenCalled();

    loadEquipment.mockResolvedValueOnce([]);
    expect(await computePlayerAc({})).toBe(10);

    loadEquipment.mockResolvedValueOnce([]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', baseScore: 16 }))).toBe(13);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', bonus: 4 }))).toBe(14);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', bonus: -2 }))).toBe(8);
  });

  it('applies armor_class: base only, +dex, max_bonus cap, negative dex, missing fields', async () => {
    // No dex_bonus flag → Dex ignored entirely (even +5).
    loadEquipment.mockResolvedValueOnce([armor('Chain Mail', 16)]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', baseScore: 20 }, ['Chain Mail']))).toBe(16);

    // dex_bonus:true → full dex.
    loadEquipment.mockResolvedValueOnce([armor('Leather Armor', 11, { dex_bonus: true })]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', baseScore: 18 }, ['Leather Armor']))).toBe(15);

    // Capped dex.
    loadEquipment.mockResolvedValueOnce([armor('Studded Leather', 12, { dex_bonus: true, max_bonus: 2 })]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', bonus: 5 }, ['Studded Leather']))).toBe(14);

    // max_bonus 0 blocks dex without disabling the armor itself.
    loadEquipment.mockResolvedValueOnce([armor('Heavy Plate', 18, { dex_bonus: true, max_bonus: 0 })]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', bonus: 5 }, ['Heavy Plate']))).toBe(18);

    // null max_bonus means no effective cap (defaults to 99).
    loadEquipment.mockResolvedValueOnce([armor('Armor', 11, { dex_bonus: true, max_bonus: null })]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', bonus: 5 }, ['Armor']))).toBe(16);

    // Negative dex applies through armor.
    loadEquipment.mockResolvedValueOnce([armor('Leather Armor', 11, { dex_bonus: true })]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', bonus: -2 }, ['Leather Armor']))).toBe(9);

    // Wearing two armors: the LAST one in the equipped list wins (current behavior).
    loadEquipment.mockResolvedValueOnce([
      armor('Leather Armor', 11, { dex_bonus: true }),
      armor('Chain Mail', 16),
    ]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', bonus: 3 }, ['Leather Armor', 'Chain Mail']))).toBe(16);
  });

  it('adds the +2 shield with armor, but drops it when no armor is worn (pins current behavior)', async () => {
    loadEquipment.mockResolvedValueOnce([armor('Scale Mail', 14), shield()]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', baseScore: 10 }, ['Scale Mail', 'Shield']))).toBe(16);

    // Shield with no armor: hasArmor fallback recomputes 10+dex, losing the shield bonus.
    loadEquipment.mockResolvedValueOnce([shield()]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', bonus: 3 }, ['Shield']))).toBe(13);
  });

  it('resolves magic-prefixed names, ignores unknown items, non-armor categories, and missing armor_class', async () => {
    // "+2 Plate Armor" resolves via stripped baseName; its own +2 is not double-counted here.
    loadEquipment.mockResolvedValueOnce([armor('Plate Armor', 18)]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', baseScore: 10 }, ['+2 Plate Armor']))).toBe(18);

    // Unknown equipment name → unarmored fallback.
    loadEquipment.mockResolvedValueOnce([]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', bonus: 3 }, ['Ghost Armor']))).toBe(13);

    // Non-armor category (Potion) is skipped; armor still counts.
    loadEquipment.mockResolvedValueOnce([armor('Chain Shirt', 13, { dex_bonus: true, max_bonus: 2 }), { name: 'Potion', equipment_category: 'Other' }]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', bonus: 5 }, ['Chain Shirt', 'Potion']))).toBe(15);

    // Mis-tagged Armor item with no armor_class: base falls to 0 and hasArmor suppresses the 10+dex fallback (current, honest pin).
    loadEquipment.mockResolvedValueOnce([{ name: 'Magic Sword', equipment_category: 'Armor' }]);
    expect(await computePlayerAc(dexChar({ name: 'Dexterity', bonus: 3 }, ['Magic Sword']))).toBe(0);
  });

  it('falls back to 10 + Dex when inventory.equipped is missing', async () => {
    loadEquipment.mockResolvedValueOnce([armor('Chain Mail', 16)]);
    expect(await computePlayerAc({ abilities: [{ name: 'Dexterity', bonus: 2 }] })).toBe(12);
  });
});

// ── computeAcEstimate (sync, no IO) ────────────────────────────

describe('computeAcEstimate', () => {
  it('returns 10 with no character, no abilities, or no Dexterity entry', () => {
    expect(computeAcEstimate(null)).toBe(10);
    expect(computeAcEstimate({})).toBe(10);
    expect(computeAcEstimate({ abilities: [{ name: 'Strength', bonus: 5 }] })).toBe(10);
  });

  it('returns 10 + Dex: explicit bonus preferred, else derived from baseScore, negatives included', () => {
    expect(computeAcEstimate({ abilities: [{ name: 'Dexterity', bonus: 3 }] })).toBe(13);
    expect(computeAcEstimate({ abilities: [{ name: 'Dexterity', bonus: 3, baseScore: 20 }] })).toBe(13);
    expect(computeAcEstimate({ abilities: [{ name: 'Dexterity', baseScore: 18 }] })).toBe(14);
    expect(computeAcEstimate({ abilities: [{ name: 'Dexterity', baseScore: 10 }] })).toBe(10);
    expect(computeAcEstimate({ abilities: [{ name: 'Dexterity', baseScore: 7 }] })).toBe(8);
  });
});
