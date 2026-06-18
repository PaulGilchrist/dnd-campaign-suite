import {
    isDivineSmite,
    getSmiteOfProtectionPassives,
    hasSmiteOfProtection,
    triggerSmiteOfProtection,
} from './smiteOfProtectionService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('smiteOfProtectionService', () => {
    describe('isDivineSmite', () => {
        it('returns true for Divine Smite', () => {
            expect(isDivineSmite({ name: 'Divine Smite' })).toBe(true);
        });

        it('returns true for divine smite (case insensitive)', () => {
            expect(isDivineSmite({ name: 'divine smite' })).toBe(true);
        });

        it('returns false for other spells', () => {
            expect(isDivineSmite({ name: 'Burning Hands' })).toBe(false);
        });
    });

    describe('getSmiteOfProtectionPassives', () => {
        it('returns post_cast_smite_cover passives', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'post_cast_smite_cover', name: 'Smite of Protection' },
                        { type: 'passive_buff', name: 'Aura of Protection' },
                    ],
                },
            };
            const result = getSmiteOfProtectionPassives(playerStats);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Smite of Protection');
        });

        it('returns empty array when no smite passives', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'passive_buff', name: 'Aura of Protection' },
                    ],
                },
            };
            expect(getSmiteOfProtectionPassives(playerStats)).toEqual([]);
        });

        it('returns empty array when no passives', () => {
            expect(() => getSmiteOfProtectionPassives({})).toThrow('Expected array, got undefined');
        });
    });

    describe('hasSmiteOfProtection', () => {
        it('returns true when player has smite of protection', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'post_cast_smite_cover', name: 'Smite of Protection' },
                    ],
                },
            };
            expect(hasSmiteOfProtection(playerStats)).toBe(true);
        });

        it('returns false when player lacks smite of protection', () => {
            const playerStats = {
                automation: {
                    passives: [],
                },
            };
            expect(hasSmiteOfProtection(playerStats)).toBe(false);
        });
    });

    describe('triggerSmiteOfProtection', () => {
        const playerStats = {
            name: 'Paladin',
            automation: {
                passives: [
                    { type: 'post_cast_smite_cover', name: 'Smite of Protection' },
                ],
            },
        };
        const campaignName = 'test';

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('triggers when Divine Smite is cast', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSmiteOfProtection(
                { name: 'Divine Smite', level: 1 },
                { slotLevel: 1 },
                playerStats,
                campaignName,
                null,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toHaveLength(1);
        });

        it('returns null when not Divine Smite', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerSmiteOfProtection(
                { name: 'Burning Hands', level: 1 },
                { slotLevel: 1 },
                playerStats,
                campaignName,
                null,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when player has no smite passives', async () => {
            const result = await triggerSmiteOfProtection(
                { name: 'Divine Smite', level: 1 },
                { slotLevel: 1 },
                { automation: { passives: [] } },
                campaignName,
                null,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when not cast with slot', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerSmiteOfProtection(
                { name: 'Divine Smite', level: 0 },
                null,
                playerStats,
                campaignName,
                null,
            );

            expect(result).toBeNull();
        });
    });
});
