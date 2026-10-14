import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerCrownOfMadness } from './crownOfMadnessService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from "../combat/damageUtils.js";
import { getMonsterData } from '../../npcs/monsterUtils.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
}));

describe('crownOfMadnessService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const baseSpell = { name: 'Crown of Madness' };
    const baseStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence' },
        proficiency: 4,
    };

    describe('triggerCrownOfMadness', () => {
        describe('spell name matching', () => {
            it.each([
                ['Crown of Madness'],
                ['crown of madness'],
                ['CROWN OF MADNESS'],
                ['CrOwN oF mAdNeSs'],
            ])('triggers for "%s" spell name (case-insensitive)', async (name) => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

                const result = await triggerCrownOfMadness(
                    { name, level: 2 },
                    {},
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledTimes(1);
                expect(result).toEqual({ type: 'popup' });
            });

            it.each([
                'Crown of Sorrow',
                'Madness',
                'Crown',
                'Burning Hands',
                '',
                undefined,
                null,
            ])('returns null for non-Crown of Madness spell: "%s"', async (name) => {
                const result = await triggerCrownOfMadness(
                    { name, level: 1 },
                    {},
                    baseStats,
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

                await triggerCrownOfMadness(
                    baseSpell,
                    { targetName: 'Goblin' },
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        automation: expect.objectContaining({ targetName: 'Goblin' }),
                    }),
                    baseStats,
                    campaignName,
                    mapName,
                );
            });

            it('returns popup when no targetName and no combat context', async () => {
                getCombatContext.mockResolvedValue(null);

                const result = await triggerCrownOfMadness(
                    baseSpell,
                    { targetName: null },
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Crown of Madness',
                        description: 'No target selected for Crown of Madness.',
                    },
                });
                expect(executeHandler).not.toHaveBeenCalled();
            });

            it('returns popup when no targetName and empty creatures list', async () => {
                getCombatContext.mockResolvedValue({ creatures: [] });

                const result = await triggerCrownOfMadness(
                    baseSpell,
                    { targetName: null },
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Crown of Madness',
                        description: 'No target selected for Crown of Madness.',
                    },
                });
                expect(executeHandler).not.toHaveBeenCalled();
            });

            it('logs error when no target selected from combat context when targetName is missing', async () => {
                getCombatContext.mockResolvedValue({
                    creatures: [
                        { name: 'Wizard', type: 'player' },
                        { name: 'Goblin', type: 'npc' },
                    ],
                });
                getTargetFromAttacker.mockReturnValue(null);
                const consoleSpy = vi.spyOn(console, 'error');

                const result = await triggerCrownOfMadness(
                    baseSpell,
                    { targetName: null },
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('[crownOfMadnessService] No target selected for Crown of Madness'),
                );
                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Crown of Madness',
                        description: 'No target selected for Crown of Madness.',
                    },
                });
                expect(executeHandler).not.toHaveBeenCalled();
                consoleSpy.mockRestore();
            });

            it('returns popup when all creatures match the caster name', async () => {
                getCombatContext.mockResolvedValue({
                    creatures: [
                        { name: 'Wizard', type: 'player' },
                        { name: 'Wizard', type: 'npc' },
                    ],
                });

                const result = await triggerCrownOfMadness(
                    baseSpell,
                    { targetName: null },
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Crown of Madness',
                        description: 'No target selected for Crown of Madness.',
                    },
                });
                expect(executeHandler).not.toHaveBeenCalled();
            });

            it('logs error when metaCtx is null', async () => {
                getCombatContext.mockResolvedValue({
                    creatures: [{ name: 'Goblin', type: 'npc' }],
                });
                getTargetFromAttacker.mockReturnValue(null);
                const consoleSpy = vi.spyOn(console, 'error');

                const result = await triggerCrownOfMadness(
                    baseSpell,
                    null,
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('[crownOfMadnessService] No target selected for Crown of Madness'),
                );
                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Crown of Madness',
                        description: 'No target selected for Crown of Madness.',
                    },
                });
                expect(executeHandler).not.toHaveBeenCalled();
                consoleSpy.mockRestore();
            });

            it('logs error when metaCtx is undefined', async () => {
                getCombatContext.mockResolvedValue({
                    creatures: [{ name: 'Goblin', type: 'npc' }],
                });
                getTargetFromAttacker.mockReturnValue(null);
                const consoleSpy = vi.spyOn(console, 'error');

                const result = await triggerCrownOfMadness(
                    baseSpell,
                    undefined,
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('[crownOfMadnessService] No target selected for Crown of Madness'),
                );
                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Crown of Madness',
                        description: 'No target selected for Crown of Madness.',
                    },
                });
                expect(executeHandler).not.toHaveBeenCalled();
                consoleSpy.mockRestore();
            });

            it('logs error when metaCtx is empty', async () => {
                getCombatContext.mockResolvedValue({
                    creatures: [{ name: 'Goblin', type: 'npc' }],
                });
                getTargetFromAttacker.mockReturnValue(null);
                const consoleSpy = vi.spyOn(console, 'error');

                const result = await triggerCrownOfMadness(
                    baseSpell,
                    {},
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('[crownOfMadnessService] No target selected for Crown of Madness'),
                );
                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Crown of Madness',
                        description: 'No target selected for Crown of Madness.',
                    },
                });
                expect(executeHandler).not.toHaveBeenCalled();
                consoleSpy.mockRestore();
            });
        });

        describe('action structure', () => {
            it('constructs action with correct type and fields', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                getCombatContext.mockResolvedValue({
                    creatures: [
                        { name: 'Wizard', type: 'player' },
                        { name: 'Goblin', type: 'npc' },
                    ],
                });
                getMonsterData.mockResolvedValue({ type: 'Humanoid' });

                await triggerCrownOfMadness(
                    baseSpell,
                    { targetName: 'Goblin' },
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({
                        name: 'Crown of Madness',
                        automation: expect.objectContaining({
                            type: 'crown_of_madness',
                            saveDc: 15,
                            targetName: 'Goblin',
                            advantage: true,
                        }),
                        spell: baseSpell,
                        spellSlotLevel: 2,
                    }),
                    baseStats,
                    campaignName,
                    mapName,
                );
            });

            it('passes the spell object into the action', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
                getMonsterData.mockResolvedValue({ type: 'Humanoid' });
                const spell = { name: 'Crown of Madness', level: 2, school: 'Enchantment' };

                await triggerCrownOfMadness(
                    spell,
                    { targetName: 'Goblin' },
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.objectContaining({ spell }),
                    baseStats,
                    campaignName,
                    mapName,
                );
            });
        });

        describe('return value', () => {
            it('returns result from executeHandler on success', async () => {
                const expectedResult = {
                    type: 'popup',
                    payload: { type: 'automation_info', name: 'Crown of Madness', description: 'Crown of Madness affects target.' },
                };
                executeHandler.mockResolvedValue(expectedResult);
                getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
                getMonsterData.mockResolvedValue({ type: 'Humanoid' });

                const result = await triggerCrownOfMadness(
                    baseSpell,
                    { targetName: 'Goblin' },
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBe(expectedResult);
            });

            it('returns null when executeHandler returns null', async () => {
                executeHandler.mockResolvedValue(null);
                getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
                getMonsterData.mockResolvedValue({ type: 'Humanoid' });

                const result = await triggerCrownOfMadness(
                    baseSpell,
                    { targetName: 'Goblin' },
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(result).toBeNull();
            });

            it('returns error popup when executeHandler throws', async () => {
                executeHandler.mockRejectedValue(new Error('Handler failed'));
                getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
                getMonsterData.mockResolvedValue({ type: 'Humanoid' });

                const result = await triggerCrownOfMadness(
                    baseSpell,
                    { targetName: 'Goblin' },
                    baseStats,
                    campaignName,
                    mapName,
                );

                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Crown of Madness',
                        description: 'Failed to execute Crown of Madness.',
                    },
                });
            });
        });

        describe('mapName passthrough', () => {
            it('passes mapName to executeHandler', async () => {
                executeHandler.mockResolvedValue({ type: 'popup' });
                getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
                getMonsterData.mockResolvedValue({ type: 'Humanoid' });

                await triggerCrownOfMadness(
                    baseSpell,
                    { targetName: 'Goblin' },
                    baseStats,
                    campaignName,
                    'otherMap',
                );

                expect(executeHandler).toHaveBeenCalledWith(
                    expect.anything(),
                    baseStats,
                    campaignName,
                    'otherMap',
                );
            });
        });
    });
});
