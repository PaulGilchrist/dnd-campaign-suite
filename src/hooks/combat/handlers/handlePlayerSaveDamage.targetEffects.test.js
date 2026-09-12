// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    hasPotentCantrip: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(),
}));

vi.mock('../../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/deathWardHandler.js', () => ({
    isDeathWardActive: vi.fn(),
}));

vi.mock('../../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
    getHolyAuraTargets: vi.fn(),
}));

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? 0 : total),
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess, evasion) => {
        if (evasion && dcSuccess === 'half') return success ? 0 : Math.floor(total / 2);
        return success ? 0 : total;
    }),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../../services/combat/conditions/conditionEffects.js', () => ({
    computeConditionEffects: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/combat/auras/pendingSaveRegistry.js', () => ({
    registerPendingSavePrompt: vi.fn(),
}));

vi.mock('../../../services/combat/auras/pendingPopupRegistry.js', () => ({
    registerPendingPopupSetter: vi.fn(),
}));

vi.mock('../../useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { createPlayerSaveDamageHandler } from './handlePlayerSaveDamage.js';
import { computeConditionEffects } from '../../../services/combat/conditions/conditionEffects.js';
import { getHolyAuraTargets } from '../../../services/automation/handlers/buffs/holyAuraHandler.js';
import { getCoronaSaveDisadvantage } from '../../../services/combat/auras/coronaAuraUtils.js';
import { getElderChampionSaveDisadvantage } from '../../../services/combat/auras/elderChampionAuraUtils.js';
import { isCircleOfPowerActive } from '../../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { isDeathWardActive } from '../../../services/automation/handlers/buffs/deathWardHandler.js';

const BASE_CONTEXT = {
    saveDc: 15,
    saveType: 'CON',
    dcSuccess: 'half',
    damageType: 'Poison',
    targetName: 'TestWizard',
};

const BASE_COMBAT_SUMMARY = {
    creatures: [{ name: 'TestWizard', type: 'player' }],
};

function makeDeps(overrides = {}) {
    return {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'TestWizard' }],
        charactersRef: { current: [] },
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
        ...overrides,
    };
}

function invokeHandler(handler, context = BASE_CONTEXT, combatSummary = BASE_COMBAT_SUMMARY, gwfBaseRolls, gwfDisplayRolls) {
    return handler({
        name: 'Acid Arrow',
        formula: '4d4',
        total: 10,
        rolls: [3, 4, 2, 1],
        modifier: 0,
        context,
        adjustedTotal: 10,
        combatSummary,
        displayRolls: [3, 4, 2, 1],
        gwfBaseRolls,
        gwfDisplayRolls,
    });
}

function extractConditionEffectsCall() {
    expect(computeConditionEffects).toHaveBeenCalledTimes(1);
    return computeConditionEffects.mock.calls[0][0];
}

