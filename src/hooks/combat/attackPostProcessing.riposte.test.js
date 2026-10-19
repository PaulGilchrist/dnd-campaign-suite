// @maintained-by-ai: 2026-10-19
// MN-017 lane (clearRiposteDieOnMiss, attackPostProcessing.js:167-189): an armed
// pendingRiposteDieValue proves a Riposte press rides this attack — the damage
// pipeline consumes it on HITS only (attackRollDamageSteps-bonuses-basic pins that
// consume there), so a resolved MISS must clear the die here in ONE merged,
// campaign-pinned setRuntimeBatch and log the spent reaction with exact bytes.
// Falsified by a hit-only gate flip (miss leg fails), by dropping the
// `finalHit !== false` gate (unresolved leg wrongly clears), by dropping the
// `Number(die) > 0` armed guard (zero-die leg wrongly clears), by splitting the
// defect-1 heal into a second racy write, and by rewriting the log bytes.
// Auto-miss is NOT a separate face: this branch reads finalHit only (:168), so an
// auto-miss miss resolves through the identical miss-path bytes — cited, not covered.
// Turn-based mandate: the _Riposte_usedRound latch is round-stamped, never clocked.
// Family map: generic attack dispatch gates owned by
// useLoggedDiceRollAttack.potent-cantrip.test.js; MA-1170 shield
// (.ma1170-shield-consume), CLA-230 one-shot advantage (.nextAttackAdvantage) and
// CLA-120 potent cantrip (-cla120-potent-cantrip) run their own lanes — never
// re-litigated here. Grant-side arming owned by executeActionManeuvers.riposte.test.js
// — cited, not duplicated.
// MA-1463 adjudication: no guardian_protection face in this lane — that activeBuffs
// stamp is consumed by consumeGuardianProtectionAcBonus (source :256-278), still
// lane-less app-wide; cited here, not claimed (riposte ticket stays ticket-distinct).
// Old→new: t1 miss-clear fuzzy toContain log → armed miss leg (exact write+log
// bytes, campaign pinned, stateful final-store, no identity key fabricated);
// t2 hit-no-clear + new finalHit-undefined → survives it.each (zero riposte bytes,
// store byte-identical); t3 no-die control + new die=0 → unarmed it.each (both
// armed guards falsifiable); t4 auto-miss-clear → REMOVED (branch reads finalHit
// only — same code path as t1, zero coverage delta); t5 defect-1 merged write →
// kept (exact single-batch bytes, latch READ not recomputed: 7 ≠ fallback round 1,
// no split setRuntimeValue).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(async () => null),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(async () => ({ finalDamage: 0, newHp: 0 })),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    hasPotentCantrip: vi.fn(() => false),
    applyMinDamageAdjustment: vi.fn((t) => t),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(() => 0),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

import { processAttackAfterResult } from './attackPostProcessing.js';
import { getRuntimeValue, setRuntimeValue, setRuntimeBatch } from '../runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';
const HOLDER = 'EvasiveFighter';
const TARGET = 'Thug 1';

const MISS_LOG_BYTES = "EvasiveFighter's Riposte attack against Thug 1 missed — Superiority Die expended, no damage dealt.";

// Faithful in-memory store fake (#933 lesson): reads serve the seeded state,
// writes mutate it, so zero-write legs prove the die SURVIVES — a mock that
// merely "recorded no matching call" cannot tell survives-from-clobbered.
let store;

function armStore(riposteKeys) {
    store = { [HOLDER]: { ...riposteKeys }, [TARGET]: {} };
}

function riposteWrites() {
    return setRuntimeBatch.mock.calls.filter(c => c[0] === HOLDER && 'pendingRiposteDieValue' in c[1]);
}

function riposteState() {
    const { pendingRiposteDieValue, _Riposte_usedRound, _Riposte_appliedAttack } = store[HOLDER];
    return { pendingRiposteDieValue, _Riposte_usedRound, _Riposte_appliedAttack };
}

function riposteLogCalls() {
    return addEntry.mock.calls.filter(([, entry]) => entry?.abilityName === 'Riposte');
}

function makeContext() {
    return {
        rollType: 'attack',
        name: 'Shortsword',
        playerStats: { automation: { passives: [] } },
    };
}

