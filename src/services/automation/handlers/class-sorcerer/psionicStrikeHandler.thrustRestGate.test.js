// @maintained-by-ai 2026-11-26
// CLA-355: Telekinetic Thrust once-per-rest uses gate + seed registration.
// Owns the telekineticThrustUses lane in BOTH handlers: the psionicStrike
// chain (resolveThrustChain) and the manual thrust row
// (telekineticThrustHandler.handle). The seed itself (presence/absence) is
// delegated HERE by trackedResources.test.js:21.
// Owned elsewhere, cited not re-probed:
//   - CLA-273 round latches (psionicStrikeUsedThisTurn +
//     telekineticThrustUsedRound firing/re-arm): psionicStrikeHandler.test.js.
//   - Rest re-arm mechanics: the full-set registration-membership + null
//     re-arm censuses in restRules-shortRest.test.js:181 and
//     restRules-longRest.test.js:143 already cover
//     'telekineticThrustUses' — no single-key echo test here (#1301).
// What this file pins that nothing else does: the 0-uses refusal (popup +
// logged refusal, zero writes) in both lanes, null = re-armed firing in both
// lanes, fix#337S latch honesty (a refused strike writes NOTHING to any
// telekinetic* key — not even the once-per-turn stamp), and the
// no-target / options-free bypasses on the manual row.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle as handleStrike } from './psionicStrikeHandler.js';
import { handle as handleThrust } from './telekineticThrustHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import { computeTrackedResources } from '../../../rules/trackedResources.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
    setRuntimeBatch: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', async (importOriginal) => {
    const actual = await importOriginal()
    return { ...actual, rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })), rollD20: vi.fn(() => 10) }
});

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 17),
    createSaveListener: vi.fn(),
}));

vi.mock('../../common/buildResultMessage.js', () => ({
    buildResultMessage: vi.fn(() => 'result'),
}));

