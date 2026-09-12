// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './psionicStrikeHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as diceRoller from '../../../dice/diceRoller.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
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
    buildSaveDc: vi.fn(() => 14),
    createSaveListener: vi.fn(),
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

import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { loadCombatSummary, getCurrentCombatRound } from '../../../encounters/combatData.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { addCondition } from '../../../../services/combat/conditions/conditionSaveService.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

const { getRuntimeValue, setRuntimeValue } = runtimeState;
const { addEntry } = logService;
const { rollExpression } = diceRoller;

const DEFAULT_ACTION = {
    name: 'Psionic Strike',
    automation: {
        type: 'psionic_strike',
        resource: 'psionicEnergy',
        damageExpression: 'psionic_energy_die + INT modifier',
        damageType: 'Force',
        oncePerTurn: true,
        casting_time: '1 reaction',
    },
};

const DEFAULT_PLAYER_STATS = {
    name: 'Test Fighter',
    level: 12,
    _trackedResources: { psionicEnergy: { max: 8 } },
    abilities: [{ name: 'Intelligence', bonus: 3 }],
};

function makePlayerStats(overrides = {}) {
    return { ...DEFAULT_PLAYER_STATS, ...overrides };
}

function makeAction(overrides = {}) {
    return { ...DEFAULT_ACTION, ...overrides };
}

function makeRollResult(total, sides = 8) {
    return { total, rolls: [total], modifier: 0, formula: `1d${sides}` };
}

function hitAttack(overrides = {}) {
    return {
        attackEvent: {
            attackerName: 'Test Fighter',
            targetName: 'Target Goblin',
            hit: true,
            rollType: 'attack',
            weaponType: 'melee',
            isUnarmedStrike: false,
            isCantrip: false,
            attackName: 'Shortsword',
            damageType: 'Piercing',
            actualDamage: 6,
            ...overrides,
        },
        attackerName: 'Test Fighter',
        targetName: 'Target Goblin',
        totalDamage: 6,
        damageTypes: ['Piercing'],
    };
}

function mockSuccessfulRuntimeValues(overrides = {}) {
    const {
        psionicEnergy = 5,
        psionicStrikeUsedThisTurn = null,
        telekineticThrustUsedRound = null,
        ...otherKeys
    } = overrides;

    getRuntimeValue.mockImplementation((player, key, _campaign) => {
        if (player === 'characters' && key === 'characters') return [];
        if (key === 'psionicEnergy') return psionicEnergy;
        if (key === 'psionicStrikeUsedThisTurn') return psionicStrikeUsedThisTurn;
        if (key === 'telekineticThrustUsedRound') return telekineticThrustUsedRound;
        return otherKeys[key] ?? null;
    });
}

const playerWithThrust = makePlayerStats({
    automation: {
        reactions: [{
            type: 'telekinetic_thrust',
            saveType: 'STR',
            saveDc: 'ability',
            saveAbility: 'INT',
            trigger: 'after_attack_hit',
            oncePerTurn: true,
            options: [{ name: 'Prone + Push 10ft', effect: 'prone_and_push', value: 10 }],
        }],
    },
});

