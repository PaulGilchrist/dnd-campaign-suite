// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatContext: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasion) => {
        if (evasion && dcSuccess === 'half') {
            if (success) return 0;
            return Math.floor(raw / 2);
        }
        if (!success) return raw;
        if (dcSuccess === 'half') return Math.floor(raw / 2);
        return 0;
    }),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (saveType) => {
        if (!saveType) return '';
        const map = { 'STRENGTH': 'STR', 'DEXTERITY': 'DEX', 'CONSTITUTION': 'CON', 'INTELLIGENCE': 'INT', 'WISDOM': 'WIS', 'CHARISMA': 'CHA' };
        return map[saveType.toUpperCase()] || saveType.toUpperCase();
    },
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSaveResult: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    getCombatContext: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/combat/baseCombatActions.js', () => ({
    MELEE_REACH_FEET: 5,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    hasPotentCantrip: vi.fn(),
}));

import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { computeDamageAfterEvasion, rollSaveForCreature, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { hasPotentCantrip } from './loggedDiceRollUtils.js';
import { createSaves } from './useLoggedDiceRollSaves.js';

describe('createSaves (useLoggedDiceRollSaves) - Core', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        logAndShow: vi.fn(),
        pendingSaves: {},
        charactersRef: { current: [] },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        deps.charactersRef.current = [];
        deps.pendingSaves = {};
        deps.logEntry.mockResolvedValue({ id: 'log-1' });
        getCombatContext.mockResolvedValue(null);
        loadCombatSummary.mockResolvedValue(null);
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        rollSaveForCreature.mockReturnValue({ success: true, roll: 15, total: 18, bonus: 3 });
        computeDamageAfterEvasion.mockReturnValue(10);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 5, damageReduced: false });
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
    });

    function createFn() {
        return createSaves(deps);
    }

    describe('quickRollPlayerSave', () => {
        const basePending = {
            targetName: 'Goblin',
            rawDamage: 15,
            saveDc: 15,
            saveType: 'DEX',
            dcSuccess: 'half',
            damageType: 'fire',
            attackerName: 'TestWizard',
            name: 'Fireball',
            formula: '8d6',
            rolls: [3, 4, 5, 2, 3, 3],
            modifier: 0,
            campaignName: 'test-campaign',
            setPopupHtml: vi.fn(),
        };

        function setupCreature(type, hp) {
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type, ac: 12, currentHp: hp, maxHp: hp }],
            });
        }

        it('returns early when pending does not exist or target not found', async () => {
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('nonexistent', 'Goblin', 'DEX', 15);
            expect(loadCombatSummary).not.toHaveBeenCalled();

            deps.pendingSaves['prompt-1'] = { ...basePending };
            loadCombatSummary.mockResolvedValue({ creatures: [] });
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(rollSaveForCreature).not.toHaveBeenCalled();
        });

        it('rolls save, applies damage, sends result, and removes pending', async () => {
            deps.pendingSaves['prompt-1'] = { ...basePending };
            setupCreature('npc', 13);
            rollSaveForCreature.mockReturnValue({ success: false, roll: 8, total: 11, bonus: 3 });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(rollSaveForCreature).toHaveBeenCalled();
            expect(applyDamageToTarget).toHaveBeenCalled();
            expect(sendSaveResult).toHaveBeenCalled();
            expect(deps.pendingSaves['prompt-1']).toBeUndefined();
        });

        it('sends save result with correct data and sets popupHtml with save-damage type', async () => {
            deps.pendingSaves['prompt-1'] = { ...basePending };
            setupCreature('npc', 13);
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'Goblin', expect.objectContaining({
                promptId: 'prompt-1',
                success: true,
                roll: 15,
            }));
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'save-damage',
                name: 'Fireball',
                saveDc: 15,
                saveType: 'DEX',
            }));
        });

        it('handles save failure with full damage, success with dcSuccess none reduces to 0', async () => {
            deps.pendingSaves['prompt-1'] = { ...basePending, rawDamage: 20 };
            setupCreature('npc', 13);
            rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3 });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, false, 'half', false);

            deps.pendingSaves['prompt-2'] = { ...basePending, rawDamage: 20, dcSuccess: 'none' };
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3 });
            await quickRollPlayerSave('prompt-2', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, true, 'none', false);
        });

        it('passes ignoreResistance flag to applyDamageToTarget', async () => {
            deps.pendingSaves['prompt-1'] = { ...basePending, playerStats: {} };
            setupCreature('npc', 13);
            hasIgnoreResistance.mockReturnValue(true);
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(hasIgnoreResistance).toHaveBeenCalledWith({}, 'fire');
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                'Goblin',
                expect.any(Number),
                ['fire'],
                'test-campaign',
                null,
                true,
                'TestWizard'
            );
        });

        it('uses target saveModifiers from charactersRef when available', async () => {
            deps.pendingSaves['prompt-1'] = {
                ...basePending,
                targetName: 'Wiz',
                rawDamage: 10,
                saveDc: 13,
                saveType: 'INT',
                damageType: 'psychic',
                attackerName: 'TestWizard',
                name: 'Mind Sliver',
                formula: '1d6',
                rolls: [4],
            };
            deps.charactersRef.current = [{
                name: 'Wiz',
                saveModifiers: [
                    { target: 'saving_throw', effect: 'advantage', condition: 'against_spell' },
                ],
                computedStats: { saveModifiers: [] },
            }];
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Wiz', type: 'player', ac: 13, currentHp: 15, maxHp: 15 }],
            });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Wiz', 'INT', 13);
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.any(Object),
                'INT',
                13,
                false,
                true
            );
        });

        it('sets popupHtml with correct HP values for player vs npc targets', async () => {
            deps.pendingSaves['prompt-1'] = {
                ...basePending,
                targetName: 'Ally',
                rawDamage: 10,
            };
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Ally', type: 'player', ac: 16, currentHp: 20, maxHp: 20 }],
            });
            applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 15, damageReduced: true });
            getRuntimeValue.mockReturnValueOnce([])
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(20);
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Ally', 'DEX', 15);
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                targetCurrentHp: 15,
                targetMaxHp: 20,
            }));

            deps.pendingSaves['prompt-2'] = { ...basePending, targetName: 'Goblin', rawDamage: 10 };
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            await quickRollPlayerSave('prompt-2', 'Goblin', 'DEX', 15);
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                targetMaxHp: 13,
            }));
        });

        it('handles popupHtml with finalDamage and damageApplied fields', async () => {
            deps.pendingSaves['prompt-1'] = { ...basePending };
            setupCreature('npc', 13);
            applyDamageToTarget.mockReturnValue({ finalDamage: 7, newHp: 6, damageReduced: true });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                finalDamage: 7,
                damageApplied: true,
                damageReduced: true,
            }));
        });

        it('handles save with no advantage or disadvantage by default', async () => {
            deps.pendingSaves['prompt-1'] = { ...basePending };
            deps.charactersRef.current = [{
                name: 'Goblin',
                computedStats: { saveModifiers: [] },
            }];
            setupCreature('npc', 13);
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.any(Object),
                'DEX',
                15,
                false,
                false
            );
        });
    });

    describe('triggerGloriousDefenseCounterAttack', () => {
        it('returns early when no uses remaining', async () => {
            getRuntimeValue.mockReturnValue(0);
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                popupMessage: expect.stringContaining('no uses remaining'),
            }));
        });

        it('returns popup when no attack event exists', async () => {
            getRuntimeValue.mockReturnValue(2);
            getCombatContext.mockResolvedValue({
                lastAttack: null,
            });
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                popupMessage: expect.stringContaining('The last attack did not target you'),
            }));
        });

        it('returns popup when attack did not target this player', async () => {
            getRuntimeValue.mockReturnValue(2);
            getCombatContext.mockResolvedValue({
                lastAttack: {
                    targetName: 'SomeOtherCharacter',
                    d20: 12,
                    bonus: 7,
                    targetAc: 16,
                    hit: true,
                },
            });
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                popupMessage: expect.stringContaining('did not target you'),
            }));
        });

        it('returns popup when attack still hits with CHA bonus', async () => {
            getRuntimeValue.mockReturnValue(2);
            getCombatContext.mockResolvedValue({
                lastAttack: {
                    targetName: 'TestFighter',
                    d20: 15,
                    bonus: 7,
                    targetAc: 16,
                    hit: true,
                    attackerName: 'Goblin',
                },
            });
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { type: 'player', name: 'TestFighter', attacks: [{ name: 'Longsword', hitBonus: 5, range: 5 }] },
                ],
            });
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                popupMessage: expect.stringContaining('not enough to change the outcome'),
            }));
        });

        it('calls logAndShow when attack becomes miss', async () => {
            getRuntimeValue.mockReturnValue(2);
            getCombatContext.mockResolvedValue({
                lastAttack: {
                    targetName: 'TestFighter',
                    d20: 9,
                    bonus: 7,
                    targetAc: 16,
                    hit: true,
                    attackerName: 'Goblin',
                },
            });
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { type: 'player', name: 'TestFighter', attacks: [{ name: 'Longsword', hitBonus: 5, range: 5 }] },
                ],
            });
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'gloriousDefenseUses', 1, 'test-campaign');
            expect(deps.logAndShow).toHaveBeenCalledWith('Longsword', 5, 'attack', expect.objectContaining({
                targetName: 'Goblin',
            }));
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Glorious Defense',
                targetName: 'Goblin',
            }));
        });

        it('handles no combat context gracefully', async () => {
            getRuntimeValue.mockReturnValue(2);
            getCombatContext.mockResolvedValue({
                lastAttack: null,
            });
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                popupMessage: expect.stringContaining('did not target you'),
            }));
        });

        it('targets attacker from lastAttack instead of current target', async () => {
            getRuntimeValue.mockReturnValue(2);
            getCombatContext.mockResolvedValue({
                lastAttack: {
                    targetName: 'TestFighter',
                    d20: 9,
                    bonus: 7,
                    targetAc: 16,
                    hit: true,
                    attackerName: 'Red Dragon',
                },
            });
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { type: 'player', name: 'TestFighter', attacks: [{ name: 'Longsword', hitBonus: 5, range: 5 }] },
                ],
            });
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(deps.logAndShow).toHaveBeenCalledWith('Longsword', 5, 'attack', expect.objectContaining({
                targetName: 'Red Dragon',
            }));
        });
    });
});
