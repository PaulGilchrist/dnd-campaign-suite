// @maintained-by-ai: 2026-10-18 — MA-0965 OWNER: Half-Red Dragon Veteran Longsword two-handed versatile disk lock + row wiring (trimmed 5→2, rec #523)
// MA-0965: Half-Red Dragon Veteran Longsword versatile clause was inert-by-
// construction — prose-only "or 8 (1d10 + 3) ... if used with two hands" with
// no authored damage_dice_two_handed (buildTwoHandedVariantOffer returned null
// → zero HIT-popup chooser, §166 toggle audit 0 switches/radiogroup/tablist).
// One-field DATA fix, mirroring the MA-0636/MA-0652/MA-0959 twin placement
// (damage_dice_two_handed after damage_dice_primary, before damage_type_primary;
// two-handed leg rides damage_type_primary slashing). Description untouched.
// Press legs cite-skipped to owners: offer/select-log branch truth-tables live
// in MonsterCardHelpers.two-handed.test.js:23-53 (literal offer-shape + two/one
// fork) and :39-41/:46-53 (byte-inert null offers + select-log twin); modal
// offer branches (missing key / variant===base / undefined action) in
// MonsterCardModal.two-handed.test.jsx:213-223; the transport null-triplet in
// MonsterCardModal.cultist-flat-secondary.test.js:38.
// Byte-twin verdict (#523): the two_handed literal "1d10 + 3" is shared with
// Azer/Warhammer, Drider/Longsword and Veteran/Longsword — so NO literal press
// re-asserts here; wiring derives from disk bytes. But this row is a DISTINCT
// disk row: its description carries a unique "Weapon Attack:" prefix (Veteran's
// twin says "Melee Weapon Attack:", ma1661:54) — keeps its own by-name disk
// lock (#387), so no #422 fold.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';

describe('MA-0965 Half-Red Dragon Veteran Longsword two-handed versatile (disk lock + row wiring)', () => {
  const veteran = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    return monsters.find((m) => m.name === 'Half-Red Dragon Veteran');
  };
  const longsword = () => {
    const row = veteran().actions[1];
    expect(row.name).toBe('Longsword');
    return row;
  };

  it('disk lock (by-name #387): Longsword authors damage_dice_two_handed "1d10 + 3" beside the 1d8 + 3 primary (MA-0636/0652/0959 placement), ALTERNATIVE prose byte-intact (§415 — secondary ABSENT), unique "Weapon Attack:" prefix, Shortsword sibling ABSENT', () => {
    const row = longsword();
    expect(row.attack_bonus).toBe(5);
    expect(row.damage_dice_primary).toBe('1d8 + 3');
    expect(row.damage_dice_two_handed).toBe('1d10 + 3');
    expect(row.damage_dice_two_handed).not.toBe(row.damage_dice_primary);
    expect(row.damage_type_primary).toBe('slashing');
    expect(row.damage_dice_secondary).toBeUndefined();
    expect(row.description).toBe('Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage, or 8 (1d10 + 3) slashing damage if used with two hands.');
    expect(row.description).not.toMatch(/1dl0|1d1O/);
    const shortsword = veteran().actions[2];
    expect(shortsword.name).toBe('Shortsword');
    expect(shortsword.damage_dice_two_handed).toBeUndefined();
  });

  it('row wired: chooser arms with the disk formulas, select-log fork pays ONE pool (no double-charge)', () => {
    const row = longsword();
    const offer = buildTwoHandedVariantOffer(row, 'Longsword');
    expect(offer).toMatchObject({
      formula: row.damage_dice_two_handed,
      baseFormula: row.damage_dice_primary,
      damageType: row.damage_type_primary,
      attackName: 'Longsword',
    });
    expect(offer.label).toContain(row.damage_dice_two_handed);
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Half-Red Dragon Veteran 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain(row.damage_dice_two_handed);
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Half-Red Dragon Veteran 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain(row.damage_dice_primary);
    expect(one.description).not.toContain(row.damage_dice_two_handed);
  });
});
