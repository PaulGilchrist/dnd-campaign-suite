// @maintained-by-ai
/**
 * greaterRestorationService lane — CONFIRM PASS-THROUGH ONLY (thin wrapper).
 *
 * Export pinned here (per export map):
 *  - confirmGreaterRestoration: unguarded-args passthrough of the exact
 *    5-identity tuple into applyGreaterRestorationEffect (= handler.applyGreaterRestoration,
 *    automation/index.js:231 alias), catch → null + exact-prefix log.
 *
 * Caller evidence: confirmGreaterRestoration is the LIVE export —
 * useSimpleSpellHandlers.js:311 consumeThenApply('Diamond Dust (100 gp)')
 * matches the disk material literal ('Diamond dust worth at least 100gp,
 * which the spell consumes.'), building its own envelope (caller-side envelope
 * owned by useSpellMetamagicFlow.confirm-payloads.test.js).
 * triggerGreaterRestoration was DELETED here #1370 (dead-export batch): ZERO
 * production callers — the spell bar dispatches greater_restoration straight
 * to the handler (dispatch automation/index.js:560 → greaterRestorationHandler
 * .handle); its name-gate/envelope/range-default lanes (incl. the disk-canon
 * block that justified the 'greater restoration' gate literal and 'Touch'
 * default) retired with it — envelope-shape coverage survives in
 * confirm-payloads.test.js and greaterRestorationHandler.test.js.
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
 * Over-mock check: vi.mock of the automation barrel is the correct boundary —
 * the barrel re-exports 200+ handlers; this lane's contract IS the call
 * tuple into its sole dependency.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { confirmGreaterRestoration } from './greaterRestorationService.js';
import { applyGreaterRestorationEffect } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
    applyGreaterRestorationEffect: vi.fn(),
}));

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const playerStats = { name: 'Cleric', proficiency: 4 };

// Exact caller-built envelope shape the handler consumes — 3 keys, nothing
// more (byte-lock; useSimpleSpellHandlers.js:311 builds this caller-side).
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
