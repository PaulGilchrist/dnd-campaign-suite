// @maintained-by-ai: 2026-11-10
// Regression pin for bug-monster-attacks-log-phantom-second-die: the §82 ledger
// law says `mode` is the ONLY adv/dis truth and `rolls:[a,b]` means a real
// 2d20 pool — a `mode:'normal'` roll row must therefore carry EXACTLY ONE d20.
// The monster-card lane (and every lane sharing createLogAndShow: PC sheet
// attacks, saves, checks, initiative) used to persist the pre-rolled phantom
// second die on every normal press (`rolls:[15,16] mode:'normal' total:15`).
// These pins lock the ledger shape ONLY; the pool mechanics (max/min pick,
// popup transport, RNG order) are owned by d20RollComputation.test.js and the
// base lane file.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
    DEBUG_FORCE_CRIT: false,
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    findCreatureByName: vi.fn(() => null),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
    clearHuntersMarkConcentration: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    getUnbreakableMajestySaveDc: vi.fn(),
    hasAttackerTriggeredMajesty: vi.fn(() => false),
    markAttackerTriggeredMajesty: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../services/combat/automation/automationPassives.js', () => ({
    isResilientSphereActive: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getBaitAndSwitchAcBonus: vi.fn(() => 0),
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    getSlowAcPenalty: vi.fn(() => 0),
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(() => 0),
    getShieldOfFaithAcBonus: vi.fn(() => 0),
    getWardingBondAcBonus: vi.fn(() => 0),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./attackBlockers.js', () => ({
    checkAttackBlockers: vi.fn(() => false),
}));

vi.mock('./handlers/sanctuarySave.js', () => ({
    handleSanctuarySave: vi.fn(() => true),
}));

vi.mock('./battleMaster.js', () => ({
    getKnownManeuvers: vi.fn(() => []),
    getSuperiorityDice: vi.fn(() => 0),
}));

vi.mock('../../services/automation/handlers/spells/sanctuaryHandler.js', () => ({
    endSanctuary: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/compelledDuelHandler.js', () => ({
    checkCompelledDuelAttackExpiry: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
    getManeuversForRules: vi.fn(),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationDefense: vi.fn(),
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../services/rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../services/rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

// Restore-Balance cancel lane (maybeCancelForcedMode) — mocked so the default
// pass leaves the mode untouched.
vi.mock('../../services/combat/restoreBalanceState.js', () => ({
    consumeArmedRestoreBalance: vi.fn(async () => null),
}));

import { rollD20 } from '../../services/dice/diceRoller.js';
import { getTargetFromAttacker, findCreatureByName } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import { consumeArmedRestoreBalance } from '../../services/combat/restoreBalanceState.js';

const CAMPAIGN = 'test-campaign';

describe('roll-ledger dice shape (§82 law: mode is the only adv/dis truth)', () => {
    let deps;
    let fn;

    const rollRow = () => deps.logEntry.mock.calls.map(c => c[0]).find(e => e.type === 'roll');

    beforeEach(() => {
        vi.clearAllMocks();
        deps = {
            characterName: 'Wolf',
            campaignName: CAMPAIGN,
            characters: [{ name: 'ElderPaladin', computedStats: { armorClass: 19 } }],
            setPopupHtml: vi.fn(),
            logEntry: vi.fn(),
        };
        fn = createLogAndShow(deps);
        getTargetFromAttacker.mockReturnValue({ name: 'ElderPaladin', ac: 19 });
        findCreatureByName.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'ElderPaladin', type: 'player' }] });
        getRuntimeValue.mockReturnValue(null);
    });

    it('normal press logs EXACTLY ONE d20 (no phantom second die) — the bug face', async () => {
        rollD20.mockReturnValueOnce(15).mockReturnValueOnce(16);
        await fn('Bite', 4, 'attack', { targetName: 'ElderPaladin' });

        expect(rollRow()).toEqual(expect.objectContaining({
            rollType: 'attack',
            name: 'Bite',
            rolls: [15],
            mode: 'normal',
            total: 15,
        }));
    });

    it('advantage press keeps the honest 2d20 pool + mode', async () => {
        rollD20.mockReturnValueOnce(3).mockReturnValueOnce(17);
        await fn('Bite', 4, 'attack', { targetName: 'ElderPaladin', forcedMode: 'advantage' });

        expect(rollRow()).toEqual(expect.objectContaining({
            rolls: [3, 17],
            mode: 'advantage',
            total: 17,
        }));
    });

    it('disadvantage press (Speedy face) keeps the honest 2d20 pool + mode', async () => {
        rollD20.mockReturnValueOnce(14).mockReturnValueOnce(1);
        await fn('Bite', 4, 'attack', { targetName: 'ElderPaladin', forcedMode: 'disadvantage' });

        expect(rollRow()).toEqual(expect.objectContaining({
            rolls: [14, 1],
            mode: 'disadvantage',
            total: 1,
        }));
    });

    it('a roll-time target-Lucky flip from normal keeps a 2d20 pool under the flipped mode', async () => {
        getRuntimeValue.mockImplementation((name, prop) =>
            name === 'ElderPaladin' && prop === 'luckyDisadvantageActive' ? true : null);
        rollD20.mockReturnValueOnce(9).mockReturnValueOnce(4);
        await fn('Bite', 4, 'attack', { targetName: 'ElderPaladin' });

        expect(rollRow()).toEqual(expect.objectContaining({
            rolls: [9, 4],
            mode: 'disadvantage',
            total: 4,
        }));
    });

    it('a Restore-Balance-cancelled advantage roll resolves normal and drops to one die', async () => {
        consumeArmedRestoreBalance.mockResolvedValueOnce('EvasiveFighter');
        rollD20.mockReturnValueOnce(12).mockReturnValueOnce(6);
        await fn('Bite', 4, 'attack', { targetName: 'ElderPaladin', forcedMode: 'advantage' });

        expect(rollRow()).toEqual(expect.objectContaining({
            rolls: [12],
            mode: 'normal',
            total: 12,
        }));
    });

    it('Halfling-Lucky reroll replaces the recorded die on a normal row (single die, rerolled value)', async () => {
        rollD20.mockReturnValueOnce(1).mockReturnValueOnce(9).mockReturnValueOnce(14);
        await fn('Bite', 4, 'attack', {
            targetName: 'ElderPaladin',
            autoReroll: true,
            autoRerollCondition: 'roll_equals_1',
        });

        expect(rollRow()).toEqual(expect.objectContaining({
            rolls: [14],
            mode: 'normal',
            total: 14,
        }));
    });

    it('popup payload keeps the full 2-die pool on a normal press (GM adv/dis toggle needs it)', async () => {
        rollD20.mockReturnValueOnce(8).mockReturnValueOnce(13);
        await fn('Bite', 4, 'attack', { targetName: 'ElderPaladin' });

        const popup = deps.setPopupHtml.mock.calls.map(c => c[0]).find(p => p.type === 'd20');
        expect(popup.rolls).toEqual([8, 13]);
    });
});
