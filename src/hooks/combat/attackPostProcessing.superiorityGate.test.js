// @maintained-by-ai 2026-11-17: 2026-11-17
// HL 2026-11-17 class-gate on the pendingCombatSuperiorityPrompt stamp
// (storeRollContextAndSuperiorityPrompt, attackPostProcessing.js): Combat
// Superiority is a fighter class feature, yet the write was unconditional — a
// GM monster staged-HIT Done commit landed the prompt in the `Goblin`
// change-data bucket (live, run HL). The gate REUSES the established holder
// check — getKnownManeuvers (src/hooks/combat/battleMaster.js) reads the
// BattleMasterManeuvers_selection runtime key, the same predicate
// targetResolution.js applies at this roll seam and the same one the pending-
// prompt CONSUMERS (combatSuperiorityQueries.js handleAttackRiderPrompt/
// handleSkillCheckPrompt) enforce before adjudicating: with zero known
// maneuvers they null the stamp, so a non-holder write was always dead
// residue and the holder lane is byte-identical ungated-vs-gated. Both
// rulesets ride this one write site (single caller, processAttackAfterResult,
// shared by 5e + 2024 through createLogAndShow) — one canonical gate.
// _lastRollContext stays deliberately UNGATED (scope discipline): it is the
// generic roll record every attacker lane writes — pinned still landing in the
// monster bucket.
// Falsified by dropping the holder gate (non-holder legs gain a stamp) and by
// gating wrongly (holder legs lose the adjudicable prompt payload).
// Family map: MN-017 riposte miss cleanup (.riposte), CLA-230 one-shot
// advantage (.nextAttackAdvantage) and MA-1170 shield consume
// (.ma1170-shield-consume) own their lanes — never re-litigated here.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
    // battleMaster.js (the real, un-mocked holder check) imports this binding.
    addStorageChangeListener: vi.fn(() => () => {}),
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
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
const TARGET = 'EvasiveFighter';
const HOLDER = 'TestFighter';
const MONSTER = 'Goblin';
const SELECTION_KEY = 'BattleMasterManeuvers_selection';

// Faithful in-memory store fake (riposte sibling #933 lesson): reads serve the
// seeded state, writes mutate it, so non-holder legs prove the key was NEVER
// stamped — a "no matching call" filter alone cannot tell absent-from-cleared.
let store;

function armStore(attackerBucket) {
    store = { [attackerBucket]: {}, [TARGET]: {} };
    Object.assign(store[attackerBucket], attackerBucket === HOLDER ? { [SELECTION_KEY]: ['Precision Attack', 'Riposte'] } : attackerBucket === MONSTER ? {} : { [SELECTION_KEY]: [] });
}

function promptWrites() {
    return setRuntimeValue.mock.calls.filter(c => c[1] === 'pendingCombatSuperiorityPrompt');
}

function makeContext() {
    return {
        rollType: 'attack',
        name: 'Scimitar',
        damageType: 'Slashing',
        autoDamageFormula: '1d6+2',
    };
}

function makeState() {
    return {
        effectiveD20: 17,
        r1: 17,
        r2: 17,
        bonus: 4,
        effectiveD20Roll: 17,
        isCrit: false,
        targetAc: 16,
        effectiveAc: 16,
        homingStrikesUsed: false,
        homingStrikesBonus: 0,
        hit: true,
        isAutoMiss: false,
    };
}

function runAttack(attacker) {
    return processAttackAfterResult({
        hit: true,
        isAutoMiss: false,
        targetName: TARGET,
        characterName: attacker,
        campaignName: CAMPAIGN,
        context: makeContext(),
        combatSummary: null,
        characters: [],
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
        state: makeState(),
    });
}

describe('processAttackAfterResult — HL 2026-11-17 Combat Superiority holder gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((key, prop) => store[key]?.[prop] ?? null);
        setRuntimeValue.mockImplementation((key, prop, value) => {
            store[key] = { ...store[key], [prop]: value };
        });
    });

    it('GM monster attacker (no maneuver selection): prompt key NEVER stamped in the monster bucket', async () => {
        armStore(MONSTER);

        await runAttack(MONSTER);

        expect(promptWrites()).toHaveLength(0);
        // Not even a null-ghost: the key is absent, not cleared.
        expect('pendingCombatSuperiorityPrompt' in store[MONSTER]).toBe(false);
    });

    it.each([
        ['a GM-controlled monster (selection key absent)', MONSTER, {}],
        ['a non-holder player (selection never armed)', 'TestFighter', {}],
        ['a holder who cleared their selection ([] saved)', 'SelectionCleared', { [SELECTION_KEY]: [] }],
    ])('staged HIT by %s: zero prompt writes, key stays absent', async (_label, attacker, bucket) => {
        store = { [attacker]: { ...bucket }, [TARGET]: {} };

        await runAttack(attacker);

        expect(promptWrites()).toHaveLength(0);
        expect('pendingCombatSuperiorityPrompt' in store[attacker]).toBe(false);
    });

    it('holder attacker (known maneuvers selected): prompt STILL stamped, adjudicable payload intact', async () => {
        armStore(HOLDER);

        await runAttack(HOLDER);

        const writes = promptWrites();
        expect(writes).toHaveLength(1);
        const [name, key, value, campaign] = writes[0];
        expect(name).toBe(HOLDER);
        expect(key).toBe('pendingCombatSuperiorityPrompt');
        expect(campaign).toBe(CAMPAIGN);
        expect(value.rollType).toBe('attack');
        expect(value.attackContext).toEqual({
            hit: true,
            isCrit: false,
            weaponType: 'melee',
            isUnarmedStrike: false,
            targetName: TARGET,
            saveDc: null,
            saveType: null,
            timestamp: expect.any(Number),
        });
        expect(typeof value.timestamp).toBe('number');
    });

    it('monster bucket still receives the generic _lastRollContext record (deliberately ungated)', async () => {
        armStore(MONSTER);

        await runAttack(MONSTER);

        expect(store[MONSTER]._lastRollContext).toMatchObject({
            type: 'attack',
            attackName: 'Scimitar',
            damageFormula: '1d6+2',
            targetName: TARGET,
            oldTotal: 21,
            oldHit: true,
        });
    });
});
