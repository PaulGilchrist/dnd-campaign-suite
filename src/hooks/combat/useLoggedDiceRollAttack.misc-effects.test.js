// @maintained-by-ai: 2026-10-14
// Ownerless minor effects at the createLogAndShow roll seam: Sundering Blow,
// Bane/Bless attack folds, target-side Lucky feat, Sacred Weapon labelling,
// maneuver preload, Bardic Inspiration defense context, Pending Skill Check
// (Ambush). Behaviors with dedicated lanes were removed: ray-of-enfeeblement
// STR disadvantage (same strCheckDisadvantage consumer is owned by
// d20RollComputation.weakening-breath.test.js), cosmic omen fold
// (cosmicOmenHandler.pending-store.test.js), explicit target resolution
// (useLoggedDiceRollAttack.test.js "target resolution"), Halfling Lucky
// reroll (d20RollComputation.test.js).

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
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: () => 1,
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

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationDefense: vi.fn(),
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
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

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
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

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
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
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import { getManeuversForRules } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import {
    hasBardicInspirationDefense,
    getBardicInspirationDieSize,
} from '../../services/combat/auras/bardicInspirationState.js';

const defaultDeps = {
    characterName: 'TestFighter',
    campaignName: 'test-campaign',
    characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
    setPopupHtml: vi.fn(),
    logEntry: vi.fn(),
    autoDamageSourceRef: { current: null },
};

function createFn(depsOverride = {}) {
    return createLogAndShow({ ...defaultDeps, ...depsOverride });
}

function mockTargetEffects(effects) {
    getRuntimeValue.mockImplementation((name, prop) => {
        if (name === 'campaign' && prop === 'targetEffects') return effects;
        return null;
    });
}

function mockRuntimeValue(implementations) {
    getRuntimeValue.mockImplementation((name, prop, ...rest) => {
        const key = `${name}:${prop}`;
        if (typeof implementations[key] === 'function') {
            return implementations[key](...rest);
        }
        return implementations[key] ?? null;
    });
}

function noTarget() {
    getTargetFromAttacker.mockReturnValue(null);
    loadCombatSummary.mockResolvedValue({ creatures: [] });
}

function getDefaultMocks() {
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
}

describe('createLogAndShow - Sundering Blow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
    });

    it('adds +5 hit bonus when next_attack_bonus effect exists on target with default value', async () => {
        mockTargetEffects([{ target: 'Goblin', effect: 'next_attack_bonus', value: '5' }]);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 22 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 10,
            bonusDetail: expect.stringContaining('Sundering Blow'),
        }));
        expect(defaultDeps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 10,
            bonusDetail: expect.stringContaining('Sundering Blow'),
        }));
    });

    it('parses a custom effect value and falls back to +5 when unparseable', async () => {
        mockTargetEffects([{ target: 'Goblin', effect: 'next_attack_bonus', value: '10' }]);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 27 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 15,
        }));

        mockTargetEffects([{ target: 'Goblin', effect: 'next_attack_bonus', value: 'invalid' }]);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 22 });
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(defaultDeps.logEntry).toHaveBeenLastCalledWith(expect.objectContaining({
            bonus: 10,
        }));
    });

    it('is inert when the effect is on the attacker instead of the target', async () => {
        mockTargetEffects([{ target: 'TestFighter', effect: 'next_attack_bonus', value: '10' }]);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 5,
        }));
    });

    it('is inert for non-attack roll types', async () => {
        mockTargetEffects([{ target: 'Goblin', effect: 'next_attack_bonus', value: '10' }]);
        const fn = createFn();
        await fn('Athletics', 3, 'check', {});

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 3,
        }));
    });
});