describe('psionicStrikeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatContext.mockResolvedValue({ creatures: [] });
        getTargetFromAttacker.mockReturnValue({ name: 'Target Goblin' });
        loadCombatSummary.mockResolvedValue({ creatures: [] });
        applyDamageToTarget.mockResolvedValue({ finalDamage: 8 });
        rollExpression.mockReturnValue(makeRollResult(5));
        setRuntimeValue.mockResolvedValue(undefined);
        findLastAttack.mockResolvedValue(hitAttack());
        getCurrentCombatRound.mockReturnValue(1);
        isWithinRange.mockResolvedValue(true);
        buildSaveDc.mockReturnValue(14);
        createSaveListener.mockReturnValue({
            promptId: 'test-id',
            promise: Promise.resolve({ success: true, total: 15, roll: 12, saveBonus: 3 }),
        });
    });

    describe('hit trigger gate (CLA-273)', () => {
        it('refuses with no recent attack — no die spent', async () => {
            mockSuccessfulRuntimeValues();
            findLastAttack.mockResolvedValue({ attackEvent: null, attackerName: null, targetName: null, totalDamage: 0, damageTypes: [] });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('requires a weapon hit');
            expect(result.payload.description).toContain('no Psionic Energy spent');
            expect(rollExpression).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('refuses after a MISS — no die spent, no damage', async () => {
            mockSuccessfulRuntimeValues();
            findLastAttack.mockResolvedValue(hitAttack({ hit: false, actualDamage: undefined }));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('requires a weapon hit');
            expect(result.payload.description).toContain('missed');
            expect(rollExpression).not.toHaveBeenCalled();
            expect(applyDamageToTarget).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses when the last attack was made by another creature', async () => {
            mockSuccessfulRuntimeValues();
            findLastAttack.mockResolvedValue(hitAttack({ attackerName: 'Goblin', targetName: 'Test Fighter' }));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('made by you');
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses unarmed strikes and cantrip attacks', async () => {
            mockSuccessfulRuntimeValues();
            findLastAttack.mockResolvedValue(hitAttack({ isUnarmedStrike: true }));
            let result = await handle(makeAction(), makePlayerStats(), 'test-campaign');
            expect(result.payload.description).toContain('requires a weapon attack');

            findLastAttack.mockResolvedValue(hitAttack({ isCantrip: true }));
            result = await handle(makeAction(), makePlayerStats(), 'test-campaign');
            expect(result.payload.description).toContain('requires a weapon attack');
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('refuses when the attack dealt no damage', async () => {
            mockSuccessfulRuntimeValues();
            findLastAttack.mockResolvedValue({ ...hitAttack(), totalDamage: 0 });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('to deal damage');
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses when the strike target differs from the last attack target', async () => {
            mockSuccessfulRuntimeValues();
            getTargetFromAttacker.mockReturnValue({ name: 'Other Ogre' });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('must target the creature you just hit');
            expect(rollExpression).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('refuses when the target is out of 30 feet', async () => {
            mockSuccessfulRuntimeValues();
            isWithinRange.mockResolvedValue(false);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('out of 30 feet');
            expect(isWithinRange).toHaveBeenCalledWith('Test Fighter', 'Target Goblin', 30);
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('fires after a qualifying weapon attack hit with exact math', async () => {
            mockSuccessfulRuntimeValues({ psionicEnergy: 5 });
            rollExpression.mockReturnValue(makeRollResult(5));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(rollExpression).toHaveBeenCalledWith('1d8');
            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Target Goblin', 8, ['Force'], 'test-campaign', [], { ignoreResistance: false, attackerName: 'Test Fighter' });
            expect(setRuntimeValue).toHaveBeenCalledWith('Test Fighter', 'psionicEnergy', 4, 'test-campaign');
            expect(result.payload.description).toContain('Dealt <strong>8</strong> Force damage to Target Goblin');
        });
    });

    describe('resource validation', () => {
        it('returns error popup when psionic energy is zero', async () => {
            getRuntimeValue.mockImplementation((player, key) => {
                if (key === 'psionicEnergy') return 0;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('No Psionic Energy remaining');
            expect(result.payload.description).toContain('Short or Long Rest');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('uses default max when tracked resources is null or missing the resource key', async () => {
            mockSuccessfulRuntimeValues({ psionicEnergy: 3 });

            const result = await handle(
                makeAction(),
                makePlayerStats({ _trackedResources: null }),
                'test-campaign'
            );

            expect(result.payload.description).toContain('Target Goblin');
            expect(result.payload.description).toContain('Psionic Energy: 2/6');
        });

        it('uses custom resource name from automation config', async () => {
            const customAction = makeAction({
                automation: { ...DEFAULT_ACTION.automation, resource: 'customResource' },
            });
            getRuntimeValue.mockImplementation((player, key, _campaign) => {
                if (player === 'characters' && key === 'characters') return [];
                if (key === 'customResource') return 2;
                return null;
            });

            await handle(customAction, makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith('Test Fighter', 'customResource', 1, 'test-campaign');
        });
    });

    describe('once-per-turn enforcement (round-keyed)', () => {
        it('blocks reuse in the same round', async () => {
            mockSuccessfulRuntimeValues({ psionicStrikeUsedThisTurn: 1 });
            getCurrentCombatRound.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Already used this turn');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('Test Fighter', 'psionicEnergy', expect.any(Number), 'test-campaign');
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('blocks same-turn reuse even without a round on the latch (sentinel removal)', async () => {
            mockSuccessfulRuntimeValues({ psionicStrikeUsedThisTurn: 'unknown' });
            getCurrentCombatRound.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).not.toContain('Already used this turn');
            expect(setRuntimeValue).toHaveBeenCalledWith('Test Fighter', 'psionicStrikeUsedThisTurn', 1, 'test-campaign');
        });

        it('allows use on a later round', async () => {
            mockSuccessfulRuntimeValues({ psionicStrikeUsedThisTurn: 1 });
            getCurrentCombatRound.mockReturnValue(2);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Target Goblin');
            expect(setRuntimeValue).toHaveBeenCalledWith('Test Fighter', 'psionicStrikeUsedThisTurn', 2, 'test-campaign');
        });

        it('does not enforce once-per-turn when oncePerTurn is false', async () => {
            mockSuccessfulRuntimeValues({ psionicEnergy: 5 });

            const result = await handle(
                makeAction({ automation: { ...DEFAULT_ACTION.automation, oncePerTurn: false } }),
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.payload.description).toContain('Force damage');
            expect(setRuntimeValue).toHaveBeenCalledWith('Test Fighter', 'psionicEnergy', 4, 'test-campaign');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('Test Fighter', 'psionicStrikeUsedThisTurn', expect.anything(), 'test-campaign');
        });
    });

    describe('damage calculation', () => {
        it('uses INT modifier of 0 when Intelligence ability is missing', async () => {
            mockSuccessfulRuntimeValues();

            const result = await handle(
                makeAction(),
                makePlayerStats({ abilities: [] }),
                'test-campaign'
            );

            expect(result.payload.description).toContain('+ INT 0');
        });

        it('applies negative INT modifier', async () => {
            mockSuccessfulRuntimeValues();

            const result = await handle(
                makeAction(),
                makePlayerStats({ abilities: [{ name: 'Intelligence', bonus: -2 }] }),
                'test-campaign'
            );

            expect(result.payload.description).toContain('+ INT -2');
            expect(result.payload.description).toContain('Psionic Energy: 4/8');
        });

        it('uses psionicDieSize as fallback when dieRoll.total is falsy', async () => {
            mockSuccessfulRuntimeValues();
            rollExpression.mockReturnValue({ total: 0, rolls: [0] });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Rolled d8: 8');
        });
    });

    describe('die size by level', () => {
        function testDieSize(level, expectedDie) {
            it(`uses 1d${expectedDie} for level ${level}`, async () => {
                const playerStats = makePlayerStats({ level });
                mockSuccessfulRuntimeValues({ psionicEnergy: 8 });
                rollExpression.mockReturnValue(makeRollResult(7, expectedDie));

                await handle(makeAction(), playerStats, 'test-campaign');

                expect(rollExpression).toHaveBeenCalledWith(`1d${expectedDie}`);
            });
        }

        testDieSize(1, 6);
        testDieSize(3, 6);
        testDieSize(9, 8);
        testDieSize(17, 12);
    });

    describe('popup and log wording', () => {
        it('prints die as "Rolled dN: value" in popup and ability_use log', async () => {
            mockSuccessfulRuntimeValues();
            rollExpression.mockReturnValue(makeRollResult(4));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Rolled d8: 4 + INT 3');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                description: expect.stringContaining('Rolled d8: 4 + INT 3'),
            }));
        });

        it('logs the damage roll with dice notation formula', async () => {
            mockSuccessfulRuntimeValues();

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'roll',
                rollType: 'damage',
                name: 'Psionic Strike Damage',
                targetName: 'Target Goblin',
                damageType: 'Force',
                total: 8,
                formula: '1d8 + 3',
            }));
        });

        it('handles addEntry failure gracefully', async () => {
            mockSuccessfulRuntimeValues();
            addEntry.mockRejectedValue(new Error('Network error'));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Target Goblin');
            expect(result.payload.description).toContain('Force damage');
        });
    });

    describe('telekinetic thrust chain', () => {
        it('never opens a save prompt when the strike is refused', async () => {
            mockSuccessfulRuntimeValues();
            findLastAttack.mockResolvedValue({ attackEvent: null, attackerName: null, targetName: null, totalDamage: 0, damageTypes: [] });

            await handle(makeAction(), playerWithThrust, 'test-campaign');

            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('chains the lv7 save prompt after strike damage resolves', async () => {
            mockSuccessfulRuntimeValues();

            const result = await handle(makeAction(), playerWithThrust, 'test-campaign');

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Target Goblin',
                saveType: 'STR',
                saveDc: 14,
            });
            expect(result.payload.description).toContain('saved vs Telekinetic Adept');
            expect(setRuntimeValue).toHaveBeenCalledWith('Test Fighter', 'telekineticThrustUsedRound', 1, 'test-campaign');
        });

        it('respects the thrust once-per-turn latch on a second strike in the same round', async () => {
            mockSuccessfulRuntimeValues({ telekineticThrustUsedRound: 1 });
            getCurrentCombatRound.mockReturnValue(1);

            await handle(makeAction(), playerWithThrust, 'test-campaign');

            expect(createSaveListener).not.toHaveBeenCalled();
        });

        it('re-arms the thrust chain on a later round', async () => {
            mockSuccessfulRuntimeValues({ telekineticThrustUsedRound: 1 });
            getCurrentCombatRound.mockReturnValue(2);

            await handle(makeAction(), playerWithThrust, 'test-campaign');

            expect(createSaveListener).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).toHaveBeenCalledWith('Test Fighter', 'telekineticThrustUsedRound', 2, 'test-campaign');
        });

        it('applies prone on a failed save and skips when already prone', async () => {
            mockSuccessfulRuntimeValues();
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Target Goblin', conditions: [] }] });
            createSaveListener.mockReturnValue({
                promptId: 'test-id',
                promise: Promise.resolve({ success: false, total: 10, roll: 6, saveBonus: 4 }),
            });

            const result = await handle(makeAction(), playerWithThrust, 'test-campaign');
            expect(result.payload.description).toContain('Prone + pushed 10ft');
            expect(addCondition).toHaveBeenCalled();

            addCondition.mockClear();
            getCombatContext.mockResolvedValue({ creatures: [{ name: 'Target Goblin', conditions: [{ key: 'prone' }] }] });
            await handle(makeAction(), playerWithThrust, 'test-campaign');
            expect(addCondition).not.toHaveBeenCalled();
        });
    });

    describe('target resolution', () => {
        it('returns error popup when no target available', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            mockSuccessfulRuntimeValues();

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('No target available');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns error popup when combat context is null', async () => {
            getCombatContext.mockResolvedValue(null);
            mockSuccessfulRuntimeValues();

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('No target available');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
        });
    });

    describe('result structure', () => {
        it('returns popup with correct payload shape', async () => {
            mockSuccessfulRuntimeValues();

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Psionic Strike');
            expect(result.payload.targetName).toBe('Target Goblin');
            expect(result.payload.automationType).toBe('psionic_strike');
            expect(result.payload.automation).toEqual(DEFAULT_ACTION.automation);
        });
    });
});
