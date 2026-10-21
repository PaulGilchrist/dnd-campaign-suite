// @maintained-by-ai
/**
 * silenceService — zone-membership / targetEffects store accessor.
 * Lane map (verified 2026-10-21):
 *   - LIVE production surface: getSilenceSource + isCreatureInSilenceZone
 *     (Verbal gate: execution/index.js:136-137 + spellResolution.js:54-55;
 *     thunder side: applyDamage.js:294), addSilencedTarget
 *     (SilenceModal.jsx:115), removeSilencedTargets (silenceHandler.js:79).
 *   - DEAD in production (grep-verified, zero callers outside test mocks):
 *     triggerSilence, getSilencedTargets. The live cast popup is built inline
 *     by modalSpells.js handleSilence:231 — triggerSilence is pinned here as
 *     a DRIFT DETECTOR for that inline duplicate (#1357 class).
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
 * Quirks pinned as-is (see SOURCE BUGS in pass report):
 *   Q1 exact-match name gate vs modalSpells lowercase gate (case-gate split),
 *   Q2 numeric area_of_effect.size (5e disk canon 20) → (20).match TypeError,
 *   Q3 /(\d+)-?foot/ never parses plural 'feet' disk forms — silent 120,
 *   Q4 center JSON.parse unguarded vs combatSummary parse guarded with warn,
 *   Q5 combatSummary read is campaign-blind (getRuntimeValue('campaign',
 *      'combatSummary') — 2-arg, campaignName param ignored).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    triggerSilence,
    isSilenceActive,
    getSilenceSource,
    isCreatureInSilenceZone,
    getSilencedTargets,
    addSilencedTarget,
    removeSilencedTargets,
} from './silenceService.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

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

const { executeHandler } = await import('../../automation/index.js');
const { getDistanceFeet } = await import('../combat/rangeValidation.js');

// RAW disk canon — verbatim bytes:
// public/data/spells.json:8902ff  level 2, range "120 feet",
//   area_of_effect { type:"sphere", size:20 }, duration "Up to 10 minutes",
//   concentration true
// public/data/2024/spells.json:11724ff  same, duration
//   "Concentration, up to 10 minutes", area_of_effect
//   { shape:"sphere", size:"20-foot-radius" }
const DISK_5E = {
    index: 'silence',
    name: 'Silence',
    level: 2,
    range: '120 feet',
    area_of_effect: { type: 'sphere', size: 20 },
    duration: 'Up to 10 minutes',
    concentration: true,
    components: ['V', 'S'],
};
const DISK_2024 = {
    index: 'silence',
    name: 'Silence',
    level: 2,
    range: '120 feet',
    area_of_effect: { shape: 'sphere', size: '20-foot-radius' },
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    components: ['V', 'S'],
};

beforeEach(() => {
    vi.resetAllMocks();
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

describe('triggerSilence (dead export — drift pin vs modalSpells inline builder)', () => {
    const playerStats = { name: 'Wizard' };

    it('case-gate: forwards exact "Silence" with the full envelope; every near-miss name is inert (Q1)', async () => {
        const sentinel = { ok: true };
        executeHandler.mockResolvedValue(sentinel);

        const result = await triggerSilence(DISK_2024, {}, playerStats, CAMPAIGN, 'battleMap');

        // identity forwarding, exact 4-arg call
        expect(result).toBe(sentinel);
        expect(executeHandler).toHaveBeenCalledTimes(1);
        const [action, statsArg, campaignArg, mapArg] = executeHandler.mock.calls[0];
        expect(statsArg).toBe(playerStats);
        expect(campaignArg).toBe(CAMPAIGN);
        expect(mapArg).toBe('battleMap');

        // envelope full set — if modalSpells.js:231 drifts from these bytes the
        // two producers diverge; this pin is the detector.
        expect(action).toEqual({
            name: 'Silence',
            automation: {
                type: 'silence',
                duration: 'Concentration, up to 10 minutes',
                range: 120,
                aoeRadius: 20,
                slotLevel: 2,
            },
            spell: DISK_2024,
            spellSlotLevel: 2,
        });
        expect(Object.keys(action)).toEqual(['name', 'automation', 'spell', 'spellSlotLevel']);
        expect(Object.keys(action.automation)).toEqual(['type', 'duration', 'range', 'aoeRadius', 'slotLevel']);
        expect(action.spell).toBe(DISK_2024);

        // exact-match gate: modalSpells lowercases (name.toLowerCase()==='silence'),
        // this lane does NOT — case-gate split, pinned as-is.
        executeHandler.mockClear();
        for (const name of ['silence', 'SILENCE', 'Silent Silence', 'Fire Bolt']) {
            expect(await triggerSilence({ name }, {}, playerStats, CAMPAIGN, 'battleMap')).toBeNull();
        }
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('coercion spec: slot precedence, plural-"feet" silent 120 (Q3), radius regex + default (Q2 numeric size THROWS)', async () => {
        executeHandler.mockResolvedValue({ success: true });

        await triggerSilence({ name: 'Silence', level: 2 }, { slotLevel: 5 }, playerStats, CAMPAIGN, 'm');
        expect(executeHandler.mock.calls[0][0].automation.slotLevel).toBe(5);
        expect(executeHandler.mock.calls[0][0].spellSlotLevel).toBe(5);

        await triggerSilence({ name: 'Silence' }, {}, playerStats, CAMPAIGN, 'm');
        expect(executeHandler.mock.calls[1][0].automation.slotLevel).toBe(2);

        // Q3: disk canonical plural "feet" NEVER matches /(\d+)-?foot/ —
        // every plural range silently coerces to 120.
        await triggerSilence({ name: 'Silence', range: '60 feet' }, {}, playerStats, CAMPAIGN, 'm');
        expect(executeHandler.mock.calls[2][0].automation.range).toBe(120);

        await triggerSilence({ name: 'Silence', range: '25-foot radius' }, {}, playerStats, CAMPAIGN, 'm');
        expect(executeHandler.mock.calls[3][0].automation.range).toBe(25);

        // 2024 canonical string size parses; garbage falls to 20
        await triggerSilence({ name: 'Silence', area_of_effect: { size: '30-foot-radius' } }, {}, playerStats, CAMPAIGN, 'm');
        expect(executeHandler.mock.calls[4][0].automation.aoeRadius).toBe(30);
        await triggerSilence({ name: 'Silence', area_of_effect: { size: 'irregular' } }, {}, playerStats, CAMPAIGN, 'm');
        expect(executeHandler.mock.calls[5][0].automation.aoeRadius).toBe(20);

        // Q2: RAW 5e disk canon size is NUMBER 20 — unguarded (20).match TypeError.
        await expect(triggerSilence(DISK_5E, {}, playerStats, CAMPAIGN, 'm')).rejects.toThrow(TypeError);
        expect(executeHandler).toHaveBeenCalledTimes(6); // throw happens BEFORE dispatch
    });

    it('handler rejection: exact console.error bytes, swallows to null (survives)', async () => {
        const err = new Error('Handler failed');
        executeHandler.mockRejectedValue(err);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await triggerSilence(DISK_2024, {}, playerStats, CAMPAIGN, 'm');

        expect(result).toBeNull();
        expect(consoleError).toHaveBeenCalledWith('[silence] Failed to execute handler:', err);
        consoleError.mockRestore();
    });
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
        seed('campaign', 'combatSummary', {
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
        seed('campaign', 'combatSummary', {
            players: [{ name: 'Player1', gridX: 6, gridY: 5 }],
            creatures: [],
        });
        getDistanceFeet.mockReturnValueOnce(5);
        expect(isCreatureInSilenceZone('Player1', 'Caster', CAMPAIGN)).toBe(true);

        // radius stored as numeric string '25': edge at 20ft now IN (would be boundary), far at 25 IN
        seed('Caster', 'silenceRadius', '25');
        seed('campaign', 'combatSummary', {
            players: [],
            creatures: [{ name: 'Far', gridX: 10, gridY: 5 }],
        });
        getDistanceFeet.mockReturnValueOnce(25);
        expect(isCreatureInSilenceZone('Far', 'Caster', CAMPAIGN)).toBe(true);
    });

    it('default radius 20 when radius key absent; unknown/coordinateless targets and missing summary are false', () => {
        seed('Caster', 'silenceCaster', true);
        seed('campaign', 'targetEffects', []);
        seed('Caster', 'silenceCenter', JSON.stringify({ gridX: 5, gridY: 5 }));
        seed('campaign', 'combatSummary', {
            players: [{ name: 'Edge', gridX: 9, gridY: 5 }],
            creatures: [{ name: 'Unplaced' }],
        });
        getDistanceFeet.mockReturnValue(20); // exactly the DEFAULT radius

        expect(isCreatureInSilenceZone('Edge', 'Caster', CAMPAIGN)).toBe(true);
        expect(isCreatureInSilenceZone('Unplaced', 'Caster', CAMPAIGN)).toBe(false);
        expect(isCreatureInSilenceZone('Ghost', 'Caster', CAMPAIGN)).toBe(false);

        seed('campaign', 'combatSummary', null);
        expect(isCreatureInSilenceZone('Edge', 'Caster', CAMPAIGN)).toBe(false);
    });

    it('stored-summary string parses; malformed summary warns with exact bytes and reads as no-zone (Q4/Q5)', () => {
        seed('Caster', 'silenceCaster', true);
        seed('campaign', 'targetEffects', []);
        seed('Caster', 'silenceCenter', JSON.stringify({ gridX: 5, gridY: 5 }));
        seed('campaign', 'combatSummary', JSON.stringify({
            players: [],
            creatures: [{ name: 'Near', gridX: 6, gridY: 5 }],
        }));
        getDistanceFeet.mockReturnValue(5);
        expect(isCreatureInSilenceZone('Near', 'Caster', CAMPAIGN)).toBe(true);

        const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        seed('campaign', 'combatSummary', '{oops');
        expect(isCreatureInSilenceZone('Near', 'Caster', CAMPAIGN)).toBe(false);
        expect(consoleWarn).toHaveBeenCalledWith(
            '[silence] Stored combat summary unavailable:',
            expect.any(SyntaxError),
        );
        consoleWarn.mockRestore();

        // Q5 spec: the summary read is campaign-blind — exactly 2 args, no campaignName.
        const summaryRead = reads.filter(r => r.key === 'combatSummary').at(-1);
        expect(summaryRead).toEqual({ owner: 'campaign', key: 'combatSummary', arity: 2 });
    });

    it('malformed center string: JSON.parse SyntaxError escapes uncaught — unlike the guarded summary parse (Q4)', () => {
        seed('Caster', 'silenceCaster', true);
        seed('campaign', 'targetEffects', []);
        seed('Caster', 'silenceCenter', '{oops');

        expect(() => isCreatureInSilenceZone('Target', 'Caster', CAMPAIGN)).toThrow(SyntaxError);
    });

    it('read-order census: caster flag -> campaign te -> center -> radius -> campaign summary', () => {
        seed('Caster', 'silenceCaster', true);
        seed('campaign', 'targetEffects', []);
        seed('Caster', 'silenceCenter', JSON.stringify({ gridX: 5, gridY: 5 }));
        seed('Caster', 'silenceRadius', null); // falsy still consumes a read before the || 20 default
        seed('campaign', 'combatSummary', { players: [], creatures: [] });
        getDistanceFeet.mockReturnValue(0);

        expect(isCreatureInSilenceZone('Caster', 'Caster', CAMPAIGN)).toBe(false);
        expect(reads).toEqual([
            { owner: 'Caster', key: 'silenceCaster', arity: 3 },
            { owner: 'campaign', key: 'targetEffects', arity: 3 },
            { owner: 'Caster', key: 'silenceCenter', arity: 3 },
            { owner: 'Caster', key: 'silenceRadius', arity: 3 },
            { owner: 'campaign', key: 'combatSummary', arity: 2 },
        ]);
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

describe('getSilencedTargets (zero-production caller — read-sibling spec pin)', () => {
    it('exact effect+source filter returns target names; store stays untouched', () => {
        seed('campaign', 'targetEffects', [
            { target: 'Goblin', effect: 'silenced', source: 'ClericBoy' },
            { target: 'Orc', effect: 'silenced', source: 'ClericBoy' },
            { target: 'Dragon', effect: 'silenced', source: 'WizardGirl' },
            { target: 'Rat', effect: 'frightened', source: 'ClericBoy' },
        ]);

        expect(getSilencedTargets('ClericBoy', CAMPAIGN)).toEqual(['Goblin', 'Orc']);

        seed('campaign', 'targetEffects', null);
        expect(getSilencedTargets('ClericBoy', CAMPAIGN)).toEqual([]);
        expect(setRuntimeValueSpy).not.toHaveBeenCalled();
    });
});
