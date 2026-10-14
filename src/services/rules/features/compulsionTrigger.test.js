import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerCompulsion } from './compulsionService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext } from '../combat/damageUtils.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

describe('compulsionService triggerCompulsion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence' },
        proficiency: 4,
    };
    const spell = { name: 'Compulsion', level: 4 };

    describe('spell name matching', () => {
        it.each([
            ['Compulsion'],
            ['compulsion'],
            ['COMPULSION'],
            ['cOmPuLsIoN'],
        ])('triggers for "%s" spell name (case-insensitive)', async (name) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            const result = await triggerCompulsion(
                { name, level: 4 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ type: 'popup' });
        });

        it.each([
            'Compulsionary',
            'Compelled',
            'Compulsory',
            'Compulsionary Order',
            '',
            undefined,
            null,
        ])('returns null for non-Compulsion spell: "%s"', async (name) => {
            const result = await triggerCompulsion(
                { name, level: 1 },
                {},
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });
    });

    describe('target resolution', () => {
        it('uses metaCtx.targetName when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerCompulsion(
                spell,
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Goblin' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('returns popup when no targetName and no combat context', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await triggerCompulsion(
                spell,
                { targetName: null },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Compulsion',
                    description: 'No target selected for Compulsion.',
                },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns popup when no targetName and empty creatures list', async () => {
            getCombatContext.mockResolvedValue({ creatures: [] });

            const result = await triggerCompulsion(
                spell,
                { targetName: null },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Compulsion',
                    description: 'No target selected for Compulsion.',
                },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('auto-selects first creature from combat context when targetName is missing', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc' }],
            });

            const result = await triggerCompulsion(
                spell,
                { targetName: null },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup' });
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Goblin' }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('selects first creature even when it matches the caster name (advantage:false)', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Wizard', type: 'player' }],
            });

            const result = await triggerCompulsion(
                spell,
                { targetName: null },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Wizard', advantage: false }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup' });
        });
    });

    describe('advantage logic', () => {
        it('sets advantage:true when target is in combat and not the caster', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wizard', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });

            await triggerCompulsion(
                spell,
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ advantage: true }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('sets advantage:false when target is the caster', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wizard', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });

            await triggerCompulsion(
                spell,
                { targetName: 'Wizard' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ advantage: false }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('sets advantage:false when target is not in combat context', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc' }],
            });

            await triggerCompulsion(
                spell,
                { targetName: 'UnknownTarget' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ advantage: false }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('sets advantage:false when combat context is null', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue(null);

            await triggerCompulsion(
                spell,
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ advantage: false }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });
    });

    describe('save DC resolution', () => {
        it('uses metaCtx.spellSaveDc when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await triggerCompulsion(
                spell,
                { targetName: 'Goblin', spellSaveDc: 18 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 18 }),
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to playerStats.spellAbilities.saveDc', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await triggerCompulsion(
                spell,
                { targetName: 'Goblin' },
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

        it('computes saveDc from proficiency when spellAbilities is missing', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
            const stats = { name: 'Wizard', proficiency: 3 };

            await triggerCompulsion(
                spell,
                { targetName: 'Goblin' },
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

        it('uses default saveDc of 10 when stats are minimal', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await triggerCompulsion(
                spell,
                { targetName: 'Goblin' },
                {},
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: 10 }),
                }),
                {},
                campaignName,
                mapName,
            );
        });
    });

    describe('slot level resolution', () => {
        it('uses metaCtx.slotLevel when provided', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await triggerCompulsion(
                spell,
                { targetName: 'Goblin', slotLevel: 5 },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: 5 }),
                playerStats,
                campaignName,
                mapName,
            );
        });

        it('falls back to spell.level when metaCtx has no slotLevel', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await triggerCompulsion(
                spell,
                { targetName: 'Goblin' },
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

        it('defaults slotLevel to 4 when neither metaCtx nor spell has level', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await triggerCompulsion(
                { name: 'Compulsion' },
                { targetName: 'Goblin' },
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
    });

    describe('action structure', () => {
        it('constructs action with correct type and fields', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await triggerCompulsion(
                spell,
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Compulsion',
                    automation: expect.objectContaining({
                        type: 'compulsion',
                        saveDc: 15,
                        targetName: 'Goblin',
                        advantage: true,
                    }),
                    spell,
                    spellSlotLevel: 4,
                }),
                playerStats,
                campaignName,
                mapName,
            );
        });
    });

    describe('return value', () => {
        it('returns result from executeHandler on success', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Compulsion', description: 'Compulsion affects target.' },
            };
            executeHandler.mockResolvedValue(expectedResult);
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            const result = await triggerCompulsion(
                spell,
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBe(expectedResult);
        });

        it('returns null when executeHandler returns null', async () => {
            executeHandler.mockResolvedValue(null);
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            const result = await triggerCompulsion(
                spell,
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns error popup when executeHandler throws', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            const result = await triggerCompulsion(
                spell,
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Compulsion',
                    description: 'Failed to execute Compulsion.',
                },
            });
        });
    });

    describe('metaCtx handling', () => {
        it.each([null, undefined])('handles %s metaCtx gracefully', async (metaCtx) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            const result = await triggerCompulsion(
                spell,
                metaCtx,
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
        });

        it('handles metaCtx with only partial fields', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });

            await triggerCompulsion(
                spell,
                { targetName: 'Goblin' },
                playerStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalled();
        });
    });
});
