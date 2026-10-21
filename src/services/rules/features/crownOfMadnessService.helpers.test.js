// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerCrownOfMadness } from './crownOfMadnessService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext } from '../combat/damageUtils.js';
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

// Branches of the private helpers (isTargetHumanoid, resolveCrownSaveDc,
// spellSlotLevel composition, advantage flag) that the base lane
// crownOfMadnessService.test.js does NOT reach through triggerCrownOfMadness.
// The base lane pins: name matching, target resolution, the happy-path action
// (type/saveDc 15/targetName/advantage true), spellSlotLevel default 2,
// return passthrough, and mapName passthrough — not repeated here.
describe('crownOfMadnessService helper branches', () => {
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

    describe('isTargetHumanoid rejection', () => {
        it.each([
            ['Wolf', 'Beast'],
            ['Oozy', 'Ooze'],
        ])('returns automation_info popup naming %s and skips the handler when target type is %s', async (targetName, type) => {
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wizard', type: 'player' },
                    { name: targetName, type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type });

            const result = await triggerCrownOfMadness(
                baseSpell,
                { targetName },
                baseStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Crown of Madness',
                    description: `No effect. ${targetName} is not a Humanoid.`,
                },
            });
            expect(executeHandler).not.toHaveBeenCalled();
        });
    });

    describe('isTargetHumanoid defaults', () => {
        it('treats player-type creatures as Humanoid without consulting monster data', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wizard', type: 'player' },
                    { name: 'Cleric', type: 'player' },
                ],
            });

            const result = await triggerCrownOfMadness(
                baseSpell,
                { targetName: 'Cleric' },
                baseStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup' });
            expect(getMonsterData).not.toHaveBeenCalled();
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Cleric' }),
                }),
                baseStats,
                campaignName,
                mapName,
            );
        });

        it.each([
            ['target absent from a populated combat context', { creatures: [{ name: 'Wizard', type: 'player' }] }, 'UnknownTarget', undefined, false],
            ['combat context has no creatures', { creatures: [] }, 'Unknown', undefined, false],
            ['combat context is null', null, 'Unknown', undefined, false],
            ['monster data resolves without a type', { creatures: [{ name: 'Mystery', type: 'npc' }] }, 'Mystery', { challenge_rating: 5 }, true],
        ])('defaults to Humanoid when %s', async (_label, context, targetName, monsterData, expectedAdvantage) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue(context);
            if (monsterData) {
                getMonsterData.mockResolvedValue(monsterData);
            }

            const result = await triggerCrownOfMadness(
                baseSpell,
                { targetName },
                baseStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup' });
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        type: 'crown_of_madness',
                        saveDc: 15,
                        targetName,
                        advantage: expectedAdvantage,
                    }),
                }),
                baseStats,
                campaignName,
                mapName,
            );
        });

        it('defaults to Humanoid and logs a warning when monster data fails to load', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Mystery', type: 'npc' }],
            });
            getMonsterData.mockRejectedValue(new Error('Failed to load'));
            const consoleSpy = vi.spyOn(console, 'warn');

            const result = await triggerCrownOfMadness(
                baseSpell,
                { targetName: 'Mystery' },
                baseStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual({ type: 'popup' });
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[crownOfMadnessService] Monster type unavailable, defaulting to Humanoid:'),
                expect.any(Error),
            );
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Mystery', advantage: true }),
                }),
                baseStats,
                campaignName,
                mapName,
            );
            consoleSpy.mockRestore();
        });
    });

    describe('advantage flag', () => {
        it('is false when the target is the caster themself', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wizard', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });

            await triggerCrownOfMadness(
                baseSpell,
                { targetName: 'Wizard' },
                baseStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({
                        targetName: 'Wizard',
                        advantage: false,
                    }),
                }),
                baseStats,
                campaignName,
                mapName,
            );
        });
    });

    describe('save DC resolution', () => {
        it.each([
            ['metaCtx.spellSaveDc overrides spellAbilities', { spellSaveDc: 18 }, baseStats, 18],
            ['spellAbilities.saveDc is used when no override', {}, baseStats, 15],
            ['8 + proficiency when spellAbilities exists without saveDc', {}, { name: 'Wizard', spellAbilities: {}, proficiency: 4 }, 12],
            ['8 + proficiency when spellAbilities is missing', {}, { name: 'Wizard', proficiency: 3 }, 11],
            ['8 + default proficiency 2 on minimal stats', {}, {}, 10],
        ])('%s resolves to %i', async (_label, metaCtx, stats, expectedDc) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });

            await triggerCrownOfMadness(
                baseSpell,
                { targetName: 'Goblin', ...metaCtx },
                stats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ saveDc: expectedDc }),
                }),
                stats,
                campaignName,
                mapName,
            );
        });
    });

    describe('slot level resolution', () => {
        it.each([
            ['metaCtx.slotLevel wins over spell.level', { slotLevel: 5 }, { name: 'Crown of Madness', level: 3 }, 5],
            ['spell.level used when metaCtx has no slotLevel', {}, { name: 'Crown of Madness', level: 3 }, 3],
        ])('%s resolves to slot %i', async (_label, metaCtx, spell, expectedSlot) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin' }] });
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });

            await triggerCrownOfMadness(
                spell,
                { targetName: 'Goblin', ...metaCtx },
                baseStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spellSlotLevel: expectedSlot }),
                baseStats,
                campaignName,
                mapName,
            );
        });
    });
});
