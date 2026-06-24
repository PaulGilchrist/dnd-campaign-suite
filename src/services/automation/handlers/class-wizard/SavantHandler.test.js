// @improved-by-ai
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
        it('should return modal when no spells selected', async () => {
            getRuntimeValue.mockReturnValue([]);
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
            expect(result.payload.selectedSpells).toEqual([]);
        });

        it('should return modal with current selections when spells already exist', async () => {
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

        it('should exclude non-Abjuration spells', async () => {
            getRuntimeValue.mockReturnValue([]);
            const allSpells = [
                ...mockAbjurationSpells,
                { name: 'Fire Bolt', school: 'Evocation', level: 0 },
                { name: 'Magic Missile', school: 'Evocation', level: 1 },
                { name: 'Counterspell', school: 'Abjuration', level: 3 },
            ];
            loadSpells.mockResolvedValue(allSpells);

            const result = await handle(
                { name: 'Abjuration Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName,
                null,
                'Abjuration'
            );

            expect(result.type).toBe('modal');
            expect(result.payload.school).toBe('Abjuration');
            expect(result.payload.spellOptions).not.toContain('Counterspell');
            expect(result.payload.spellOptions).not.toContain('Fire Bolt');
            expect(result.payload.spellOptions).not.toContain('Magic Missile');
        });

        it('should exclude Abjuration spells not available to Wizard', async () => {
            getRuntimeValue.mockReturnValue([]);
            const allSpells = [
                ...mockAbjurationSpells,
                { name: 'Shield of Faith', school: 'Abjuration', level: 1, classes: ['Cleric'] },
                { name: 'Defensive Shield', school: 'Abjuration', level: 0, classes: ['Sorcerer'] },
            ];
            loadSpells.mockResolvedValue(allSpells);

            const result = await handle(
                { name: 'Abjuration Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName,
                null,
                'Abjuration'
            );

            expect(result.type).toBe('modal');
            expect(result.payload.spellOptions).not.toContain('Shield of Faith');
            expect(result.payload.spellOptions).not.toContain('Defensive Shield');
        });

        it('should return info popup when no abjuration spells available', async () => {
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

        it('should use correct modal name for Divination', async () => {
            getRuntimeValue.mockReturnValue([]);
            const divinationSpells = [
                { name: 'Detect Magic', school: 'Divination', level: 1, classes: ['Wizard'] },
                { name: 'Identify', school: 'Divination', level: 1, classes: ['Wizard'] },
            ];
            loadSpells.mockResolvedValue(divinationSpells);

            const result = await handle(
                { name: 'Divination Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName,
                null,
                'Divination'
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('divinationSavant');
            expect(result.payload.school).toBe('Divination');
        });

        it('should use correct modal name for Evocation', async () => {
            getRuntimeValue.mockReturnValue([]);
            const evocationSpells = [
                { name: 'Fire Bolt', school: 'Evocation', level: 0, classes: ['Wizard'] },
                { name: 'Mage Hand', school: 'Evocation', level: 0, classes: ['Wizard'] },
            ];
            loadSpells.mockResolvedValue(evocationSpells);

            const result = await handle(
                { name: 'Evocation Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName,
                null,
                'Evocation'
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('evocationSavant');
            expect(result.payload.school).toBe('Evocation');
        });

        it('should use correct modal name for Illusion', async () => {
            getRuntimeValue.mockReturnValue([]);
            const illusionSpells = [
                { name: 'Minor Illusion', school: 'Illusion', level: 0, classes: ['Wizard'] },
                { name: 'Disguise Self', school: 'Illusion', level: 1, classes: ['Wizard'] },
            ];
            loadSpells.mockResolvedValue(illusionSpells);

            const result = await handle(
                { name: 'Illusion Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName,
                null,
                'Illusion'
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('illusionSavant');
            expect(result.payload.school).toBe('Illusion');
        });

        it('should filter out spells with level greater than 2', async () => {
            getRuntimeValue.mockReturnValue([]);
            const allSpells = [
                { name: 'Shield', school: 'Abjuration', level: 1, classes: ['Wizard'] },
                { name: 'Counterspell', school: 'Abjuration', level: 3, classes: ['Wizard'] },
                { name: 'Disintegrate', school: 'Abjuration', level: 6, classes: ['Wizard'] },
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

        it('should filter out spells with negative level', async () => {
            getRuntimeValue.mockReturnValue([]);
            const allSpells = [
                { name: 'Shield', school: 'Abjuration', level: 1, classes: ['Wizard'] },
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

        it('should pass the correct ruleset to loadSpells', async () => {
            getRuntimeValue.mockReturnValue([]);
            loadSpells.mockResolvedValue([]);

            const wizard5e = { ...mockPlayerStats, rules: '5e' };
            await handle(
                { name: 'Abjuration Savant' },
                wizard5e,
                mockCampaignName,
                null,
                'Abjuration'
            );

            expect(loadSpells).toHaveBeenCalledWith('5e');
        });

        it('should default to 2024 ruleset when not specified', async () => {
            getRuntimeValue.mockReturnValue([]);
            loadSpells.mockResolvedValue([]);

            const wizardNoRules = { ...mockPlayerStats, rules: undefined };
            await handle(
                { name: 'Abjuration Savant' },
                wizardNoRules,
                mockCampaignName,
                null,
                'Abjuration'
            );

            expect(loadSpells).toHaveBeenCalledWith('2024');
        });

        it('should build optionDetails with defaults for missing spell fields', async () => {
            getRuntimeValue.mockReturnValue([]);
            const minimalSpell = { name: 'Weird Spell', school: 'Abjuration', level: 1, classes: ['Wizard'] };
            loadSpells.mockResolvedValue([minimalSpell]);

            const result = await handle(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                null,
                'Abjuration'
            );

            expect(result.payload.optionDetails['Weird Spell']).toEqual({
                name: 'Weird Spell',
                level: 1,
                casting_time: '1 action',
                range: '',
                description: '',
                damage: null,
            });
        });

        it('should include action, playerStats, and campaignName in payload', async () => {
            getRuntimeValue.mockReturnValue([]);
            loadSpells.mockResolvedValue(mockAbjurationSpells);

            const action = { name: 'Abjuration Savant', customField: 'value' };
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

        it('should append new spells to existing selection (level-up)', async () => {
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

        it('should clear selection when both null', async () => {
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

        it('should reject same spell twice', async () => {
            const result = await onSavantSelected(
                { name: 'Evocation Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Fire Bolt',
                'Fire Bolt',
                'Evocation'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
        });

        it('should reject missing spells', async () => {
            const result = await onSavantSelected(
                { name: 'Illusion Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Minor Illusion',
                null,
                'Illusion'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
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

        it('should reject when spell2 is missing but spell1 is present', async () => {
            const result = await onSavantSelected(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Shield',
                null,
                'Abjuration'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should reject when spell1 is empty string', async () => {
            const result = await onSavantSelected(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                '',
                'Shield',
                'Abjuration'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should reject when spell2 is empty string', async () => {
            const result = await onSavantSelected(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Shield',
                '',
                'Abjuration'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('should use correct runtime key for each school', async () => {
            getRuntimeValue.mockReturnValue([]);
            await onSavantSelected(
                { name: 'Divination Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Detect Magic',
                'Identify',
                'Divination'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Divination_Savant_selection',
                ['Detect Magic', 'Identify'],
                mockCampaignName,
                true
            );
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

        it('should reject non-Abjuration spell', async () => {
            getRuntimeValue.mockReturnValue(['Shield']);
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
        });

        it('should reject null spell', async () => {
            const result = await onSavantLevelUp(
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

        it('should use correct runtime key for Divination', async () => {
            getRuntimeValue.mockReturnValue(['Detect Magic']);
            loadSpells.mockResolvedValue([
                { name: 'Augury', school: 'Divination', level: 2, classes: ['Wizard'] },
            ]);

            await onSavantLevelUp(
                { name: 'Divination Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Augury',
                'Divination'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Divination_Savant_selection',
                ['Detect Magic', 'Augury'],
                mockCampaignName,
                true
            );
        });

        it('should use correct runtime key for Evocation', async () => {
            getRuntimeValue.mockReturnValue(['Fire Bolt']);
            loadSpells.mockResolvedValue([
                { name: 'Mage Hand', school: 'Evocation', level: 0, classes: ['Wizard'] },
            ]);

            await onSavantLevelUp(
                { name: 'Evocation Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Mage Hand',
                'Evocation'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Evocation_Savant_selection',
                ['Fire Bolt', 'Mage Hand'],
                mockCampaignName,
                true
            );
        });

        it('should use correct runtime key for Illusion', async () => {
            getRuntimeValue.mockReturnValue(['Minor Illusion']);
            loadSpells.mockResolvedValue([
                { name: 'Disguise Self', school: 'Illusion', level: 1, classes: ['Wizard'] },
            ]);

            await onSavantLevelUp(
                { name: 'Illusion Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Disguise Self',
                'Illusion'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Illusion_Savant_selection',
                ['Minor Illusion', 'Disguise Self'],
                mockCampaignName,
                true
            );
        });

        it('should reject spell not found in spell data', async () => {
            getRuntimeValue.mockReturnValue([]);
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
