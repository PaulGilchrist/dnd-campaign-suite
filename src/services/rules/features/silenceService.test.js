// @maintained-by-ai
/**
 * silenceService — zone-membership / targetEffects store accessor.
 * Lane map (verified 2026-10-22):
 *   - LIVE production surface: getSilenceSource + isCreatureInSilenceZone
 *     (Verbal gate: execution/index.js:172-173; the twin gate at the retired
 *     spellResolution.js:54-55 was excised with the barrel, fix#301;
 *     thunder side: applyDamage.js:294), addSilencedTarget
 *     (SilenceModal.jsx:115), removeSilencedTargets (silenceHandler.js:79).
 *   - DEAD in production — EXCISED by the #1413/#1420 dead-export census batch
 *     (2026-10-23, fix#82/fix#97 wholesale-excision precedent): triggerSilence
 *     and getSilencedTargets no longer exist. triggerSilence had been pinned
 *     here as a DRIFT DETECTOR for the inline modalSpells builder; the mirror
 *     comment at modalSpells.js :235-:246 now states the parity-mirror bytes
 *     are its SOLE home (the silenceService fixed parsers went with the
 *     forwarder). getSilencedTargets (ZERO callers incl. internal) deleted;
 *     its effect+source filter law stays pinned by the LIVE sibling lanes
 *     below (addSilencedTarget / removeSilencedTargets / zone membership).
 *   - RESIDUAL (REPORTED, not owned here): modalSpells.js:234-239 keeps the
 *     OLD defective regex pair — same numeric-.match crash + plural-feet
 *     silent-120 — its lane owns that twin fix.
 *   - Zone STORE WRITES (silenceCaster/silenceCenter/silenceRadius triple):
 *     SilenceModal.test.jsx. clear_silence_zone expiry seam:
 *     clearExpirationEffects_additional_types.test.js ("Cited by" — verbatim:
 *     "SilenceModal.test.jsx (clear_silence_zone zone consumption)").
 *   - Zone round maturation: zoneDurationClock.test.js; turn-END repeat saves:
 *     repeatSaveService.test.js (Djinni shapeless-emanation form).
 *     Silence's te is 'silenced' — targetEffectDefinitions.js:993-999 owns the
 *     registry row: "Silenced / Deafened and cannot cast spells with Verbal
 *     components." Silence is a 20-ft SPHERE (spells.json:8902,
 *     2024/spells.json:11724) — this lane consumes te membership only, never
 *     registers a zone row, so the registry-read zone lanes do not front here.
 *   - Free-cast grant of 'Silence' (2024/classes.json:6619 Shadow Arts):
 *     spellPreparationService free-cast lanes own rest-counters — cited, not owned.
 * NO-CLOCK: duration is a constant string on the trigger envelope
 *   ('Concentration, up to 10 minutes'); membership rides the silenceCaster
 *   strict-true flag + concentration te, cleared at addExpiration seams.
 *   This lane stamps no countdown, no minutes×N, no Date.now. CLEAN.
 * Zero dice — no RNG seam needed (RAW: Silence has no saving throw).
 * Quirks (#1413 FOUR-FIX, 2026-10-22):
 *   Q1 case-gate split — RETIRED with the excised triggerSilence lane
 *      (census batch 2026-10-23); the live gate is modalSpells handleSilence's
 *      lowercase name==='silence' alone, pinned by the modalSpells lane.
 *   Q2 FIXED (a) / Q3 FIXED (b): parser law (numeric-first size, feet/mile
 *      token set, LOUD refuse) now lives SOLELY in the modalSpells parity
 *      mirror (:247-:277, cited above) — the silenceService parser twins and
 *      their #1348 range/size arm tables were excised with triggerSilence.
 *   Q4 FIXED (c): center JSON.parse guarded — corrupt string LOUD
 *      (console.error) then documented no-center arm (caster stands at center).
 *   Q5 FIXED (d): combatSummary rerouted to campaign-keyed
 *      encounters/combatData.getCombatSummary(campaignName) (fix#77/#1074
 *      ARM-B family); runtime-store 'campaign|combatSummary' read is now
 *      TRIPWIRED in this fake — exact-arg campaign pin below. Underlying
 *      arity-2 store blindness stays deferred infra #1520.
 * #1348 ARM TABLES (coverage contract):
 *   center arm table:         null->caster-only | JSON string->geometry |
 *                               plain object->geometry | '{oops'->LOUD+caster-only |
 *                               JSON non-center string '{}'->caster-only
 *   summary arm table:        cache miss(null)->false | object->geometry |
 *                               JSON string->geometry | '{oops'->WARN+false |
 *                               exact campaign arg on every read
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    isSilenceActive,
    getSilenceSource,
    isCreatureInSilenceZone,
    addSilencedTarget,
    removeSilencedTargets,
} from './silenceService.js';

// STATEFUL argument-keyed runtime fake: unknown owner/key pair or arity THROWS.
const CAMPAIGN = 'test-campaign';
const ALLOWED_CAMPAIGNS = new Set([CAMPAIGN]);

const runtimeState = new Map(); // `${owner}|${key}` -> value
let reads = [];

function makeStore(initial) {
    runtimeState.clear();
    reads = [];
    for (const [owner, key, value] of initial) {
        runtimeState.set(`${owner}|${key}`, value);
    }
}

function seed(owner, key, value) {
    runtimeState.set(`${owner}|${key}`, value);
}

function getRuntimeValueSpy(owner, key, campaignName) {
    if (arguments.length > 3) throw new Error(`runtime fake: >3-arg read ${owner}/${key}`);
    if (campaignName !== undefined && !ALLOWED_CAMPAIGNS.has(campaignName)) {
        throw new Error(`runtime fake: unexpected campaign "${campaignName}"`);
    }
    if (key === 'combatSummary') {
        // #1413(d) tripwire: combatSummary must NEVER be read through the
        // campaign-blind runtime store — rerouted to combatData (Q5 FIXED).
        throw new Error('runtime fake: combatSummary must be read via campaign-scoped combatData.getCombatSummary (#1413d)');
    }
    const pair = `${owner}|${key}`;
    reads.push({ owner, key, arity: arguments.length });
    if (!runtimeState.has(pair)) return null; // real getRuntimeValue defaults missing keys to null
    return runtimeState.get(pair);
}

const setRuntimeValueSpy = vi.fn((...args) => {
    const [owner, key, value, campaignName] = args;
    if (args.length !== 4) throw new Error(`runtime fake: set arity ${args.length}`);
    if (owner !== 'campaign' || key !== 'targetEffects') {
        throw new Error(`runtime fake: unexpected write ${owner}/${key}`);
    }
    if (!ALLOWED_CAMPAIGNS.has(campaignName)) {
        throw new Error(`runtime fake: unexpected campaign "${campaignName}"`);
    }
    runtimeState.set(`${owner}|${key}`, value);
});

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (...args) => getRuntimeValueSpy(...args),
    setRuntimeValue: (...args) => setRuntimeValueSpy(...args),
}));

// getDistanceFeet stays mocked: hex-distance math belongs to rangeValidation.test.js.
// isDistanceInRange is PURE — run REAL (mock was byte-identical re-implement;
// exact-boundary verdict now comes from the repo-owned comparator).
vi.mock('../combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

// #1413(d): campaign-scoped combatData fake (fix#77/#1074 ARM-B mirror) —
// every read must carry CAMPAIGN exactly; OFF-target campaigns bleed-throw.
vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

const { getDistanceFeet } = await import('../combat/rangeValidation.js');
const { getCombatSummary } = await import('../../encounters/combatData.js');

let summaryCacheValue = null; // stands in for cachedCombatSummaries.get(campaignName)
function seedSummary(value) {
    summaryCacheValue = value;
}

beforeEach(() => {
    vi.resetAllMocks();
    summaryCacheValue = null;
    getCombatSummary.mockImplementation((campaignName) => {
        if (!ALLOWED_CAMPAIGNS.has(campaignName)) {
            throw new Error(`combatData fake: unexpected campaign "${campaignName}"`);
        }
        return summaryCacheValue;
    });
    setRuntimeValueSpy.mockImplementation((...args) => {
        const [owner, key, value, campaignName] = args;
        if (args.length !== 4) throw new Error(`runtime fake: set arity ${args.length}`);
        if (owner !== 'campaign' || key !== 'targetEffects') {
            throw new Error(`runtime fake: unexpected write ${owner}/${key}`);
        }
        if (!ALLOWED_CAMPAIGNS.has(campaignName)) {
            throw new Error(`runtime fake: unexpected campaign "${campaignName}"`);
        }
        runtimeState.set(`${owner}|${key}`, value);
    });
    makeStore([]);
});

describe('isSilenceActive / getSilenceSource (VERBAL-gate identity reads)', () => {
    it('isSilenceActive: strict === true at exactly (caster, "silenceCaster", campaign) — truthy near-misses are not activation', () => {
        seed('Caster', 'silenceCaster', true);
        expect(isSilenceActive('Caster', CAMPAIGN)).toBe(true);
        expect(reads).toEqual([{ owner: 'Caster', key: 'silenceCaster', arity: 3 }]);

        for (const nearMiss of ['true', 1, {}, [], 'yes']) {
            seed('Caster', 'silenceCaster', nearMiss);
            expect(isSilenceActive('Caster', CAMPAIGN)).toBe(false);
        }
    });

    it('getSilenceSource: first exact lowercase "silence" activeBuffs row wins; case/effect/field near-misses return null', () => {
        seed('Target', 'activeBuffs', [
            { effect: 'Silence', sourceCharacter: 'WrongCase' },
            { effect: 'silenced', sourceCharacter: 'WrongByte' },
        ]);
        expect(getSilenceSource('Target', CAMPAIGN)).toBeNull();

        seed('Target', 'activeBuffs', [
            { effect: 'invisibility', sourceCharacter: 'Ally2' },
            { effect: 'silence', sourceCharacter: 'Ally1' },
            { effect: 'silence', sourceCharacter: 'Second' },
            { effect: 'silence' },
        ]);
        const caster = getSilenceSource('Target', CAMPAIGN);
        expect(caster).toBe('Ally1');
        expect(reads[reads.length - 1]).toEqual({ owner: 'Target', key: 'activeBuffs', arity: 3 });

        seed('Target', 'activeBuffs', null);
        expect(getSilenceSource('Target', CAMPAIGN)).toBeNull();
        seed('Target', 'activeBuffs', []);
        expect(getSilenceSource('Target', CAMPAIGN)).toBeNull();
    });
});

describe('isCreatureInSilenceZone (owned by applyDamage.silence.test.js citation: "Zone membership geometry is owned by silenceService.test.js")', () => {
    it('inactive caster: exactly ONE read, everything downstream never consulted', () => {
        seed('Caster', 'silenceCaster', false);
        seed('campaign', 'targetEffects', [
            { target: 'Target', effect: 'silenced', source: 'Caster' },
        ]);

        expect(isCreatureInSilenceZone('Target', 'Caster', CAMPAIGN)).toBe(false);
        expect(reads).toEqual([{ owner: 'Caster', key: 'silenceCaster', arity: 3 }]);
        expect(getCombatSummary).not.toHaveBeenCalled();
    });

    it('manual-picker te membership admits the exact triple; near-misses fall through to center logic', () => {
        seed('Caster', 'silenceCaster', true);
        seed('Caster', 'silenceCenter', null);
        seed('campaign', 'targetEffects', [
            { target: 'Target', effect: 'silenced', source: 'Caster', duration: 'concentration' },
        ]);
        expect(isCreatureInSilenceZone('Target', 'Caster', CAMPAIGN)).toBe(true);

        // near-miss te rows: wrong source, wrong-case effect, wrong target,
        // registry name confusion ('silence' buff vs 'silenced' te) — none admit.
        for (const row of [
            { target: 'Target', effect: 'silenced', source: 'OtherCaster' },
            { target: 'Target', effect: 'Silenced', source: 'Caster' },
            { target: 'Other', effect: 'silenced', source: 'Caster' },
            { target: 'Target', effect: 'silence', source: 'Caster' },
        ]) {
            seed('campaign', 'targetEffects', [row]);
            expect(isCreatureInSilenceZone('Target', 'Caster', CAMPAIGN)).toBe(false);
        }
    });

    it('point model, no center stored: membership is the caster themselves — nobody else', () => {
        seed('Caster', 'silenceCaster', true);
        seed('Caster', 'silenceCenter', null);
        seed('campaign', 'targetEffects', []);

        expect(isCreatureInSilenceZone('Caster', 'Caster', CAMPAIGN)).toBe(true);
        expect(isCreatureInSilenceZone('Ally', 'Caster', CAMPAIGN)).toBe(false);
    });

    it('grid geometry via REAL isDistanceInRange: boundary 20ft IN, 25ft OUT, numeric-string radius coerced, players+creatures union lookup', () => {
        // handler canonical center form: JSON string (silenceHandler resolveSilenceCenter)
        seed('Caster', 'silenceCaster', true);
        seed('campaign', 'targetEffects', []);
        seed('Caster', 'silenceCenter', JSON.stringify({ gridX: 5, gridY: 5 }));
        seedSummary({
            players: [{ name: 'Caster', gridX: 5, gridY: 5 }],
            creatures: [
                { name: 'Near', gridX: 6, gridY: 5 },
                { name: 'Edge', gridX: 9, gridY: 5 },
                { name: 'Far', gridX: 10, gridY: 5 },
            ],
        });
        getDistanceFeet
            .mockReturnValueOnce(5)
            .mockReturnValueOnce(20)
            .mockReturnValueOnce(25);

        expect(isCreatureInSilenceZone('Near', 'Caster', CAMPAIGN)).toBe(true);
        expect(isCreatureInSilenceZone('Edge', 'Caster', CAMPAIGN)).toBe(true); // exact boundary: real comparator 20<=20
        expect(isCreatureInSilenceZone('Far', 'Caster', CAMPAIGN)).toBe(false);
        expect(getDistanceFeet).toHaveBeenNthCalledWith(1, { gridX: 5, gridY: 5 }, { gridX: 6, gridY: 5 });

        // center stored as plain object is also handled; players-array lookup
        seed('Caster', 'silenceCenter', { gridX: 5, gridY: 5 });
        seedSummary({
            players: [{ name: 'Player1', gridX: 6, gridY: 5 }],
            creatures: [],
        });
        getDistanceFeet.mockReturnValueOnce(5);
        expect(isCreatureInSilenceZone('Player1', 'Caster', CAMPAIGN)).toBe(true);

        // radius stored as numeric string '25': far at 25ft now IN
        seed('Caster', 'silenceRadius', '25');
        seedSummary({
            players: [],
            creatures: [{ name: 'Far', gridX: 10, gridY: 5 }],
        });
        getDistanceFeet.mockReturnValueOnce(25);
        expect(isCreatureInSilenceZone('Far', 'Caster', CAMPAIGN)).toBe(true);

        // every summary read carried CAMPAIGN exactly (campaign-scoped accessor)
        expect(getCombatSummary).toHaveBeenCalledWith(CAMPAIGN);
    });

    it('default radius 20 when radius key absent; unknown/coordinateless targets and missing summary are false', () => {
        seed('Caster', 'silenceCaster', true);
        seed('campaign', 'targetEffects', []);
        seed('Caster', 'silenceCenter', JSON.stringify({ gridX: 5, gridY: 5 }));
        seedSummary({
            players: [{ name: 'Edge', gridX: 9, gridY: 5 }],
            creatures: [{ name: 'Unplaced' }],
        });
        getDistanceFeet.mockReturnValue(20); // exactly the DEFAULT radius

        expect(isCreatureInSilenceZone('Edge', 'Caster', CAMPAIGN)).toBe(true);
        expect(isCreatureInSilenceZone('Unplaced', 'Caster', CAMPAIGN)).toBe(false);
        expect(isCreatureInSilenceZone('Ghost', 'Caster', CAMPAIGN)).toBe(false);

        seedSummary(null); // campaign cache miss
        expect(isCreatureInSilenceZone('Edge', 'Caster', CAMPAIGN)).toBe(false);
    });

    it('stored-summary string parses; malformed summary warns with exact bytes and reads as no-zone; every read campaign-exact (Q4-guard/Q5 FIXED)', () => {
        seed('Caster', 'silenceCaster', true);
        seed('campaign', 'targetEffects', []);
        seed('Caster', 'silenceCenter', JSON.stringify({ gridX: 5, gridY: 5 }));
        seedSummary(JSON.stringify({
            players: [],
            creatures: [{ name: 'Near', gridX: 6, gridY: 5 }],
        }));
        getDistanceFeet.mockReturnValue(5);
        expect(isCreatureInSilenceZone('Near', 'Caster', CAMPAIGN)).toBe(true);

        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        seedSummary('{oops');
        expect(isCreatureInSilenceZone('Near', 'Caster', CAMPAIGN)).toBe(false);
        expect(consoleWarn).toHaveBeenCalledWith(
            '[silence] Stored combat summary unavailable:',
            expect.any(SyntaxError),
        );
        consoleWarn.mockRestore();

        // Q5 FIXED spec: campaign-scoped exact-arg — every summary read is
        // getCombatSummary(CAMPAIGN), never a current-context fallback; and
        // the campaign-blind runtime-store read is excised (fake tripwires it).
        expect(getCombatSummary.mock.calls).toEqual([[CAMPAIGN], [CAMPAIGN]]);
        expect(reads.filter(r => r.key === 'combatSummary')).toEqual([]);
    });

    it('malformed center string: LOUD console.error then documented no-center arm (Q4 FIXED)', () => {
        seed('Caster', 'silenceCaster', true);
        seed('campaign', 'targetEffects', []);
        seed('Caster', 'silenceCenter', '{oops');
        seedSummary({ players: [], creatures: [{ name: 'Near', gridX: 6, gridY: 5 }] });

        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        // no-center arm: caster stands at the zone center — nobody else joins.
        expect(isCreatureInSilenceZone('Target', 'Caster', CAMPAIGN)).toBe(false);
        expect(isCreatureInSilenceZone('Caster', 'Caster', CAMPAIGN)).toBe(true);
        expect(consoleError).toHaveBeenCalledWith(
            '[silence] Corrupt stored silenceCenter (producer resolveSilenceCenter always JSON.stringify) — no-center arm:',
            expect.any(SyntaxError),
        );
        // geometry never ran: distance untouched, summary never consulted
        expect(getDistanceFeet).not.toHaveBeenCalled();
        expect(getCombatSummary).not.toHaveBeenCalled();
        consoleError.mockRestore();

        // JSON-parseable-but-centerless string falls in the same honest arm
        consoleError.mockClear();
        seed('Caster', 'silenceCenter', '{}');
        expect(isCreatureInSilenceZone('Target', 'Caster', CAMPAIGN)).toBe(false);
        expect(isCreatureInSilenceZone('Caster', 'Caster', CAMPAIGN)).toBe(true);
        expect(consoleError).not.toHaveBeenCalled(); // parse succeeded: not corruption
        consoleError.mockRestore();
    });

    it('read-order census: caster flag -> campaign te -> center -> radius -> campaign-scoped summary cache (exact arg)', () => {
        seed('Caster', 'silenceCaster', true);
        seed('campaign', 'targetEffects', []);
        seed('Caster', 'silenceCenter', JSON.stringify({ gridX: 5, gridY: 5 }));
        seed('Caster', 'silenceRadius', null); // falsy still consumes a read before the || 20 default
        seedSummary({ players: [], creatures: [] });
        getDistanceFeet.mockReturnValue(0);

        expect(isCreatureInSilenceZone('Caster', 'Caster', CAMPAIGN)).toBe(false);
        expect(reads).toEqual([
            { owner: 'Caster', key: 'silenceCaster', arity: 3 },
            { owner: 'campaign', key: 'targetEffects', arity: 3 },
            { owner: 'Caster', key: 'silenceCenter', arity: 3 },
            { owner: 'Caster', key: 'silenceRadius', arity: 3 },
        ]);
        // summary via campaign-keyed cache, exact arg, once (Q5 FIXED)
        expect(getCombatSummary).toHaveBeenCalledTimes(1);
        expect(getCombatSummary).toHaveBeenCalledWith(CAMPAIGN);
    });
});

describe('addSilencedTarget (modal confirm lane, SilenceModal.jsx:115)', () => {
    it('appends the full concentration row; input store array and its rows stay untouched', () => {
        const survivor = { target: 'Goblin', effect: 'silenced', source: 'WizardGirl' };
        const inputArray = [survivor];
        seed('campaign', 'targetEffects', inputArray);

        addSilencedTarget('ClericBoy', 'Orc', CAMPAIGN);

        const expected = [
            survivor,
            { target: 'Orc', effect: 'silenced', source: 'ClericBoy', duration: 'concentration' },
        ];
        const written = runtimeState.get('campaign|targetEffects');
        expect(written).toEqual(expected);
        expect(setRuntimeValueSpy).toHaveBeenCalledTimes(1);
        expect(setRuntimeValueSpy).toHaveBeenCalledWith('campaign', 'targetEffects', expected, CAMPAIGN);
        // input purity: copy-then-push, survivor row identity preserved
        expect(inputArray).toEqual([survivor]);
        expect(written[0]).toBe(survivor);
        expect(reads.at(-1)).toEqual({ owner: 'campaign', key: 'targetEffects', arity: 3 });
    });

    it('null store seeds a fresh one-element array', () => {
        seed('campaign', 'targetEffects', null);
        addSilencedTarget('ClericBoy', 'Goblin', CAMPAIGN);
        expect(setRuntimeValueSpy).toHaveBeenCalledWith('campaign', 'targetEffects', [
            { target: 'Goblin', effect: 'silenced', source: 'ClericBoy', duration: 'concentration' },
        ], CAMPAIGN);
    });

    it('same target+effect+source overwrites IN PLACE (never appends a dupe); other-source row survives', () => {
        const otherSource = { target: 'Goblin', effect: 'silenced', source: 'WizardGirl' };
        seed('campaign', 'targetEffects', [
            otherSource,
            { target: 'Goblin', effect: 'silenced', source: 'ClericBoy', duration: 'stale' },
        ]);

        addSilencedTarget('ClericBoy', 'Goblin', CAMPAIGN);

        expect(runtimeState.get('campaign|targetEffects')).toEqual([
            otherSource,
            { target: 'Goblin', effect: 'silenced', source: 'ClericBoy', duration: 'concentration' },
        ]);
        expect(setRuntimeValueSpy).toHaveBeenCalledTimes(1);
    });
});

describe('removeSilencedTargets (clear lane, silenceHandler.js:79)', () => {
    it('returns REMOVED names and writes survivors exactly once — other-source silence survives byte-identical', () => {
        const survivor = { target: 'Wizard', effect: 'silenced', source: 'OtherCaster' };
        seed('campaign', 'targetEffects', [
            { target: 'Goblin', effect: 'silenced', source: 'ClericBoy' },
            survivor,
            { target: 'Orc', effect: 'silenced', source: 'ClericBoy' },
            { target: 'Rat', effect: 'frightened', source: 'ClericBoy' },
        ]);

        const removed = removeSilencedTargets('ClericBoy', CAMPAIGN);

        expect(removed).toEqual(['Goblin', 'Orc']);
        // frightened-from-same-caster is a NEAR-MISS survivor — only the
        // silenced+source pair is drained.
        const frightenedSurvivor = { target: 'Rat', effect: 'frightened', source: 'ClericBoy' };
        expect(runtimeState.get('campaign|targetEffects')).toEqual([survivor, frightenedSurvivor]);
        expect(runtimeState.get('campaign|targetEffects')[0]).toBe(survivor);
        expect(setRuntimeValueSpy).toHaveBeenCalledTimes(1);
        expect(setRuntimeValueSpy).toHaveBeenCalledWith('campaign', 'targetEffects', [survivor, frightenedSurvivor], CAMPAIGN);
    });

    it('write budget: no matching rows -> ZERO store writes, empty return; null store -> []', () => {
        seed('campaign', 'targetEffects', [
            { target: 'Goblin', effect: 'silenced', source: 'OtherCaster' },
            { target: 'Orc', effect: 'frightened', source: 'ClericBoy' },
        ]);
        expect(removeSilencedTargets('ClericBoy', CAMPAIGN)).toEqual([]);
        expect(setRuntimeValueSpy).not.toHaveBeenCalled();

        seed('campaign', 'targetEffects', null);
        expect(removeSilencedTargets('ClericBoy', CAMPAIGN)).toEqual([]);
        expect(setRuntimeValueSpy).not.toHaveBeenCalled();
    });
});
