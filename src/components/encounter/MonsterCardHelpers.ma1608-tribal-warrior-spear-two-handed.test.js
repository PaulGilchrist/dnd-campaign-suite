// @maintained-by-ai — trimmed 6→2 tests (#523/#535/#537): this lane's DISTINCT
// intents are (1) the BY-name disk lock for Tribal Warrior/Spear (#387 — ma1063
// header explicitly delegates this row here: "1d8 + 1 literal also authors Tribal
// Warrior/Spear — ma1608 owns that by-name row lock"), folding the Azer/MA-1063
// key placement (exact key-order lock, #422 fold of the old Kuo-Toa side-by-side
// twin compare — counterpart keys are BY-name-locked in ma1063's disk lock) and
// the no-double-charge guard (additive secondary fields ABSENT: "or … two hands"
// is ALTERNATIVE dice, §415); and (2) the not-swept cross-check that the
// MA-1264/1267 orc plus-rider rows stay byte-identical (acknowledged byte-twins
// at :75-77↔ma1264 disk lock; owners: ma1264/ma1267 disk locks). Deleted legs
// cite owners: offer shape MonsterCardHelpers.two-handed.test.js:23-34, byte-inert
// null-offer branch :36-42, two/one select-log fork :44-55; modal offer branches
// MonsterCardModal.two-handed.test.jsx:213-223; transport null (cultist-flat-secondary.
// test.js:38) — the Tribal row has no secondary fields, same null-triple shape. The
// offer/select press deleted as byte-twin of ma1063's disk-derived press (row is
// byte-identical: +3, 1d6 + 1 → 1d8 + 1, lowercase "piercing"; #422).
// MA-1608: Tribal Warrior Spear advertised versatile two-handed variant
// ("or 5 (1d8 + 1) piercing damage if used with two hands to make a melee
// attack") but damage_dice_two_handed was ABSENT — buildTwoHandedVariantOffer
// early-returned null (MonsterCardHelpers.js:992) so the HIT popup paid
// 1d6 + 1 with zero GM chooser (prose-only FAIL(a), MA-0325/0636/0871/1063
// family). One-field DATA fix adds damage_dice_two_handed "1d8 + 1" in the
// Azer/MA-1063 byte-shape (after damage_dice_primary, before
// damage_type_primary; two-handed leg rides primary type "piercing"), making
// the row a byte-twin of the Kuo-Toa Spear (MA-1063).
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';

describe('MA-1608 data lock (monsters.json Tribal Warrior Spear)', () => {
  const spearRow = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const spear = monsters.find((m) => m.name === 'Tribal Warrior').actions[0];
    expect(spear.name).toBe('Spear');
    return spear;
  };

  it('BY-name disk lock: +3 Spear authors two_handed "1d8 + 1" after primary before type (Azer/MA-1063 placement), prose byte-intact, additive secondary fields ABSENT (§415 alternative dice — no double-charge)', () => {
    const spear = spearRow();
    expect(Object.keys(spear)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_dice_two_handed',
      'damage_type_primary',
    ]);
    expect(spear.attack_bonus).toBe(3);
    expect(spear.damage_dice_primary).toBe('1d6 + 1');
    expect(spear.damage_dice_two_handed).toBe('1d8 + 1');
    expect(spear.damage_type_primary).toBe('piercing');
    expect(spear.description).toBe('Melee or Ranged Weapon Attack: +3 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 4 (1d6 + 1) piercing damage, or 5 (1d8 + 1) piercing damage if used with two hands to make a melee attack.');
    expect(spear.damage_dice_secondary).toBeUndefined();
    expect(spear.flat_damage_secondary).toBeUndefined();
    expect(spear.damage_dice_ranged).toBeUndefined();
  });

  it('not-swept cross-check: orc-family "plus 1d8" rider Spears byte-identical (owner locks MA-1264/MA-1267 — untouched by this fix)', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const eye = monsters.find((m) => m.name === 'Orc Eye of Gruumsh').actions[0];
    expect(eye.damage_dice_primary).toBe('1d6 + 3 plus 1d8');
    expect(eye.damage_dice_two_handed).toBe('2d8 + 3');
    const chief = monsters.find((m) => m.name === 'Orc War Chief').actions[2];
    expect(chief.damage_dice_primary).toBe('1d6 + 4 plus 1d8');
    expect(chief.damage_dice_two_handed).toBe('2d8 + 4');
  });
});
