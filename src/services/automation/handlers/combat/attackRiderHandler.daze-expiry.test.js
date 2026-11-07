// @maintained-by-ai
// attackRiderHandler.handleRiderSave SAVE-GATED EXPIRY lane
// (bug-devious-strikes-daze-never-expires): a FAILED save that grants a
// round-scoped condition (Daze dazed / Obscure blinded) must register ONE
// FT-082-style expiration clock that tuple-evicts the descriptor te row AND
// strips the granted condition — before this fix no clock was ever armed, so
// the condition persisted all combat and granted every later attacker
// "Adv (conditions)". Duration-anchor shapes mirror the verified patterns:
// until_start_of_next_turn → attacker-anchored (FT-082 Hamstring / CLA-148),
// until_end_of_next_turn → rounds:2 target-axis backstop (CLA-169).
// Poison/Knock Out (1_minute repeatingSave) stay clockless — their repeat-save
// lane owns termination (separate filed bug); Trip stays clockless per the
// documented persistent-prone standard. Row lifecycle ledgers live in
// attackRiderHandler.save-success-eviction.test.js; shield-bash save flow in
// attackRiderHandler.save-flow.test.js. Deterministic, fully mocked, turn-based.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyRiderOption } from './attackRiderHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 15),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({
        creatures: [{ name: 'Goblin', size: 'Medium', position: { x: 1, y: 1 } }],
        round: 1,
        activeCreatureName: 'TestHero',
    })),
    getTargetFromAttacker: vi.fn(() => ({ name: 'Goblin' })),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/oncePerTurn.js', () => ({
    checkOncePerTurn: vi.fn().mockResolvedValue(null),
    checkOncePerTurnWithSkip: vi.fn().mockResolvedValue(null),
    markOncePerTurn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('./massFearHandler.js', () => ({
    resolveMassFear: vi.fn(async () => ({ type: 'popup', payload: {} })),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../../automation/common/savePrompt.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

// Exact canonical 2024 Devious Strikes options (public/data/2024/classes.json).
const DAZE_OPTION = {
    name: 'Daze',
    cost: '2d6',
    effect: 'daze',
    saveType: 'CON',
    saveDc: 'ability',
    saveAbility: 'DEX',
    condition: 'dazed',
};

const OBSCURE_OPTION = {
    name: 'Obscure',
    cost: '3d6',
    effect: 'blinded',
    saveType: 'DEX',
    saveDc: 'ability',
    saveAbility: 'DEX',
    condition: 'blinded',
    duration: 'until_end_of_next_turn',
};

const TRIP_OPTION = {
    name: 'Trip',
    cost: '1d6',
    effect: 'prone',
    saveType: 'DEX',
    saveDc: 'ability',
    saveAbility: 'DEX',
    condition: 'prone',
    sizeLimit: 'large_or_smaller',
};

const POISON_OPTION = {
    name: 'Poison',
    cost: '1d6',
    effect: 'poisoned',
    saveType: 'CON',
    saveDc: 'ability',
    saveAbility: 'DEX',
    condition: 'poisoned',
    duration: '1_minute',
    repeatingSave: true,
    requires: "Poisoner's Kit",
};

function makeAction(option) {
    return {
        name: 'Devious Strikes',
        description: 'Apply a rider effect on a hit.',
        automation: {
            type: 'attack_rider',
            options: [option],
        },
    };
}

function makePlayerStats() {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [
            { name: 'Dexterity', bonus: 2 },
            { name: 'Constitution', bonus: 2 },
        ],
        toolProficiencies: [],
        inventory: { backpack: ["Poisoner's Kit"], equipped: [] },
        automation: { passives: [] },
    };
}

// Store-backed runtime mirror (sibling-file pattern).
function installStore(initialConditions = []) {
    const store = { targetEffects: [], activeConditions: initialConditions };
    getRuntimeValue.mockImplementation((scope, key) => {
        if (scope === 'campaign' && key === 'targetEffects') return store.targetEffects;
        if (key === 'activeConditions') return store.activeConditions;
        return null;
    });
    setRuntimeValue.mockImplementation(async (scope, key, value) => {
        if (scope === 'campaign' && key === 'targetEffects') store.targetEffects = value;
        if (key === 'activeConditions') store.activeConditions = value;
    });
    return store;
}

function stubSave(saveResult) {
    createSaveListener.mockReturnValue({
        promptId: 'rider-prompt',
        promise: Promise.resolve(saveResult),
    });
}

const FAILED = { success: false, roll: 5, total: 7, saveBonus: 2 };

// ── Tests ──────────────────────────────────────────────────────

describe('attackRiderHandler — save-gated rider expiry registration (Daze/Obscure)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default face: the save FAILS (canonical -19 forced-fail dial live rig).
        stubSave(FAILED);
    });

    it('Daze failed save grants dazed AND registers one attacker-anchored clock (te tuple-evict + condition strip)', async () => {
        const store = installStore([]);

        await applyRiderOption(makeAction(DAZE_OPTION), makePlayerStats(), 'campaign', 'Goblin', ['Daze']);

        // Condition granted on the victim (live-truth lane, unchanged).
        expect(store.activeConditions).toEqual(['dazed']);

        // ONE clock, FT-082 shape: stored under the ATTACKER, anchored to the
        // attacker's next turn-start (rounds: undefined → Infinity, anchor leg
        // fires at currentRound > appliedRound).
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'TestHero',
            targetName: 'Goblin',
            effects: [
                { type: 'remove_target_effect', effectKey: 'daze', source: 'TestHero', option: 'Daze', target: 'Goblin' },
                { type: 'condition', condition: 'dazed' },
            ],
            campaignName: 'campaign',
            rounds: undefined,
            expireOnCreatureName: 'TestHero',
        });
    });

    it('Daze failed save pre-seeded with another condition strips only dazed at expiry (clock carries the exact condition)', async () => {
        const store = installStore(['poisoned']);

        await applyRiderOption(makeAction(DAZE_OPTION), makePlayerStats(), 'campaign', 'Goblin', ['Daze']);

        expect(store.activeConditions).toEqual(['poisoned', 'dazed']);
        const clock = addExpiration.mock.calls[0][0];
        const conditionEffects = clock.effects.filter(e => e.type === 'condition');
        expect(conditionEffects).toEqual([{ type: 'condition', condition: 'dazed' }]);
    });

    it('Obscure failed save registers the CLA-169 rounds:2 target-axis clock (no creature anchor)', async () => {
        installStore([]);

        await applyRiderOption(makeAction(OBSCURE_OPTION), makePlayerStats(), 'campaign', 'Goblin', ['Obscure']);

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'TestHero',
            targetName: 'Goblin',
            effects: [
                { type: 'remove_target_effect', effectKey: 'blinded', source: 'TestHero', option: 'Obscure', target: 'Goblin' },
                { type: 'condition', condition: 'blinded' },
            ],
            campaignName: 'campaign',
            rounds: 2,
        });
    });

    it('Trip failed save stays CLOCKLESS — persistent-prone standard (prone only ends by spending movement)', async () => {
        const store = installStore([]);

        await applyRiderOption(makeAction(TRIP_OPTION), makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

        expect(store.activeConditions).toEqual(['prone']);
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('Poison failed save stays CLOCKLESS — 1_minute repeatingSave is combat-scoped; the repeat-save lane owns termination', async () => {
        const store = installStore([]);

        await applyRiderOption(makeAction(POISON_OPTION), makePlayerStats(), 'campaign', 'Goblin', ['Poison']);

        expect(store.activeConditions).toEqual(['poisoned']);
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('Daze save SUCCESS registers no clock (saved legs evict via the success lane)', async () => {
        stubSave({ success: true, roll: 18, total: 20, saveBonus: 2 });
        const store = installStore([]);

        await applyRiderOption(makeAction(DAZE_OPTION), makePlayerStats(), 'campaign', 'Goblin', ['Daze']);

        expect(addExpiration).not.toHaveBeenCalled();
        expect(store.activeConditions).toEqual([]);
    });
});
