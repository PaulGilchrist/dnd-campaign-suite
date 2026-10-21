// @maintained-by-ai
// Flesh to Stone CAST-lane constructor contract (triggerFleshToStone).
// Owner boundary: this file pins ONLY the action envelope this service builds
// and hands to executeHandler (dispatch: automation/index.js:534
// flesh_to_stone → fleshToStoneHandler.handle). Downstream lanes are owned
// elsewhere and cite-skipped: handler prompt/te/tracking writes →
// automation/handlers/spells/fleshToStoneHandler.test.js; recurring-save
// clears → components/initiative/saveResultHandlers.test.jsx; rest purge →
// clearAllExpirationEffects_rest_cleanup.test.js (its flagged quirk at
// clearAllExpirationEffects.js:118 — verbatim `setRuntimeValue('campaign',
// 'targetEffects', ftsCleanedEffects, campaignName);` unconditional vs the
// guarded :114 — consumes keys PRODUCED by fleshToStoneHandler.js:102-126,
// NOT by this service: triggerFleshToStone performs ZERO store writes, so
// the :118 origin is NOT this file's stage/clear contract); SaveAttackAoeModal
// staged-petrify picker runs the REAL cockatricePetrifyService ladder
// (SaveAttackAoeModal.staged-petrify.test.jsx) — different service, no
// import of triggerFleshToStone. Sole production caller:
// spellCastService/execution/triggerSpells.js:80 (gate re-checks
// name.toLowerCase() === 'flesh to stone' upstream and always spreads
// { ...metaCtx, spellSaveDc } — the defense-in-depth re-gate inside the
// service is pinned here anyway). No clocks here: petrification ladder
// ("3 successes / 3 failures", registry targetEffectDefinitions.js:921) is
// turn-seam owned, never wall-clock.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerFleshToStone } from './fleshToStoneService.js';
import { executeHandler } from '../../automation/index.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const playerStats = {
    name: 'Wizard',
    spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
    proficiency: 4,
};

// Exact envelope the handler consumes (fleshToStoneHandler.test.js:60 shape).
const envelope = (saveDc, spellSlotLevel, spell) => ({
    name: 'Flesh to Stone',
    automation: { type: 'flesh_to_stone', saveDc, saveType: 'CON', saveAbility: 'CON' },
    spell,
    spellSlotLevel,
});

