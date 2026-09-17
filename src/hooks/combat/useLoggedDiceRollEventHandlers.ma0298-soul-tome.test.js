// MA-0298: save-result fail seam for the Arcanaloth combo attack — a failed
// DC 17 CHA save grants the indefinite Soul Tome te + Incapacitated via
// soulTomeTrapService; a success grants ZERO trap state. The secondary damage
// leg doubles its dice on the carried crit flag via the SAME
// rollExpressionDoubled consumer plain attacks use (computeSecondaryRoll).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 18, rolls: [6, 9, 3], modifier: 0 })),
    rollExpressionDoubled: vi.fn(() => ({ total: 36, rolls: [6, 9, 3, 6, 9, 3], modifier: 0 })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [{ name: 'Wild_Sage_Druid', type: 'player', currentHp: 100, maxHp: 143 }] })),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => []),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

// Faithful mirror of the real applyDamage.js semantics.
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess) => {
        if (!success) return total;
        if (dcSuccess === 'half') return Math.floor(total / 2);
        return 0;
    }),
    applyDamageToTarget: vi.fn(async (_cs, _t, dmg) => ({ finalDamage: dmg, newHp: 100 - dmg, damageReduced: false })),
    normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({
    stripSummonedFromCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/creatureTypeResolver.js', () => ({
    resolveCreatureType: vi.fn(() => 'player'),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    hasSoulstitchProtection: vi.fn(() => false),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: vi.fn(() => 'log-guid'), getName: vi.fn((n) => n) },
}));

vi.mock('../../services/combat/auras/pendingPopupRegistry.js', () => ({
    getPendingPopupSetter: vi.fn(() => undefined),
}));

vi.mock('../../services/combat/auras/pendingSaveRegistry.js', () => ({
    getPendingSavePrompt: vi.fn(),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: vi.fn(() => false),
}));

vi.mock('../../services/combat/concentration/concentrationService.js', () => ({
    cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(() => false),
}));

vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({
    triggerViciousMockeryForGeneric: vi.fn(),
}));

vi.mock('./handlers/damageHandlerUtils.js', () => ({
    getHpThreshold: vi.fn(() => null),
    assignSecondaryFields: vi.fn((target, src, suffixes) => {
        if (!src) return;
        suffixes.forEach(s => {
            const key = s === 'Name' ? 'secondaryName' : `secondary${s}`;
            const map = { secondaryName: 'name', secondaryFormula: 'formula', secondaryRolls: 'rolls', secondaryTotal: 'total', secondaryModifier: 'modifier', secondaryDamageType: 'damageType', secondaryFinalDamage: 'finalDamage' };
            target[key] = src[map[key]];
        });
    }),
    buildDamageBreakdownEntry: vi.fn((r, t, d) => ({ type: t, amount: d })),
    resolveAppliedDamage: vi.fn((r) => r?.finalDamage ?? 0),
}));

