// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(() => Promise.resolve()),
}));
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
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(() => false),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
    evaluateAutoExpression: vi.fn(() => 0),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    hasPotentCantrip: vi.fn(() => false),
    hasSoulstitchProtection: vi.fn(() => false),
    clearSoulstitchStamp: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/combat/auras/coronaAuraUtils.js', () => ({
    getCoronaSaveDisadvantage: vi.fn(() => ({ disadvantage: false })),
}));

vi.mock('../../../services/combat/auras/elderChampionAuraUtils.js', () => ({
    getElderChampionSaveDisadvantage: vi.fn(async () => ({ disadvantage: false })),
}));

vi.mock('../../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
}));

vi.mock('./handleOverchannelSelfDamage.js', () => ({
    handleOverchannelSelfDamage: vi.fn(),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// Mirrors the real damage-after-save/evasion semantics: half damage only with
// evasion + dcSuccess 'half'; otherwise full damage on a failed save.
vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success) => (success ? 0 : total)),
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess, evasion) => {
        if (evasion && dcSuccess === 'half') return success ? 0 : Math.floor(total / 2);
        return success ? 0 : total;
    }),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    normalizeSaveType: vi.fn((t) => t),
}));

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { hasIgnoreResistance } from '../../../services/combat/automation/automationService.js';
import { hasPotentCantrip } from '../loggedDiceRollUtils.js';
import { applyDamageToTarget, rollSaveForCreature } from '../../../services/rules/combat/applyDamage.js';
import { createNpcSaveDamageHandler } from './handleNpcSaveDamage.js';

