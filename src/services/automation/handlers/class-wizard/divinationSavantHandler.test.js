import { handle, onDivinationSavantSelected, onDivinationSavantCast, onDivinationSavantLevelUp } from './divinationSavantHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/useRuntimeState.js';
import { loadSpells } from '../../../ui/dataLoader.js';

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
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

const mockDivinationSpells = [
    { name: 'Detect Magic', school: 'Divination', level: 1, casting_time: '1 action', range: 'Self', description: 'Detect creatures or objects with magic.', damage: null },
    { name: 'Identify', school: 'Divination', level: 1, casting_time: '1 action', range: 'Touch', description: 'Learn properties of an object.', damage: null },
    { name: 'Augury', school: 'Divination', level: 2, casting_time: '1 minute', range: 'Self', description: 'See brief omens of future events.', damage: null },
    { name: 'Divining Mark', school: 'Divination', level: 2, casting_time: '1 action', range: 'Self', description: 'Mark a creature for divination.', damage: null },
    { name: 'Divination', school: 'Divination', level: 4, casting_time: '1 minute', range: 'Self', description: 'Gain information about a time, place, or person.', damage: null },
];

describe('divinationSavantHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return modal when no spells selected', async () => {
            getRuntimeValue.mockReturnValue([]);
            loadSpells.mockResolvedValue(mockDivinationSpells);

            const result = await handle(
                { name: 'Divination Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('divinationSavant');
            expect(result.payload.divinationOptions).toEqual(['Detect Magic', 'Identify', 'Augury', 'Divining Mark']);
            expect(result.payload.selectedSpells).toEqual([]);
        });

        it('should exclude non-Divination spells', async () => {
            getRuntimeValue.mockReturnValue([]);
            const allSpells = [
                ...mockDivinationSpells,
                { name: 'Fire Bolt', school: 'Evocation', level: 0 },
                { name: 'Magic Missile', school: 'Evocation', level: 1 },
                { name: 'Divination', school: 'Divination', level: 4 },
            ];
            loadSpells.mockResolvedValue(allSpells);

            const result = await handle(
                { name: 'Divination Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('modal');
            // Divination is level 4, so excluded (max level 2)
            expect(result.payload.divinationOptions).not.toContain('Divination');
            // Fire Bolt and Magic Missile are not Divination
            expect(result.payload.divinationOptions).not.toContain('Fire Bolt');
            expect(result.payload.divinationOptions).not.toContain('Magic Missile');
        });

        it('should return popup with available spells when some are selected', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Divination_Savant_selection') return ['Detect Magic', 'Identify'];
                if (key.includes('_used')) return false;
                return undefined;
            });

            const result = await handle(
                { name: 'Divination Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.html).toContain('Detect Magic');
            expect(result.payload.html).toContain('Identify');
        });

        it('should return info popup when all spells used', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Divination_Savant_selection') return ['Detect Magic', 'Identify'];
                if (key.includes('_used')) return true;
                return undefined;
            });

            const result = await handle(
                { name: 'Divination Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('All Divination Savant spells have been used');
        });
    });

    describe('onDivinationSavantSelected', () => {
        it('should set runtime value with selected spells', async () => {
            const result = await onDivinationSavantSelected(
                { name: 'Divination Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Detect Magic',
                'Identify'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Divination_Savant_selection',
                ['Detect Magic', 'Identify'],
                mockCampaignName,
                true
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Detect Magic');
            expect(result.payload.description).toContain('Identify');
        });

        it('should reject same spell twice', async () => {
            const result = await onDivinationSavantSelected(
                { name: 'Divination Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Detect Magic',
                'Detect Magic'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
        });

        it('should reject missing spells', async () => {
            const result = await onDivinationSavantSelected(
                { name: 'Divination Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Detect Magic',
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
        });
    });

    describe('onDivinationSavantCast', () => {
        it('should mark spell as used', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Divination_Savant_selection') return ['Detect Magic', 'Identify'];
                if (key.includes('_used')) return false;
                return undefined;
            });

            const result = await onDivinationSavantCast(
                { name: 'Divination Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Detect Magic'
            );

            expect(setRuntimeValue).toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Detect Magic');
            expect(result.payload.description).toContain('no spell slot expended');
        });

        it('should reject casting non-selected spell', async () => {
            getRuntimeValue.mockReturnValue(['Detect Magic']);

            const result = await onDivinationSavantCast(
                { name: 'Divination Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Identify'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not a Divination Savant spell');
        });

        it('should reject already-used spell', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Divination_Savant_selection') return ['Detect Magic'];
                if (key.includes('_used')) return true;
                return undefined;
            });

            const result = await onDivinationSavantCast(
                { name: 'Divination Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Detect Magic'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('already been cast');
        });
    });

    describe('onDivinationSavantLevelUp', () => {
        it('should add new spell to selection', async () => {
            getRuntimeValue.mockReturnValue(['Detect Magic', 'Identify']);
            loadSpells.mockResolvedValue(mockDivinationSpells);

            const result = await onDivinationSavantLevelUp(
                { name: 'Divination Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Augury'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Divination_Savant_selection',
                ['Detect Magic', 'Identify', 'Augury'],
                mockCampaignName,
                true
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Augury');
        });

        it('should reject non-Divination spell', async () => {
            getRuntimeValue.mockReturnValue(['Detect Magic']);
            loadSpells.mockResolvedValue([
                ...mockDivinationSpells,
                { name: 'Fire Bolt', school: 'Evocation', level: 0 },
            ]);

            const result = await onDivinationSavantLevelUp(
                { name: 'Divination Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Fire Bolt'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not a Divination school spell');
        });

        it('should reject null spell', async () => {
            const result = await onDivinationSavantLevelUp(
                { name: 'Divination Savant' },
                mockPlayerStats,
                mockCampaignName,
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('must be selected');
        });
    });
});
