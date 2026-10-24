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
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAttacks } from './attackCalc2024.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import DISK_EQUIPMENT from '../../../../public/data/equipment.json';

// Unavoidable mock only: SSE/runtime-backed combat summary.
vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCurrentCombatRound: vi.fn(() => 1),
}));

// Concentration is OFF by default every test: mockReturnValue persists across
// tests in a file, and the Swift Quiver gate reads getCombatSummary on every
// getAttacks call — without this reset, a concentration-returning test leaks
// SQ rows into the Starry Form lane (ordering luck retired by fix#340).
afterEach(() => {
  vi.mocked(getCombatSummary).mockReturnValue(null);
});

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
// Swift Quiver bow-finder match-set census (#595 category-never-match class,
// fix#340). attackCalc2024.js findSwiftQuiverBow gated on
// weapon_category === 'Ranged' — disk equipment.json weapon_category carries
// ONLY Simple/Martial, so that clause NEVER matched; the name list kept the
// lane alive on Longbow/Light Crossbow/Hand Crossbow while OMITTING Shortbow
// and carrying dead comma-form entries ('Crossbow, Heavy'/'Crossbow, Light'
// are disk 'Heavy Crossbow'/'Light Crossbow'). Fixed predicate:
// weapon_range 'Ranged' + 'Ammunition' property + disk names — scoped by the
// disk spell text (2024/spells.json 'Swift Quiver'): "two attacks with a
// weapon that fires Arrows or Bolts, such as a Longbow or a Light Crossbow".
// Weapon rows are read from disk BY-name, never transcribed.
// ---------------------------------------------------------------------------

const diskWeapon = (name) => DISK_EQUIPMENT.find(it => it.name === name);
const ARROW_BOLT_NAMES = ['Longbow', 'Shortbow', 'Light Crossbow', 'Hand Crossbow', 'Heavy Crossbow'];
// dexChar is scoped inside the SQ describe above; this lane equips one
// disk-named weapon with DEX +3 (lv5, PB +3 -> to-hit 6).
const sqChar = (name, level = 5, dexBonus = 3) => char({
  level,
  abilities: [{ name: 'Strength', bonus: 0 }, { name: 'Dexterity', bonus: dexBonus }],
  equipped: [name],
});

