// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerFeignDeath } from './feignDeathService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('feignDeathService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
    };

    describe('triggerFeignDeath', () => {
        it.each([
            { name: 'Fire Bolt', level: 0 },
            { name: null },
            { name: undefined },
            {},
        ])('returns null for non-Feign Death spell: $name', async (spell) => {
            const result = await triggerFeignDeath(
                spell,
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('matches spell name case-insensitively', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerFeignDeath(
                { name: 'fEiGn dEaTh', duration: '1 hour' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('uses metaCtx.targetName when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFeignDeath(
                { name: 'Feign Death', duration: '1 hour' },
                { targetName: 'Fighter' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Fighter' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it.each([
            {},
            { targetName: undefined },
            null,
            undefined,
        ])('falls back to playerStats.name when metaCtx is %s', async (metaCtx) => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFeignDeath(
                { name: 'Feign Death', duration: '1 hour' },
                metaCtx,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Wizard' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.duration in the automation', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFeignDeath(
                { name: 'Feign Death', duration: '8 hours' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ duration: '8 hours' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('defaults duration to "1 hour" when spell.duration is missing', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFeignDeath(
                { name: 'Feign Death' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ duration: '1 hour' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Feign Death', description: 'The target appears dead.' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerFeignDeath(
                { name: 'Feign Death', duration: '1 hour' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerFeignDeath(
                { name: 'Feign Death', duration: '1 hour' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null and logs error when executeHandler throws', async () => {
            const spy = vi.spyOn(console, 'error').mockReturnValue();
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerFeignDeath(
                { name: 'Feign Death', duration: '1 hour' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                '[feignDeath] Failed to execute Feign Death handler:',
                expect.any(Error),
            );
            spy.mockRestore();
        });

        it('passes the spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Feign Death', duration: '1 hour', level: 3, school: 'Necromancy' };

            await triggerFeignDeath(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });
    });
});
