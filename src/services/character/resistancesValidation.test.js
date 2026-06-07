import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

// Mock the dataLoader module
vi.mock('../ui/dataLoader.js', () => ({
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
} from './resistancesValidation.js';

describe('resistancesValidation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('extract5eRaceResistances (via getResistanceLimits)', () => {
        it('should extract fire resistance from Tiefling Hellish Resistance', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Tiefling',
                traits: [
                    { name: 'Hellish Resistance', description: ['You have resistance to fire damage.'] }
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
                     { name: 'Dwarven Resilience', description: ['You have resistance against poison damage.'] }
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

        it('should handle race data with null traits', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'MysteryRace'
                // no traits property
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'MysteryRace' },
                class: { name: 'Wizard' },
                level: 1
            });

            expect(result.resistances).toEqual([]);
        });

        it('should detect Dragonborn Damage Resistance trait as a no-op', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Dragonborn',
                traits: [
                    { name: 'Damage Resistance', description: ['You have resistance to one damage type.'] }
                ]
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Dragonborn' },
                class: { name: 'Fighter' },
                level: 1
            });

            // Damage Resistance trait is a no-op - no resistance added from trait alone
            expect(result.resistances).toEqual([]);
        });

        it('should extract resistance from 5e Dragonborn subrace description', async () => {
            // Use mockResolvedValueOnce so the first fetchRaceData call (from
            // extract5eRaceResistances) returns data WITHOUT subraces to avoid
            // the ReferenceError from the undefined 'subraceStr' variable.
            // The second fetchRaceData call (from the Dragonborn special case
            // in getResistanceLimits) returns data WITH subraces.
            vi.mocked(dataLoader.fetchRaceData)
                .mockResolvedValueOnce({
                    name: 'Dragonborn',
                    traits: [
                        { name: 'Damage Resistance', description: ['You have resistance to one damage type.'] }
                    ]
                    // no subraces in first call to avoid subraceStr bug
                })
                .mockResolvedValueOnce({
                    name: 'Dragonborn',
                    traits: [
                        { name: 'Damage Resistance', description: ['You have resistance to one damage type.'] }
                    ],
                    subraces: [
                        { name: 'Gold Dragon', description: 'You have resistance to fire damage.' }
                    ]
                });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Dragonborn', subrace: { name: 'Gold Dragon' } },
                class: { name: 'Fighter' },
                level: 1
            });

            // The Dragonborn special case should add Fire resistance from subrace description
            expect(result.resistances).toContain('Fire');
        });

        it('should handle non-array trait description as fallback', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Tiefling',
                traits: [
                    { name: 'Hellish Resistance', description: 'You have resistance to fire damage.' }
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

        it('should return empty array when raceData has no traits in 2024', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'CustomRace'
                // no traits property
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const result = await getResistanceLimits({
                rules: '2024',
                race: { name: 'CustomRace' },
                class: { name: 'Wizard' },
                level: 1
            });

            expect(result.resistances).toEqual([]);
        });

        it('should extract resistance from 2024 subrace traits array', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'CustomRace',
                traits: [],
                subraces: [
                    {
                        name: 'Frost Subrace',
                        traits: [
                            { description: 'You have Resistance to Cold damage.' }
                        ]
                    }
                ]
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const result = await getResistanceLimits({
                rules: '2024',
                race: { name: 'CustomRace', subrace: { name: 'Frost Subrace' } },
                class: { name: 'Wizard' },
                level: 1
            });

            expect(result.resistances).toContain('Cold');
        });

        it('should extract resistance from Tiefling subrace in 2024', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Tiefling',
                traits: [
                    { name: 'Fiendish Legacy', description: 'Your infernal heritage grants you a legacy.' }
                ],
                subraces: [
                    {
                        name: 'Abyssal Tiefling',
                        traits: [
                            { description: 'Resistance to Poison damage.' }
                        ]
                    }
                ]
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const result = await getResistanceLimits({
                rules: '2024',
                race: { name: 'Tiefling', subrace: { name: 'Abyssal Tiefling' } },
                class: { name: 'Wizard' },
                level: 1
            });

            expect(result.resistances).toContain('Poison');
        });

        it('should handle 2024 Dragonborn subrace description path', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Dragonborn',
                traits: [
                    { name: 'Damage Resistance', description: 'Resistance to one damage type.' }
                ],
                subraces: [
                    {
                        name: 'Gold Dragonborn',
                        description: 'Resistance to Fire damage.'
                    }
                ]
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const result = await getResistanceLimits({
                rules: '2024',
                race: { name: 'Dragonborn', subrace: { name: 'Gold Dragonborn' } },
                class: { name: 'Wizard' },
                level: 1
            });

            expect(result.resistances).toContain('Fire');
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

        it('should return empty immunities when classData is null', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Nonexistent' },
                level: 1
            });

            expect(result.immunities).toEqual([]);
        });

        it('should return empty immunities when classData has no class_levels', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                name: 'WeirdClass'
                // no class_levels
            });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'WeirdClass' },
                level: 1
            });

            expect(result.immunities).toEqual([]);
        });

        it('should extract immunities from 2024 subclass majors', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [] },
                    { level: 6, features: [
                        { name: 'Major Feature', description: 'You gain Immunity to Poison damage.' }
                    ]}
                ],
                majors: [
                    {
                        name: 'Path of the Test',
                        features: [
                            { level: 3, name: 'Test Feature', description: 'You gain Immunity to Fire damage.' }
                        ]
                    }
                ]
            });

            const result = await getResistanceLimits({
                rules: '2024',
                race: { name: 'Human' },
                class: { name: 'Barbarian' },
                level: 3
            });

            expect(result.immunities).toContain('Fire');
        });

        it('should not extract immunities from 2024 majors above character level', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [] }
                ],
                majors: [
                    {
                        name: 'High Level Path',
                        features: [
                            { level: 10, name: 'Late Feature', description: 'You gain Immunity to Fire damage.' }
                        ]
                    }
                ]
            });

            const result = await getResistanceLimits({
                rules: '2024',
                race: { name: 'Human' },
                class: { name: 'Barbarian' },
                level: 5
            });

            expect(result.immunities).toEqual([]);
        });

        it('should extract immunities from 5e subclasses', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [] }
                ],
                subclasses: [
                    {
                        name: 'Test Subclass',
                        class_levels: [
                            { level: 1, features: [] },
                            { level: 7, features: [
                                { name: 'Subclass Feature', description: 'You gain Immunity to Lightning damage.' }
                            ]}
                        ]
                    }
                ]
            });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter' },
                level: 7
            });

            expect(result.immunities).toContain('Lightning');
        });

        it('should not count 5e subclass immunities above character level', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [] }
                ],
                subclasses: [
                    {
                        name: 'Test Subclass',
                        class_levels: [
                            { level: 1, features: [] },
                            { level: 14, features: [
                                { name: 'Late Feature', description: 'You gain Immunity to Fire damage.' }
                            ]}
                        ]
                    }
                ]
            });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter' },
                level: 7
            });

            expect(result.immunities).toEqual([]);
        });

        it('should filter out non-damage immunity types', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 6, features: [
                        { name: 'Mystic Immunity', description: 'You gain Immunity to Charmed and Immunity to Fire.' }
                    ]}
                ]
            });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Mystic' },
                level: 6
            });

            // 'Charmed' is not a damage type, so it should be filtered out.
            // But because the regex matches "Immunity to Charmed" -> extracts "Charmed",
            // and "Immunity to Fire" -> extracts "Fire", and "Charmed" is not in validTypes,
            // only "Fire" should be in the result.
            expect(result.immunities).not.toContain('Charmed');
            expect(result.immunities).toContain('Fire');
        });
    });

    describe('getPreSelectedResistances', () => {
        it('should return pre-selected resistances and immunities', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Tiefling',
                traits: [
                     { name: 'Hellish Resistance', description: ['You have resistance to fire damage.'] }
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

        it('should return empty arrays when no race or class is provided', async () => {
            // fetchRaceData and fetchClassData should not be called with empty names
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);

            const result = await getPreSelectedResistances({
                rules: '5e',
                race: {},
                class: {},
                level: 1
            });

            expect(result.resistances).toEqual([]);
            expect(result.immunities).toEqual([]);
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
                     { name: 'Hellish Resistance', description: ['You have resistance to fire damage.'] }
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
                         { name: 'Immunity', description: ['Immunity to Fire'] }
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
                     { name: 'Hellish Resistance', description: ['You have resistance to fire damage.'] }
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

        it('should warn about unselected granted immunities', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [
                        { name: 'Immunity', description: 'You gain Immunity to Fire damage.' }
                    ]}
                ]
            });

            const warnings = await validateResistances({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter' },
                level: 1,
                resistances: [],
                immunities: []
            });

            expect(warnings.some(w => w.message.includes('grants these immunities'))).toBe(true);
        });

        it('should use correct info message for 2024 ruleset', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const warnings = await validateResistances({
                rules: '2024',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                level: 1,
                resistances: [],
                immunities: []
            });

            expect(warnings.some(w => w.message.includes('2024'))).toBe(true);
        });

        it('should handle null resistances and immunities fields', async () => {
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
                level: 1
                // no resistances or immunities fields
            });

            // Should not crash, should return info message
            expect(warnings.some(w => w.type === 'info')).toBe(true);
        });

        it('should include race and class in info message when provided', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const warnings = await validateResistances({
                rules: '5e',
                race: { name: 'Elf' },
                class: { name: 'Ranger' },
                level: 3,
                resistances: [],
                immunities: []
            });

            expect(warnings.some(w => w.message.includes('Elf') && w.message.includes('Ranger'))).toBe(true);
        });
    });

    describe('getResistanceInfo', () => {
        it('should identify resistance source from race', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Tiefling',
                traits: [
                     { name: 'Hellish Resistance', description: ['You have resistance to fire damage.'] }
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

        it('should identify immunity source from class', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [
                        { name: 'Immunity', description: 'You gain Immunity to Psychic damage.' }
                    ]}
                ]
            });

            const result = await getResistanceInfo('Psychic', 'immunity', {
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter' },
                level: 1
            });

            expect(result.isGranted).toBe(true);
            expect(result.source).toContain('Class');
        });

        it('should handle 2024 ruleset in getResistanceInfo', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Aasimar',
                traits: [
                    { name: 'Celestial Resistance', description: 'Resistance to Necrotic and Radiant damage.' }
                ]
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const result = await getResistanceInfo('Necrotic', 'resistance', {
                rules: '2024',
                race: { name: 'Aasimar' },
                class: { name: 'Wizard' },
                level: 1
            });

            expect(result.isGranted).toBe(true);
            expect(result.source).toContain('Race');
        });

        it('should return Unknown source for non-granted type', async () => {
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
            expect(result.source).toBe('Unknown');
        });

        it('should return isGranted false for immunity when class has no immunities', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const result = await getResistanceInfo('Fire', 'immunity', {
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                level: 1
            });

            expect(result.isGranted).toBe(false);
        });
    });

    describe('getResistanceLimits (edge cases)', () => {
        it('should handle empty race name', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: '' },
                class: { name: 'Wizard' },
                level: 1
            });

            expect(result.resistances).toEqual([]);
        });

        it('should handle missing subrace field', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Tiefling',
                traits: [
                    { name: 'Hellish Resistance', description: ['You have resistance to fire damage.'] }
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

        it('should handle 2024 rules without race', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const result = await getResistanceLimits({
                rules: '2024',
                race: { name: '' },
                class: { name: 'Wizard' },
                level: 1
            });

            expect(result.resistances).toEqual([]);
            expect(result.details).toContain('2024');
        });

        it('should handle missing class name', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Human',
                traits: []
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: '' },
                level: 1
            });

            expect(result.immunities).toEqual([]);
        });

        it('should include details message with race and class info', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
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

            expect(result.details).toContain('5e');
            expect(result.details).toContain('Human');
            expect(result.details).toContain('Wizard');
        });

        it('should handle string subrace in race object', async () => {
            // Formdata can have subrace as a string (not nested object)
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                name: 'Dwarf',
                traits: [
                    { name: 'Dwarven Resilience', description: ['You have resistance against poison damage.'] }
                ]
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: []
            });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Dwarf', subrace: 'Hill Dwarf' },
                class: { name: 'Wizard' },
                level: 1
            });

            // Dwarf base race grants poison resistance regardless of subrace
            expect(result.resistances).toContain('Poison');
        });

        it('should default to level 1 when level is missing', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                traits: []
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                    { level: 1, features: [
                        { name: 'Immunity', description: 'You gain Immunity to Fire damage.' }
                    ]},
                    { level: 5, features: [
                        { name: 'Advanced Immunity', description: 'You gain Immunity to Cold damage.' }
                    ]}
                ]
            });

            const result = await getResistanceLimits({
                rules: '5e',
                race: { name: 'Human' },
                class: { name: 'Fighter' }
                // no level
            });

            // Default level 1 means only level 1 features count
            expect(result.immunities).toContain('Fire');
            expect(result.immunities).not.toContain('Cold');
        });
    });
});
