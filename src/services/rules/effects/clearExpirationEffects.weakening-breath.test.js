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
 *   - filter scoping: te removed by effectKey + target only. The handler
 *     IGNORES te.source (the payload carries source at
 *     weakeningBreathService.js:49 but :482 never reads it), so a second
 *     dragon's weakening_breath te on the SAME target is collateral-stripped
 *     — pinned honestly below; if source-scoping is ever fixed, that
 *     survivor assertion flips deliberately.
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
    it('strips this target\'s weakening_breath tes in exactly one gated write; foreign targets and other effects survive; logs the auto-success verbatim', () => {
        const ownTe = { target: TARGET, effect: 'weakening_breath', source: GOLD, dc: 21, damageSubtractDie: '1d6' };
        const secondDragonTe = { target: TARGET, effect: 'weakening_breath', source: BLUE, dc: 19 };
        const foreignTe = { target: FOREIGN_TARGET, effect: 'weakening_breath', source: GOLD };
        const unrelatedTe = { target: TARGET, effect: 'bless', source: 'Cleric 1' };
        runtimeStore['campaign.targetEffects'] = [ownTe, secondDragonTe, foreignTe, unrelatedTe];

        clearExpirationEffects(EXPIRATION, TARGET, GOLD, CAMPAIGN);

        // Filter is effectKey + target only — te.source is never consulted,
        // so BLUE's te on TARGET drops as collateral (see header pin note).
        expect(runtimeStore['campaign.targetEffects']).toEqual([foreignTe, unrelatedTe]);
        expect(writes).toEqual(['campaign.targetEffects']);
        expect(logs).toEqual([AUTO_SUCCESS_LOG]);
    });

    it('no weakening_breath te present → zero targetEffects writes (gated), but the auto-success log still fires once', () => {
        runtimeStore['campaign.targetEffects'] = [];

        clearExpirationEffects(EXPIRATION, TARGET, GOLD, CAMPAIGN);

        expect(writes).toEqual([]);
        expect(logs).toEqual([AUTO_SUCCESS_LOG]);
    });
});
