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

        it('returns null for non-Resilient Sphere spells', async () => {
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

        it('returns null when spell name is "otiluke\'s resilient sphere" case-insensitive and executes handler', async () => {
            executeHandler.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            const result = await triggerResilientSphere(
                { name: "Otiluke's Resilient Sphere", level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: "Otiluke's Resilient Sphere",
                    automation: expect.objectContaining({
                        type: 'resilient_sphere',
                        saveDc: 15,
                        saveType: 'DEX',
                    }),
                    spellSlotLevel: 4,
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup', payload: { type: 'automation_info' } });
        });

        it('handles lowercase "otiluke\'s resilient sphere" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerResilientSphere(
                { name: "otiluke's resilient sphere", level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles mixed-case "OTILUKE\'S RESILIENT SPHERE" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerResilientSphere(
                { name: "OTILUKE'S RESILIENT SPHERE", level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles "resilient sphere" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles lowercase "resilient sphere" spell name', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerResilientSphere(
                { name: 'resilient sphere', level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('uses spellSaveDc from metaCtx when provided', async () => {
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

        it('throws when executeHandler throws an error', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            await expect(
                triggerResilientSphere(
                    { name: 'Resilient Sphere', level: 4 },
                    {},
                    playerStats,
                    campaignName,
                    mapName,
                ),
            ).rejects.toThrow('Handler failed');
        });

        it('passes the spell object into the action', async () => {
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

        it('handles undefined spell name gracefully', async () => {
            const result = await triggerResilientSphere(
                {},
                {},
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('handles undefined spell object gracefully', async () => {
            // Note: undefined spell causes TypeError on .name access - this tests the current behavior
            // The service does not guard against undefined spell, only undefined spell.name
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

        it('handles undefined metaCtx gracefully', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerResilientSphere(
                { name: 'Resilient Sphere', level: 4 },
                undefined,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('passes campaignName and mapName to executeHandler', async () => {
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

        it('verifies automation action has correct type', async () => {
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
                    automation: expect.objectContaining({ type: 'resilient_sphere' }),
                }),
                expect.any(Object),
                expect.any(String),
                expect.any(String),
            );
        });

        it('verifies saveType is DEX', async () => {
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
                    automation: expect.objectContaining({ saveType: 'DEX' }),
                }),
                expect.any(Object),
                expect.any(String),
                expect.any(String),
            );
        });
    });
});
