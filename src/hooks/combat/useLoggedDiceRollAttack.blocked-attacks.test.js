// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
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

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
    clearHuntersMarkConcentration: vi.fn(),
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
  getSlowAcPenalty: () => 0,
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
    getWardingBondAcBonus: vi.fn(() => 0),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../services/automation/handlers/spells/forcecageHandler.js', () => ({
    isForcecageBlocked: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/mazeHandler.js', () => ({
    isMazeBlocked: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/banishmentHandler.js', () => ({
    isBanishmentBlocked: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/imprisonmentHandler.js', () => ({
    isImprisonmentBlocked: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/prismaticSprayHandler.js', () => ({
    isPrismaticSprayBlocked: vi.fn(),
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

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
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

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    isUnbreakableMajestyActive,
    hasAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';
import {
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';
import { isResilientSphereActive } from '../../services/combat/automation/automationPassives.js';
import { createLogAndShow, hasStarryDragonActive, starryDragonAppliesToRoll } from './useLoggedDiceRollAttack.js';
import { isForcecageBlocked } from '../../services/automation/handlers/spells/forcecageHandler.js';
import { isMazeBlocked } from '../../services/automation/handlers/spells/mazeHandler.js';
import { isBanishmentBlocked } from '../../services/automation/handlers/spells/banishmentHandler.js';
import { isImprisonmentBlocked } from '../../services/automation/handlers/spells/imprisonmentHandler.js';
import { isPrismaticSprayBlocked } from '../../services/automation/handlers/spells/prismaticSprayHandler.js';
import { endSanctuary } from '../../services/automation/handlers/spells/sanctuaryHandler.js';
import { checkCompelledDuelAttackExpiry } from '../../services/automation/handlers/spells/compelledDuelHandler.js';
import { addEntry } from '../../services/ui/logService.js';

describe('createLogAndShow - Blocked Attacks & Sanctuary', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    const blockerTests = [
        { handler: isForcecageBlocked, name: 'Forcecage' },
        { handler: isMazeBlocked, name: 'Maze' },
        { handler: isBanishmentBlocked, name: 'Banishment' },
        { handler: isImprisonmentBlocked, name: 'Imprisonment' },
        { handler: isPrismaticSprayBlocked, name: 'Prismatic Spray' },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        rollD20.mockReturnValue(15);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
        isForcecageBlocked.mockReturnValue(false);
        isMazeBlocked.mockReturnValue(false);
        isBanishmentBlocked.mockReturnValue(false);
        isImprisonmentBlocked.mockReturnValue(false);
        isPrismaticSprayBlocked.mockReturnValue(false);
        isResilientSphereActive.mockReturnValue(false);
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    describe.each(blockerTests)('$name block', ({ handler, name }) => {
        it('blocks attack, shows popup, and logs when blocker returns true', async () => {
            handler.mockReturnValue(true);
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', attackerName: 'TestFighter' });

            expect(handler).toHaveBeenCalledWith('TestFighter', 'Goblin', 'test-campaign');
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'automation_info',
                name,
            }));
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'info',
                text: expect.stringContaining(`blocked by ${name}`),
            }));
        });

        it('does not block when handler returns false', async () => {
            handler.mockReturnValue(false);
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

            expect(deps.setPopupHtml).not.toHaveBeenCalledWith(expect.objectContaining({ name }));
        });
    });

    describe('sanctuary - attacker has sanctuary', () => {
        it('ends sanctuary on attacker when attacker has sanctuary targetEffect', async () => {
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'campaign' && prop === 'targetEffects') {
                    return [{ effect: 'sanctuary', target: 'TestFighter', source: 'Cleric' }];
                }
                return null;
            });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

            expect(endSanctuary).toHaveBeenCalledWith(
                'Cleric',
                'TestFighter',
                'test-campaign',
                expect.stringContaining('made an attack'),
            );
        });
    });
});

describe('createLogAndShow - Compelled Duel Attack Expiry', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollD20.mockReturnValue(15);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
        checkCompelledDuelAttackExpiry.mockReturnValue(null);
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    it('calls checkCompelledDuelAttackExpiry on attack with target and shows popup when returned', async () => {
        const popup = { type: 'automation_info', name: 'Compelled Duel', description: 'Effect ended' };
        checkCompelledDuelAttackExpiry.mockReturnValue(popup);
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledWith('TestFighter', 'Goblin', 'test-campaign');
        expect(deps.setPopupHtml).toHaveBeenCalledWith(popup);
    });

    it('does not call checkCompelledDuelAttackExpiry for non-attack roll types', async () => {
        const fn = createFn();
        await fn('Athletics', 3, 'check', {});
        expect(checkCompelledDuelAttackExpiry).not.toHaveBeenCalled();
    });
});

