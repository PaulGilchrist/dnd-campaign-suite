import { describe, it, expect } from 'vitest';
import { resolveSpellDamageAtLevel, isAutoHitSpell } from './spellDamageUtils.js';

describe('spellDamageUtils', () => {
  describe('resolveSpellDamageAtLevel', () => {
    describe('null/empty handling', () => {
      it('returns empty string when spell is null', () => {
        expect(resolveSpellDamageAtLevel(null, 5)).toBe('');
      });

      it('returns empty string when spell is undefined', () => {
        expect(resolveSpellDamageAtLevel(undefined, 5)).toBe('');
      });

      it('returns empty string when spell has no damage property', () => {
        expect(resolveSpellDamageAtLevel({ name: 'Mage Hand' }, 5)).toBe('');
      });

      it('returns empty string when spell.damage is null', () => {
        expect(resolveSpellDamageAtLevel({ damage: null }, 5)).toBe('');
      });

      it('returns empty string when both damage objects are empty', () => {
        expect(resolveSpellDamageAtLevel({ damage: { damage_at_slot_level: {}, damage_at_character_level: null } }, 5)).toBe('');
      });

      it('returns empty string when both damage objects are undefined', () => {
        expect(resolveSpellDamageAtLevel({ damage: {} }, 5)).toBe('');
      });
    });

    describe('cantrips with damage_at_slot_level (5e format)', () => {
      const fireBolt = {
        name: 'Fire Bolt',
        level: 0,
        damage: {
          damage_type: 'Fire',
          damage_at_slot_level: {
            '1': '1d10',
            '5': '2d10',
            '11': '3d10',
            '17': '4d6',
          },
        },
      };

      it('returns base tier at level 1', () => {
        expect(resolveSpellDamageAtLevel(fireBolt, 1)).toBe('1d10');
      });

      it('returns base tier at level 4', () => {
        expect(resolveSpellDamageAtLevel(fireBolt, 4)).toBe('1d10');
      });

      it('returns 5th level tier at level 5', () => {
        expect(resolveSpellDamageAtLevel(fireBolt, 5)).toBe('2d10');
      });

      it('returns 5th level tier at level 10', () => {
        expect(resolveSpellDamageAtLevel(fireBolt, 10)).toBe('2d10');
      });

      it('returns 11th level tier at level 11', () => {
        expect(resolveSpellDamageAtLevel(fireBolt, 11)).toBe('3d10');
      });

      it('returns 11th level tier at level 16', () => {
        expect(resolveSpellDamageAtLevel(fireBolt, 16)).toBe('3d10');
      });

      it('returns 17th level tier at level 17', () => {
        expect(resolveSpellDamageAtLevel(fireBolt, 17)).toBe('4d6');
      });

      it('returns 17th level tier at level 20', () => {
        expect(resolveSpellDamageAtLevel(fireBolt, 20)).toBe('4d6');
      });
    });

    describe('cantrips with damage_at_character_level (5e Acid Splash format)', () => {
      const acidSplash = {
        name: 'Acid Splash',
        level: 0,
        damage: {
          damage_type: 'Acid',
          damage_at_character_level: {
            '1': '1d6',
            '5': '2d6',
            '11': '3d6',
            '17': '4d6',
          },
        },
      };

      it('returns base tier at level 1', () => {
        expect(resolveSpellDamageAtLevel(acidSplash, 1)).toBe('1d6');
      });

      it('returns 5th level tier at level 5', () => {
        expect(resolveSpellDamageAtLevel(acidSplash, 5)).toBe('2d6');
      });

      it('returns 11th level tier at level 11', () => {
        expect(resolveSpellDamageAtLevel(acidSplash, 11)).toBe('3d6');
      });

      it('returns 17th level tier at level 20', () => {
        expect(resolveSpellDamageAtLevel(acidSplash, 20)).toBe('4d6');
      });
    });

    describe('cantrips with damage_at_slot_level starting at level 5 (2024 format)', () => {
      const acidSplash2024 = {
        name: 'Acid Splash',
        level: 0,
        damage: {
          damage_type: 'Acid',
          damage_at_slot_level: {
            '5': '2d6',
            '11': '3d6',
            '17': '4d6',
          },
        },
      };

      it('falls back to first available tier when below all tiers (level 1)', () => {
        expect(resolveSpellDamageAtLevel(acidSplash2024, 1)).toBe('2d6');
      });

      it('returns first tier at level 5', () => {
        expect(resolveSpellDamageAtLevel(acidSplash2024, 5)).toBe('2d6');
      });

      it('returns 11th level tier at level 11', () => {
        expect(resolveSpellDamageAtLevel(acidSplash2024, 11)).toBe('3d6');
      });

      it('returns 17th level tier at level 20', () => {
        expect(resolveSpellDamageAtLevel(acidSplash2024, 20)).toBe('4d6');
      });
    });

    describe('leveled spells with damage_at_slot_level', () => {
      const magicMissile = {
        name: 'Magic Missile',
        level: 1,
        damage: {
          damage_type: 'Force',
          damage_at_slot_level: {
            '1': '1d4 + 1',
            '2': '1d4 + 1',
            '3': '1d4 + 1',
            '4': '1d4 + 1',
            '5': '1d4 + 1',
            '6': '1d4 + 1',
            '7': '1d4 + 1',
            '8': '1d4 + 1',
            '9': '1d4 + 1',
          },
        },
      };

      it('returns base tier regardless of character level', () => {
        expect(resolveSpellDamageAtLevel(magicMissile, 1)).toBe('1d4 + 1');
        expect(resolveSpellDamageAtLevel(magicMissile, 5)).toBe('1d4 + 1');
        expect(resolveSpellDamageAtLevel(magicMissile, 9)).toBe('1d4 + 1');
        expect(resolveSpellDamageAtLevel(magicMissile, 20)).toBe('1d4 + 1');
      });
    });

    describe('leveled spells with damage_at_slot_level with varying tiers', () => {
      const acidArrow = {
        name: 'Acid Arrow',
        level: 2,
        damage: {
          damage_type: 'Acid',
          damage_at_slot_level: {
            '2': '4d4',
            '3': '5d4',
            '4': '6d4',
            '5': '7d4',
            '6': '8d4',
            '7': '9d4',
            '8': '10d4',
            '9': '11d4',
          },
        },
      };

      it('returns base tier (level 2) regardless of character level', () => {
        expect(resolveSpellDamageAtLevel(acidArrow, 2)).toBe('4d4');
        expect(resolveSpellDamageAtLevel(acidArrow, 5)).toBe('4d4');
        expect(resolveSpellDamageAtLevel(acidArrow, 20)).toBe('4d4');
      });
    });

    describe('fallback to damage_at_character_level', () => {
      const charLevelSpell = {
        name: 'Charm Spell',
        level: 1,
        damage: {
          damage_type: 'Psychic',
          damage_at_character_level: {
            '1': '2d6',
            '5': '3d6',
            '11': '4d6',
            '17': '5d6',
          },
          damage_at_slot_level: {},
        },
      };

      it('uses damage_at_character_level when damage_at_slot_level is empty, returns base tier for leveled spell', () => {
        expect(resolveSpellDamageAtLevel(charLevelSpell, 1)).toBe('2d6');
        expect(resolveSpellDamageAtLevel(charLevelSpell, 5)).toBe('2d6');
        expect(resolveSpellDamageAtLevel(charLevelSpell, 20)).toBe('2d6');
      });

      it('scales cantrip with damage_at_character_level when damage_at_slot_level is empty', () => {
        const cantrip = {
          name: 'Cantrip Charm',
          level: 0,
          damage: {
            damage_type: 'Psychic',
            damage_at_character_level: {
              '1': '2d6',
              '5': '3d6',
              '11': '4d6',
              '17': '5d6',
            },
            damage_at_slot_level: {},
          },
        };
        expect(resolveSpellDamageAtLevel(cantrip, 1)).toBe('2d6');
        expect(resolveSpellDamageAtLevel(cantrip, 5)).toBe('3d6');
        expect(resolveSpellDamageAtLevel(cantrip, 11)).toBe('4d6');
        expect(resolveSpellDamageAtLevel(cantrip, 20)).toBe('5d6');
      });
    });

    describe('damage_at_slot_level takes priority over damage_at_character_level', () => {
      const bothPresent = {
        name: 'Both Present',
        level: 1,
        damage: {
          damage_type: 'Fire',
          damage_at_slot_level: {
            '1': '3d6',
            '5': '4d6',
          },
          damage_at_character_level: {
            '1': '1d6',
            '5': '2d6',
          },
        },
      };

      it('prefers damage_at_slot_level when both are present and non-empty, returns base tier for leveled spell', () => {
        expect(resolveSpellDamageAtLevel(bothPresent, 1)).toBe('3d6');
        expect(resolveSpellDamageAtLevel(bothPresent, 5)).toBe('3d6');
      });

      it('scales cantrip with damage_at_slot_level priority at both present', () => {
        const cantrip = {
          name: 'Both Cantrip',
          level: 0,
          damage: {
            damage_type: 'Fire',
            damage_at_slot_level: {
              '1': '3d6',
              '5': '4d6',
            },
            damage_at_character_level: {
              '1': '1d6',
              '5': '2d6',
            },
          },
        };
        expect(resolveSpellDamageAtLevel(cantrip, 1)).toBe('3d6');
        expect(resolveSpellDamageAtLevel(cantrip, 5)).toBe('4d6');
      });
    });

    describe('edge cases', () => {
      it('returns base tier when character level is 0', () => {
        const spell = {
          name: 'Test Spell',
          level: 1,
          damage: {
            damage_type: 'Fire',
            damage_at_slot_level: {
              '1': '1d8',
              '5': '2d8',
            },
          },
        };
        expect(resolveSpellDamageAtLevel(spell, 0)).toBe('1d8');
      });

      it('handles single-tier damage_at_slot_level', () => {
        const spell = {
          name: 'Single Tier',
          level: 1,
          damage: {
            damage_type: 'Cold',
            damage_at_slot_level: {
              '1': '5',
            },
          },
        };
        expect(resolveSpellDamageAtLevel(spell, 1)).toBe('5');
        expect(resolveSpellDamageAtLevel(spell, 20)).toBe('5');
      });

      it('handles damage value that is a plain number string', () => {
        const spell = {
          name: 'Armor of Agathys',
          level: 1,
          damage: {
            damage_type: 'Cold',
            damage_at_slot_level: {
              '1': '5',
              '2': '10',
              '3': '15',
            },
          },
        };
        expect(resolveSpellDamageAtLevel(spell, 1)).toBe('5');
      });
    });
  });

  describe('isAutoHitSpell', () => {
    describe('null/empty handling', () => {
      it('returns false when spell is null', () => {
        expect(isAutoHitSpell(null)).toBe(false);
      });

      it('returns false when spell is undefined', () => {
        expect(isAutoHitSpell(undefined)).toBe(false);
      });

      it('returns false when spell is an empty object', () => {
        expect(isAutoHitSpell({})).toBe(false);
      });
    });

    describe('healing spells', () => {
      it('returns true when spell has heal_at_slot_level', () => {
        expect(isAutoHitSpell({ heal_at_slot_level: { '1': '1d4' } })).toBe(true);
      });

      it('returns true when heal_at_slot_level is an empty object', () => {
        expect(isAutoHitSpell({ heal_at_slot_level: {} })).toBe(true);
      });

      it('returns true when heal_at_slot_level has multiple tiers', () => {
        const healSpell = {
          heal_at_slot_level: {
            '1': '5',
            '2': '10',
            '3': '15',
          },
        };
        expect(isAutoHitSpell(healSpell)).toBe(true);
      });
    });

    describe('Magic Missile', () => {
      it('returns true for exact match "Magic Missile"', () => {
        expect(isAutoHitSpell({ name: 'Magic Missile' })).toBe(true);
      });

      it('returns true for case-insensitive match', () => {
        expect(isAutoHitSpell({ name: 'magic missile' })).toBe(true);
        expect(isAutoHitSpell({ name: 'MAGIC MISSILE' })).toBe(true);
        expect(isAutoHitSpell({ name: 'Magic Missile' })).toBe(true);
      });

      it('returns true when name is "Magic Missile" even with other properties', () => {
        expect(isAutoHitSpell({
          name: 'Magic Missile',
          level: 1,
          damage: { damage_type: 'Force', damage_at_slot_level: { '1': '1d4 + 1' } },
        })).toBe(true);
      });
    });

    describe('non-auto-hit spells', () => {
      it('returns false for a normal damage spell', () => {
        expect(isAutoHitSpell({
          name: 'Fire Bolt',
          level: 0,
          damage: { damage_type: 'Fire', damage_at_slot_level: { '1': '1d10' } },
        })).toBe(false);
      });

      it('returns false for a spell with only damage property', () => {
        expect(isAutoHitSpell({
          name: 'Thunderwave',
          damage: { damage_type: 'Thunder', damage_at_slot_level: { '1': '2d8' } },
        })).toBe(false);
      });

      it('returns false for a spell with heal_at_slot_level as null', () => {
        expect(isAutoHitSpell({ heal_at_slot_level: null })).toBe(false);
      });

      it('returns false for a spell with name containing "missile" but not exact match', () => {
        expect(isAutoHitSpell({ name: 'Big Missile' })).toBe(false);
        expect(isAutoHitSpell({ name: 'Missile Spell' })).toBe(false);
      });

      it('returns false for a spell with name containing "heal" but no heal_at_slot_level', () => {
        expect(isAutoHitSpell({ name: 'Healing Word', damage: { damage_at_slot_level: {} } })).toBe(false);
      });
    });
  });
});
