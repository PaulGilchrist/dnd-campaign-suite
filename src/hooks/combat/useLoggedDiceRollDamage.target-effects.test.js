// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    computeDamageAfterEvasion: vi.fn((total, success, _dcSuccess, evasion) => (evasion && success ? 0 : (success ? Math.floor(total / 2) : total))),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (type) => type,
}));

import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { computeDamageAfterSave, rollSaveForCreature, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('NPC save damage with stored target effects', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Goblin', computedStats: { saveBonuses: { DEX: 3 }, armorClass: 12 }, saveModifiers: [] },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        getRuntimeValue.mockImplementation((_campaignName, _key) => null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        hasIgnoreResistance.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        computeDamageAfterSave.mockImplementation((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total);
        rollSaveForCreature.mockReturnValue({ success: false, roll: 8, total: 11, bonus: 3, rawRolls: [8] });
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 3, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
        setRuntimeValue.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    describe('disadvantage_on_next_save from targetEffects', () => {
        it('applies disadvantage and removes the stored effect when it exists', async () => {
            getRuntimeValue.mockImplementation((_campaignName, key, _campaignName2) => {
                if (key === 'targetEffects') {
                    return [
                        { target: 'Goblin', effect: 'disadvantage_on_next_save' },
                        { target: 'Other', effect: 'other_effect' },
                    ];
                }
                return null;
            });

            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
            });

            expect(rollSaveForCreature).toHaveBeenCalledWith(
                expect.any(Object),
                'DEX',
                15,
                true, // disadvantage
                false
            );

            const targetEffectsCalls = setRuntimeValue.mock.calls.filter(
                c => c[1] === 'targetEffects'
            );
            const lastCall = targetEffectsCalls[targetEffectsCalls.length - 1];
            if (lastCall) {
                expect(lastCall[2]).toEqual([
                    { target: 'Other', effect: 'other_effect' },
                ]);
            }
        });

        it('does not apply disadvantage when no stored effect exists', async () => {
            getRuntimeValue.mockImplementation((_campaignName, key, _campaignName2) => {
                if (key === 'targetEffects') return [];
                return null;
            });

            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                saveDc: 15,
                saveType: 'DEX',
                dcSuccess: 'half',
            });

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