describe('createLogAndShow - Bane Attack Penalty', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
    });

    it('applies -1d4 penalty when bane_penalty effect is on attacker during attack', async () => {
        mockTargetEffects([{ target: 'TestFighter', effect: 'bane_penalty' }]);
        rollExpression.mockReturnValue({ total: 2, rolls: [2], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(rollExpression).toHaveBeenCalledWith('1d4');
        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonusDetail: expect.stringContaining('Bane'),
        }));
    });

    it('applies bane penalty when target self-applies blade ward effect', async () => {
        mockTargetEffects([{ target: 'Goblin', effect: 'bane_penalty', source: 'Goblin' }]);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(rollExpression).toHaveBeenCalledWith('1d4');
    });

    it('does not apply bane for non-attack roll types', async () => {
        mockTargetEffects([{ target: 'TestFighter', effect: 'bane_penalty' }]);
        const fn = createFn();
        await fn('Athletics', 3, 'check', {});

        expect(rollExpression).not.toHaveBeenCalledWith('1d4');
    });
});

describe('createLogAndShow - Bless Attack Bonus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
    });

    it('adds 1d4 bonus when bless_bonus effect is on attacker during attack', async () => {
        mockTargetEffects([{ target: 'TestFighter', effect: 'bless_bonus' }]);
        rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 24 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(rollExpression).toHaveBeenCalledWith('1d4');
        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonusDetail: expect.stringContaining('Bless'),
        }));
    });

    it('does not apply bless for non-attack roll types', async () => {
        mockTargetEffects([{ target: 'TestFighter', effect: 'bless_bonus' }]);
        const fn = createFn();
        await fn('Athletics', 3, 'check', {});

        expect(rollExpression).not.toHaveBeenCalledWith('1d4');
    });
});

describe('createLogAndShow - Lucky feat advantage/disadvantage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
    });

    it('applies disadvantage and clears the flag when target has luckyDisadvantageActive', async () => {
        mockRuntimeValue({
            'Goblin:luckyDisadvantageActive': true,
        });
        rollD20.mockReturnValueOnce(9).mockReturnValueOnce(3);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'luckyDisadvantageActive', null, 'test-campaign');
        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'disadvantage',
            total: 3,
        }));
    });

    it('applies advantage and clears the flag when target has luckyAdvantageActive', async () => {
        mockRuntimeValue({
            'Goblin:luckyAdvantageActive': true,
        });
        rollD20.mockReturnValueOnce(3).mockReturnValueOnce(9);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'luckyAdvantageActive', null, 'test-campaign');
        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'advantage',
            total: 9,
        }));
    });

    it('does not consume lucky feat when forcedMode is already set', async () => {
        mockRuntimeValue({
            'Goblin:luckyDisadvantageActive': true,
        });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin', forcedMode: 'disadvantage' });

        expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'luckyDisadvantageActive', null, 'test-campaign');
    });
});

describe('createLogAndShow - Sacred Weapon bonus detail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
    });

    it('includes sacred weapon bonus in bonusDetail', async () => {
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', {
            targetName: 'Goblin',
            sacredWeaponBonus: 4,
        });

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonusDetail: expect.stringContaining('Sacred Weapon'),
        }));
    });
});

describe('createLogAndShow - Maneuver loading for non-attack rolls', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
        getManeuversForRules.mockResolvedValue(undefined);
    });

    it('preloads 2024 maneuvers for check, skill, and initiative rolls', async () => {
        noTarget();
        const fn = createFn();
        await fn('Athletics', 3, 'skill', {});
        await fn('Athletics', 3, 'check', {});
        await fn('Initiative', 3, 'initiative', {});

        expect(getManeuversForRules).toHaveBeenCalledWith('2024');
    });

    it('does not load maneuvers for attack roll type', async () => {
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(getManeuversForRules).not.toHaveBeenCalled();
    });
});

