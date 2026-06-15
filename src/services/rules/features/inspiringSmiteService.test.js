import {
    isDivineSmite,
    getInspiringSmitePassives,
    hasInspiringSmite,
} from './inspiringSmiteService.js';

describe('inspiringSmiteService', () => {
    describe('isDivineSmite', () => {
        it('returns true for Divine Smite (case insensitive)', () => {
            expect(isDivineSmite({ name: 'Divine Smite' })).toBe(true);
            expect(isDivineSmite({ name: 'divine smite' })).toBe(true);
            expect(isDivineSmite({ name: 'DIVINE SMITE' })).toBe(true);
        });

        it('returns false for other spells', () => {
            expect(isDivineSmite({ name: 'Burning Hands' })).toBe(false);
            expect(isDivineSmite({ name: 'Thunderwave' })).toBe(false);
        });
    });

    describe('getInspiringSmitePassives', () => {
        it('filters for post_cast_inspiring_smite type passives', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'post_cast_inspiring_smite', name: 'Inspiring Smite' },
                        { type: 'post_cast_smite_cover', name: 'Smite of Protection' },
                        { type: 'passive_buff', name: 'Aura' },
                    ],
                },
            };
            const result = getInspiringSmitePassives(playerStats);
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Inspiring Smite');
        });

        it('returns empty array when no passives', () => {
            const playerStats = { automation: { passives: [] } };
            expect(getInspiringSmitePassives(playerStats)).toHaveLength(0);
        });

        it('returns empty array when no passives key', () => {
            const playerStats = {};
            expect(getInspiringSmitePassives(playerStats)).toHaveLength(0);
        });
    });

    describe('hasInspiringSmite', () => {
        it('returns true when inspiring smite passive exists', () => {
            const playerStats = {
                automation: {
                    passives: [{ type: 'post_cast_inspiring_smite', name: 'Inspiring Smite' }],
                },
            };
            expect(hasInspiringSmite(playerStats)).toBe(true);
        });

        it('returns false when no inspiring smite passive', () => {
            const playerStats = { automation: { passives: [] } };
            expect(hasInspiringSmite(playerStats)).toBe(false);
        });
    });
});
