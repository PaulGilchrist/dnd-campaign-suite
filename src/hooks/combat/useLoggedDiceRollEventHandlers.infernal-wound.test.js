// @maintained-by-ai: 2026-10-23
// MA-0367 (PC-target combo save-result seam): Bearded Devil Infernal Glaive —
// a failed DC 12 CON save inflicts the wound via infernalWoundService; the
// dc_success:"full" arm keeps the attack damage FULL on BOTH outcomes (the save
// gates only the wound); a successful save grants ZERO wound state.
// Owns the EVENT-BUS wiring seam only — the inline saveProcessing lane is
// covered by saveProcessing.infernal-wound.test.js; the 'full' damage math
// against the REAL applyDamage by applyDamage.save-full.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 7, rolls: [4], modifier: 3 })),
    rollExpressionDoubled: vi.fn(() => ({ total: 14, rolls: [4, 4], modifier: 3 })),
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
import { parseInfernalWoundClause } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const CAMPAIGN = 'test-campaign';
const TARGET = 'Wild_Sage_Druid';
const DEVIL = 'Bearded Devil 1';

// BY-name disk row (monsters.json:8897 'Bearded Devil' / 'Infernal Glaive'):
// 1d10+3 Slashing, DC 12 CON, dc_success 'full', wound 1d10. #505 build-via-
// producer: the wound arm is BUILT by parseInfernalWoundClause and rides the
// pending payload VERBATIM (useLoggedDiceRollAttack.js:154 copies
// context.infernalWound), so this lane consumes the parser's real output.
const GLAIVE_ROW = monstersData.find(m => m.name === 'Bearded Devil')
    .actions.find(a => a.name === 'Infernal Glaive');

// Install the window listeners ONCE per file — window persists across tests, so
// re-installing every beforeEach would stack duplicate save-result processors.
window.__pendingResultHandlersInstalled = false;
setupEventListeners({ characterName: TARGET, campaignName: CAMPAIGN, logEntry: vi.fn(), charactersRef: { current: [{ name: TARGET }] } });

function glaivePending() {
    return {
        targetName: TARGET,
        rawDamage: 7,
        saveDc: GLAIVE_ROW.save_dc,
        saveType: 'CON', // upstream pending prompt carries the abbreviated ability
        dcSuccess: GLAIVE_ROW.dc_success,
        damageType: GLAIVE_ROW.damage_type_primary,
        attackerName: DEVIL,
        name: GLAIVE_ROW.name,
        formula: GLAIVE_ROW.damage_dice_primary,
        modifier: 3,
        rolls: [4],
        campaignName: CAMPAIGN,
        statusEffects: null,
        isAutoCrit: false,
        infernalWound: parseInfernalWoundClause(GLAIVE_ROW),
    };
}

function fire(detail) {
    window.dispatchEvent(new CustomEvent('save-result', { detail }));
    // settle the async handleSaveResult chain (mocked fetches resolve on microtasks)
    return new Promise((resolve) => setTimeout(resolve, 30));
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('MA-0367 save-result seam — full damage both legs + wound grant', () => {
    it('failed save: FULL unhalved attack damage + wound granted with bleed die', async () => {
        getPendingSavePrompt.mockReturnValue(glaivePending());
        await fire({ promptId: 'p1', targetName: TARGET, success: false, roll: 5, saveType: 'CON', saveDc: 12, dcSuccess: 'full' });

        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), TARGET, 7, ['Slashing'], expect.anything());
        expect(grantInfernalWound).toHaveBeenCalledWith(expect.objectContaining({
            campaignName: CAMPAIGN,
            attackerName: DEVIL,
            targetName: TARGET,
            bleedDie: '1d10',
        }));
    });

    it('successful save: FULL attack damage STILL lands, wound is NOT granted', async () => {
        getPendingSavePrompt.mockReturnValue(glaivePending());
        await fire({ promptId: 'p2', targetName: TARGET, success: true, roll: 19, saveType: 'CON', saveDc: 12, dcSuccess: 'full' });

        expect(grantInfernalWound).not.toHaveBeenCalled();
        expect(applyDamageToTarget).toHaveBeenCalledWith(expect.anything(), TARGET, 7, ['Slashing'], expect.anything());
    });

    it('a row without the wound arm is byte-inert (no grant even on a fail)', async () => {
        getPendingSavePrompt.mockReturnValue({ ...glaivePending(), infernalWound: null });
        await fire({ promptId: 'p3', targetName: TARGET, success: false, roll: 5, saveType: 'CON', saveDc: 12, dcSuccess: 'full' });

        expect(grantInfernalWound).not.toHaveBeenCalled();
    });
});
