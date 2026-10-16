// @maintained-by-ai
/**
 * confusion TRIO lane #1891 — confusionTurnStartHandler.js (distinct module; trio
 * seam map lives in confusionHandler.saveResults.test.js header).
 *
 * CONSUMED INPUT (from #1889 confusionHandler.saveResults failure path): the te
 * {target, effect:'confusion', source, dc, conditions, duration:'concentration'} —
 * this lane pins CONSUMPTION of that te (identity match target+effect, dc read),
 * not its production. Producer verified 2026-10-16: confusionHandler.js L79 also
 * registers the 'confusion_turn_start' expiration consumed by the dispatcher below.
 *
 * LIVE lane (full pins maintained): handleConfusionTurnStart — production chain
 * verified at source 2026-10-16:
 *   confusionHandler.js L79 addExpiration 'confusion_turn_start'
 *   → rules/effects/turnStartEffects.js L181 dispatcher entry
 *   → applyConfusionTurnStart L618 → handleConfusionTurnStart call L619.
 * Every other consumer suite (turnStartEffects.*.test.js, expirations_*.test.js)
 * vi.mocks this module with a handleConfusionTurnStart stub only, so THIS file is
 * the only mutation-killing coverage of the d10 behavior table — a () => {}
 * mutant survives all other suites. Full-file deletion: NOT permitted.
 *
 * DEAD-API audit (assigned from #1889/#1890 flags) — verdict: DEAD, deletion
 * recommended (evidence, verified 2026-10-16):
 *  - applyEndOfTurnConfusionSave: zero production callers (grep src/ + server/ +
 *    docs/automations-manifest.json hits only this module + its test). No export *
 *    barrel re-exports it; no dynamic import of the module exists. Its promptId
 *    prefix 'confusion-end-turn-' is consumed NOWHERE — and it cannot work even if
 *    wired: the real save-listener lane (services/automation/common/savePrompt.js
 *    createSaveListener L105+) registers pendingSavePrompts[promptId] + payload
 *    and sends the prompt; this function only pushes a raw id onto
 *    pendingSaveListenerPrompts, which useLoggedDiceRollEventHandlers.js L33-40
 *    merely filters — an unregistered id never resolves a save.
 *  - removeConfusionEffect: zero production callers. The initiative-reroll WIS
 *    save lane createRollConditionSaveHandler.handleConfusionSuccess
 *    (components/initiative/createRollConditionSaveHandler.js L97-122) performs
 *    its OWN removal via removeCondition(charmed)+removeCondition(speed_zero)+
 *    removeTargetEffect — it never calls this export.
 *  - Deletion safety: no other test file imports these two exports (all module
 *    mocks elsewhere stub handleConfusionTurnStart only), so deleting both exports
 *    + their two DEAD describes is independently zero-coverage-loss. Kept as
 *    minimal API-surface pins until owner confirms deletion.
 *
 * Prod dupes flagged (owned by turnStartEffects lane, NOT re-pinned here):
 *  - applyConfusionTurnStart re-logs type 'condition'/action 'turn_start_behavior'
 *    with the same fields handleConfusionTurnStart already logged (double log).
 *
 * Rules note: this is the module's own 4-band d10 table (1=move_random,
 * 2-6=do_nothing, 7-8=attack_random, 9-10=choose) + d4 direction sub-table
 * (1=N,2=E,3=S,4=W) — pinned strict over all rows. Turn-based only: the
 * "end-of-turn save" is an event seam; nothing here is a clock.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { handleConfusionTurnStart, applyEndOfTurnConfusionSave, removeConfusionEffect } from './confusionTurnStartHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../services/ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const TARGET = 'Goblin';

// The te shape #1889's failure path writes — consumed here (identity + dc).
function makeConfusionEffect(overrides = {}) {
    return {
        target: TARGET,
        effect: 'confusion',
        source: 'TestCaster',
        dc: 13,
        duration: 'concentration',
        conditions: ['charmed', 'speed_zero'],
        ...overrides,
    };
}

// Deterministic dice queue: floor(f*10)+1 === n with ≥0.001 margin from the
// next integer, so float noise cannot flip a band boundary.
const d10Fraction = (n) => (n - 1) / 10 + 1e-4;
const d4Fraction = (d) => (d - 1) / 4 + 1e-4;

let rollSpy = null;
function mockRolls(values) {
    let i = 0;
    rollSpy = vi.spyOn(Math, 'random').mockImplementation(() => values[i++] ?? 0.999);
}
afterEach(() => {
    rollSpy?.mockRestore();
    rollSpy = null;
});

// Key-router for getRuntimeValue so each test targets exactly one read.
function mockRuntime(map) {
    getRuntimeValue.mockImplementation((scope, key) => (key in map ? map[key] : undefined));
}

// ── LIVE lane: handleConfusionTurnStart ────────────────────────

describe('handleConfusionTurnStart (live: turnStartEffects L181→L619)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reads the te store with the exact store key and nothing else', async () => {
        mockRuntime({ targetEffects: [makeConfusionEffect()] });

        await handleConfusionTurnStart(TARGET, campaignName);

        expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects');
        // Pure reader: this function writes no runtime state.
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it.each([
        ['empty targetEffects', []],
        ['missing targetEffects', undefined],
    ])('returns null with no side effects when %s', async (_label, stored) => {
        mockRuntime({ targetEffects: stored });

        const result = await handleConfusionTurnStart(TARGET, campaignName);

        expect(result).toBeNull();
        expect(addEntry).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('ignores effects with a mismatched target or effect key', async () => {
        mockRuntime({
            targetEffects: [
                makeConfusionEffect({ target: 'Orc' }),
                makeConfusionEffect({ effect: 'fear' }),
            ],
        });

        const result = await handleConfusionTurnStart(TARGET, campaignName);

        expect(result).toBeNull();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('rolls a real d10 (1-10), reports the consumed te dc, logs once', async () => {
        mockRuntime({ targetEffects: [makeConfusionEffect()] });

        const result = await handleConfusionTurnStart(TARGET, campaignName);

        expect(Number.isInteger(result.d10Roll)).toBe(true);
        expect(result.d10Roll).toBeGreaterThanOrEqual(1);
        expect(result.d10Roll).toBeLessThanOrEqual(10);
        expect(result.dc).toBe(13);
        expect(['move_random', 'do_nothing', 'attack_random', 'choose']).toContain(result.behavior);
        expect(addEntry).toHaveBeenCalledTimes(1);
    });

    // Module's own d10 band table, strict over all 10 rows: full own-composition
    // behaviorText + behavior key + echoed roll value.
    it.each([
        [1, 'move_random', 'Rolled 1: Goblin moves randomly to the north. No action taken.'],
        [2, 'do_nothing', 'Rolled 2: Goblin does nothing (no movement or actions).'],
        [3, 'do_nothing', 'Rolled 3: Goblin does nothing (no movement or actions).'],
        [4, 'do_nothing', 'Rolled 4: Goblin does nothing (no movement or actions).'],
        [5, 'do_nothing', 'Rolled 5: Goblin does nothing (no movement or actions).'],
        [6, 'do_nothing', 'Rolled 6: Goblin does nothing (no movement or actions).'],
        [7, 'attack_random', 'Rolled 7: Goblin takes the Attack action against a random creature within reach.'],
        [8, 'attack_random', 'Rolled 8: Goblin takes the Attack action against a random creature within reach.'],
        [9, 'choose', 'Rolled 9: Goblin chooses its own behavior.'],
        [10, 'choose', 'Rolled 10: Goblin chooses its own behavior.'],
    ])('d10=%i → behavior %s, exact text', async (roll, behavior, text) => {
        mockRuntime({ targetEffects: [makeConfusionEffect()] });
        mockRolls([d10Fraction(roll), d4Fraction(1)]);

        const result = await handleConfusionTurnStart(TARGET, campaignName);

        expect(result).toEqual({
            behavior,
            d10Roll: roll,
            dc: 13,
            behaviorText: text,
        });
    });

    // d4 direction sub-table, only reachable on d10=1.
    it.each([
        [1, 'north'],
        [2, 'east'],
        [3, 'south'],
        [4, 'west'],
    ])('d10=1, d4=%i moves %s', async (d4, dir) => {
        mockRuntime({ targetEffects: [makeConfusionEffect()] });
        mockRolls([d10Fraction(1), d4Fraction(d4)]);

        const result = await handleConfusionTurnStart(TARGET, campaignName);

        expect(result.behaviorText).toBe(
            `Rolled 1: ${TARGET} moves randomly to the ${dir}. No action taken.`
        );
    });

    it('reports the consumed te dc unchanged (no recomputation)', async () => {
        mockRuntime({ targetEffects: [makeConfusionEffect({ dc: 17 })] });
        mockRolls([d10Fraction(8)]);

        const result = await handleConfusionTurnStart(TARGET, campaignName);

        expect(result.dc).toBe(17);
    });

    it('logs the behavior with the exact own-composition entry', async () => {
        mockRuntime({ targetEffects: [makeConfusionEffect()] });
        mockRolls([d10Fraction(8)]);

        await handleConfusionTurnStart(TARGET, campaignName);

        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'condition',
            action: 'turn_start_behavior',
            characterName: TARGET,
            condition: 'Confused',
            reason: 'Confusion spell turn-start effect',
            note: 'Rolled 8: Goblin takes the Attack action against a random creature within reach.',
            timestamp: expect.any(Number),
        });
    });

    it('still returns the behavior object when addEntry rejects', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
        mockRuntime({ targetEffects: [makeConfusionEffect()] });
        mockRolls([d10Fraction(3)]);
        addEntry.mockRejectedValueOnce(new Error('Log error'));

        const result = await handleConfusionTurnStart(TARGET, campaignName);

        expect(result.behavior).toBe('do_nothing');
        expect(result.d10Roll).toBe(3);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});

// ── DEAD API surface (see header audit — deletion recommended) ─

describe('applyEndOfTurnConfusionSave [DEAD API — zero prod callers]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null and writes nothing when no confusion te exists', () => {
        mockRuntime({ targetEffects: [makeConfusionEffect({ target: 'Orc', effect: 'fear' })] });

        expect(applyEndOfTurnConfusionSave(TARGET, campaignName, 13, 'WIS')).toBeNull();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns the prompt stub: te dc wins, passed saveDc/saveType fill gaps', () => {
        mockRuntime({ targetEffects: [makeConfusionEffect({ dc: 17 })] });

        const result = applyEndOfTurnConfusionSave(TARGET, campaignName, 13);

        expect(result).toEqual({
            promptId: expect.stringMatching(/^confusion-end-turn-/),
            dc: 17,
            saveType: 'WIS',
            targetName: TARGET,
        });
    });

    it.each([
        { seed: ['existing-prompt'], expectedLen: 2 },
        { seed: undefined, expectedLen: 1 },
    ])('stamps the promptId onto campaign pendingSaveListenerPrompts (seed $seed)', ({ seed, expectedLen }) => {        mockRuntime({
            targetEffects: [makeConfusionEffect()],
            pendingSaveListenerPrompts: seed,
        });

        applyEndOfTurnConfusionSave(TARGET, campaignName, 13, 'INT');

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'pendingSaveListenerPrompts',
            expectedLen === 2
                ? ['existing-prompt', expect.stringMatching(/^confusion-end-turn-/)]
                : [expect.stringMatching(/^confusion-end-turn-/)],
            campaignName,
        );
    });
});

describe('removeConfusionEffect [DEAD API — removal is createRollConditionSaveHandler\'s own lane]', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('filters charmed/speed_zero (case-insensitive) and the confusion te, logging removal', () => {
        const fearTe = { target: 'Orc', effect: 'fear', source: 'Caster' };
        mockRuntime({
            activeConditions: ['CHARMED', 'speed_zero', 'blinded'],
            targetEffects: [makeConfusionEffect(), fearTe],
        });

        removeConfusionEffect(TARGET, campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['blinded'], campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [fearTe], campaignName);
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'condition',
            action: 'removed',
            characterName: TARGET,
            condition: 'Confused',
            reason: 'Successful WIS save at end of turn',
            timestamp: expect.any(Number),
        });
    });

    it.each([
        ['undefined', undefined],
        ['non-array junk', 'not-an-array'],
    ])('writes empty arrays when stored state is %s', (_label, stored) => {
        mockRuntime({ activeConditions: stored, targetEffects: stored });

        removeConfusionEffect(TARGET, campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', [], campaignName);
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], campaignName);
    });
});
