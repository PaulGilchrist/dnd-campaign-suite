// @maintained-by-ai
// Special-attack lane of 2024 getAttacks (attackCalc2024.js): Swift Quiver
// (:478-494) and Starry Form (:595-597) rows.
// Real builders end-to-end per the cla225/edge-cases pattern (#1235/#1236
// canon): the wholesale ./attackCalc.js stub is retired — its old legs echoed
// buildWeaponAttackStub/buildMonkAttacksStub bytes back (stub-echo, deleted).
// The fabricated fixtures carrying equipment_category: 'Ranged' (rec #1236)
// are replaced by disk rows copied from public/data/equipment.json (Longbow,
// index: longbow — verified against disk 2026-10-20); note the disk value is
// 'Weapon' and the real findEquippedWeapons (attackCalc.js:24-33) matches on
// 'Weapon', so the old category would never have resolved un-stubbed. The
// disk Longbow's numeric range {normal: 150, long: 600} keeps the SP-129
// numeric-range pin live for real.
// The classRules2024 mock is deleted: every character here is a non-Monk, so
// the Martial Arts lane (attackCalc2024.js:504-513) is never entered.
// collectWeaponMastery / getRuntimeValue (WM #1240, :140-148) are not stubbed
// and never run: the off-hand lane needs >=2 Light melee weapons and this lane
// equips no Light melee. Only combatData is stubbed (SSE-backed, unavoidable —
// the Swift Quiver gate reads getCombatSummary on every getAttacks call).
// Lane splits (verified 2026-10-20):
// - Starry Form row construction, hitBonusFormula bytes, Chalice null, and the
//   1d8/2d8 Twinkled level scaling → starryFormDamage.test.js:17-52
//   (this file only pins the getAttacks wiring: the row appears/vanishes with
//   playerStats.activeBuffs and spellAbilities.toHit flows through verbatim)
// - Fallback unarmed bytes & proficiency ladder steps PB 4/5 →
//   attackCalc2024-edge-cases.test.js:76-159 (PB 3/6 stay exercised here,
//   as that file's :73 split records)
// - Soulknife Psychic Blade rows → attackCalc2024-class-features.test.js:113-157
// - Swift Quiver sheet rendering → CharBonusActions.swift-quiver.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { getAttacks } from './attackCalc2024.js';
import { getCombatSummary } from '../../encounters/combatData.js';

// Unavoidable mock only: SSE/runtime-backed combat summary.
vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 1),
}));

// ---------------------------------------------------------------------------
// Fixtures — Longbow copied from public/data/equipment.json (index: longbow)
// ---------------------------------------------------------------------------

const LONGBOW = {
  name: 'Longbow',
  equipment_category: 'Weapon',
  weapon_category: 'Martial',
  weapon_range: 'Ranged',
  category_range: 'Martial Ranged',
  damage: { damage_dice: '1d8', damage_type: 'Piercing' },
  range: { normal: 150, long: 600 },
  properties: ['Ammunition', 'Heavy', 'Two-Handed'],
  mastery: 'Slow',
};

const char = ({ level = 1, abilities, equipped = [], campaignName, activeBuffs = [] }) => ({
  level,
  name: 'Test Character',
  abilities,
  inventory: { equipped },
  automation: { passives: [], bonusActions: [] },
  activeBuffs,
  class: { name: 'Fighter' },
  ...(campaignName ? { campaignName } : {}),
});

const concentrateOn = (spell) => ({
  creatures: [{ name: 'Test Character', concentration: spell ? { spell } : undefined }],
});

// ---------------------------------------------------------------------------
// Swift Quiver — two Bonus Action ranged rows while concentrating (SP-129)
// ---------------------------------------------------------------------------