function makeState(hit) {
    return {
        effectiveD20: 3,
        r1: 3,
        r2: 3,
        bonus: 9,
        effectiveD20Roll: 3,
        isCrit: false,
        targetAc: 16,
        effectiveAc: 16,
        homingStrikesUsed: false,
        homingStrikesBonus: 0,
        hit,
        isAutoMiss: false,
    };
}

function runAttack(hit) {
    return processAttackAfterResult({
        hit,
        isAutoMiss: false,
        targetName: TARGET,
        characterName: HOLDER,
        campaignName: CAMPAIGN,
        context: makeContext(),
        combatSummary: null,
        characters: [],
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
        state: makeState(hit),
    });
}

describe('processAttackAfterResult — MN-017 Riposte pending-die miss cleanup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((key, prop) => store[key]?.[prop] ?? null);
        setRuntimeValue.mockImplementation((key, prop, value) => {
            store[key] = { ...store[key], [prop]: value };
        });
        setRuntimeBatch.mockImplementation((key, patch) => {
            store[key] = { ...store[key], ...patch };
        });
    });

    it('armed riposte MISS: ONE campaign-pinned merged clear + exact die-expended log bytes', async () => {
        armStore({ pendingRiposteDieValue: 2 });

        await runAttack(false);

        expect(riposteWrites()).toEqual([[HOLDER, { pendingRiposteDieValue: null, _Riposte_usedRound: 1 }, CAMPAIGN]]);
        // No stamp was ever granted — the heal must not fabricate an identity key.
        expect('_Riposte_appliedAttack' in store[HOLDER]).toBe(false);
        const logs = riposteLogCalls();
        expect(logs).toHaveLength(1);
        const [campaign, entry] = logs[0];
        expect(campaign).toBe(CAMPAIGN);
        const { timestamp, ...log } = entry;
        expect(typeof timestamp).toBe('number');
        expect(log).toEqual({
            type: 'ability_use',
            characterName: HOLDER,
            abilityName: 'Riposte',
            description: MISS_LOG_BYTES,
            targetName: TARGET,
        });
    });

    it.each([
        ['resolved hit — pipeline lane owns the consume', true],
        ['unresolved roll — die survives any later resolution', undefined],
    ])('armed riposte, %s: this lane writes and logs ZERO riposte bytes', async (_label, hit) => {
        armStore({ pendingRiposteDieValue: 2 });

        await runAttack(hit);

        expect(riposteWrites()).toHaveLength(0);
        expect(riposteState()).toEqual({ pendingRiposteDieValue: 2 });
        expect(riposteLogCalls()).toHaveLength(0);
    });

    it.each([
        ['nothing armed (null)', null],
        ['zero die (Number guard)', 0],
    ])('miss with %s: zero writes, zero logs, store untouched', async (_label, die) => {
        armStore({ pendingRiposteDieValue: die });

        await runAttack(false);

        expect(riposteWrites()).toHaveLength(0);
        expect(riposteState()).toEqual({ pendingRiposteDieValue: die });
        expect(riposteLogCalls()).toHaveLength(0);
    });

    it('defect-1 heal: re-stamps the existing latch and preserves attack identity in the SAME single write', async () => {
        armStore({ pendingRiposteDieValue: 3, _Riposte_usedRound: 7, _Riposte_appliedAttack: 'd20:2+3:Bandit 2' });

        await runAttack(false);

        // Latch is READ (7), not recomputed from the round-1 fallback; identity is
        // preserved; ONE batch carries everything — no racy split write.
        expect(riposteWrites()).toEqual([[HOLDER, {
            pendingRiposteDieValue: null,
            _Riposte_usedRound: 7,
            _Riposte_appliedAttack: 'd20:2+3:Bandit 2',
        }, CAMPAIGN]]);
        expect(setRuntimeValue).not.toHaveBeenCalledWith(HOLDER, 'pendingRiposteDieValue', null, CAMPAIGN);
        expect(riposteState()).toEqual({
            pendingRiposteDieValue: null,
            _Riposte_usedRound: 7,
            _Riposte_appliedAttack: 'd20:2+3:Bandit 2',
        });
    });
});
