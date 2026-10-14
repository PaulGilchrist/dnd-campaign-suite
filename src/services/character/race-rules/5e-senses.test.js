import { describe, it, expect } from 'vitest';
import raceRules from './5e.js';

describe('raceRules 5e - getSenses', () => {
  describe('getSenses', () => {
    it('returns sorted array when playerStats has no senses or race traits', () => {
      const playerStats = { race: { traits: [] } };
      const result = raceRules.getSenses(playerStats);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('does not add Darkvision when race does not have the trait', () => {
      const playerStats = {
        senses: [],
        race: {
          traits: [{ name: 'Other Trait' }]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).not.toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });

    it('adds Darkvision when race has Darkvision trait and it is not already present', () => {
      const playerStats = {
        senses: [],
        race: {
          traits: [{ name: 'Darkvision' }]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });

    it('does not duplicate Darkvision when already in senses', () => {
      const playerStats = {
        senses: [{ name: 'Darkvision', value: '120 ft.' }],
        race: {
          traits: [{ name: 'Darkvision' }]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result.filter((s) => s.name === 'Darkvision').length).toBe(1);
      expect(result.find((s) => s.name === 'Darkvision').value).toBe('120 ft.');
    });

    it('adds Passive Perception when Wisdom ability with Perception skill exists', () => {
      const playerStats = {
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
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '15' });
    });

    it('falls back to ability bonus when Perception skill is missing', () => {
      const playerStats = {
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
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '13' });
    });

    it('adds Passive Investigation when Intelligence ability with Investigation skill exists', () => {
      const playerStats = {
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
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Passive Investigation', value: '13' });
    });

    it('adds Passive Insight when Wisdom ability with Insight skill exists', () => {
      const playerStats = {
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
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Passive Insight', value: '12' });
    });

    it('does not add passive skills when abilities is missing, null, or empty', () => {
      expect(
        raceRules.getSenses({ senses: [], race: { traits: [] } })
      ).not.toContainEqual({ name: 'Passive Perception', value: '10' });

      expect(
        raceRules.getSenses({ senses: [], race: { traits: [] }, abilities: null })
      ).not.toContainEqual({ name: 'Passive Perception', value: '10' });

      expect(
        raceRules.getSenses({ senses: [], race: { traits: [] }, abilities: [] })
      ).not.toContainEqual({ name: 'Passive Perception', value: '10' });
    });

    it('does not add passive skills when the relevant ability is missing', () => {
      const playerStats = {
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
      const result = raceRules.getSenses(playerStats);
      expect(result).not.toContainEqual({ name: 'Passive Perception', value: '12' });
    });

    it('falls back to ability bonus when skill is missing for Passive Perception', () => {
      const playerStats = {
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
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '12' });
    });

    it('returns senses sorted alphabetically by name', () => {
      const playerStats = {
        senses: [
          { name: 'Zebra Vision', value: '10 ft.' },
          { name: 'Alpha Vision', value: '5 ft.' }
        ],
        race: { traits: [] }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result[0].name).toBe('Alpha Vision');
      expect(result[1].name).toBe('Zebra Vision');
    });

    it('adds Feral Senses when a class feature has Feral Senses', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        class: {
          class_levels: [
            { features: [{ name: 'Other Feature' }] },
            { features: [{ name: 'Feral Senses' }] }
          ]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Feral Senses', value: '' });
    });

    it('does not add Feral Senses when no class feature has it', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        class: {
          class_levels: [
            { features: [{ name: 'Other Feature' }] }
          ]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).not.toContainEqual({ name: 'Feral Senses', value: '' });
    });

    it('does not duplicate Feral Senses when already in senses', () => {
      const playerStats = {
        senses: [{ name: 'Feral Senses', value: '120 ft.' }],
        race: { traits: [] },
        class: {
          class_levels: [
            { features: [{ name: 'Feral Senses' }] }
          ]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result.filter((s) => s.name === 'Feral Senses').length).toBe(1);
      expect(result.find((s) => s.name === 'Feral Senses').value).toBe('120 ft.');
    });

    it('handles missing or undefined class gracefully', () => {
      expect(
        raceRules.getSenses({ senses: [], race: { traits: [] }, class: {} })
      ).not.toContainEqual({ name: 'Feral Senses', value: '' });

      expect(
        raceRules.getSenses({ senses: [], race: { traits: [] } })
      ).not.toContainEqual({ name: 'Feral Senses', value: '' });
    });

    it('adds Blindvision 10 ft. when Blind Fighting fighting style is selected', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        class: {
          fightingStyles: ['Blind Fighting']
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Blindvision', value: '10 ft.' });
    });

    it('does not add Blindvision when Blind Fighting is not selected or fightingStyles is missing', () => {
      expect(
        raceRules.getSenses({
          senses: [],
          race: { traits: [] },
          class: { fightingStyles: ['Dueling'] }
        })
      ).not.toContainEqual({ name: 'Blindvision', value: '10 ft.' });

      expect(
        raceRules.getSenses({
          senses: [],
          race: { traits: [] },
          class: { fightingStyles: [] }
        })
      ).not.toContainEqual({ name: 'Blindvision', value: '10 ft.' });

      expect(
        raceRules.getSenses({
          senses: [],
          race: { traits: [] },
          class: {}
        })
      ).not.toContainEqual({ name: 'Blindvision', value: '10 ft.' });
    });

    it('does not duplicate Blindvision when already in senses', () => {
      const playerStats = {
        senses: [{ name: 'Blindvision', value: '30 ft.' }],
        race: { traits: [] },
        class: {
          fightingStyles: ['Blind Fighting']
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result.filter((s) => s.name === 'Blindvision').length).toBe(1);
      expect(result.find((s) => s.name === 'Blindvision').value).toBe('30 ft.');
    });

    it('handles abilities with missing skills array or undefined bonus', () => {
      expect(
        raceRules.getSenses({
          senses: [],
          race: { traits: [] },
          abilities: [{ name: 'Wisdom', bonus: 2 }]
        })
      ).toContainEqual({ name: 'Passive Perception', value: '12' });

      expect(
        raceRules.getSenses({
          senses: [],
          race: { traits: [] },
          abilities: [{ name: 'Wisdom', skills: [{ name: 'Perception', bonus: 3 }] }]
        })
      ).toContainEqual({ name: 'Passive Perception', value: '13' });
    });

    it('combines Darkvision, passive skills, and Feral Senses together', () => {
      const playerStats = {
        senses: [],
        race: {
          traits: [{ name: 'Darkvision' }]
        },
        abilities: [
          {
            name: 'Wisdom',
            bonus: 2,
            skills: [{ name: 'Perception', bonus: 5 }]
          }
        ],
        class: {
          class_levels: [
            { features: [{ name: 'Feral Senses' }] }
          ]
        }
      };
      const result = raceRules.getSenses(playerStats);
      const names = result.map((s) => s.name);
      expect(names).toContain('Darkvision');
      expect(names).toContain('Feral Senses');
      expect(names).toContain('Passive Perception');
    });

    it('combines existing senses with derived senses', () => {
      const playerStats = {
        senses: [{ name: 'Normal Vision', value: '60 ft.' }],
        race: {
          traits: [{ name: 'Darkvision' }]
        },
        abilities: [
          {
            name: 'Wisdom',
            bonus: 0,
            skills: []
          }
        ]
      };
      const result = raceRules.getSenses(playerStats);
      const names = result.map((s) => s.name);
      expect(names).toContain('Darkvision');
      expect(names).toContain('Normal Vision');
      expect(names).toContain('Passive Perception');
    });
  });
});
