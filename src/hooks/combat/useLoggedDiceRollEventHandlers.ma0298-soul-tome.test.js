// @maintained-by-ai 2026-11-26
// MA-0298 (event-bus save-result seam): Arcanaloth Banishing Claw — a failed
// DC 17 CHA save grants the indefinite Soul Tome te + Incapacitated via
// soulTomeTrapService; a success grants ZERO trap state yet still pays the
// FULL pre-rolled hit damage (RAW: the save gates only the trap). The crit
// secondary leg doubles its dice via the SAME rollExpressionDoubled consumer
// plain attacks use (computeSecondaryRoll). Owns the EVENT-BUS wiring seam
// only — the inline handlePlayerSaveDamage arm is covered by
// handlePlayerSaveDamage.ma0298-crit-trap.test.js and the pending-shape keys
// by handlePlayerSaveDamage.pending-data.test.js; the service internals
// (exact te bytes, logs, turn-END repeat-save escape) by
// soulTomeTrapService.test.js — never mirrored on this lane.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));

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

// byte mirror of the REAL applyDamage save semantics (half-on-success arm).
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

vi.mock('./handlers/damageHandlerUtils.js', () => ({
    getHpThreshold: vi.fn(() => null),
    assignSecondaryFields: vi.fn(),
    buildDamageBreakdownEntry: vi.fn((r, t, d) => ({ type: t, amount: d })),
    buildDamageBreakdownEntries: vi.fn((r, t, d) => [{ type: t, amount: d }]),
    resolveAppliedDamage: vi.fn((r) => r?.finalDamage ?? 0),
}));

import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { getPendingSavePrompt } from '../../services/combat/auras/pendingSaveRegistry.js';
import { grantSoulTomeTrap } from '../../services/rules/features/soulTomeTrapService.js';
import { setupEventListeners } from './useLoggedDiceRollEventHandlers.js';
import { parseSoulTomeTrapClause, saveAbilityAbbr } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const TARGET = 'Wild_Sage_Druid';
const CAMPAIGN = 'test-campaign';

// Install the window listeners ONCE per file — window persists across tests, so
// re-installing every beforeEach would stack duplicate save-result processors.
window.__pendingResultHandlersInstalled = false;
setupEventListeners({ characterName: TARGET, campaignName: CAMPAIGN, logEntry: vi.fn(), charactersRef: { current: [{ name: TARGET }] } });

// BY-name disk row (monsters.json 'Arcanaloth' / 'Banishing Claw (Requires
// Soul Tome)'): 2d4+5 Slashing + 3d12 Psychic auto-secondary, DC 17 CHA,
// dc_success 'none'. The soulTome arm rides the pending payload VERBATIM from
// parseSoulTomeTrapClause (handlePlayerSaveDamage.pending-data.test.js owns
// that carry), so this lane consumes the parser's real output.
const CLAW_ROW = monstersData.find(m => m.name === 'Arcanaloth')
    .actions.find(a => a.name === 'Banishing Claw (Requires Soul Tome)');
const SECONDARY = CLAW_ROW.damage_dice_secondary;

function clawPending() {
    return {
        targetName: TARGET,
        rawDamage: 15,
        saveDc: CLAW_ROW.save_dc,
        saveType: saveAbilityAbbr(CLAW_ROW.save_type), // pending carries the abbreviated ability
        dcSuccess: CLAW_ROW.dc_success,
        damageType: CLAW_ROW.damage_type_primary,
        attackerName: 'Arcanaloth',
        name: CLAW_ROW.name,
        formula: CLAW_ROW.damage_dice_primary,
        modifier: 5,
        rolls: [5, 5],
        campaignName: CAMPAIGN,
        autoDamageSecondaryFormula: SECONDARY,
        autoDamageSecondaryDamageType: CLAW_ROW.damage_type_secondary,
        statusEffects: null,
        isAutoCrit: true,
        soulTomeTrap: parseSoulTomeTrapClause(CLAW_ROW.save_effect),
    };
}

function fire(detail) {
    window.dispatchEvent(new CustomEvent('save-result', { detail }));
    // settle the async handleSaveResult chain (mocked fetches resolve on microtasks)
    return new Promise((resolve) => setTimeout(resolve, 30));
}

