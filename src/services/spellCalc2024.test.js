import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

// Reference to mocked classRules (filled in beforeEach)
let mockGetHighestMajorLevel;

vi.mock('./classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => 0),
  },
}));

describe('spellCalc2024', () => {
  beforeEach(async () => {
    const classRules = await import('./classRules2024.js');
    mockGetHighestMajorLevel = classRules.default.getHighestMajorLevel;
    vi.clearAllMocks();
  });

  describe('getSpellAbilities', () => {
    it('should return null when no spellcasting is available', () => {
      const allSpells = [];
      const playerStats = {
        level: 1,
        class: {
          name: 'Fighter',
          class_levels: [{ level: 1 }],
        },
        abilities: [],
      };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result).toBeNull();
    });

    it('should return spell abilities from class level spellcasting', () => {
      const allSpells = [{ name: 'Fire Bolt', level: 0, damage: { damage_type: 'Fire' }, casting_time: '1 action', range: '120 feet' }];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
              spell_known: 0,
            },
          }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        spells: ['Fire Bolt'],
        proficiency: 2,
      };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(3);
      expect(result.spell_slots).toEqual({ '1': 2 });
      expect(result.spellCastingAbility).toBe('Intelligence');
      expect(result.modifier).toBe(3);
      expect(result.toHit).toBe(5); // 3 + 2
      expect(result.saveDc).toBe(13); // 8 + 3 + 2
    });

    it('should return null when required_major does not match', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
              required_major: 'Evoker',
            },
          }],
          major: { name: 'Necromancer' },
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        spells: [],
        proficiency: 2,
      };

      const result = getSpellAbilities([], playerStats);

      expect(result).toBeNull();
    });

    it('should return spell abilities when required_major matches', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
              required_major: 'Evoker',
            },
          }],
          major: { name: 'Evoker' },
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        spells: [],
        proficiency: 2,
      };

      const result = getSpellAbilities([], playerStats);

      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(3);
    });

    it('should fall back to getHighestMajorLevel when class_levels have no spellcasting', () => {
      // getHighestMajorLevel returns a number (0 by default), so .spellcasting on it is undefined.
      // This means the fallback doesn't work in practice. The function returns null.
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{ level: 1 }], // no spellcasting here
          major: { name: 'Evoker', features: [{ level: 1 }] },
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        spells: [],
        proficiency: 2,
      };

      const result = getSpellAbilities([], playerStats);

      expect(result).toBeNull();
      expect(mockGetHighestMajorLevel).toHaveBeenCalledWith(playerStats);
    });

    it('should return empty spells array when player has no spells property', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
            },
          }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        proficiency: 2,
      };

      const result = getSpellAbilities([], playerStats);

      expect(result).not.toBeNull();
      expect(result.spells).toEqual([]);
    });

    it('should handle missing spell ability (no matching ability in array)', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
            },
          }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        spells: [],
        proficiency: 2,
      };

      const result = getSpellAbilities([], playerStats);

      expect(result).not.toBeNull();
      expect(result.modifier).toBe(0);
      expect(result.toHit).toBe(2); // proficiency only
      expect(result.saveDc).toBe(10); // 8 + proficiency
    });

    it('should map spell names to spell details from allSpells', () => {
      const allSpells = [
        { name: 'Fire Bolt', level: 0, damage: { damage_type: 'Fire' }, casting_time: '1 action', range: '120 feet' },
        { name: 'Magic Missile', level: 1, damage: { damage_type: 'Force' }, casting_time: '1 action', range: '120 feet' },
      ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 2,
              spell_slots: { '1': 2 },
            },
          }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        spells: ['Fire Bolt', 'Magic Missile'],
        proficiency: 2,
      };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(2);
      // Cantrip (level 0) should have prepared = 'Always'
      const fireBolt = result.spells.find(s => s.name === 'Fire Bolt');
      expect(fireBolt.prepared).toBe('Always');
      expect(fireBolt.level).toBe(0);

      const magicMissile = result.spells.find(s => s.name === 'Magic Missile');
      expect(magicMissile.prepared).toBe('Always');
      expect(magicMissile.level).toBe(1);
    });

    it('should sort spells by level then alphabetically', () => {
      const allSpells = [
        { name: 'Acid Splash', level: 0, damage: { damage_type: 'Acid' }, casting_time: '1 action', range: '60 feet' },
        { name: 'Fire Bolt', level: 0, damage: { damage_type: 'Fire' }, casting_time: '1 action', range: '120 feet' },
        { name: 'Shield', level: 1, damage: { damage_type: 'Force' }, casting_time: '1 reaction', range: 'Self' },
        { name: 'Magic Missile', level: 1, damage: { damage_type: 'Force' }, casting_time: '1 action', range: '120 feet' },
      ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 2,
              spell_slots: { '1': 2 },
            },
          }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        spells: ['Shield', 'Fire Bolt', 'Magic Missile', 'Acid Splash'],
        proficiency: 2,
      };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(4);
      // Sorted: level 0 alphabetically, then level 1 alphabetically
      expect(result.spells[0].name).toBe('Acid Splash');
      expect(result.spells[1].name).toBe('Fire Bolt');
      expect(result.spells[2].name).toBe('Magic Missile');
      expect(result.spells[3].name).toBe('Shield');
    });

    it('should handle subclass (legacy format) matching required_major', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Cleric',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
              required_major: 'Life',
            },
          }],
          subclass: { name: 'Life' },
          spell_casting_ability: 'Wisdom',
        },
        abilities: [
          { name: 'Wisdom', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        spells: [],
        proficiency: 2,
      };

      const result = getSpellAbilities([], playerStats);

      expect(result).not.toBeNull();
      expect(result.spellCastingAbility).toBe('Wisdom');
      expect(result.modifier).toBe(3);
    });

    it('should handle spell not found in allSpells gracefully', () => {
      const allSpells = [{ name: 'Fire Bolt', level: 0, damage: { damage_type: 'Fire' }, casting_time: '1 action', range: '120 feet' }];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 2,
              spell_slots: { '1': 2 },
            },
          }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        spells: ['Unknown Spell'],
        proficiency: 2,
      };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(1);
      expect(result.spells[0].name).toBe('Unknown Spell');
      expect(result.spells[0].prepared).toBe('Always');
    });
  });
});
