// @maintained-by-ai: 2026-10-23 — MA-0965 OWNER: Half-Red Dragon Veteran Longsword two-handed versatile disk lock + row wiring (rec #523 applied: offer-shape + select-log fork presses folded to canon; wiring = disk-derived chooser pin per fold twin ma1661:42-49)
// MA-0965: Half-Red Dragon Veteran Longsword versatile clause was inert-by-
// construction — prose-only "or 8 (1d10 + 3) ... if used with two hands" with
// no authored damage_dice_two_handed (buildTwoHandedVariantOffer returned null
// → zero HIT-popup chooser, §166 toggle audit 0 switches/radiogroup/tablist).
// One-field DATA fix, mirroring the MA-0636/MA-0652/MA-0959 twin placement
// (damage_dice_two_handed after damage_dice_primary, before damage_type_primary;
// two-handed leg rides damage_type_primary slashing). Description untouched.
// Press legs cite-skipped to owners (rec #523 applied): literal offer-shape +
// two/one select-log fork truth-tables canon at MonsterCardHelpers.two-handed
// .test.js:25-36 and :47-61; byte-inert null offers at :38-44; this lane's
// wiring is the disk-derived chooser pin only (fold twin ma1661:42-49). Modal
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
import { buildTwoHandedVariantOffer } from './MonsterCardHelpers.js';

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

  it('row wired: chooser arms from THIS disk row (offer-shape + two/one select-log fork canon-folded to two-handed.test.js:25-36,47-61)', () => {
    const row = longsword();
    const offer = buildTwoHandedVariantOffer(row, 'Longsword');
    expect(offer).not.toBeNull();
    expect(offer).toMatchObject({ attackName: 'Longsword' });
    expect(offer.formula).toBe(row.damage_dice_two_handed);
    expect(offer.baseFormula).toBe(row.damage_dice_primary);
    expect(offer.damageType).toBe(row.damage_type_primary);
    expect(offer.label).toContain(row.damage_dice_two_handed);
  });
});
