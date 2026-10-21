// @maintained-by-ai
// Lane: src/services/rules/features/regenerateService.js — SOLE real-body owner of
// BOTH exports. Neither export runs live under the turn-start tick lanes:
// turnStartEffects.js inline-computes every regen tick (grep: zero imports of this
// service there) — those tick bytes belong to applyTurnStartEffects.test.js L250-264
// (buff heal 10->11 + elder champion clamp 18->20 + inactive-negative, #1283) and
// expirations_additional.test.js L247/L268 (second tick + FIXED distinguishable
// healExpression face, #1296). restRules-longRest lanes own LR re-arms (#1297:
// exactly TWO tick pins repo-wide — none regrown here). This file pins the two
// SERVICE BODIES ONLY: the name gate, action-envelope composition, byte-forwarding,
// and error paths of the delegates it calls.
// Live/dead map (grep 2026-10-21, caller evidence for EVERY export, #1370):
//   triggerRegenerate(spell, metaCtx, playerStats, campaignName, mapName) — ZERO
//     prod callers (dormant dispatch edge into executeHandler; regenerateHandler.test.js
//     liveness audit concurs, owner retirement decision pending). Pinned as the exact
//     callable contract so either direction stays safe.
//   confirmRegenerate(action, playerStats, campaignName, mapName, targetName) — LIVE:
//     useSimpleSpellHandlers.js runRegenerate L127 -> applyRegenerateEffect direct;
//     production caller passes mapName=null and a targetName STRING — mirrored below.
// Quirk scan verdicts:
//   * GOLDEN #1360: source L4 `spell.name` derefs the spell OUTSIDE the try block —
//     nullish spell propagates TypeError with console untouched. Pinned (rejects).
//   * :0-coercion census (#1374): L11 `spell.range || 'Touch'` — '' and 0 collapse
//     to 'Touch' (rows in dispatch test); no other :0 face in this body.
//   * metaCtx param declared but NEVER read — exact dispatched-key census proves
//     non-forwarding (never-executed guard: ZERO here; silent-null guards: ZERO —
//     every null return is behind a logged catch or the pinned name gate).
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
import { triggerRegenerate, confirmRegenerate } from './regenerateService.js';
import { executeHandler, applyRegenerateEffect } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
    applyRegenerateEffect: vi.fn(),
}));