vi.mock('../../../../services/ui/storage.js', () => ({
    default: {
        set: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock('../../../../services/combat/conditions/conditionSaveService.js', () => ({
    addCondition: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
}));

vi.mock('../../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => ({})),
}));

import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { loadCombatSummary, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { findLastAttack } from '../../common/damageRollback.js';

const { getRuntimeValue, setRuntimeValue } = runtimeState;
const { addEntry } = logService;

const FROZEN_NOW = 1700000000000;

const STRIKE_ACTION = {
    name: 'Psionic Strike',
    automation: {
        type: 'psionic_strike',
        resource: 'psionicEnergy',
        damageExpression: 'psionic_energy_die + INT modifier',
        damageType: 'Force',
        oncePerTurn: true,
    },
};

const THRUST_REACTION = {
    type: 'telekinetic_thrust',
    saveType: 'STR',
    saveAbility: 'INT',
    saveDc: 'ability',
    trigger: 'after_attack_hit',
    oncePerTurn: true,
    options: [{ name: 'Prone + Push 10ft', effect: 'prone_and_push', value: 10 }],
};

const THRUST_ACTION = { name: 'Telekinetic Thrust', automation: THRUST_REACTION };

// The refusal log entry the SHARED description string feeds into both lanes
// (psionicStrikeHandler.js:75-82 / telekineticThrustHandler.js:22-29).
function refusalLogEntry(characterName) {
    return {
        type: 'automation',
        characterName,
        automationType: 'telekinetic_thrust_refused',
        name: 'Telekinetic Thrust',
        description: 'Telekinetic Thrust has no uses remaining. Recharges when you finish a Short or Long Rest.',
        timestamp: FROZEN_NOW,
    };
}

function makeStats(overrides = {}) {
    return {
        name: 'PsiTester',
        level: 18,
        rules: '2024',
        _trackedResources: {
            psionicEnergy: { max: 12 },
            telekineticThrustUses: { current: 1, max: 1 },
        },
        abilities: [{ name: 'Intelligence', bonus: 3 }],
        automation: { reactions: [THRUST_REACTION] },
        ...overrides,
    };
}

function hitAttack() {
    return {
        attackEvent: {
            attackerName: 'PsiTester',
            targetName: 'Gibbering Mouther 1',
            hit: true,
            rollType: 'attack',
            weaponType: 'melee',
            isUnarmedStrike: false,
            isCantrip: false,
            actualDamage: 6,
        },
        attackerName: 'PsiTester',
        targetName: 'Gibbering Mouther 1',
        totalDamage: 6,
        damageTypes: ['Slashing'],
    };
}

function stampRuntime(values = {}) {
    getRuntimeValue.mockImplementation((player, key) => {
        if (player === 'characters' && key === 'characters') return [];
        return values[key] ?? null;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    getCombatContext.mockResolvedValue({ creatures: [{ name: 'Gibbering Mouther 1', conditions: [] }] });
    getTargetFromAttacker.mockReturnValue({ name: 'Gibbering Mouther 1' });
    loadCombatSummary.mockResolvedValue({ creatures: [] });
    applyDamageToTarget.mockResolvedValue({ finalDamage: 8 });
    findLastAttack.mockResolvedValue(hitAttack());
    getCurrentCombatRound.mockReturnValue(1);
    setRuntimeValue.mockResolvedValue(undefined);
    createSaveListener.mockReturnValue({
        promptId: 'p1',
        promise: Promise.resolve({ success: true, total: 20, roll: 17, saveBonus: 3 }),
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('CLA-355 telekineticThrustUses seed registration', () => {
    it('seeds {current: 1, max: 1} only when the telekinetic_thrust reaction is present (owned-only pass)', () => {
        const owned = computeTrackedResources({
            level: 18,
            rules: '2024',
            class: { name: 'Fighter', subclass: { name: 'Psi Warrior' }, class_levels: [] },
            abilities: [],
            automation: { reactions: [THRUST_REACTION] },
        });
        expect(owned.telekineticThrustUses).toEqual({ current: 1, max: 1 });

        // improve tracked-resource-ghost-keys (2026-11-14): the old {0,0}
        // seed was a non-owner ghost — the key is now ABSENT for non-owners
        // (GATED_TRACKED_KEYS); both handlers read `?.max ?? 1`, so absence
        // is byte-equivalent to the old full seed at the gate.
        const unowned = computeTrackedResources({
            level: 18,
            rules: '2024',
            class: { name: 'Fighter', subclass: { name: 'Champion' }, class_levels: [] },
            abilities: [],
        });
        expect(unowned).not.toHaveProperty('telekineticThrustUses');
    });
});

describe('CLA-355 psionic strike thrust chain gate', () => {
    it('rest-rearmed fresh-null counter fires the chain and spends exactly one use', async () => {
        stampRuntime({ psionicEnergy: 12 }); // telekineticThrustUses null = re-armed

        const result = await handleStrike(STRIKE_ACTION, makeStats(), 'test-campaign');

        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
            targetName: 'Gibbering Mouther 1',
            saveType: 'STR',
            saveDc: 17,
        });
        expect(result.payload.description).toContain('saved vs Telekinetic Adept (DC 17)');
        expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'telekineticThrustUses')).toEqual([
            ['PsiTester', 'telekineticThrustUses', 0, 'test-campaign'],
        ]);
        expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            automationType: 'telekinetic_thrust_refused',
        }));
    });

    it('refuses the chain at 0 uses: logged refusal, no save prompt, zero writes to any telekinetic* key, strike still resolves', async () => {
        stampRuntime({ psionicEnergy: 12, telekineticThrustUses: 0 });
        getCurrentCombatRound.mockReturnValue(2);

        const result = await handleStrike(STRIKE_ACTION, makeStats(), 'test-campaign');

        // The strike itself resolves normally (energy spend + CLA-273 latch).
        expect(result.payload.description).toContain('Dealt <strong>8</strong> Force damage to Gibbering Mouther 1');
        expect(result.payload.description).not.toContain('Telekinetic');
        // Ordered commit census: NOTHING telekinetic* is written — no spend,
        // no phantom refill, and fix#337S latch honesty: a refused strike
        // must NOT burn the once-per-turn stamp (psionicStrikeHandler.js:85-90).
        expect(setRuntimeValue.mock.calls).toEqual([
            ['PsiTester', 'psionicEnergy', 11, 'test-campaign'],
            ['PsiTester', 'psionicStrikeUsedThisTurn', 2, 'test-campaign'],
        ]);
        expect(createSaveListener).not.toHaveBeenCalled();
        // Refusal log pinned full-shape; the 3 total entries prove no chain
        // roll/push logs leaked (refusal + strike ability_use + damage roll).
        expect(addEntry.mock.calls[0]).toEqual(['test-campaign', refusalLogEntry('PsiTester')]);
        expect(addEntry).toHaveBeenCalledTimes(3);
    });
});

describe('CLA-355 manual thrust row gate', () => {
    it('refuses at 0 uses with a full-shape refusal popup and exactly one refusal log', async () => {
        stampRuntime({ telekineticThrustUses: 0 });

        const result = await handleThrust(THRUST_ACTION, makeStats(), 'test-campaign');

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Telekinetic Thrust',
                automationType: 'telekinetic_thrust',
                description: 'Telekinetic Thrust: No uses remaining. Recharges when you finish a Short or Long Rest.',
                automation: THRUST_REACTION,
            },
        });
        expect(setRuntimeValue.mock.calls).toEqual([]);
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(addEntry.mock.calls).toEqual([['test-campaign', refusalLogEntry('PsiTester')]]);
    });

    it('targeted activation spends exactly one use (1 -> 0) and opens the save prompt', async () => {
        stampRuntime({ telekineticThrustUses: 1 });

        await handleThrust(THRUST_ACTION, makeStats(), 'test-campaign');

        // Ordered write census: the single spend, then the rider-choice clear.
        expect(setRuntimeValue.mock.calls).toEqual([
            ['PsiTester', 'telekineticThrustUses', 0, 'test-campaign'],
            ['PsiTester', 'pendingRiderChoice', null, 'test-campaign'],
        ]);
        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
            targetName: 'Gibbering Mouther 1',
            saveType: 'STR',
            saveDc: 17,
        });
    });

    it('no target selected: refusal popup with zero writes and zero logs', async () => {
        getTargetFromAttacker.mockReturnValue(null);
        stampRuntime({}); // null uses = re-armed, so the gate passes and the target check runs

        const result = await handleThrust(THRUST_ACTION, makeStats(), 'test-campaign');

        expect(result.payload.description).toContain('No target selected — no use spent');
        expect(setRuntimeValue.mock.calls).toEqual([]);
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('options-free "ready" info path bypasses the uses gate entirely — no gate, no spend', async () => {
        stampRuntime({ telekineticThrustUses: 0 });

        const result = await handleThrust({ name: 'Telekinetic Thrust', automation: { type: 'telekinetic_thrust' } }, makeStats(), 'test-campaign');

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Telekinetic Thrust',
                automationType: 'telekinetic_thrust',
                description: 'Telekinetic Thrust ready. The next Psionic Strike hit will trigger it.',
                automation: { type: 'telekinetic_thrust' },
            },
        });
        expect(setRuntimeValue.mock.calls).toEqual([]);
        expect(createSaveListener).not.toHaveBeenCalled();
    });
});
