import { describe, it, expect, vi } from 'vitest';
import raceRules from './2024.js';

vi.mock('../../ui/utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn((name) => name)
  }
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null)
}));

describe('raceRules 2024 - getTraits', () => {
  describe('addTraits', () => {
    it('returns an object with all expected category keys', () => {
      const traits = [
        { name: 'Darkvision', description: 'Can see in the dark' },
        { name: 'Fey Ancestry', description: 'Advantage on saves against being charmed' }
      ];
      const result = raceRules.addTraits(traits);
      expect(Object.keys(result)).toEqual([
        'actions',
        'bonusActions',
        'reactions',
        'specialActions',
        'characterAdvancement'
      ]);
    });

    it('categorizes traits with description field correctly', () => {
      const traits = [{ name: 'Trait1', description: 'A trait with description field' }];
      const result = raceRules.addTraits(traits);
      const trait1 = result.specialActions.find((t) => t.name === 'Trait1');
      expect(trait1).toBeDefined();
      expect(trait1.description).toBe('A trait with description field');
    });

    it.each([
      [],
      null,
      undefined
    ])('returns empty categorized object for %s input', (input) => {
      const result = raceRules.addTraits(input);
      expect(result.actions).toEqual([]);
      expect(result.specialActions).toEqual([]);
      expect(result.bonusActions).toEqual([]);
      expect(result.reactions).toEqual([]);
      expect(result.characterAdvancement).toEqual([]);
    });

    it('places uncategorized traits in specialActions', () => {
      const traits = [{ name: 'Custom Trait', description: 'A custom trait' }];
      const result = raceRules.addTraits(traits);
      expect(result.specialActions.find((t) => t.name === 'Custom Trait')).toBeDefined();
    });

    it('deduplicates traits by name within each category', () => {
      const traits = [
        { name: 'Darkvision', description: 'First' },
        { name: 'Darkvision', description: 'Second' }
      ];
      const result = raceRules.addTraits(traits);
      expect(result.specialActions.filter((t) => t.name === 'Darkvision').length).toBe(1);
    });

    it('preserves trait properties beyond name and description', () => {
      const traits = [{ name: 'Trait1', description: 'Desc', details: 'Detail info', automation: { type: 'test' } }];
      const result = raceRules.addTraits(traits);
      const trait1 = result.specialActions.find((t) => t.name === 'Trait1');
      expect(trait1.details).toBe('Detail info');
      expect(trait1.automation).toEqual({ type: 'test' });
    });

    it.each([
      [null, 'null entry'],
      [undefined, 'undefined entry']
    ])('skips %s entries in traits array', (_value, _label) => {
      const traits = [null, { name: 'Trait1', description: 'Desc' }, null];
      const result = raceRules.addTraits(traits);
      expect(result.specialActions.length).toBe(1);
      expect(result.specialActions[0].name).toBe('Trait1');
    });
  });

  describe('getTraits', () => {
    it('returns categorized traits from race', () => {
      const input = {
        race: {
          traits: [
            { name: 'Darkvision', description: 'Can see in the dark' },
            { name: 'Fey Ancestry', description: 'Advantage on saves against being charmed' }
          ]
        }
      };
      const result = raceRules.getTraits(input);
      expect(Object.keys(result)).toEqual([
        'actions',
        'bonusActions',
        'reactions',
        'specialActions',
        'characterAdvancement'
      ]);
    });

    it('returns empty categorized object for missing or empty traits sources', () => {
      const cases = [
        { race: {} },
        {},
        { race: { traits: [] } },
        { race: { lineage: 'High Elf' } }
      ];
      for (const input of cases) {
        const result = raceRules.getTraits(input);
        expect(Object.keys(result)).toEqual([
          'actions',
          'bonusActions',
          'reactions',
          'specialActions',
          'characterAdvancement'
        ]);
      }
    });

    it('handles null lineage and subrace', () => {
      const input = {
        race: {
          lineage: null,
          subrace: null,
          traits: [{ name: 'Darkvision', description: 'Can see in the dark' }]
        }
      };
      const result = raceRules.getTraits(input);
      const names = result.specialActions.map((t) => t.name);
      expect(names).toContain('Darkvision');
    });

    it('handles subrace without traits', () => {
      const input = {
        race: {
          traits: [{ name: 'Darkvision', description: 'Can see in the dark' }],
          subrace: {}
        }
      };
      const result = raceRules.getTraits(input);
      const names = result.specialActions.map((t) => t.name);
      expect(names).toContain('Darkvision');
    });

    it('handles lineage with no sub_traits', () => {
      const input = {
        race: {
          lineage: 'High Elf',
          traits: [{ name: 'Darkvision', description: 'Can see in the dark' }]
        }
      };
      const result = raceRules.getTraits(input);
      const names = result.specialActions.map((t) => t.name);
      expect(names).toContain('Darkvision');
      expect(names).not.toContain('Ancestry (High Elf)');
    });

    it('includes lineage traits when lineage matches', () => {
      const input = {
        race: {
          lineage: 'High Elf',
          traits: [
            { name: 'Darkvision', description: 'Can see in the dark' },
            {
              name: 'Ancestry',
              sub_traits: [{ name: 'High Elf', description: 'High elf lineage traits.' }]
            }
          ]
        }
      };
      const result = raceRules.getTraits(input);
      const names = result.specialActions.map((t) => t.name);
      expect(names).toContain('Darkvision');
      expect(names).toContain('Ancestry (High Elf)');
    });

    it('excludes lineage traits when lineage does not match', () => {
      const input = {
        race: {
          lineage: 'Wood Elf',
          traits: [
            {
              name: 'Ancestry',
              sub_traits: [{ name: 'High Elf', description: 'High elf traits.' }]
            }
          ]
        }
      };
      const result = raceRules.getTraits(input);
      const names = result.specialActions.map((t) => t.name);
      expect(names).not.toContain('Ancestry (High Elf)');
    });

    it('merges base traits with lineage traits', () => {
      const input = {
        race: {
          lineage: 'High Elf',
          traits: [
            { name: 'Darkvision', description: 'Base trait' },
            { name: 'Fey Ancestry', description: 'Another base trait' },
            {
              name: 'Ancestry',
              sub_traits: [{ name: 'High Elf', description: 'Lineage trait' }]
            }
          ]
        }
      };
      const result = raceRules.getTraits(input);
      const names = result.specialActions.map((t) => t.name);
      expect(names).toContain('Darkvision');
      expect(names).toContain('Fey Ancestry');
      expect(names).toContain('Ancestry (High Elf)');
    });

    it('merges subrace traits with base traits', () => {
      const input = {
        race: {
          traits: [{ name: 'Darkvision', description: 'Base trait' }],
          subrace: {
            traits: [{ name: 'Subrace Trait', description: 'Subrace-specific trait' }]
          }
        }
      };
      const result = raceRules.getTraits(input);
      const names = result.specialActions.map((t) => t.name);
      expect(names).toContain('Darkvision');
      expect(names).toContain('Subrace Trait');
    });

    it('deduplicates traits when base and subrace have the same trait', () => {
      const input = {
        race: {
          traits: [{ name: 'Darkvision', description: 'Base darkvision' }],
          subrace: {
            traits: [{ name: 'Darkvision', description: 'Subrace darkvision' }]
          }
        }
      };
      const result = raceRules.getTraits(input);
      expect(result.specialActions.filter((t) => t.name === 'Darkvision').length).toBe(1);
    });

    it('combines lineage and subrace traits together', () => {
      const input = {
        race: {
          lineage: 'High Elf',
          traits: [
            { name: 'Darkvision', description: 'Base trait' },
            {
              name: 'Ancestry',
              sub_traits: [{ name: 'High Elf', description: 'Lineage trait' }]
            }
          ],
          subrace: {
            traits: [{ name: 'Subrace Trait', description: 'Subrace trait' }]
          }
        }
      };
      const result = raceRules.getTraits(input);
      const allTraitNames = [
        ...result.actions.map((t) => t.name),
        ...result.bonusActions.map((t) => t.name),
        ...result.reactions.map((t) => t.name),
        ...result.specialActions.map((t) => t.name),
        ...result.characterAdvancement.map((t) => t.name)
      ];
      expect(allTraitNames).toContain('Darkvision');
      expect(allTraitNames).toContain('Ancestry (High Elf)');
      expect(allTraitNames).toContain('Subrace Trait');
    });

    it('preserves trait names with lineage suffix format', () => {
      const input = {
        race: {
          lineage: 'High Elf',
          traits: [
            {
              name: 'Ancestry',
              sub_traits: [{ name: 'High Elf', description: 'Lineage description' }]
            }
          ]
        }
      };
      const result = raceRules.getTraits(input);
      const lineageTrait = result.specialActions.find((t) => t.name === 'Ancestry (High Elf)');
      expect(lineageTrait).toBeDefined();
      expect(lineageTrait.description).toBe('Lineage description');
    });
  });
});
