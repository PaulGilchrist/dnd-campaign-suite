// @maintained-by-ai
// CLA-225: 2024 Martial Arts canonical gate (public/data/2024/classes.json lv1):
// "You can roll 1d6 in place of the normal damage of your Unarmed Strike or
// Monk weapons... Benefits while unarmed or wielding only Monk weapons and
// not wearing armor or wielding a Shield."
// Lane owner (cited by class-features / edge-cases / light-melee / light-ranged):
// the MA eligibility gate AND the lv1-20 d6→d12 die ladder.
import { describe, it, expect, vi } from 'vitest';
import { getAttacks } from './attackCalc2024.js';

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 1),
}));

// ---------------------------------------------------------------------------
// Catalog fixtures — copied from public/data/equipment.json (verified 2026-10-20)
// ---------------------------------------------------------------------------

const QUARTERSTAFF = {
  name: 'Quarterstaff',
  equipment_category: 'Weapon',
  weapon_range: 'Melee',
  properties: ['Versatile', 'Monk'],
  damage: { damage_dice: '1d6', damage_type: 'Bludgeoning' },
  range: { normal: '5_ft' },
  mastery: 'Topple',
};
const CLUB = {
  name: 'Club',
  equipment_category: 'Weapon',
  weapon_range: 'Melee',
  properties: ['Light', 'Monk'],
  damage: { damage_dice: '1d4', damage_type: 'Bludgeoning' },
  range: { normal: '5_ft' },
};
const LEATHER = { name: 'Leather', equipment_category: 'Armor', armor_category: 'Light' };
const SHIELD = { name: 'Shield', equipment_category: 'Armor', armor_category: 'Shield' };
const LONGSWORD = {
  name: 'Longsword',
  equipment_category: 'Weapon',
  weapon_range: 'Melee',
  properties: ['Versatile'],
  damage: { damage_dice: '1d8', damage_type: 'Slashing' },
  range: { normal: '5_ft' },
  mastery: 'Sap',
};
const BEDROLL = { name: 'Bedroll', equipment_category: 'Adventuring Gear' };

const CATALOG = [QUARTERSTAFF, CLUB, LEATHER, SHIELD, LONGSWORD, BEDROLL];

// Canonical lv1-20 ladder from public/data/2024/classes.json (Monk):
// lv1-4 d6, lv5-10 d8, lv11-16 d10, lv17-20 d12.
const LADDER = Array.from({ length: 20 }, (_, i) => {
  const level = i + 1;
  const die = level <= 4 ? 6 : level <= 10 ? 8 : level <= 16 ? 10 : 12;
  return [level, die];
});

const classLevels = () => LADDER.map(([level, die]) => ({ level, martial_arts_die: die }));

// STR 16 (+3), DEX 20 (+5), PB +6 at lv20 → +11 to hit.
const monk = (equipped, level = 20) => ({
  name: 'Disciplined_Monk',
  level,
  abilities: [
    { name: 'Strength', bonus: 3 },
    { name: 'Dexterity', bonus: 5 },
  ],
  inventory: { equipped },
  automation: { passives: [], bonusActions: [] },
  class: { name: 'Monk', class_levels: classLevels() },
});

const unarmedRows = rows => rows.filter(a => a.name === 'Unarmed Strike');
const rowFor = (rows, name) => rows.find(a => a.name === name);

// ---------------------------------------------------------------------------
// Gate closure — each disjunct of the canonical gate gets its own falsifier:
// checkAnyArmor (category-based) and checkShieldEquipped (name-based) are an
// OR, so armor-alone and shield-alone are both required; a combined case adds
// no unique coverage and was removed.
// ---------------------------------------------------------------------------

