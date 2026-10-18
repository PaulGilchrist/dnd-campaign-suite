// @maintained-by-ai: 2026-10-18 — MA-0871 OWNER: Gnoll Spear two-handed versatile disk lock + row wiring (trimmed 6→2)
// MA-0871: Gnoll Spear versatile "or 1d8 + 2 if used with two hands" was
// misfiled into damage_dice_secondary — the MA-0426/0531 ADDITIVE combined
// transport auto-rolled BOTH pools on EVERY hit (FAIL(a) double-charge: RAW
// one-handed max 8, live ledger paid 16). One-field DATA fix mirrors the
// MA-0325/MA-0652 twin placement (damage_dice_two_handed after primary,
// before damage_type_primary).
// Press legs cite-skipped to owners: offer/select-log branch truth-tables
// live in MonsterCardHelpers.two-handed.test.js:23-53 (Drider Longsword arms
// + two/one fork) and :39-41 (Bite/Longbow byte-inert nulls — byte-twin of
// the Gnoll siblings); modal offer branches (missing key / variant===base /
// undefined action) in MonsterCardModal.two-handed.test.jsx:213-223; the
// transport null-triplet in MonsterCardModal.cultist-flat-secondary.test.js:38.
// Distinct disk row from the MA-1063 Kuo-Toa byte-twin (placement mirrors
// this one) — keeps its own lock, so no #522 fold here.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

describe('MA-0871 Gnoll Spear two-handed versatile (disk lock + row wiring)', () => {
  const spearRow = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    return monsters.find((m) => m.name === 'Gnoll').actions.find((a) => a.name === 'Spear');
  };

  it('disk lock (by-name #387): Spear authors damage_dice_two_handed "1d8 + 2" beside the 1d6 + 2 primary; combined-always rider fields GONE (MA-0636/0652 placement)', () => {
    const spear = spearRow();
    expect(spear.attack_bonus).toBe(4);
    expect(spear.damage_dice_primary).toBe('1d6 + 2');
    expect(spear.damage_dice_two_handed).toBe('1d8 + 2');
    expect(spear.damage_type_primary).toBe('Piercing');
    expect(spear.damage_dice_secondary).toBeUndefined();
    expect(spear.damage_type_secondary).toBeUndefined();
    expect(spear.description).toMatch(/1d8 \+ 2\) piercing damage if used with two hands/);
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
    expect(buildSecondaryDamageTransport(spear, 'Spear')).toEqual({
      autoDamageSecondaryFormula: null,
      autoDamageSecondaryName: null,
      autoDamageSecondaryDamageType: null,
    });
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Gnoll 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain(spear.damage_dice_two_handed);
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Gnoll 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain(spear.damage_dice_primary);
    expect(one.description).not.toContain(spear.damage_dice_two_handed);
  });
});
