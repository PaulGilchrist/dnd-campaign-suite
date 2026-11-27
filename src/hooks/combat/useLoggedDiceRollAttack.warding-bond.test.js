// @maintained-by-ai 2026-11-26
// SP-125 attack-lane AC-fold authority: createLogAndShow queries the ward by
// DEFENDER name + campaign via the mocked getWardingBondAcBonus (wardee's
// warding_bond acBonus, +1 AC per public/data/spells.json), stamps
// ctx._wardingBondAcBonus, and hitResolution folds it into effectiveAc
// (useLoggedDiceRollAttack.js:559 → hitResolution.js:290 computeEffectiveAc).
// The folded AC + wardingBondAcBonus must reach BOTH the popup and log
// payloads so computedHit can never flip a resolved MISS into a damage-
// applying HIT (mirrors the SP-105 Shield of Faith forwarding pattern; the
// verdict flows via ctx/state, no top-level seam args are pinned). AC-badge
// DISPLAY: CharSummary-BuffEffects. Stacking: BadgesAndAC. Getter internals:
// loggedDiceRollUtils.warding-bond.test.js. Casting/slot gates:
// spellGates.wardingBond.test.js — none of those are re-tested here.
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

vi.mock('./handlers/sanctuarySave.js', () => ({
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

    it('queries the ward by defender, folds +1 AC across the hit boundary both ways, forwards to popup and log', async () => {
        // Control: no ward → channel reads 0, effectiveAc stays at base 10.
        await fn('Mace', 3, 'attack', { targetName: 'EvasiveFighter' });
        // Defender-scoped lookup: ward is the wardee's buff, never the attacker's.
        expect(getWardingBondAcBonus).toHaveBeenCalledWith('EvasiveFighter', 'test-campaign');
        const control = deps.setPopupHtml.mock.calls[0][0];
        expect(control.targetAc).toBe(10);
        expect(control.effectiveAc).toBe(10);
        expect(control.wardingBondAcBonus).toBe(0);
        expect(control.hit).toBe(true);

        // Ward live: total 8 + 3 = 11 meets folded AC 11 — exact-boundary HIT.
        getWardingBondAcBonus.mockReturnValue(1);
        rollD20.mockReturnValue(8);
        await fn('Mace', 3, 'attack', { targetName: 'EvasiveFighter' });
        const hit = deps.setPopupHtml.mock.calls[1][0];
        expect(hit.targetAc).toBe(10);
        expect(hit.effectiveAc).toBe(11);
        expect(hit.wardingBondAcBonus).toBe(1);
        expect(hit.hit).toBe(true);
        expect(deps.logEntry).toHaveBeenLastCalledWith(expect.objectContaining({
            type: 'roll',
            rollType: 'attack',
            targetAc: 10,
            effectiveAc: 11,
            wardingBondAcBonus: 1,
            hit: true,
        }));

        // Refusal: total 7 + 3 = 10 < folded AC 11 — the SAME total would
        // HIT base AC 10, so a miss proves the comparison uses the folded AC.
        rollD20.mockReturnValue(7);
        await fn('Mace', 3, 'attack', { targetName: 'EvasiveFighter' });
        const miss = deps.setPopupHtml.mock.calls[2][0];
        expect(miss.effectiveAc).toBe(11);
        expect(miss.wardingBondAcBonus).toBe(1);
        expect(miss.hit).toBe(false);

        // Census: one ward lookup and one log row per roll, no doubles.
        expect(getWardingBondAcBonus).toHaveBeenCalledTimes(3);
        expect(deps.logEntry).toHaveBeenCalledTimes(3);
    });
});