describe('attackCalc2024 - Swift Quiver', () => {
  const dexChar = (level, dexBonus) => char({
    level,
    abilities: [{ name: 'Strength', bonus: 0 }, { name: 'Dexterity', bonus: dexBonus }],
    equipped: ['Longbow'],
  });

  it('concentrating on Swift Quiver adds two Bonus Action rows beside the Longbow Action row', () => {
    vi.mocked(getCombatSummary).mockReturnValue(concentrateOn('Swift Quiver'));

    const result = getAttacks([LONGBOW], [], dexChar(5, 3));

    // The bow keeps its own Action row; SQ adds exactly two bonus rows.
    expect(result.map(a => a.name)).toEqual([
      'Longbow',
      'Swift Quiver (1st Attack)',
      'Swift Quiver (2nd Attack)',
    ]);
    expect(result[0].type).toBe('Action');
    const sqRow = {
      isSwiftQuiver: true,
      isRanged: true,
      attackType: 'ranged',
      type: 'Bonus Action',
      actionType: 'Bonus Action',
      abilityName: 'Dexterity',
      damageType: 'Piercing',
      properties: ['Ammunition'],
      damage: '1d8+3',
      hitBonus: 6,
      toHit: 6,
      range: 600,
    };
    expect(result[1]).toMatchObject({ name: 'Swift Quiver (1st Attack)', ...sqRow });
    expect(result[2]).toMatchObject({ name: 'Swift Quiver (2nd Attack)', ...sqRow });
  });

  it('SP-129 lv17: threads campaignName into the summary gate; disk numeric range + PB 6 fold into the rows', () => {
    vi.mocked(getCombatSummary).mockReturnValue(concentrateOn('Swift Quiver'));

    const result = getAttacks([LONGBOW], [], { ...dexChar(17, 5), campaignName: 'test-campaign' });

    expect(getCombatSummary).toHaveBeenCalledWith('test-campaign');
    const sq = result.find(a => a.isSwiftQuiver);
    expect(result.filter(a => a.isSwiftQuiver)).toHaveLength(2);
    expect(sq.range).toBe(600); // numeric passthrough of disk range.long, not '80_ft'-style string
    expect(sq.damage).toBe('1d8+5');
    expect(sq.damageFormula).toBe('Damage Formula = 1d8 + Dexterity Modifier (5)');
    expect(sq.hitBonus).toBe(11);
    expect(sq.toHit).toBe(11);
    expect(sq.hitBonusFormula).toBe('To Hit Bonus = Dexterity Modifier (5) + Proficiency (6)');
  });

  it.each([
    { label: 'no concentration at all', summary: concentrateOn(undefined) },
    { label: 'concentrating on another spell', summary: concentrateOn('Bless') },
    { label: 'another creature holds the concentration', summary: { creatures: [{ name: 'Someone Else', concentration: { spell: 'Swift Quiver' } }] } },
  ])('$label — no Swift Quiver rows, only the Longbow Action row', ({ summary }) => {
    vi.mocked(getCombatSummary).mockReturnValue(summary);

    const result = getAttacks([LONGBOW], [], dexChar(5, 3));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'Longbow', type: 'Action' });
  });
});

// ---------------------------------------------------------------------------
// Starry Form — getAttacks wiring only (construction & level scaling live in
// starryFormDamage.test.js:17-52)
// ---------------------------------------------------------------------------

describe('attackCalc2024 - Starry Form Archer integration', () => {
  const druidChar = (level, activeBuffs) => ({
    ...char({
      level,
      abilities: [{ name: 'Strength', bonus: 0 }, { name: 'Wisdom', bonus: 3 }],
      activeBuffs,
    }),
    class: { name: 'Druid' },
    spellAbilities: { toHit: 5 },
  });

  it('unarmed caster with the Archer buff receives exactly the Luminous Arrow row from playerStats.activeBuffs', () => {
    const result = getAttacks([], [], druidChar(5, [{ name: 'Starry Form', constellation: 'Archer' }]));

    // The arrow row is appended before the fallback guard, so no Unarmed Strike appears.
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'Starry Form: Luminous Arrow',
      attackType: 'spell',
      damage: '1d8+3',
      damageType: 'Radiant',
      actionType: 'Bonus Action',
      hitBonus: 5,
      toHit: 5,
      range: '120_ft',
    });
  });

  it('without the buff the lane stays closed — fallback Unarmed Strike only, no arrow row', () => {
    const result = getAttacks([], [], druidChar(5, []));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'Unarmed Strike', type: 'Action', weaponType: 'unarmed' });
  });
});
