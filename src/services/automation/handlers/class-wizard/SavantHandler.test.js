// @cleaned-by-ai
import { handle, onSavantSelected, onSavantLevelUp } from './SavantHandler.js';
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
        it('should return modal with spell options and current selections', async () => {
            getRuntimeValue.mockReturnValue(['Shield', 'Detect Magic']);
            loadSpells.mockResolvedValue(mockAbjurationSpells);

            const result = await handle(
                { name: 'Abjuration Savant', description: 'Choose two Wizard spells...' },
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

        it('should pass the correct ruleset to loadSpells and default to 2024', async () => {
            getRuntimeValue.mockReturnValue([]);
            loadSpells.mockResolvedValue([]);

            await handle(
                { name: 'Abjuration Savant' },
                { ...mockPlayerStats, rules: '5e' },
                mockCampaignName,
                null,
                'Abjuration'
            );
            expect(loadSpells).toHaveBeenCalledWith('5e');

            loadSpells.mockResolvedValue([]);
            await handle(
                { name: 'Abjuration Savant' },
                { ...mockPlayerStats, rules: undefined },
                mockCampaignName,
                null,
                'Abjuration'
            );
            expect(loadSpells).toHaveBeenCalledWith('2024');
        });

        it('should use correct modal name per school', async () => {
            const schools = [
                ['Divination', 'divinationSavant'],
                ['Evocation', 'evocationSavant'],
                ['Illusion', 'illusionSavant'],
            ];

            for (const [school, modalName] of schools) {
                vi.clearAllMocks();
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
        });
    });

    describe('onSavantSelected', () => {
        it('should set runtime value with selected spells (initial selection)', async () => {
            const result = await onSavantSelected(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Shield',
                'Detect Magic',
                'Abjuration'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Abjuration_Savant_selection',
                ['Shield', 'Detect Magic'],
                mockCampaignName,
                true
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Shield');
            expect(result.payload.description).toContain('Detect Magic');
        });

        it('should append new spells to existing selection', async () => {
            getRuntimeValue.mockReturnValue(['Shield']);

            await onSavantSelected(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Mage Armor',
                'Alarm',
                'Abjuration'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Abjuration_Savant_selection',
                ['Shield', 'Mage Armor', 'Alarm'],
                mockCampaignName,
                true
            );
        });

        it('should clear selection when both spells are null', async () => {
            const result = await onSavantSelected(
                { name: 'Divination Savant' },
                mockPlayerStats,
                mockCampaignName,
                null,
                null,
                'Divination'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Divination_Savant_selection',
                null,
                mockCampaignName,
                true
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('cleared');
        });

        it('should reject invalid selections (same spell, missing spell, or empty string)', async () => {
            const invalidCases = [
                { spell1: 'Fire Bolt', spell2: 'Fire Bolt', school: 'Evocation', feature: 'Evocation Savant' },
                { spell1: 'Minor Illusion', spell2: null, school: 'Illusion', feature: 'Illusion Savant' },
                { spell1: 'Shield', spell2: null, school: 'Abjuration', feature: 'Abjuration Savant' },
                { spell1: '', spell2: 'Shield', school: 'Abjuration', feature: 'Abjuration Savant' },
                { spell1: 'Shield', spell2: '', school: 'Abjuration', feature: 'Abjuration Savant' },
            ];

            for (const { spell1, spell2, school, feature } of invalidCases) {
                vi.clearAllMocks();

                const result = await onSavantSelected(
                    { name: feature },
                    mockPlayerStats,
                    mockCampaignName,
                    spell1,
                    spell2,
                    school
                );

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('Two different');
                expect(setRuntimeValue).not.toHaveBeenCalled();
            }
        });

        it('should not add duplicate spells', async () => {
            getRuntimeValue.mockReturnValue(['Shield', 'Detect Magic']);

            await onSavantSelected(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Shield',
                'Mage Armor',
                'Abjuration'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Abjuration_Savant_selection',
                ['Shield', 'Detect Magic', 'Mage Armor'],
                mockCampaignName,
                true
            );
        });

        it('should use correct runtime key per school', async () => {
            const schools = [
                ['Divination', ['Detect Magic', 'Identify'], '_Divination_Savant_selection'],
                ['Evocation', ['Fire Bolt', 'Mage Hand'], '_Evocation_Savant_selection'],
                ['Illusion', ['Minor Illusion', 'Disguise Self'], '_Illusion_Savant_selection'],
            ];

            for (const [school, spells, key] of schools) {
                vi.clearAllMocks();
                getRuntimeValue.mockReturnValue([]);

                await onSavantSelected(
                    { name: `${school} Savant` },
                    mockPlayerStats,
                    mockCampaignName,
                    spells[0],
                    spells[1],
                    school
                );

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestWizard',
                    key,
                    spells,
                    mockCampaignName,
                    true
                );
            }
        });
    });

    describe('onSavantLevelUp', () => {
        it('should add new spell to selection', async () => {
            getRuntimeValue.mockReturnValue(['Shield', 'Detect Magic']);
            loadSpells.mockResolvedValue(mockAbjurationSpells);

            const result = await onSavantLevelUp(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Mage Armor',
                'Abjuration'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Abjuration_Savant_selection',
                ['Shield', 'Detect Magic', 'Mage Armor'],
                mockCampaignName,
                true
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Mage Armor');
        });

        it('should reject non-matching school spell and null spell', async () => {
            getRuntimeValue.mockReturnValue(['Shield']);
            loadSpells.mockResolvedValue([
                ...mockAbjurationSpells,
                { name: 'Fire Bolt', school: 'Evocation', level: 0 },
            ]);

            let result = await onSavantLevelUp(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Fire Bolt',
                'Abjuration'
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not an Abjuration school spell');

            result = await onSavantLevelUp(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                null,
                'Abjuration'
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('must be selected');
        });

        it('should not add duplicate spell on level up', async () => {
            getRuntimeValue.mockReturnValue(['Shield', 'Detect Magic']);
            loadSpells.mockResolvedValue(mockAbjurationSpells);

            await onSavantLevelUp(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Shield',
                'Abjuration'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Abjuration_Savant_selection',
                ['Shield', 'Detect Magic'],
                mockCampaignName,
                true
            );
        });

        it('should use correct runtime key per school', async () => {
            const schools = [
                ['Divination', 'Detect Magic', 'Augury', '_Divination_Savant_selection'],
                ['Evocation', 'Fire Bolt', 'Mage Hand', '_Evocation_Savant_selection'],
                ['Illusion', 'Minor Illusion', 'Disguise Self', '_Illusion_Savant_selection'],
            ];

            for (const [school, existing, newSpell, key] of schools) {
                vi.clearAllMocks();
                getRuntimeValue.mockReturnValue([existing]);
                loadSpells.mockResolvedValue([
                    { name: newSpell, school, level: 1, classes: ['Wizard'] },
                ]);

                await onSavantLevelUp(
                    { name: `${school} Savant` },
                    mockPlayerStats,
                    mockCampaignName,
                    newSpell,
                    school
                );

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'TestWizard',
                    key,
                    [existing, newSpell],
                    mockCampaignName,
                    true
                );
            }
        });

        it('should pass the correct ruleset to loadSpells', async () => {
            getRuntimeValue.mockReturnValue([]);
            loadSpells.mockResolvedValue([]);

            const wizard5e = { ...mockPlayerStats, rules: '5e' };
            await onSavantLevelUp(
                { name: 'Abjuration Savant' },
                wizard5e,
                mockCampaignName,
                'Shield',
                'Abjuration'
            );

            expect(loadSpells).toHaveBeenCalledWith('5e');
        });
    });
});
