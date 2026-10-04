// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerCompelledDuel } from './compelledDuelService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve(null)),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

describe('compelledDuelService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Paladin',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Charisma', toHit: 9 },
        proficiency: 4,
    };

    describe('triggerCompelledDuel', () => {
        it('executes handler with correct automation type, saveDc and targetName', async () => {
            executeHandler.mockResolvedValue(null);
            await triggerCompelledDuel({ name: 'Compelled Duel', level: 1 }, { targetName: 'Goblin', spellSaveDc: 15 }, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Compelled Duel',
                    automation: { type: 'compelled_duel', saveDc: 15, saveType: 'WIS', targetName: 'Goblin' },
                }),
                playerStats, campaignName, mapName,
            );
        });

        it('passes the spell through to the action', async () => {
            executeHandler.mockResolvedValue(null);
            const spell = { name: 'Compelled Duel', level: 1 };
            await triggerCompelledDuel(spell, { targetName: 'Goblin' }, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ spell }),
                playerStats, campaignName, mapName,
            );
        });

        it.each([null, {}])('SP-026: refuses the cast (no handler, refusal popup + log) when metaCtx is %s', async (metaCtx) => {
            executeHandler.mockResolvedValue(null);
            const result = await triggerCompelledDuel({ name: 'Compelled Duel', level: 1 }, metaCtx, playerStats, campaignName, mapName);
            expect(executeHandler).not.toHaveBeenCalled();
            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Compelled Duel', description: 'No target selected for Compelled Duel.' },
            });
            const { addEntry } = await import('../../ui/logService.js');
            const refusal = addEntry.mock.calls.map(c => c[1]).find(e => e.automationType === 'compelled_duel_refused');
            expect(refusal).toBeDefined();
            expect(refusal.automationDetail).toBe('no_target');
        });

        it('resolves an armed target from combat context when metaCtx omits targetName', async () => {
            const { getCombatContext, getTargetFromAttacker } = await import('../combat/damageUtils.js');
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Orc' }] });
            getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
            executeHandler.mockResolvedValue(null);
            await triggerCompelledDuel({ name: 'Compelled Duel', level: 1 }, {}, playerStats, campaignName, mapName);
            expect(executeHandler).toHaveBeenCalledWith(
                expect.objectContaining({ automation: expect.objectContaining({ targetName: 'Orc' }) }),
                playerStats, campaignName, mapName,
            );
        });

        it('re-throws when executeHandler rejects', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));
            await expect(triggerCompelledDuel({ name: 'Compelled Duel', level: 1 }, { targetName: 'Goblin' }, playerStats, campaignName, mapName)).rejects.toThrow('Handler failed');
        });
    });
});
