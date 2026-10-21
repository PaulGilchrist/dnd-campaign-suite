// @maintained-by-ai
/**
 * greaterRestorationService lane — ENVELOPE-OWNER PURITY ONLY (thin wrapper).
 *
 * Exports pinned here (both, per export map):
 *  - triggerGreaterRestoration: name gate + exact 3-key action envelope into
 *    executeHandler (dispatch automation/index.js:560 greater_restoration →
 *    greaterRestorationHandler.handle). metaCtx is IGNORED by the service —
 *    the exact toEqual proves no metaCtx/targetName/saveDc keys leak.
 *  - confirmGreaterRestoration: unguarded-args passthrough of the exact
 *    5-identity tuple into applyGreaterRestorationEffect (= handler.applyGreaterRestoration,
 *    automation/index.js:231 alias), catch → null + exact-prefix log.
 *
 * Caller evidence: confirmGreaterRestoration is the LIVE export —
 * useSimpleSpellHandlers.js:311 consumeThenApply('Diamond Dust (100 gp)')
 * matches the disk material literal ('Diamond dust worth at least 100gp,
 * which the spell consumes.'), building its own envelope (caller-side envelope
 * owned by useSpellMetamagicFlow.confirm-payloads.test.js).
 * triggerGreaterRestoration has ZERO production callers (grep src): the spell
 * bar's direct cast dispatches greater_restoration straight to the handler.
 * SOURCE BUG (reported, cross-file, not deleted here): dead export — consider
 * removal or rewiring of triggerGreaterRestoration in a source lane.
 *
 * Twin determination: NO lesserRestorationService twin exists — Lesser
 * Restoration routes directly to automation applyLesserRestorationEffect
 * (useSimpleSpellHandlers.js:312). Condition-clear semantics
 * (exhaustion/condition/curse/ability_reduction/hp_max_reduction,
 * SELECTION_REMOVERS + store writes) are owned VERBATIM by
 * automation/handlers/spells/greaterRestorationHandler.test.js — cited,
 * NOT re-pinned here. Store pair: this lane performs ZERO runtime-store
 * writes; the canonical 'hitPoints'/'currentHitPoints' pair is touched only
 * downstream at greaterRestorationHandler.js:97-102 (that lane owns it).
 * skipSync: N/A — no setRuntimeObject writes in this lane at all.
 * No clocks: duration is Instantaneous on disk both rulesets; nothing here
 * schedules anything.
 *
 * Family-class scan, honest: spell.range || 'Touch' is the only :0-chain
 * (falsy range triple folds into 'Touch', pinned below); unguarded deref
 * OUTSIDE the try — spell.name (gate L4) and spell.range (L11) — null spell
 * rejects TypeError, catch guards executeHandler only (same class as
 * fleshToStoneService.test.js null-stats row); prof||0: N/A, this service
 * never reads proficiency; ruleset divergence: none reachable (service never
 * reads disk; disk-canon block proves hardcoded 'greater restoration' gate
 * literal + 'Touch' default PARITY with both rulesets' rows).
 * Over-mock check: vi.mock of the automation barrel is the correct boundary —
 * the barrel re-exports 200+ handlers; this lane's contract IS the call
 * tuple into its two dependencies.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerGreaterRestoration, confirmGreaterRestoration } from './greaterRestorationService.js';
import { executeHandler, applyGreaterRestorationEffect } from '../../automation/index.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
    applyGreaterRestorationEffect: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const playerStats = { name: 'Cleric', proficiency: 4 };

// Exact envelope the handler consumes — 3 keys, nothing more (byte-lock).
const envelope = (spell, range = 'Touch') => ({
    name: 'Greater Restoration',
    automation: { type: 'greater_restoration', range },
    spell,
});

describe('greaterRestorationService', () => {
    let errorSpy;
    beforeEach(() => {
        vi.resetAllMocks();
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('disk canon (both rulesets) — why the literals', () => {
        it.each([
            ['5e', spells5e],
            ['2024', spells2024],
        ])('%s spells.json: level 5 / Touch / Instantaneous justify gate + range default', (_label, data) => {
            const list = data.spells || data;
            const gr = list.find(s => s.name === 'Greater Restoration');
            expect(gr.level).toBe(5);
            expect(gr.range).toBe('Touch');           // 'Touch' hardcoded default matches disk
            expect(gr.duration).toBe('Instantaneous'); // no clock, no concentration
            expect(gr.concentration).toBe(false);
            expect(gr.components).toEqual(['V', 'S', 'M']);
            expect(gr.dc).toBeUndefined();             // no save — RAW, nothing to compose here
            // name-gate literal 'greater restoration' matches the disk row folded
            expect(gr.name.toLowerCase()).toBe('greater restoration');
            // near-miss REAL disk name backing the negative-gate rows below
            expect(list.some(s => s.name === 'Lesser Restoration')).toBe(true);
            // clear-category vocab the downstream handler consumes (owner-cited, not re-pinned)
            const text = gr.description.join(' ');
            expect(/exhaustion/i.test(text)).toBe(true);
            expect(/charmed|petrified/i.test(text)).toBe(true);
            expect(/curse/i.test(text)).toBe(true);
        });
    });

    describe('triggerGreaterRestoration — name gate (lowercase-exact)', () => {
        it.each([
            ['real disk near-miss Lesser Restoration', 'Lesser Restoration'],
            ['plural', 'greater restorations'],
            ['bare genus', 'restoration'],
            ['bare species', 'greater'],
            ['unrelated disk spell', 'Cure Wounds'],
            ['trailing space not trimmed (exact match quirk)', 'Greater Restoration '],
        ])('%s → null, handler untouched', async (_label, name) => {
            const result = await triggerGreaterRestoration({ name, level: 5 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it.each([undefined, null, ''])('falsy name %s → null, handler untouched', async (name) => {
            const result = await triggerGreaterRestoration({ name, level: 5 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });
    });

    describe('triggerGreaterRestoration — envelope + passthrough', () => {
        it('happy: exact envelope bytes (metaCtx ignored), arg identities, result identity', async () => {
            const sentinel = { type: 'popup', payload: { type: 'greater_restoration_selection' } };
            executeHandler.mockResolvedValue(sentinel);
            const spell = { name: 'greater restoration', level: 5 }; // lowercase folds gate into byte-lock

            const result = await triggerGreaterRestoration(spell, { targetName: 'Goblin', spellSaveDc: 15 }, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            const [action, stats, campaign, map] = executeHandler.mock.calls[0];
            expect(action).toEqual(envelope(spell)); // exactly 3 keys — no metaCtx leak
            expect(action.spell).toBe(spell);
            expect(stats).toBe(playerStats);
            expect(campaign).toBe(campaignName);
            expect(map).toBe(mapName);
            expect(result).toBe(sentinel);
        });

        it.each([
            ['falsy range triple ""', '', 'Touch'],
            ['null range', null, 'Touch'],
            ['undefined range', undefined, 'Touch'],
            ['spell.range passthrough', '60 feet', '60 feet'],
        ])('range :0-chain: %s → %s', async (_label, range, expected) => {
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerGreaterRestoration({ name: 'Greater Restoration', level: 5, range }, {}, playerStats, campaignName, mapName);

            expect(executeHandler.mock.calls[0][0]).toEqual(envelope(expect.anything(), expected));
            expect(executeHandler.mock.calls[0][0].range).toBeUndefined(); // range lives on automation only
        });

        it('executeHandler resolving null passes through null without logging', async () => {
            executeHandler.mockResolvedValue(null);

            const result = await triggerGreaterRestoration({ name: 'Greater Restoration', level: 5 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('executeHandler rejection: identical Error + exact prefix logged, null returned', async () => {
            const err = new Error('Handler failed');
            executeHandler.mockRejectedValue(err);

            const result = await triggerGreaterRestoration({ name: 'Greater Restoration', level: 5 }, {}, playerStats, campaignName, mapName);

            expect(result).toBeNull();
            expect(errorSpy).toHaveBeenCalledWith('[greaterRestoration] Failed to execute Greater Restoration handler:', err);
        });

        it('null spell rejects TypeError — gate/range deref is OUTSIDE the try (catch guards executeHandler only)', async () => {
            await expect(
                triggerGreaterRestoration(null, {}, playerStats, campaignName, mapName),
            ).rejects.toThrow(TypeError);
            expect(executeHandler).not.toHaveBeenCalled();
        });
    });

    describe('confirmGreaterRestoration — passthrough to applyGreaterRestorationEffect', () => {
        it('exact 5-arg identities, result identity; handler null passes through unlogged', async () => {
            const action = envelope({ name: 'Greater Restoration', level: 5 }); // caller-built shape, useSimpleSpellHandlers.js:311
            const result = { targetName: 'Cleric', selections: [{ type: 'condition', condition: 'petrified' }] };
            const sentinel = { type: 'popup', payload: { type: 'automation_info', name: 'Greater Restoration', description: 'Cleric: petrified condition' } };
            applyGreaterRestorationEffect.mockResolvedValue(sentinel);

            const applied = await confirmGreaterRestoration(action, playerStats, campaignName, mapName, result);

            expect(applyGreaterRestorationEffect).toHaveBeenCalledTimes(1);
            expect(applyGreaterRestorationEffect).toHaveBeenCalledWith(action, playerStats, campaignName, mapName, result);
            const [a, stats, campaign, map, res] = applyGreaterRestorationEffect.mock.calls[0];
            expect(a).toBe(action);
            expect(stats).toBe(playerStats);
            expect(campaign).toBe(campaignName);
            expect(map).toBe(mapName);
            expect(res).toBe(result);
            expect(applied).toBe(sentinel);

            applyGreaterRestorationEffect.mockResolvedValue(null); // handler nulls on missing targetName (handler.js:116)
            const nullPass = await confirmGreaterRestoration(action, playerStats, campaignName, mapName, null);
            expect(nullPass).toBeNull();
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('applyGreaterRestorationEffect rejection: identical Error + exact prefix logged, null returned', async () => {
            const err = new Error('Store write failed');
            applyGreaterRestorationEffect.mockRejectedValue(err);

            const result = await confirmGreaterRestoration(envelope({ name: 'Greater Restoration', level: 5 }), playerStats, campaignName, mapName, { targetName: 'Cleric', selections: [] });

            expect(result).toBeNull();
            expect(errorSpy).toHaveBeenCalledWith('[greaterRestoration] Failed to apply Greater Restoration effect:', err);
        });
    });
});
