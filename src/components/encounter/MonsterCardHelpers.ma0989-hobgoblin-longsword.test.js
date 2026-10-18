// @maintained-by-ai: 2026-10-18 — MA-0989 OWNER: Hobgoblin Longsword two-handed versatile disk lock + row wiring (trimmed 5→2, rec #523)
// MA-0989: Hobgoblin Longsword versatile clause was inert-by-construction —
// prose-only "or 6 (1d10 + 1) ... if used with two hands" with no authored
// damage_dice_two_handed (buildTwoHandedVariantOffer returned null → zero
// HIT-popup chooser, §166 toggle audit 0 switches/radiogroup/tablist).
// One-field DATA fix, mirroring the MA-0636/MA-0652/MA-0959/MA-0965 twin
// placement (damage_dice_two_handed after damage_dice_primary, before
// damage_type_primary; two-handed leg rides damage_type_primary Slashing).
// Description untouched.
// Press legs cite-skipped to owners: offer/select-log branch truth-tables live
// in MonsterCardHelpers.two-handed.test.js:23-34 (literal offer-shape), :36-42
// (byte-inert null offers incl. Longbow twin) and :44-55 (two/one fork); modal
// offer branches (missing key / variant===base / undefined action) in
// MonsterCardModal.two-handed.test.jsx:213-223; the transport null-triplet in
// MonsterCardModal.cultist-flat-secondary.test.js:38.
// Byte-twin verdict (#523): two_handed literal "1d10 + 1" is UNIQUE disk-wide
// (only Hobgoblin/Longsword authors it) and the row is byte-distinct from the
// Veteran family — Veteran/Half-Red Dragon Veteran twins share 1d10 + 3 with
// lowercase "slashing" (+5, ma1661:54); this row is +3/+1, 1d8 + 1 → 1d10 + 1,
// capital "Slashing". DISTINCT row → keeps its own by-name disk lock (#387),
// so no #422 fold or delete.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';

describe('MA-0989 Hobgoblin Longsword two-handed versatile (disk lock + row wiring)', () => {
  const hobgoblin = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    return monsters.find((m) => m.name === 'Hobgoblin');
  };
  const longsword = () => {
    const row = hobgoblin().actions[0];
    expect(row.name).toBe('Longsword');
    return row;
  };

  it('disk lock (by-name #387): Longsword authors damage_dice_two_handed "1d10 + 1" beside the 1d8 + 1 primary (MA-0636/0652/0959/0965 placement), ALTERNATIVE prose byte-intact (§415 — secondary ABSENT), Longbow sibling ABSENT', () => {
    const row = longsword();
    expect(row.attack_bonus).toBe(3);
    expect(row.damage_dice_primary).toBe('1d8 + 1');
    expect(row.damage_dice_two_handed).toBe('1d10 + 1');
    expect(row.damage_dice_two_handed).not.toBe(row.damage_dice_primary);
    expect(row.damage_type_primary).toBe('Slashing');
    expect(row.damage_dice_secondary).toBeUndefined();
    expect(row.description).toBe('Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) slashing damage, or 6 (1d10 + 1) slashing damage if used with two hands.');
    expect(row.description).not.toMatch(/1dl0|1d1O/);
    const longbow = hobgoblin().actions[1];
    expect(longbow.name).toBe('Longbow');
    expect(longbow.damage_dice_two_handed).toBeUndefined();
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
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Hobgoblin 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain(row.damage_dice_two_handed);
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Hobgoblin 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain(row.damage_dice_primary);
    expect(one.description).not.toContain(row.damage_dice_two_handed);
  });
});
