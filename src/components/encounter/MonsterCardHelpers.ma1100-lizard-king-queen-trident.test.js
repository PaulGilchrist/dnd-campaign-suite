// @maintained-by-ai
// MA-1100: Lizard King/Queen Trident versatile "or 7 (1d8 + 3) piercing
// damage if used with two hands to make a melee attack" had NO authored
// damage_dice_two_handed transport field — buildTwoHandedVariantOffer
// returned null (MonsterCardHelpers.js:794) so the §166 HIT-popup chooser
// never rendered and 1d8 + 3 was structurally unreachable (FAIL(a)-DATA).
// One-field fix authors damage_dice_two_handed "1d8 + 3" mirroring the
// MA-1063 kuo-toa Spear / MA-0959 half-ogre Battleaxe placement (after
// damage_dice_primary, before damage_type_primary). The ranged band "20/60"
// stays prose (§150/§193 no-seam family) — no damage_dice_ranged in scope.
// Twin audit: ONE disk row only — index "lizard-king-queen" carries King AND
// Queen in a single block (not two byte-twin rows); its two_handed literal
// "1d8 + 3" is disk-unique. Generic lane legs cite-skip and are dropped:
// offer build + sibling inertness + select logs → two-handed.test.js:23-55;
// builder null-guardrail → MonsterCardModal.two-handed.test.jsx:213-223;
// byte-inert null secondary transport triple →
// MonsterCardModal.cultist-flat-secondary.test.js:36-39. Remaining per-row:
// disk lock + ONE derived press + no-double-charge guard (secondary ABSENT).
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer } from './MonsterCardHelpers.js';

describe('MA-1100 data lock (monsters.json Lizard King/Queen Trident)', () => {
  const tridentRow = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const trident = monsters.find((m) => m.index === 'lizard-king-queen').actions[3];
    expect(trident.name).toBe('Trident');
    return trident;
  };

  it('disk lock: actions[3] Trident authors damage_dice_two_handed "1d8 + 3" beside the 1d6 + 3 primary (MA-1063/0959 placement), prose byte-intact, no-double-charge guard — additive secondary ABSENT', () => {
    const trident = tridentRow();
    expect(trident.attack_bonus).toBe(5);
    expect(trident.damage_dice_primary).toBe('1d6 + 3');
    expect(trident.damage_dice_two_handed).toBe('1d8 + 3');
    expect(trident.damage_type_primary).toBe('Piercing');
    expect(trident.description).toMatch(/1d8 \+ 3\) piercing damage if used with two hands to make a melee attack/);
    expect(trident.damage_dice_secondary).toBeUndefined();
    expect(trident.flat_damage_secondary).toBeUndefined();
    const keys = Object.keys(trident);
    expect(keys.indexOf('damage_dice_two_handed')).toBeGreaterThan(keys.indexOf('damage_dice_primary'));
    expect(keys.indexOf('damage_dice_two_handed')).toBeLessThan(keys.indexOf('damage_type_primary'));
  });

  it('ONE derived press: buildTwoHandedVariantOffer arms the Trident HIT-popup chooser with both formulas', () => {
    const offer = buildTwoHandedVariantOffer(tridentRow(), 'Trident');
    expect(offer).toMatchObject({
      formula: '1d8 + 3',
      baseFormula: '1d6 + 3',
      damageType: 'Piercing',
      attackName: 'Trident',
    });
    expect(offer.label).toContain('1d8 + 3');
  });
});
