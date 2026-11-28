// @maintained-by-ai 2026-11-28
// MA-0989 OWNER: Hobgoblin Longsword two-handed versatile — pure verbatim full-row
// disk lock (#387). Press legs stay cite-skipped to owners by describe-block:
// offer-shape + two/one select-log fork + byte-inert null offers canon at
// MonsterCardHelpers.two-handed.test.js "MA-0636 data lock" describe; modal
// forwarding (incl. offer-less null) at MonsterCardModal.two-handed.test.jsx
// "MA-0325 offer forwarding at the chip press" describe; transport null-triplet at
// MonsterCardModal.cultist-flat-secondary.test.js "MA-0530 Cultist Ritual Sickle
// flat secondary" describe. The former disk-derived chooser pin (fold twin of
// ma1661 "buildTwoHandedVariantOffer derives…" its) dropped as mutation-inert:
// every assertion read offer.field === row.field off THIS same row the lock pins
// verbatim, so any helper/modal mutant dies in the owner lanes above and any disk
// mutant dies here.
// MA-0989: Hobgoblin Longsword versatile clause was inert-by-construction —
// prose-only "or 6 (1d10 + 1) ... if used with two hands" with no authored
// damage_dice_two_handed (buildTwoHandedVariantOffer returned null → zero
// HIT-popup chooser, §166 toggle audit 0 switches/radiogroup/tablist).
// One-field DATA fix, mirroring the MA-0636/MA-0652/MA-0959/MA-0965 twin
// placement (damage_dice_two_handed after damage_dice_primary, before
// damage_type_primary; two-handed leg rides damage_type_primary Slashing).
// Description untouched.
// Byte-twin verdict (#523): the two_handed literal "1d10 + 1" is UNIQUE disk-wide
// (only Hobgoblin/Longsword authors it) and the row is byte-distinct from the
// Veteran family — Veteran/Half-Red Dragon Veteran twins share 1d10 + 3 with
// lowercase "slashing" and +5; this row is +3/+1, 1d8 + 1 → 1d10 + 1, capital
// "Slashing", "Melee Weapon Attack:" prose. DISTINCT row → keeps its own
// by-name disk lock (#387), so no #422 fold or delete. Full-row toEqual makes
// §415 (ALTERNATIVE, secondary ABSENT) implicit: any added/changed key on the
// row flips it.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';

describe('MA-0989 Hobgoblin Longsword two-handed versatile (disk lock)', () => {
  const hobgoblin = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    return monsters.find((m) => m.name === 'Hobgoblin');
  };

  it('disk lock (by-name #387): Longsword row verbatim — 1d10 + 1 two-handed beside the 1d8 + 1 primary (no secondary key, §415), capital "Slashing" + "Melee Weapon Attack:" prose; Longbow sibling stays byte-inert', () => {
    const actions = hobgoblin().actions;
    expect(actions[0].name).toBe('Longsword');
    expect(actions[0]).toEqual({
      name: 'Longsword',
      description: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) slashing damage, or 6 (1d10 + 1) slashing damage if used with two hands.',
      attack_bonus: 3,
      reach: '5 ft.',
      damage_dice_primary: '1d8 + 1',
      damage_dice_two_handed: '1d10 + 1',
      damage_type_primary: 'Slashing',
    });
    expect(actions[1].name).toBe('Longbow');
    expect(actions[1].damage_dice_two_handed).toBeUndefined();
  });
});
