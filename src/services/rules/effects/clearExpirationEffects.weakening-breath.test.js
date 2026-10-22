// @maintained-by-ai
/**
 * MA-0102 lane: weakening_breath_auto_success expiration type ONLY — the
 * Weakening Breath 1-minute clock's expiry leg (RAW "After 1 minute, it
 * succeeds automatically"). Reached through the PUBLIC clearExpirationEffects
 * wrapper with a single-type list; multi-type dispatch is owned by
 * clearExpirationEffects.test.js.
 *
 * Handler under test: clearExpirationEffects.js:480-495. Pins:
 *   - write budget (#1292): the campaign.targetEffects rewrite is GATED on
 *     something actually being removed; the auto-success log is UNCONDITIONAL
 *   - filter scoping (#1295-fix): AND-triple effectKey + target + source
 *     (payload carries source per weakeningBreathService.js:49; fix#44 house
 *     shape per banishmentHandler.js:108). A second dragon's weakening_breath
 *     te on the SAME target SURVIVES its sibling's clock — pre-fix the
 *     source-blind filter collateral-stripped it; the survivor assertion at
 *     the two-dragon test below is the deliberately flipped #1295 pin.
 *   - null canon (#1517): strict === — a source-less legacy clock expires
 *     only source-less twins; one-sided-null rows survive (no cross-source
 *     strip). Disk census: zero weakening_breath rows in public/campaigns.
 *
 * Owned elsewhere — do not duplicate here:
 *   - clock/expiration registration payload (type, effectKey, 10 rounds):
 *     services/rules/features/weakeningBreathService.test.js:85
 *   - roll-time strCheckDisadvantage consumers:
 *     hooks/combat/d20RollComputation.weakening-breath.test.js,
 *     components/encounter/MonsterCardHelpers.weakening-breath.test.js,
 *     components/char-sheet/modals/shared/SaveAttackAoeModal.weakening-breath.test.jsx,
 *     hooks/combat/handlers/handlePlainDamage.weakening-breath.test.js
 *   - te registry definition: targetEffectDefinitions.test.js
 *
 * Cited by: clearExpirationEffects.test.js:30-31 and
 * clearExpirationEffects_additional_types.test.js:18-19 (both disclaim this
 * type to this file).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const logs = [];
// Every runtime write made during a fire, as `${name}.${key}` — the
// write-count budget that makes gated-vs-unconditional explicit (#1292).
const writes = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { writes.push(`${name}.${key}`); runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (campaign, entry) => { logs.push({ campaign, entry }); return Promise.resolve(); },
}));

import { clearExpirationEffects } from './clearExpirationEffects.js';

const CAMPAIGN = 'test-campaign';
const GOLD = 'Adult Gold Dragon 1';
const BLUE = 'Adult Blue Dragon 1';
const TARGET = 'EvasiveFighter';
const FOREIGN_TARGET = 'SomeoneElse';

// Production-shaped expiration entry (weakeningBreathService.js:49).
const EXPIRATION = [{ type: 'weakening_breath_auto_success', effectKey: 'weakening_breath', source: GOLD, target: TARGET }];

// Exact log payload pinned byte-for-byte against clearExpirationEffects.js:486-494.
const AUTO_SUCCESS_LOG = {
    campaign: CAMPAIGN,
    entry: {
        type: 'automation',
        automationType: 'weakening_breath_auto_success',
        characterName: TARGET,
        sourceName: GOLD,
        abilityName: 'Weakening Breath',
        description: "EvasiveFighter has suffered Adult Gold Dragon 1's Weakening Breath for 1 minute (10 rounds) — the repeat save succeeds automatically; the effect ends.",
        timestamp: expect.any(Number),
    },
};

beforeEach(() => {
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    logs.length = 0;
    writes.length = 0;
});

describe('MA-0102 weakening_breath_auto_success expiration type', () => {
    it('strips only THIS clock\'s weakening_breath te in exactly one gated write; foreign targets, other effects, and a SECOND DRAGON\'s te on the same target survive (#1295-fix flipped pin); logs the auto-success verbatim', () => {
        const ownTe = { target: TARGET, effect: 'weakening_breath', source: GOLD, dc: 21, damageSubtractDie: '1d6' };
        const secondDragonTe = { target: TARGET, effect: 'weakening_breath', source: BLUE, dc: 19 };
        const foreignTe = { target: FOREIGN_TARGET, effect: 'weakening_breath', source: GOLD };
        const unrelatedTe = { target: TARGET, effect: 'bless', source: 'Cleric 1' };
        runtimeStore['campaign.targetEffects'] = [ownTe, secondDragonTe, foreignTe, unrelatedTe];

        clearExpirationEffects(EXPIRATION, TARGET, GOLD, CAMPAIGN);

        // Filter is the AND-triple effectKey + target + source (#1295-fix) —
        // the payload's source (GOLD) is consulted, so BLUE's te on TARGET
        // survives GOLD's clock byte-exact. Pre-fix this asserted
        // [foreignTe, unrelatedTe] (BLUE collateral-stripped) — flipped here.
        expect(runtimeStore['campaign.targetEffects']).toEqual([secondDragonTe, foreignTe, unrelatedTe]);
        expect(runtimeStore['campaign.targetEffects'][0]).toBe(secondDragonTe);
        expect(writes).toEqual(['campaign.targetEffects']);
        expect(logs).toEqual([AUTO_SUCCESS_LOG]);
    });

    it('single-source self-expiry: the only weakening_breath te on the target belongs to the clock\'s source — stripped in one gated write', () => {
        const ownTe = { target: TARGET, effect: 'weakening_breath', source: GOLD, dc: 21 };
        runtimeStore['campaign.targetEffects'] = [ownTe];

        clearExpirationEffects(EXPIRATION, TARGET, GOLD, CAMPAIGN);

        expect(runtimeStore['campaign.targetEffects']).toEqual([]);
        expect(writes).toEqual(['campaign.targetEffects']);
        expect(logs).toEqual([AUTO_SUCCESS_LOG]);
    });

    it('null-source arms (#1517 canon): strict === — both-null legacy twin expires; one-sided-null survives (te w/ source vs source-less clock; clock w/ source vs source-less te); gated writes', () => {
        const legacyClock = [{ type: 'weakening_breath_auto_success', effectKey: 'weakening_breath', target: TARGET }];

        // both-null identity is the law: source-less legacy te + source-less clock → stripped.
        const nullTe = { target: TARGET, effect: 'weakening_breath' };
        runtimeStore['campaign.targetEffects'] = [nullTe];
        clearExpirationEffects(legacyClock, TARGET, GOLD, CAMPAIGN);
        expect(runtimeStore['campaign.targetEffects']).toEqual([]);
        expect(writes).toEqual(['campaign.targetEffects']);

        // te HAS source, clock does NOT → survives (no collateral on modern rows).
        writes.length = 0;
        logs.length = 0;
        const sourcedTe = { target: TARGET, effect: 'weakening_breath', source: GOLD };
        runtimeStore['campaign.targetEffects'] = [sourcedTe];
        clearExpirationEffects(legacyClock, TARGET, GOLD, CAMPAIGN);
        expect(runtimeStore['campaign.targetEffects']).toEqual([sourcedTe]);
        expect(writes).toEqual([]);
        expect(logs.length).toBe(1);

        // clock HAS source, te does NOT → survives (badge stands, conservative).
        writes.length = 0;
        logs.length = 0;
        runtimeStore['campaign.targetEffects'] = [nullTe];
        clearExpirationEffects(EXPIRATION, TARGET, GOLD, CAMPAIGN);
        expect(runtimeStore['campaign.targetEffects']).toEqual([nullTe]);
        expect(writes).toEqual([]);
        expect(logs.length).toBe(1);
    });

    it('no weakening_breath te present → zero targetEffects writes (gated), but the auto-success log still fires once', () => {
        runtimeStore['campaign.targetEffects'] = [];

        clearExpirationEffects(EXPIRATION, TARGET, GOLD, CAMPAIGN);

        expect(writes).toEqual([]);
        expect(logs).toEqual([AUTO_SUCCESS_LOG]);
    });
});
