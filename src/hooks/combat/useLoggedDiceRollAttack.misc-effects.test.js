// @maintained-by-ai 2026-11-26
// Ownerless minor effects at the createLogAndShow roll seam: Sundering Blow,
// target-SELF-applied bane branch, Bless attack fold, target-side + attacker-side
// Lucky feat consumption, Sacred Weapon labelling, maneuver preload, Bardic
// Inspiration defense context, Pending Skill Check (Ambush).
// Deferred to stronger owners (family map): ray-of-enfeeblement STR
// disadvantage (d20RollComputation.weakening-breath.test.js), cosmic omen fold
// (cosmicOmenHandler.pending-store.test.js), explicit target resolution +
// log/popup essentials (useLoggedDiceRollAttack.test.js), Halfling Lucky reroll
// and its dice law (d20RollComputation.test.js), attacker-side bane fold BYTES
// incl. the attack-only check gate (d20RollComputation.subtract-die.test.js
// #937 — seam-level bane re-shadow and the bane-on-check falsifier removed
// 2026-11-26; only the target-self-applied branch survives here), Lucky-flip
// 2d20 pool SHAPE (useLoggedDiceRollAttack.ledger-dice.test.js — §82 dice-law
// authority; this lane pins only flag consumption + row mode/total).

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
    hasBardicInspirationOffense,
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

function mockGoblinTarget(ac = 12) {
    getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac });
    loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac }] });
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

describe('createLogAndShow - Sundering Blow (target-side next_attack_bonus)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
    });

    it('folds the bonus into the log row and popup: default +5, parsed custom value, unparseable falls back to +5', async () => {
        mockTargetEffects([{ target: 'Goblin', effect: 'next_attack_bonus', value: '5' }]);
        mockGoblinTarget(22);
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

        mockTargetEffects([{ target: 'Goblin', effect: 'next_attack_bonus', value: '10' }]);
        mockGoblinTarget(27);
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
        expect(defaultDeps.logEntry).toHaveBeenLastCalledWith(expect.objectContaining({
            bonus: 15,
        }));

        mockTargetEffects([{ target: 'Goblin', effect: 'next_attack_bonus', value: 'invalid' }]);
        mockGoblinTarget(22);
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
        expect(defaultDeps.logEntry).toHaveBeenLastCalledWith(expect.objectContaining({
            bonus: 10,
        }));
    });

    it('is inert when the effect sits on the attacker, and on non-attack roll types', async () => {
        mockTargetEffects([{ target: 'TestFighter', effect: 'next_attack_bonus', value: '10' }]);
        mockGoblinTarget(12);
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(defaultDeps.logEntry).toHaveBeenLastCalledWith(expect.objectContaining({
            bonus: 5,
            bonusDetail: expect.not.stringContaining('Sundering Blow'),
        }));

        mockTargetEffects([{ target: 'Goblin', effect: 'next_attack_bonus', value: '10' }]);
        await fn('Athletics', 3, 'check', {});
        expect(defaultDeps.logEntry).toHaveBeenLastCalledWith(expect.objectContaining({
            bonus: 3,
            bonusDetail: expect.not.stringContaining('Sundering Blow'),
        }));
    });
});

describe('createLogAndShow - target-self-applied bane branch', () => {
    // Attacker-side bane fold bytes and the attack-only gate are owned by
    // d20RollComputation.subtract-die.test.js (#937). Only the d20RollComputation
    // :80 branch (te.target === targetName && te.source === targetName, e.g.
    // Blade Ward self-cast) is exercised here at the caller seam.
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
    });

    it('rolls the -1d4 and folds the penalty when the target self-applied bane_penalty', async () => {
        mockTargetEffects([{ target: 'Goblin', effect: 'bane_penalty', source: 'Goblin' }]);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0 });
        mockGoblinTarget(20);
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(rollExpression).toHaveBeenCalledWith('1d4');
        expect(defaultDeps.logEntry).toHaveBeenLastCalledWith(expect.objectContaining({
            bonus: 2,
            bonusDetail: expect.stringContaining('Bane'),
        }));
    });
});

describe('createLogAndShow - Bless attack bonus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
    });

    it('rolls the 1d4 and folds it into attack rows only — never on checks', async () => {
        mockTargetEffects([{ target: 'TestFighter', effect: 'bless_bonus' }]);
        rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0 });
        mockGoblinTarget(24);
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(rollExpression).toHaveBeenCalledWith('1d4');
        expect(defaultDeps.logEntry).toHaveBeenLastCalledWith(expect.objectContaining({
            bonus: 9,
            bonusDetail: expect.stringContaining('Bless'),
        }));

        rollExpression.mockClear();
        await fn('Athletics', 3, 'check', {});
        expect(rollExpression).not.toHaveBeenCalledWith('1d4');
    });
});