describe('attackCalc2024 - Swift Quiver disk predicate census (#595 fix#340)', () => {
  const diskWeapons = DISK_EQUIPMENT.filter(it => it.equipment_category === 'Weapon');

  it('census: weapon_category NEVER equals Ranged on disk (Simple/Martial ONLY)', () => {
    expect(diskWeapons.filter(it => it.weapon_category === 'Ranged')).toHaveLength(0);
    expect([...new Set(diskWeapons.map(it => it.weapon_category))].sort()).toEqual(['Martial', 'Simple']);
  });

  it('census: old predicate match-set {Longbow, Light Crossbow, Hand Crossbow} — name-list only, Shortbow silently skipped', () => {
    const oldMatch = diskWeapons.filter(it => {
      const props = it.properties ?? [];
      return (it.weapon_category === 'Ranged' && (props.includes('Ammunition') || props.includes('Heavy') || props.includes('Light')))
        || ['Longbow', 'Light Crossbow', 'Hand Crossbow', 'Crossbow, Heavy', 'Crossbow, Light'].includes(it.name);
    }).map(it => it.name).sort();

    expect(oldMatch).toEqual(['Hand Crossbow', 'Light Crossbow', 'Longbow']);
    // The comma-form list entries are dead — absent from disk entirely:
    expect(['Crossbow, Heavy', 'Crossbow, Light'].every(n => !diskWeapon(n))).toBe(true);
  });

  it('census: new predicate match-set is EXACTLY the five disk arrow/bolt weapons', () => {
    const newMatch = diskWeapons.filter(it =>
      it.weapon_range === 'Ranged' && (it.properties ?? []).includes('Ammunition') && ARROW_BOLT_NAMES.includes(it.name)
    ).map(it => it.name).sort();

    expect(newMatch).toEqual([...ARROW_BOLT_NAMES].sort());
    // Ammunition-ranged weapons OUTSIDE the arrows/bolts scope stay out:
    for (const excluded of ['Blowgun', 'Sling', 'Dart', 'Net']) {
      expect(newMatch).not.toContain(excluded);
    }
  });

  it.each(ARROW_BOLT_NAMES.map(name => ({ name })))('$name equips two Swift Quiver rows threaded with its BY-name disk bytes', ({ name }) => {
    vi.mocked(getCombatSummary).mockReturnValue(concentrateOn('Swift Quiver'));
    const diskRow = diskWeapon(name);
    expect(diskRow, `disk row '${name}' must exist`).toBeTruthy();

    const result = getAttacks([diskRow], [], sqChar(name));

    const names = result.map(a => a.name);
    expect(names).toEqual([name, 'Swift Quiver (1st Attack)', 'Swift Quiver (2nd Attack)']);
    // Fixer proof: the SQ rows carry the WEAPON's disk dice/range/type, not
    // the resolver's 1d8/'80_ft' fallbacks.
    const expectedDamage = `${diskRow.damage.damage_dice}+3`;
    for (const sq of result.filter(a => a.isSwiftQuiver)) {
      expect(sq.damage).toBe(expectedDamage);
      expect(sq.damageFormula).toBe(`Damage Formula = ${diskRow.damage.damage_dice} + Dexterity Modifier (3)`);
      expect(sq.damageType).toBe(diskRow.damage.damage_type);
      expect(sq.range).toBe(diskRow.range.long || diskRow.range.normal);
      expect(sq.type).toBe('Bonus Action');
    }
  });

  // Out-of-scope weapons: findSwiftQuiverBow must MISS them, so the SQ rows
  // carry the resolver's fallback bytes (1d8 / '80'), never the weapon's own
  // disk dice. (Rows appearing at all while concentrating with no eligible
  // bow is the pre-existing bow-missing fallback at :541-547 — not this
  // row's scope.) NOTE: Net is excluded from this armed lane because its
  // disk row carries NO damage object (equipment.json index net) — equipped
  // Net throws at buildWeaponAttack attackCalc.js:109 BEFORE the finder
  // runs. Pre-existing disk gap, reported, public/data is read-only here;
  // Net's exclusion from the finder is pinned by the predicate census above.
  it.each(['Blowgun', 'Sling', 'Dart'])('%s is OUTSIDE the arrows/bolts scope — finder misses it, SQ rows stay on fallback bytes', (name) => {
    vi.mocked(getCombatSummary).mockReturnValue(concentrateOn('Swift Quiver'));
    const diskRow = diskWeapon(name);

    const result = getAttacks([diskRow], [], sqChar(name));

    const sq = result.filter(a => a.isSwiftQuiver);
    expect(sq).toHaveLength(2);
    for (const row of sq) {
      expect(row.damage).toBe('1d8+3');
      expect(row.range).toBe('80');
      expect(row.damage).not.toBe(`${diskRow.damage.damage_dice}+3`);
    }
  });

  it('a Simple-category Shortbow now matches where the old Ranged-category gate never did (disk: Shortbow weapon_category Simple)', () => {
    const shortbow = diskWeapon('Shortbow');
    expect(shortbow.weapon_category).toBe('Simple');
    expect(shortbow.weapon_range).toBe('Ranged');
    expect(shortbow.properties).toEqual(['Ammunition', 'Two-Handed']);

    vi.mocked(getCombatSummary).mockReturnValue(concentrateOn('Swift Quiver'));
    const result = getAttacks([shortbow], [], sqChar('Shortbow'));

    expect(result.filter(a => a.isSwiftQuiver)).toHaveLength(2);
    expect(result.find(a => a.isSwiftQuiver).damage).toBe('1d6+3');
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
      // fix#351(a)(ii) #1348 flip: old honest '120_ft' pin follows the module
      // constant to disk law — 2024/classes.json Circle of Stars 'Starry Form'
      // BY-name: "within 60 feet of yourself" (sibling of the flip in
      // starryFormDamage.test.js, same pass).
      range: '60_ft',
    });
  });

  it('without the buff the lane stays closed — fallback Unarmed Strike only, no arrow row', () => {
    const result = getAttacks([], [], druidChar(5, []));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'Unarmed Strike', type: 'Action', weaponType: 'unarmed' });
  });
});
