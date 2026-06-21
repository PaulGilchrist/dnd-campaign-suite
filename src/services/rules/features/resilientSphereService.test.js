// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerResilientSphere } from './resilientSphereService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('resilientSphereService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('triggerResilientSphere', () => {
        const campaignName = 'TestCampaign';
        const mapName = 'testMap';
        const playerStats = {
            name: 'Wizard',
            spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
            proficiency: 4,
        };

        it('returns null for non-matching spell names', async () => {
            const result = await triggerResilientSphere(
                { name: 'Fire Ball', level: 3 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null for empty spell name', async () => {
            const result = await triggerResilientSphere(
                { name: '', level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell object has no name property', async () => {
            const result = await triggerResilientSphere(
                { level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('matches spell name case-insensitively for full and short names', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const spellNames = [
                "Otiluke's Resilient Sphere",
                "otiluke's resilient sphere",
                "OTILUKE'S RESILIENT SPHERE",
                "resilient sphere",
                'Resilient Sphere',
                'RESILIENT SPHERE',
            ];

            for (const name of spellNames) {
                vi.clearAllMocks();
                executeHandler.mockResolvedValue({ type: 'popup' });

                await triggerResilientSphere(
                    { name, level: 4 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalled();
            }
        });

        it('throws when spell is undefined', async () => {
            await expect(
                triggerResilientSphere(
                    undefined,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow("Cannot read properties of undefined (reading 'name')");
        });

        it('throws when spell is null', async () => {
            await expect(
                triggerResilientSphere(
                    null,
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                )
            ).rejects.toThrow("Cannot read properties of null (reading 'name')");
        });

        it('executes handler with correct automation payload using playerStats saveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerResilientSphere(
                { name: "Otiluke's Resilient Sphere", level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: "Otiluke's Resilient Sphere",
                    automation: {
                        type: 'resilient_sphere',
                        saveDc: 15,
                        saveType: 'DEX',
                    },
                    spellSlotLevel: 4,
                    spell: expect.objectContaining({
                        name: "Otiluke's Resilient Sphere",
                        level: 4,
                    }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses metaCtx spellSaveDc when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 4 },
                { spellSaveDc: 18, slotLevel: 5 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 18 }),
                    spellSlotLevel: 5,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats spellAbilities saveDc when metaCtx lacks it', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 15 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('computes saveDc from proficiency when no spellAbilities.saveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard', proficiency: 3 };

            await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 4 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 11 }),
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('uses default proficiency of 2 when not available', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const stats = { name: 'Wizard' };

            await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 4 },
                {},
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 10 }),
                }),
                stats,
                campaignName,
                mapName,
            );
        });

        it('prefers metaCtx slotLevel over spell.level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 4 },
                { spellSaveDc: 15, slotLevel: 6 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 6 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses spell.level as fallback when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 6 },
                { spellSaveDc: 17 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 6 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('uses default slotLevel of 4 when neither metaCtx nor spell has level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerResilientSphere(
                { name: 'Resilient Sphere' },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 4 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes the original spell object into the action', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const spell = { name: 'Resilient Sphere', level: 4, school: 'Evocation' };

            await triggerResilientSphere(spell, {}, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('passes campaignName and mapName as-is to executeHandler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Resilient Sphere', description: 'A sphere...' },
            };
            executeHandler.mockResolvedValue(expectedResult);

            const result = await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns null and logs error when executeHandler throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[resilientSphereService] Failed to execute'),
                expect.any(Error),
            );
            consoleSpy.mockRestore();
        });

        it('handles undefined metaCtx gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 4 },
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup' });
            expect(executeHandler).toHaveBeenCalled();
        });

        it('handles null metaCtx gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 4 },
                null,
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup' });
            expect(executeHandler).toHaveBeenCalled();
        });
    });
});
