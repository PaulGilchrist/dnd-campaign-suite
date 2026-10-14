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

describe('raceRules 2024 - getSenses', () => {
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

    it('uses ability bonus when skill bonus or skill is missing for passive perception', () => {
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

    it('does not add passive skills when abilities is missing or empty', () => {
      const result = raceRules.getSenses({ senses: [], race: { traits: [] } });
      expect(result).not.toContainEqual({ name: 'Passive Perception', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Investigation', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Insight', value: '10' });

      const result2 = raceRules.getSenses({ senses: [], race: { traits: [] }, abilities: [] });
      expect(result2).not.toContainEqual({ name: 'Passive Perception', value: '10' });
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

    it('returns senses sorted alphabetically', () => {
      const input = {
        senses: [{ name: 'Zebra Vision', value: '10 ft.' }, { name: 'Alpha Vision', value: '5 ft.' }],
        race: { traits: [] }
      };
      const result = raceRules.getSenses(input);
      expect(result[0].name).toBe('Alpha Vision');
      expect(result[1].name).toBe('Zebra Vision');
    });

    it('handles undefined race or race without traits', () => {
      expect(raceRules.getSenses({ senses: [] })).toEqual([]);
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

    it('does not add Blindvision when Blind Fighting is not selected or fightingStyles is missing', () => {
      const result1 = raceRules.getSenses({
        senses: [],
        race: { traits: [] },
        class: { fightingStyles: ['Dueling'] }
      });
      expect(result1).not.toContainEqual({ name: 'Blindvision', value: '10 ft.' });

      const result2 = raceRules.getSenses({
        senses: [],
        race: { traits: [] },
        class: { fightingStyles: [] }
      });
      expect(result2).not.toContainEqual({ name: 'Blindvision', value: '10 ft.' });

      const result3 = raceRules.getSenses({
        senses: [],
        race: { traits: [] },
        class: {}
      });
      expect(result3).not.toContainEqual({ name: 'Blindvision', value: '10 ft.' });
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

    it('overrides Darkvision to 120 ft. for Drow lineage', () => {
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

    it('overrides Darkvision to 120 ft. for Drow subrace name', () => {
      const input = {
        senses: [],
        race: {
          traits: [{ description: 'You have darkvision with a range of 60 feet.' }],
          subrace: { name: 'Drow' }
        }
      };
      const result = raceRules.getSenses(input);
      const dv = result.find((s) => s.name === 'Darkvision');
      expect(dv.value).toBe('120 ft.');
    });

    it('overrides Darkvision to 120 ft. for Deep Gnome lineage', () => {
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
      const input = {
        senses: [],
        race: {
          traits: [{ description: 'You have darkvision with a range of 60 feet.' }],
          lineage: 'Wood Elf'
        }
      };
      const result = raceRules.getSenses(input);
      const dv = result.find((s) => s.name === 'Darkvision');
      expect(dv.value).toBe('60 ft.');
    });

    it('adds Darkvision 120 ft. for Drow when no darkvision trait exists', () => {
      const input = {
        senses: [],
        race: {
          traits: [],
          lineage: 'Drow'
        }
      };
      const result = raceRules.getSenses(input);
      const dv = result.find((s) => s.name === 'Darkvision');
      expect(dv).toBeDefined();
      expect(dv.value).toBe('120 ft.');
    });

    it('combines Drow lineage with existing darkvision override', () => {
      const input = {
        senses: [{ name: 'Darkvision', value: '60 ft.' }],
        race: {
          traits: [],
          lineage: 'Drow'
        }
      };
      const result = raceRules.getSenses(input);
      const dv = result.find((s) => s.name === 'Darkvision');
      expect(dv.value).toBe('120 ft.');
    });

    it('does not add Blindsight when already in senses', () => {
      const input = {
        senses: [{ name: 'Blindsight', value: '60 ft.' }],
        race: { traits: [] },
        class: { class_levels: [{ features: [{ name: 'Feral Senses' }] }] }
      };
      const result = raceRules.getSenses(input);
      expect(result.filter((s) => s.name === 'Blindsight').length).toBe(1);
      expect(result.find((s) => s.name === 'Blindsight').value).toBe('60 ft.');
    });

    it('handles abilities with missing skills array', () => {
      const input = {
        senses: [],
        race: { traits: [] },
        abilities: [{ name: 'Wisdom', bonus: 5 }]
      };
      const result = raceRules.getSenses(input);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '15' });
    });

    it('handles multiple traits with darkvision (only one added)', () => {
      const input = {
        senses: [],
        race: {
          traits: [
            { description: 'You have darkvision with a range of 60 feet.' },
            { description: 'You have darkvision with a range of 120 feet.' }
          ]
        }
      };
      const result = raceRules.getSenses(input);
      expect(result.filter((s) => s.name === 'Darkvision').length).toBe(1);
    });

    it('handles multiple traits with tremorsense (only one added)', () => {
      const input = {
        senses: [],
        race: {
          traits: [
            { description: 'You have tremorsense with a range of 30 feet.' },
            { description: 'You have tremorsense with a range of 60 feet.' }
          ]
        }
      };
      const result = raceRules.getSenses(input);
      expect(result.filter((s) => s.name === 'Tremorsense').length).toBe(1);
    });

    it('returns all senses sorted together', () => {
      const input = {
        senses: [{ name: 'Zebra Vision', value: '10 ft.' }],
        race: { traits: [{ description: 'You have darkvision with a range of 60 feet.' }] },
        abilities: [{ name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] }]
      };
      const result = raceRules.getSenses(input);
      const names = result.map((s) => s.name);
      expect(names).toEqual([...new Set(names)].sort());
    });
  });
});
