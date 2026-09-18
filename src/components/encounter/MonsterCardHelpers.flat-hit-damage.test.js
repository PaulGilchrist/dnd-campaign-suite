// MA-0322: flat integer hit damage ("Hit: 1 Slashing damage.", no
// damage_dice_primary) was silently dealt as ZERO — extractFlatHitDamage
// parses the constant back out for the attack-row auto-damage seam ONLY.
import { describe, it, expect } from 'vitest';
import { extractFlatHitDamage } from './MonsterCardHelpers.js';

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
