// @maintained-by-ai
// Abilities-guard lane for 2024 getAttacks (attackCalc2024.js) — ledgers #1236
// (playerStats.abilities.find unguarded at the 4 apex find sites: absent
// 'abilities' KEY throws TypeError) and #1243 (bare ctx.strength.bonus /
// ctx.dexterity.bonus derefs for equipped weapons throw on missing rows).
// Single contract (fix#115): local findAbility(playerStats, name) logs loudly
// at the absent-key apex and returns row-or-null; weapon-calc lanes that
// threw today REFUSE their rows (no fabricated +0, fix#39 strict-presence);
// lanes with pre-existing `?.bonus || 0` display tolerance keep their exact
// bytes (edge-cases.test.js:123-131 pins 'empty abilities array → zero-mod
// row, no throw' — that tolerance is the blessed consumer contract here).
// Lane splits (this file owns ONLY degenerate abilities shapes):
// - happy-path byte pins → attackCalc2024.test.js, -light-melee/-light-ranged,
//   -fighting-styles, -nick-dual-wielder, .wm003-nick, .cla225-martial-arts-gate
// - proficiency ladder + fallback bytes → attackCalc2024-edge-cases.test.js:76-160
// - Swift Quiver concentration mechanics → attackCalc2024-special-attacks.test.js
// - class-feature row shapes → attackCalc2024-class-features.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAttacks } from './attackCalc2024.js';
import { getAttacks as getAttacks5e } from './attackCalc.js';
import { getCombatSummary } from '../../encounters/combatData.js';

// Unavoidable mock only: SSE/runtime-backed combat summary (Swift Quiver gate
// reads it on every getAttacks call; null = concentration inactive).
vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 1),
}));

// ---------------------------------------------------------------------------
// Fixtures — weapon shapes copied from attackCalc2024-edge-cases.test.js and
// public/data/equipment.json (shortbow / longsword).
// ---------------------------------------------------------------------------

const SHORTBOW = {
  name: 'Shortbow',
  equipment_category: 'Weapon',
  weapon_category: 'Simple',
  weapon_range: 'Ranged',
  damage: { damage_dice: '1d6', damage_type: 'Piercing' },
  range: { normal: 80, long: 320 },
  properties: ['Ammunition', 'Two-Handed'],
  mastery: 'Vex',
};

const LONGBOW = {
  name: 'Longbow',
  equipment_category: 'Weapon',
  weapon_category: 'Martial',
  weapon_range: 'Ranged',
  damage: { damage_dice: '1d8', damage_type: 'Piercing' },
  range: { normal: 150, long: 600 },
  properties: ['Ammunition', 'Heavy', 'Two-Handed'],
  mastery: 'Vex',
};

const LONGSWORD = {
  name: 'Longsword',
  equipment_category: 'Weapon',
  weapon_category: 'Martial',
  weapon_range: 'Melee',
  damage: { damage_dice: '1d8', damage_type: 'Slashing' },
  range: { normal: 5, long: 5 },
  properties: ['Versatile'],
  mastery: 'Nick',
};

const CATALOG = [SHORTBOW, LONGBOW, LONGSWORD];

const str = (bonus) => ({ name: 'Strength', bonus });
const dex = (bonus) => ({ name: 'Dexterity', bonus });

const char = ({ level = 1, abilities, equipped = [], cls = { name: 'Fighter' }, name = 'Guard', passives = [] } = {}) => ({
  name,
  level,
  abilities,
  inventory: { equipped },
  automation: { passives, bonusActions: [] },
  activeBuffs: [],
  class: cls,
});

// A character sheet missing the 'abilities' KEY entirely (#1236 apex shape).
const noKeyChar = (over = {}) => {
  const c = char(over);
  delete c.abilities;
  return c;
};

