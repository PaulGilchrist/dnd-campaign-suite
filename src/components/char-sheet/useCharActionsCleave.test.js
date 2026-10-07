// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsCleave from './useCharActionsCleave.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';

function createDeps(overrides = {}) {
    const playerStats = {
        name: 'TestFighter',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Strength', bonus: 3 }],
        attacks: [{ name: 'Longsword', abilityName: 'Strength' }],
        ...overrides.playerStats,
    };
    return {
        campaignName: 'test-campaign',
        rollDamage: vi.fn(),
        getCombatContext: vi.fn(),
        getRuntimeValue: vi.fn(),
        setRuntimeValue: vi.fn(),
        addEntry: vi.fn().mockResolvedValue(undefined),
        setShowCleaveTargetSelection: vi.fn(),
        setTacticalMasterModal: vi.fn(),
        ...overrides,
        playerStats,
    };
}

describe('useCharActionsCleave', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = createDeps();
        deps.getRuntimeValue.mockReturnValue(null);
        deps.setRuntimeValue.mockResolvedValue(undefined);
        rollExpression.mockReturnValue({ total: 8, rolls: [5, 3] });
    });

    describe('handleCleaveAttack', () => {
        it('dismisses cleave modal and rolls weapon damage on hit without ability modifier', async () => {
            const lastAttack = {
                attackName: 'Longsword',
                damageFormula: '1d8+3',
                damageType: 'slashing',
                targetName: 'Goblin',
            };
            const testDeps = createDeps();
            testDeps.getRuntimeValue.mockReturnValueOnce(lastAttack);

            const { handleCleaveAttack } = useCharActionsCleave(testDeps);
            await handleCleaveAttack('Goblin');

            expect(testDeps.setShowCleaveTargetSelection).toHaveBeenCalledWith(false);
            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                { name: 'Longsword (Cleave)', formula: '1d8', total: 8, rolls: [5, 3], modifier: 0, context: {
                    targetName: 'Goblin',
                    damageType: 'slashing',
                    attackerName: 'TestFighter',
                } }
            );
            expect(testDeps.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Cleave',
                description: 'TestFighter used Cleave on Longsword against Goblin',
                targetName: 'Goblin',
            });
        });

        it('dismisses cleave modal early when cleaveTargetName is falsy', async () => {
            const { handleCleaveAttack } = useCharActionsCleave(deps);
            await handleCleaveAttack(null);
            expect(deps.setShowCleaveTargetSelection).toHaveBeenCalledWith(false);
            expect(deps.rollDamage).not.toHaveBeenCalled();
            expect(deps.addEntry).not.toHaveBeenCalled();
        });

        it('dismisses cleave modal early when lastAttack is missing', async () => {
            const testDeps = createDeps();
            testDeps.getRuntimeValue.mockReturnValueOnce(null);
            const { handleCleaveAttack } = useCharActionsCleave(testDeps);
            await handleCleaveAttack('Goblin');
            expect(testDeps.setShowCleaveTargetSelection).toHaveBeenCalledWith(false);
            expect(testDeps.rollDamage).not.toHaveBeenCalled();
            expect(testDeps.addEntry).not.toHaveBeenCalled();
        });

        it('rolls damage with 0 and sets isAutoMiss when hit but rollExpression returns null', async () => {
            const lastAttack = {
                attackName: 'Longsword',
                damageFormula: '1d8+3',
                damageType: 'slashing',
                targetName: 'Goblin',
            };
            const testDeps = createDeps();
            testDeps.getRuntimeValue.mockReturnValueOnce(lastAttack);
            rollExpression.mockReturnValue(null);

            const { handleCleaveAttack } = useCharActionsCleave(testDeps);
            await handleCleaveAttack('Goblin');

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                { name: 'Longsword (Cleave)', formula: '1d8', total: 0, rolls: [], modifier: 0, context: {
                    attackerName: 'TestFighter',
                    damageType: 'slashing',
                    isAutoMiss: true,
                    targetName: 'Goblin',
                } }
            );
        });

        it('treats attack as miss when d20 + attack bonus is below target AC', async () => {
            const lastAttack = {
                attackName: 'Longsword',
                damageFormula: '1d8+3',
                damageType: 'slashing',
                targetName: 'Ogre',
            };
            const testDeps = createDeps();
            testDeps.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Ogre', ac: 30 }] });
            testDeps.getRuntimeValue.mockReturnValueOnce(lastAttack);

            const { handleCleaveAttack } = useCharActionsCleave(testDeps);
            await handleCleaveAttack('Ogre');

            expect(testDeps.rollDamage).toHaveBeenCalledWith(
                { name: 'Longsword (Cleave)', formula: '1d8', total: 0, rolls: [], modifier: 0, context: {
                    attackerName: 'TestFighter',
                    damageType: 'slashing',
                    isAutoMiss: true,
                    targetName: 'Ogre',
                } }
            );
            expect(testDeps.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Cleave',
                description: 'TestFighter used Cleave on Longsword against Ogre — Miss',
                targetName: 'Ogre',
            });
        });

    });

    describe('handleTacticalMasterConfirm', () => {
        it('dismisses modal and returns when chosenMastery is falsy', async () => {
            deps.getRuntimeValue.mockReturnValue(null);
            const { handleTacticalMasterConfirm } = useCharActionsCleave(deps);
            await handleTacticalMasterConfirm(null);
            expect(deps.setTacticalMasterModal).toHaveBeenCalledWith(null);
            expect(deps.addEntry).not.toHaveBeenCalled();
        });

        it('logs ability_use entry when targetName exists in pending data', async () => {
            const testDeps = createDeps();
            const pending = { baseMastery: 'Piercing', attackName: 'Longsword', targetName: 'Goblin' };
            testDeps.getRuntimeValue.mockReturnValue(pending);
            const applyMasteryEffect = vi.fn();
            const { handleTacticalMasterConfirm } = useCharActionsCleave({
                ...testDeps,
                applyMasteryEffect,
            });
            await handleTacticalMasterConfirm('Vex');

            expect(testDeps.setTacticalMasterModal).toHaveBeenCalledWith(null);
            expect(testDeps.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Tactical Master',
                description: 'TestFighter used Tactical Master on Longsword against Goblin — changed mastery from Piercing to Vex',
                targetName: 'Goblin',
            });
        });

        it('logs the granting feature and additive wording for choice-mode (Battering Roots)', async () => {
            const testDeps = createDeps();
            const pending = {
                baseMastery: 'Sap',
                attackName: 'Longsword',
                targetName: 'Goblin',
                isChoiceMode: true,
                featureName: 'Battering Roots',
            };
            const lastAttack = { targetName: 'Goblin' };
            testDeps.getRuntimeValue
                .mockReturnValueOnce(pending)
                .mockReturnValueOnce(lastAttack);
            const applyMasteryEffect = vi.fn();
            const { handleTacticalMasterConfirm } = useCharActionsCleave({
                ...testDeps,
                applyMasteryEffect,
            });
            await handleTacticalMasterConfirm('Push');

            expect(testDeps.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Battering Roots',
                description: 'TestFighter used Battering Roots on Longsword against Goblin — applied Push mastery in addition to Sap',
                targetName: 'Goblin',
            });
            expect(applyMasteryEffect).toHaveBeenCalledWith('Push', testDeps.playerStats, 'test-campaign', 'Goblin');
        });

        it('returns early without applying mastery when lastAttack has no targetName', async () => {
            const testDeps = createDeps();
            const pending = { baseMastery: 'Piercing', attackName: 'Longsword', targetName: 'Goblin' };
            testDeps.getRuntimeValue
                .mockReturnValueOnce(pending)
                .mockReturnValueOnce({ targetName: null });
            const applyMasteryEffect = vi.fn();
            const { handleTacticalMasterConfirm } = useCharActionsCleave({
                ...testDeps,
                applyMasteryEffect,
            });
            await handleTacticalMasterConfirm('Vex');

            expect(testDeps.addEntry).toHaveBeenCalledTimes(1);
            expect(applyMasteryEffect).not.toHaveBeenCalled();
        });

        // WM-003 F3: the mastery result must reach TacticalMasterModal so a
        // once-per-turn refusal is surfaced instead of being mislabeled success.
        it('WM-003: returns the refusal popup payload from applyMasteryEffect', async () => {
            const testDeps = createDeps();
            const pending = { baseMastery: 'Nick', attackName: 'Scimitar', targetName: 'Bandit 1' };
            const lastAttack = { targetName: 'Bandit 1' };
            testDeps.getRuntimeValue
                .mockReturnValueOnce(pending)
                .mockReturnValueOnce(lastAttack);
            const refusal = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Nick', refused: true, description: 'TestFighter can use Nick only once per turn.' },
            };
            const applyMasteryEffect = vi.fn().mockResolvedValue(refusal);
            const { handleTacticalMasterConfirm } = useCharActionsCleave({
                ...testDeps,
                applyMasteryEffect,
            });
            const result = await handleTacticalMasterConfirm('Nick');

            expect(applyMasteryEffect).toHaveBeenCalledWith('Nick', testDeps.playerStats, 'test-campaign', 'Bandit 1');
            expect(result).toBe(refusal);
        });

        it('WM-003: returns the mastery_rider success popup on a successful apply', async () => {
            const testDeps = createDeps();
            const pending = { baseMastery: 'Nick', attackName: 'Scimitar', targetName: 'Bandit 1' };
            const lastAttack = { targetName: 'Bandit 1' };
            testDeps.getRuntimeValue
                .mockReturnValueOnce(pending)
                .mockReturnValueOnce(lastAttack);
            const success = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Nick', description: 'Nick applied.', automation: { type: 'mastery_rider', masteries: ['Nick'] } },
            };
            const applyMasteryEffect = vi.fn().mockResolvedValue(success);
            const { handleTacticalMasterConfirm } = useCharActionsCleave({
                ...testDeps,
                applyMasteryEffect,
            });
            const result = await handleTacticalMasterConfirm('Nick');

            expect(result).toBe(success);
        });

        it('applies Topple mastery with CON save and prone condition on failed save', async () => {
            const pending = { baseMastery: 'Piercing', attackName: 'Greataxe', targetName: 'Orc' };
            const lastAttack = { targetName: 'Orc' };
            deps.getRuntimeValue
                .mockReturnValueOnce(pending)
                .mockReturnValueOnce(lastAttack)
                .mockReturnValueOnce([]);

            const saveListenerMock = {
                promise: Promise.resolve({ success: false, roll: 5, saveBonus: 2, total: 7 }),
            };
            const createSaveListener = vi.fn(() => saveListenerMock);

            const { handleTacticalMasterConfirm } = useCharActionsCleave({
                ...deps,
                createSaveListener,
            });
            await handleTacticalMasterConfirm('Topple');

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Orc',
                saveType: 'CON',
                saveDc: 14,
            });

            expect(deps.setRuntimeValue).toHaveBeenCalledWith(
                'Orc',
                'activeConditions',
                ['prone'],
                'test-campaign'
            );
        });

        it('does not add prone condition if target already has it', async () => {
            const pending = { baseMastery: 'Piercing', attackName: 'Greataxe', targetName: 'Orc' };
            const lastAttack = { targetName: 'Orc' };
            deps.getRuntimeValue
                .mockReturnValueOnce(pending)
                .mockReturnValueOnce(lastAttack)
                .mockReturnValueOnce(['prone']);

            const saveListenerMock = {
                promise: Promise.resolve({ success: false, roll: 5, saveBonus: 2, total: 7 }),
            };
            const createSaveListener = vi.fn(() => saveListenerMock);

            const { handleTacticalMasterConfirm } = useCharActionsCleave({
                ...deps,
                createSaveListener,
            });
            await handleTacticalMasterConfirm('Topple');

            expect(deps.setRuntimeValue).not.toHaveBeenCalledWith(
                'Orc',
                'activeConditions',
                expect.arrayContaining(['prone']),
                'test-campaign'
            );
        });

        it('does not apply prone condition when save result indicates success', async () => {
            const pending = { baseMastery: 'Piercing', attackName: 'Greataxe', targetName: 'Orc' };
            const lastAttack = { targetName: 'Orc' };
            deps.getRuntimeValue
                .mockReturnValueOnce(pending)
                .mockReturnValueOnce(lastAttack)
                .mockReturnValueOnce([]);

            const saveListenerMock = {
                promise: Promise.resolve({ success: true, roll: 15, saveBonus: 2, total: 17 }),
            };
            const createSaveListener = vi.fn(() => saveListenerMock);

            const { handleTacticalMasterConfirm } = useCharActionsCleave({
                ...deps,
                createSaveListener,
            });
            await handleTacticalMasterConfirm('Topple');

            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
            expect(deps.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Tactical Master',
                description: expect.stringContaining('Tactical Master'),
                targetName: 'Orc',
            });
        });

        it('calls applyMasteryEffect for non-Topple mastery choices', async () => {
            const testDeps = createDeps();
            const pending = { baseMastery: 'Piercing', attackName: 'Longsword', targetName: 'Goblin' };
            const lastAttack = { targetName: 'Goblin' };
            testDeps.getRuntimeValue
                .mockReturnValueOnce(pending)
                .mockReturnValueOnce(lastAttack);

            const applyMasteryEffect = vi.fn();

            const { handleTacticalMasterConfirm } = useCharActionsCleave({
                ...testDeps,
                applyMasteryEffect,
            });
            await handleTacticalMasterConfirm('Vex');

            expect(applyMasteryEffect).toHaveBeenCalledWith(
                'Vex',
                testDeps.playerStats,
                'test-campaign',
                'Goblin'
            );
        });

        it('defaults to Strength ability when weapon attack not found for Topple', async () => {
            const pending = { baseMastery: 'Piercing', attackName: 'NonexistentWeapon', targetName: 'Orc' };
            const lastAttack = { targetName: 'Orc' };
            deps.getRuntimeValue
                .mockReturnValueOnce(pending)
                .mockReturnValueOnce(lastAttack)
                .mockReturnValueOnce([]);

            const saveListenerMock = {
                promise: Promise.resolve({ success: false, roll: 5, saveBonus: 2, total: 7 }),
            };
            const createSaveListener = vi.fn(() => saveListenerMock);

            const { handleTacticalMasterConfirm } = useCharActionsCleave({
                ...deps,
                createSaveListener,
                playerStats: {
                    attacks: [],
                    abilities: [{ name: 'Strength', bonus: 3 }],
                    proficiency: 3,
                },
            });
            await handleTacticalMasterConfirm('Topple');

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Orc',
                saveType: 'CON',
                saveDc: 14,
            });
        });

        it('skips prone condition when save result is null', async () => {
            const pending = { baseMastery: 'Piercing', attackName: 'Greataxe', targetName: 'Orc' };
            const lastAttack = { targetName: 'Orc' };
            deps.getRuntimeValue
                .mockReturnValueOnce(pending)
                .mockReturnValueOnce(lastAttack)
                .mockReturnValueOnce([]);

            const saveListenerMock = {
                promise: Promise.resolve(null),
            };
            const createSaveListener = vi.fn(() => saveListenerMock);

            const { handleTacticalMasterConfirm } = useCharActionsCleave({
                ...deps,
                createSaveListener,
            });
            await handleTacticalMasterConfirm('Topple');

            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('handleTacticalMasterDismiss', () => {
        it('closes the tactical master modal', async () => {
            const { handleTacticalMasterDismiss } = useCharActionsCleave(deps);
            handleTacticalMasterDismiss();
            expect(deps.setTacticalMasterModal).toHaveBeenCalledWith(null);
        });
    });

    describe('returned functions', () => {
        it('returns handleCleaveAttack, handleTacticalMasterConfirm, and handleTacticalMasterDismiss', () => {
            const { handleCleaveAttack, handleTacticalMasterConfirm, handleTacticalMasterDismiss } = useCharActionsCleave(deps);
            expect(typeof handleCleaveAttack).toBe('function');
            expect(typeof handleTacticalMasterConfirm).toBe('function');
            expect(typeof handleTacticalMasterDismiss).toBe('function');
        });
    });
});