describe('createLogAndShow - Lucky feat consumption', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
    });

    it.each([
        { flag: 'luckyDisadvantageActive', mode: 'disadvantage', rolls: [9, 3], total: 3 },
        { flag: 'luckyAdvantageActive', mode: 'advantage', rolls: [3, 9], total: 9 },
    ])('consumes the target $flag flag and lands the row under $mode', async ({ flag, mode, rolls, total }) => {
        mockRuntimeValue({ [`Goblin:${flag}`]: true });
        rollD20.mockReturnValueOnce(rolls[0]).mockReturnValueOnce(rolls[1]);
        mockGoblinTarget(12);
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', flag, null, 'test-campaign');
        expect(defaultDeps.logEntry).toHaveBeenLastCalledWith(expect.objectContaining({
            mode,
            total,
        }));
    });

    it('does not consume the target flag when forcedMode is already set', async () => {
        mockRuntimeValue({ 'Goblin:luckyDisadvantageActive': true });
        mockGoblinTarget(12);
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin', forcedMode: 'disadvantage' });

        expect(setRuntimeValue).not.toHaveBeenCalledWith('Goblin', 'luckyDisadvantageActive', null, 'test-campaign');
    });

    it('consumes the attacker-side luckyAdvantageActive flag once the popup is shown', async () => {
        // Lucky Point (luckyPointHandler.js) arms the roller's own flag; the
        // caller seam disarms it after the popup renders (line 607 lane —
        // no other lane in the family covers this consumption).
        mockRuntimeValue({ 'TestFighter:luckyAdvantageActive': true });
        mockGoblinTarget(12);
        const fn = createFn();
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });

        expect(defaultDeps.setPopupHtml).toHaveBeenCalled();
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'luckyAdvantageActive', null, 'test-campaign');
    });
});

describe('createLogAndShow - Sacred Weapon bonus detail', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
    });

    it('labels the passed-through sacredWeaponBonus as +N Sacred Weapon in bonusDetail', async () => {
        mockGoblinTarget(12);
        const fn = createFn();
        await fn('Longsword', 5, 'attack', {
            targetName: 'Goblin',
            sacredWeaponBonus: 4,
        });

        expect(defaultDeps.logEntry).toHaveBeenLastCalledWith(expect.objectContaining({
            bonusDetail: expect.stringContaining('+4 Sacred Weapon'),
        }));
    });
});

describe('createLogAndShow - Maneuver preload by roll type', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDefaultMocks();
        getManeuversForRules.mockResolvedValue(undefined);
    });

    it('preloads 2024 maneuvers on check/skill/initiative rolls only, never on attacks', async () => {
        noTarget();
        const fn = createFn();
        await fn('Athletics', 3, 'skill', {});
        await fn('Athletics', 3, 'check', {});
        await fn('Initiative', 3, 'initiative', {});

        expect(getManeuversForRules).toHaveBeenCalledWith('2024');

        getManeuversForRules.mockClear();
        mockGoblinTarget(12);
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
        // ARG-SHAPE caller pin (bug-bi-offense-modal-rider-gate-arg-shape): the
        // offense gate must be consulted with the FULL playerStats object, never
        // the name string — the deleted modal rider's string arg read .name off a
        // string, missed every runtime lookup, and silenced the whole offer lane.
        expect(hasBardicInspirationOffense).toHaveBeenCalledWith(context.playerStats, 'test-campaign');
        // Defense is actively selected by the player from their character
        // sheet — the seam must never auto-prompt (the '<name>-biPrompt'
        // campaign-store key lane was deleted 2026-11-18 with the dead
        // modal rider — popup-inline is the single BI adjudication lane).
        expect(setRuntimeValue.mock.calls.filter((call) => typeof call[1] === 'string' && (call[1] === 'biPrompt' || call[1].endsWith('-biPrompt')))).toHaveLength(0);
    });

    it('leaves the defense keys unset when the attack misses (distinct from hit-without-feature => false)', async () => {
        mockBardicInspiration(true, 'd6', 3);
        getTargetFromAttacker.mockReturnValue({ name: 'Bard', ac: 25 });
        const context = attackContext();
        const fn = createLogAndShow(wizardDeps);
        await fn('Fire Bolt', 3, 'attack', context);

        expect(context.bardicInspirationDefense).toBe(undefined);
    });

    it('sets bardicInspirationDefense to false when the hit target has no defense feature', async () => {
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
    });

    it('applies and consumes pendingSkillCheckBonus on skill, ability check, and initiative rolls', async () => {
        noTarget();
        const fn = createFn();
        const cases = [
            ['Stealth', 2, 'skill', 4],
            ['Athletics', 5, 'check', 3],
            ['Initiative', 3, 'initiative', 5],
        ];
        for (const [name, bonus, rollType, pending] of cases) {
            mockRuntimeValue({ 'TestFighter:pendingSkillCheckBonus': pending });
            await fn(name, bonus, rollType, {});

            expect(defaultDeps.logEntry).toHaveBeenLastCalledWith(expect.objectContaining({
                rollType,
                bonus: bonus + pending,
                bonusDetail: expect.stringContaining('Pending Skill Check'),
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', null, 'test-campaign', true);
        }
    });

    it('is inert on attack/save roll types and on zero or unset values', async () => {
        const fn = createFn();
        mockGoblinTarget(12);
        mockRuntimeValue({ 'TestFighter:pendingSkillCheckBonus': 4 });
        await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
        await fn('DEX', 3, 'save', {});
        mockRuntimeValue({ 'TestFighter:pendingSkillCheckBonus': 0 });
        await fn('Stealth', 2, 'skill', {});
        mockRuntimeValue({});
        await fn('Stealth', 2, 'skill', {});

        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ rollType: 'attack', bonus: 5 }));
        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ rollType: 'save', bonus: 3 }));
        expect(defaultDeps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ rollType: 'skill', bonus: 2 }));
        for (const entry of defaultDeps.logEntry.mock.calls.map(([e]) => e)) {
            expect(entry.bonusDetail || '').not.toContain('Pending Skill Check');
        }
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', null, 'test-campaign', true);
    });
});
