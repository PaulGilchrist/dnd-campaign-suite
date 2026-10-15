// @maintained-by-ai: 2026-10-14
// Owns the blocked-attack lane of createLogAndShow: the real attackBlockers.js
// unblockers (popup + log content, roll aborted), attacker-side Sanctuary end,
// Compelled Duel expiry, Resilient Sphere auto-miss, and the starryDragon.js
// re-exports. cannotAct / isWithinRange gates do NOT live in this lane —
// they are owned by canTakeAction.js / rangeCheck.js and their own suites.
// Sibling lane files neuter ./attackBlockers.js and ./sanctuarySave.js in
// their mocks, so nothing else exercises these paths for real.
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
    getBaitAndSwitchAcBonus: vi.fn(() => 0),
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
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

import { rollD20 } from '../../services/dice/diceRoller.js';
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
import {
    createLogAndShow,
    hasStarryDragonActive,
    starryDragonAppliesToRoll,
} from './useLoggedDiceRollAttack.js';
import { isForcecageBlocked } from '../../services/automation/handlers/spells/forcecageHandler.js';
import { isMazeBlocked } from '../../services/automation/handlers/spells/mazeHandler.js';
import { isBanishmentBlocked } from '../../services/automation/handlers/spells/banishmentHandler.js';
import { isImprisonmentBlocked } from '../../services/automation/handlers/spells/imprisonmentHandler.js';
import { isPrismaticSprayBlocked } from '../../services/automation/handlers/spells/prismaticSprayHandler.js';
import { endSanctuary } from '../../services/automation/handlers/spells/sanctuaryHandler.js';
import { checkCompelledDuelAttackExpiry } from '../../services/automation/handlers/spells/compelledDuelHandler.js';
import { addEntry } from '../../services/ui/logService.js';

const deps = {
    characterName: 'TestFighter',
    campaignName: 'test-campaign',
    characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
    setPopupHtml: vi.fn(),
    logEntry: vi.fn(),
    autoDamageSourceRef: { current: null },
};

// Every attack blocker: an enclosed creature makes the attack impossible
// ("No attack, spell, or effect can pass through"), per attackBlockers.js.
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
    checkCompelledDuelAttackExpiry.mockReturnValue(null);
});

describe('createLogAndShow - attack blockers (real attackBlockers.js)', () => {
    describe.each(blockerTests)('$name block', ({ handler, name }) => {
        it('shows popup, logs, and aborts the roll when blocked', async () => {
            handler.mockReturnValue(true);
            await createLogAndShow(deps)('Longsword', 5, 'attack', {
                targetName: 'Goblin',
                attackerName: 'TestFighter',
            });

            expect(handler).toHaveBeenCalledWith('TestFighter', 'Goblin', 'test-campaign');
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'automation_info',
                name,
                description: expect.stringContaining(`blocked by ${name}`),
            }));
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'info',
                text: expect.stringContaining(`blocked by ${name}`),
            }));
            // Blocked = the roll never happens.
            expect(rollD20).not.toHaveBeenCalled();
            expect(deps.logEntry).not.toHaveBeenCalled();
        });
    });

    it('proceeds with a normal d20 attack when no blocker fires', async () => {
        await createLogAndShow(deps)('Longsword', 5, 'attack', {
            targetName: 'Goblin',
            attackerName: 'TestFighter',
        });

        expect(rollD20).toHaveBeenCalled();
        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ type: 'd20' }));
        expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({
            text: expect.stringContaining('blocked by'),
        }));
    });
});

describe('createLogAndShow - sanctuary', () => {
    it('ends the attacker\'s own Sanctuary when they make an attack', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'campaign' && prop === 'targetEffects') {
                return [{ effect: 'sanctuary', target: 'TestFighter', source: 'Cleric' }];
            }
            return null;
        });
        await createLogAndShow(deps)('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(endSanctuary).toHaveBeenCalledWith(
            'Cleric',
            'TestFighter',
            'test-campaign',
            expect.stringContaining('made an attack'),
        );
        // Self-targeted Sanctuary does not gate the roll — the attack proceeds.
        expect(rollD20).toHaveBeenCalled();
    });
});

