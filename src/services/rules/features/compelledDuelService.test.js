// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerCompelledDuel } from './compelledDuelService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext, getTargetFromAttacker } from '../combat/damageUtils.js';
import { addEntry } from '../../ui/logService.js';

// Producer-vs-forwarder: the spell lane (triggerSpells.js:325-335, pinned by
// spellCastService.special.test.js:316/:355 — cite-redirect executed fix#336S/#1459-family,
// old :186-204 drifted with the special-lane rewrite) composes {spellSaveDc, targetName} upstream;
// this lane owns the exact executeHandler envelope: automation {type:'compelled_duel',
// saveDc passthrough, saveType:'WIS', targetName} (registry-read key
// targetEffectDefinitions.js:744). te stamp bytes + duration live in
// compelledDuelHandler.test.js — not duplicated here. No clock is stored by this service
// (disk: spells.json level 1, WIS, 'Concentration, up to 1 minute' → combat-scoped).

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

describe('compelledDuelService', () => {
    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Paladin',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Charisma', toHit: 9 },
        proficiency: 4,
    };
    // Disk-faithful spell (spells.json: level 1, WIS, concentration up to 1 minute).
    const spell = { name: 'Compelled Duel', level: 1 };

    beforeEach(() => {
        vi.resetAllMocks();
        // Explicit re-seed (vitest 4): every collaborator's behavior is stated per test,
        // so no default-branch accident can satisfy an assertion.
        executeHandler.mockResolvedValue(null);
        addEntry.mockResolvedValue(undefined);
        getCombatContext.mockResolvedValue(null);
        getTargetFromAttacker.mockReturnValue(null);
    });

    describe('triggerCompelledDuel', () => {
        it('stamps the exact executeHandler envelope and forwards the spell by identity', async () => {
            const result = await triggerCompelledDuel(
                spell, { targetName: 'Goblin', spellSaveDc: 15 }, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action, stats, campaign, map] = executeHandler.mock.calls[0];
            expect(action).toEqual({
                name: 'Compelled Duel',
                spell,
                automation: { type: 'compelled_duel', saveDc: 15, saveType: 'WIS', targetName: 'Goblin' },
            });
            expect(action.spell).toBe(spell);
            expect(stats).toBe(playerStats);
            expect(campaign).toBe(campaignName);
            expect(map).toBe(mapName);
            expect(result).toBeNull();
        });

        it('resolves an armed target from combat context when metaCtx omits targetName', async () => {
            const cs = { creatures: [{ name: 'Orc' }] };
            getCombatContext.mockResolvedValue(cs);
            getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

            await triggerCompelledDuel(spell, { spellSaveDc: 15 }, playerStats, campaignName, mapName);

            expect(getTargetFromAttacker).toHaveBeenCalledWith(cs, playerStats.name);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    automation: { type: 'compelled_duel', saveDc: 15, saveType: 'WIS', targetName: 'Orc' },
                }),
                playerStats, campaignName, mapName,
            );
        });

        // SP-026: an un-armed cast must refuse (no save prompt addressed to "Unknown"),
        // pop up, and log — real scenario tables covering every no-target branch.
        it.each([
            ['null metaCtx', null, () => { }],
            ['metaCtx without targetName', {}, () => { }],
            ['caster has no locked target in initiative', {}, () => {
                getCombatContext.mockResolvedValue({ creatures: [{ name: 'Orc' }] });
                getTargetFromAttacker.mockReturnValue(null);
            }],
        ])('SP-026: refuses the cast (no handler, refusal popup + log) when %s', async (_label, metaCtx, seed) => {
            seed();
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await triggerCompelledDuel(spell, metaCtx, playerStats, campaignName, mapName);

            expect(executeHandler).not.toHaveBeenCalled();
            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Compelled Duel', description: 'No target selected for Compelled Duel.' },
            });
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'automation',
                creatureName: playerStats.name,
                name: 'Compelled Duel',
                automationType: 'compelled_duel_refused',
                automationDetail: 'no_target',
                description: `${playerStats.name} cast Compelled Duel with no armed target — refused; no save prompt opened.`,
                timestamp: expect.any(Number),
            });
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No target selected for Compelled Duel'));
            consoleSpy.mockRestore();
        });

        it('logs and re-throws the identical error when executeHandler rejects', async () => {
            const err = new Error('Handler failed');
            executeHandler.mockRejectedValue(err);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await expect(triggerCompelledDuel(spell, { targetName: 'Goblin' }, playerStats, campaignName, mapName))
                .rejects.toBe(err);

            expect(consoleSpy).toHaveBeenCalledWith('[compelledDuelService] Failed to execute Compelled Duel handler:', err);
            consoleSpy.mockRestore();
        });
    });
});
