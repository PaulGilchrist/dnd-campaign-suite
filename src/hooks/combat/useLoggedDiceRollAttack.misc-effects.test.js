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
    getCombatSummary: vi.fn(),
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
import { getTargetFromAttacker, findCreatureByName } from '../../services/rules/combat/damageUtils.js';
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

    it('parses custom sundering blow value from effect', async () => {
        mockTargetEffects([{ target: 'Goblin', effect: 'next_attack_bonus', value: '10' }]);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 27 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 15,
        }));
    });

    it('uses default 5 when effect value is not a valid number', async () => {
        mockTargetEffects([{ target: 'Goblin', effect: 'next_attack_bonus', value: 'invalid' }]);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 22 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 10,
        }));
    });

    it('does not apply sundering blow when effect is on attacker instead of target', async () => {
        mockTargetEffects([{ target: 'TestFighter', effect: 'next_attack_bonus', value: '10' }]);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 5,
        }));
    });

    it('does not apply sundering blow for non-attack roll types', async () => {
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

describe('createLogAndShow - Bonus detail composition', () => {
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

    it('includes cosmic omen weal bonus in bonusDetail', async () => {
        mockRuntimeValue({
            'cosmicOmen:cosmicOmenPendingBonus': JSON.stringify({ type: 'Weal', value: 2 }),
        });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonusDetail: expect.stringContaining('Weal'),
        }));
    });

    it('includes bane penalty in bonusDetail', async () => {
        mockTargetEffects([{ target: 'TestFighter', effect: 'bane_penalty' }]);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonusDetail: expect.stringContaining('Bane'),
        }));
    });

    it('includes bless bonus in bonusDetail', async () => {
        mockTargetEffects([{ target: 'TestFighter', effect: 'bless_bonus' }]);
        rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonusDetail: expect.stringContaining('Bless'),
        }));
    });
});

describe('createLogAndShow - Ray of Enfeeblement STR disadvantage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
        getTargetFromAttacker.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [] });
    });

    it('applies disadvantage for STR ability checks when ray_of_enfeeble_debuff is active', async () => {
        mockTargetEffects([
            { target: 'TestFighter', effect: 'ray_of_enfeeble_debuff', strCheckDisadvantage: true },
        ]);
        rollD20.mockReturnValueOnce(9).mockReturnValueOnce(3);
        const fn = createFn();
        await fn('Athletics', 3, 'skill', {});

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            mode: 'disadvantage',
            total: 3,
        }));
    });

    it('applies disadvantage for Strength ability checks by name', async () => {
        mockTargetEffects([
            { target: 'TestFighter', effect: 'ray_of_enfeeble_debuff', strCheckDisadvantage: true },
        ]);
        rollD20.mockReturnValueOnce(9).mockReturnValueOnce(3);
        const fn = createFn();
        await fn('Strength', 3, 'check', {});

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            total: 3,
        }));
    });

    it('does not apply disadvantage for non-STR skills', async () => {
        mockTargetEffects([
            { target: 'TestFighter', effect: 'ray_of_enfeeble_debuff', strCheckDisadvantage: true },
        ]);
        rollD20.mockReturnValueOnce(15);
        const fn = createFn();
        await fn('Stealth', 3, 'skill', {});

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            total: 15,
        }));
    });
});

