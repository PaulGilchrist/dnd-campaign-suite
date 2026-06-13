import { handle, onAbjurationSavantSelected, onAbjurationSavantCast, onAbjurationSavantLevelUp } from './abjurationSavantHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';
import { loadSpells } from '../../ui/dataLoader.js';

vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/dataLoader.js', () => ({
    loadSpells: vi.fn(),
}));

const mockPlayerStats = {
    name: 'TestWizard',
    rules: '2024',
    level: 5,
};

const mockCampaignName = 'test-campaign';

const mockAbjurationSpells = [
    { name: 'Shield', school: 'Abjuration', level: 1, casting_time: '1 reaction', range: '5 ft.', description: 'An invisible barrier of magical force.', damage: null },
    { name: 'Absorb Elements', school: 'Abjuration', level: 1, casting_time: '1 reaction', range: 'Self', description: 'Reaction when taking elemental damage.', damage: null },
    { name: 'Detect Magic', school: 'Abjuration', level: 1, casting_time: '1 action', range: 'Self', description: 'Detect creatures or objects with magic.', damage: null },
    { name: 'Mage Armor', school: 'Abjuration', level: 1, casting_time: '1 action', range: 'Touch', description: 'Target gains +1 AC.', damage: null },
    { name: 'Alarm', school: 'Abjuration', level: 1, casting_time: '1 minute', range: '30 ft.', description: 'Alerts you of approaching creatures.', damage: null },
    { name: 'Counterspell', school: 'Abjuration', level: 3, casting_time: '1 reaction', range: '60 ft.', description: 'Interrupt a creature casting a spell.', damage: null },
];

describe('abjurationSavantHandler', () => {
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
                mockCampaignName
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('abjurationSavant');
            expect(result.payload.abjurationOptions).toEqual(['Shield', 'Absorb Elements', 'Detect Magic', 'Mage Armor', 'Alarm']);
            expect(result.payload.selectedSpells).toEqual([]);
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
                mockCampaignName
            );

            expect(result.type).toBe('modal');
            // Counterspell is level 3, so excluded (max level 2)
            expect(result.payload.abjurationOptions).not.toContain('Counterspell');
            // Fire Bolt and Magic Missile are not Abjuration
            expect(result.payload.abjurationOptions).not.toContain('Fire Bolt');
            expect(result.payload.abjurationOptions).not.toContain('Magic Missile');
        });

        it('should return popup with available spells when some are selected', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Abjuration_Savant_selection') return ['Shield', 'Detect Magic'];
                if (key.includes('_used')) return false;
                return undefined;
            });

            const result = await handle(
                { name: 'Abjuration Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.html).toContain('Shield');
            expect(result.payload.html).toContain('Detect Magic');
        });

        it('should return info popup when all spells used', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Abjuration_Savant_selection') return ['Shield', 'Detect Magic'];
                if (key.includes('_used')) return true;
                return undefined;
            });

            const result = await handle(
                { name: 'Abjuration Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('All Abjuration Savant spells have been used');
        });
    });

    describe('onAbjurationSavantSelected', () => {
        it('should set runtime value with selected spells', async () => {
            const result = await onAbjurationSavantSelected(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Shield',
                'Detect Magic'
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

        it('should reject same spell twice', async () => {
            const result = await onAbjurationSavantSelected(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Shield',
                'Shield'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
        });

        it('should reject missing spells', async () => {
            const result = await onAbjurationSavantSelected(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Shield',
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
        });
    });

    describe('onAbjurationSavantCast', () => {
        it('should mark spell as used', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Abjuration_Savant_selection') return ['Shield', 'Detect Magic'];
                if (key.includes('_used')) return false;
                return undefined;
            });

            const result = await onAbjurationSavantCast(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Shield'
            );

            expect(setRuntimeValue).toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Shield');
            expect(result.payload.description).toContain('no spell slot expended');
        });

        it('should reject casting non-selected spell', async () => {
            getRuntimeValue.mockReturnValue(['Shield']);

            const result = await onAbjurationSavantCast(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Detect Magic'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not an Abjuration Savant spell');
        });

        it('should reject already-used spell', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Abjuration_Savant_selection') return ['Shield'];
                if (key.includes('_used')) return true;
                return undefined;
            });

            const result = await onAbjurationSavantCast(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Shield'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('already been cast');
        });
    });

    describe('onAbjurationSavantLevelUp', () => {
        it('should add new spell to selection', async () => {
            getRuntimeValue.mockReturnValue(['Shield', 'Detect Magic']);
            loadSpells.mockResolvedValue(mockAbjurationSpells);

            const result = await onAbjurationSavantLevelUp(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Mage Armor'
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

            const result = await onAbjurationSavantLevelUp(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Fire Bolt'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not an Abjuration school spell');
        });

        it('should reject null spell', async () => {
            const result = await onAbjurationSavantLevelUp(
                { name: 'Abjuration Savant' },
                mockPlayerStats,
                mockCampaignName,
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('must be selected');
        });
    });
});
