// SP-105: the popup/log payload must forward the resolver's authoritative
// effectiveAc (+2 Shield of Faith, +5 Shield) so computedHit can never flip
// a resolved MISS into a damage-applying HIT.
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
    getParryAcBonus: vi.fn(() => 0),
  getSlowAcPenalty: () => 0,
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
    getWardingBondAcBonus: vi.fn(() => 0),
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
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker, findCreatureByName } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { isUnbreakableMajestyActive, hasAttackerTriggeredMajesty } from '../../services/combat/auras/unbreakableMajesty.js';
import {
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';

describe('useLoggedDiceRollAttack — SP-105 effective AC forwarding', () => {
    let deps;
    let fn;

    beforeEach(() => {
        vi.clearAllMocks();
        deps = {
            characterName: 'Zombie 1',
            campaignName: 'test-campaign',
            characters: [{ name: 'Divine_Cleric', computedStats: { armorClass: 12 } }],
            setPopupHtml: vi.fn(),
            logEntry: vi.fn(),
        };
        fn = createLogAndShow(deps);

        rollD20.mockReturnValue(9);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Divine_Cleric', type: 'player', ac: 12 });
        findCreatureByName.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Divine_Cleric', type: 'player', ac: 12 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
    });

    it('forwards shieldOfFaithAcBonus and effectiveAc (AC 14) to popup and log on a boundary miss', async () => {
        getShieldOfFaithAcBonus.mockReturnValue(2);
        await fn('Slam', 3, 'attack', { targetName: 'Divine_Cleric' });

        const popup = deps.setPopupHtml.mock.calls[0][0];
        expect(popup.targetAc).toBe(12);
        expect(popup.effectiveAc).toBe(14);
        expect(popup.shieldOfFaithAcBonus).toBe(2);
        expect(popup.hit).toBe(false);

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'roll',
            rollType: 'attack',
            targetAc: 12,
            effectiveAc: 14,
            shieldOfFaithAcBonus: 2,
            hit: false,
        }));
    });

    it('flips to HIT at exactly AC 14 with Shield of Faith still forwarded', async () => {
        getShieldOfFaithAcBonus.mockReturnValue(2);
        rollD20.mockReturnValue(11);
        await fn('Slam', 3, 'attack', { targetName: 'Divine_Cleric' });

        const popup = deps.setPopupHtml.mock.calls[0][0];
        expect(popup.effectiveAc).toBe(14);
        expect(popup.hit).toBe(true);
    });

    it('forwards shield spell +5 into effectiveAc and payload', async () => {
        getShieldAcBonus.mockReturnValue(5);
        await fn('Slam', 3, 'attack', { targetName: 'Divine_Cleric' });

        const popup = deps.setPopupHtml.mock.calls[0][0];
        expect(popup.effectiveAc).toBe(17);
        expect(popup.shieldAcBonus).toBe(5);
        expect(popup.hit).toBe(false);
    });

    it('control: no AC buffs → effectiveAc equals base AC and boundary total 12 hits', async () => {
        await fn('Slam', 3, 'attack', { targetName: 'Divine_Cleric' });

        const popup = deps.setPopupHtml.mock.calls[0][0];
        expect(popup.effectiveAc).toBe(12);
        expect(popup.shieldOfFaithAcBonus).toBe(0);
        expect(popup.hit).toBe(true);
    });

    it('folds cover bonus into the forwarded effectiveAc', async () => {
        getShieldOfFaithAcBonus.mockReturnValue(2);
        await fn('Slam', 3, 'attack', { targetName: 'Divine_Cleric', coverAcBonus: 2, coverLevel: 'half' });

        const popup = deps.setPopupHtml.mock.calls[0][0];
        expect(popup.effectiveAc).toBe(16);
        expect(popup.coverAcBonus).toBe(2);
        expect(popup.hit).toBe(false);
    });
});