let errSpy;
beforeEach(() => {
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Shape (i): absent 'abilities' key — was TypeError at .find() (:324, :372,
// :484, :541); now findAbility logs loudly at the apex and resolves null.
// ---------------------------------------------------------------------------

describe('attackCalc2024 - absent abilities key declines loudly (#1236)', () => {
  it('absent key + equipped melee & ranged — no throw, weapon lanes refuse, fallback row', () => {
    const result = getAttacks(CATALOG, [], noKeyChar({ equipped: ['Longsword', 'Shortbow'] }));

    // Refused: neither weapon row appears; the sheet falls back to the +0
    // unarmed row (attacks.length === 0 lane, existing in-file contract).
    expect(result.map(r => r.name)).not.toContain('Longsword');
    expect(result.map(r => r.name)).not.toContain('Shortbow');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Unarmed Strike');
    expect(result[0].damage).toBe('1d4+0');
    expect(result[0].hitBonus).toBe(2);

    const logs = errSpy.mock.calls.map(c => c.join(' '));
    expect(logs.some(l => l.includes('#1236') && l.includes("'Strength'"))).toBe(true);
    expect(logs.some(l => l.includes('#1236') && l.includes("'Dexterity'"))).toBe(true);
    expect(logs.some(l => l.includes('refusing equipped ranged weapon rows'))).toBe(true);
    expect(logs.some(l => l.includes('refusing equipped melee weapon rows'))).toBe(true);
  });

  it('Tavern Brawler + absent key — pre-existing `?.bonus || 0` tolerance keeps its +0 row bytes', () => {
    const result = getAttacks([], [], noKeyChar({ passives: [{ effect: 'tavern_brawler_push' }] }));

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Unarmed Strike');
    expect(result[0].weaponType).toBe('unarmed');
    expect(result[0].damage).toBe('1d4+0');
    expect(result[0].hitBonus).toBe(2);
    // Absent-key apex is loud even where the row tolerates a missing result.
    expect(errSpy.mock.calls.some(c => String(c[0]).includes('#1236'))).toBe(true);
  });

  it('Soulknife + absent key — tolerant +0 Psychic Blade pair, no throw', () => {
    const result = getAttacks([], [], noKeyChar({
      level: 3,
      cls: { name: 'Rogue', major: { name: 'Soulknife' } },
    }));

    const blades = result.filter(r => r.name === 'Psychic Blade');
    expect(blades).toHaveLength(2);
    expect(blades[0].damage).toBe('1d6+0');
    expect(blades[1].damage).toBe('1d4');
    expect(blades[0].hitBonus).toBe(2);
    expect(errSpy.mock.calls.some(c => String(c[0]).includes('#1236'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Shape (ii): EMPTY abilities array — find() returned undefined and the bare
// .bonus derefs threw for equipped weapons (ledger #1243 '241-242-era').
// Today's producer guarantee (abilityCalc2024.js:7 playerStats.abilities.map)
// means the rules.js pipeline can emit [] but never an absent key.
// ---------------------------------------------------------------------------

describe('attackCalc2024 - empty abilities array refuses weapon lanes (#1243)', () => {
  it('empty abilities + equipped melee & ranged — weapon rows refused loudly, fallback +0 row', () => {
    const result = getAttacks(CATALOG, [], char({ abilities: [], equipped: ['Longsword', 'Shortbow'] }));

    expect(result.map(r => r.name)).not.toContain('Longsword');
    expect(result.map(r => r.name)).not.toContain('Shortbow');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Unarmed Strike');
    expect(result[0].damage).toBe('1d4+0');

    const logs = errSpy.mock.calls.map(c => c.join(' '));
    expect(logs.some(l => l.includes('refusing equipped ranged weapon rows'))).toBe(true);
    expect(logs.some(l => l.includes('refusing equipped melee weapon rows'))).toBe(true);
    // Key PRESENT: absent-key apex log must NOT fire (#1236 vs #1243 distinct shapes).
    expect(logs.some(l => l.includes('#1236'))).toBe(false);
  });

  it('Strength row missing, Dexterity present, equipped melee — melee refuses, no fabricated STR row', () => {
    const result = getAttacks(CATALOG, [], char({ abilities: [dex(3)], equipped: ['Longsword'] }));

    expect(result.map(r => r.name)).not.toContain('Longsword');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Unarmed Strike');
    expect(result[0].damage).toBe('1d4+0');
    expect(errSpy.mock.calls.some(c => String(c[0]).includes('refusing equipped melee weapon rows'))).toBe(true);
  });

  it('College of Dance missing Dexterity row — footwork lanes refuse loudly, STR fallback survives', () => {
    const result = getAttacks([], [], char({
      level: 3,
      abilities: [str(3)],
      cls: { name: 'Bard', subclass: { name: 'College of Dance' }, class_levels: [{ level: 3, bardic_die: 8 }] },
    }));

    expect(result.map(r => r.name)).not.toContain('Unarmed Strike (Dance)');
    expect(result).toHaveLength(1);
    expect(result[0].damage).toBe('1d4+3');
    expect(errSpy.mock.calls.some(c => String(c[0]).includes('refusing College of Dance footwork rows'))).toBe(true);
  });

  it('Swift Quiver concentration + empty abilities — tolerant +0 row bytes (existing `dex?.bonus || 0` contract)', () => {
    vi.mocked(getCombatSummary).mockReturnValueOnce({
      creatures: [{ name: 'Guard', concentration: { spell: 'Swift Quiver' } }],
    });
    const result = getAttacks([LONGBOW], [], char({ abilities: [], equipped: ['Longbow'] }));

    const quiver = result.filter(r => r.isSwiftQuiver);
    expect(quiver).toHaveLength(2);
    expect(quiver[0].damage).toBe('1d8+0');
    expect(quiver[0].hitBonus).toBe(2);
  });

  it('empty abilities + NO weapons — pinned fallback bytes unchanged (mirrors edge-cases.test.js:123-131)', () => {
    const result = getAttacks([], [{}], char({ level: 5, abilities: [] }));

    expect(result).toHaveLength(1);
    const row = result[0];
    expect(row.name).toBe('Unarmed Strike');
    expect(row.damage).toBe('1d4+0');
    expect(row.hitBonus).toBe(3);
    expect(row.hitBonusFormula).toBe('To Hit Bonus Formula = Strength Bonus (0) + Proficiency (3)');
    // No weapon equipped: refuse lanes never fire — quiet, as pinned before.
    expect(errSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Regression: full abilities — guard is behavior-neutral, rows byte-intact.
// ---------------------------------------------------------------------------

describe('attackCalc2024 - full abilities byte-intact through guard', () => {
  it('Shortbow lv1 DEX +4 — exact row bytes unchanged, zero console.error', () => {
    const result = getAttacks([SHORTBOW], [], char({ abilities: [str(0), dex(4)], equipped: ['Shortbow'] }));

    expect(result).toHaveLength(1);
    const row = result[0];
    expect(row.name).toBe('Shortbow');
    expect(row.type).toBe('Action');
    expect(row.range).toBe(80);
    expect(row.damage).toBe('1d6+4');
    expect(row.hitBonus).toBe(6);
    expect(row.hitBonusFormula).toBe('To Hit Bonus Formula = Dexterity Bonus (4) + Proficiency (2)');
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('Longsword STR +4 vs DEX +2 — max-select arithmetic through the guarded melee ctx bytes-intact', () => {
    const result = getAttacks([LONGSWORD], [], char({ abilities: [str(4), dex(2)], equipped: ['Longsword'] }));

    expect(result).toHaveLength(1);
    const row = result[0];
    expect(row.name).toBe('Longsword');
    expect(row.hitBonus).toBe(6);
    expect(row.hitBonusFormula).toBe('To Hit Bonus Formula = Strength Bonus (4) + Proficiency (2)');
    expect(row.damage).toBe('1d8+4');
    expect(errSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5e twin state (report-only pin, per ledger scope "fix ONLY 2024"):
// attackCalc.js keeps the identical unguarded shape at :495-496 (apex find)
// and :441-442 (ctx.bonus derefs). This pin documents the parity divergence
// — if the 5e twin is hardened in its own ledger, this test flips and the
// drift is caught, not silenced.
// ---------------------------------------------------------------------------

describe('attackCalc2024 - 5e twin parity state (out-of-scope, pinned honestly)', () => {
  it('attackCalc.js still THROWS TypeError on absent abilities key (twin unfixed, noted not fixed here)', () => {
    expect(() => getAttacks5e([], [], noKeyChar({ equipped: ['Longsword'] }))).toThrow(TypeError);
  });

  it('attackCalc2024.js does NOT throw on the same input (2024 hardened per #1236)', () => {
    expect(() => getAttacks([], [], noKeyChar({ equipped: ['Longsword'] }))).not.toThrow();
  });
});
