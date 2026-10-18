// @maintained-by-ai: 2026-10-18 — MA-1063 OWNER: Kuo-Toa Spear two-handed versatile disk lock + row wiring (trimmed 6→2, rec #523)
// MA-1063: Kuo-Toa Spear versatile "or 5 (1d8 + 1) ... if used with two
// hands to make a melee attack" was misfiled into damage_dice_secondary —
// the §118/MA-0426/0531 ADDITIVE combined transport auto-rolled BOTH pools
// on EVERY hit (FAIL(a) wrong-slot over-deal: live ledger paid 1d6+1 PLUS
// 1d8+1, e.g. nat13+3 hit → 7+3=10, RAW one-handed max 7). One-field DATA
// fix renames the slot to damage_dice_two_handed, mirroring the
// MA-0871 Gnoll Spear byte-twin placement (after damage_dice_primary, before
// damage_type_primary; two-handed leg rides damage_type_primary piercing):
// buildTwoHandedVariantOffer now arms the §166 HIT-popup chooser and
// buildSecondaryDamageTransport goes byte-inert for the row.
// Press legs cite-skipped to owners: offer/select-log branch truth-tables live
// in MonsterCardHelpers.two-handed.test.js:23-34 (literal offer-shape), :36-42
// (byte-inert null-offer branch — rows without the field, same shape as the
// Kuo-Toa Bite/Net siblings) and
// :44-55 (two/one fork); modal offer branches (build from metadata / one-hand
// null guardrail) in MonsterCardModal.two-handed.test.jsx:214-221; the
// transport null-triplet in MonsterCardModal.cultist-flat-secondary.test.js:38.
// Byte-twin verdict (#523): DISTINCT disk row from the MA-0871 Gnoll twin
// this placement mirrors — Kuo-Toa is 1d6 + 1 → 1d8 + 1, +3, lowercase
// "piercing"; Gnoll is 1d6 + 2 → 1d8 + 2, +4, "Piercing". No full fingerprint
// collision, so keeps its own by-name disk lock (#387) — no #422 fold.
// (1d8 + 1 literal also authors Tribal Warrior/Spear — ma1608 owns that
// by-name row lock; row identity separates the two.)
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

describe('MA-1063 Kuo-Toa Spear two-handed versatile (disk lock + row wiring)', () => {
  const kuoToa = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    return monsters.find((m) => m.name === 'Kuo-Toa');
  };
  const spearRow = () => {
    const row = kuoToa().actions[1];
    expect(row.name).toBe('Spear');
    return row;
  };

  it('disk lock (by-name #387): Spear authors damage_dice_two_handed "1d8 + 1" beside the 1d6 + 1 primary (MA-0871/0636/0652 placement), wrong-slot additive fields GONE (§118 combined transport dead for this row), prose byte-intact, Bite/Net siblings ABSENT', () => {
    const spear = spearRow();
    expect(spear.attack_bonus).toBe(3);
    expect(spear.damage_dice_primary).toBe('1d6 + 1');
    expect(spear.damage_dice_two_handed).toBe('1d8 + 1');
    expect(spear.damage_dice_two_handed).not.toBe(spear.damage_dice_primary);
    expect(spear.damage_type_primary).toBe('piercing');
    expect(spear.damage_dice_secondary).toBeUndefined();
    expect(spear.flat_damage_secondary).toBeUndefined();
    expect(spear.description).toBe('Melee or Ranged Weapon Attack: +3 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d6 + 1) piercing damage, or 5 (1d8 + 1) piercing damage if used with two hands to make a melee attack.');
    expect(kuoToa().actions[0].name).toBe('Bite');
    expect(kuoToa().actions[0].damage_dice_two_handed).toBeUndefined();
    expect(kuoToa().actions[2].name).toBe('Net');
    expect(kuoToa().actions[2].damage_dice_two_handed).toBeUndefined();
  });

  it('row wired: chooser arms with the disk formulas, additive transport byte-inert, select-log fork pays ONE pool (no double-charge)', () => {
    const spear = spearRow();
    const offer = buildTwoHandedVariantOffer(spear, 'Spear');
    expect(offer).toMatchObject({
      formula: spear.damage_dice_two_handed,
      baseFormula: spear.damage_dice_primary,
      damageType: spear.damage_type_primary,
      attackName: 'Spear',
    });
    expect(offer.label).toContain(spear.damage_dice_two_handed);
    expect(buildSecondaryDamageTransport(spear, 'Spear')).toEqual({
      autoDamageSecondaryFormula: null,
      autoDamageSecondaryName: null,
      autoDamageSecondaryDamageType: null,
    });
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Kuo-Toa 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain(spear.damage_dice_two_handed);
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Kuo-Toa 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain(spear.damage_dice_primary);
    expect(one.description).not.toContain(spear.damage_dice_two_handed);
  });
});
