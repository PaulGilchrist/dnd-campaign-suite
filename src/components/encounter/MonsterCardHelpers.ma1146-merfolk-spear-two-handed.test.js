// @maintained-by-ai
// MA-1146: Merfolk Spear versatile "or 4 (1d8) piercing damage if used with
// two hands to make a melee attack" had NO authored damage_dice_two_handed
// transport field — buildTwoHandedVariantOffer returned null
// (MonsterCardHelpers.js:794) so the §166 HIT-popup chooser never rendered
// and 1d8 was structurally unreachable (FAIL(a)-DATA). One-field fix authors
// damage_dice_two_handed "1d8" (prose carries no modifier) mirroring the
// MA-1100 Lizard King/Queen Trident / MA-1063 kuo-toa Spear placement (after
// damage_dice_primary, before damage_type_primary). The ranged band "20/60"
// stays prose (§150/§193 no-seam family) — no damage_dice_ranged in scope.
// Twin audit: bare "1d8" two_handed literal is disk-unique (only merfolk
// Spear carries it; siblings carry modifiers or no field). Generic lane legs
// cite-skip and are dropped: offer build + sibling inertness + select logs →
// two-handed.test.js:23-55; builder null-guardrail →
// MonsterCardModal.two-handed.test.jsx:213-223; byte-inert null secondary
// transport triple → MonsterCardModal.cultist-flat-secondary.test.js:35-38;
// Merfolk Skirmisher Ocean Spear row → MA-1147's own file. Remaining
// per-row: disk lock + ONE derived press + no-double-charge guard.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer } from './MonsterCardHelpers.js';

describe('MA-1146 data lock (monsters.json Merfolk Spear)', () => {
  const spearRow = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const spear = monsters.find((m) => m.index === 'merfolk').actions[0];
    expect(spear.name).toBe('Spear');
    return spear;
  };

  it('disk lock: actions[0] Spear authors damage_dice_two_handed "1d8" beside the 1d6 primary (MA-1100/1063 placement, no modifier), prose byte-intact, no-double-charge guard — additive secondary ABSENT', () => {
    const spear = spearRow();
    expect(spear.attack_bonus).toBe(2);
    expect(spear.damage_dice_primary).toBe('1d6');
    expect(spear.damage_dice_two_handed).toBe('1d8');
    expect(spear.damage_type_primary).toBe('Piercing');
    expect(spear.description).toMatch(/1d8\) piercing damage if used with two hands to make a melee attack/);
    expect(spear.damage_dice_secondary).toBeUndefined();
    expect(spear.flat_damage_secondary).toBeUndefined();
    const keys = Object.keys(spear);
    expect(keys.indexOf('damage_dice_two_handed')).toBeGreaterThan(keys.indexOf('damage_dice_primary'));
    expect(keys.indexOf('damage_dice_two_handed')).toBeLessThan(keys.indexOf('damage_type_primary'));
  });

  it('ONE derived press: buildTwoHandedVariantOffer arms the Spear HIT-popup chooser with both formulas', () => {
    const offer = buildTwoHandedVariantOffer(spearRow(), 'Spear');
    expect(offer).toMatchObject({
      formula: '1d8',
      baseFormula: '1d6',
      damageType: 'Piercing',
      attackName: 'Spear',
    });
    expect(offer.label).toContain('1d8');
  });
});
