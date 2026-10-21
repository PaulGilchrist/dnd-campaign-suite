// @maintained-by-ai
/**
 * Lane: the 'calm_emotions_end' expiration handler (SP-020 B5) in
 * clearExpirationEffects.js, dispatched via the public clearExpirationEffects
 * entry point (registry key read from EXPIRATION_HANDLERS at source L467).
 *
 * Pinned here (exact payloads, no find()/some()/length>0):
 *  - caster-owned calm_emotions + indifferent targetEffects stripped as one
 *    exact surviving array; foreign-caster tes survive (scoping negative);
 *  - restoreSuppressedConditions called once per owned te, in stored order,
 *    with the te verbatim + campaignName (condition RESTORE semantics live in
 *    cleanupConcentrationEffects.test.js — this lane pins only the dispatch);
 *  - the 'Calm Emotions' immunity buff stripped from calm_emotions targets by
 *    name+source while unrelated buffs survive, and NO buff write when the
 *    target carries no matching buff (per-target write gate);
 *  - caster concentration released (mutation + storage.set exact payload) even
 *    when every target saved and the owned set is empty;
 *  - full log bytes for automationType 'calm_emotions_ended';
 *  - write-gate negatives: nothing owned → zero setRuntimeValue writes,
 *    zero storage writes, zero log entries (idempotent re-fire after a
 *    concentration break already swept the te and clock together).
 *
 * 'charmed'/'dominated' condition-clear types are additional_types lane —
 * this handler never touches activeConditions, pinned via exact write arrays.
 * No timers: Date.now() inside the mocked log payloads is benign.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const runtimeWrites = [];
const logs = [];
const storageWrites = [];
const restoreCalls = [];
const combatSummaryRef = { cs: null };

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: vi.fn((name, key, value, campaignName) => {
        runtimeWrites.push([name, key, value, campaignName]);
        runtimeStore[`${name}.${key}`] = value;
        return Promise.resolve();
    }),
    setRuntimeObject: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({
    default: { getName: (val) => String(val) },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (_campaign, entry) => { logs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../encounters/combatData.js', () => ({
    getCombatSummary: () => combatSummaryRef.cs,
}));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
    breakConcentration: vi.fn(),
    cleanupConcentrationEffects: vi.fn(),
    restoreSuppressedConditions: (effect, campaignName) => {
        restoreCalls.push([effect, campaignName]);
    },
}));

vi.mock('../../ui/storage.js', () => ({
    __esModule: true,
    default: {
        set: (key, value, campaign) => { storageWrites.push([key, value, campaign]); },
    },
}));

import { clearExpirationEffects } from './clearExpirationEffects.js';

const CAMPAIGN = 'test-campaign';
const CASTER = 'Divine_Cleric';

const calmImmunityTe = {
    target: 'Bandit 1',
    effect: 'calm_emotions',
    mode: 'immunity',
    source: CASTER,
    suppressedConditions: ['frightened'],
    dc: 17,
    duration: 'concentration',
};

const indifferentTe = {
    target: 'Bandit Captain 1',
    effect: 'indifferent',
    source: CASTER,
    dc: 17,
    duration: 'concentration',
};

const foreignTe = {
    target: 'Other 1',
    effect: 'calm_emotions',
    source: 'RivalCaster',
    duration: 'concentration',
};

const calmEndLog = {
    type: 'automation',
    automationType: 'calm_emotions_ended',
    characterName: CASTER,
    description: 'Calm Emotions ends (1 minute) — immunity lifts, suppressed conditions resume, and Indifferent attitudes return to normal.',
};

function emptyRuntime() {
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    runtimeStore['campaign.targetEffects'] = [];
    runtimeWrites.length = 0;
    logs.length = 0;
    storageWrites.length = 0;
    restoreCalls.length = 0;
    combatSummaryRef.cs = null;
}

beforeEach(emptyRuntime);

describe('calm_emotions_end expiration (SP-020 B5)', () => {
    it('strips caster-owned tes and immunity buff, restores suppressed conditions, releases concentration, logs once', () => {
        runtimeStore['campaign.targetEffects'] = [calmImmunityTe, indifferentTe, foreignTe];
        runtimeStore['Bandit 1.activeBuffs'] = [
            { name: 'Calm Emotions', effect: 'calm_emotions', sourceCharacter: CASTER },
            { name: 'Bless', sourceCharacter: 'Other' },
        ];
        runtimeStore['Bandit 1.activeConditions'] = ['poisoned'];
        combatSummaryRef.cs = { creatures: [{ name: CASTER, concentration: { spell: 'Calm Emotions' } }] };

        clearExpirationEffects([{ type: 'calm_emotions_end', source: CASTER }], CASTER, CASTER, CAMPAIGN);

        // One restore per owned te, in stored order, te verbatim + campaign.
        expect(restoreCalls).toEqual([
            [calmImmunityTe, CAMPAIGN],
            [indifferentTe, CAMPAIGN],
        ]);
        // Buff strip on the calm_emotions target only; the indifferent target
        // carries no buffs, so its activeBuffs stays unwritten (write gate).
        expect(runtimeWrites).toEqual([
            ['Bandit 1', 'activeBuffs', [{ name: 'Bless', sourceCharacter: 'Other' }], CAMPAIGN],
            ['campaign', 'targetEffects', [foreignTe], CAMPAIGN],
        ]);
        // activeConditions untouched — this handler never strips conditions directly.
        expect(runtimeStore['Bandit 1.activeConditions']).toEqual(['poisoned']);
        // Concentration released with the mutated summary persisted verbatim.
        expect(combatSummaryRef.cs).toEqual({ creatures: [{ name: CASTER, concentration: null }] });
        expect(storageWrites).toEqual([['combatSummary', combatSummaryRef.cs, CAMPAIGN]]);
        // Exactly one log entry, full bytes (timestamp is the only free field).
        expect(logs).toHaveLength(1);
        expect(logs[0]).toMatchObject(calmEndLog);
        expect(typeof logs[0].timestamp).toBe('number');
    });

    it('leaves a foreign caster’s calm_emotions entirely untouched — no writes, no restores, no log', () => {
        runtimeStore['campaign.targetEffects'] = [foreignTe];

        clearExpirationEffects([{ type: 'calm_emotions_end', source: CASTER }], CASTER, CASTER, CAMPAIGN);

        expect(runtimeWrites).toEqual([]);
        expect(storageWrites).toEqual([]);
        expect(restoreCalls).toEqual([]);
        expect(logs).toEqual([]);
        expect(runtimeStore['campaign.targetEffects']).toEqual([foreignTe]);
    });

    it('releases concentration even when every target saved (owned set empty)', () => {
        combatSummaryRef.cs = { creatures: [{ name: CASTER, concentration: { spell: 'Calm Emotions' } }] };

        clearExpirationEffects([{ type: 'calm_emotions_end', source: CASTER }], CASTER, CASTER, CAMPAIGN);

        expect(combatSummaryRef.cs).toEqual({ creatures: [{ name: CASTER, concentration: null }] });
        expect(storageWrites).toEqual([['combatSummary', combatSummaryRef.cs, CAMPAIGN]]);
        // te/buff/log legs all short-circuit on the empty owned set.
        expect(runtimeWrites).toEqual([]);
        expect(restoreCalls).toEqual([]);
        expect(logs).toEqual([]);
    });

    it('is idempotent — re-fire after the concentration break already swept te + clock writes nothing', () => {
        combatSummaryRef.cs = { creatures: [{ name: CASTER, concentration: null }] };

        clearExpirationEffects([{ type: 'calm_emotions_end', source: CASTER }], CASTER, CASTER, CAMPAIGN);

        expect(runtimeWrites).toEqual([]);
        expect(storageWrites).toEqual([]);
        expect(restoreCalls).toEqual([]);
        expect(logs).toEqual([]);
    });
});
