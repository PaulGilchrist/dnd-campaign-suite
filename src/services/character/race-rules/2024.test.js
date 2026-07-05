// @cleaned-by-ai
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

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

describe('raceRules 2024 (direct module)', () => {
  describe('getImmunities', () => {
    it('returns empty array when playerSummary has no race', () => {
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
          traits: [{ description: 'You have immunity to poison damage.' }]
        }
      };
      const result = raceRules.getImmunities(input);
      expect(result).toContain('poison');
    });

    it('extracts immunity type ending with a period', () => {
      const input = {
        race: {
          traits: [{ description: 'You have immunity to charm.' }]
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
          traits: [{ description: 'You have immunity to poison.' }]
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
          traits: [{ description: 'You have immunity to poison.' }]
        },
        immunities: ['poison']
      };
      const result = raceRules.getImmunities(input);
      expect(result.filter((i) => i === 'poison').length).toBe(1);
    });

    it('returns immunities sorted alphabetically', () => {
      const input = {
        race: { traits: [] },
        immunities: ['Zebra', 'Alpha', 'Middle']
      };
      const result = raceRules.getImmunities(input);
      expect(result).toEqual(['Alpha', 'Middle', 'Zebra']);
    });

    it('returns object immunities sorted by name alphabetically', () => {
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
          traits: [{ name: 'Trance', description: "Magic can't put you to sleep." }]
        }
      };
      expect(raceRules.getImmunities(input)).toContain('Magical Sleep');
    });

    it('combines Trance Magical Sleep with other immunities', () => {
      const input = {
        race: {
          traits: [
            { name: 'Trance', description: "Magic can't put you to sleep." },
            { description: 'You have immunity to poison.' }
          ]
        }
      };
      const result = raceRules.getImmunities(input);
      expect(result).toContain('Magical Sleep');
      expect(result).toContain('poison');
    });

    it('handles trait with no description field', () => {
      const input = { race: { traits: [{ name: 'Some Trait' }] } };
      expect(raceRules.getImmunities(input)).toEqual([]);
    });
  });

  describe('getResistances', () => {
    it('returns empty array when playerSummary has no race', () => {
      expect(raceRules.getResistances({})).toEqual([]);
    });

    it('returns empty array when race has no traits or subrace', () => {
      expect(raceRules.getResistances({ race: { name: 'Human' } })).toEqual([]);
    });

    it('extracts resistance from subrace damage_resistance', () => {
      const input = { race: { subrace: { damage_resistance: 'Fire' } } };
      expect(raceRules.getResistances(input)).toContain('Fire');
    });

    it('extracts resistance from trait description', () => {
      const input = {
        race: { traits: [{ description: 'You have resistance to cold damage.' }] }
      };
      expect(raceRules.getResistances(input)).toContain('cold');
    });

    it('combines subrace and trait resistances', () => {
      const input = {
        race: {
          subrace: { damage_resistance: 'Fire' },
          traits: [{ description: 'You have resistance to poison.' }]
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
          traits: [{ description: 'You have resistance to cold.' }]
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
        race: { traits: [{ description: 'You have resistance to fire.' }] },
        resistances: ['fire']
      };
      const result = raceRules.getResistances(input);
      expect(result.filter((r) => r === 'fire').length).toBe(1);
    });

    it('returns resistances sorted alphabetically', () => {
      const input = {
        race: { traits: [] },
        resistances: [{ name: 'Zebra' }, { name: 'Alpha' }, { name: 'Middle' }]
      };
      const result = raceRules.getResistances(input);
      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Middle');
      expect(result[2].name).toBe('Zebra');
    });

    it('skips "the" keyword from resistance extraction', () => {
      const input = {
        race: { traits: [{ description: 'You have resistance to the magic damage.' }] }
      };
      const result = raceRules.getResistances(input);
      expect(result).not.toContain('the');
    });

    it('handles trait with no description field', () => {
      const input = { race: { traits: [{ name: 'Some Trait' }] } };
      expect(raceRules.getResistances(input)).toEqual([]);
    });

    it('returns Fiendish Legacy resistance for Abyssal Tiefling subrace', () => {
      const input = {
        name: 'TestChar',
        race: {
          name: 'Tiefling',
          subrace: { name: 'Abyssal Tiefling' },
          traits: [{ name: 'Fiendish Legacies', description: 'Abyssal: Resistance to Poison damage.' }]
        }
      };
      expect(raceRules.getResistances(input)).toContain('Poison');
    });

    it('returns Fiendish Legacy resistance for Chthonic Tiefling subrace', () => {
      const input = {
        name: 'TestChar',
        race: {
          name: 'Tiefling',
          subrace: { name: 'Chthonic Tiefling' },
          traits: [{ name: 'Fiendish Legacies', description: 'Chthonic: Resistance to Necrotic damage.' }]
        }
      };
      expect(raceRules.getResistances(input)).toContain('Necrotic');
    });

    it('returns Fiendish Legacy resistance for Infernal Tiefling subrace', () => {
      const input = {
        name: 'TestChar',
        race: {
          name: 'Tiefling',
          subrace: { name: 'Infernal Tiefling' },
          traits: [{ name: 'Fiendish Legacies', description: 'Infernal: Resistance to Fire damage.' }]
        }
      };
      expect(raceRules.getResistances(input)).toContain('Fire');
    });

    it('falls back to regex extraction when no Tiefling subrace', () => {
      const input = {
        race: {
          traits: [{ name: 'Fiendish Legacies', description: 'Abyssal: Resistance to Poison damage.' }]
        }
      };
      expect(raceRules.getResistances(input)).toContain('Poison');
    });

    it('skips Fiendish Legacies trait from regex when Tiefling subrace is selected', () => {
      const input = {
        name: 'TestChar',
        race: {
          name: 'Tiefling',
          subrace: { name: 'Abyssal Tiefling' },
          traits: [{ name: 'Fiendish Legacies', description: 'Abyssal: Resistance to Poison damage.' }]
        }
      };
      const result = raceRules.getResistances(input);
      expect(result).toContain('Poison');
    });

    it('handles missing campaignName gracefully', () => {

      const input = {
        race: { traits: [{ description: 'You have resistance to fire.' }] }
      };
      expect(raceRules.getResistances(input)).toContain('fire');
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
        race: { traits: [{ description: 'You have darkvision with a range of 60 feet.' }] }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });

    it('extracts darkvision with 120 ft range', () => {
      const input = {
        senses: [],
        race: { traits: [{ description: 'You have darkvision with a range of 120 feet.' }] }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Darkvision', value: '120 ft.' });
    });

    it('preserves existing darkvision value when already present', () => {
      const input = {
        senses: [{ name: 'Darkvision', value: '120 ft.' }],
        race: { traits: [{ description: 'You have darkvision with a range of 60 feet.' }] }
      };
      const result = raceRules.getSenses(input);
      const dv = result.find((s) => s.name === 'Darkvision');
      expect(dv.value).toBe('120 ft.');
    });

    it('extracts tremorsense with 30 ft range', () => {
      const input = {
        senses: [],
        race: { traits: [{ description: 'You have tremorsense with a range of 30 feet.' }] }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Tremorsense', value: '30 ft.' });
    });

    it('extracts tremorsense with 60 ft range', () => {
      const input = {
        senses: [],
        race: { traits: [{ description: 'You have tremorsense with a range of 60 feet.' }] }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Tremorsense', value: '60 ft.' });
    });

    it('preserves existing tremorsense value when already present', () => {
      const input = {
        senses: [{ name: 'Tremorsense', value: '60 ft.' }],
        race: { traits: [{ description: 'You have tremorsense with a range of 30 feet.' }] }
      };
      const result = raceRules.getSenses(input);
      const ts = result.find((s) => s.name === 'Tremorsense');
      expect(ts.value).toBe('60 ft.');
    });

    it('adds passive perception when abilities available', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: [{ name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] }]
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Passive Perception', value: '15' });
    });

    it('uses ability bonus when no skill bonus for passive perception', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: [{ name: 'Wisdom', bonus: 3, skills: [] }]
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Passive Perception', value: '13' });
    });

    it('adds passive investigation when abilities available', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: [{ name: 'Intelligence', bonus: 1, skills: [{ name: 'Investigation', bonus: 3 }] }]
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Passive Investigation', value: '13' });
    });

    it('adds passive insight when abilities available', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: [{ name: 'Wisdom', bonus: 2, skills: [{ name: 'Insight', bonus: 2 }] }]
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Passive Insight', value: '12' });
    });

    it('does not add passive skills when abilities array is missing', () => {
      const input = { senses: [], race: { traits: [] } };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Passive Perception', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Investigation', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Insight', value: '10' });
    });

    it('does not add passive skills when abilities array is empty', () => {
      const input = { senses: [], race: { traits: [] }, abilities: [] };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Passive Perception', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Investigation', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Insight', value: '10' });
    });

    it('does not add passive skills when the relevant ability is missing', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: [{ name: 'Strength', bonus: 2, skills: [] }]
      };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Passive Perception', value: '12' });
    });

    it('uses ability bonus when skill is missing for passive perception', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: [{ name: 'Wisdom', bonus: 2, skills: [{ name: 'Animal Handling', bonus: 0 }] }]
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Passive Perception', value: '12' });
    });

    it('returns senses sorted alphabetically', () => {
      const input = {
        senses: [{ name: 'Zebra Vision', value: '10 ft.' }, { name: 'Alpha Vision', value: '5 ft.' }],
        race: { traits: [] }
      };
      const result = raceRules.getSenses(input);
      expect(result[0].name).toBe('Alpha Vision');
      expect(result[1].name).toBe('Zebra Vision');
    });

    it('handles trait with no description', () => {
      const input = { senses: [], race: { traits: [{ name: 'Some Trait' }] } };
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
        class: { class_levels: [{ level: 18, features: [{ name: 'Feral Senses', level: 18 }] }] }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Blindsight', value: '30 ft.' });
    });

    it('preserves existing Blindsight value when already present', () => {
      const input = {
        senses: [{ name: 'Blindsight', value: '60 ft.' }],
        race: { traits: [] },
        class: { class_levels: [{ level: 18, features: [{ name: 'Feral Senses', level: 18 }] }] }
      };
      const result = raceRules.getSenses(input);
      const blindsight = result.find((s) => s.name === 'Blindsight');
      expect(blindsight.value).toBe('60 ft.');
    });

    it('does not add Blindsight when class is missing', () => {
      const input = { senses: [], race: { traits: [] } };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Blindsight', value: '30 ft.' });
    });

    it('does not add Blindsight when class_levels is empty', () => {
      const input = { senses: [], race: { traits: [] }, class: { class_levels: [] } };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Blindsight', value: '30 ft.' });
    });

    it('does not add Blindsight when features array is missing', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        class: { class_levels: [{ level: 18 }] }
      };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Blindsight', value: '30 ft.' });
    });

    it('does not add tremorsense for Stonecunning trait', () => {
      const input = {
        senses: [],
        race: { traits: [{ name: 'Stonecunning', description: 'You have tremorsense with a range of 60 feet.' }] }
      };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Tremorsense', value: '60 ft.' });
    });

    it('adds tremorsense for non-Stonecunning traits with tremorsense', () => {
      const input = {
        senses: [],
        race: { traits: [{ name: 'Some Other Trait', description: 'You have tremorsense with a range of 30 feet.' }] }
      };
      expect(raceRules.getSenses(input)).toContainEqual({ name: 'Tremorsense', value: '30 ft.' });
    });

    it('overrides Darkvision to 120 ft. for Drow lineage', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const input = {
        senses: [],
        race: {
          traits: [{ description: 'You have darkvision with a range of 60 feet.' }],
          lineage: 'Drow'
        }
      };
      const result = raceRules.getSenses(input);
      const dv = result.find((s) => s.name === 'Darkvision');
      expect(dv.value).toBe('120 ft.');
    });

    it('overrides Darkvision to 120 ft. for Deep Gnome lineage', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const input = {
        senses: [],
        race: {
          traits: [{ description: 'You have darkvision with a range of 60 feet.' }],
          lineage: 'Deep Gnome'
        }
      };
      const result = raceRules.getSenses(input);
      const dv = result.find((s) => s.name === 'Darkvision');
      expect(dv.value).toBe('120 ft.');
    });

    it('does not override Darkvision for non-Drow/Deep Gnome lineage', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const input = {
        senses: [],
        race: {
          traits: [{ description: 'You have darkvision with a range of 60 feet.' }],
          lineage: 'High Elf'
        }
      };
      const result = raceRules.getSenses(input);
      const dv = result.find((s) => s.name === 'Darkvision');
      expect(dv.value).toBe('60 ft.');
    });

    it('adds Darkvision 120 ft. when Drow lineage exists without existing darkvision', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const input = {
        senses: [],
        race: { traits: [], lineage: 'Drow' }
      };
      const result = raceRules.getSenses(input);
      // Drow lineage adds Darkvision 120 ft. even when no darkvision trait exists
      expect(result).toContainEqual({ name: 'Darkvision', value: '120 ft.' });
    });

    it('adds Blindvision 10 ft. when Blind Fighting fighting style is selected', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        class: {
          fightingStyles: ['Blind Fighting']
        }
      };
      const result = raceRules.getSenses(input);
      expect(result).toContainEqual({ name: 'Blindvision', value: '10 ft.' });
    });

    it('does not add Blindvision when Blind Fighting is not selected', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        class: {
          fightingStyles: ['Dueling']
        }
      };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Blindvision', value: '10 ft.' });
    });

    it('does not add Blindvision when fightingStyles is empty', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        class: {
          fightingStyles: []
        }
      };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Blindvision', value: '10 ft.' });
    });

    it('does not duplicate Blindvision when already in senses', () => {
      const input = {
        senses: [{ name: 'Blindvision', value: '30 ft.' }],
        race: { traits: [] },
        class: {
          fightingStyles: ['Blind Fighting']
        }
      };
      const result = raceRules.getSenses(input);
      expect(result.filter((s) => s.name === 'Blindvision').length).toBe(1);
      expect(result.find((s) => s.name === 'Blindvision').value).toBe('30 ft.');
    });

    it('handles missing fightingStyles gracefully', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        class: {}
      };
      const result = raceRules.getSenses(input);
      expect(result).not.toContainEqual({ name: 'Blindvision', value: '10 ft.' });
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
      const playerSummary = { race: { name: 'Human', customProperty: 'custom value' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.name).toBe('Human');
      expect(result.customProperty).toBe('custom value');
    });

    it('resolves subrace from JSON data', () => {
      const allRaces = [
        {
          name: 'Elf',
          subraces: [{ name: 'High Elf', damage_resistance: 'Fire', traits: [] }]
        }
      ];
      const playerSummary = { race: { name: 'Elf', subrace: { name: 'High Elf' } } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subrace.name).toBe('High Elf');
      expect(result.subrace.damage_resistance).toBe('Fire');
    });

    it('merges playerSummary subrace data over JSON data', () => {
      const allRaces = [
        {
          name: 'Elf',
          subraces: [{ name: 'High Elf', damage_resistance: 'Fire' }]
        }
      ];
      const playerSummary = {
        race: { name: 'Elf', subrace: { name: 'High Elf', customProp: 'value' } }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subrace.name).toBe('High Elf');
      expect(result.subrace.damage_resistance).toBe('Fire');
      expect(result.subrace.customProp).toBe('value');
    });

    it('handles subrace not found in subraces list', () => {
      const allRaces = [{ name: 'Elf', subraces: [] }];
      const playerSummary = { race: { name: 'Elf', subrace: { name: 'High Elf' } } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subrace).toEqual({ name: 'High Elf' });
    });

    it('resolves lineage from sub_traits', () => {
      const allRaces = [
        {
          name: 'Elf',
          traits: [{ name: 'Ancestry', sub_traits: [{ name: 'High Elf', description: 'High elf traits.' }] }]
        }
      ];
      const playerSummary = { race: { name: 'Elf', lineage: 'High Elf' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.traits[0].selectedLineage).toBeDefined();
      expect(result.traits[0].selectedLineage.name).toBe('High Elf');
    });

    it('leaves selectedLineage undefined when lineage not found in sub_traits', () => {
      const allRaces = [
        {
          name: 'Elf',
          traits: [{ name: 'Ancestry', sub_traits: [{ name: 'High Elf', description: 'High elf traits.' }] }]
        }
      ];
      const playerSummary = { race: { name: 'Elf', lineage: 'Wood Elf' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.traits[0].selectedLineage).toBeUndefined();
    });

    it('does not set selectedLineage when no lineage specified', () => {
      const allRaces = [
        {
          name: 'Elf',
          traits: [{ name: 'Ancestry', sub_traits: [{ name: 'High Elf', description: 'High elf traits.' }] }]
        }
      ];
      const playerSummary = { race: { name: 'Elf' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.traits[0].selectedLineage).toBeUndefined();
    });

    it('does not crash when race has no traits and lineage is specified', () => {
      const allRaces = [{ name: 'Human' }];
      const playerSummary = { race: { name: 'Human', lineage: 'Some Lineage' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.name).toBe('Human');
    });

    it('passes ability_bonuses through getAbilityLongName transformation', () => {
      const allRaces = [{ name: 'Human', ability_bonuses: [{ ability_score: 'STR', bonus: 1 }] }];
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
      expect(result.actions).toEqual([]);
      expect(result.specialActions).toEqual([]);
      expect(result.bonusActions).toEqual([]);
      expect(result.reactions).toEqual([]);
      expect(result.characterAdvancement).toEqual([]);
    });

    it('returns empty categorized object for undefined traits', () => {
      const result = raceRules.addTraits(undefined);
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

    it('handles race without traits', () => {
      const result = raceRules.getTraits({ race: {} });
      expect(Object.keys(result)).toEqual([
        'actions',
        'bonusActions',
        'reactions',
        'specialActions',
        'characterAdvancement'
      ]);
    });

    it('handles undefined race', () => {
      const result = raceRules.getTraits({});
      expect(Object.keys(result)).toEqual([
        'actions',
        'bonusActions',
        'reactions',
        'specialActions',
        'characterAdvancement'
      ]);
    });

    it('handles empty traits array', () => {
      const result = raceRules.getTraits({ race: { traits: [] } });
      expect(Object.keys(result)).toEqual([
        'actions',
        'bonusActions',
        'reactions',
        'specialActions',
        'characterAdvancement'
      ]);
    });

    it('handles null lineage', () => {
      const input = {
        race: {
          lineage: null,
          traits: [{ name: 'Darkvision', description: 'Can see in the dark' }]
        }
      };
      const result = raceRules.getTraits(input);
      const names = result.specialActions.map((t) => t.name);
      expect(names).toContain('Darkvision');
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
  });
});