vi.mock('../../services/rules/features/soulTomeTrapService.js', () => ({
    grantSoulTomeTrap: vi.fn(async () => {}),
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { getPendingSavePrompt } from '../../services/combat/auras/pendingSaveRegistry.js';
import { grantSoulTomeTrap } from '../../services/rules/features/soulTomeTrapService.js';
import { setupEventListeners } from './useLoggedDiceRollEventHandlers.js';

function comboPending() {
    return {
        targetName: 'Wild_Sage_Druid',
        rawDamage: 15,
        saveDc: 17,
        saveType: 'CHA',
        dcSuccess: 'none',
        damageType: 'Slashing',
        attackerName: 'Arcanaloth',
        name: 'Banishing Claw (Requires Soul Tome)',
        formula: '2d4 + 5',
        modifier: 5,
        rolls: [5, 5],
        campaignName: 'test-campaign',
        autoDamageSecondaryFormula: '3d12',
        autoDamageSecondaryDamageType: 'Psychic',
        statusEffects: null,
        isAutoCrit: true,
        saveConditions: ['incapacitated'],
        soulTomeTrap: { effect: 'banished_demiplane', soulTome: true },
        repeatSave: { save_type: 'Charisma' },
    };
}

function fire(detail) {
    window.dispatchEvent(new CustomEvent('save-result', { detail }));
    return new Promise((resolve) => setTimeout(resolve, 30));
}

describe('MA-0298 save-result seam — crit doubling + Soul Tome trap grant', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.__pendingResultHandlersInstalled = false;
        setupEventListeners({ characterName: 'Wild_Sage_Druid', campaignName: 'test-campaign', logEntry: vi.fn(), charactersRef: { current: [{ name: 'Wild_Sage_Druid' }] } });
    });

    it('failed save: FULL unhalved damage both legs, secondary dice DOUBLED on crit, trap granted', async () => {
        getPendingSavePrompt.mockReturnValue(comboPending());
        await fire({ promptId: 'p1', targetName: 'Wild_Sage_Druid', success: false, roll: 5, total: 4, saveBonus: -1, saveType: 'CHA', saveDc: 17, dcSuccess: 'none', rawRolls: [5] });

        // crit secondary rides the SAME doubling consumer plain attacks use
        expect(rollExpressionDoubled).toHaveBeenCalledWith('3d12');
        expect(rollExpression).not.toHaveBeenCalledWith('3d12');
        // dc_success none: fail pays full primary rawDamage
        expect(grantSoulTomeTrap).toHaveBeenCalledWith(expect.objectContaining({
            campaignName: 'test-campaign',
            attackerName: 'Arcanaloth',
            targetName: 'Wild_Sage_Druid',
            saveDc: 17,
        }));
    });

    it('success save: primary hit damage lands FULL (unhalved, unconditional) and ZERO trap grant', async () => {
        getPendingSavePrompt.mockReturnValue(comboPending());
        await fire({ promptId: 'p2', targetName: 'Wild_Sage_Druid', success: true, roll: 19, total: 18, saveBonus: -1, saveType: 'CHA', saveDc: 17, dcSuccess: 'none', rawRolls: [19] });

        expect(grantSoulTomeTrap).not.toHaveBeenCalled();
        // MA-0298: RAW hit damage is unconditional — success pays the FULL
        // pre-rolled primary (15), NOT zero, NOT half (soulTomeTrap arm key).
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Wild_Sage_Druid', 15, ['Slashing'], expect.anything());
        // crit secondary rides the SAME doubling consumer plain attacks use
        expect(rollExpressionDoubled).toHaveBeenCalledWith('3d12');
    });

    it('MA-0218 regression: non-trap dc_success none save-damage row stays ZERO on success', async () => {
        getPendingSavePrompt.mockReturnValue({ ...comboPending(), soulTomeTrap: null });
        await fire({ promptId: 'p4', targetName: 'Wild_Sage_Druid', success: true, roll: 19, total: 18, saveBonus: -1, saveType: 'CHA', saveDc: 17, dcSuccess: 'none', rawRolls: [19] });

        // computeDamageAfterEvasion (mocked save semantics) zeroes the primary;
        // only the unconditional secondary leg lands.
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), 'Wild_Sage_Druid', 0, ['Slashing'], expect.anything());
    });

    it('non-trap row fail stays byte-inert (no soul tome grant, secondary rolled base)', async () => {
        const pending = { ...comboPending(), soulTomeTrap: null, isAutoCrit: false };
        getPendingSavePrompt.mockReturnValue(pending);
        await fire({ promptId: 'p3', targetName: 'Wild_Sage_Druid', success: false, roll: 5, total: 4, saveBonus: -1, saveType: 'CHA', saveDc: 17, dcSuccess: 'half', rawRolls: [5] });

        expect(grantSoulTomeTrap).not.toHaveBeenCalled();
        expect(rollExpression).toHaveBeenCalledWith('3d12');
        expect(rollExpressionDoubled).not.toHaveBeenCalled();
    });
});
