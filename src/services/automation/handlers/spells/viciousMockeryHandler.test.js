// @maintained-by-ai
/**
 * vicious mockery #1987 — SINGLE spells lane on viciousMockeryHandler.js
 * (59 lines, read fully 2026-10-16). Baseline 8 tests; trimmed by merging the
 * fresh-store/null-store re-runs, strengthened weak pins.
 *
 * LIVE DISPATCH (verified): handleNpcSaveDamage.js L708 + useLoggedDiceRollEventHandlers.js
 * L542 (both CLA-377 save-gated: FAILED save only) → viciousMockeryService.js
 * triggerViciousMockeryForGeneric (builds action.automation.type 'vicious_mockery')
 * → executeHandler → automation/index.js L604 `vicious_mockery: handleViciousMockery`
 * → handle(action, playerStats, campaignName, mapName) below — arity 4 positional.
 * ray_of_enfeeblement is separately registered at L601 — distinct live producer.
 *
 * BYTE-TWIN NOTE (final-report consolidation, NO source edit here): the te
 * find/replace-or-push block L16-31 is a byte-twin of rayOfEnfeeblementHandler.js
 * L149-170 (ray lane closed #1945 — consolidation note recorded there + ledger).
 * Both sources are live, separately registered writers of the SHARED multi-
 * producer channel te `disadvantage_next_attack` (targetEffectDefinitions.js L31);
 * ray's lane pins ray's own writes, this lane pins ours — not dupes.
 *
 * RULES SHAPE — pin what IS (manifest CLA-377, verified PASS 2026-10-09):
 *  - WIS save + psychic damage (1d6 tier-scaled) are adjudicated UPSTREAM by the
 *    generic spell flow (savePath.js, handleNpcSaveDamage.js — pinned in their own
 *    lanes). This handler runs on the failed leg only and unconditionally writes
 *    the one-shot te; reason string '(failed save)' reflects the upstream gate.
 *  - NOT the ray shape: no CON save prompt, no concentration, no slotLevel/dc,
 *    no strCheckDisadvantage, no rayOfEnfeebleDamageReduction (-1d8), no
 *    activeConditionMeta, no recurring end-of-turn save. te is exactly
 *    {target, source, effect} — strict toEqual pins the absence of ray flags.
 *  - ONE-SHOT expiry on the caster-turn seam: addExpiration rounds undefined +
 *    expireOnCreatureName=caster ("until the start of caster's next turn").
 *    Consumed/cleared by attackPostProcessing (pinned in its lane).
 *
 * NO-TIMERS audit: no setTimeout/setInterval; expiry is an initiative seam
 * (expireOnCreatureName), never a wall-clock. No minutes×N legacy.
 *
 * EXPORTS (#1916 enumerate): module exports ONLY `handle` — consumed live at
 * automation/index.js L268/L604 (dispatch chain above). No dead exports.
 *
 * abilities-ARRAY note: handler reads only playerStats.name; makePlayerStats'
 * abilities stays an array per repo shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './viciousMockeryHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => []),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imported mocks ─────────────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestBard',
        level: 1,
        proficiency: 2,
        spellAbilities: { saveDc: 12, modifier: 1 },
        abilities: [{ name: 'Charisma', bonus: 1 }],
        automation: {},
        ...overrides,
    };
}

// MERGE semantics: automation overrides fold onto the default automation so a
// partial override still carries targetName unless explicitly replaced.
function makeAction(overrides = {}) {
    const { automation, ...rest } = overrides;
    return {
        name: 'Vicious Mockery',
        automation: { type: 'vicious_mockery', targetName: 'Goblin', ...(automation || {}) },
        ...rest,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('viciousMockeryHandler', () => {
    beforeEach(() => {
        vi.resetAllMocks(); // restores factory defaults (te store [], resolved addEntry)
    });

    it('writes the exact disadvantage_next_attack te — fresh store, null-store guard, single write, no meta lane', async () => {
        getRuntimeValue.mockReturnValue([]);

        await handle(makeAction(), makePlayerStats(), 'test-campaign', 'TestMap');

        // Strict shape: no ray-family flags leak onto our te
        // (no strCheckDisadvantage, rayOfEnfeebleDamageReduction, dc, slotLevel, duration).
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
            { target: 'Goblin', source: 'TestBard', effect: 'disadvantage_next_attack' },
        ], 'test-campaign');

        // null store: `|| []` guard yields a fresh array
        vi.resetAllMocks();
        getRuntimeValue.mockReturnValue(null);

        await handle(makeAction(), makePlayerStats(), 'test-campaign', 'TestMap');

        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
            { target: 'Goblin', source: 'TestBard', effect: 'disadvantage_next_attack' },
        ], 'test-campaign');
        // No side lanes: this handler never writes activeConditionMeta (ray does — ours does not)
        expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditionMeta')).toHaveLength(0);
    });

    it('logs the condition-applied entry with exact condition/reason/note strings (CLA-377 fail leg)', async () => {
        await handle(makeAction(), makePlayerStats(), 'test-campaign', 'TestMap');

        expect(addEntry).toHaveBeenCalledTimes(1); // single log site — the condition-applied entry
        expect(addEntry).toHaveBeenCalledWith('test-campaign', {
            type: 'condition',
            action: 'applied',
            characterName: 'Goblin',
            condition: 'Disadvantage on next attack',
            reason: 'Vicious Mockery (failed save)',
            note: 'Goblin has Disadvantage on the next attack roll until the start of TestBard\'s next turn.',
            timestamp: expect.any(Number),
        });
    });

    it('returns the exact popup payload — automation_info with own-composition psychic description', async () => {
        const action = makeAction();

        const result = await handle(action, makePlayerStats(), 'test-campaign', 'TestMap');

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Vicious Mockery',
                targetName: 'Goblin',
                description: 'Goblin takes psychic damage and has Disadvantage on the next attack roll until the start of TestBard\'s next turn.',
                automation: action.automation,
            },
        });
    });

    it('queues the one-shot expiration on the caster-turn seam — rounds undefined, expireOnCreatureName=caster', async () => {
        await handle(makeAction(), makePlayerStats(), 'test-campaign', 'TestMap');

        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'TestBard',
            targetName: 'Goblin',
            effects: [{
                type: 'remove_target_effect',
                effectKey: 'disadvantage_next_attack',
                source: 'TestBard',
            }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'TestBard',
        });
    });

    it('replaces the same-source te in place, keeps other sources and unrelated te', async () => {
        const otherSourceEffect = { target: 'Goblin', effect: 'disadvantage_next_attack', source: 'OtherCaster' };
        const unrelatedEffect = { target: 'Goblin', effect: 'blinded', source: 'OtherCaster' };
        getRuntimeValue.mockReturnValue([
            { target: 'Goblin', effect: 'disadvantage_next_attack', source: 'TestBard' },
            otherSourceEffect,
            unrelatedEffect,
        ]);

        await handle(makeAction(), makePlayerStats(), 'test-campaign', 'TestMap');

        const newEffects = setRuntimeValue.mock.calls[0][2];
        expect(newEffects).toHaveLength(3);
        expect(newEffects[0]).toEqual({
            target: 'Goblin',
            source: 'TestBard',
            effect: 'disadvantage_next_attack',
        });
        expect(newEffects[1]).toBe(otherSourceEffect);
        expect(newEffects[2]).toBe(unrelatedEffect);
    });

    it('defaults targetName to Unknown when automation is missing or null', async () => {
        const resultMissing = await handle({ name: 'Vicious Mockery' }, makePlayerStats(), 'test-campaign', 'TestMap');
        expect(resultMissing.payload.targetName).toBe('Unknown');
        expect(resultMissing.payload.automation).toEqual({});

        const resultNull = await handle({ name: 'Vicious Mockery', automation: null }, makePlayerStats(), 'test-campaign', 'TestMap');
        expect(resultNull.payload.targetName).toBe('Unknown');

        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects',
            expect.arrayContaining([expect.objectContaining({ target: 'Unknown', effect: 'disadvantage_next_attack', source: 'TestBard' })]),
            'test-campaign');
    });

    it('survives addEntry rejection — console.error at the single log site, popup still resolves', async () => {
        addEntry.mockRejectedValueOnce(new Error('Log write failed'));
        const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

        const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'TestMap');

        expect(result.type).toBe('popup');
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('[viciousMockery] Error:', expect.any(Error));
        consoleSpy.mockRestore();
    });
});
