// CLA-355: Telekinetic Thrust once-per-rest uses gate + rest re-arm registration
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle as handleStrike } from './psionicStrikeHandler.js';
import { handle as handleThrust } from './telekineticThrustHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import { computeTrackedResources } from '../../../rules/trackedResources.js';
import { SHORT_REST_RESOURCES, LONG_REST_RESOURCES } from '../../../rules/effects/restRules-constants.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
    setRuntimeBatch: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 5, rolls: [5] })),
    rollD20: vi.fn(() => 10),
}));

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

describe('CLA-355 tracked resource registration', () => {
    beforeEach(() => vi.clearAllMocks());

    it('registers telekineticThrustUses max 1 when telekinetic_thrust reaction exists', () => {
        const resources = computeTrackedResources({
            level: 18,
            rules: '2024',
            class: { name: 'Fighter', subclass: { name: 'Psi Warrior' }, class_levels: [] },
            abilities: [],
            automation: { reactions: [THRUST_REACTION] },
        });
        expect(resources.telekineticThrustUses).toEqual({ current: 1, max: 1 });
    });

    it('registers 0 uses without the telekinetic_thrust reaction', () => {
        const resources = computeTrackedResources({
            level: 18,
            rules: '2024',
            class: { name: 'Fighter', subclass: { name: 'Champion' }, class_levels: [] },
            abilities: [],
        });
        expect(resources.telekineticThrustUses).toEqual({ current: 0, max: 0 });
    });

    it('rest seams re-arm telekineticThrustUses (short OR long rest per app data)', () => {
        expect(SHORT_REST_RESOURCES).toContain('telekineticThrustUses');
        expect(LONG_REST_RESOURCES).toContain('telekineticThrustUses');
    });
});

describe('CLA-355 psionic strike thrust chain gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    it('fires and spends the thrust use (1 -> 0) when counter is fresh-null', async () => {
        stampRuntime({ psionicEnergy: 12 });

        await handleStrike(STRIKE_ACTION, makeStats(), 'test-campaign');

        expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
            targetName: 'Gibbering Mouther 1',
            saveType: 'STR',
            saveDc: 17,
        });
        expect(setRuntimeValue).toHaveBeenCalledWith('PsiTester', 'telekineticThrustUses', 0, 'test-campaign');
    });

    it('fires and spends when tracked max present (1 -> 0)', async () => {
        stampRuntime({ psionicEnergy: 12, telekineticThrustUses: 1 });

        await handleStrike(STRIKE_ACTION, makeStats(), 'test-campaign');

        expect(setRuntimeValue).toHaveBeenCalledWith('PsiTester', 'telekineticThrustUses', 0, 'test-campaign');
    });

    it('refuses at 0 uses later round with a refusal log, no save prompt, no spend', async () => {
        stampRuntime({ psionicEnergy: 12, telekineticThrustUses: 0 });
        getCurrentCombatRound.mockReturnValue(2);

        await handleStrike(STRIKE_ACTION, makeStats(), 'test-campaign');

        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith('PsiTester', 'telekineticThrustUses', expect.any(Number), 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            type: 'automation',
            automationType: 'telekinetic_thrust_refused',
            characterName: 'PsiTester',
        }));
    });

    it('does not auto-refill a spent counter (no phantom refill)', async () => {
        stampRuntime({ psionicEnergy: 12, telekineticThrustUses: 0 });
        getCurrentCombatRound.mockReturnValue(3);

        const result = await handleStrike(STRIKE_ACTION, makeStats(), 'test-campaign');

        expect(result.payload.description).toContain('Dealt');
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith('PsiTester', 'telekineticThrustUses', expect.any(Number), 'test-campaign');
    });
});

describe('CLA-355 manual thrust row gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatContext.mockResolvedValue({ creatures: [{ name: 'Gibbering Mouther 1', conditions: [] }] });
        getTargetFromAttacker.mockReturnValue({ name: 'Gibbering Mouther 1' });
        setRuntimeValue.mockResolvedValue(undefined);
        createSaveListener.mockReturnValue({
            promptId: 'p1',
            promise: Promise.resolve({ success: true, total: 20, roll: 17, saveBonus: 3 }),
        });
    });

    it('refuses with refusal popup + log at 0 uses', async () => {
        stampRuntime({ telekineticThrustUses: 0 });

        const result = await handleThrust(THRUST_ACTION, makeStats(), 'test-campaign');

        expect(result.payload.description).toContain('No uses remaining');
        expect(result.payload.description).toContain('Short or Long Rest');
        expect(createSaveListener).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalledWith('PsiTester', 'telekineticThrustUses', expect.any(Number), 'test-campaign');
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            automationType: 'telekinetic_thrust_refused',
        }));
    });

    it('spends exactly one use on a targeted activation', async () => {
        stampRuntime({ telekineticThrustUses: 1 });

        await handleThrust(THRUST_ACTION, makeStats(), 'test-campaign');

        expect(setRuntimeValue).toHaveBeenCalledWith('PsiTester', 'telekineticThrustUses', 0, 'test-campaign');
        expect(createSaveListener).toHaveBeenCalled();
    });

    it('spends nothing when no target is selected', async () => {
        getTargetFromAttacker.mockReturnValue(null);
        stampRuntime({});

        const result = await handleThrust(THRUST_ACTION, makeStats(), 'test-campaign');

        expect(result.payload.description).toContain('No target selected — no use spent');
        expect(setRuntimeValue).not.toHaveBeenCalledWith('PsiTester', 'telekineticThrustUses', expect.any(Number), 'test-campaign');
    });

    it('does not gate or spend the unarmed "ready" info path (no options)', async () => {
        stampRuntime({ telekineticThrustUses: 0 });

        const result = await handleThrust({ name: 'Telekinetic Thrust', automation: { type: 'telekinetic_thrust' } }, makeStats(), 'test-campaign');

        expect(result.payload.description).toContain('ready');
        expect(setRuntimeValue).not.toHaveBeenCalledWith('PsiTester', 'telekineticThrustUses', expect.any(Number), 'test-campaign');
    });
});
