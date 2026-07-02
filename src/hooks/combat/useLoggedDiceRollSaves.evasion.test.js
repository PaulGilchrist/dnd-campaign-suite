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
        it('handles own evasion - zero damage on save success', async () => {
            deps.pendingSaves['prompt-1'] = {
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
            deps.charactersRef.current = [{
                name: 'ElfRogue',
                computedStats: {
                    evasionEffects: [{ saveType: 'DEX', source: 'Evasion' }],
                },
            }];
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3 });
            computeDamageAfterEvasion.mockImplementation((raw, success, dcSuccess, evasion) => {
                if (evasion && dcSuccess === 'half') {
                    if (success) return 0;
                    return Math.floor(raw / 2);
                }
                if (!success) return raw;
                if (dcSuccess === 'half') return Math.floor(raw / 2);
                return 0;
            });
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
                null,
                false,
                'TestWizard'
            );
        });

        it('handles own evasion - half damage on save failure', async () => {
            deps.pendingSaves['prompt-1'] = {
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
            deps.charactersRef.current = [{
                name: 'ElfRogue',
                computedStats: {
                    evasionEffects: [{ saveType: 'DEX', source: 'Evasion' }],
                },
            }];
            rollSaveForCreature.mockReturnValue({ success: false, roll: 8, total: 11, bonus: 3 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'ElfRogue', type: 'player', ac: 15, currentHp: 20, maxHp: 20 }],
            });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'ElfRogue', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, false, 'half', true);
        });

        it('handles shared evasion from another character', async () => {
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

        it('skips evasion when target is incapacitated', async () => {
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
            deps.charactersRef.current = [{
                name: 'Goblin',
                computedStats: {
                    evasionEffects: [{ saveType: 'DEX', source: 'Evasion' }],
                },
            }];
            getRuntimeValue.mockReturnValueOnce([])
                .mockReturnValueOnce(['incapacitated'])
                .mockReturnValueOnce(null);
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, true, 'half', false);
        });

        it('does not apply shared evasion when shareRange is insufficient', async () => {
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
            deps.charactersRef.current = [
                { name: 'Goblin' },
                {
                    name: 'Paladin',
                    computedStats: {
                        evasionEffects: [{ saveType: 'DEX', source: 'Aura', shareable: true, shareRange: 3 }],
                    },
                },
            ];
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3 });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, true, 'half', false);
        });

        it('does not apply shared evasion when not shareable', async () => {
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
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
            });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, true, 'half', false);
        });
    });

    describe('quickRollPlayerSave - Shield & Intervene', () => {
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

        it('does not apply shield immunity for non-magic-missile spells', async () => {
            deps.pendingSaves['prompt-1'] = {
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
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Ally', type: 'player', ac: 16, currentHp: 20, maxHp: 20 }],
            });
            getRuntimeValue.mockReturnValueOnce(null).mockReturnValueOnce([{ effect: 'shield' }]);
            computeDamageAfterEvasion.mockReturnValue(7);
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Ally', 'DEX', 15);
            // Shield only blocks Magic Missile, not Fireball - damage should be from evasion calc
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(15, true, 'half', false);
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object),
                'Ally',
                7,
                ['fire'],
                'test-campaign',
                null,
                false,
                'TestWizard'
            );
        });

        it('handles intervene shield - sets damage to 0 on success', async () => {
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
                null,
                false,
                'TestWizard'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith('Ally', 'interveneShieldActive', null, 'test-campaign');
        });

        it('does not apply intervene shield on non-DEX saves', async () => {
            deps.pendingSaves['prompt-1'] = {
                targetName: 'Ally',
                rawDamage: 20,
                saveDc: 15,
                saveType: 'CON',
                dcSuccess: 'half',
                damageType: 'poison',
                attackerName: 'TestWizard',
                name: 'Cloudkill',
                formula: '4d8',
                rolls: [3, 4, 5, 8],
                modifier: 0,
                campaignName: 'test-campaign',
                setPopupHtml: vi.fn(),
            };
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Ally', type: 'player', ac: 16, currentHp: 20, maxHp: 20 }],
            });
            getRuntimeValue.mockReturnValueOnce(null)
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(true);
            rollSaveForCreature.mockReturnValue({ success: true, roll: 18, total: 21, bonus: 3 });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Ally', 'CON', 15);
            expect(setRuntimeValue).not.toHaveBeenCalledWith('Ally', 'interveneShieldActive', null, 'test-campaign');
        });

        it('applies intervene shield and consumes it on DEX save failure', async () => {
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
            rollSaveForCreature.mockReturnValue({ success: false, roll: 5, total: 8, bonus: 3 });
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Ally', 'DEX', 15);
            expect(setRuntimeValue).toHaveBeenCalledWith('Ally', 'interveneShieldActive', null, 'test-campaign');
        });
    });

    describe('quickRollPlayerSave - Target Effects Disadvantage Rider', () => {
        it('applies disadvantage from targetEffects rider effect', async () => {
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
        });

        it('removes the disadvantage_on_next_save effect after applying', async () => {
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
            getRuntimeValue.mockReturnValueOnce([
                { target: 'Other', effect: 'something_else' },
                { target: 'Goblin', effect: 'disadvantage_on_next_save' },
            ]);
            const { quickRollPlayerSave } = createFn();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'test-campaign',
                'targetEffects',
                [{ target: 'Other', effect: 'something_else' }],
                'test-campaign'
            );
        });

        it('does not apply targetEffects rider when effect does not match target', async () => {
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
            getRuntimeValue.mockReturnValueOnce([{ target: 'Other', effect: 'disadvantage_on_next_save' }]);
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

        it('targetEffects rider overrides metamagicHeighten false to true', async () => {
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
                metamagicHeighten: false,
            };
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
        });
    });
});