// ordered [target, amount, types] census of every damage dispatch — a leaked/
// stacked listener or double-dispatch seam re-fires and skews this census.
const appliedCensus = () => applyDamageToTarget.mock.calls.map(c => [c[1], c[2], c[3]]);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('MA-0298 save-result seam — crit doubling + Soul Tome trap grant', () => {
    it('failed save: FULL unhalved primary, secondary dice doubled exactly once, trap granted exactly once', async () => {
        getPendingSavePrompt.mockReturnValue(clawPending());
        await fire({ promptId: 'p1', targetName: TARGET, success: false, roll: 5, total: 4, saveBonus: -1, saveType: 'CHA', saveDc: 17, dcSuccess: 'none', rawRolls: [5] });

        // exactly primary(Slashing 15, unhalved) + secondary(doubled 36), in order
        expect(appliedCensus()).toEqual([
            [TARGET, 15, ['Slashing']],
            [TARGET, 36, ['Psychic']],
        ]);
        // crit secondary rides the SAME doubling consumer plain attacks use
        expect(rollExpressionDoubled).toHaveBeenCalledTimes(1);
        expect(rollExpressionDoubled).toHaveBeenCalledWith(SECONDARY);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(grantSoulTomeTrap).toHaveBeenCalledTimes(1);
        expect(grantSoulTomeTrap).toHaveBeenCalledWith(expect.objectContaining({
            campaignName: CAMPAIGN,
            attackerName: 'Arcanaloth',
            targetName: TARGET,
            // BY-name anchors: DC/ability/action ride the disk row through
            // the pending payload — never re-derive them here
            saveDc: CLAW_ROW.save_dc,
            saveType: saveAbilityAbbr(CLAW_ROW.save_type),
            actionName: CLAW_ROW.name,
        }));
    });

    it('success save: hit damage lands FULL (unhalved, unconditional), secondary leg still lands, ZERO trap grant', async () => {
        getPendingSavePrompt.mockReturnValue(clawPending());
        await fire({ promptId: 'p2', targetName: TARGET, success: true, roll: 19, total: 18, saveBonus: -1, saveType: 'CHA', saveDc: 17, dcSuccess: 'none', rawRolls: [19] });

        // MA-0298: RAW hit damage is unconditional — success pays the FULL
        // pre-rolled primary (15), NOT zero, NOT half (soulTomeTrap arm key),
        // and the claw's psychic leg still lands unhalved on a save success.
        expect(appliedCensus()).toEqual([
            [TARGET, 15, ['Slashing']],
            [TARGET, 36, ['Psychic']],
        ]);
        expect(rollExpressionDoubled).toHaveBeenCalledTimes(1);
        expect(rollExpressionDoubled).toHaveBeenCalledWith(SECONDARY);
        expect(grantSoulTomeTrap).not.toHaveBeenCalled();
    });

    it('non-trap row stays byte-inert: MA-0218 zero-on-success and non-crit half-fail base dice, both damage legs still land, no grant', async () => {
        const pending = { ...clawPending(), soulTomeTrap: null };

        // MA-0218 regression: dc_success none save-damage row stays ZERO on success.
        getPendingSavePrompt.mockReturnValue(pending);
        await fire({ promptId: 'p3', targetName: TARGET, success: true, roll: 19, total: 18, saveBonus: -1, saveType: 'CHA', saveDc: 17, dcSuccess: 'none', rawRolls: [19] });

        // non-crit fail: computeDamageAfterEvasion leg (full 15 on a fail) + base
        // (undoubled) secondary. No mid-test clear — one ordered census proves
        // each event dispatched exactly its own primary+secondary pair.
        getPendingSavePrompt.mockReturnValue({ ...pending, isAutoCrit: false });
        await fire({ promptId: 'p4', targetName: TARGET, success: false, roll: 5, total: 4, saveBonus: -1, saveType: 'CHA', saveDc: 17, dcSuccess: 'half', rawRolls: [5] });

        expect(appliedCensus()).toEqual([
            [TARGET, 0, ['Slashing']],       // MA-0218 zero-on-success preserved
            [TARGET, 36, ['Psychic']],       // autoCrit row: doubled secondary
            [TARGET, 15, ['Slashing']],      // non-crit fail: full via evasion leg
            [TARGET, 18, ['Psychic']],       // base (undoubled) secondary
        ]);
        expect(rollExpressionDoubled).toHaveBeenCalledTimes(1);
        expect(rollExpression).toHaveBeenCalledTimes(1);
        expect(rollExpression).toHaveBeenCalledWith(SECONDARY);
        expect(grantSoulTomeTrap).not.toHaveBeenCalled();
    });
});
