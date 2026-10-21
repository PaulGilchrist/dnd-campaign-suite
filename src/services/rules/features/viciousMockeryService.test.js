// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerViciousMockeryForGeneric } from './viciousMockeryService.js';
import { executeHandler } from '../../automation/index.js';

// Boundary mock: executeHandler is the automation-registry producer
// (dispatches vicious_mockery -> viciousMockeryHandler.handle, which owns the
// targetEffects write + expiration + log). This lane is a pure FORWARDER: it
// only builds the action envelope and delegates. Mocking here keeps the store
// untouched (grep of source: no getRuntimeValue/setRuntimeValue/localStorage/
// Date.now/setTimeout) so no argument-keyed store fake is required.
vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('viciousMockeryService', () => {
    beforeEach(() => {
        // vitest-4 retains implementations across clearAllMocks — reset so each
        // test re-seeds its own executeHandler behaviour explicitly.
        vi.resetAllMocks();
    });

    const campaignName = 'test-campaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Bard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Charisma' },
        proficiency: 4,
    };

    describe('triggerViciousMockeryForGeneric', () => {
        // Identity/disk: Vicious Mockery is a level-0 (cantrip) Enchantment,
        // WIS save (dc_success:"none"), Psychic — confirmed in BOTH rulesets
        // (public/data/spells.json damage_at_character_level 1d4/5:2d4/..., and
        // public/data/2024/spells.json damage_at_slot_level 0:"1d6"/5:"2d6"/...).
        // The save+damage roll lives in the generic spell flow + producer handler;
        // this forwarder forwards the spell object verbatim and stamps only the
        // automation identity. It never produces dice, HP, or a clock.
        it('delegates to executeHandler with the exact vicious_mockery envelope, passes collaborators by identity, and swallows the handler result', async () => {
            const sentinel = { type: 'popup', payload: { name: 'Vicious Mockery' } };
            executeHandler.mockResolvedValue(sentinel);
            const spell = { name: 'Vicious Mockery', level: 0 };
            // Production metaCtx (handleNpcSaveDamage / useLoggedDiceRollEventHandlers)
            // carries spellSaveDc alongside targetName.
            const metaCtx = { targetName: 'Goblin', spellSaveDc: 15 };

            const result = await triggerViciousMockeryForGeneric(
                spell, metaCtx, playerStats, campaignName, mapName,
            );

            // forwarder does NOT forward the handler return value.
            expect(result).toBeUndefined();
            expect(executeHandler).toHaveBeenCalledTimes(1);

            const [action, statsArg, campaignArg, mapArg] = executeHandler.mock.calls[0];
            expect(action).toEqual({
                name: 'Vicious Mockery',
                spell,
                automation: { type: 'vicious_mockery', targetName: 'Goblin' },
            });
            // full-set key census (proves no extra keys are invented).
            expect(Object.keys(action).sort()).toEqual(['automation', 'name', 'spell']);
            expect(Object.keys(action.automation).sort()).toEqual(['targetName', 'type']);
            // spellSaveDc is deliberately NOT leaked into automation (targetName only).
            expect(action.automation).not.toHaveProperty('spellSaveDc');
            // collaborator passthrough by reference identity.
            expect(action.spell).toBe(spell);
            expect(statsArg).toBe(playerStats);
            expect(campaignArg).toBe(campaignName);
            expect(mapArg).toBe(mapName);
        });

        // Coercion census member: `metaCtx?.targetName || 'Unknown'` — a :0-swallow.
        // Every falsy targetName (missing, empty string, 0) collapses to 'Unknown'.
        it.each([
            ['null metaCtx', null],
            ['missing targetName', {}],
            ['empty-string targetName', { targetName: '' }],
            ['zero targetName', { targetName: 0 }],
        ])('falls back to "Unknown" for %s', async (_label, metaCtx) => {
            executeHandler.mockResolvedValue(undefined);
            const spell = { name: 'Vicious Mockery', level: 0 };

            await triggerViciousMockeryForGeneric(
                spell, metaCtx, playerStats, campaignName, mapName,
            );

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action] = executeHandler.mock.calls[0];
            expect(action.automation).toEqual({ type: 'vicious_mockery', targetName: 'Unknown' });
        });

        it('logs with the exact prefix and re-throws the identical error when executeHandler rejects', async () => {
            const err = new Error('Handler failed');
            executeHandler.mockRejectedValue(err);
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const spell = { name: 'Vicious Mockery', level: 0 };
            const metaCtx = { targetName: 'Goblin' };

            // re-throws the SAME instance, not a re-wrapped message.
            await expect(
                triggerViciousMockeryForGeneric(spell, metaCtx, playerStats, campaignName, mapName),
            ).rejects.toBe(err);

            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith('[viciousMockery] Trigger failed:', err);
            consoleSpy.mockRestore();
        });
    });
});