describe('createLogAndShow - Resilient Sphere', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollD20.mockReturnValue(15);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    it('sets isAutoMiss when attacker is in resilient sphere', async () => {
        isResilientSphereActive.mockReturnValue(true);
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin', attackerName: 'TestFighter' });
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            isAutoMiss: true,
        }));
    });

    it('sets isAutoMiss when target is in resilient sphere', async () => {
        isResilientSphereActive.mockImplementation((name) => name === 'Goblin' ? true : false);
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin', attackerName: 'TestFighter' });
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            isAutoMiss: true,
        }));
    });

    it('sets notice on context when blocked by resilient sphere', async () => {
        isResilientSphereActive.mockReturnValue(true);
        const context = { targetName: 'Goblin', attackerName: 'TestFighter' };
        const fn = createFn();
        await fn('Longsword', 5, 'attack', context);
        expect(context.notice).toBe('Attack blocked by Resilient Sphere — nothing can pass through the barrier.');
    });
});

describe('hasStarryDragonActive export', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('returns true when Starry Form Dragon buff is active', async () => {
        getRuntimeValue.mockImplementation((key, field) => {
            if (key === 'TestWizard' && field === 'activeBuffs') {
                return [{ name: 'Starry Form', constellation: 'Dragon' }];
            }
            return null;
        });
        const result = hasStarryDragonActive('TestWizard', 'test-campaign');
        expect(result).toBe(true);
    });

    it('returns false when no buffs', async () => {
        getRuntimeValue.mockImplementation((key, field) => {
            if (key === 'TestWizard' && field === 'activeBuffs') return null;
            return null;
        });
        const result = hasStarryDragonActive('TestWizard', 'test-campaign');
        expect(result).toBe(false);
    });

    it('returns false when Starry Form is active but not Dragon', async () => {
        getRuntimeValue.mockImplementation((key, field) => {
            if (key === 'TestWizard' && field === 'activeBuffs') {
                return [{ name: 'Starry Form', constellation: 'Wyrm' }];
            }
            return null;
        });
        const result = hasStarryDragonActive('TestWizard', 'test-campaign');
        expect(result).toBe(false);
    });
});

describe('starryDragonAppliesToRoll export', () => {
    it('returns true for Constitution save variants', () => {
        expect(starryDragonAppliesToRoll('Constitution', 'save')).toBe(true);
        expect(starryDragonAppliesToRoll('CONSTITUTION', 'save')).toBe(true);
        expect(starryDragonAppliesToRoll('CON', 'save')).toBe(true);
    });

    it('returns false for non-constitution saves', () => {
        expect(starryDragonAppliesToRoll('Dexterity', 'save')).toBe(false);
        expect(starryDragonAppliesToRoll('DEX', 'save')).toBe(false);
    });

    it('returns true for Intelligence skills and ability checks', () => {
        expect(starryDragonAppliesToRoll('Arcana', 'skill')).toBe(true);
        expect(starryDragonAppliesToRoll('History', 'skill')).toBe(true);
        expect(starryDragonAppliesToRoll('Investigation', 'skill')).toBe(true);
        expect(starryDragonAppliesToRoll('Nature', 'skill')).toBe(true);
        expect(starryDragonAppliesToRoll('Religion', 'skill')).toBe(true);
        expect(starryDragonAppliesToRoll('Intelligence', 'check')).toBe(true);
        expect(starryDragonAppliesToRoll('Intellect', 'check')).toBe(true);
        expect(starryDragonAppliesToRoll('INT', 'check')).toBe(true);
    });

    it('returns true for Wisdom skills and ability checks', () => {
        expect(starryDragonAppliesToRoll('Animal Handling', 'skill')).toBe(true);
        expect(starryDragonAppliesToRoll('Insight', 'skill')).toBe(true);
        expect(starryDragonAppliesToRoll('Medicine', 'skill')).toBe(true);
        expect(starryDragonAppliesToRoll('Perception', 'skill')).toBe(true);
        expect(starryDragonAppliesToRoll('Survival', 'skill')).toBe(true);
        expect(starryDragonAppliesToRoll('Wisdom', 'check')).toBe(true);
        expect(starryDragonAppliesToRoll('WIS', 'check')).toBe(true);
    });

    it('returns false for unrelated skill names', () => {
        expect(starryDragonAppliesToRoll('Stealth', 'skill')).toBe(false);
        expect(starryDragonAppliesToRoll('Acrobatics', 'check')).toBe(false);
    });

    it('returns false for attack roll type', () => {
        expect(starryDragonAppliesToRoll('Constitution', 'attack')).toBe(false);
    });
});
