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

    describe('triggerFeignDeath', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Wizard',
        };

        it('returns null for non-Feign Death spells', async () => {
            const result = await triggerFeignDeath(
                { name: 'Fire Bolt', level: 0 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null for undefined spell name', async () => {
            const result = await triggerFeignDeath(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null for null spell name', async () => {
            const result = await triggerFeignDeath(
                { name: null },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('executes handler for exact case "Feign Death"', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerFeignDeath(
                { name: 'Feign Death', duration: '1 hour' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Feign Death',
                    automation: expect.objectContaining({
                        type: 'feign_death',
                        targetName: 'Wizard',
                        duration: '1 hour',
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles mixed-case "FEIGN DEATH" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerFeignDeath(
                { name: 'FEIGN DEATH', duration: '1 hour' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles lowercase "feign death" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerFeignDeath(
                { name: 'feign death', duration: '1 hour' },
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

        it('falls back to playerStats.name when metaCtx lacks targetName', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFeignDeath(
                { name: 'Feign Death', duration: '1 hour' },
                {},
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

        it('falls back to playerStats.name when metaCtx is undefined', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFeignDeath(
                { name: 'Feign Death', duration: '1 hour' },
                undefined,
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

        it('handles undefined metaCtx.targetName gracefully (targetName falls back to playerStats.name)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerFeignDeath(
                { name: 'Feign Death', duration: '1 hour' },
                { targetName: undefined },
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

        it('returns null when executeHandler throws an error', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerFeignDeath(
                { name: 'Feign Death', duration: '1 hour' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
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
