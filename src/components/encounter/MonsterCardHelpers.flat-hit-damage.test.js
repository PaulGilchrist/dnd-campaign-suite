// MA-0322: flat integer hit damage ("Hit: 1 Slashing damage.", no
// damage_dice_primary) was silently dealt as ZERO — extractFlatHitDamage
// parses the constant back out for the attack-row auto-damage seam ONLY.
import { describe, it, expect } from 'vitest';
import { extractFlatHitDamage } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

describe('extractFlatHitDamage (MA-0322 flat hit damage prose)', () => {
  it('parses the exact Awakened Shrub Rake row (HTML-tagged Hit:) to constant "1"', () => {
    expect(extractFlatHitDamage({
      name: 'Rake',
      description: 'Melee Attack Roll: +1, reach 5 ft. <strong>Hit:</strong> 1 Slashing damage.',
      attack_bonus: 1,
      damage_type_primary: 'Slashing',
    })).toBe('1');
  });

  it.each([
    ['Badger Bite (MA-0332 twin)', 'Melee Attack Roll: +2, reach 5 ft. <strong>Hit:</strong> 1 Piercing damage.', '1'],
    ['Bat Bite (MA-0364 twin)', 'Melee Attack Roll: +4, reach 5 ft. <strong>Hit:</strong> 1 Piercing damage.', '1'],
    ['Crawling Claw Slam', 'Melee Attack Roll: +3, reach 5 ft. <strong>Hit:</strong> 2 Necrotic damage.', '2'],
    ['plain prose, no HTML', 'Melee Attack Roll: +2, reach 5 ft. Hit: 1 Piercing damage.', '1'],
    ['lowercase hit keyword + lowercase type', 'Melee Weapon Attack: +0 to hit. hit: 1 bludgeoning damage.', '1'],
    ['parenthetical non-dice note does not block', 'Melee Attack Roll: +5 (with Advantage if the target is prone). Hit: 1 Piercing damage.', '1'],
    ['trailing clause after primary damage', 'Melee Attack Roll: +4, reach 5 ft. Hit: 1 Piercing damage, and the target must succeed on a Wisdom save.', '1'],
  ])('parses %s to constant %s', (_label, description, expected) => {
    expect(extractFlatHitDamage({ name: 'Attack', description })).toBe(expected);
  });

  it.each([
    ['dice-bearing row (byte-inert)', 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (2d8+4) fire damage.'],
    ['parenthetical dice without modifier', 'Hit: 3 (1d6) piercing damage.'],
    ['no Hit: clause', 'The creature makes a ranged attack.'],
    ['Hit clause without damage noun', 'Hit: DC 12 or the target is restrained.'],
    ['Hit clause without an integer', 'Hit: slashing damage.'],
    ['parenthesized non-dice after amount', 'Hit: 7 (advantage) slashing damage.'],
    ['null description', null],
    ['empty action object', ''],
  ])('returns null for %s', (_label, description) => {
    expect(extractFlatHitDamage({ name: 'Attack', description })).toBe(null);
  });

  it('returns null for a missing action entirely', () => {
    expect(extractFlatHitDamage(undefined)).toBe(null);
    expect(extractFlatHitDamage(null)).toBe(null);
  });
});

// MA-0747: composite "Hit: N <Type> damage plus M (XdY) <Type> damage."
// rows with NO authored damage_dice_primary were byte-blocked by the old
// global dice-paren guard (it matched the SECONDARY "(2d4)"), so the primary
// flat constant was never extracted → buildAutoDamage early-returned
// undefined → BOTH legs dealt ZERO on every hit. The guard is now scoped to
// dice in the PRIMARY clause only, so flat-primary extraction fires and the
// threaded damage_dice_secondary resolves the second leg at the
// combined_damage_roll seam (MA-0426). Flying Snake Bite + Scorpion Sting
// byte-twins are the only two rows app-wide (disk-scoped).
describe('extractFlatHitDamage (MA-0747 flat-primary + dice-secondary composite)', () => {
  const flyingSnake = monstersData.find(m => m.index === 'flying-snake');
  const scorpion = monstersData.find(m => m.index === 'scorpion');
  const BITE = flyingSnake.actions.find(a => a.name === 'Bite');
  const STING = scorpion.actions.find(a => a.name === 'Sting');

  it.each([
    ['flying-snake/Bite', BITE, '1'],
    ['scorpion/Sting', STING, '1'],
  ])('extracts flat primary %s from the disk byte-row to constant %s', (_label, row, expected) => {
    // Disk shape: no damage_dice_primary, dice only in the secondary rider.
    expect(row.damage_dice_primary).toBeUndefined();
    expect(extractFlatHitDamage(row)).toBe(expected);
  });

  it.each([
    ['dice-primary row stays byte-inert', 'Melee Weapon Attack: +5 to hit. Hit: 7 (2d8+4) fire damage.'],
    ['dice-primary without modifier', 'Hit: 3 (1d6) piercing damage plus 1 Necrotic damage.'],
    ['failure-clause dice stays byte-inert', 'Hit: 1 Piercing damage. Failure: 3 (1d6) Poison damage.'],
  ])('guard stays scoped: %s returns null', (_label, description) => {
    expect(extractFlatHitDamage({ name: 'Attack', description })).toBe(null);
  });

  it('secondary rider with no dice still yields the flat primary', () => {
    expect(extractFlatHitDamage({ name: 'Attack', description: 'Hit: 4 Piercing damage plus 1 Necrotic damage.' })).toBe('4');
  });
});