describe('regenerateService', () => {
    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = { name: 'Cleric', proficiency: 4 };

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('triggerRegenerate', () => {
        // Name gate, source L4: `(spell.name || '') === 'Regenerate'` — strict ===,
        // case-split, whitespace-split, and the falsy-name triple all return null
        // BEFORE the try block: zero dispatch, zero console.
        it.each([
            ['non-healing spell "Heal"', { name: 'Heal', level: 1 }],
            ['non-matching "Cure Wounds"', { name: 'Cure Wounds', level: 1 }],
            ['lowercase "regenerate"', { name: 'regenerate', level: 7 }],
            ['uppercase "REGENERATE"', { name: 'REGENERATE', level: 7 }],
            ['trailing-space "Regenerate "', { name: 'Regenerate ', level: 7 }],
            ['leading-space " Regenerate"', { name: ' Regenerate', level: 7 }],
            ['missing name key', { level: 7 }],
            ['null name', { name: null, level: 7 }],
            ['empty-string name', { name: '', level: 7 }],
        ])('gate returns null and dispatches nothing for %s', async (_label, spell) => {
            const result = await triggerRegenerate(spell, {}, playerStats, campaignName, mapName);
            expect(result).toBeNull();
            expect(executeHandler).toHaveBeenCalledTimes(0);
        });

        // Envelope composition, source L7-14: full-set match, exact key order,
        // spell passed BY REFERENCE (identity), metaCtx never forwarded, range
        // coercion rows ('' and 0 collapse to the 'Touch' default), arg arity/purity.
        it('dispatches the exact action envelope and forwards args byte-identically', async () => {
            const spellNoRange = { name: 'Regenerate', level: 7 };
            const spellTouch = { name: 'Regenerate', level: 7, range: 'Touch' };
            const spellCustom = { name: 'Regenerate', level: 7, range: '60 feet' };
            const spellEmpty = { name: 'Regenerate', level: 7, range: '' };
            const spellZero = { name: 'Regenerate', level: 7, range: 0 };
            const metaCtx = { metaOnlySentinel: 'must never reach the dispatcher' };
            executeHandler.mockResolvedValue({ type: 'popup' });

            await triggerRegenerate(spellNoRange, metaCtx, playerStats, campaignName, mapName);
            await triggerRegenerate(spellTouch, metaCtx, playerStats, campaignName, mapName);
            await triggerRegenerate(spellCustom, metaCtx, playerStats, campaignName, mapName);
            await triggerRegenerate(spellEmpty, metaCtx, playerStats, campaignName, mapName);
            await triggerRegenerate(spellZero, metaCtx, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(5);
            expect(executeHandler.mock.calls.map(c => c[0].automation.range))
                .toEqual(['Touch', 'Touch', '60 feet', 'Touch', 'Touch']);

            const dispatched = executeHandler.mock.calls[2][0];
            expect(Object.keys(dispatched)).toEqual(['name', 'automation', 'spell']);
            expect(Object.keys(dispatched.automation)).toEqual(['type', 'range']);
            expect(dispatched).toEqual({
                name: 'Regenerate',
                automation: { type: 'regenerate', range: '60 feet' },
                spell: spellCustom,
            });
            expect(dispatched.spell).toBe(spellCustom); // same reference — no clone
            // Args passthrough incl. arity (no injected 5th arg).
            const args = executeHandler.mock.calls[0];
            expect(args).toHaveLength(4);
            expect(args[1]).toBe(playerStats);
            expect(args[2]).toBe(campaignName);
            expect(args[3]).toBe(mapName);
            // Input purity (#1395): inputs unchanged after five dispatches.
            expect(spellCustom).toEqual({ name: 'Regenerate', level: 7, range: '60 feet' });
            expect(metaCtx).toEqual({ metaOnlySentinel: 'must never reach the dispatcher' });
        });

        // Success is identity pass-through (source L18); failure swallows to null
        // with the EXACT prefix and the SAME Error instance logged once (L20, #1385).
        it('returns the handler result unchanged, or null with one exact console.error on rejection', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const sentinel = { type: 'popup', payload: { type: 'automation_info', name: 'Regenerate', description: 'Applied' } };
            executeHandler.mockResolvedValue(sentinel);
            const ok = await triggerRegenerate({ name: 'Regenerate', level: 7 }, {}, playerStats, campaignName, mapName);
            expect(ok).toBe(sentinel);
            expect(consoleSpy).toHaveBeenCalledTimes(0);

            const err = new Error('Connection refused');
            executeHandler.mockRejectedValue(err);
            const failed = await triggerRegenerate({ name: 'Regenerate', level: 7 }, {}, playerStats, campaignName, mapName);
            expect(failed).toBeNull();
            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledWith('[regenerate] Failed to execute Regenerate handler:', err);
            expect(consoleSpy.mock.calls[0][1]).toBe(err);
        });

        // GOLDEN quirk (#1360 class): the name gate at source L4 derefs spell
        // OUTSIDE the try — nullish spell throws TypeError that the catch cannot
        // see, and the console stays untouched. Pin the propagated TypeError bytes.
        it.each([
            ['undefined', undefined],
            ['null', null],
        ])('propagates TypeError (console untouched) when spell is %s', async (label, spell) => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            await expect(triggerRegenerate(spell, {}, playerStats, campaignName, mapName))
                .rejects.toThrow(`Cannot read properties of ${label} (reading 'name')`);
            expect(executeHandler).toHaveBeenCalledTimes(0);
            expect(consoleSpy).toHaveBeenCalledTimes(0);
        });
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