describe('CLA-225 armor/shield gate', () => {
  it('closes the gate with armor alone (Leather, no Shield)', () => {
    const result = getAttacks(CATALOG, [], monk(['Quarterstaff', 'Leather']));

    expect(unarmedRows(result)).toHaveLength(0);
    expect(rowFor(result, 'Quarterstaff').damage).toBe('1d6+5');
  });

  it('closes the gate with a Shield alone (no armor)', () => {
    const result = getAttacks(CATALOG, [], monk(['Quarterstaff', 'Shield']));

    expect(unarmedRows(result)).toHaveLength(0);
    expect(rowFor(result, 'Quarterstaff').damage).toBe('1d6+5');
  });

  it('closes the gate while wielding a non-Monk weapon (Longsword)', () => {
    const result = getAttacks(CATALOG, [], monk(['Longsword']));

    expect(unarmedRows(result)).toHaveLength(0);
    expect(rowFor(result, 'Longsword').damage).toBe('1d8+5');
  });

  it('keeps the gate open for equipped items that are not weapons', () => {
    const result = getAttacks(CATALOG, [], monk(['Quarterstaff', 'Bedroll']));

    expect(unarmedRows(result)).toHaveLength(2);
    expect(rowFor(result, 'Quarterstaff').damage).toBe('1d12+5');
  });

  it('non-Monk classes never receive MA rows (Fighter in Leather)', () => {
    const armored = getAttacks(CATALOG, [], {
      ...monk(['Quarterstaff', 'Leather']),
      class: { name: 'Fighter' },
    });
    // Unarmored Monk-weapon loadout too: with armor equipped the armor gate
    // would also close the gate, so this is the case that pins the CLASS guard.
    const unarmed = getAttacks(CATALOG, [], {
      ...monk(['Quarterstaff']),
      class: { name: 'Fighter' },
    });

    expect(unarmedRows(armored)).toHaveLength(0);
    expect(rowFor(armored, 'Quarterstaff').damage).toBe('1d6+5');
    expect(unarmedRows(unarmed)).toHaveLength(0);
    // Fighter staff keeps its normal damage — no MA d12 swap either.
    expect(rowFor(unarmed, 'Quarterstaff').damage).toBe('1d6+5');
  });
});

// ---------------------------------------------------------------------------
// Gate open — MA die replaces normal damage of every Monk weapon row and the
// Unarmed Strike rows, across the full canonical lv1-20 ladder.
// ---------------------------------------------------------------------------

describe('CLA-225 MA die replaces Monk weapon damage', () => {
  it('lv20 Quarterstaff-only: quarterstaff row is 1d12+DEX, MA unarmed rows present', () => {
    const result = getAttacks(CATALOG, [], monk(['Quarterstaff']));

    const staff = rowFor(result, 'Quarterstaff');
    expect(staff.damage).toBe('1d12+5');
    expect(staff.damageFormula).toContain('1d12');
    expect(staff.hitBonus).toBe(11); // Math.max(STR 3, DEX 5) + PB 6

    const unarmed = unarmedRows(result);
    expect(unarmed).toHaveLength(2);
    expect(unarmed.map(a => a.type)).toEqual(['Action', 'Bonus Action']);
    expect(unarmed[0].damage).toBe('1d12+5');
  });

  it.each(LADDER)('lv%i: MA die 1d%i applies to Quarterstaff row', (level, die) => {
    const result = getAttacks(CATALOG, [], monk(['Quarterstaff'], level));

    expect(rowFor(result, 'Quarterstaff').damage).toBe(`1d${die}+5`);
    const unarmed = unarmedRows(result);
    expect(unarmed.length).toBeGreaterThan(0);
    expect(unarmed[0].damage).toBe(`1d${die}+5`);
  });

  it('light Monk weapon (Club) row also receives the MA die', () => {
    const result = getAttacks(CATALOG, [], monk(['Quarterstaff', 'Club']));

    expect(rowFor(result, 'Club').damage).toBe('1d12+5');
    expect(rowFor(result, 'Quarterstaff').damage).toBe('1d12+5');
  });
});
