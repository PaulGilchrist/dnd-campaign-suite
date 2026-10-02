// CLA-065 integration regression: producer (cosmicOmenHandler) and consumers
// (d20RollComputation attack/check/initiative lane + save lanes) must share
// ONE canonical runtime store — characterKey 'cosmicOmen', propertyName
// 'cosmicOmenPendingBonus', JSON shape {value:number,type:'Weal'|'Woe'}.
// The old defect wrote the pending under the druid's own name key; every
// consumer read the literal 'cosmicOmen' store, so the ±1d6 never folded.
// Unit mocks keyed by propertyName alone hid this — this test uses the REAL
// runtime store (a Map keyed [characterKey][propertyName]) with fetch inert,
// so a key mismatch can never pass again.
import { describe, it, expect, beforeEach } from 'vitest';
import { handle } from './cosmicOmenHandler.js';
import { computeD20Roll } from '../../../../hooks/combat/d20RollComputation.js';
import { getRuntimeValue, clearRuntimeState } from '../../../../hooks/runtime/useRuntimeState.js';
import { getLongRestResources } from '../../../rules/effects/restRules-constants.js';

const CAMPAIGN = 'test-campaign';
const DRUID = 'Wild_Sage_Druid';

function makeDruidAction() {
    return {
        name: 'Cosmic Omen',
        automation: { type: 'cosmic_omen', usesMax: 3 },
    };
}

function readPending() {
    return getRuntimeValue('cosmicOmen', 'cosmicOmenPendingBonus', CAMPAIGN);
}

describe('CLA-065 cosmic omen canonical pending store', () => {
    beforeEach(() => {
        clearRuntimeState(DRUID);
        clearRuntimeState('cosmicOmen');
    });

    async function arm(omenType, isEven, starMapRoll) {
        const { setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
        await setRuntimeValue(DRUID, 'cosmicOmenEffect', JSON.stringify({ type: omenType, isEven, starMapRoll }), CAMPAIGN);
        return handle(makeDruidAction(), { name: DRUID }, CAMPAIGN);
    }

    it('press arms pending under the canonical cosmicOmen store with the consumer byte-shape', async () => {
        const result = await arm('Weal', true, 14);
        expect(result.type).toBe('popup');
        const raw = readPending();
        expect(raw).toBeTruthy();
        const pending = JSON.parse(raw);
        expect(typeof pending.value).toBe('number');
        expect(pending.value).toBeGreaterThan(0);
        expect(pending.type).toBe('Weal');
        // legacy per-name location must stay empty — consumers never read it
        expect(getRuntimeValue(DRUID, 'cosmicOmenPendingBonus', CAMPAIGN)).toBeNull();
    });

    it('initiative lane folds ±pending and consumes it', async () => {
        await arm('Weal', true, 14);
        const armed = JSON.parse(readPending());
        const r = computeD20Roll({
            characterName: DRUID, campaignName: CAMPAIGN, name: 'Initiative',
            rollType: 'initiative', context: {}, bonus: -1, isResilientSphereActive: () => false,
        });
        expect(r.cosmicOmenAppliedBonus).toBe(armed.value);
        expect(r.effectiveBonus).toBe(-1 + armed.value);
        expect(r.cosmicOmenDetail).toBe(`(+${armed.value} from Weal)`);
        expect(readPending()).toBeNull();
    });

    it('attack lane folds +pending for Weal', async () => {
        await arm('Weal', true, 2);
        const armed = JSON.parse(readPending());
        const r = computeD20Roll({
            characterName: DRUID, campaignName: CAMPAIGN, name: 'Mace',
            rollType: 'attack', context: { targetName: 'Bandit' }, bonus: 9, isResilientSphereActive: () => false,
        });
        expect(r.cosmicOmenAppliedBonus).toBe(armed.value);
        expect(r.effectiveBonus).toBe(9 + armed.value);
    });

    it('woe lane folds −pending and consumes it', async () => {
        await arm('Woe', false, 7);
        const armed = JSON.parse(readPending());
        expect(armed.type).toBe('Woe');
        const r = computeD20Roll({
            characterName: DRUID, campaignName: CAMPAIGN, name: 'Initiative',
            rollType: 'initiative', context: {}, bonus: -1, isResilientSphereActive: () => false,
        });
        expect(r.cosmicOmenAppliedBonus).toBe(-armed.value);
        expect(r.effectiveBonus).toBe(-1 - armed.value);
        expect(r.cosmicOmenDetail).toBe(`(-${armed.value} from Woe)`);
        expect(readPending()).toBeNull();
    });

    it('pending is one-shot: a second roll after consumption folds zero', async () => {
        await arm('Weal', true, 8);
        computeD20Roll({
            characterName: DRUID, campaignName: CAMPAIGN, name: 'Initiative',
            rollType: 'initiative', context: {}, bonus: 0, isResilientSphereActive: () => false,
        });
        expect(readPending()).toBeNull();
        const second = computeD20Roll({
            characterName: DRUID, campaignName: CAMPAIGN, name: 'Initiative',
            rollType: 'initiative', context: {}, bonus: 0, isResilientSphereActive: () => false,
        });
        expect(second.cosmicOmenAppliedBonus).toBe(0);
        expect(second.effectiveBonus).toBe(0);
    });

    it('d20RollComputation save lane stays inert (save fold belongs to saveProcessing/SavePromptModal)', async () => {
        await arm('Weal', true, 4);
        const r = computeD20Roll({
            characterName: DRUID, campaignName: CAMPAIGN, name: 'Death',
            rollType: 'save', context: {}, bonus: 2, isResilientSphereActive: () => false,
        });
        expect(r.cosmicOmenAppliedBonus).toBe(0);
        // save lane consumer predicate: same store key + shape (saveProcessing.js:161)
        const raw = readPending();
        expect(raw).toBeTruthy();
        const pending = JSON.parse(raw);
        expect(pending && typeof pending.value === 'number' && pending.value > 0).toBe(true);
    });

    it('registers cosmicOmenPendingBonus in LONG_REST_RESOURCES', () => {
        expect(getLongRestResources()).toContain('cosmicOmenPendingBonus');
    });
});
