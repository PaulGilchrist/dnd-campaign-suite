import { handle, onEvocationSavantSelected, onEvocationSavantCast, onEvocationSavantLevelUp } from './evocationSavantHandler.js';
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

const mockEvocationSpells = [
    { name: 'Fire Bolt', school: 'Evocation', level: 0, casting_time: '1 action', range: '60 ft.', description: 'A streak of fire.', damage: '1d10 fire' },
    { name: 'Ray of Sickness', school: 'Evocation', level: 0, casting_time: '1 action', range: '60 ft.', description: 'A sickening ray.', damage: '1d8 poison' },
    { name: 'Magic Missile', school: 'Evocation', level: 1, casting_time: '1 action', range: '120 ft.', description: 'Three glowing darts.', damage: '1d4+1 force' },
    { name: 'Burning Hands', school: 'Evocation', level: 1, casting_time: '1 action', range: 'Self (30 ft. cone)', description: 'A cone of flame.', damage: '3d6 fire' },
    { name: 'Thunderwave', school: 'Evocation', level: 1, casting_time: '1 action', range: 'Self (15 ft. cube)', description: 'A wave of thunder.', damage: '2d8 thunder' },
    { name: 'Scorching Ray', school: 'Evocation', level: 2, casting_time: '1 action', range: '120 ft.', description: 'Three rays of fire.', damage: '2d6 fire each' },
    { name: 'Fireball', school: 'Evocation', level: 3, casting_time: '1 action', range: '150 ft.', description: 'A bright streak of fire.', damage: '8d6 fire' },
];

describe('evocationSavantHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return modal when no spells selected', async () => {
            getRuntimeValue.mockReturnValue([]);
            loadSpells.mockResolvedValue(mockEvocationSpells);

            const result = await handle(
                { name: 'Evocation Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('evocationSavant');
            expect(result.payload.evocationOptions).toEqual(['Fire Bolt', 'Ray of Sickness', 'Magic Missile', 'Burning Hands', 'Thunderwave', 'Scorching Ray']);
            expect(result.payload.selectedSpells).toEqual([]);
        });

        it('should exclude non-Evocation spells', async () => {
            getRuntimeValue.mockReturnValue([]);
            const allSpells = [
                ...mockEvocationSpells,
                { name: 'Shield', school: 'Abjuration', level: 1 },
                { name: 'Detect Magic', school: 'Abjuration', level: 1 },
                { name: 'Fireball', school: 'Evocation', level: 3 },
            ];
            loadSpells.mockResolvedValue(allSpells);

            const result = await handle(
                { name: 'Evocation Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('modal');
            // Fireball is level 3, so excluded (max level 2)
            expect(result.payload.evocationOptions).not.toContain('Fireball');
            // Shield and Detect Magic are not Evocation
            expect(result.payload.evocationOptions).not.toContain('Shield');
            expect(result.payload.evocationOptions).not.toContain('Detect Magic');
        });

        it('should return popup with available spells when some are selected', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Evocation_Savant_selection') return ['Fire Bolt', 'Magic Missile'];
                if (key.includes('_used')) return false;
                return undefined;
            });

            const result = await handle(
                { name: 'Evocation Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.html).toContain('Fire Bolt');
            expect(result.payload.html).toContain('Magic Missile');
        });

        it('should return info popup when all spells used', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Evocation_Savant_selection') return ['Fire Bolt', 'Magic Missile'];
                if (key.includes('_used')) return true;
                return undefined;
            });

            const result = await handle(
                { name: 'Evocation Savant', description: 'Choose two Wizard spells...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('All Evocation Savant spells have been used');
        });
    });

    describe('onEvocationSavantSelected', () => {
        it('should set runtime value with selected spells', async () => {
            const result = await onEvocationSavantSelected(
                { name: 'Evocation Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Fire Bolt',
                'Magic Missile'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Evocation_Savant_selection',
                ['Fire Bolt', 'Magic Missile'],
                mockCampaignName,
                true
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Fire Bolt');
            expect(result.payload.description).toContain('Magic Missile');
        });

        it('should reject same spell twice', async () => {
            const result = await onEvocationSavantSelected(
                { name: 'Evocation Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Fire Bolt',
                'Fire Bolt'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
        });

        it('should reject missing spells', async () => {
            const result = await onEvocationSavantSelected(
                { name: 'Evocation Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Fire Bolt',
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Two different');
        });
    });

    describe('onEvocationSavantCast', () => {
        it('should mark spell as used', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Evocation_Savant_selection') return ['Fire Bolt', 'Magic Missile'];
                if (key.includes('_used')) return false;
                return undefined;
            });

            const result = await onEvocationSavantCast(
                { name: 'Evocation Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Fire Bolt'
            );

            expect(setRuntimeValue).toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Fire Bolt');
            expect(result.payload.description).toContain('no spell slot expended');
        });

        it('should reject casting non-selected spell', async () => {
            getRuntimeValue.mockReturnValue(['Fire Bolt']);

            const result = await onEvocationSavantCast(
                { name: 'Evocation Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Magic Missile'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not an Evocation Savant spell');
        });

        it('should reject already-used spell', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === '_Evocation_Savant_selection') return ['Fire Bolt'];
                if (key.includes('_used')) return true;
                return undefined;
            });

            const result = await onEvocationSavantCast(
                { name: 'Evocation Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Fire Bolt'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('already been cast');
        });
    });

    describe('onEvocationSavantLevelUp', () => {
        it('should add new spell to selection', async () => {
            getRuntimeValue.mockReturnValue(['Fire Bolt', 'Magic Missile']);
            loadSpells.mockResolvedValue(mockEvocationSpells);

            const result = await onEvocationSavantLevelUp(
                { name: 'Evocation Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Scorching Ray'
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                '_Evocation_Savant_selection',
                ['Fire Bolt', 'Magic Missile', 'Scorching Ray'],
                mockCampaignName,
                true
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Scorching Ray');
        });

        it('should reject non-Evocation spell', async () => {
            getRuntimeValue.mockReturnValue(['Fire Bolt']);
            loadSpells.mockResolvedValue([
                ...mockEvocationSpells,
                { name: 'Shield', school: 'Abjuration', level: 1 },
            ]);

            const result = await onEvocationSavantLevelUp(
                { name: 'Evocation Savant' },
                mockPlayerStats,
                mockCampaignName,
                'Shield'
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not an Evocation school spell');
        });

        it('should reject null spell', async () => {
            const result = await onEvocationSavantLevelUp(
                { name: 'Evocation Savant' },
                mockPlayerStats,
                mockCampaignName,
                null
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('must be selected');
        });
    });
});
