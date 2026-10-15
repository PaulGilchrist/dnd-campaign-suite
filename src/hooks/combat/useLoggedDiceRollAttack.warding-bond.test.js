// @maintained-by-ai: 2026-10-14
// SP-125 attack-lane AC-fold authority: createLogAndShow reads the wardee's
// warding_bond acBonus (+1 AC per public/data/spells.json) via the mocked
// getWardingBondAcBonus getter, stamps ctx._wardingBondAcBonus, and
// hitResolution folds it into effectiveAc (useLoggedDiceRollAttack.js:512 →
// hitResolution.js computeEffectiveAc). The folded AC + wardingBondAcBonus
// must reach BOTH the popup and log payloads so computedHit can never flip a
// resolved MISS into a damage-applying HIT (mirrors the SP-105 Shield of
// Faith forwarding pattern). Getter internals: loggedDiceRollUtils.warding-
// bond.test.js. Casting/slot gates: spellGates.wardingBond.test.js — do not
// re-test either here.
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
    isUnbreakableMajestyActive: vi.fn(),
    getUnbreakableMajestySaveDc: vi.fn(),
    hasAttackerTriggeredMajesty: vi.fn(),
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
  getSlowAcPenalty: () => 0,
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
    getWardingBondAcBonus: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./attackBlockers.js', () => ({
    checkAttackBlockers: vi.fn(() => false),
}));

vi.mock('./sanctuarySave.js', () => ({
    handleSanctuarySave: vi.fn(() => true),
}));

vi.mock('./battleMaster.js', () => ({
    getKnownManeuvers: vi.fn(() => []),
    getSuperiorityDice: vi.fn(() => 0),
}));

vi.mock('../../services/automation/handlers/spells/forcecageHandler.js', () => ({
    isForcecageBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/mazeHandler.js', () => ({
    isMazeBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/banishmentHandler.js', () => ({
    isBanishmentBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/imprisonmentHandler.js', () => ({
    isImprisonmentBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/prismaticSprayHandler.js', () => ({
    isPrismaticSprayBlocked: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/spells/sanctuaryHandler.js', () => ({
    endSanctuary: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/automation/common/damageRollback.js', () => ({
    addTargetResult: vi.fn(() => Promise.resolve()),
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

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { isUnbreakableMajestyActive, hasAttackerTriggeredMajesty } from '../../services/combat/auras/unbreakableMajesty.js';
import { getWardingBondAcBonus } from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';

describe('useLoggedDiceRollAttack — SP-125 Warding Bond AC fold', () => {
    let deps;
    let fn;

    beforeEach(() => {
        vi.clearAllMocks(); // clears calls only — factory defaults persist
        deps = {
            characterName: 'Thug 1',
            campaignName: 'test-campaign',
            characters: [{ name: 'EvasiveFighter', computedStats: { armorClass: 10 } }],
            setPopupHtml: vi.fn(),
            logEntry: vi.fn(),
        };
        fn = createLogAndShow(deps);

        rollD20.mockReturnValue(9);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'EvasiveFighter', type: 'player', ac: 10 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'EvasiveFighter', type: 'player', ac: 10 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getWardingBondAcBonus.mockReturnValue(0); // reset boundary-stamp leakage between tests
    });

    it('control: no ward → effectiveAc is base AC 10 and total 12 hits', async () => {
        await fn('Mace', 3, 'attack', { targetName: 'EvasiveFighter' });

        const popup = deps.setPopupHtml.mock.calls[0][0];
        expect(popup.targetAc).toBe(10);
        expect(popup.effectiveAc).toBe(10);
        expect(popup.wardingBondAcBonus).toBe(0);
        expect(popup.hit).toBe(true);
    });

    it('folds warding_bond acBonus into effectiveAc (AC 11) and flips boundary total 11 to HIT', async () => {
        getWardingBondAcBonus.mockReturnValue(1);
        rollD20.mockReturnValue(8); // 8 + 3 = 11 — MISS vs AC 10 control would hit; vs AC 11 exact boundary
        await fn('Mace', 3, 'attack', { targetName: 'EvasiveFighter' });

        const popup = deps.setPopupHtml.mock.calls[0][0];
        expect(popup.targetAc).toBe(10);
        expect(popup.effectiveAc).toBe(11);
        expect(popup.wardingBondAcBonus).toBe(1);
        expect(popup.hit).toBe(true);

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'roll',
            rollType: 'attack',
            targetAc: 10,
            effectiveAc: 11,
            wardingBondAcBonus: 1,
            hit: true,
        }));
    });

    it('refuses at AC 11 boundary: total 10 now misses', async () => {
        getWardingBondAcBonus.mockReturnValue(1);
        rollD20.mockReturnValue(7); // 7 + 3 = 10 < 11
        await fn('Mace', 3, 'attack', { targetName: 'EvasiveFighter' });

        const popup = deps.setPopupHtml.mock.calls[0][0];
        expect(popup.effectiveAc).toBe(11);
        expect(popup.hit).toBe(false);
    });
});
