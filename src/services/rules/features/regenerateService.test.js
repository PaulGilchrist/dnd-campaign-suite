// @maintained-by-ai
// Lane: src/services/rules/features/regenerateService.js — SOLE real-body owner of
// confirmRegenerate. The former second export, triggerRegenerate, was EXCISED by the
// #1398 dead-export census batch (2026-10-23) after RE-VERIFICATION against fix#211's
// fresh bytes: fix#211 (#1483/#1472) made the LIVE lane via the SERVICE_HANDLED_SPELLS
// shield 'regenerate' (triggerSpells.js:64) -> execution/index.js:314 handleRegenerate
// -> helpers.applyRegenerateSpell :486 (disk-byte cast) and via spellGates.js:642/:833
// gateRegenerate -> useSimpleSpellHandlers.js runRegenerate :124 -> confirmRegenerate
// (modal cast) — WITHOUT ever wiring triggerRegenerate; fresh grep census shows it
// stayed ZERO-prod-caller (dead forwarder into executeHandler). The registry entry
// automation/index.js:614 ('regenerate': handleRegenerate) remains as fix#211's
// registry shield — route home, never edited here. Neither remaining export runs
// live under the turn-start tick lanes:
// turnStartEffects.js inline-computes every regen tick (grep: zero imports of this
// service there) — those tick bytes belong to applyTurnStartEffects.test.js L250-264
// (buff heal 10->11 + elder champion clamp 18->20 + inactive-negative, #1283) and
// expirations_additional.test.js L247/L268 (second tick + FIXED distinguishable
// healExpression face, #1296). restRules-longRest lanes own LR re-arms (#1297:
// exactly TWO tick pins repo-wide — none regrown here). This file pins the
// confirmRegenerate BODY ONLY: byte-forwarding, arity, and error paths of the
// delegate it calls (the excised forwarder's name-gate/envelope rows are gone).
// Live/dead map (grep re-census 2026-10-23 dead-export batch, caller evidence):
//   triggerRegenerate — EXCISED (was ZERO prod callers; dormant dispatch edge into
//     executeHandler; regenerateHandler.test.js liveness audit concurs; retirement
//     EXECUTED this batch — see lane header for the fix#211 route-home citation).
//   confirmRegenerate(action, playerStats, campaignName, mapName, targetName) — LIVE:
//     useSimpleSpellHandlers.js runRegenerate L127 -> applyRegenerateEffect direct;
//     production caller passes mapName=null and a targetName STRING — mirrored below.
// Quirk scan verdicts (triggerRegenerate-era rows — GOLDEN #1360 deref,
// :0-coercion range 'Touch', metaCtx-never-read — were retired WITH the excised
// forwarder; the honest old pins are gone, not re-grown, per fix#297 method):
//   * No-clock policy: zero Date.now/setTimeout/setInterval in this body — the
//     'start of each turn' seam lives upstream in turnStartEffects.js (clean).
//   * HP-key census: this body writes NO store keys at all (import census: only
//     automation/index.js) — 'currentHitPoints' pins live in the tick lanes above.
//   * Zero dice (RAW): fixed pass-through only, no rolls to stub — declared.
// Standards: vi.resetAllMocks + explicit re-seed per test (#1312); full-set toEqual
// envelopes + exact object key arrays + toBe identity; console.error exact prefix +
// identical Error instance + call-count (#1385); spies restored in afterEach; input
// purity snapshots (#1395); no bare toHaveBeenCalled()/objectContaining on mutations.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { confirmRegenerate } from './regenerateService.js';
import { executeHandler, applyRegenerateEffect } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
    applyRegenerateEffect: vi.fn(),
}));

describe('regenerateService', () => {
    const campaignName = 'TestCampaign';
    const playerStats = { name: 'Cleric', proficiency: 4 };

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('confirmRegenerate', () => {
        // LIVE lane. Mirror production caller bytes (runRegenerate): mapName=null
        // forwarded exactly, targetName STRING, five-arg arity, no re-wrapping.
        it('forwards all five args byte-identically and returns the applied result unchanged', async () => {
            const spell = { name: 'Regenerate', level: 7 };
            const action = { name: 'Regenerate', spell, automation: { type: 'regenerate', range: 'Touch' } };
            const targetName = 'Goblin';
            const sentinel = { applied: true, healAmount: 33 };
            applyRegenerateEffect.mockResolvedValue(sentinel);

            const result = await confirmRegenerate(action, playerStats, campaignName, null, targetName);

            expect(result).toBe(sentinel);
            expect(applyRegenerateEffect).toHaveBeenCalledTimes(1);
            const args = applyRegenerateEffect.mock.calls[0];
            expect(args).toHaveLength(5);
            expect(args[0]).toBe(action);
            expect(args[1]).toBe(playerStats);
            expect(args[2]).toBe(campaignName);
            expect(args[3]).toBeNull(); // mapName null preserved, not coerced
            expect(args[4]).toBe(targetName);
            expect(args[4]).toEqual('Goblin'); // STRING, not the selection object
            // Input purity: action untouched.
            expect(action).toEqual({
                name: 'Regenerate',
                spell: spell,
                automation: { type: 'regenerate', range: 'Touch' },
            });
        });

        // Failure lane, source L29-31: null + exact prefix + identical instance, once.
        it('logs the exact rejection once and returns null when the effect throws', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const err = new Error('Database error');
            applyRegenerateEffect.mockRejectedValue(err);
            const action = { name: 'Regenerate', automation: { type: 'regenerate', range: 'Touch' } };
            const result = await confirmRegenerate(action, playerStats, campaignName, null, 'Goblin');
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith('[regenerate] Failed to apply Regenerate effect:', err);
            expect(consoleSpy.mock.calls[0][1]).toBe(err);
            expect(executeHandler).toHaveBeenCalledTimes(0); // confirm never dispatches
        });
    });
});
