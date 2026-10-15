// @maintained-by-ai
// SavantHandler unit tests — deterministic pure-function coverage of the two LIVE exports:
//   handle            (live: automation/index.js PASSIVE_RULE_EFFECTS via makeSavantHandler)
//   onSavantSelected (live: CharSpecialActions.jsx SavantModal confirm)
// DEAD-LANE (verified 2026-10-15, corroborated by docs/automations-manifest.json):
//   onSavantLevelUp has zero production callers (no level-up dispatch anywhere wires it;
//   spellCalc2024.js only READS the _School_Savant_selection keys). Its test block was
//   removed in the test-suite trim; recommend removing the orphan export from SavantHandler.js.

import { handle, onSavantSelected } from './SavantHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { loadSpells } from '../../../ui/dataLoader.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadSpells: vi.fn(),
}));

const mockPlayerStats = {
    name: 'TestWizard',
    rules: '2024',
    level: 5,
};

const mockCampaignName = 'test-campaign';

const mockAbjurationSpells = [
    { name: 'Shield', school: 'Abjuration', level: 1, casting_time: '1 reaction', range: '5 ft.', description: 'An invisible barrier of magical force.', damage: null, classes: ['Wizard'] },
    { name: 'Absorb Elements', school: 'Abjuration', level: 1, casting_time: '1 reaction', range: 'Self', description: 'Reaction when taking elemental damage.', damage: null, classes: ['Wizard'] },
    { name: 'Detect Magic', school: 'Abjuration', level: 1, casting_time: '1 action', range: 'Self', description: 'Detect creatures or objects with magic.', damage: null, classes: ['Wizard', 'Sorcerer'] },
    { name: 'Mage Armor', school: 'Abjuration', level: 1, casting_time: '1 action', range: 'Touch', description: 'Target gains +1 AC.', damage: null, classes: ['Wizard'] },
    { name: 'Alarm', school: 'Abjuration', level: 1, casting_time: '1 minute', range: '30 ft.', description: 'Alerts you of approaching creatures.', damage: null, classes: ['Bard', 'Wizard'] },
    { name: 'Counterspell', school: 'Abjuration', level: 3, casting_time: '1 reaction', range: '60 ft.', description: 'Interrupt a creature casting a spell.', damage: null, classes: ['Wizard'] },
];

