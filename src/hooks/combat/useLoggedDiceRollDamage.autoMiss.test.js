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

vi.mock('../../services/shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { hasPotentCantrip, isMagicMissileImmune, applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';

describe('Auto-miss and potent cantrip miss-half-damage', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        rollExpression.mockReturnValue({ total: 8, rolls: [5, 3], modifier: 0 });
        getRuntimeValue.mockReturnValue(null);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        isMagicMissileImmune.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
        hasIgnoreResistance.mockReturnValue(false);
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 5, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 }],
        });
        deps.logEntry.mockClear();
        deps.setPopupHtml.mockClear();
    });

    function createFn() {
        return createLogDamageAndShow(deps);
    }

    describe('auto-miss', () => {
        it('logs auto-miss with rangeReason when provided', async () => {
            const fn = createFn();
            await fn('Longbow', '1d8+3', 8, [5, 3], 3, {
                targetName: 'Goblin',
                damageType: 'piercing',
                isAutoMiss: true,
                rangeReason: 'Out of range',
            });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'auto-miss-damage',
                rangeReason: 'Out of range',
            }));
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'auto-miss',
                rangeReason: 'Out of range',
            }));
        });

        it('logs auto-miss without rangeReason when not provided', async () => {
            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                isAutoMiss: true,
            });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'auto-miss-damage',
            }));
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'auto-miss',
            }));
        });
    });

    describe('potent cantrip miss-half-damage', () => {
        it('applies half damage on miss when potent cantrip and isCantrip flags are set', async () => {
            hasPotentCantrip.mockReturnValue(true);
            rollExpression.mockReturnValueOnce({ total: 10, rolls: [6, 4], modifier: 0 });
            applyMinDamageAdjustment.mockReturnValue(10);
            applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Shocking Grasp', '1d8', 5, [5], 0, {
                targetName: 'Goblin',
                damageType: 'lightning',
                isAutoMiss: true,
                isCantrip: true,
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            expect(hasPotentCantrip).toHaveBeenCalled();
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'cantrip-miss-half-damage',
                isPotentCantrip: true,
            }));
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'save-damage',
                dcSuccess: 'half',
                isPotentCantrip: true,
            }));
        });

        it('does not apply potent cantrip half damage when isCantrip is false', async () => {
            hasPotentCantrip.mockReturnValue(true);
            const fn = createFn();
            await fn('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0, {
                targetName: 'Goblin',
                damageType: 'fire',
                isAutoMiss: true,
                isCantrip: false,
            });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'auto-miss-damage',
            }));
        });

        it('does not apply potent cantrip half damage when potent cantrip flag is false', async () => {
            hasPotentCantrip.mockReturnValue(false);
            const fn = createFn();
            await fn('Shocking Grasp', '1d8', 5, [5], 0, {
                targetName: 'Goblin',
                damageType: 'lightning',
                isAutoMiss: true,
                isCantrip: true,
            });
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType: 'auto-miss-damage',
            }));
        });

        it('ignores resistance when playerStats has ignoreResistance for the damage type', async () => {
            hasPotentCantrip.mockReturnValue(true);
            hasIgnoreResistance.mockReturnValue(true);
            rollExpression.mockReturnValueOnce({ total: 10, rolls: [6, 4], modifier: 0 });
            applyMinDamageAdjustment.mockReturnValue(10);
            applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 8, damageReduced: false });

            const fn = createFn();
            await fn('Shocking Grasp', '1d8', 5, [5], 0, {
                targetName: 'Goblin',
                damageType: 'lightning',
                isAutoMiss: true,
                isCantrip: true,
                playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
            });
            expect(hasIgnoreResistance).toHaveBeenCalledWith(
                expect.objectContaining({ automation: { passives: [{ type: 'potent_cantrip' }] } }),
                'lightning'
            );
        });
    });
});
