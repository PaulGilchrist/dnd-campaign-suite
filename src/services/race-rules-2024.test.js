import { describe, it, expect, vi } from 'vitest';
import { rules2024 as raceRules } from './race-rules/index.js';

// Mock dependencies
vi.mock('lodash', () => ({
  cloneDeep: vi.fn(obj => obj && Object.assign({}, obj)),
  uniqBy: vi.fn()
}));

vi.mock('./utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn(name => name)
      }
}));

vi.mock('./featureCategories2024.js', () => ({
  actions: [],
  bonusActions: [],
  reactions: [],
  passive: [],
  maintained: []
}));

vi.mock('./featureCategorizationUtils.js', () => ({
  categorizeFeatures: vi.fn((features) => ({
    actions: features.filter(f => f.type === 'action'),
    bonusActions: features.filter(f => f.type === 'bonusAction'),
    reactions: features.filter(f => f.type === 'reaction'),
    passive: features.filter(f => f.type === 'passive'),
    maintained: features.filter(f => f.type === 'maintained')
  })),
  mergeCategorizedFeatures: vi.fn((a, b) => ({
    actions: [...(a.actions || []), ...(b.actions || [])],
    bonusActions: [...(a.bonusActions || []), ...(b.bonusActions || [])],
    reactions: [...(a.reactions || []), ...(b.reactions || [])],
    passive: [...(a.passive || []), ...(b.passive || [])],
    maintained: [...(a.maintained || []), ...(b.maintained || [])]
  }))
}));

describe('raceRules 2024', () => {
  describe('getImmunities', () => {
    it('should return empty array when no race traits', () => {
      const playerSummary = { race: {} };

      const result = raceRules.getImmunities(playerSummary);

      expect(result).toEqual([]);
        });

    it('should extract immunities from trait descriptions', () => {
      const playerSummary = {
        race: {
          traits: [
             { description: 'You have immunity to poison.' },
             { description: 'You have resistance to charm.' }
              ]
          }
        };

      const result = raceRules.getImmunities(playerSummary);

      expect(result).toContain('poison');
        });

    it('should include playerSummary immunities', () => {
      const playerSummary = {
        race: { traits: [] },
        immunities: ['Disease']
        };

      const result = raceRules.getImmunities(playerSummary);

      expect(result).toContain('Disease');
        });

    it('should deduplicate immunities', () => {
      const playerSummary = {
        race: {
          traits: [
             { description: 'You have immunity to Disease.' }
              ]
          },
        immunities: ['Disease']
        };

      const result = raceRules.getImmunities(playerSummary);

          // Should have Disease only once
      const diseaseCount = result.filter(i => i === 'Disease').length;
      expect(diseaseCount).toBe(1);
        });
     });

  describe('getRace', () => {
    it('should return playerSummary.race when race not found in allRaces', () => {
      const allRaces = [];
      const playerSummary = { race: { name: 'Custom Race' } };

      const result = raceRules.getRace(allRaces, playerSummary);

      expect(result).toEqual({ name: 'Custom Race' });
        });

    it('should return race data when found', () => {
      const allRaces = [{ name: 'Human', traits: [] }];
      const playerSummary = { race: { name: 'Human' } };

      const result = raceRules.getRace(allRaces, playerSummary);

      expect(result.name).toBe('Human');
        });

    it('should handle lineage selection', () => {
      const allRaces = [{
        name: 'Elf',
        traits: [
           {
            name: 'Ancestry',
            sub_traits: [
               { name: 'High Elf', description: 'You have high elf traits.' }
               ]
            }
           ]
         }];
      const playerSummary = {
        race: {
          name: 'Elf',
          lineage: 'High Elf'
          }
        };

      const result = raceRules.getRace(allRaces, playerSummary);

      expect(result.traits[0].selectedLineage).toBeDefined();
        });
     });

  describe('getRacialBonus', () => {
    it('should always return 0 for 2024 rules', () => {
      const playerStats = {};
      const abilityName = 'Strength';

      const result = raceRules.getRacialBonus(playerStats, abilityName);

      expect(result).toBe(0);
        });
     });

  describe('getResistances', () => {
    it('should return empty array when no race traits', () => {
      const playerSummary = { race: {} };

      const result = raceRules.getResistances(playerSummary);

      expect(result).toEqual([]);
        });

    it('should extract resistances from trait descriptions', () => {
      const playerSummary = {
        race: {
          traits: [
             { description: 'You have Resistance to cold damage.' }
              ]
          }
        };

      const result = raceRules.getResistances(playerSummary);

      expect(result).toContain('cold');
        });

    it('should include playerSummary resistances', () => {
      const playerSummary = {
        race: { traits: [] },
        resistances: ['Fire']
        };

      const result = raceRules.getResistances(playerSummary);

      expect(result).toContain('Fire');
        });
     });

  describe('getSenses', () => {
    it('should return empty array when no senses or traits', () => {
      const playerStats = { race: { traits: [] } };

      const result = raceRules.getSenses(playerStats);

      expect(result).toEqual([]);
        });

    it('should extract darkvision from traits', () => {
      const playerStats = {
        senses: [],
        race: {
          traits: [
             { description: 'You have darkvision with a range of 60 feet.' }
              ]
          }
        };

      const result = raceRules.getSenses(playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Darkvision');
      expect(result[0].value).toBe('60 ft.');
        });

    it('should extract tremorsense from traits', () => {
      const playerStats = {
        senses: [],
        race: {
          traits: [
             { description: 'You have tremorsense with a range of 30 feet.' }
              ]
          }
        };

      const result = raceRules.getSenses(playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Tremorsense');
      expect(result[0].value).toBe('30 ft.');
        });

    it('should not duplicate senses', () => {
      const playerStats = {
        senses: [{ name: 'Darkvision', value: '60 ft.' }],
        race: {
          traits: [
             { description: 'You have darkvision with a range of 60 feet.' }
              ]
          }
        };

      const result = raceRules.getSenses(playerStats);

      expect(result).toHaveLength(1);
        });
     });

  describe('getTraits', () => {
    it('should return categorized traits', () => {
      const playerStats = {
        race: {
          traits: [
             { name: 'Trait 1', type: 'passive', description: 'A passive trait.' }
              ]
          }
        };

      const result = raceRules.getTraits(playerStats);

      expect(result).toBeDefined();
        });

    it('should handle lineage-specific traits', () => {
      const playerStats = {
        race: {
          lineage: 'High Elf',
          traits: [
             {
              name: 'Ancestry',
              sub_traits: [
                 { name: 'High Elf', description: 'High elf trait.' }
                 ]
              }
              ]
          }
        };

      const result = raceRules.getTraits(playerStats);

      expect(result).toBeDefined();
        });
     });
});
