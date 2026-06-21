// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatContext: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasion) => {
        if (evasion && !success) return Math.floor(raw / 2);
        return success ? Math.floor(raw / 2) : raw;
    }),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
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

vi.mock('./useMetamagic.js', () => ({
    saveLastDamageEvent: vi.fn(),
}));

vi.mock('../../services/combat/baseCombatActions.js', () => ({
    MELEE_REACH_FEET: 5,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
}));

vi.mock('./useLoggedDiceRollUtils.js', () => ({
    hasPotentCantrip: vi.fn(),
}));

import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { computeDamageAfterEvasion, rollSaveForCreature, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { hasPotentCantrip } from './useLoggedDiceRollUtils.js';
import { createSaves } from './useLoggedDiceRollSaves.js';

describe('createSaves (useLoggedDiceRollSaves)', () => {
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

        it('handles metamagicHeighten as disadvantage', async () => {
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
                metamagicHeighten: true,
            };
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.any(Object),
                'DEX',
                15,
                true,
                false
            );
        });

        it('handles shield immunity for magic missile', async () => {
            deps.pendingSaves['prompt-1'] = {
                targetName: 'Ally',
                rawDamage: 15,
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
                damageType: 'force',
                attackerName: 'TestWizard',
                name: 'Magic Missile',
                formula: '4d4+2',
                rolls: [3, 2, 3, 2],
                modifier: 2,
                campaignName: 'test-campaign',
                setPopupHtml: vi.fn(),
            };
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Ally', type: 'player', ac: 16, currentHp: 20, maxHp: 20 }],
            });
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce([{ effect: 'shield' }]);
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Ally', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(15, true, 'half', false);
        });

        it('handles potent cantrip half damage on success', async () => {
            deps.pendingSaves['prompt-1'] = {
                targetName: 'Goblin',
                rawDamage: 16,
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'none',
                damageType: 'fire',
                attackerName: 'TestWizard',
                name: 'Fire Bolt',
                formula: '1d10',
                rolls: [6, 4],
                modifier: 0,
                campaignName: 'test-campaign',
                setPopupHtml: vi.fn(),
                context: { playerStats: {} },
                isCantrip: true,
            };
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            hasPotentCantrip.mockReturnValue(true);
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3 });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                'Goblin',
                8,
                ['fire'],
                'test-campaign',
                null,
                false,
                'TestWizard'
            );
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
    });
});