describe('createLogAndShow - Compelled Duel attack expiry', () => {
    it('shows the expiry popup when the caster attacks a non-duel target', async () => {
        const popup = { type: 'automation_info', name: 'Compelled Duel', description: 'Effect ended' };
        checkCompelledDuelAttackExpiry.mockReturnValue(popup);
        await createLogAndShow(deps)('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(checkCompelledDuelAttackExpiry).toHaveBeenCalledWith('TestFighter', 'Goblin', 'test-campaign');
        expect(deps.setPopupHtml).toHaveBeenCalledWith(popup);
    });

    it('is never consulted for non-attack roll types', async () => {
        await createLogAndShow(deps)('Athletics', 3, 'check', {});
        expect(checkCompelledDuelAttackExpiry).not.toHaveBeenCalled();
    });
});

describe('createLogAndShow - Resilient Sphere auto-miss', () => {
    // resolveResilientSphereAutoMiss: enclosed attacker OR enclosed target ⇒ auto-miss.
    it.each([
        ['attacker', () => (name) => name === 'TestFighter'],
        ['target', () => (name) => name === 'Goblin'],
    ])('auto-misses when the %s is enclosed, with barrier notice', async (_who, implFactory) => {
        isResilientSphereActive.mockImplementation(implFactory());
        const context = { targetName: 'Goblin', attackerName: 'TestFighter' };
        await createLogAndShow(deps)('Longsword', 5, 'attack', context);

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ isAutoMiss: true }));
        expect(context.notice).toBe('Attack blocked by Resilient Sphere — nothing can pass through the barrier.');
    });

    it('does not auto-miss when nobody is enclosed', async () => {
        const context = { targetName: 'Goblin', attackerName: 'TestFighter' };
        await createLogAndShow(deps)('Longsword', 5, 'attack', context);

        expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.not.objectContaining({ isAutoMiss: true }));
        expect(context.notice).toBeUndefined();
    });
});

describe('hasStarryDragonActive', () => {
    it('returns true only for an active Starry Form: Dragon buff', () => {
        getRuntimeValue.mockReturnValue([{ name: 'Starry Form', constellation: 'Dragon' }]);
        expect(hasStarryDragonActive('TestWizard', 'test-campaign')).toBe(true);

        getRuntimeValue.mockReturnValue([{ name: 'Starry Form', constellation: 'Wyrm' }]);
        expect(hasStarryDragonActive('TestWizard', 'test-campaign')).toBe(false);

        getRuntimeValue.mockReturnValue(null);
        expect(hasStarryDragonActive('TestWizard', 'test-campaign')).toBe(false);
    });
});

describe('starryDragonAppliesToRoll', () => {
    it('applies to CON saves and INT/WIS ability checks and skills', () => {
        expect(starryDragonAppliesToRoll('Constitution', 'save')).toBe(true);
        expect(starryDragonAppliesToRoll('CONSTITUTION', 'save')).toBe(true);
        expect(starryDragonAppliesToRoll('CON', 'save')).toBe(true);
        expect(starryDragonAppliesToRoll('Intelligence', 'check')).toBe(true);
        expect(starryDragonAppliesToRoll('Intellect', 'check')).toBe(true);
        expect(starryDragonAppliesToRoll('INT', 'check')).toBe(true);
        expect(starryDragonAppliesToRoll('Wisdom', 'check')).toBe(true);
        expect(starryDragonAppliesToRoll('WIS', 'check')).toBe(true);
        for (const skill of ['Arcana', 'History', 'Investigation', 'Nature', 'Religion',
            'Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival']) {
            expect(starryDragonAppliesToRoll(skill, 'skill')).toBe(true);
        }
    });

    it('does not apply to other saves, checks, skills, or attack rolls', () => {
        expect(starryDragonAppliesToRoll('Dexterity', 'save')).toBe(false);
        expect(starryDragonAppliesToRoll('DEX', 'save')).toBe(false);
        expect(starryDragonAppliesToRoll('Stealth', 'skill')).toBe(false);
        expect(starryDragonAppliesToRoll('Acrobatics', 'check')).toBe(false);
        expect(starryDragonAppliesToRoll('Constitution', 'attack')).toBe(false);
    });
});
