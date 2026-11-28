// @maintained-by-ai 2026-11-28 — MA-0965 OWNER: Half-Red Dragon Veteran Longsword two-handed versatile — pure verbatim full-row disk lock (#387). Press legs stay cite-skipped to owners by describe-block: offer-shape + two/one select-log fork + byte-inert null offers canon at MonsterCardHelpers.two-handed.test.js "MA-0636 data lock" describe; modal forwarding (incl. offer-less null) at MonsterCardModal.two-handed.test.jsx "MA-0325 offer forwarding at the chip press" describe; transport null-triplet at MonsterCardModal.cultist-flat-secondary.test.js "MA-0530 Cultist Ritual Sickle flat secondary" describe. The former disk-derived chooser pin (fold twin of ma1661 "buildTwoHandedVariantOffer derives…" its) dropped as mutation-inert: every assertion read offer.field === row.field off THIS same row the lock pins verbatim, so any helper/modal mutant dies in the owner lanes above and any disk mutant dies here.
// MA-0965: Half-Red Dragon Veteran Longsword versatile clause was inert-by-
// construction — prose-only "or 8 (1d10 + 3) ... if used with two hands" with
// no authored damage_dice_two_handed (buildTwoHandedVariantOffer returned null
// → zero HIT-popup chooser, §166 toggle audit 0 switches/radiogroup/tablist).
// One-field DATA fix, mirroring the MA-0636/MA-0652/MA-0959 twin placement
// (damage_dice_two_handed after damage_dice_primary, before damage_type_primary;
// two-handed leg rides damage_type_primary slashing). Description untouched.
// Byte-twin verdict (#523): the two_handed literal "1d10 + 3" is shared with
// Azer/Warhammer, Drider/Longsword and Veteran/Longsword — so NO literal press
// re-asserts here. But this row is a DISTINCT disk row: its description carries
// a unique "Weapon Attack:" prefix (Veteran's twin says "Melee Weapon Attack:")
// — keeps its own by-name disk lock (#387), so no #422 fold. Full-row toEqual
// makes §415 (ALTERNATIVE, secondary ABSENT) implicit: any added/changed key
// on the row flips it.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';

describe('MA-0965 Half-Red Dragon Veteran Longsword two-handed versatile (disk lock)', () => {
  const veteran = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    return monsters.find((m) => m.name === 'Half-Red Dragon Veteran');
  };

  it('disk lock (by-name #387): Longsword row verbatim — 1d10 + 3 two-handed beside the 1d8 + 3 primary (no secondary key, §415), unique "Weapon Attack:" prose; Shortsword sibling stays byte-inert', () => {
    const actions = veteran().actions;
    expect(actions[1].name).toBe('Longsword');
    expect(actions[1]).toEqual({
      name: 'Longsword',
      description: 'Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage, or 8 (1d10 + 3) slashing damage if used with two hands.',
      attack_bonus: 5,
      reach: '5 ft.',
      damage_dice_primary: '1d8 + 3',
      damage_dice_two_handed: '1d10 + 3',
      damage_type_primary: 'slashing',
    });
    expect(actions[2].name).toBe('Shortsword');
    expect(actions[2].damage_dice_two_handed).toBeUndefined();
  });
});
