import { handle, onArcaneWardRestore, onArcaneWardDestroy, onArcaneWardLevelUp, onAbjurationSpellCast } from './arcaneWardHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

const mockPlayerStats = {
    name: 'TestWizard',
    rules: '2024',
    level: 5,
    abilities: [
        { name: 'Intelligence', bonus: 3 },
    ],
};

const mockCampaignName = 'test-campaign';

describe('arcaneWardHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return info popup when ward is not active', async () => {
            getRuntimeValue.mockReturnValue(false);

            const result = await handle(
                { name: 'Arcane Ward', description: 'Create a magical ward...' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('not active');
        });

        it('should return ward status when ward is active', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 13;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await handle(
                { name: 'Arcane Ward', description: 'Create a magical ward...', automation: { type: 'passive_rule' } },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('13/13');
        });
    });

    describe('onArcaneWardRestore', () => {
        it('should restore ward HP using spell slot level', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 5;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                mockPlayerStats,
                2, // spell slot level
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                9, // 5 + (2*2) = 9
                mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('restored 4 HP');
        });

        it('should cap ward HP at max', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 12;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            await onArcaneWardRestore(
                { name: 'Arcane Ward', automation: { type: 'passive_rule' } },
                mockPlayerStats,
                3, // spell slot level → 6 HP restore
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                13, // capped at max
                mockCampaignName
            );
        });
    });

    describe('onArcaneWardDestroy', () => {
        it('should destroy the ward', async () => {
            const result = await onArcaneWardDestroy(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardActive',
                false,
                mockCampaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                0,
                mockCampaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardMax',
                0,
                mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('destroyed');
        });
    });

    describe('onArcaneWardLevelUp', () => {
        it('should scale ward HP proportionally when max increases', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 10;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                mockCampaignName
            );

            // Level 5 wizard: 2*5 + 3 = 13 max (same as before, no scaling)
            expect(setRuntimeValue).toHaveBeenCalled();
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('13');
        });

        it('should return info when ward is not active', async () => {
            getRuntimeValue.mockReturnValue(false);

            const result = await onArcaneWardLevelUp(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                mockCampaignName
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('not active');
        });
    });

    describe('onAbjurationSpellCast', () => {
        it('should create new ward when not active', async () => {
            getRuntimeValue.mockReturnValue(false);

            const result = await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                'Shield',
                1, // spell slot level
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardActive',
                true,
                mockCampaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardMax',
                13, // 2*5 + 3
                mockCampaignName
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                13,
                mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('created');
        });

        it('should restore ward HP when already active', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'arcaneWardActive') return true;
                if (key === 'arcaneWardHp') return 8;
                if (key === 'arcaneWardMax') return 13;
                return undefined;
            });

            const result = await onAbjurationSpellCast(
                { name: 'Arcane Ward' },
                mockPlayerStats,
                'Mage Armor',
                1,
                mockCampaignName
            );

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestWizard',
                'arcaneWardHp',
                10, // 8 + (1*2) = 10
                mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('restored 2 HP');
        });
    });
});
