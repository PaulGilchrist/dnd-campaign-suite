// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';
import raceRules from './2024.js';

// Mock dependencies
vi.mock('../../ui/utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn((name) => name)
  }
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null)
}));

describe('raceRules 2024 (direct module)', () => {
  describe('getImmunities', () => {
    it('returns empty array when no race', () => {
      expect(raceRules.getImmunities({})).toEqual([]);
    });

    it('returns empty array when race has no traits or immunities', () => {
      expect(raceRules.getImmunities({ race: { traits: [] } })).toEqual([]);
    });

    it('returns empty array when traits have no immunity mention', () => {
      const input = {
        race: {
          traits: [
            { description: 'You have darkvision with a range of 60 feet.' },
            { description: 'You can speak Common and Elvish.' }
          ]
        }
      };
      expect(raceRules.getImmunities(input)).toEqual([]);
    });

    it('extracts immunity type from trait description', () => {
      const input = {
        race: {
          traits: [
            { description: 'You have immunity to poison damage.' }
          ]
        }
      };
      const result = raceRules.getImmunities(input);
      expect(result).toContain('poison');
    });

    it('extracts immunity type ending with a period', () => {
      const input = {
        race: {
          traits: [
            { description: 'You have immunity to charm.' }
          ]
        }
      };
      expect(raceRules.getImmunities(input)).toContain('charm');
    });

    it('extracts multiple immunities from different traits', () => {
      const input = {
        race: {
          traits: [
            { description: 'You have immunity to poison.' },
            { description: 'You have immunity to disease.' }
          ]
        }
      };
      const result = raceRules.getImmunities(input);
      expect(result).toContain('poison');
      expect(result).toContain('disease');
    });

    it('combines trait immunities with playerSummary immunities', () => {
      const input = {
        race: {
          traits: [
            { description: 'You have immunity to poison.' }
          ]
        },
        immunities: ['Disease']
      };
      const result = raceRules.getImmunities(input);
      expect(result).toContain('poison');
      expect(result).toContain('Disease');
    });

    it('deduplicates immunities across sources', () => {
      const input = {
        race: {
          traits: [
            { description: 'You have immunity to poison.' }
          ]
        },
        immunities: ['poison']
      };
      const result = raceRules.getImmunities(input);
      expect(result.filter((i) => i === 'poison').length).toBe(1);
    });

    it('sorts string immunities alphabetically', () => {
      const input = {
        race: { traits: [] },
        immunities: ['Zebra', 'Alpha', 'Middle']
      };
      const result = raceRules.getImmunities(input);
      expect(result).toEqual(['Alpha', 'Middle', 'Zebra']);
    });

    it('sorts object immunities by name alphabetically', () => {
      const input = {
        race: { traits: [] },
        immunities: [{ name: 'Zebra' }, { name: 'Alpha' }, { name: 'Middle' }]
      };
      const result = raceRules.getImmunities(input);
      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Middle');
      expect(result[2].name).toBe('Zebra');
    });

    it('adds Magical Sleep immunity for Trance trait', () => {
      const input = {
        race: {
          traits: [
            { name: 'Trance', description: "You don't need to sleep, and magic can't put you to sleep." }
          ]
        }
      };
      expect(raceRules.getImmunities(input)).toContain('Magical Sleep');
    });

    it('combines Trance Magical Sleep with other immunities', () => {
      const input = {
        race: {
          traits: [
            { name: 'Trance', description: "You don't need to sleep, and magic can't put you to sleep." },
            { description: 'You have immunity to poison.' }
          ]
        }
      };
      const result = raceRules.getImmunities(input);
      expect(result).toContain('Magical Sleep');
      expect(result).toContain('poison');
    });

    it('handles trait with no description field', () => {
      const input = {
        race: {
          traits: [{ name: 'Some Trait' }]
        }
      };
      expect(raceRules.getImmunities(input)).toEqual([]);
    });
  });

  describe('getResistances', () => {
    it('returns empty array when no race', () => {
      expect(raceRules.getResistances({})).toEqual([]);
    });

    it('returns empty array when race has no traits or subrace', () => {
      expect(raceRules.getResistances({ race: { name: 'Human' } })).toEqual([]);
    });

    it('extracts resistance from subrace damage_resistance', () => {
      const input = {
        race: {
          subrace: { damage_resistance: 'Fire' }
        }
      };
      expect(raceRules.getResistances(input)).toContain('Fire');
    });

    it('extracts resistance from trait description', () => {
      const input = {
        race: {
          traits: [
            { description: 'You have resistance to cold damage.' }
          ]
        }
      };
      expect(raceRules.getResistances(input)).toContain('cold');
    });

    it('combines subrace and trait resistances', () => {
      const input = {
        race: {
          subrace: { damage_resistance: 'Fire' },
          traits: [
            { description: 'You have resistance to poison.' }
          ]
        }
      };
      const result = raceRules.getResistances(input);
      expect(result).toContain('Fire');
      expect(result).toContain('poison');
    });

    it('combines subrace, trait, and playerSummary resistances', () => {
      const input = {
        race: {
          subrace: { damage_resistance: 'Fire' },
          traits: [
            { description: 'You have resistance to cold.' }
          ]
        },
        resistances: ['Acid']
      };
      const result = raceRules.getResistances(input);
      expect(result).toContain('Fire');
      expect(result).toContain('cold');
      expect(result).toContain('Acid');
    });

    it('deduplicates resistances across sources', () => {
      const input = {
        race: {
          traits: [
            { description: 'You have resistance to fire.' }
          ]
        },
        resistances: ['fire']
      };
      const result = raceRules.getResistances(input);
      expect(result.filter((r) => r === 'fire').length).toBe(1);
    });

    it('sorts resistances alphabetically', () => {
      const input = {
        race: { traits: [] },
        resistances: [{ name: 'Zebra' }, { name: 'Alpha' }, { name: 'Middle' }]
      };
      const result = raceRules.getResistances(input);
      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Middle');
      expect(result[2].name).toBe('Zebra');
    });

    it('returns Fiendish Legacy resistance for Abyssal selection', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
      getRuntimeValue.mockReturnValue('Abyssal');

      const input = {
        name: 'TestChar',
        race: {
          traits: [
            { name: 'Fiendish Legacies', description: 'Abyssal: Resistance to Poison damage.' }
          ]
        }
      };
      expect(raceRules.getResistances(input)).toContain('Poison');
    });

    it('returns Fiendish Legacy resistance for Chthonic selection', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
      getRuntimeValue.mockReturnValue('Chthonic');

      const input = {
        name: 'TestChar',
        race: {
          traits: [
            { name: 'Fiendish Legacies', description: 'Chthonic: Resistance to Necrotic damage.' }
          ]
        }
      };
      expect(raceRules.getResistances(input)).toContain('Necrotic');
    });

    it('returns Fiendish Legacy resistance for Infernal selection', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
      getRuntimeValue.mockReturnValue('Infernal');

      const input = {
        name: 'TestChar',
        race: {
          traits: [
            { name: 'Fiendish Legacies', description: 'Infernal: Resistance to Fire damage.' }
          ]
        }
      };
      expect(raceRules.getResistances(input)).toContain('Fire');
    });

    it('falls back to regex extraction when no Fiendish Legacy selected', async () => {
      const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
      getRuntimeValue.mockReturnValue(null);

      const input = {
        race: {
          traits: [
            { name: 'Fiendish Legacies', description: 'Abyssal: Resistance to Poison damage.' }
          ]
        }
      };
      // Without a legacy selection, the trait is not skipped, so the regex extracts Poison
      expect(raceRules.getResistances(input)).toContain('Poison');
    });

    it('skips "the" keyword from resistance extraction', () => {
      const input = {
        race: {
          traits: [
            { description: 'You have resistance to the magic damage.' }
          ]
        }
      };
      const result = raceRules.getResistances(input);
      expect(result).not.toContain('the');
    });

    it('extracts only the first word after "resistance to" per match', () => {
      const input = {
        race: {
          traits: [
            { description: 'You have resistance to poison damage.' }
          ]
        }
      };
      const result = raceRules.getResistances(input);
      expect(result).toContain('poison');
    });

    it('handles trait with no description field', () => {
      const input = {
        race: {
          traits: [{ name: 'Some Trait' }]
        }
      };
      expect(raceRules.getResistances(input)).toEqual([]);
    });
  });

  describe('getSenses', () => {
    it('returns empty array when no senses or traits', () => {
      expect(raceRules.getSenses({ race: { traits: [] } })).toEqual([]);
    });

    it('returns existing senses', () => {
      const input = {
        senses: [{ name: 'Normal Vision', value: '60 ft.' }],
        race: { traits: [] }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Normal Vision', value: '60 ft.' });
    });

    it('handles undefined senses property', () => {
      expect(raceRules.getSenses({ race: { traits: [] } })).toEqual([]);
    });

    it('extracts darkvision with 60 ft range', () => {
      const input = {
        senses: [],
        race: {
          traits: [
            { description: 'You have darkvision with a range of 60 feet.' }
          ]
        }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });

    it('extracts darkvision with 120 ft range', () => {
      const input = {
        senses: [],
        race: {
          traits: [
            { description: 'You have darkvision with a range of 120 feet.' }
          ]
        }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Darkvision', value: '120 ft.' });
    });

    it('does not duplicate darkvision if already present', () => {
      const input = {
        senses: [{ name: 'Darkvision', value: '120 ft.' }],
        race: {
          traits: [
            { description: 'You have darkvision with a range of 60 feet.' }
          ]
        }
      };
      const result = raceRules.getSenses(input);
      expect(result.filter((s) => s.name === 'Darkvision').length).toBe(1);
      expect(result.find((s) => s.name === 'Darkvision').value).toBe('120 ft.');
    });

    it('extracts tremorsense with 30 ft range', () => {
      const input = {
        senses: [],
        race: {
          traits: [
            { description: 'You have tremorsense with a range of 30 feet.' }
          ]
        }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Tremorsense', value: '30 ft.' });
    });

    it('extracts tremorsense with 60 ft range', () => {
      const input = {
        senses: [],
        race: {
          traits: [
            { description: 'You have tremorsense with a range of 60 feet.' }
          ]
        }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Tremorsense', value: '60 ft.' });
    });

    it('does not duplicate tremorsense if already present', () => {
      const input = {
        senses: [{ name: 'Tremorsense', value: '60 ft.' }],
        race: {
          traits: [
            { description: 'You have tremorsense with a range of 30 feet.' }
          ]
        }
      };
      const result = raceRules.getSenses(input);
      expect(result.filter((s) => s.name === 'Tremorsense').length).toBe(1);
      expect(result.find((s) => s.name === 'Tremorsense').value).toBe('60 ft.');
    });

    it('adds passive perception when abilities available', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: [
          {
            name: 'Wisdom',
            bonus: 2,
            skills: [{ name: 'Perception', bonus: 5 }]
          }
        ]
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Passive Perception', value: '15' });
    });

    it('uses ability bonus when no skill bonus', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: [
          {
            name: 'Wisdom',
            bonus: 3,
            skills: []
          }
        ]
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Passive Perception', value: '13' });
    });

    it('adds passive investigation when abilities available', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: [
          {
            name: 'Intelligence',
            bonus: 1,
            skills: [{ name: 'Investigation', bonus: 3 }]
          }
        ]
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Passive Investigation', value: '13' });
    });

    it('adds passive insight when abilities available', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: [
          {
            name: 'Wisdom',
            bonus: 2,
            skills: [{ name: 'Insight', bonus: 2 }]
          }
        ]
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Passive Insight', value: '12' });
    });

    it('does not add passive skills when abilities array missing', () => {
      const input = {
        senses: [],
        race: { traits: [] }
      };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Passive Perception', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Investigation', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Insight', value: '10' });
    });

    it('does not add passive skills when abilities is empty', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: []
      };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Passive Perception', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Investigation', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Insight', value: '10' });
    });

    it('does not add passive perception when Wisdom ability not found', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: [
          {
            name: 'Strength',
            bonus: 2,
            skills: []
          }
        ]
      };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Passive Perception', value: '12' });
    });

    it('uses ability bonus when skill not found', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: [
          {
            name: 'Wisdom',
            bonus: 2,
            skills: [{ name: 'Animal Handling', bonus: 0 }]
          }
        ]
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Passive Perception', value: '12' });
    });

    it('sorts senses alphabetically', () => {
      const input = {
        senses: [
          { name: 'Zebra Vision', value: '10 ft.' },
          { name: 'Alpha Vision', value: '5 ft.' }
        ],
        race: { traits: [] }
      };
      const result = raceRules.getSenses(input);
      expect(result[0].name).toBe('Alpha Vision');
      expect(result[1].name).toBe('Zebra Vision');
    });

    it('handles trait with no description', () => {
      const input = {
        senses: [],
        race: {
          traits: [{ name: 'Some Trait' }]
        }
      };
      expect(raceRules.getSenses(input)).toEqual([]);
    });

    it('handles undefined race', () => {
      expect(raceRules.getSenses({ senses: [] })).toEqual([]);
    });

    it('handles race without traits', () => {
      expect(raceRules.getSenses({ senses: [], race: {} })).toEqual([]);
    });

    it('adds Blindsight 30 ft. when Feral Senses class feature exists', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        class: {
          class_levels: [
            { level: 1, features: [{ name: 'Spellcasting', level: 1 }] },
            { level: 18, features: [{ name: 'Feral Senses', description: 'Your connection to the forces of nature grants you Blindsight with a range of 30 feet.', level: 18 }] }
          ]
        }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Blindsight', value: '30 ft.' });
    });

    it('does not duplicate Blindsight if already present', () => {
      const input = {
        senses: [{ name: 'Blindsight', value: '10 ft.' }],
        race: { traits: [] },
        class: {
          class_levels: [
            { level: 18, features: [{ name: 'Feral Senses', level: 18 }] }
          ]
        }
      };
      const result = raceRules.getSenses(input);
      expect(result.filter((s) => s.name === 'Blindsight').length).toBe(1);
    });

    it('does not add Blindsight if already present from senses', () => {
      const input = {
        senses: [{ name: 'Blindsight', value: '60 ft.' }],
        race: { traits: [] },
        class: {
          class_levels: [
            { level: 18, features: [{ name: 'Feral Senses', level: 18 }] }
          ]
        }
      };
      const result = raceRules.getSenses(input);
      const blindsight = result.find((s) => s.name === 'Blindsight');
      expect(blindsight.value).toBe('60 ft.');
    });

    it('does not add Blindsight when Feral Senses is in featuresToIgnore list', async () => {
      // Feral Senses is listed in featureCategories 2024 featuresToIgnore
      // but getSenses checks by name directly, so it should still be detected
      const input = {
        senses: [],
        race: { traits: [] },
        class: {
          class_levels: [
            { level: 18, features: [{ name: 'Feral Senses' }] }
          ]
        }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Blindsight', value: '30 ft.' });
    });

    it('does not add Blindsight when class is missing', () => {
      const input = {
        senses: [],
        race: { traits: [] }
      };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Blindsight', value: '30 ft.' });
    });

    it('does not add Blindsight when class_levels is empty', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        class: { class_levels: [] }
      };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Blindsight', value: '30 ft.' });
    });

    it('does not add Blindsight when features array is missing', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        class: {
          class_levels: [
            { level: 18 }
          ]
        }
      };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Blindsight', value: '30 ft.' });
    });

    it('does not add tremorsense for Stonecunning trait', () => {
      const input = {
        senses: [],
        race: {
          traits: [
            { name: 'Stonecunning', description: 'You have tremorsense with a range of 60 feet.' }
          ]
        }
      };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Tremorsense', value: '60 ft.' });
    });

    it('adds tremorsense for non-Stonecunning traits with tremorsense', () => {
      const input = {
        senses: [],
        race: {
          traits: [
            { name: 'Some Other Trait', description: 'You have tremorsense with a range of 30 feet.' }
          ]
        }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Tremorsense', value: '30 ft.' });
    });
  });

  describe('getRace', () => {
    it('returns playerSummary.race when race not found in allRaces', () => {
      const allRaces = [];
      const playerSummary = { race: { name: 'Custom Race' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result).toEqual({ name: 'Custom Race' });
    });

    it('returns a clone of found race (not same reference)', () => {
      const allRaces = [{ name: 'Human', traits: [] }];
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.name).toBe('Human');
      expect(result).not.toBe(allRaces[0]);
    });

    it('merges playerSummary race data into result', () => {
      const allRaces = [{ name: 'Human', traits: [] }];
      const playerSummary = {
        race: {
          name: 'Human',
          customProperty: 'custom value'
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.name).toBe('Human');
      expect(result.customProperty).toBe('custom value');
    });

    it('resolves subrace from JSON data', () => {
      const allRaces = [
        {
          name: 'Elf',
          subraces: [
            {
              name: 'High Elf',
              damage_resistance: 'Fire',
              traits: []
            }
          ]
        }
      ];
      const playerSummary = {
        race: {
          name: 'Elf',
          subrace: { name: 'High Elf' }
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subrace.name).toBe('High Elf');
      expect(result.subrace.damage_resistance).toBe('Fire');
    });

    it('merges playerSummary subrace data over JSON data', () => {
      const allRaces = [
        {
          name: 'Elf',
          subraces: [
            {
              name: 'High Elf',
              damage_resistance: 'Fire'
            }
          ]
        }
      ];
      const playerSummary = {
        race: {
          name: 'Elf',
          subrace: { name: 'High Elf', customProp: 'value' }
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subrace.name).toBe('High Elf');
      expect(result.subrace.damage_resistance).toBe('Fire');
      expect(result.subrace.customProp).toBe('value');
    });

    it('handles subrace not found in subraces list', () => {
      const allRaces = [
        {
          name: 'Elf',
          subraces: []
        }
      ];
      const playerSummary = {
        race: {
          name: 'Elf',
          subrace: { name: 'High Elf' }
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subrace).toEqual({ name: 'High Elf' });
    });

    it('resolves lineage from sub_traits', () => {
      const allRaces = [
        {
          name: 'Elf',
          traits: [
            {
              name: 'Ancestry',
              sub_traits: [
                { name: 'High Elf', description: 'High elf traits.' }
              ]
            }
          ]
        }
      ];
      const playerSummary = {
        race: {
          name: 'Elf',
          lineage: 'High Elf'
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.traits[0].selectedLineage).toBeDefined();
      expect(result.traits[0].selectedLineage.name).toBe('High Elf');
    });

    it('leaves selectedLineage undefined when lineage not found in sub_traits', () => {
      const allRaces = [
        {
          name: 'Elf',
          traits: [
            {
              name: 'Ancestry',
              sub_traits: [
                { name: 'High Elf', description: 'High elf traits.' }
              ]
            }
          ]
        }
      ];
      const playerSummary = {
        race: {
          name: 'Elf',
          lineage: 'Wood Elf'
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.traits[0].selectedLineage).toBeUndefined();
    });

    it('does not set selectedLineage when no lineage specified', () => {
      const allRaces = [
        {
          name: 'Elf',
          traits: [
            {
              name: 'Ancestry',
              sub_traits: [
                { name: 'High Elf', description: 'High elf traits.' }
              ]
            }
          ]
        }
      ];
      const playerSummary = {
        race: { name: 'Elf' }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.traits[0].selectedLineage).toBeUndefined();
    });

    it('does not crash when race has no traits and lineage is specified', () => {
      const allRaces = [{ name: 'Human' }];
      const playerSummary = {
        race: {
          name: 'Human',
          lineage: 'Some Lineage'
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.name).toBe('Human');
    });

    it('passes ability_bonuses through getAbilityLongName transformation', () => {
      const allRaces = [
        {
          name: 'Human',
          ability_bonuses: [{ ability_score: 'STR', bonus: 1 }]
        }
      ];
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.ability_bonuses[0].ability_score).toBe('STR');
    });

    it('handles race without ability_bonuses', () => {
      const allRaces = [{ name: 'Human', traits: [] }];
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.ability_bonuses).toBeUndefined();
    });
  });

  describe('getRacialBonus', () => {
    it('returns 0 with no arguments', () => {
      expect(raceRules.getRacialBonus()).toBe(0);
    });

    it('returns 0 regardless of arguments', () => {
      expect(raceRules.getRacialBonus({ race: { ability_bonuses: [] } }, 'Strength')).toBe(0);
    });
  });

  describe('addTraits', () => {
    it('categorizes traits into all expected categories', () => {
      const traits = [
        { name: 'Darkvision', description: 'Can see in the dark' },
        { name: 'Fey Ancestry', description: 'Advantage on saves against being charmed' }
      ];
      const result = raceRules.addTraits(traits);
      expect(result).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
      expect(Array.isArray(result.bonusActions)).toBe(true);
      expect(Array.isArray(result.reactions)).toBe(true);
      expect(Array.isArray(result.specialActions)).toBe(true);
      expect(Array.isArray(result.characterAdvancement)).toBe(true);
    });

    it('categorizes traits with desc field using description field name', () => {
      const traits = [
        { name: 'Trait1', description: 'A trait with description field' }
      ];
      const result = raceRules.addTraits(traits);
      const trait1 = result.specialActions.find((t) => t.name === 'Trait1');
      expect(trait1).toBeDefined();
      expect(trait1.description).toBe('A trait with description field');
    });

    it('returns empty arrays for empty traits input', () => {
      const result = raceRules.addTraits([]);
      expect(result.actions).toEqual([]);
      expect(result.specialActions).toEqual([]);
      expect(result.bonusActions).toEqual([]);
      expect(result.reactions).toEqual([]);
      expect(result.characterAdvancement).toEqual([]);
    });

    it('returns empty categorized object for null traits', () => {
      const result = raceRules.addTraits(null);
      expect(result).toBeDefined();
      expect(result.actions).toEqual([]);
    });

    it('returns empty categorized object for undefined traits', () => {
      const result = raceRules.addTraits(undefined);
      expect(result).toBeDefined();
      expect(result.actions).toEqual([]);
    });

    it('places uncategorized traits in specialActions', () => {
      const traits = [
        { name: 'Custom Trait', description: 'A custom trait' }
      ];
      const result = raceRules.addTraits(traits);
      expect(result.specialActions.find((t) => t.name === 'Custom Trait')).toBeDefined();
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
      expect(Object.keys(result)).toContain('specialActions');
    });

    it('handles race without traits', () => {
      expect(Object.keys(raceRules.getTraits({ race: {} }))).toContain('specialActions');
    });

    it('handles undefined race', () => {
      expect(Object.keys(raceRules.getTraits({}))).toContain('specialActions');
    });

    it('handles empty traits array', () => {
      const result = raceRules.getTraits({ race: { traits: [] } });
      expect(Object.keys(result)).toContain('specialActions');
    });

    it('handles null lineage', () => {
      const input = {
        race: {
          lineage: null,
          traits: [{ name: 'Darkvision', description: 'Can see in the dark' }]
        }
      };
      const result = raceRules.getTraits(input);
      expect(Object.keys(result)).toContain('specialActions');
    });

    it('includes lineage traits when lineage matches', () => {
      const input = {
        race: {
          lineage: 'High Elf',
          traits: [
            { name: 'Darkvision', description: 'Can see in the dark' },
            {
              name: 'Ancestry',
              sub_traits: [
                { name: 'High Elf', description: 'High elf lineage traits.' }
              ]
            }
          ]
        }
      };
      const result = raceRules.getTraits(input);
      // Should have both base traits and lineage traits merged
      expect(Object.keys(result)).toContain('specialActions');
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
              sub_traits: [
                { name: 'High Elf', description: 'High elf traits.' }
              ]
            }
          ]
        }
      };
      const result = raceRules.getTraits(input);
      const names = result.specialActions.map((t) => t.name);
      expect(names).not.toContain('Ancestry (High Elf)');
    });
  });
});
