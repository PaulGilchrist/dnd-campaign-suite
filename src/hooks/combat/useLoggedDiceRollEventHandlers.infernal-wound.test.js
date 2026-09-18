// MA-0367 (PC-target combo save-result seam): Bearded Devil Infernal Glaive —
// a failed DC 12 CON save inflicts the wound via infernalWoundService; the
// dc_success:"full" arm keeps the attack damage FULL on BOTH outcomes (the save
// gates only the wound); a successful save grants ZERO wound state.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 7, rolls: [4, 3], modifier: 0 })),
    rollExpressionDoubled: vi.fn(() => ({ total: 14, rolls: [4, 3, 4, 3], modifier: 0 })),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [{ name: 'Wild_Sage_Druid', type: 'player', currentHp: 30, maxHp: 40 }] })),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => []),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

// byte mirror of the REAL edited applyDamage semantics (MA-0367 'full' arm).
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterEvasion: vi.fn((total, success, dcSuccess) => {
        if (!success) return total;
        if (dcSuccess === 'half') return Math.floor(total / 2);
        if (dcSuccess === 'full') return total;
        return 0;
    }),
    applyDamageToTarget: vi.fn(async (_cs, _t, dmg) => ({ finalDamage: dmg, newHp: 30 - dmg, damageReduced: false })),
    normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(() => false),
}));
vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({ stripSummonedFromCombatSummary: vi.fn() }));
vi.mock('../../services/combat/creatureTypeResolver.js', () => ({ resolveCreatureType: vi.fn(() => 'player') }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({ endInvisibilityOnHostileAction: vi.fn() }));
vi.mock('../loggedDiceRollUtils.js', () => ({ hasSoulstitchProtection: vi.fn(() => false) }));
vi.mock('../../services/ui/utils.js', () => ({ default: { guid: vi.fn(() => 'log-guid'), getName: vi.fn((n) => n) } }));
vi.mock('../../services/combat/auras/pendingPopupRegistry.js', () => ({ getPendingPopupSetter: vi.fn(() => undefined) }));
vi.mock('../../services/combat/auras/pendingSaveRegistry.js', () => ({ getPendingSavePrompt: vi.fn() }));
vi.mock('../../services/ui/storage.js', () => ({ default: { set: vi.fn() } }));
vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({ isCircleOfPowerActive: vi.fn(() => false) }));
vi.mock('../../services/combat/concentration/concentrationService.js', () => ({ cleanupConcentrationEffects: vi.fn() }));
vi.mock('../../services/combat/automation/automationPassives.js', () => ({ isResilientSphereActive: vi.fn(() => false) }));
vi.mock('../../services/rules/features/viciousMockeryService.js', () => ({ triggerViciousMockeryForGeneric: vi.fn() }));
vi.mock('../../services/rules/features/soulTomeTrapService.js', () => ({ grantSoulTomeTrap: vi.fn(async () => {}) }));

const grantInfernalWound = vi.fn(async () => ({ granted: true, alreadyWounded: false }));
vi.mock('../../services/rules/features/infernalWoundService.js', () => ({
    grantInfernalWound: (...args) => grantInfernalWound(...args),
}));

vi.mock('./handlers/damageHandlerUtils.js', () => ({
    getHpThreshold: vi.fn(() => null),
    assignSecondaryFields: vi.fn(),
    buildDamageBreakdownEntry: vi.fn((r, t, d) => ({ type: t, amount: d })),
    resolveAppliedDamage: vi.fn((r) => r?.finalDamage ?? 0),
}));

import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { getPendingSavePrompt } from '../../services/combat/auras/pendingSaveRegistry.js';
import { setupEventListeners } from './useLoggedDiceRollEventHandlers.js';

const CAMPAIGN = 'test-campaign';
const TARGET = 'Wild_Sage_Druid';

function glaivePending() {
    return {
        targetName: TARGET,
        rawDamage: 7,
        saveDc: 12,
        saveType: 'CON',
        dcSuccess: 'full',
        damageType: 'Slashing',
        attackerName: 'Bearded Devil 1',
        name: 'Infernal Glaive',
        formula: '1d10 + 3',
        modifier: 3,
        rolls: [4, 3],
        campaignName: CAMPAIGN,
        statusEffects: null,
        isAutoCrit: false,
        infernalWound: { effect: 'infernal_wound', bleedDie: '1d10', expiresMinutes: 1, medicineDc: 12 },
    };
}

function fire(detail) {
    window.dispatchEvent(new CustomEvent('save-result', { detail }));
    return new Promise((resolve) => setTimeout(resolve, 30));
}

beforeEach(() => {
    vi.clearAllMocks();
    window.__pendingResultHandlersInstalled = false;
    setupEventListeners({ characterName: TARGET, campaignName: CAMPAIGN, logEntry: vi.fn(), charactersRef: { current: [{ name: TARGET }] } });
});

describe('MA-0367 save-result seam — full damage both legs + wound grant', () => {
    it('failed save: FULL unhalved attack damage + wound granted with bleed die', async () => {
        getPendingSavePrompt.mockReturnValue(glaivePending());
        await fire({ promptId: 'p1', targetName: TARGET, success: false, roll: 5, total: 8, saveBonus: 3, saveType: 'CON', saveDc: 12, dcSuccess: 'full', rawRolls: [5] });

        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), TARGET, 7, ['Slashing'], expect.anything());
        expect(grantInfernalWound).toHaveBeenCalledWith(expect.objectContaining({
            campaignName: CAMPAIGN,
            attackerName: 'Bearded Devil 1',
            targetName: TARGET,
            bleedDie: '1d10',
        }));
    });

    it('successful save: FULL attack damage STILL lands, wound is NOT granted', async () => {
        getPendingSavePrompt.mockReturnValue(glaivePending());
        await fire({ promptId: 'p2', targetName: TARGET, success: true, roll: 19, total: 22, saveBonus: 3, saveType: 'CON', saveDc: 12, dcSuccess: 'full', rawRolls: [19] });

        expect(grantInfernalWound).not.toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), TARGET, 7, ['Slashing'], expect.anything());
    });

    it('a row without the wound arm is byte-inert (no grant even on a fail)', async () => {
        getPendingSavePrompt.mockReturnValue({ ...glaivePending(), infernalWound: null });
        await fire({ promptId: 'p3', targetName: TARGET, success: false, roll: 5, total: 8, saveBonus: 3, saveType: 'CON', saveDc: 12, dcSuccess: 'half', rawRolls: [5] });

        expect(grantInfernalWound).not.toHaveBeenCalled();
    });
});
