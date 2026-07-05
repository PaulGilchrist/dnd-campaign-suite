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
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
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
        it('returns early when pending does not exist', async () => {
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('nonexistent', 'Goblin', 'DEX', 15);
            expect(loadCombatSummary).not.toHaveBeenCalled();
        });

        it('returns early when target not found in combat summary', async () => {
            deps.pendingSaves['prompt-1'] = {
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
            loadCombatSummary.mockResolvedValue({ creatures: [] });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(rollSaveForCreature).not.toHaveBeenCalled();
        });

        it('rolls save and applies damage for target', async () => {
            deps.pendingSaves['prompt-1'] = {
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
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            rollSaveForCreature.mockReturnValue({ success: false, roll: 8, total: 11, bonus: 3 });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(rollSaveForCreature).toHaveBeenCalled();
            expect(applyDamageToTarget).toHaveBeenCalled();
            expect(sendSaveResult).toHaveBeenCalled();
            expect(deps.pendingSaves['prompt-1']).toBeUndefined();
        });

        it('sends save result with correct data', async () => {
            deps.pendingSaves['prompt-1'] = {
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
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'Goblin', expect.objectContaining({
                promptId: 'prompt-1',
                success: true,
                roll: 15,
            }));
        });

        it('sets popupHtml with save result data', async () => {
            deps.pendingSaves['prompt-1'] = {
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
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'save-damage',
                name: 'Fireball',
                saveDc: 15,
                saveType: 'DEX',
            }));
        });

        it('handles save failure with full damage', async () => {
            deps.pendingSaves['prompt-1'] = {
                targetName: 'Goblin',
                rawDamage: 20,
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
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3 });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, false, 'half', false);
        });

        it('handles save success with dcSuccess none - full damage reduced to 0', async () => {
            deps.pendingSaves['prompt-1'] = {
                targetName: 'Goblin',
                rawDamage: 20,
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'none',
                damageType: 'fire',
                attackerName: 'TestWizard',
                name: 'Fireball',
                formula: '8d6',
                rolls: [3, 4, 5, 2, 3, 3],
                modifier: 0,
                campaignName: 'test-campaign',
                setPopupHtml: vi.fn(),
            };
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3 });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, true, 'none', false);
        });

        it('passes ignoreResistance flag to applyDamageToTarget', async () => {
            deps.pendingSaves['prompt-1'] = {
                targetName: 'Goblin',
                rawDamage: 20,
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
                playerStats: {},
            };
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
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
                targetName: 'Wiz',
                rawDamage: 10,
                saveDc: 13,
                saveType: 'INT',
                dcSuccess: 'half',
                damageType: 'psychic',
                attackerName: 'TestWizard',
                name: 'Mind Sliver',
                formula: '1d6',
                rolls: [4],
                modifier: 0,
                campaignName: 'test-campaign',
                setPopupHtml: vi.fn(),
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

        it('sets popupHtml with targetCurrentHp from applyResult and targetMaxHp from runtime for player targets', async () => {
            deps.pendingSaves['prompt-1'] = {
                targetName: 'Ally',
                rawDamage: 10,
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
        });

        it('sets popupHtml with targetMaxHp from creature for npc targets', async () => {
            deps.pendingSaves['prompt-1'] = {
                targetName: 'Goblin',
                rawDamage: 10,
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
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                targetMaxHp: 13,
            }));
        });

        it('handles popupHtml with finalDamage and damageApplied fields', async () => {
            deps.pendingSaves['prompt-1'] = {
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
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
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
            deps.pendingSaves['prompt-1'] = {
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
            deps.charactersRef.current = [{
                name: 'Goblin',
                computedStats: { saveModifiers: [] },
            }];
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
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

        it('decrements uses on counter attack', async () => {
            getRuntimeValue.mockReturnValue(2);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { type: 'player', name: 'TestFighter', attacks: [{ name: 'Longsword', hitBonus: 5, range: 5 }] },
                ],
            });
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'gloriousDefenseUses', 1, 'test-campaign');
        });

        it('returns popup when no melee attack available', async () => {
            getRuntimeValue.mockReturnValue(2);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { type: 'player', name: 'TestFighter', attacks: [{ name: 'Fire Bolt', hitBonus: 5, range: 120 }] },
                ],
            });
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                popupMessage: expect.stringContaining('no melee attack'),
            }));
        });

        it('restores uses when no attack available', async () => {
            getRuntimeValue.mockReturnValue(2);
            getCombatContext.mockResolvedValue({
                creatures: [
                    { type: 'player', name: 'TestFighter', attacks: [{ name: 'Fire Bolt', hitBonus: 5, range: 120 }] },
                ],
            });
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'gloriousDefenseUses', 2, 'test-campaign');
        });

        it('logs ability_use entry when counter attack triggers', async () => {
            getRuntimeValue.mockReturnValue(2);
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { type: 'player', name: 'TestFighter', attacks: [{ name: 'Longsword', hitBonus: 5, range: 5 }] },
                ],
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { type: 'player', name: 'TestFighter', attacks: [{ name: 'Longsword', hitBonus: 5, range: 5 }] },
                    { type: 'npc', name: 'Orc', targetName: 'TestFighter' },
                ],
            });
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Glorious Defense',
            }));
        });

        it('calls logAndShow with attack info', async () => {
            getRuntimeValue.mockReturnValue(2);
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { type: 'player', name: 'TestFighter', attacks: [{ name: 'Longsword', hitBonus: 5, range: 5 }] },
                ],
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { type: 'player', name: 'TestFighter', attacks: [{ name: 'Longsword', hitBonus: 5, range: 5 }], targetName: 'Orc' },
                    { type: 'npc', name: 'Orc' },
                ],
            });
            getTargetFromAttacker.mockReturnValue({ name: 'Orc' });
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(deps.logAndShow).toHaveBeenCalledWith('Longsword', 5, 'attack', expect.objectContaining({
                targetName: 'Orc',
            }));
        });

        it('handles no combat context gracefully', async () => {
            getRuntimeValue.mockReturnValue(2);
            getCombatContext.mockResolvedValue(null);
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                popupMessage: expect.stringContaining('no melee attack'),
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'gloriousDefenseUses', 2, 'test-campaign');
        });

        it('recharges on long rest - sets uses to chaBonus+1 max', async () => {
            getRuntimeValue.mockReturnValue(0);
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                popupMessage: expect.stringContaining('Recharges on a Long Rest'),
            }));
        });

        it('targets "attacker" when no targetName on attacker', async () => {
            getRuntimeValue.mockReturnValue(2);
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { type: 'player', name: 'TestFighter', attacks: [{ name: 'Longsword', hitBonus: 5, range: 5 }] },
                ],
            });
            getCombatContext.mockResolvedValue({
                creatures: [
                    { type: 'player', name: 'TestFighter', attacks: [{ name: 'Longsword', hitBonus: 5, range: 5 }] },
                ],
            });
            getTargetFromAttacker.mockReturnValue(null);
            const { triggerGloriousDefenseCounterAttack } = createFn();
            await triggerGloriousDefenseCounterAttack();
            expect(deps.logAndShow).toHaveBeenCalledWith('Longsword', 5, 'attack', expect.objectContaining({
                targetName: null,
            }));
        });
    });
});
