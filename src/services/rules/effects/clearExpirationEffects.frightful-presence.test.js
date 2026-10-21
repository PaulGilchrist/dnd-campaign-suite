// @maintained-by-ai
/**
 * MA-0048 lane: frightful_presence_immunity_grant expiration type ONLY —
 * the 1-minute FP clock's grant leg. On expiry the handler registers the
 * 24h immunity te (14400 rounds, CLA-334; written inline, no nested clock)
 * via the shared registerTargetEffect helper and logs one automation entry.
 *
 * This handler NEVER touches activeConditions: the frightened/charmed
 * resurrect defect flagged in applyDamage.js:552-557 (#1207, owner fix)
 * is unreachable from this lane — the te write routes through
 * targetEffectDefinitions.registerTargetEffect, the sole runtime key
 * written is campaign.targetEffects. Pins below keep it that way.
 *
 * Owned elsewhere — do not duplicate here:
 *   - FP te/frightened strip + clock wiring on the same expiry list:
 *     hooks/combat/saveProcessing.frightful-presence.test.js (track FP),
 *     services/rules/features/frightfulPresenceService.test.js (turn-END consumer)
 *   - registerTargetEffect merge semantics themselves: targetEffectDefinitions.test.js
 *
 * Cited by: hooks/combat/saveProcessing.frightful-presence.test.js
 * ("immunity_grant expiry — services/rules/effects/
 * clearExpirationEffects.frightful-presence.test.js").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const logs = [];
// Every runtime write made during a fire, as `${name}.${key}` — the
// write-count budget that makes the unconditional grant explicit (#1292).
const writes = [];

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { writes.push(`${name}.${key}`); runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
    setRuntimeObject: (name, obj) => { writes.push(`${name}.object`); Object.entries(obj).forEach(([k, v]) => { runtimeStore[`${name}.${k}`] = v; }); return Promise.resolve(); },
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: (_campaign, entry) => { logs.push(entry); return Promise.resolve(); },
}));

import { clearExpirationEffects } from './clearExpirationEffects.js';

const CAMPAIGN = 'test-campaign';
const DRACOLICH = 'Adult Blue Dracolich 1';
const TARGET = 'ElderPaladin';

// Exact payload pinned byte-for-byte against clearExpirationEffects.js:496-510.
const GRANT = { type: 'frightful_presence_immunity_grant', immunityEffect: 'frightful_presence_immunity' };
const IMMUNITY_TE = { target: TARGET, effect: 'frightful_presence_immunity', source: DRACOLICH, duration: '24_hours', rounds: 14400 };
const GRANT_LOG = {
    type: 'automation',
    automationType: 'frightful_presence_immunity_granted',
    characterName: TARGET,
    sourceName: DRACOLICH,
    abilityName: 'Frightful Presence',
    description: "ElderPaladin's Frightful Presence effect from Adult Blue Dracolich 1 ended — immune to it for the next 24 hours (14400 rounds — no round clock registered mid-expiry; te stands until admin clear).",
    timestamp: expect.any(Number),
};

beforeEach(() => {
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    logs.length = 0;
    writes.length = 0;
    runtimeStore['campaign.targetEffects'] = [];
});

describe('MA-0048 frightful_presence_immunity_grant expiration type', () => {
    it('expiry grants the exact 24h immunity te + log, writes ONLY campaign.targetEffects once, foreign te and conditions untouched', () => {
        // Foreign survivors: the active frightful_presence te (stripped by
        // the clock's other leg, not this one) and another creature's
        // immunity from another source must both survive verbatim.
        const foreignFp = { target: TARGET, effect: 'frightful_presence', source: DRACOLICH };
        const foreignImmunity = { target: 'OtherPaladin', effect: 'frightful_presence_immunity', source: 'Ancient Black Dragon', duration: '24_hours', rounds: 14400 };
        runtimeStore['campaign.targetEffects'] = [foreignFp, foreignImmunity];
        runtimeStore[`${TARGET}.activeConditions`] = ['frightened', 'charmed'];

        clearExpirationEffects([GRANT], TARGET, DRACOLICH, CAMPAIGN);

        expect(runtimeStore['campaign.targetEffects']).toEqual([foreignFp, foreignImmunity, IMMUNITY_TE]);
        expect(logs).toEqual([GRANT_LOG]);
        // #1207 guard: exactly one write, to campaign.targetEffects —
        // activeConditions is never written from this lane.
        expect(writes).toEqual(['campaign.targetEffects']);
        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['frightened', 'charmed']);
    });

    it('repeat grant merges to ONE te (default immunityEffect key on second fire), broadcasting unconditionally each fire', () => {
        clearExpirationEffects([GRANT], TARGET, DRACOLICH, CAMPAIGN);
        // Second fire omits immunityEffect — the handler default must
        // resolve to the same registry key (targetEffectDefinitions.js
        // 'frightful_presence_immunity') and merge, not dupe.
        clearExpirationEffects([{ type: 'frightful_presence_immunity_grant' }], TARGET, DRACOLICH, CAMPAIGN);

        expect(runtimeStore['campaign.targetEffects']).toEqual([IMMUNITY_TE]);
        // Unconditional writes (#1292): registerTargetEffect always writes
        // the merged list, so two fires = two te writes + two logs.
        expect(writes).toEqual(['campaign.targetEffects', 'campaign.targetEffects']);
        expect(logs).toEqual([GRANT_LOG, GRANT_LOG]);
    });
});