describe('handleNpcSaveDamage - player targets', () => {
    const deps = {
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [
            { name: 'TestWizard' },
            { name: 'PlayerTarget', computedStats: { evasionEffects: [] } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    const defaultSaveResult = { roll: 12, total: 14, bonus: 2, success: false, rawRolls: [12] };
    const defaultContext = {
        targetName: 'PlayerTarget',
        saveDc: 12,
        saveType: 'dex',
        dcSuccess: 'none',
        damageType: 'fire',
        attackerName: 'Goblin',
    };
    const defaultCombatSummary = {
        creatures: [{ name: 'PlayerTarget', type: 'player', currentHp: 10, maxHp: 10 }],
    };
    const secondaryCtx = {
        autoDamageSecondaryFormula: '1d6',
        autoDamageSecondaryDamageType: 'fire',
    };
    const potentCantripCtx = {
        ...secondaryCtx,
        isCantrip: true,
        playerStats: { automation: { passives: [{ type: 'potent_cantrip' }] } },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // mockClear does not reset implementations — restore defaults the
        // factory declares for mocks individual tests override.
        rollExpression.mockReturnValue({ total: 10, rolls: [6, 4], modifier: 0 });
        rollSaveForCreature.mockReturnValue(defaultSaveResult);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 3, damageReduced: false });
        getRuntimeValue.mockReturnValue(null);
        hasIgnoreResistance.mockReturnValue(false);
        hasPotentCantrip.mockReturnValue(false);
    });

    function run(contextOverride = {}, combatSummary = defaultCombatSummary) {
        return createNpcSaveDamageHandler(deps)({
            name: 'Fire Bolt',
            formula: '1d10',
            total: 10,
            rolls: [6, 4],
            modifier: 0,
            context: { ...defaultContext, ...contextOverride },
            adjustedTotal: 10,
            combatSummary,
        });
    }

    const setCallsFor = (prop) => setRuntimeValue.mock.calls.filter((call) => call[1] === prop);

    describe('death saves on dropping to 0 HP', () => {
        it('initializes death saves and death failures when player drops to 0 HP', async () => {
            applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 0, damageReduced: false });

            await run();

            expect(setCallsFor('deathSaves')).toEqual([
                ['PlayerTarget', 'deathSaves', [false, false, false], 'test-campaign'],
            ]);
            expect(setCallsFor('deathFailures')).toEqual([
                ['PlayerTarget', 'deathFailures', [false, false, false], 'test-campaign'],
            ]);
        });

        it('does not set death saves when the player survives the damage', async () => {
            applyDamageToTarget.mockResolvedValue({ finalDamage: 5, newHp: 5, damageReduced: false });

            await run();

            expect(setCallsFor('deathSaves')).toHaveLength(0);
            expect(setCallsFor('deathFailures')).toHaveLength(0);
        });

        it('does not set death saves for non-player targets', async () => {
            applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 0, damageReduced: false });

            await run(
                { targetName: 'Goblin' },
                { creatures: [{ name: 'Goblin', type: 'npc', currentHp: 10, maxHp: 10 }] },
            );

            expect(setCallsFor('deathSaves')).toHaveLength(0);
            expect(setCallsFor('deathFailures')).toHaveLength(0);
        });
    });

    describe('currentHitPoints updates', () => {
        it('writes the apply result HP for player targets, damage or zero damage', async () => {
            for (const { success, finalDamage, newHp } of [
                { success: false, finalDamage: 7, newHp: 3 },
                { success: true, finalDamage: 0, newHp: 10 },
            ]) {
                applyDamageToTarget.mockClear();
                rollSaveForCreature.mockReturnValue({ ...defaultSaveResult, success });
                applyDamageToTarget.mockResolvedValue({ finalDamage, newHp, damageReduced: false });

                await run();

                expect(setRuntimeValue).toHaveBeenCalledWith(
                    'PlayerTarget', 'currentHitPoints', newHp, 'test-campaign',
                );
            }
        });
    });

    describe('ignoreResistance', () => {
        it('threads the player feat flag into primary damage options', async () => {
            for (const hasFeat of [true, false]) {
                applyDamageToTarget.mockClear();
                hasIgnoreResistance.mockReturnValue(hasFeat);

                await run({ playerStats: { name: 'TestWizard' } });

                expect(applyDamageToTarget.mock.calls[0][4].ignoreResistance).toBe(hasFeat);
            }
        });

        it('threads the player feat flag into secondary and primary damage options', async () => {
            for (const hasFeat of [true, false]) {
                applyDamageToTarget.mockClear();
                applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 4, newHp: 9, damageReduced: false });
                hasIgnoreResistance.mockReturnValue(hasFeat);

                await run({ ...secondaryCtx, playerStats: { name: 'TestWizard' } });

                // First call is secondary damage, second is primary.
                expect(applyDamageToTarget.mock.calls[0][4].ignoreResistance).toBe(hasFeat);
                expect(applyDamageToTarget.mock.calls[1][4].ignoreResistance).toBe(hasFeat);
            }
        });
    });

    describe('potent cantrip', () => {
        it('halves secondary cantrip damage only when the secondary save succeeds', async () => {
            hasPotentCantrip.mockReturnValue(true);

            for (const secondarySuccess of [true, false]) {
                applyDamageToTarget.mockClear();
                rollSaveForCreature
                    .mockReturnValueOnce(defaultSaveResult)
                    .mockReturnValueOnce({ roll: 15, total: 17, bonus: 2, success: secondarySuccess, rawRolls: [15] });
                rollExpression.mockReturnValueOnce({ total: 8, rolls: [5, 3], modifier: 0 });

                await run(potentCantripCtx);

                // Secondary apply is the first call: floor(8/2) = 4 on success, full 8 on failure,
                // and it always skips concentration tracking.
                const secondaryCall = applyDamageToTarget.mock.calls[0];
                expect(secondaryCall[2]).toBe(secondarySuccess ? 4 : 8);
                expect(secondaryCall[4]).toEqual(expect.objectContaining({ skipConcentration: true }));
            }
        });
    });

    describe('concentrationTotalDamage with secondary', () => {
        it('passes combined total damage to primary apply when secondary damage exists', async () => {
            applyDamageToTarget.mockResolvedValueOnce({ finalDamage: 5, newHp: 8, damageReduced: false });

            await run(secondaryCtx);

            // Second call is primary damage — concentration total = primary 10 + secondary 5.
            expect(applyDamageToTarget.mock.calls[1][4]).toEqual(expect.objectContaining({ concentrationTotalDamage: 15 }));
        });

        it('does not pass concentrationTotalDamage when there is no secondary damage', async () => {
            await run();

            expect(applyDamageToTarget.mock.calls[0][4].concentrationTotalDamage).toBeUndefined();
        });
    });

    describe('dcSuccess=half with player targets', () => {
        it('applies full damage on a failed save and zero on a success without evasion', async () => {
            for (const [success, expectedDamage] of [[false, 10], [true, 0]]) {
                applyDamageToTarget.mockClear();
                rollSaveForCreature.mockReturnValue({ ...defaultSaveResult, success });

                await run({ dcSuccess: 'half' });

                expect(applyDamageToTarget).toHaveBeenCalledWith(
                    expect.anything(), 'PlayerTarget', expectedDamage, expect.any(Array),
                    { campaignName: 'test-campaign', characters: expect.any(Array), ignoreResistance: false, attackerName: 'TestWizard', suppressHpLog: true },
                );
            }
        });
    });
});