describe('handlePlayerSaveDamage - targetEffects and buff flags', () => {
    let deps;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = makeDeps();
        getRuntimeValue.mockReset().mockReturnValue(null);
        computeConditionEffects.mockReturnValue({
            restoreBalance: false,
            autoRerollForSaves: false,
            autoRerollBonus: null,
            saveAdvantageCount: 0,
            saveAdvantageAbilities: null,
        });
        getHolyAuraTargets.mockReturnValue([]);
        getCoronaSaveDisadvantage.mockReturnValue({ disadvantage: false });
        getElderChampionSaveDisadvantage.mockResolvedValue({ disadvantage: false });
        isCircleOfPowerActive.mockReturnValue(false);
        isDeathWardActive.mockReturnValue(false);
    });

    describe('shape_shift buff detection', () => {
        it('passes shapeShiftActive=true when target has shape_shift buff', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [{ effect: 'shape_shift' }];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { shapeShiftActive } = extractConditionEffectsCall();
            expect(shapeShiftActive).toBe(true);
        });

        it('passes shapeShiftActive=false when target lacks shape_shift buff', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [{ effect: 'other' }];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { shapeShiftActive } = extractConditionEffectsCall();
            expect(shapeShiftActive).toBe(false);
        });

        it('passes shapeShiftActive=false when activeBuffs is empty', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { shapeShiftActive } = extractConditionEffectsCall();
            expect(shapeShiftActive).toBe(false);
        });
    });

    describe('see_invisibility buff detection', () => {
        it('passes seeInvisibilityActive=true when target has see_invisibility buff', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [{ effect: 'see_invisibility' }];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { seeInvisibilityActive } = extractConditionEffectsCall();
            expect(seeInvisibilityActive).toBe(true);
        });

        it('passes seeInvisibilityActive=false when target lacks see_invisibility buff', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [{ effect: 'shape_shift' }];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { seeInvisibilityActive } = extractConditionEffectsCall();
            expect(seeInvisibilityActive).toBe(false);
        });
    });

    describe('isRaging detection from damageBonusExpression', () => {
        it('passes isRaging=true when buff has damageBonusExpression', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [{ damageBonusExpression: '2d6' }];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { isRaging } = extractConditionEffectsCall();
            expect(isRaging).toBe(true);
        });

        it('passes isRaging=false when buff lacks damageBonusExpression', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [{ effect: 'shape_shift' }];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { isRaging } = extractConditionEffectsCall();
            expect(isRaging).toBe(false);
        });

        it('passes isRaging=false when activeBuffs is empty', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { isRaging } = extractConditionEffectsCall();
            expect(isRaging).toBe(false);
        });
    });

    describe('livingLegendActive detection', () => {
        it('passes isLivingLegendActive=true when livingLegendActive is true', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'livingLegendActive') return true;
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { isLivingLegendActive } = extractConditionEffectsCall();
            expect(isLivingLegendActive).toBe(true);
        });

        it('passes isLivingLegendActive=false when livingLegendActive is false', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'livingLegendActive') return false;
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { isLivingLegendActive } = extractConditionEffectsCall();
            expect(isLivingLegendActive).toBe(false);
        });

        it('passes isLivingLegendActive=false when livingLegendActive is null/undefined', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'livingLegendActive') return null;
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { isLivingLegendActive } = extractConditionEffectsCall();
            expect(isLivingLegendActive).toBe(false);
        });
    });

    describe('elderChampionActive detection', () => {
        it('passes isElderChampionActive=true when target has elderChampionActive', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'elderChampionActive') return true;
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { isElderChampionActive } = extractConditionEffectsCall();
            expect(isElderChampionActive).toBe(true);
        });

        it('passes isElderChampionActive=false when target lacks elderChampionActive', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'elderChampionActive') return false;
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { isElderChampionActive } = extractConditionEffectsCall();
            expect(isElderChampionActive).toBe(false);
        });
    });

    describe('isElderChampionAttackerActive detection', () => {
        it('passes isElderChampionAttackerActive=true when attacker has elderChampionActive and differs from target', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'Goblin' && subKey === 'elderChampionActive') return true;
                if (key === 'TestWizard' && subKey === 'elderChampionActive') return false;
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            const context = { ...BASE_CONTEXT, attackerName: 'Goblin' };

            await invokeHandler(handler, context);

            const { isElderChampionAttackerActive } = extractConditionEffectsCall();
            expect(isElderChampionAttackerActive).toBe(true);
        });

        it('passes isElderChampionAttackerActive=false when attacker is the same as target', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'elderChampionActive') return true;
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { isElderChampionAttackerActive } = extractConditionEffectsCall();
            expect(isElderChampionAttackerActive).toBe(false);
        });

        it('passes isElderChampionAttackerActive=false when attacker lacks elderChampionActive', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'Goblin' && subKey === 'elderChampionActive') return false;
                if (key === 'TestWizard' && subKey === 'elderChampionActive') return false;
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            const context = { ...BASE_CONTEXT, attackerName: 'Goblin' };

            await invokeHandler(handler, context);

            const { isElderChampionAttackerActive } = extractConditionEffectsCall();
            expect(isElderChampionAttackerActive).toBe(false);
        });
    });

    describe('protection_from_poison buff detection', () => {
        it('passes isProtectionFromPoisonActive=true when buff matches name and effect', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [{ name: 'Protection from Poison', effect: 'protection_from_poison' }];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { isProtectionFromPoisonActive } = extractConditionEffectsCall();
            expect(isProtectionFromPoisonActive).toBe(true);
        });

        it('passes isProtectionFromPoisonActive=false when buff name does not match', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [{ name: 'Shield', effect: 'protection_from_poison' }];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { isProtectionFromPoisonActive } = extractConditionEffectsCall();
            expect(isProtectionFromPoisonActive).toBe(false);
        });

        it('passes isProtectionFromPoisonActive=false when buff effect does not match', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [{ name: 'Protection from Poison', effect: 'other' }];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { isProtectionFromPoisonActive } = extractConditionEffectsCall();
            expect(isProtectionFromPoisonActive).toBe(false);
        });

        it('passes isProtectionFromPoisonActive=false when activeBuffs is empty', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { isProtectionFromPoisonActive } = extractConditionEffectsCall();
            expect(isProtectionFromPoisonActive).toBe(false);
        });
    });

    describe('targetEffects filtering', () => {
        it('passes only target-specific effects to computeConditionEffects', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [
                    { target: 'OtherPlayer', effect: 'some_effect' },
                    { target: 'TestWizard', effect: 'relevant_effect' },
                    { target: 'TestWizard', effect: 'another_effect' },
                ];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { targetEffects } = extractConditionEffectsCall();
            expect(targetEffects).toHaveLength(2);
            expect(targetEffects).toEqual([
                { target: 'TestWizard', effect: 'relevant_effect' },
                { target: 'TestWizard', effect: 'another_effect' },
            ]);
        });

        it('passes empty array when no targetEffects exist for target', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [
                    { target: 'OtherPlayer', effect: 'some_effect' },
                ];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { targetEffects } = extractConditionEffectsCall();
            expect(targetEffects).toEqual([]);
        });

        it('handles null targetEffects gracefully', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return null;
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            const { targetEffects } = extractConditionEffectsCall();
            expect(targetEffects).toEqual([]);
        });
    });

    describe('handler return value', () => {
        it('returns true when handler completes the main save prompt path', async () => {
            getRuntimeValue.mockImplementation((key, subKey) => {
                if (key === 'campaign' && subKey === 'targetEffects') return [];
                if (key === 'TestWizard' && subKey === 'activeBuffs') return [];
                return null;
            });

            const handler = createPlayerSaveDamageHandler(deps);
            const result = await invokeHandler(handler);

            expect(result).toBe(true);
        });
    });

    describe('Death Ward grants advantage on saves', () => {
        it('passes saveAdvantage=true when target has Death Ward buff', async () => {
            isDeathWardActive.mockReturnValue(true);

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('saveAdvantage', true);
        });

        it('passes saveAdvantage=false when target has no Death Ward buff', async () => {
            isDeathWardActive.mockReturnValue(false);

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('saveAdvantage', false);
        });

        it('sends advantage=true to save prompt when Death Ward is active', async () => {
            isDeathWardActive.mockReturnValue(true);

            const handler = createPlayerSaveDamageHandler(deps);
            await invokeHandler(handler);

            expect(deps.pendingSaves['test-guid-1234']).toHaveProperty('saveAdvantage', true);
        });
    });
});
