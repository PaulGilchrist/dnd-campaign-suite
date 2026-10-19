// @maintained-by-ai
// interceptionHandler companion lane: UPSERT PROTECTION EFFECT (upsertProtectionEffect,
// interceptionHandler.js L141-159) — the campaign-scoped targetEffects store write bytes.
//
// Reactions family map (interceptionHandler tests; each lane owns what it pins):
//  - .test.js (main):        early-return gates (no attack, shield/weapon, range).
//  - .consumption.test.js:   isReactionSpent latch, stampInterceptionRound mark,
//                            blocked-path no-writes, rounds:1 addExpiration (owns the ONLY
//                            addExpiration pin — not pinned here; barrel mocked for isolation).
//  - .damage.test.js:        reduction math, damage bonus resolution, heal amounts.
//  - .description.test.js:   popup text templates.
//  - .logging.test.js:       addEntry ability_use bytes.
//  - .returnValue.test.js:   popup envelope shape every path.
//  - THIS file:            the positive targetEffects write — push vs in-place-replace
//                          branches of upsertProtectionEffect, exact stored-array bytes,
//                          duration + refreshed timestamp, unrelated-effect survival.
//
// te-ownership split: generic te-removal semantics live at the target-effect-removal lane
// (#831); the registry golden-once for 'protection' lives in targetEffectDefinitions.test.js
// (#820) — keys here are sourced FROM the registry, never hand-typed.
// Filter defect watch (#871 class): upsert filter is `te.effect === 'protection' &&
// te.target === defenderName`. Fixtures co-locate (a) a same-target different-effect te and
// (b) a same-source same-target different-effect te so any target-only / effect-only /
// source+target-without-effect filter over-removes or clobbers and is CAUGHT here.
// Current handler filter verified: no over-removal defect.
//
// Old -> new map:
//  'pushes new protection effect when none exists'  -> test 1 (exact bytes, preserved survivors)
//  'updates existing protection effect …'            -> test 2 (exact bytes, refreshed ts)
//  'does not add protection effect for different defender' (title lied — it asserted an ADD)
//                                                    -> consolidated into test 1 (target falsifier)
//
// Deterministic: handler unmocked (#791); runtime store faithful keyed by
// (characterKey, propertyName) (#934); explicit combat-context defaults (#872); fixed
// fixture timestamps; zero network; no timers.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEffectDefinition } from '../../../combat/conditions/targetEffectDefinitions.js';

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

// Owned by the consumption lane — mocked here for isolation only, never pinned.
vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import { handle } from './interceptionHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as rangeCheck from '../../../rules/combat/rangeCheck.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as damageRollback from '../../common/damageRollback.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as diceRoller from '../../../dice/diceRoller.js';

// ── Fixtures ────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const mapName = 'test-map';
const playerName = 'Paladin';
const defenderName = 'Rogue';
const attackerName = 'Goblin';

// Golden-once (#820): keys sourced from the registry authority — loud TypeError module
// import if either entry is removed or renamed.
const PROTECTION = getEffectDefinition('protection').effect;
const NEAR_MISS = getEffectDefinition('protection_from_evil_and_good').effect;

const action = {
    name: 'Interception',
    automation: {
        type: 'interception',
        range: '5_ft',
        damageExpression: '1d10',
        damageBonusExpression: 'proficiency_bonus',
    },
};

const playerStats = {
    name: playerName,
    proficiency: 3,
    inventory: { equipped: ['Shield'] },
    equipment: [{ name: 'Shield', armor_category: 'Shield' }],
};

function teWrites() {
    return useRuntimeState.setRuntimeValue.mock.calls.filter(
        ([characterKey, propertyName]) =>
            characterKey === 'campaign' && propertyName === 'targetEffects'
    );
}

function withStoredEffects(effects) {
    useRuntimeState.getRuntimeValue.mockImplementation((characterKey, propertyName) => {
        if (characterKey === 'campaign' && propertyName === 'targetEffects') return effects;
        return null;
    });
}

// ── Tests ───────────────────────────────────────────────────────

describe('interceptionHandler upsertProtectionEffect (campaign targetEffects write)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        withStoredEffects(null);
        targetResolver.resolveMapPositions.mockResolvedValue({
            attackerPos: { x: 0, y: 0 },
            targetPos: { x: 1, y: 0 },
        });
        rangeCheck.isWithinRange.mockResolvedValue(true);
        damageUtils.getCombatContext.mockResolvedValue({ round: 1, activeCreatureName: attackerName });
        damageRollback.findLastAttack.mockResolvedValue({
            attackEvent: { targetName: defenderName, timestamp: 1000, d20: 15, bonus: 5, hit: true, targetAc: 16 },
            attackerName,
            targetName: defenderName,
            totalDamage: 12,
            damageTypes: ['slashing'],
        });
        diceRoller.rollExpression.mockReturnValue({ total: 0, rolls: [0], modifier: 0 });
        useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
    });

    it('pushes the exact protection effect while preserving every unrelated stored effect', async () => {
        // Two distinct falsifiers for the upsert filter (#871 over-removal class):
        // a target-only filter would clobber the first; an effect-only filter the second.
        const nearMissSameTarget = { effect: NEAR_MISS, target: defenderName, source: 'Archmage', duration: '1_round', timestamp: 300 };
        const protectionOtherDefender = { effect: PROTECTION, target: 'OtherDefender', source: 'OldSource', duration: 'until_start_of_next_turn', timestamp: 100 };
        withStoredEffects([nearMissSameTarget, protectionOtherDefender]);

        await handle(action, playerStats, campaignName, mapName);

        expect(teWrites()).toHaveLength(1);
        expect(teWrites()[0]).toEqual([
            'campaign',
            'targetEffects',
            [
                nearMissSameTarget, // exact bytes — untouched
                protectionOtherDefender, // exact bytes — untouched
                {
                    effect: PROTECTION,
                    target: defenderName,
                    source: playerName,
                    duration: 'until_start_of_next_turn',
                    timestamp: expect.any(Number),
                },
            ],
            campaignName,
        ]);
    });

    it('replaces an existing protection for the same defender in place, refreshing source and timestamp, without clobbering a same-source different-effect effect', async () => {
        // Same-source+same-target foreign te: a source&&target filter missing the effect-key
        // check would replace THIS (#871 defect) instead of the stale protection slot.
        const staleProtection = { effect: PROTECTION, target: defenderName, source: 'OldSource', duration: 'until_start_of_next_turn', timestamp: 100 };
        const sameSourceForeign = { effect: NEAR_MISS, target: defenderName, source: playerName, duration: '1_round', timestamp: 300 };
        withStoredEffects([staleProtection, sameSourceForeign]);

        await handle(action, playerStats, campaignName, mapName);

        expect(teWrites()).toHaveLength(1);
        const [, , written] = teWrites()[0];
        expect(written).toHaveLength(2); // replaced in place — no duplicate pushed
        expect(written[0]).toEqual({
            effect: PROTECTION,
            target: defenderName,
            source: playerName, // stale 'OldSource' replaced
            duration: 'until_start_of_next_turn',
            timestamp: expect.any(Number),
        });
        expect(written[0].timestamp).toBeGreaterThan(100); // refreshed, not merged in
        expect(written[1]).toEqual(sameSourceForeign); // exact bytes — survives
    });
});
