import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from './data-loader.js';

// Mock the data-loader module
vi.mock('./data-loader.js', () => ({
    fetchClassData: vi.fn(),
    fetchRaceData: vi.fn(),
    fetchBackgroundData: vi.fn(),
}));

// Import after mocking
import { 
    getResistanceLimits, 
    getPreSelectedResistances,
    validateResistances,
    getResistanceInfo
} from './resistances-validation.js';

describe('resistances-validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
      });

    describe('extract5eRaceResistances (via getResistanceLimits)', () => {
        it('should extract fire resistance from Tiefling Hellish Resistance', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Tiefling',
                traits: [
                    { name: 'Hellish Resistance', desc: ['You have resistance to fire damage.'] }
                 ]
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Tiefling' },
                class: { name: 'Wizard' },
                level: 1
              });

            expect(result.resistances).toContain('Fire');
          });

        it('should extract poison resistance from Dwarf Dwarven Resilience', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Dwarf',
                traits: [
                     { name: 'Dwarven Resilience', desc: ['You have resistance against poison damage.'] }
                 ]
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Dwarf' },
                class: { name: 'Wizard' },
                level: 1
              });

            expect(result.resistances).toContain('Poison');
          });

        it('should return empty array when race has no resistances', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Human',
                traits: []
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                level: 1
              });

            expect(result.resistances).toEqual([]);
          });

        it('should handle null race data', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                level: 1
              });

            expect(result.resistances).toEqual([]);
          });
      });

    describe('extract2024RaceResistances (via getResistanceLimits)', () => {
        it('should extract necrotic and radiant resistance from Aasimar Celestial Resistance', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Aasimar',
                traits: [
                     { name: 'Celestial Resistance', description: 'Resistance to Necrotic and Radiant damage.' }
                 ]
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const result = await getResistanceLimits({
                rules: '2024',
                race: { name: 'Aasimar' },
                class: { name: 'Wizard' },
                level: 1
              });

            expect(result.resistances).toContain('Necrotic');
            expect(result.resistances).toContain('Radiant');
          });

        it('should extract poison resistance from 2024 Dwarf Dwarven Resilience', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Dwarf',
                traits: [
                     { name: 'Dwarven Resilience', description: 'Resistance to Poison damage.' }
                 ]
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const result = await getResistanceLimits({
                rules: '2024',
                race: { name: 'Dwarf' },
                class: { name: 'Wizard' },
                level: 1
              });

            expect(result.resistances).toContain('Poison');
          });

        it('should extract resistance from subrace traits in 2024', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Dragonborn',
                traits: [
                     { name: 'Damage Resistance', description: 'You have resistance to one damage type.' }
                 ],
                subraces: [
                     { name: 'Draconborn of Tiamat', description: 'Resistance to Acid damage.' }
                 ]
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const result = await getResistanceLimits({
                rules: '2024',
                race: { name: 'Dragonborn', subrace: { name: 'Draconborn of Tiamat' } },
                class: { name: 'Wizard' },
                level: 1
              });

            expect(result.resistances).toContain('Acid');
          });
      });

    describe('extractClassImmunities (via getResistanceLimits)', () => {
        it('should extract immunities from class features', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                 class_levels: [
                       { level: 1, features: [] },
                       { level: 10, features: [
                           { name: 'Damage Immunity', description: 'You gain Immunity to Fire damage.' }
                       ]}
                   ]
                });

             const result = await getResistanceLimits({
                 rules: '5e',
                 race: { name: 'Human' },
                 class: { name: 'Fighter' },
                 level: 10
                });

             expect(result.immunities).toContain('Fire');
            });

         it('should not count immunities above character level', async () => {
             vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
             vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                 class_levels: [
                       { level: 1, features: [] },
                       { level: 10, features: [
                           { name: 'Damage Immunity', description: 'You gain Immunity to Fire damage.' }
                       ]}
                 ]
              });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter' },
                level: 5
              });

            expect(result.immunities).toEqual([]);
          });

        it('should handle invalid immunity types', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                      { level: 10, features: [
                          { name: 'Damage Immunity', description: 'You gain Immunity to Psychic damage.' }
                      ]}
                  ]
                 });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter' },
                level: 10
              });

            expect(result.immunities).toContain('Psychic');
          });
      });

    describe('getPreSelectedResistances', () => {
        it('should return pre-selected resistances and immunities', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Tiefling',
                traits: [
                     { name: 'Hellish Resistance', desc: ['You have resistance to fire damage.'] }
                 ]
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const result = await getPreSelectedResistances({
                rules: '5e',
                race: { name: 'Tiefling' },
                class: { name: 'Wizard' },
                level: 1
              });

            expect(result.resistances).toContain('Fire');
          });
      });

    describe('validateResistances', () => {
        it('should warn about ungranted resistances', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const warnings = await validateResistances({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                level: 1,
                resistances: ['Fire'],
                immunities: []
              });

            expect(warnings.some(w => w.message.includes('not granted'))).toBe(true);
          });

        it('should warn about ungranted immunities', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const warnings = await validateResistances({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                level: 1,
                resistances: [],
                immunities: ['Fire']
              });

            expect(warnings.some(w => w.message.includes('immunities are not granted'))).toBe(true);
          });

        it('should warn about duplicate resistances', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: [
                     { name: 'Hellish Resistance', desc: ['You have resistance to fire damage.'] }
                 ]
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const warnings = await validateResistances({
                rules: '5e',
                race: { name: 'Tiefling' },
                class: { name: 'Wizard' },
                level: 1,
                resistances: ['Fire', 'Fire'],
                immunities: []
              });

            expect(warnings.some(w => w.message.includes('multiple times'))).toBe(true);
          });

        it('should warn about duplicate immunities', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                     { level: 10, features: [
                         { name: 'Immunity', desc: ['Immunity to Fire'] }
                     ]}
                 ]
              });

            const warnings = await validateResistances({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter' },
                level: 10,
                resistances: [],
                immunities: ['Fire', 'Fire']
              });

            expect(warnings.some(w => w.message.includes('immunities') && w.message.includes('multiple times'))).toBe(true);
          });

        it('should return info when no resistances or immunities', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const warnings = await validateResistances({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                level: 1,
                resistances: [],
                immunities: []
              });

            expect(warnings.some(w => w.type === 'info')).toBe(true);
          });

        it('should warn about unselected granted resistances', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: [
                     { name: 'Hellish Resistance', desc: ['You have resistance to fire damage.'] }
                 ]
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const warnings = await validateResistances({
                rules: '5e',
                race: { name: 'Tiefling' },
                class: { name: 'Wizard' },
                level: 1,
                resistances: [],
                immunities: []
              });

            expect(warnings.some(w => w.message.includes('grants these resistances'))).toBe(true);
          });
      });

    describe('getResistanceInfo', () => {
        it('should identify resistance source from race', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Tiefling',
                traits: [
                     { name: 'Hellish Resistance', desc: ['You have resistance to fire damage.'] }
                 ]
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const result = await getResistanceInfo('Fire', 'resistance', {
                rules: '5e',
                race: { name: 'Tiefling' },
                class: { name: 'Wizard' },
                level: 1
              });

            expect(result.isGranted).toBe(true);
            expect(result.isPreSelected).toBe(true);
            expect(result.source).toContain('Race');
          });

        it('should return false when resistance not granted', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
              });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
              });

            const result = await getResistanceInfo('Fire', 'resistance', {
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                level: 1
              });

            expect(result.isGranted).toBe(false);
            expect(result.isPreSelected).toBe(false);
          });
      });
});
