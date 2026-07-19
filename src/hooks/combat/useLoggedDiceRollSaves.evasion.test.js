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
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    hasPotentCantrip: vi.fn(),
}));

import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { computeDamageAfterEvasion, rollSaveForCreature, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { hasPotentCantrip } from './loggedDiceRollUtils.js';
import { createSaves } from './useLoggedDiceRollSaves.js';

describe('createSaves (useLoggedDiceRollSaves) - Evasion & Shields', () => {
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

    describe('quickRollPlayerSave - Evasion', () => {
        const basePending = {
            targetName: 'ElfRogue',
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

        it('applies own evasion: zero damage on success, half on failure', async () => {
            deps.pendingSaves['prompt-1'] = { ...basePending };
            deps.charactersRef.current = [{
                name: 'ElfRogue',
                computedStats: {
                    evasionEffects: [{ saveType: 'DEX', source: 'Evasion' }],
                },
            }];
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3 });
            computeDamageAfterEvasion.mockReturnValue(0);
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'ElfRogue', type: 'player', ac: 15, currentHp: 20, maxHp: 20 }],
            });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'ElfRogue', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, true, 'half', true);
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                'ElfRogue',
                0,
                ['fire'],
                'test-campaign',
                expect.any(Array),
                false,
                'TestWizard'
            );

            deps.pendingSaves['prompt-2'] = { ...basePending };
            computeDamageAfterEvasion.mockReturnValue(10);
            rollSaveForCreature.mockReturnValue({ success: false, roll: 8, total: 11, bonus: 3 });
            await quickRollPlayerSave('prompt-2', 'ElfRogue', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, false, 'half', true);
        });

        it('handles shared evasion from another character', async () => {
            deps.pendingSaves['prompt-1'] = {
                ...basePending,
                targetName: 'Goblin',
            };
            deps.charactersRef.current = [
                { name: 'ElfRogue' },
                {
                    name: 'Paladin',
                    computedStats: {
                        evasionEffects: [{ saveType: 'DEX', source: 'Aura of Protection', shareable: true, shareRange: 10 }],
                    },
                },
            ];
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, true, 'half', true);
        });

        it('skips evasion when target is incapacitated or effect not shareable', async () => {
            deps.pendingSaves['prompt-1'] = {
                ...basePending,
                targetName: 'Goblin',
            };
            deps.charactersRef.current = [{
                name: 'Goblin',
                computedStats: {
                    evasionEffects: [{ saveType: 'DEX', source: 'Evasion' }],
                },
            }];
            getRuntimeValue.mockReturnValueOnce([])
                .mockReturnValueOnce([])
                .mockReturnValueOnce(['incapacitated'])
                .mockReturnValueOnce(null);
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, true, 'half', false);

            deps.pendingSaves['prompt-2'] = {
                ...basePending,
                targetName: 'Goblin',
            };
            deps.charactersRef.current = [
                { name: 'Goblin' },
                {
                    name: 'Paladin',
                    computedStats: {
                        evasionEffects: [{ saveType: 'DEX', source: 'Aura', shareable: false, shareRange: 10 }],
                    },
                },
            ];
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3 });
            await quickRollPlayerSave('prompt-2', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, true, 'half', false);
        });
    });

    describe('quickRollPlayerSave - Shield & Intervene', () => {
        it('handles shield immunity for magic missile only', async () => {
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

            deps.pendingSaves['prompt-2'] = {
                targetName: 'Ally',
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
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce([{ effect: 'shield' }]);
            computeDamageAfterEvasion.mockReturnValue(7);
            await quickRollPlayerSave('prompt-2', 'Ally', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(15, true, 'half', false);
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                'Ally',
                7,
                ['fire'],
                'test-campaign',
                expect.any(Array),
                false,
                'TestWizard'
            );
        });

        it('handles intervene shield - sets damage to 0 on success, consumes on any DEX half save', async () => {
            deps.pendingSaves['prompt-1'] = {
                targetName: 'Ally',
                rawDamage: 20,
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
                damageType: 'lightning',
                attackerName: 'TestWizard',
                name: 'Lightning Bolt',
                formula: '8d6',
                rolls: [3, 4, 5, 2, 3, 3],
                modifier: 0,
                campaignName: 'test-campaign',
                setPopupHtml: vi.fn(),
            };
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Ally', type: 'player', ac: 16, currentHp: 20, maxHp: 20 }],
            });
            getRuntimeValue.mockReturnValueOnce([])
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(true);
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3 });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Ally', 'DEX', 15);
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                'Ally',
                0,
                ['lightning'],
                'test-campaign',
                expect.any(Array),
                false,
                'TestWizard'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith('Ally', 'interveneShieldActive', null, 'test-campaign');

            deps.pendingSaves['prompt-2'] = {
                targetName: 'Ally',
                rawDamage: 20,
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
                damageType: 'lightning',
                attackerName: 'TestWizard',
                name: 'Lightning Bolt',
                formula: '8d6',
                rolls: [3, 4, 5, 2, 3, 3],
                modifier: 0,
                campaignName: 'test-campaign',
                setPopupHtml: vi.fn(),
            };
            rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3 });
            await quickRollPlayerSave('prompt-2', 'Ally', 'DEX', 15);
            expect(setRuntimeValue).toHaveBeenCalledWith('Ally', 'interveneShieldActive', null, 'test-campaign');
        });
    });

    describe('quickRollPlayerSave - Target Effects Disadvantage Rider', () => {
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

        it('applies disadvantage when rider matches target, skips when it does not', async () => {
            deps.pendingSaves['prompt-1'] = { ...basePending };
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            getRuntimeValue.mockReturnValueOnce([{ target: 'Goblin', effect: 'disadvantage_on_next_save' }]);
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.any(Object),
                'DEX',
                15,
                true,
                false
            );

            deps.pendingSaves['prompt-2'] = { ...basePending };
            getRuntimeValue.mockReturnValueOnce([{ target: 'Other', effect: 'disadvantage_on_next_save' }]);
            await quickRollPlayerSave('prompt-2', 'Goblin', 'DEX', 15);
            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.any(Object),
                'DEX',
                15,
                false,
                false
            );
        });
    });
});