describe('SavantHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return modal with spell options, optionDetails, current selections, and passthrough payload', async () => {
            const action = { name: 'Abjuration Savant', description: 'Choose two Wizard spells...' };
            getRuntimeValue.mockReturnValue(['Shield', 'Detect Magic']);
            loadSpells.mockResolvedValue(mockAbjurationSpells);

            const result = await handle(
                action,
                mockPlayerStats,
                mockCampaignName,
                null,
                'Abjuration'
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('abjurationSavant');
            expect(result.payload.school).toBe('Abjuration');
            expect(result.payload.spellOptions).toEqual(['Shield', 'Absorb Elements', 'Detect Magic', 'Mage Armor', 'Alarm']);
            expect(result.payload.selectedSpells).toEqual(['Shield', 'Detect Magic']);

            // Verify optionDetails contains structured spell data
            expect(result.payload.optionDetails).toBeDefined();
            expect(result.payload.optionDetails['Shield']).toEqual({
                name: 'Shield',
                level: 1,
                casting_time: '1 reaction',
                range: '5 ft.',
                description: 'An invisible barrier of magical force.',
                damage: null,
            });
            expect(Object.keys(result.payload.optionDetails)).toHaveLength(5);

            // Payload carries modal consumer inputs by reference
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(mockPlayerStats);
            expect(result.payload.campaignName).toBe(mockCampaignName);
        });

        it('should return info popup when no spells available for school', async () => {
            getRuntimeValue.mockReturnValue([]);
            loadSpells.mockResolvedValue([]);

            const result = await handle(
                { name: 'Abjuration Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName,
                null,
                'Abjuration'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Abjuration Savant');
            expect(result.payload.description).toContain('No Abjuration school spells');
        });

        it('should filter spells by school, level (0-2), and Wizard class', async () => {
            getRuntimeValue.mockReturnValue([]);
            const allSpells = [
                { name: 'Shield', school: 'Abjuration', level: 1, classes: ['Wizard'] },
                { name: 'Detect Magic', school: 'Divination', level: 1, classes: ['Wizard'] },
                { name: 'Fire Bolt', school: 'Abjuration', level: 0, classes: ['Sorcerer'] },
                { name: 'Counterspell', school: 'Abjuration', level: 3, classes: ['Wizard'] },
                { name: 'Disintegrate', school: 'Abjuration', level: 6, classes: ['Wizard'] },
                { name: 'Weird Magic', school: 'Abjuration', level: -1, classes: ['Wizard'] },
            ];
            loadSpells.mockResolvedValue(allSpells);

            const result = await handle(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                null,
                'Abjuration'
            );

            expect(result.payload.spellOptions).toEqual(['Shield']);
        });

        it('should pass ruleset through to loadSpells, defaulting falsy to 2024', async () => {
            const cases = [
                ['5e', '5e'],
                [undefined, '2024'],
                [null, '2024'],
            ];

            for (const [rules, expected] of cases) {
                loadSpells.mockClear();
                loadSpells.mockResolvedValue([]);

                await handle(
                    { name: 'Abjuration Savant' },
                    { ...mockPlayerStats, rules },
                    mockCampaignName,
                    null,
                    'Abjuration'
                );

                expect(loadSpells).toHaveBeenCalledWith(expected);
            }
        });

        it('should use correct modal name per school', async () => {
            const schools = [
                ['Divination', 'divinationSavant'],
                ['Evocation', 'evocationSavant'],
                ['Illusion', 'illusionSavant'],
            ];

            for (const [school, modalName] of schools) {
                getRuntimeValue.mockReturnValue([]);
                loadSpells.mockResolvedValue([
                    { name: 'Test Spell', school, level: 1, classes: ['Wizard'] },
                ]);

                const result = await handle(
                    { name: `${school} Savant` },
                    mockPlayerStats,
                    mockCampaignName,
                    null,
                    school
                );

                expect(result.modalName).toBe(modalName);
                expect(result.payload.school).toBe(school);
            }
        });

        it('should treat non-array runtime value as empty selection', async () => {
            getRuntimeValue.mockReturnValue('not-an-array');
            loadSpells.mockResolvedValue(mockAbjurationSpells);

            const result = await handle(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                null,
                'Abjuration'
            );

            expect(result.payload.selectedSpells).toEqual([]);
            expect(result.payload.spellOptions).toEqual(['Shield', 'Absorb Elements', 'Detect Magic', 'Mage Armor', 'Alarm']);
        });

        it('should provide default casting_time and range when spell data lacks them', async () => {
            getRuntimeValue.mockReturnValue([]);
            loadSpells.mockResolvedValue([
                { name: 'Minimal Spell', school: 'Abjuration', level: 0, classes: ['Wizard'] },
            ]);

            const result = await handle(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                null,
                'Abjuration'
            );

            expect(result.payload.optionDetails['Minimal Spell']).toEqual({
                name: 'Minimal Spell',
                level: 0,
                casting_time: '1 action',
                range: '',
                description: '',
                damage: null,
            });
        });
    });

    describe('onSavantSelected', () => {
        it('should set runtime value with selected spells (initial selection) and pass automation through', async () => {
            const actionWithAutomation = {
                name: 'Abjuration Savant',
                automation: { type: 'feature', source: 'wizard' },
            };

            const result = await onSavantSelected({
                    action: actionWithAutomation,
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    spell1: 'Shield',
                    spell2: 'Detect Magic',
                    school: 'Abjuration',
                });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Abjuration_Savant_selection',
                ['Shield', 'Detect Magic'],
                mockCampaignName,
                true
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Shield');
            expect(result.payload.description).toContain('Detect Magic');
            expect(result.payload.name).toBe('Abjuration Savant');
            expect(result.payload.automation).toEqual({ type: 'feature', source: 'wizard' });
        });

        it('should append new spells to existing selection', async () => {
            getRuntimeValue.mockReturnValue(['Shield']);

            await onSavantSelected({
                    action: { name: 'Abjuration Savant' },
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    spell1: 'Mage Armor',
                    spell2: 'Alarm',
                    school: 'Abjuration',
                });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Abjuration_Savant_selection',
                ['Shield', 'Mage Armor', 'Alarm'],
                mockCampaignName,
                true
            );
        });

        it('should not add duplicate spells to existing selection', async () => {
            getRuntimeValue.mockReturnValue(['Shield', 'Detect Magic']);

            await onSavantSelected({
                    action: { name: 'Abjuration Savant' },
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    spell1: 'Shield',
                    spell2: 'Mage Armor',
                    school: 'Abjuration',
                });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Abjuration_Savant_selection',
                ['Shield', 'Detect Magic', 'Mage Armor'],
                mockCampaignName,
                true
            );
        });

        it('should clear selection when both spells are null', async () => {
            const result = await onSavantSelected({
                    action: { name: 'Divination Savant' },
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    spell1: null,
                    spell2: null,
                    school: 'Divination',
                });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Divination_Savant_selection',
                null,
                mockCampaignName,
                true
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('cleared');
        });

        it('should reject invalid spell pairs without writing', async () => {
            // One guard line: !spell1 || !spell2 || spell1 === spell2
            const invalidPairs = [
                ['Fire Bolt', 'Fire Bolt'],   // duplicate
                [null, 'Minor Illusion'],     // missing first
                ['Shield', null],             // missing second
                ['', 'Shield'],              // empty first
                ['Shield', ''],              // empty second
            ];

            for (const [spell1, spell2] of invalidPairs) {
                const result = await onSavantSelected({
                        action: { name: 'Abjuration Savant' },
                        playerStats: mockPlayerStats,
                        campaignName: mockCampaignName,
                        spell1,
                        spell2,
                        school: 'Abjuration',
                    });

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('Two different');
                expect(setRuntimeValue).not.toHaveBeenCalled();
            }
        });

        it('should use correct runtime key per school', async () => {
            const schools = [
                ['Divination', ['Detect Magic', 'Identify'], '_Divination_Savant_selection'],
                ['Evocation', ['Fire Bolt', 'Mage Hand'], '_Evocation_Savant_selection'],
                ['Illusion', ['Minor Illusion', 'Disguise Self'], '_Illusion_Savant_selection'],
            ];

            for (const [school, spells, key] of schools) {
                getRuntimeValue.mockReturnValue([]);

                await onSavantSelected({
                        action: { name: `${school} Savant` },
                        playerStats: mockPlayerStats,
                        campaignName: mockCampaignName,
                        spell1: spells[0],
                        spell2: spells[1],
                        school,
                    });

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestWizard',
                    key,
                    spells,
                    mockCampaignName,
                    true
                );
            }
        });

        it('should treat non-array existing selection as empty', async () => {
            getRuntimeValue.mockReturnValue('not-an-array');

            await onSavantSelected({
                    action: { name: 'Abjuration Savant' },
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    spell1: 'Shield',
                    spell2: 'Detect Magic',
                    school: 'Abjuration',
                });

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Abjuration_Savant_selection',
                ['Shield', 'Detect Magic'],
                mockCampaignName,
                true
            );
        });
    });
});
