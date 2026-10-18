// @maintained-by-ai: 2026-10-18 — MA-0959 OWNER: Half Ogre Battleaxe two-handed versatile disk lock + row wiring (trimmed 5→2)
// MA-0959: Half Ogre Battleaxe versatile clause was inert-by-construction —
// prose-only "or 14 (2d10 + 3) ... if used with two hands" with no authored
// damage_dice_two_handed (buildTwoHandedVariantOffer returns null → zero
// HIT-popup chooser) plus OCR corruption "2dl0" in the row description.
// One-field DATA fix + OCR repair, mirroring the MA-0325/MA-0636/MA-0652
// twin placement (damage_dice_two_handed after damage_dice_primary, before
// damage_type_primary; two-handed leg rides damage_type_primary).
// Press legs cite-skipped to owners: offer/select-log branch truth-tables
// live in MonsterCardHelpers.two-handed.test.js:23-53 (Drider Longsword arms
// + two/one fork) and :39-41 (Bite/Longbow byte-inert nulls — byte-twin of
// the Javelin sibling's absent-field offer-null); modal offer branches
// (missing key / variant===base / undefined action) in
// MonsterCardModal.two-handed.test.jsx:213-223; the transport null-triplet
// in MonsterCardModal.cultist-flat-secondary.test.js:38.
// Distinct disk row — "2d10 + 3" two-handed is authored on NO other row in
// monsters.json (verified 2026-10-18) — keeps its own lock, so no #522 fold.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

describe('MA-0959 Half Ogre Battleaxe two-handed versatile (disk lock + row wiring)', () => {
  const halfOgre = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    return monsters.find((m) => m.name === 'Half Ogre');
  };
  const battleaxe = () => halfOgre().actions.find((a) => a.name === 'Battleaxe');

  it('disk lock (by-name #387): Battleaxe authors damage_dice_two_handed "2d10 + 3" beside the 2d8 + 3 primary, OCR "2dl0" repaired, additive misfire fields ABSENT, Javelin sibling ABSENT (MA-0636/0652 placement)', () => {
    const axe = battleaxe();
    expect(axe.attack_bonus).toBe(5);
    expect(axe.damage_dice_primary).toBe('2d8 + 3');
    expect(axe.damage_dice_two_handed).toBe('2d10 + 3');
    expect(axe.damage_dice_two_handed).not.toBe(axe.damage_dice_primary);
    expect(axe.damage_type_primary).toBe('slashing');
    expect(axe.damage_dice_secondary).toBeUndefined();
    expect(axe.damage_type_secondary).toBeUndefined();
    expect(axe.description).toContain('14 (2d10 + 3) slashing damage if used with two hands');
    expect(axe.description).not.toContain('2dl0');
    const javelin = halfOgre().actions.find((a) => a.name === 'Javelin');
    expect(javelin.damage_dice_two_handed).toBeUndefined();
  });

  it('row wired: chooser arms with the disk formulas, additive transport byte-inert, select-log fork pays ONE pool (no double-charge)', () => {
    const axe = battleaxe();
    const offer = buildTwoHandedVariantOffer(axe, 'Battleaxe');
    expect(offer).toMatchObject({
      formula: axe.damage_dice_two_handed,
      baseFormula: axe.damage_dice_primary,
      damageType: axe.damage_type_primary,
      attackName: 'Battleaxe',
    });
    expect(offer.label).toContain(axe.damage_dice_two_handed);
    expect(buildSecondaryDamageTransport(axe, 'Battleaxe')).toEqual({
      autoDamageSecondaryFormula: null,
      autoDamageSecondaryName: null,
      autoDamageSecondaryDamageType: null,
    });
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Half Ogre 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain(axe.damage_dice_two_handed);
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Half Ogre 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain(axe.damage_dice_primary);
    expect(one.description).not.toContain(axe.damage_dice_two_handed);
  });
});
