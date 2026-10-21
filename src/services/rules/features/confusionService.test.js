// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerConfusion } from './confusionService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

// This lane owns the PRODUCER only: spell-name gate, save-DC resolution chain,
// slot-level resolution, exact action envelope, delegation to executeHandler.
// The d10 confusion behavior table is owned by confusionHandler.test.js /
// confusionHandler.saveResults.test.js; turn-start delegation is owned by
// confusionTurnStartHandler.test.js (see 'confusion_turn_start' pin).
describe('confusionService', () => {
    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const defaultPlayerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15 },
        proficiency: 4,
    };
    let consoleSpy;

    beforeEach(() => {
        vi.resetAllMocks();
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    // Seed the delegation, cast, and capture the action handed to executeHandler.
    const castAndCapture = async (spell, metaCtx, playerStats = defaultPlayerStats) => {
        executeHandler.mockReset();
        executeHandler.mockResolvedValue({ type: 'popup' });
        await triggerConfusion(spell, metaCtx, playerStats, campaignName, mapName);
        expect(executeHandler).toHaveBeenCalledTimes(1);
        return executeHandler.mock.calls[0][0];
    };

    it('returns null without delegating for non-Confusion spell names', async () => {
        const spellNames = ['Fire Bolt', 'Command', 'Hold Person', 'Dominate Monster', '', undefined];
        for (const name of spellNames) {
            const result = await triggerConfusion(
                { name, level: 4 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );
            expect(result, `spell name: ${JSON.stringify(name)}`).toBeNull();
        }
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('matches the spell name case-insensitively', async () => {
        executeHandler.mockResolvedValue({ type: 'popup' });

        const result = await triggerConfusion(
            { name: 'CoNfUsIoN', level: 4 },
            {},
            defaultPlayerStats,
            campaignName,
            mapName,
        );

        expect(result).toEqual({ type: 'popup' });
        expect(executeHandler).toHaveBeenCalledTimes(1);
    });

    it('builds the exact action envelope and forwards identical arguments', async () => {
        executeHandler.mockResolvedValue({ type: 'popup' });
        const spell = { name: 'Confusion', level: 4, school: 'Enchantment' };
        const metaCtx = { targets: ['Goblin'] };

        const result = await triggerConfusion(
            spell,
            metaCtx,
            defaultPlayerStats,
            campaignName,
            mapName,
        );

        expect(executeHandler).toHaveBeenCalledTimes(1);
        // Full envelope — no extra or missing fields.
        expect(executeHandler.mock.calls[0][0]).toEqual({
            name: 'Confusion',
            automation: { type: 'confusion', saveDc: 15, saveType: 'WIS' },
            spell,
            spellSlotLevel: 4,
            metaCtx,
        });
        // Argument identity (not just structural equality).
        expect(executeHandler.mock.calls[0][1]).toBe(defaultPlayerStats);
        expect(executeHandler.mock.calls[0][2]).toBe(campaignName);
        expect(executeHandler.mock.calls[0][3]).toBe(mapName);
        expect(result).toEqual({ type: 'popup' });
    });

    it('resolves saveDc through the priority chain (mutually-distinguishable tiers)', async () => {
        const rows = [
            {
                label: 'metaCtx.spellSaveDc outranks spellAbilities.saveDc',
                spell: { name: 'Confusion', level: 4 },
                metaCtx: { spellSaveDc: 18 },
                stats: { name: 'Wizard', spellAbilities: { saveDc: 15 }, proficiency: 2 },
                expectedDc: 18,
            },
            {
                label: 'null spellSaveDc falls back to spellAbilities.saveDc',
                spell: { name: 'Confusion', level: 4 },
                metaCtx: { spellSaveDc: null },
                stats: { name: 'Wizard', spellAbilities: { saveDc: 16 }, proficiency: 2 },
                expectedDc: 16,
            },
            {
                label: 'missing spellSaveDc falls back to spellAbilities.saveDc',
                spell: { name: 'Confusion', level: 4 },
                metaCtx: {},
                stats: { name: 'Wizard', spellAbilities: { saveDc: 17 }, proficiency: 2 },
                expectedDc: 17,
            },
            {
                label: 'null spellAbilities falls back to 8 + proficiency',
                spell: { name: 'Confusion', level: 4 },
                metaCtx: {},
                stats: { name: 'Wizard', spellAbilities: null, proficiency: 3 },
                expectedDc: 11,
            },
            {
                label: 'missing spellAbilities falls back to 8 + proficiency',
                spell: { name: 'Confusion', level: 4 },
                metaCtx: {},
                stats: { name: 'Wizard', proficiency: 5 },
                expectedDc: 13,
            },
            {
                label: 'proficiency 0 is valid (DC 8, no fallback needed)',
                spell: { name: 'Confusion', level: 4 },
                metaCtx: {},
                stats: { name: 'Wizard', proficiency: 0 },
                expectedDc: 8,
            },
        ];

        for (const { label, spell, metaCtx, stats, expectedDc } of rows) {
            const action = await castAndCapture(spell, metaCtx, stats);
            expect(
                action.automation,
                label,
            ).toEqual({ type: 'confusion', saveDc: expectedDc, saveType: 'WIS' });
        }
    });

    it('throws when saveDc cannot be resolved (proficiency missing, null, or undefined)', async () => {
        const proficiencies = [
            { label: 'missing', stats: { name: 'Wizard' } },
            { label: 'null', stats: { name: 'Wizard', proficiency: null } },
            { label: 'undefined', stats: { name: 'Wizard', proficiency: undefined } },
        ];

        for (const { label, stats } of proficiencies) {
            await expect(
                triggerConfusion({ name: 'Confusion', level: 4 }, {}, stats, campaignName, mapName),
                `proficiency ${label}`,
            ).rejects.toThrow('playerStats.proficiency is required for confusion');
        }
        expect(consoleSpy).toHaveBeenCalledWith(
            '[confusionService] triggerConfusion: playerStats.proficiency is missing',
        );
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('prefers metaCtx.slotLevel over spell.level', async () => {
        const action = await castAndCapture(
            { name: 'Confusion', level: 4 },
            { slotLevel: 6 },
        );
        expect(action.spellSlotLevel).toBe(6);
    });

    it('falls back to spell.level when metaCtx slotLevel is absent (missing, null, undefined, or undefined metaCtx)', async () => {
        const metaCtxs = [
            { label: 'empty', metaCtx: {} },
            { label: 'undefined metaCtx', metaCtx: undefined },
            { label: 'null slotLevel', metaCtx: { slotLevel: null } },
            { label: 'undefined slotLevel', metaCtx: { slotLevel: undefined } },
        ];

        for (const { label, metaCtx } of metaCtxs) {
            const action = await castAndCapture({ name: 'Confusion', level: 7 }, metaCtx);
            expect(action.spellSlotLevel, label).toBe(7);
        }
    });

    it('returns the executeHandler result by identity', async () => {
        const sentinel = { type: 'popup', payload: { type: 'automation_info' } };
        executeHandler.mockResolvedValue(sentinel);

        const result = await triggerConfusion(
            { name: 'Confusion', level: 4 },
            {},
            defaultPlayerStats,
            campaignName,
            mapName,
        );

        expect(result).toBe(sentinel);
    });

    it('returns null and logs with prefix when executeHandler rejects', async () => {
        for (const error of [new Error('Handler failed'), new TypeError('Unexpected error')]) {
            executeHandler.mockRejectedValueOnce(error);

            const result = await triggerConfusion(
                { name: 'Confusion', level: 4 },
                {},
                defaultPlayerStats,
                campaignName,
                mapName,
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[confusionService] Failed to execute Confusion handler:',
                error,
            );
        }
        expect(executeHandler).toHaveBeenCalledTimes(2);
    });
});