describe('createLogAndShow - Maneuver loading for non-attack rolls', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
        getTargetFromAttacker.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [] });
        getManeuversForRules.mockResolvedValue(undefined);
    });

    it('loads maneuvers for skill roll type', async () => {
        const fn = createFn();
        await fn('Athletics', 3, 'skill', {});
        expect(getManeuversForRules).toHaveBeenCalledWith('2024');
    });

    it('loads maneuvers for check roll type', async () => {
        const fn = createFn();
        await fn('Athletics', 3, 'check', {});
        expect(getManeuversForRules).toHaveBeenCalledWith('2024');
    });

    it('loads maneuvers for initiative roll type', async () => {
        const fn = createFn();
        await fn('Initiative', 3, 'initiative', {});
        expect(getManeuversForRules).toHaveBeenCalledWith('2024');
    });

    it('does not load maneuvers for attack roll type', async () => {
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
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

    it('sets bardicInspirationDefense context flags when attack hits and target has defense', async () => {
        mockBardicInspiration(true, 'd6', 3);
        const context = {
            targetName: 'Bard',
            playerStats: { automation: { features: [{ type: 'bardic_inspiration_offense' }] } },
        };
        const fn = createLogAndShow(wizardDeps);
        await fn('Fire Bolt', 3, 'attack', context);

        expect(context.bardicInspirationDefense).toBe(true);
        expect(context.bardicInspirationDefenseDieSize).toBe('d6');
        expect(context.bardicInspirationDefenseTargetName).toBe('Bard');
    });

    it('does not set bardicInspirationDefense when attack misses', async () => {
        mockBardicInspiration(true, 'd6', 3);
        getTargetFromAttacker.mockReturnValue({ name: 'Bard', ac: 25 });
        const context = {
            targetName: 'Bard',
            playerStats: { automation: { features: [{ type: 'bardic_inspiration_offense' }] } },
        };
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

    it('does NOT send a defense prompt — player must actively select the reaction from character sheet', async () => {
        mockBardicInspiration(true, 'd6', 3);
        getTargetFromAttacker.mockReturnValue({ name: 'Bard', ac: 14 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Bard', type: 'player', ac: 14 }] });
        const context = {
            targetName: 'Bard',
            playerStats: { automation: { features: [{ type: 'bardic_inspiration_offense' }] } },
        };
        const fn = createLogAndShow(wizardDeps);
        await fn('Fire Bolt', 3, 'attack', context);

        // Defense feature sets context flags (verified above) but must NOT call sendBardicInspirationDefensePrompt.
        // The player actively selects the Bardic Inspiration reaction from their character sheet, not an auto-prompt.
        // sendBardicInspirationDefensePrompt sets runtime value 'biPrompt' — this must not happen.
        const biPromptCalls = setRuntimeValue.mock.calls.filter((call) => call[1] === 'biPrompt');
        expect(biPromptCalls).toHaveLength(0);
    });
});

describe('createLogAndShow - Explicit target resolution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
    });

    it('uses findCreatureByName when explicitTargetName is provided and creature exists', async () => {
        const creature = { name: 'Orc', ac: 15, type: 'npc' };
        findCreatureByName.mockReturnValue(creature);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Orc' });

        expect(findCreatureByName).toHaveBeenCalled();
        expect(defaultDeps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            targetAc: 15,
        }));
    });

    it('falls back to getTargetFromAttacker when findCreatureByName returns null', async () => {
        findCreatureByName.mockReturnValue(null);
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Orc' });

        expect(getTargetFromAttacker).toHaveBeenCalled();
    });
});

describe('createLogAndShow - Pending Skill Check Bonus (Ambush maneuver)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
    });

    it('applies pendingSkillCheckBonus to skill check total and bonus', async () => {
        mockRuntimeValue({
            'TestFighter:pendingSkillCheckBonus': 4,
        });
        getTargetFromAttacker.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [] });
        const fn = createFn();
        await fn('Stealth', 2, 'skill', {});

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 6,
            bonusDetail: expect.stringContaining('Pending Skill Check'),
        }));
        expect(defaultDeps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 6,
            bonusDetail: expect.stringContaining('Pending Skill Check'),
        }));
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', null, 'test-campaign', true);
    });

    it('applies pendingSkillCheckBonus to ability check', async () => {
        mockRuntimeValue({
            'TestFighter:pendingSkillCheckBonus': 3,
        });
        getTargetFromAttacker.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [] });
        const fn = createFn();
        await fn('Athletics', 5, 'check', {});

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 8,
        }));
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', null, 'test-campaign', true);
    });

    it('applies pendingSkillCheckBonus to initiative roll', async () => {
        mockRuntimeValue({
            'TestFighter:pendingSkillCheckBonus': 5,
        });
        getTargetFromAttacker.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [] });
        const fn = createFn();
        await fn('Initiative', 3, 'initiative', {});

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 8,
            bonusDetail: expect.stringContaining('Pending Skill Check'),
        }));
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', null, 'test-campaign', true);
    });

    it('does NOT apply pendingSkillCheckBonus to attack rolls', async () => {
        mockRuntimeValue({
            'TestFighter:pendingSkillCheckBonus': 4,
        });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 22 });
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 5,
        }));
        expect(defaultDeps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({
            bonusDetail: expect.stringContaining('Pending Skill Check'),
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', null, 'test-campaign', true);
    });

    it('does NOT apply pendingSkillCheckBonus to save rolls', async () => {
        mockRuntimeValue({
            'TestFighter:pendingSkillCheckBonus': 4,
        });
        getTargetFromAttacker.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [] });
        const fn = createFn();
        await fn('DEX', 3, 'save', {});

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 3,
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', null, 'test-campaign', true);
    });

    it('does nothing when pendingSkillCheckBonus is 0', async () => {
        mockRuntimeValue({
            'TestFighter:pendingSkillCheckBonus': 0,
        });
        getTargetFromAttacker.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [] });
        const fn = createFn();
        await fn('Stealth', 2, 'skill', {});

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 2,
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', null, 'test-campaign', true);
    });

    it('does nothing when pendingSkillCheckBonus is null', async () => {
        getTargetFromAttacker.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [] });
        const fn = createFn();
        await fn('Stealth', 2, 'skill', {});

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            bonus: 2,
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', null, 'test-campaign', true);
    });
});
