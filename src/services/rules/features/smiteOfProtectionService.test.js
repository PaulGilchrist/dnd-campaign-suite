// @improved-by-ai
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
        it('returns true for exact case match', () => {
            expect(isDivineSmite({ name: 'Divine Smite' })).toBe(true);
        });

        it('returns true for lowercase', () => {
            expect(isDivineSmite({ name: 'divine smite' })).toBe(true);
        });

        it('returns true for mixed case', () => {
            expect(isDivineSmite({ name: 'DiViNe SmItE' })).toBe(true);
        });

        it('returns false for similar but different spell name', () => {
            expect(isDivineSmite({ name: 'Divine Shield' })).toBe(false);
        });

        it('returns false for other spells', () => {
            expect(isDivineSmite({ name: 'Burning Hands' })).toBe(false);
        });

        it('returns false when spell object has no name property', () => {
            expect(isDivineSmite({})).toBe(false);
        });

        it('throws when spell is null', () => {
            expect(() => isDivineSmite(null)).toThrow();
        });
    });

    describe('getSmiteOfProtectionPassives', () => {
        it('returns only post_cast_smite_cover passives', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'post_cast_smite_cover', name: 'Smite of Protection' },
                        { type: 'passive_buff', name: 'Aura of Protection' },
                        { type: 'post_cast_smite_cover', name: 'Another Smite' },
                    ],
                },
            };
            const result = getSmiteOfProtectionPassives(playerStats);
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Smite of Protection');
            expect(result[1].name).toBe('Another Smite');
        });

        it('returns empty array when no smite passives exist', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'passive_buff', name: 'Aura of Protection' },
                    ],
                },
            };
            expect(getSmiteOfProtectionPassives(playerStats)).toEqual([]);
        });

        it('throws when automation.passives is missing', () => {
            expect(() => getSmiteOfProtectionPassives({})).toThrow('Expected array, got undefined');
        });

        it('throws when automation.passives is null', () => {
            expect(() => getSmiteOfProtectionPassives({ automation: { passives: null } })).toThrow('Expected array, got null');
        });

        it('throws when automation is missing', () => {
            expect(() => getSmiteOfProtectionPassives({ automation: {} })).toThrow('Expected array, got undefined');
        });
    });

    describe('hasSmiteOfProtection', () => {
        it('returns true when player has at least one smite passive', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'post_cast_smite_cover', name: 'Smite of Protection' },
                    ],
                },
            };
            expect(hasSmiteOfProtection(playerStats)).toBe(true);
        });

        it('returns true when player has multiple smite passives', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'post_cast_smite_cover', name: 'Smite of Protection' },
                        { type: 'post_cast_smite_cover', name: 'Another Smite' },
                    ],
                },
            };
            expect(hasSmiteOfProtection(playerStats)).toBe(true);
        });

        it('returns false when passives array is empty', () => {
            const playerStats = {
                automation: {
                    passives: [],
                },
            };
            expect(hasSmiteOfProtection(playerStats)).toBe(false);
        });

        it('returns false when passives array has non-smite entries only', () => {
            const playerStats = {
                automation: {
                    passives: [
                        { type: 'passive_buff', name: 'Aura of Protection' },
                    ],
                },
            };
            expect(hasSmiteOfProtection(playerStats)).toBe(false);
        });
    });

    describe('triggerSmiteOfProtection', () => {
        const campaignName = 'test';

        const makePlayerStats = (passives = [{ type: 'post_cast_smite_cover', name: 'Smite of Protection' }]) => ({
            name: 'Paladin',
            automation: { passives },
        });

        const makeSpell = (overrides = {}) => ({ name: 'Divine Smite', level: 1, ...overrides });

        const makeMetaCtx = (overrides = {}) => ({ slotLevel: 1, ...overrides });

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('triggers executeHandler for each smite passive when Divine Smite is cast with slot', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSmiteOfProtection(
                makeSpell(),
                makeMetaCtx(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'post_cast_smite_cover', casting_time: 'passive' },
                }),
                expect.any(Object),
                campaignName,
                null,
            );
            expect(result).toEqual([{ type: 'popup' }]);
        });

        it('triggers executeHandler for each smite passive when Divine Smite is cast with spell level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSmiteOfProtection(
                makeSpell({ level: 1 }),
                makeMetaCtx({ slotLevel: 0 }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(result).toEqual([{ type: 'popup' }]);
        });

        it('returns null when spell level is 0 and slotLevel is 0', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSmiteOfProtection(
                makeSpell({ level: 0 }),
                makeMetaCtx({ slotLevel: 0 }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell is not Divine Smite', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSmiteOfProtection(
                { name: 'Burning Hands', level: 1 },
                makeMetaCtx(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when player has no smite passives', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSmiteOfProtection(
                makeSpell(),
                makeMetaCtx(),
                makePlayerStats([]),
                campaignName,
                null,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when metaCtx and spell have no valid level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSmiteOfProtection(
                makeSpell({ level: 0 }),
                makeMetaCtx({ slotLevel: 0 }),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when metaCtx is null and spell level is 0', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSmiteOfProtection(
                makeSpell({ level: 0 }),
                null,
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when metaCtx is undefined and spell level is 0', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSmiteOfProtection(
                makeSpell({ level: 0 }),
                undefined,
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('calls executeHandler for each smite passive when multiple exist', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerSmiteOfProtection(
                makeSpell(),
                makeMetaCtx(),
                makePlayerStats([
                    { type: 'post_cast_smite_cover', name: 'Smite of Protection' },
                    { type: 'post_cast_smite_cover', name: 'Another Smite' },
                ]),
                campaignName,
                null,
            );

            expect(executeHandler).toHaveBeenCalledTimes(2);
            expect(result).toEqual([{ type: 'popup' }, { type: 'popup' }]);
        });

        it('skips null results from executeHandler', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerSmiteOfProtection(
                makeSpell(),
                makeMetaCtx(),
                makePlayerStats(),
                campaignName,
                null,
            );

            expect(result).toBeNull();
        });

        it('passes mapName to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSmiteOfProtection(
                makeSpell(),
                makeMetaCtx(),
                makePlayerStats(),
                campaignName,
                'map1',
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                expect.any(Object),
                campaignName,
                'map1',
            );
        });

        it('uses smiteCover.casting_time when present', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerSmiteOfProtection(
                makeSpell(),
                makeMetaCtx(),
                makePlayerStats([{ type: 'post_cast_smite_cover', name: 'Smite', casting_time: '1 action' }]),
                campaignName,
                null,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'post_cast_smite_cover', casting_time: '1 action' },
                }),
                expect.any(Object),
                campaignName,
                null,
            );
        });
    });
});