describe('createLogAndShow - Bardic Inspiration Defense context', () => {
    const wizardDeps = {
        ...defaultDeps,
        characterName: 'TestWizard',
        campaignName: 'test-campaign',
        characters: [{ name: 'Bard', computedStats: { armorClass: 14, evasionEffects: [] } }],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
        getTargetFromAttacker.mockReturnValue({ name: 'Bard', ac: 14 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Bard', type: 'player', ac: 14 }] });
    });

    function mockBardicInspiration(hasDefense, dieSize, uses) {
        hasBardicInspirationDefense.mockReturnValue(hasDefense);
        getBardicInspirationDieSize.mockReturnValue(dieSize);
        getRuntimeValue.mockImplementation((name, prop, _campaign) => {
            if (name === 'Bard' && prop === 'bardicInspirationUses') return uses;
            return null;
        });
    }

    function attackContext() {
        return {
            targetName: 'Bard',
            playerStats: { automation: { features: [{ type: 'bardic_inspiration_offense' }] } },
        };
    }

    it('sets bardicInspirationDefense context flags when attack hits and target has defense — without auto-prompting', async () => {
        mockBardicInspiration(true, 'd6', 3);
        const context = attackContext();
        const fn = createLogAndShow(wizardDeps);
        await fn('Fire Bolt', 3, 'attack', context);

        expect(context.bardicInspirationDefense).toBe(true);
        expect(context.bardicInspirationDefenseDieSize).toBe('d6');
        expect(context.bardicInspirationDefenseTargetName).toBe('Bard');
        // Defense is actively selected by the player from their character
        // sheet — the seam must never auto-prompt (a prompt writes 'biPrompt').
        expect(setRuntimeValue.mock.calls.filter((call) => call[1] === 'biPrompt')).toHaveLength(0);
    });

    it('does not set bardicInspirationDefense when attack misses', async () => {
        mockBardicInspiration(true, 'd6', 3);
        getTargetFromAttacker.mockReturnValue({ name: 'Bard', ac: 25 });
        const context = attackContext();
        const fn = createLogAndShow(wizardDeps);
        await fn('Fire Bolt', 3, 'attack', context);

        expect(context.bardicInspirationDefense).toBe(undefined);
    });

    it('sets bardicInspirationDefense to false when target has no defense feature', async () => {
        mockBardicInspiration(false, null, 0);
        const context = {
            targetName: 'Bard',
            playerStats: { automation: { features: [] } },
        };
        const fn = createLogAndShow(wizardDeps);
        await fn('Fire Bolt', 3, 'attack', context);

        expect(context.bardicInspirationDefense).toBe(false);
    });
});

describe('createLogAndShow - Pending Skill Check Bonus (Ambush maneuver)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
        noTarget();
    });

    it('applies and consumes pendingSkillCheckBonus on skill, ability check, and initiative rolls', async () => {
        const fn = createFn();
        const cases = [
            ['Stealth', 2, 'skill', 4],
            ['Athletics', 5, 'check', 3],
            ['Initiative', 3, 'initiative', 5],
        ];
        for (const [name, bonus, rollType, pending] of cases) {
            mockRuntimeValue({ 'TestFighter:pendingSkillCheckBonus': pending });
            await fn(name, bonus, rollType, {});

            expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                rollType,
                bonus: bonus + pending,
                bonusDetail: expect.stringContaining('Pending Skill Check'),
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', null, 'test-campaign', true);
        }
    });

    it('does NOT apply pendingSkillCheckBonus to attack or save rolls', async () => {
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        mockRuntimeValue({ 'TestFighter:pendingSkillCheckBonus': 4 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
        await fn('DEX', 3, 'save', {});

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            rollType: 'attack',
            bonus: 5,
        }));
        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            rollType: 'save',
            bonus: 3,
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', null, 'test-campaign', true);
    });

    it('is inert when pendingSkillCheckBonus is 0 or unset', async () => {
        const fn = createFn();
        mockRuntimeValue({ 'TestFighter:pendingSkillCheckBonus': 0 });
        await fn('Stealth', 2, 'skill', {});
        mockRuntimeValue({});
        await fn('Stealth', 2, 'skill', {});

        expect(defaultDeps.logEntry).toHaveBeenCalledTimes(2);
        for (const [entry] of defaultDeps.logEntry.mock.calls) {
            expect(entry.bonus).toBe(2);
            expect(entry.bonusDetail || '').not.toContain('Pending Skill Check');
        }
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', null, 'test-campaign', true);
    });
});
