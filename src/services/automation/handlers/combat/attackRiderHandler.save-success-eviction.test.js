// @maintained-by-ai
// attackRiderHandler.handleRiderSave SAVE-RESOLUTION lane (DG 2026-11-06
// improve): a successful save evicts the pre-save descriptor row from the
// campaign-root targetEffects store (no misreadable prone residue; the
// ability_use log is the audit trail); a failed save keeps the row
// byte-identical and grants the condition exactly as before. Consumer
// census: no reader keys on these rows post-resolution (badges skip
// unregistered effect keys; EffectAdder is registry-only; conditionToApply
// folds are dead outside conditionEffects.js). Owned elsewhere: handle()
// routing / dispatch by attackRiderHandler.test.js; Shield Bash save flow
// by attackRiderHandler.save-flow.test.js; VT secondary lane by
// versatileTricksterHandler.test.js. Deterministic, fully mocked, turn-based.
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
import { addEntry } from '../../../ui/logService.js';
import { createSaveListener } from '../../../automation/common/savePrompt.js';

// ── Helpers ────────────────────────────────────────────────────

// Exact canonical 2024 Cunning Strike Trip option (public/data/2024/classes.json).
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

function makeAction() {
    return {
        name: 'Cunning Strike',
        description: 'Apply a rider effect on a hit.',
        automation: {
            type: 'attack_rider',
            options: [TRIP_OPTION],
        },
    };
}

function makePlayerStats() {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [
            { name: 'Dexterity', bonus: 2 },
        ],
        toolProficiencies: [],
        automation: { passives: [] },
    };
}

// Store-backed runtime mirror: setRuntimeValue('campaign','targetEffects',…)
// updates what the NEXT getRuntimeValue reads, so the append → save → evict
// sequence behaves like the real in-memory store.
function installTargetEffectStore(initial = []) {
    const store = { targetEffects: initial, activeConditions: null };
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
        promptId: 'trip-prompt',
        promise: Promise.resolve(saveResult),
    });
}

function teWrites() {
    return setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
}

// ── Tests ──────────────────────────────────────────────────────

describe('attackRiderHandler — Trip save-resolution row lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('save SUCCESS evicts the descriptor row: append then evict, store ends empty, no condition granted', async () => {
        const store = installTargetEffectStore([]);
        stubSave({ success: true, roll: 18, total: 20, saveBonus: 2 });

        const result = await applyRiderOption(makeAction(), makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

        // Save legs resolve through handleRiderSave (returns null).
        expect(result).toBeNull();

        // Two writes: the pre-save append, then the save-success eviction.
        const writes = teWrites();
        expect(writes).toHaveLength(2);
        expect(writes[0][2]).toHaveLength(1);
        expect(writes[1]).toEqual(['campaign', 'targetEffects', [], 'campaign']);
        expect(store.targetEffects).toEqual([]);

        // Nothing was granted: no activeConditions write on the success face.
        expect(setRuntimeValue.mock.calls.some(c => c[1] === 'activeConditions')).toBe(false);

        // Audit stays in the log (row unchanged): succeeded copy.
        expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Cunning Strike',
            description: 'Trip applied to Goblin — Goblin rolled 18 on DEX save (DC 15), succeeded — no effect',
        }));
    });

    it('save SUCCESS keeps every OTHER row (tuple-scoped eviction)', async () => {
        const foreign = { target: 'Skeleton', source: 'TestHero', option: 'Hamstring', effect: 'speed_reduction', value: 10 };
        const store = installTargetEffectStore([foreign]);
        stubSave({ success: true, roll: 19, total: 21, saveBonus: 2 });

        await applyRiderOption(makeAction(), makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

        const writes = teWrites();
        expect(writes.at(-1)).toEqual(['campaign', 'targetEffects', [foreign], 'campaign']);
        expect(store.targetEffects).toEqual([foreign]);
    });

    it('save FAIL keeps the row byte-identical, grants prone, logs the outcome (adjacent-behavior pin)', async () => {
        const store = installTargetEffectStore([]);
        stubSave({ success: false, roll: 5, total: 7, saveBonus: 2 });

        const result = await applyRiderOption(makeAction(), makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

        expect(result).toBeNull();

        // Exactly one write — the append; NO eviction on the fail face.
        const writes = teWrites();
        expect(writes).toHaveLength(1);
        expect(writes[0]).toEqual(['campaign', 'targetEffects', [expect.objectContaining({
            target: 'Goblin',
            source: 'TestHero',
            option: 'Trip',
            effect: 'prone',
            value: null,
            noOpportunityAttacks: false,
            duration: 'until_start_of_next_turn',
            saveType: 'DEX',
            saveDc: 'ability',
            saveAbility: 'DEX',
            condition: 'prone',
            repeatingSave: false,
            requires: null,
            sizeLimit: 'large_or_smaller',
            movement: null,
            cost: '1d6',
            ignoreResistance: false,
            restoreCost: null,
            damageDoubled: false,
            damageExpression: null,
            damageType: null,
            label: 'Cunning Strike',
        })], 'campaign']);
        // The stored row carries the full byte shape (exact equality, not just contains).
        expect(store.targetEffects[0]).toEqual({
            target: 'Goblin',
            source: 'TestHero',
            option: 'Trip',
            effect: 'prone',
            value: null,
            noOpportunityAttacks: false,
            duration: 'until_start_of_next_turn',
            saveType: 'DEX',
            saveDc: 'ability',
            saveAbility: 'DEX',
            condition: 'prone',
            repeatingSave: false,
            requires: null,
            sizeLimit: 'large_or_smaller',
            movement: null,
            cost: '1d6',
            ignoreResistance: false,
            restoreCost: null,
            damageDoubled: false,
            damageExpression: null,
            damageType: null,
            label: 'Cunning Strike',
        });

        // Prone granted via activeConditions (the live-truth lane, unchanged).
        expect(store.activeConditions).toEqual(['prone']);

        expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
            type: 'ability_use',
            abilityName: 'Cunning Strike',
            description: 'Trip applied to Goblin — Goblin rolled 5 on DEX save (DC 15), failed — prone condition applied',
        }));
    });

    it('non-boolean save result (parked/dismissed shapes) keeps the row — eviction is success===true only', async () => {
        const store = installTargetEffectStore([]);
        stubSave({ roll: 11, total: 13, saveBonus: 2 });

        await applyRiderOption(makeAction(), makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

        expect(teWrites()).toHaveLength(1);
        expect(store.targetEffects).toHaveLength(1);
        expect(store.activeConditions).toBeNull();
    });
});