describe('fleshToStoneService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('disk canon (both rulesets)', () => {
        it.each([
            ['5e', spells5e],
            ['2024', spells2024],
        ])('%s spells.json: why the literals — level 6 slot fallback, CON save', (_label, data) => {
            const list = data.spells || data;
            const fts = list.find(s => s.name === 'Flesh to Stone');
            expect(fts.level).toBe(6);
            expect(fts.dc.dc_type).toBe('CON');
            expect(fts.dc.dc_success).toBe('none');
            // near-miss REAL disk names backing the negative-gate rows below
            expect(list.some(s => s.name === 'Hold Monster')).toBe(true);
            expect(list.some(s => s.name === 'Stone Shape')).toBe(true);
        });
    });

    describe('triggerFleshToStone', () => {
        it('happy path: exact envelope bytes, arg identities, result identity passthrough', async () => {
            const sentinel = { type: 'popup', payload: { type: 'automation_info' } };
            executeHandler.mockResolvedValue(sentinel);
            // lowercase name folds case-insensitive gate into the byte-lock;
            // production metaCtx shape per triggerSpells.js:80
            const spell = { name: 'flesh to stone', level: 6, school: 'Transmutation' };

            const result = await triggerFleshToStone(spell, { spellSaveDc: 18, slotLevel: 7 }, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action, stats, campaign, map] = executeHandler.mock.calls[0];
            expect(action).toEqual(envelope(18, 7, spell)); // exact — no extra/leaked keys (e.g. metaCtx)
            expect(action.spell).toBe(spell);
            expect(stats).toBe(playerStats);
            expect(campaign).toBe(campaignName);
            expect(map).toBe(mapName);
            expect(result).toBe(sentinel);
        });

        it.each([
            { desc: 'spellAbilities.saveDc fallback when metaCtx has no spellSaveDc', spell: { name: 'Flesh to Stone', level: 6 }, metaCtx: {}, stats: playerStats, dc: 15, slot: 6 },
            { desc: 'metaCtx.spellSaveDc 0 falls through || (:0-chain)', spell: { name: 'Flesh to Stone', level: 6 }, metaCtx: { spellSaveDc: 0 }, stats: playerStats, dc: 15, slot: 6 },
            { desc: 'computes 8+proficiency when spellAbilities absent', spell: { name: 'Flesh to Stone', level: 6 }, metaCtx: {}, stats: { name: 'Wizard', proficiency: 3 }, dc: 11, slot: 6 },
            { desc: 'defaults proficiency 2 on empty stats', spell: { name: 'Flesh to Stone', level: 6 }, metaCtx: {}, stats: {}, dc: 10, slot: 6 },
            { desc: 'null metaCtx via optional chain', spell: { name: 'Flesh to Stone', level: 6 }, metaCtx: null, stats: playerStats, dc: 15, slot: 6 },
            { desc: 'spell.level passthrough', spell: { name: 'Flesh to Stone', level: 7 }, metaCtx: {}, stats: playerStats, dc: 15, slot: 7 },
            { desc: 'metaCtx.slotLevel beats spell.level', spell: { name: 'Flesh to Stone', level: 3 }, metaCtx: { slotLevel: 7 }, stats: playerStats, dc: 15, slot: 7 },
            { desc: 'null spell.level defaults to disk canon 6', spell: { name: 'Flesh to Stone', level: null }, metaCtx: {}, stats: playerStats, dc: 15, slot: 6 },
            { desc: 'level 0 defaults to 6 (FTS is never 0th on disk)', spell: { name: 'Flesh to Stone', level: 0 }, metaCtx: {}, stats: playerStats, dc: 15, slot: 6 },
        ])('envelope chain: $desc', async ({ spell, metaCtx, stats, dc, slot }) => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            const result = await triggerFleshToStone(spell, metaCtx, stats, campaignName, mapName);

            const [action, argStats, campaign, map] = executeHandler.mock.calls[0];
            expect(action).toEqual(envelope(dc, slot, spell));
            expect(argStats).toBe(stats);
            expect(campaign).toBe(campaignName);
            expect(map).toBe(mapName);
            expect(result).toEqual({ type: 'popup' });
        });

        it.each([
            { desc: 'real DISK near-miss Hold Monster', spell: { name: 'Hold Monster', level: 5 } },
            { desc: 'real DISK near-miss Stone Shape', spell: { name: 'Stone Shape', level: 4 } },
            { desc: 'trailing space not trimmed (exact match)', spell: { name: 'flesh to stone ', level: 6 } },
            { desc: 'undefined name', spell: { level: 6 } },
            { desc: 'null name', spell: { name: null, level: 6 } },
            { desc: 'empty name', spell: { name: '', level: 6 } },
        ])('gate closed for $desc: null, handler untouched', async ({ spell }) => {
            const result = await triggerFleshToStone(spell, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('executeHandler resolving null passes through null without logging', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            executeHandler.mockResolvedValue(null);

            const result = await triggerFleshToStone({ name: 'Flesh to Stone', level: 6 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });

        it('executeHandler rejection: identical Error + exact prefix logged, null returned', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const err = new Error('Handler failed');
            executeHandler.mockRejectedValue(err);

            const result = await triggerFleshToStone({ name: 'Flesh to Stone', level: 6 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(spy).toHaveBeenCalledWith('[fleshToStoneService] Failed to execute Flesh to Stone handler:', err);
            spy.mockRestore();
        });

        it('null playerStats rejects — saveDc/slot deref is OUTSIDE the try (catch guards executeHandler only)', async () => {
            await expect(
                triggerFleshToStone({ name: 'Flesh to Stone', level: 6 }, {}, null, campaignName, mapName),
            ).rejects.toThrow(TypeError);
            expect(executeHandler).not.toHaveBeenCalled();
        });
    });
});
