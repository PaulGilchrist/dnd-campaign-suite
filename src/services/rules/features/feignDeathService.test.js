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
    const playerStats = { name: 'Wizard' };

    describe('triggerFeignDeath', () => {
        it.each([
            { name: 'Fire Bolt', level: 0 },
            { name: null },
            { name: undefined },
            {},
        ])('returns null for non-Feign Death spell: $name', async (spell) => {
            const result = await triggerFeignDeath(spell, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it.each(['fEiGn dEaTh', 'feign death', 'FEIGN DEATH'])('matches "%s" case-insensitively', async (name) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const result = await triggerFeignDeath({ name, duration: '1 hour' }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('uses metaCtx.targetName when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerFeignDeath({ name: 'Feign Death', duration: '1 hour' }, { targetName: 'Fighter' }, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ targetName: 'Fighter' }) }),
                playerStats, campaignName, mapName,
            );
        });

        it.each([
            { metaCtx: {}, label: 'empty object' },
            { metaCtx: { targetName: undefined }, label: 'targetName undefined' },
            { metaCtx: null, label: 'null' },
            { metaCtx: undefined, label: 'undefined' },
            { metaCtx: {}, label: 'no targetName property' },
        ])('falls back to playerStats.name when metaCtx is $label', async ({ metaCtx }) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerFeignDeath({ name: 'Feign Death', duration: '1 hour' }, metaCtx, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ targetName: 'Wizard' }) }),
                playerStats, campaignName, mapName,
            );
        });

        it.each([
            { spell: { name: 'Feign Death', duration: '8 hours' }, expected: '8 hours' },
            { spell: { name: 'Feign Death' }, expected: '1 hour' },
        ])('uses spell.duration "%s" or defaults to "1 hour"', async ({ spell, expected }) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            await triggerFeignDeath(spell, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ duration: expected }) }),
                playerStats, campaignName, mapName,
            );
        });

        it('returns handler result on success, null when handler returns null or throws', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Feign Death', description: 'The target appears dead.' },
            };
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            executeHandler.mockResolvedValue(expectedResult);
            let result = await triggerFeignDeath({ name: 'Feign Death', duration: '1 hour' }, {}, playerStats, campaignName, mapName);
            expect(result).toBe(expectedResult);

            executeHandler.mockResolvedValue(null);
            result = await triggerFeignDeath({ name: 'Feign Death', duration: '1 hour' }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();

            executeHandler.mockRejectedValue(new Error('Handler failed'));
            result = await triggerFeignDeath({ name: 'Feign Death', duration: '1 hour' }, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[feignDeath] Failed to execute Feign Death handler:',
                expect.any(Error),
            );

            consoleSpy.mockRestore();
        });
    });
});
