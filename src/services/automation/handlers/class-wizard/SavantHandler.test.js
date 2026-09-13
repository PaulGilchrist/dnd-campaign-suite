// @improved-by-ai
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
    loadWildMagicSurgeTable: vi.fn(async () => []),
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
        it('should return modal with spell options, optionDetails, and current selections', async () => {
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

        it('should default to 2024 when playerStats.rules is null', async () => {
            getRuntimeValue.mockReturnValue([]);
            loadSpells.mockResolvedValue([]);

            await handle(
                { name: 'Abjuration Savant' },
                { ...mockPlayerStats, rules: null },
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

        it('should include action, playerStats, and campaignName in modal payload', async () => {
            getRuntimeValue.mockReturnValue([]);
            loadSpells.mockResolvedValue(mockAbjurationSpells);

            const action = { name: 'Abjuration Savant', someCustomProp: 'value' };
            const result = await handle(
                action,
                mockPlayerStats,
                mockCampaignName,
                null,
                'Abjuration'
            );

            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(mockPlayerStats);
            expect(result.payload.campaignName).toBe(mockCampaignName);
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
        it('should set runtime value with selected spells (initial selection)', async () => {
            const result = await onSavantSelected({
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
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Shield');
            expect(result.payload.description).toContain('Detect Magic');
            expect(result.payload.name).toBe('Abjuration Savant');
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

        it('should reject duplicate spell selection', async () => {
            const result = await onSavantSelected({
                    action: { name: 'Evocation Savant' },
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    spell1: 'Fire Bolt',
                    spell2: 'Fire Bolt',
                    school: 'Evocation',
                });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should reject missing first spell', async () => {
            const result = await onSavantSelected({
                    action: { name: 'Illusion Savant' },
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    spell1: null,
                    spell2: 'Minor Illusion',
                    school: 'Illusion',
                });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should reject missing second spell', async () => {
            const result = await onSavantSelected({
                    action: { name: 'Abjuration Savant' },
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    spell1: 'Shield',
                    spell2: null,
                    school: 'Abjuration',
                });

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should reject empty string spell names', async () => {
            const result1 = await onSavantSelected({
                    action: { name: 'Abjuration Savant' },
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    spell1: '',
                    spell2: 'Shield',
                    school: 'Abjuration',
                });

            expect(result1.type).toBe('popup');
            expect(result1.payload.description).toContain('Two different');
            expect(setRuntimeValue).not.toHaveBeenCalled();

            vi.clearAllMocks();

            const result2 = await onSavantSelected({
                    action: { name: 'Abjuration Savant' },
                    playerStats: mockPlayerStats,
                    campaignName: mockCampaignName,
                    spell1: 'Shield',
                    spell2: '',
                    school: 'Abjuration',
                });

            expect(result2.type).toBe('popup');
            expect(result2.payload.description).toContain('Two different');
            expect(setRuntimeValue).not.toHaveBeenCalled();
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

        it('should include automation property in payload when action has it', async () => {
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

            expect(result.payload.automation).toEqual({ type: 'feature', source: 'wizard' });
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
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Mage Armor');
            expect(result.payload.name).toBe('Abjuration Savant');
        });

        it('should reject spell from wrong school', async () => {
            loadSpells.mockResolvedValue([
                ...mockAbjurationSpells,
                { name: 'Fire Bolt', school: 'Evocation', level: 0 },
            ]);

            const result = await onSavantLevelUp(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Fire Bolt',
                'Abjuration'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not an Abjuration school spell');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should reject null spell name', async () => {
            const result = await onSavantLevelUp(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                null,
                'Abjuration'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('must be selected');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should reject unknown spell name not in spell list', async () => {
            loadSpells.mockResolvedValue(mockAbjurationSpells);

            const result = await onSavantLevelUp(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Nonexistent Spell',
                'Abjuration'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not an Abjuration school spell');
            expect(setRuntimeValue).not.toHaveBeenCalled();
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

        it('should treat non-array existing selection as empty', async () => {
            getRuntimeValue.mockReturnValue('not-an-array');
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
                ['Shield'],
                mockCampaignName,
                true
            );
        });

        it('should include automation property in payload when action has it', async () => {
            getRuntimeValue.mockReturnValue([]);
            loadSpells.mockResolvedValue(mockAbjurationSpells);

            const actionWithAutomation = {
                name: 'Abjuration Savant',
                automation: { type: 'levelup', source: 'wizard' },
            };

            const result = await onSavantLevelUp(
                actionWithAutomation,
                mockPlayerStats,
                mockCampaignName,
                'Shield',
                'Abjuration'
            );

            expect(result.payload.automation).toEqual({ type: 'levelup', source: 'wizard' });
        });
    });
});
