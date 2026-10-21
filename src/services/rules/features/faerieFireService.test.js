// @maintained-by-ai
/**
 * faerieFireService lane — the ENVELOPE-COMPOSITION FORWARDER (faerieFireService.js L3-26).
 * Owns the entire body: exact action envelope sent to executeHandler, the two
 * OR-chains (saveDc: metaCtx.spellSaveDc > playerStats.spellAbilities.saveDc > 8+(proficiency||2);
 * slotLevel: metaCtx.slotLevel > spell.level > 1), metaCtx shallow-clone, argument
 * passthrough, return passthrough, and the catch→console.error→null guard.
 * Downstream is owned by the faerieFire TRIO #1907-#1909 (faerieFireHandler*.test.js;
 * canonical seam map in #1907 header, which cites "meta from rules/features/faerieFireService.js").
 * Upstream callers (useSimpleSpellHandlers.js L289, triggerSpells.js L377 { ...metaCtx, spellSaveDc })
 * mock this service, so no other file exercises its internals — this is the sole lane.
 * Disk canon (read 2026-10-20): spells.json both rulesets — Faerie Fire level 1,
 * concentration true, duration "up to 1 minute", save field NULL on disk; the hardcoded
 * automation.saveType 'DEX' (L12) is therefore the only canonical encoding of the DEX
 * save (matches RAW) — pinned here. Turn-based: no timers, no wall-clock state in this lane.
 * Quirks pinned honestly: `||` chains leak falsy 0 on every tier (DC 0 / slot 0 never
 * reach automation — impossible by RAW) and proficiency 0 coerces to 2 (8+2=10).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerFaerieFire } from './faerieFireService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('faerieFireService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4 },
        proficiency: 4,
    };
    // Disk canon: public/data/spells.json — Faerie Fire level 1 (both rulesets).
    const spell = () => ({ name: 'Faerie Fire', level: 1 });

    it('builds the exact envelope and forwards all four args to executeHandler once', async () => {
        executeHandler.mockResolvedValue({ type: 'popup' });
        const s = spell();

        const result = await triggerFaerieFire(s, {}, playerStats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        expect(executeHandler).toHaveBeenCalledWith(
            {
                name: 'Faerie Fire',
                automation: { type: 'faerie_fire', saveDc: 15, saveType: 'DEX' },
                spell: s,
                spellSlotLevel: 1,
                metaCtx: {},
            },
            playerStats,
            campaignName,
            mapName,
        );
        // spell is passed by reference, never cloned; result is identity-passthrough.
        expect(executeHandler.mock.calls[0][0].spell).toBe(s);
        expect(result).toEqual({ type: 'popup' });
    });

    it('shallow-clones metaCtx, spreads null/undefined to {}, and rejects on missing playerStats', async () => {
        executeHandler.mockResolvedValue({ type: 'popup' });
        const metaCtx = { targets: ['Goblin'], heightenTarget: 'Goblin' };

        await triggerFaerieFire(spell(), metaCtx, playerStats, campaignName, mapName);
        await triggerFaerieFire(spell(), null, playerStats, campaignName, mapName);
        await triggerFaerieFire(spell(), undefined, playerStats, campaignName, mapName);

        const [cloned, nullCtx, undefCtx] =
            executeHandler.mock.calls.map(([action]) => action.metaCtx);
        expect(cloned).toEqual(metaCtx);
        expect(cloned).not.toBe(metaCtx);
        expect(nullCtx).toEqual({});
        expect(undefCtx).toEqual({});
        // Asymmetric guard (never-executed face): metaCtx is guarded via `|| {}` but
        // playerStats is dereferenced UNGUARDED at L4, outside the try — a missing
        // stats object rejects with TypeError instead of returning null like the catch path.
        await expect(triggerFaerieFire(spell(), {})).rejects.toThrow(TypeError);
    });

    it('resolves saveDc by tier: metaCtx.spellSaveDc > spellAbilities.saveDc > 8+proficiency', async () => {
        executeHandler.mockResolvedValue({ type: 'popup' });

        const dcFor = async (ctx, stats) => {
            await triggerFaerieFire(spell(), ctx, stats, campaignName, mapName);
            const calls = executeHandler.mock.calls;
            return calls[calls.length - 1][0].automation.saveDc;
        };

        expect(await dcFor({ spellSaveDc: 18 }, playerStats)).toBe(18); // metaCtx wins over 15
        expect(await dcFor({}, playerStats)).toBe(15); // spellAbilities fallback
        expect(await dcFor({}, { name: 'Wizard', proficiency: 3 })).toBe(11); // 8 + 3
        expect(await dcFor({}, {})).toBe(10); // 8 + (2 default)
    });

    it('leaks falsy 0 through every saveDc tier and coerces proficiency 0 to 2 (quirk)', async () => {
        executeHandler.mockResolvedValue({ type: 'popup' });

        const dcFor = async (ctx, stats) => {
            await triggerFaerieFire(spell(), ctx, stats, campaignName, mapName);
            const calls = executeHandler.mock.calls;
            return calls[calls.length - 1][0].automation.saveDc;
        };

        expect(await dcFor({ spellSaveDc: 0 }, playerStats)).toBe(15); // 0 leaks to spellAbilities
        expect(await dcFor({}, { spellAbilities: { saveDc: 0 }, proficiency: 3 })).toBe(11); // 0 leaks to 8+prof
        expect(await dcFor({}, { proficiency: 0 })).toBe(10); // 0 || 2 === 2, same as empty stats
    });

    it('resolves spellSlotLevel by tier: metaCtx.slotLevel > spell.level > 1, leaking falsy 0', async () => {
        executeHandler.mockResolvedValue({ type: 'popup' });

        const slotFor = async (ctx, s) => {
            await triggerFaerieFire(s, ctx, playerStats, campaignName, mapName);
            const calls = executeHandler.mock.calls;
            return calls[calls.length - 1][0].spellSlotLevel;
        };

        expect(await slotFor({ slotLevel: 5 }, spell())).toBe(5); // metaCtx wins over spell.level 1
        expect(await slotFor({}, { name: 'Faerie Fire', level: 3 })).toBe(3); // upcast spell passthrough
        expect(await slotFor({}, { name: 'Faerie Fire' })).toBe(1); // default
        expect(await slotFor({ slotLevel: 0 }, { name: 'Faerie Fire', level: 3 })).toBe(3); // 0 leaks (no level-0 slots)
    });

    it('returns null and logs exact-prefixed error with the identical Error when executeHandler throws', async () => {
        const err = new Error('Handler failed');
        executeHandler.mockRejectedValue(err);
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await triggerFaerieFire(spell(), {}, playerStats, campaignName, mapName);

        expect(result).toBeNull(); // null-return on throw is load-bearing: triggerSpells.js:378 skips the popup
        expect(consoleSpy).toHaveBeenCalledWith(
            '[faerieFireService] Failed to execute Faerie Fire handler:',
            err,
        );
        consoleSpy.mockRestore();
    });
});
