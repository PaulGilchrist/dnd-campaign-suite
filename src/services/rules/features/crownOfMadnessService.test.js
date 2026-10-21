// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerCrownOfMadness } from './crownOfMadnessService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
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

// Base lane: trigger-level behavior of triggerCrownOfMadness — the name gate,
// target resolution (explicit metaCtx passthrough, initiative-view fallback,
// every no-target face), the exact action envelope on the happy path
// (Humanoid monster-data mock, saveDc 15, advantage true, slotLevel default 2),
// and result/error handling. Helper-internal branches (non-Humanoid rejections,
// humanoid defaults, DC override tiers, slotLevel 5/3, advantage false,
// monster-data warning) live in crownOfMadnessService.helpers.test.js —
// not repeated here.
describe('crownOfMadnessService', () => {
    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const baseSpell = { name: 'Crown of Madness' };
    const baseStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence' },
        proficiency: 4,
    };

    const NO_TARGET_POPUP = {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Crown of Madness',
            description: 'No target selected for Crown of Madness.',
        },
    };
    const NO_TARGET_LOG = '[crownOfMadnessService] No target selected for Crown of Madness by Wizard. Caster has no target in initiative view.';

    let consoleError;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleError.mockRestore();
    });

    describe('spell name gate', () => {
        it.each([
            'crown of madness',
            'CrOwN oF mAdNeSs',
        ])('triggers for "%s" (case-insensitive), resolving the target via the initiative view', async (name) => {
            executeHandler.mockResolvedValue({ type: 'popup' });
            const context = { creatures: [{ name: 'Goblin' }] };
            getCombatContext.mockResolvedValue(context);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin' });

            const result = await triggerCrownOfMadness(
                { name, level: 2 },
                {},
                baseStats,
                campaignName,
                mapName,
            );

            expect(getTargetFromAttacker).toHaveBeenCalledWith(context, 'Wizard');
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Goblin' }),
                }),
                baseStats,
                campaignName,
                mapName,
            );
            expect(result).toEqual({ type: 'popup' });
        });

        it.each([
            'Crown of Sorrow',
            'Madness',
            '',
            undefined,
        ])('returns null without touching the handler for non-Crown spell "%s"', async (name) => {
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
        it('passes metaCtx.targetName straight through without consulting the initiative view', async () => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerCrownOfMadness(
                baseSpell,
                { targetName: 'Goblin' },
                baseStats,
                campaignName,
                mapName,
            );

            expect(getTargetFromAttacker).not.toHaveBeenCalled();
            expect(result).toEqual({ type: 'popup' });
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: expect.objectContaining({ targetName: 'Goblin' }),
                }),
                baseStats,
                campaignName,
                mapName,
            );
        });

        // One table for every no-target face: each row must land on the same
        // popup + console.error outcome with the handler never invoked.
        it.each([
            ['no combat context', { targetName: null }, null, undefined],
            ['empty creatures list', { targetName: null }, { creatures: [] }, undefined],
            ['no target in initiative view', { targetName: null }, { creatures: [{ name: 'Wizard', type: 'player' }, { name: 'Goblin', type: 'npc' }] }, null],
            ['all creatures named the caster', { targetName: null }, { creatures: [{ name: 'Wizard', type: 'player' }, { name: 'Wizard', type: 'npc' }] }, undefined],
            ['metaCtx is an empty object', {}, { creatures: [{ name: 'Goblin', type: 'npc' }] }, null],
            ['metaCtx is null', null, { creatures: [{ name: 'Goblin', type: 'npc' }] }, null],
            ['metaCtx is undefined', undefined, { creatures: [{ name: 'Goblin', type: 'npc' }] }, null],
        ])('returns the no-target popup and logs when %s', async (_label, metaCtx, context, attackerTarget) => {
            getCombatContext.mockResolvedValue(context);
            getTargetFromAttacker.mockReturnValue(attackerTarget);

            const result = await triggerCrownOfMadness(
                baseSpell,
                metaCtx,
                baseStats,
                campaignName,
                mapName,
            );

            expect(result).toEqual(NO_TARGET_POPUP);
            expect(consoleError).toHaveBeenCalledWith(NO_TARGET_LOG);
            expect(executeHandler).not.toHaveBeenCalled();
        });
    });

    describe('action envelope', () => {
        it('builds the exact Crown of Madness action and returns the handler result unchanged', async () => {
            const expectedResult = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Crown of Madness', description: 'Crown of Madness affects target.' },
            };
            executeHandler.mockResolvedValue(expectedResult);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Wizard', type: 'player' },
                    { name: 'Goblin', type: 'npc' },
                ],
            });
            getMonsterData.mockResolvedValue({ type: 'Humanoid' });

            const result = await triggerCrownOfMadness(
                baseSpell,
                { targetName: 'Goblin' },
                baseStats,
                campaignName,
                mapName,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                {
                    name: 'Crown of Madness',
                    automation: { type: 'crown_of_madness', saveDc: 15, targetName: 'Goblin', advantage: true },
                    spell: baseSpell,
                    spellSlotLevel: 2,
                },
                baseStats,
                campaignName,
                mapName,
            );
            // the spell object travels through by reference, untouched
            expect(executeHandler.mock.calls[0][0].spell).toBe(baseSpell);
            expect(result).toBe(expectedResult);
        });
    });

    describe('handler result handling', () => {
        it('returns null when the handler resolves null (no fabricated fallback)', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerCrownOfMadness(
                baseSpell,
                { targetName: 'Goblin' },
                baseStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
        });

        it('returns an error popup and logs the identical Error when the handler throws', async () => {
            const failure = new Error('Handler failed');
            executeHandler.mockRejectedValue(failure);

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
            expect(consoleError).toHaveBeenCalledWith(
                '[crownOfMadnessService] Failed to execute Crown of Madness handler:',
                failure,
            );
        });
    });
});
