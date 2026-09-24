import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionDoubled: vi.fn(),
    formatDamageFormula: vi.fn((formula) => formula),
}));

vi.mock('../../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatSummary: vi.fn(),
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    playerIsImmuneToCondition: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('../../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../services/rules/combat/aoeService.js', () => ({
    getAffectedCreatures: vi.fn(),
    processAoeNpcs: vi.fn(),
    sendAoePlayerSaves: vi.fn(),
}));

vi.mock('../loggedDiceRollUtils.js', () => ({
    readAoeContext: vi.fn(),
    hasPotentCantrip: vi.fn(),
    isMagicMissileImmune: vi.fn(),
    hasSoulstitchProtection: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterSave: vi.fn((total, success, _dcSuccess) => success ? Math.floor(total / 2) : total),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn(),
    getActiveTargetEffect: vi.fn(() => null),
    getEffectDefinition: vi.fn((key) => ({ effect: key, label: 'Can\'t Regain Hit Points', group: 'Defensive' })),
}));

vi.mock('../../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationOffense: vi.fn(),
    getBardicInspirationDieSize: vi.fn(),
    getBardicInspirationDieSizeFromClass: vi.fn(),
}));

vi.mock('../../rules/spells/empoweredSpellService.js', () => ({
    hasEmpoweredSpell: vi.fn(),
}));

vi.mock('../../rules/spells/metamagicRules.js', () => ({
    getChaModifier: vi.fn(),
}));

import { rollExpression } from '../../../services/dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';
import { buildHitConditionClause } from '../../../components/encounter/MonsterCardHelpers.js';
import { registerTargetEffect, getEffectDefinition } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import { computeConditionEffects, combineAttackModes } from '../../../services/combat/conditions/conditionEffects.js';
import monsters from '../../../../public/data/monsters.json';

const TENTACLE_LASH_ACTION = {
    name: 'Tentacle Lash',
    attack_bonus: 7,
    hit_conditions: ['grappled', 'restrained'],
    escape_dc: 14,
};

describe('MA-0010 buildHitConditionClause', () => {
    it('builds the clause from hit_conditions + escape_dc metadata', () => {
        expect(buildHitConditionClause(TENTACLE_LASH_ACTION)).toEqual({
            conditions: ['grappled', 'restrained'],
            escapeDc: 14,
            attackName: 'Tentacle Lash',
            targetEffect: null,
        });
    });

    it('returns null for actions without hit_conditions', () => {
        expect(buildHitConditionClause({ name: 'Mind Rot', attack_bonus: 7 })).toBeNull();
        expect(buildHitConditionClause(undefined)).toBeNull();
        expect(buildHitConditionClause({ name: 'X', hit_conditions: [] })).toBeNull();
    });
});

describe('MA-0010 hit-clause condition application on monster attack damage', () => {
    const deps = {
        characterName: 'Aberrant Cultist 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Aberrant Cultist 1', computedStats: { armorClass: 15 } },
            { name: 'FeyRanger', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 22, newHp: 67, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'FeyRanger', type: 'player', ac: 12, currentHp: 89, maxHp: 89 }],
        });
    });

    function hitContext(extra = {}) {
        return {
            targetName: 'FeyRanger',
            damageType: 'Slashing',
            attackerName: 'Aberrant Cultist 1',
            hitClause: buildHitConditionClause(TENTACLE_LASH_ACTION),
            ...extra,
        };
    }

    it('applies Grappled + Restrained to the target on a resolved hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Tentacle Lash', formula: '1d6 + 4', total: 8, rolls: [4], modifier: 4, context: hitContext() });

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'FeyRanger',
            'activeConditions',
            expect.arrayContaining(['grappled', 'restrained']),
            'test-campaign'
        );
    });

    it('records escape DC 14 (STR) in activeConditionMeta for the escape badge', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Tentacle Lash', formula: '1d6 + 4', total: 8, rolls: [4], modifier: 4, context: hitContext() });

        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({
            grappled: { dc: 14, ability: 'str' },
            restrained: { dc: 14, ability: 'str' },
        });
    });

    it('MA-0019: stamps the attacking monster into meta source for by-attacker prerequisites', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Tentacle Lash', formula: '1d6 + 4', total: 8, rolls: [4], modifier: 4, context: hitContext() });

        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall[2].grappled.source).toBe('Aberrant Cultist 1');
        expect(metaCall[2].restrained.source).toBe('Aberrant Cultist 1');
    });

    it('logs a condition-applied entry naming the action and escape DC', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Tentacle Lash', formula: '1d6 + 4', total: 8, rolls: [4], modifier: 4, context: hitContext() });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'FeyRanger',
            condition: 'Grappled, Restrained',
            reason: 'Tentacle Lash (escape DC 14)',
        }));
    });

    it('does not duplicate conditions already active on the target', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'FeyRanger' && prop === 'activeConditions') return ['grappled'];
            return null;
        });
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Tentacle Lash', formula: '1d6 + 4', total: 8, rolls: [4], modifier: 4, context: hitContext() });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall[2].filter(c => String(c).toLowerCase() === 'grappled')).toHaveLength(1);
        expect(condCall[2]).toContain('restrained');
    });

    it('writes nothing when the clause is absent (plain attack / miss flow)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({
            name: 'Tentacle Lash', formula: '1d6 + 4', total: 8, rolls: [4], modifier: 4,
            context: { targetName: 'FeyRanger', damageType: 'Slashing', attackerName: 'Aberrant Cultist 1' },
        });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'FeyRanger', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'FeyRanger', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });

    it('skips the clause for Huge or larger targets', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'FeyRanger', type: 'player', size: 'Huge', ac: 12, currentHp: 89, maxHp: 89 }],
        });
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Tentacle Lash', formula: '1d6 + 4', total: 8, rolls: [4], modifier: 4, context: hitContext() });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'FeyRanger', 'activeConditions', expect.anything(), 'test-campaign'
        );
    });
});

const SLAAD_CLAW_ACTION = {
    name: 'Claw',
    attack_bonus: null,
    reach: '5 ft.',
    damage_dice_primary: '1d10+3+spell level',
    damage_type_primary: 'Slashing',
    hit_target_effect: 'no_healing',
};

describe('MA-0016 Aberrant Spirit (Slaad) Claw no_healing producer', () => {
    const deps = {
        characterName: 'Aberrant Spirit (Slaad) 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Aberrant Spirit (Slaad) 1', computedStats: { armorClass: 11 } },
            { name: 'FeyRanger', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 13, newHp: 76, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'FeyRanger', type: 'player', ac: 12, currentHp: 89, maxHp: 89 }],
        });
    });

    function clawContext() {
        return {
            targetName: 'FeyRanger',
            damageType: 'Slashing',
            attackerName: 'Aberrant Spirit (Slaad) 1',
            hitClause: buildHitConditionClause(SLAAD_CLAW_ACTION),
        };
    }

    it('builds a targetEffect-only clause (no conditions) from hit_target_effect', () => {
        expect(buildHitConditionClause(SLAAD_CLAW_ACTION)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Claw',
            targetEffect: 'no_healing',
        });
    });

    it('registers the no_healing te on the target, sourced from the spirit, on a resolved hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Claw', formula: '1d10+3', total: 13, rolls: [10], modifier: 3, context: clawContext() });

        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'FeyRanger',
            'no_healing',
            'Aberrant Spirit (Slaad) 1',
            { duration: 'until_start_of_next_turn' }
        );
    });

    it('expires the te anchored on the spirit (until its next turn start)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Claw', formula: '1d10+3', total: 13, rolls: [10], modifier: 3, context: clawContext() });

        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Aberrant Spirit (Slaad) 1',
            targetName: 'FeyRanger',
            effects: [{ type: 'remove_target_effect', effectKey: 'no_healing', source: 'Aberrant Spirit (Slaad) 1', target: 'FeyRanger' }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'Aberrant Spirit (Slaad) 1',
        });
    });

    it('logs a condition-applied entry naming the Claw effect and does NOT write grapple conditions', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Claw', formula: '1d10+3', total: 13, rolls: [10], modifier: 3, context: clawContext() });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'FeyRanger',
            condition: "Can't Regain Hit Points",
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'FeyRanger', 'activeConditions', expect.anything(), 'test-campaign'
        );
    });
});

const ABOLETTE = monsters.find(m => m.index === 'aboleth');
const ABOLETH_TENTACLE_ACTION = ABOLETTE.actions.find(a => a.name === 'Tentacle');

describe('MA-0018 Aboleth Tentacle grapple-on-hit clause', () => {
    const deps = {
        characterName: 'Aboleth 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Aboleth 1', computedStats: { armorClass: 13 } },
            { name: 'AberrantSorcerer', computedStats: { armorClass: 9 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 16, newHp: 25, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'AberrantSorcerer', type: 'player', size: 'Medium', ac: 9, currentHp: 41, maxHp: 41 }],
        });
    });

    it('authors hit_conditions:["grappled"] + escape_dc:14 on the Tentacle row', () => {
        expect(ABOLETH_TENTACLE_ACTION.attack_bonus).toBe(9);
        expect(ABOLETH_TENTACLE_ACTION.damage_dice_primary).toBe('2d6 + 5');
        expect(ABOLETH_TENTACLE_ACTION.hit_conditions).toEqual(['grappled']);
        expect(ABOLETH_TENTACLE_ACTION.escape_dc).toBe(14);
    });

    it('builds a grappled-only clause with escape DC 14', () => {
        expect(buildHitConditionClause(ABOLETH_TENTACLE_ACTION)).toEqual({
            conditions: ['grappled'],
            escapeDc: 14,
            attackName: 'Tentacle',
            targetEffect: null,
        });
    });

    it('applies Grappled + escape-meta + condition log on a resolved Tentacle hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Tentacle', formula: '2d6 + 5', total: 16, rolls: [5, 6], modifier: 5, context: {
            targetName: 'AberrantSorcerer',
            damageType: 'Bludgeoning',
            attackerName: 'Aboleth 1',
            hitClause: buildHitConditionClause(ABOLETH_TENTACLE_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['grappled']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall[2]).toMatchObject({ grappled: { dc: 14, ability: 'str' } });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'AberrantSorcerer',
            condition: 'Grappled',
            reason: 'Tentacle (escape DC 14)',
        }));
    });
});

const ARCH_HAG = monsters.find(m => m.index === 'arch-hag');
const SPECTRAL_CLAW_ACTION = ARCH_HAG.actions.find(a => a.name === 'Spectral Claw');

describe('MA-0302 Arch-hag Spectral Claw prone hit-clause', () => {
    const deps = {
        characterName: 'Arch-hag 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Arch-hag 1', computedStats: { armorClass: 20 } },
            { name: 'ElderPaladin', computedStats: { armorClass: 19 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 17, newHp: 207, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'ElderPaladin', type: 'player', size: 'Medium', ac: 19, currentHp: 224, maxHp: 224 }],
        });
    });

    it('MA-0302 data-lock: authors hit_conditions:["prone"] with no escape_dc on the Spectral Claw row', () => {
        expect(SPECTRAL_CLAW_ACTION.attack_bonus).toBe(14);
        expect(SPECTRAL_CLAW_ACTION.damage_dice_primary).toBe('3d6 + 7');
        expect(SPECTRAL_CLAW_ACTION.damage_type_primary).toBe('Force');
        expect(SPECTRAL_CLAW_ACTION.hit_conditions).toEqual(['prone']);
        expect(SPECTRAL_CLAW_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a prone-only clause with no escape DC', () => {
        expect(buildHitConditionClause(SPECTRAL_CLAW_ACTION)).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Spectral Claw',
            targetEffect: null,
        });
    });

    it('applies Prone + attacker-source meta + condition log on a resolved Spectral Claw hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Spectral Claw', formula: '3d6 + 7', total: 17, rolls: [3, 4, 3], modifier: 7, context: {
            targetName: 'ElderPaladin',
            damageType: 'Force',
            attackerName: 'Arch-hag 1',
            hitClause: buildHitConditionClause(SPECTRAL_CLAW_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['prone']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall[2]).toMatchObject({ prone: { source: 'Arch-hag 1' } });
        expect(metaCall[2].prone.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'ElderPaladin',
            condition: 'Prone',
            reason: 'Spectral Claw (escape DC —)',
        }));
    });

    it('writes no condition when the Spectral Claw attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Spectral Claw', formula: '3d6 + 7', total: 17, rolls: [3, 4, 3], modifier: 7, context: {
            targetName: 'ElderPaladin',
            damageType: 'Force',
            attackerName: 'Arch-hag 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'ElderPaladin', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'ElderPaladin', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const RUG = monsters.find(m => m.index === 'animated-rug-of-smothering');
const SMOTHER_ACTION = RUG.actions[0];

describe('MA-0287 Animated Rug of Smothering Smother hit-clause', () => {
    const deps = {
        characterName: 'Animated Rug of Smothering 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Animated Rug of Smothering 1', computedStats: { armorClass: 12 } },
            { name: 'LightfootHalfling', computedStats: { armorClass: 14 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 11, newHp: 1, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'LightfootHalfling', type: 'player', size: 'Small', ac: 14, currentHp: 12, maxHp: 12 }],
        });
    });

    it('MA-0287 data-lock: authors hit_conditions:["blinded","grappled","restrained"] + escape_dc:13 on the Smother row', () => {
        expect(SMOTHER_ACTION.name).toBe('Smother');
        expect(SMOTHER_ACTION.attack_bonus).toBe(5);
        expect(SMOTHER_ACTION.damage_dice_primary).toBe('2d6 + 3');
        expect(SMOTHER_ACTION.damage_type_primary).toBe('Bludgeoning');
        expect(SMOTHER_ACTION.hit_conditions).toEqual(['blinded', 'grappled', 'restrained']);
        expect(SMOTHER_ACTION.escape_dc).toBe(13);
    });

    it('builds the full trio clause with escape DC 13', () => {
        expect(buildHitConditionClause(SMOTHER_ACTION)).toEqual({
            conditions: ['blinded', 'grappled', 'restrained'],
            escapeDc: 13,
            attackName: 'Smother',
            targetEffect: null,
        });
    });

    it('applies Blinded+Grappled+Restrained + escape-meta + condition log on a resolved Smother hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Smother', formula: '2d6 + 3', total: 11, rolls: [5, 3], modifier: 3, context: {
            targetName: 'LightfootHalfling',
            damageType: 'Bludgeoning',
            attackerName: 'Animated Rug of Smothering 1',
            hitClause: buildHitConditionClause(SMOTHER_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['blinded', 'grappled', 'restrained']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall[2]).toMatchObject({
            blinded: { dc: 13, ability: 'str', source: 'Animated Rug of Smothering 1' },
            grappled: { dc: 13, ability: 'str', source: 'Animated Rug of Smothering 1' },
            restrained: { dc: 13, ability: 'str', source: 'Animated Rug of Smothering 1' },
        });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'LightfootHalfling',
            condition: 'Blinded, Grappled, Restrained',
            reason: 'Smother (escape DC 13)',
        }));
    });
});

const ANKHEG = monsters.find(m => m.index === 'ankheg');
const ANKHEG_BITE_ACTION = ANKHEG.actions[0];

describe('MA-0288 Ankheg Bite grapple-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Ankheg 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Ankheg 1', computedStats: { armorClass: 14 } },
            { name: 'War_Cleric', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 43, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'War_Cleric', type: 'player', size: 'Medium', ac: 12, currentHp: 53, maxHp: 53 }],
        });
    });

    it('MA-0288 data-lock: authors hit_conditions:["grappled"] + escape_dc:13 on the Bite row', () => {
        expect(ANKHEG_BITE_ACTION.name).toBe('Bite');
        expect(ANKHEG_BITE_ACTION.attack_bonus).toBe(5);
        expect(ANKHEG_BITE_ACTION.damage_dice_primary).toBe('2d6 + 3');
        expect(ANKHEG_BITE_ACTION.damage_type_primary).toBe('Slashing');
        expect(ANKHEG_BITE_ACTION.damage_dice_secondary).toBe('1d6');
        expect(ANKHEG_BITE_ACTION.damage_type_secondary).toBe('Acid');
        expect(ANKHEG_BITE_ACTION.hit_conditions).toEqual(['grappled']);
        expect(ANKHEG_BITE_ACTION.escape_dc).toBe(13);
    });

    it('builds the grappled clause with escape DC 13', () => {
        expect(buildHitConditionClause(ANKHEG_BITE_ACTION)).toEqual({
            conditions: ['grappled'],
            escapeDc: 13,
            attackName: 'Bite',
            targetEffect: null,
        });
    });

    it('applies Grappled + escape-meta + condition log on a resolved Bite hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '2d6 + 3', total: 10, rolls: [4, 3], modifier: 3, context: {
            targetName: 'War_Cleric',
            damageType: 'Slashing',
            attackerName: 'Ankheg 1',
            hitClause: buildHitConditionClause(ANKHEG_BITE_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['grappled']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({
            grappled: { dc: 13, ability: 'str', source: 'Ankheg 1' },
        });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'War_Cleric',
            condition: 'Grappled',
            reason: 'Bite (escape DC 13)',
        }));
    });
});

const BUGBEAR_STALKER = monsters.find(m => m.index === 'bugbear-stalker');
const MORNINGSTAR_ACTION = BUGBEAR_STALKER.actions.find(a => a.name === 'Morningstar');

describe('MA-0442 Bugbear Stalker Morningstar grapple-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Bugbear Stalker 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Bugbear Stalker 1', computedStats: { armorClass: 15 } },
            { name: 'AasimarTest', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 12, newHp: 131, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'AasimarTest', type: 'player', size: 'Medium', ac: 12, currentHp: 143, maxHp: 143 }],
        });
    });

    it('MA-0442 data-lock: authors hit_conditions:["grappled"] + escape_dc:13 on the Morningstar row', () => {
        expect(MORNINGSTAR_ACTION.attack_bonus).toBe(5);
        expect(MORNINGSTAR_ACTION.damage_dice_primary).toBe('2d8 + 3');
        expect(MORNINGSTAR_ACTION.damage_type_primary).toBe('Piercing');
        expect(MORNINGSTAR_ACTION.reach).toBe('10 ft.');
        expect(MORNINGSTAR_ACTION.hit_conditions).toEqual(['grappled']);
        expect(MORNINGSTAR_ACTION.escape_dc).toBe(13);
    });

    it('builds the grappled clause with escape DC 13 (statblock STR 17/+3 + PB 2)', () => {
        expect(BUGBEAR_STALKER.ability_score_modifiers.str).toBe(3);
        expect(BUGBEAR_STALKER.proficiency_bonus).toBe(2);
        expect(buildHitConditionClause(MORNINGSTAR_ACTION)).toEqual({
            conditions: ['grappled'],
            escapeDc: 13,
            attackName: 'Morningstar',
            targetEffect: null,
        });
    });

    it('applies Grappled + escape-meta + condition log on a resolved Morningstar hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Morningstar', formula: '2d8 + 3', total: 12, rolls: [4, 5], modifier: 3, context: {
            targetName: 'AasimarTest',
            damageType: 'Piercing',
            attackerName: 'Bugbear Stalker 1',
            hitClause: buildHitConditionClause(MORNINGSTAR_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['grappled']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({
            grappled: { dc: 13, ability: 'str', source: 'Bugbear Stalker 1' },
        });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'AasimarTest',
            condition: 'Grappled',
            reason: 'Morningstar (escape DC 13)',
        }));
    });
});

const BUGBEAR_WARRIOR = monsters.find(m => m.index === 'bugbear-warrior');
const WARRIOR_GRAB_ACTION = BUGBEAR_WARRIOR.actions[0];

describe('MA-0443 Bugbear Warrior Grab grapple-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Bugbear Warrior 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Bugbear Warrior 1', computedStats: { armorClass: 14 } },
            { name: 'AasimarTest', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 9, newHp: 134, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'AasimarTest', type: 'player', size: 'Medium', ac: 12, currentHp: 143, maxHp: 143 }],
        });
    });

    it('MA-0443 data-lock: authors hit_conditions:["grappled"] + escape_dc:12 on the Grab row', () => {
        expect(WARRIOR_GRAB_ACTION.name).toBe('Grab');
        expect(WARRIOR_GRAB_ACTION.attack_bonus).toBe(4);
        expect(WARRIOR_GRAB_ACTION.reach).toBe('10 ft.');
        expect(WARRIOR_GRAB_ACTION.damage_dice_primary).toBe('2d6 + 2');
        expect(WARRIOR_GRAB_ACTION.damage_type_primary).toBe('Bludgeoning');
        expect(WARRIOR_GRAB_ACTION.hit_conditions).toEqual(['grappled']);
        expect(WARRIOR_GRAB_ACTION.escape_dc).toBe(12);
    });

    it('builds the grappled clause with escape DC 12 (statblock STR 15/+2 + PB 2)', () => {
        expect(BUGBEAR_WARRIOR.ability_score_modifiers.str).toBe(2);
        expect(BUGBEAR_WARRIOR.proficiency_bonus).toBe(2);
        expect(buildHitConditionClause(WARRIOR_GRAB_ACTION)).toEqual({
            conditions: ['grappled'],
            escapeDc: 12,
            attackName: 'Grab',
            targetEffect: null,
        });
    });

    it('applies Grappled + escape-meta + condition log on a resolved Grab hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Grab', formula: '2d6 + 2', total: 9, rolls: [4, 3], modifier: 2, context: {
            targetName: 'AasimarTest',
            damageType: 'Bludgeoning',
            attackerName: 'Bugbear Warrior 1',
            hitClause: buildHitConditionClause(WARRIOR_GRAB_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['grappled']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({
            grappled: { dc: 12, ability: 'str', source: 'Bugbear Warrior 1' },
        });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'AasimarTest',
            condition: 'Grappled',
            reason: 'Grab (escape DC 12)',
        }));
    });

    it('writes no condition when the Grab attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Grab', formula: '2d6 + 2', total: 9, rolls: [4, 3], modifier: 2, context: {
            targetName: 'AasimarTest',
            damageType: 'Bludgeoning',
            attackerName: 'Bugbear Warrior 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'AasimarTest', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'AasimarTest', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const ANKYLOSAURUS = monsters.find(m => m.index === 'ankylosaurus');
const TAIL_ACTION = ANKYLOSAURUS.actions.find(a => a.name === 'Tail');

describe('MA-0291 Ankylosaurus Tail prone-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Ankylosaurus 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Ankylosaurus 1', computedStats: { armorClass: 15 } },
            { name: 'ElderPaladin', computedStats: { armorClass: 19 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 9, newHp: 215, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'ElderPaladin', type: 'player', size: 'Medium', ac: 19, currentHp: 224, maxHp: 224 }],
        });
    });

    it('MA-0291 data-lock: authors hit_conditions:["prone"] with no escape_dc on the Tail row', () => {
        expect(TAIL_ACTION.attack_bonus).toBe(6);
        expect(TAIL_ACTION.reach).toBe('10 ft.');
        expect(TAIL_ACTION.damage_dice_primary).toBe('1d10 + 4');
        expect(TAIL_ACTION.damage_type_primary).toBe('Bludgeoning');
        expect(TAIL_ACTION.hit_conditions).toEqual(['prone']);
        expect(TAIL_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a prone-only clause with no escape DC', () => {
        expect(buildHitConditionClause(TAIL_ACTION)).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Tail',
            targetEffect: null,
        });
    });

    it('applies Prone + attacker-source meta + condition log on a resolved Tail hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Tail', formula: '1d10 + 4', total: 9, rolls: [5], modifier: 4, context: {
            targetName: 'ElderPaladin',
            damageType: 'Bludgeoning',
            attackerName: 'Ankylosaurus 1',
            hitClause: buildHitConditionClause(TAIL_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['prone']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ prone: { source: 'Ankylosaurus 1' } });
        expect(metaCall[2].prone.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'ElderPaladin',
            condition: 'Prone',
            reason: 'Tail (escape DC —)',
        }));
    });

    it('writes no condition when the Tail attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Tail', formula: '1d10 + 4', total: 9, rolls: [5], modifier: 4, context: {
            targetName: 'ElderPaladin',
            damageType: 'Bludgeoning',
            attackerName: 'Ankylosaurus 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'ElderPaladin', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'ElderPaladin', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const BARLGURA = monsters.find(m => m.index === 'barlgura');
const BARLGURA_THRASH_ACTION = BARLGURA.actions[2];

describe('MA-0361 Barlgura Thrash prone-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Barlgura 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Barlgura 1', computedStats: { armorClass: 15 } },
            { name: 'AberrantSorcerer', computedStats: { armorClass: 9 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 33, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'AberrantSorcerer', type: 'player', size: 'Medium', ac: 9, currentHp: 41, maxHp: 41 }],
        });
    });

    it('MA-0361 data-lock: authors hit_conditions:["prone"] with no escape_dc on the Thrash row', () => {
        expect(BARLGURA_THRASH_ACTION.name).toBe('Thrash');
        expect(BARLGURA_THRASH_ACTION.attack_bonus).toBe(7);
        expect(BARLGURA_THRASH_ACTION.reach).toBe('5 ft.');
        expect(BARLGURA_THRASH_ACTION.damage_dice_primary).toBe('1d10 + 4');
        expect(BARLGURA_THRASH_ACTION.damage_type_primary).toBe('Bludgeoning');
        expect(BARLGURA_THRASH_ACTION.hit_conditions).toEqual(['prone']);
        expect(BARLGURA_THRASH_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a prone-only clause with no escape DC', () => {
        expect(buildHitConditionClause(BARLGURA_THRASH_ACTION)).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Thrash',
            targetEffect: null,
        });
    });

    it('applies Prone + attacker-source meta + condition log on a resolved Thrash hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Thrash', formula: '1d10 + 4', total: 8, rolls: [4], modifier: 4, context: {
            targetName: 'AberrantSorcerer',
            damageType: 'Bludgeoning',
            attackerName: 'Barlgura 1',
            hitClause: buildHitConditionClause(BARLGURA_THRASH_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['prone']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ prone: { source: 'Barlgura 1' } });
        expect(metaCall[2].prone.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'AberrantSorcerer',
            condition: 'Prone',
            reason: 'Thrash (escape DC —)',
        }));
    });

    it('writes no condition when the Thrash attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Thrash', formula: '1d10 + 4', total: 8, rolls: [4], modifier: 4, context: {
            targetName: 'AberrantSorcerer',
            damageType: 'Bludgeoning',
            attackerName: 'Barlgura 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'AberrantSorcerer', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'AberrantSorcerer', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const ASSASSIN = monsters.find(m => m.index === 'assassin');
const ASSASSIN_SHORTSWORD_ACTION = ASSASSIN.actions[1];

describe('MA-0320 Assassin Shortsword poisoned-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Assassin 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Assassin 1', computedStats: { armorClass: 16 } },
            { name: 'HexWarlock', computedStats: { armorClass: 9 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 28, newHp: 32, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'HexWarlock', type: 'player', size: 'Medium', ac: 9, currentHp: 60, maxHp: 73 }],
        });
    });

    it('MA-0320 data-lock: authors hit_conditions:["poisoned"] with no escape_dc on the Shortsword row', () => {
        expect(ASSASSIN_SHORTSWORD_ACTION.name).toBe('Shortsword');
        expect(ASSASSIN_SHORTSWORD_ACTION.attack_bonus).toBe(7);
        expect(ASSASSIN_SHORTSWORD_ACTION.reach).toBe('5 ft.');
        expect(ASSASSIN_SHORTSWORD_ACTION.damage_dice_primary).toBe('1d6 + 4');
        expect(ASSASSIN_SHORTSWORD_ACTION.damage_type_primary).toBe('Piercing');
        expect(ASSASSIN_SHORTSWORD_ACTION.damage_dice_secondary).toBe('5d6');
        expect(ASSASSIN_SHORTSWORD_ACTION.damage_type_secondary).toBe('Poison');
        expect(ASSASSIN_SHORTSWORD_ACTION.hit_conditions).toEqual(['poisoned']);
        expect(ASSASSIN_SHORTSWORD_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a poisoned-only clause with no escape DC', () => {
        expect(buildHitConditionClause(ASSASSIN_SHORTSWORD_ACTION)).toEqual({
            conditions: ['poisoned'],
            escapeDc: null,
            attackName: 'Shortsword',
            targetEffect: null,
        });
    });

    it('applies Poisoned + attacker-source meta + condition log on a resolved Shortsword hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Shortsword', formula: '1d6 + 4', total: 10, rolls: [6], modifier: 4, context: {
            targetName: 'HexWarlock',
            damageType: 'Piercing',
            attackerName: 'Assassin 1',
            hitClause: buildHitConditionClause(ASSASSIN_SHORTSWORD_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['poisoned']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ poisoned: { source: 'Assassin 1' } });
        expect(metaCall[2].poisoned.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'HexWarlock',
            condition: 'Poisoned',
            reason: 'Shortsword (escape DC —)',
        }));
    });

    it('writes no condition when the Shortsword attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Shortsword', formula: '1d6 + 4', total: 10, rolls: [6], modifier: 4, context: {
            targetName: 'HexWarlock',
            damageType: 'Piercing',
            attackerName: 'Assassin 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'HexWarlock', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'HexWarlock', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const BALOR = monsters.find(m => m.index === 'balor');
const FLAME_WHIP_ACTION = BALOR.actions[1];

describe('MA-0334 Balor Flame Whip prone-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Balor 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Balor 1', computedStats: { armorClass: 19 } },
            { name: 'AberrantSorcerer', computedStats: { armorClass: 9 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 45, newHp: 1, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'AberrantSorcerer', type: 'player', size: 'Medium', ac: 9, currentHp: 46, maxHp: 46 }],
        });
    });

    it('MA-0334 data-lock: authors hit_conditions:["prone"] with no escape_dc on the Flame Whip row', () => {
        expect(FLAME_WHIP_ACTION.name).toBe('Flame Whip');
        expect(FLAME_WHIP_ACTION.attack_bonus).toBe(14);
        expect(FLAME_WHIP_ACTION.reach).toBe('30 ft.');
        expect(FLAME_WHIP_ACTION.damage_dice_primary).toBe('3d6 + 8');
        expect(FLAME_WHIP_ACTION.damage_type_primary).toBe('Force');
        expect(FLAME_WHIP_ACTION.damage_dice_secondary).toBe('5d6');
        expect(FLAME_WHIP_ACTION.damage_type_secondary).toBe('Fire');
        expect(FLAME_WHIP_ACTION.hit_conditions).toEqual(['prone']);
        expect(FLAME_WHIP_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a prone-only clause with no escape DC', () => {
        expect(buildHitConditionClause(FLAME_WHIP_ACTION)).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Flame Whip',
            targetEffect: null,
        });
    });

    it('applies Prone + attacker-source meta + condition log on a resolved Flame Whip hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Flame Whip', formula: '3d6 + 8', total: 25, rolls: [6, 5, 6], modifier: 8, context: {
            targetName: 'AberrantSorcerer',
            damageType: 'Force',
            attackerName: 'Balor 1',
            hitClause: buildHitConditionClause(FLAME_WHIP_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['prone']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ prone: { source: 'Balor 1' } });
        expect(metaCall[2].prone.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'AberrantSorcerer',
            condition: 'Prone',
            reason: 'Flame Whip (escape DC —)',
        }));
    });

    it('writes no condition when the Flame Whip attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Flame Whip', formula: '3d6 + 8', total: 25, rolls: [6, 5, 6], modifier: 8, context: {
            targetName: 'AberrantSorcerer',
            damageType: 'Force',
            attackerName: 'Balor 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'AberrantSorcerer', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'AberrantSorcerer', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const LIGHTNING_BLADE_ACTION = BALOR.actions[2];

describe('MA-0335 Balor Lightning Blade no_reactions hit-target-effect clause', () => {
    const deps = {
        characterName: 'Balor 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Balor 1', computedStats: { armorClass: 19 } },
            { name: 'AberrantSorcerer', computedStats: { armorClass: 9 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 43, newHp: 3, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'AberrantSorcerer', type: 'player', size: 'Medium', ac: 9, currentHp: 46, maxHp: 46 }],
        });
    });

    it('MA-0335 data-lock: authors hit_target_effect:"no_reactions" on the Lightning Blade row', () => {
        expect(LIGHTNING_BLADE_ACTION.name).toBe('Lightning Blade');
        expect(LIGHTNING_BLADE_ACTION.attack_bonus).toBe(14);
        expect(LIGHTNING_BLADE_ACTION.reach).toBe('10 ft.');
        expect(LIGHTNING_BLADE_ACTION.damage_dice_primary).toBe('3d8 + 8');
        expect(LIGHTNING_BLADE_ACTION.damage_type_primary).toBe('Force');
        expect(LIGHTNING_BLADE_ACTION.damage_dice_secondary).toBe('4d10');
        expect(LIGHTNING_BLADE_ACTION.damage_type_secondary).toBe('Lightning');
        expect(LIGHTNING_BLADE_ACTION.hit_target_effect).toBe('no_reactions');
        expect(LIGHTNING_BLADE_ACTION.hit_conditions).toBeUndefined();
        expect(LIGHTNING_BLADE_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a targetEffect-only clause from the Lightning Blade row', () => {
        expect(buildHitConditionClause(LIGHTNING_BLADE_ACTION)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Lightning Blade',
            targetEffect: 'no_reactions',
        });
    });

    it('registers the no_reactions te on the target, sourced from the balor, on a resolved hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Lightning Blade', formula: '3d8 + 8', total: 21, rolls: [6, 4, 3], modifier: 8, context: {
            targetName: 'AberrantSorcerer',
            damageType: 'Force',
            attackerName: 'Balor 1',
            hitClause: buildHitConditionClause(LIGHTNING_BLADE_ACTION),
        } });

        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'AberrantSorcerer',
            'no_reactions',
            'Balor 1',
            { duration: 'until_start_of_next_turn' }
        );
    });

    it('expires the te anchored on the balor (until its next turn start)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Lightning Blade', formula: '3d8 + 8', total: 21, rolls: [6, 4, 3], modifier: 8, context: {
            targetName: 'AberrantSorcerer',
            damageType: 'Force',
            attackerName: 'Balor 1',
            hitClause: buildHitConditionClause(LIGHTNING_BLADE_ACTION),
        } });

        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Balor 1',
            targetName: 'AberrantSorcerer',
            effects: [{ type: 'remove_target_effect', effectKey: 'no_reactions', source: 'Balor 1', target: 'AberrantSorcerer' }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'Balor 1',
        });
    });

    it('logs a condition-applied entry naming the clause duration and writes no grapple conditions', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Lightning Blade', formula: '3d8 + 8', total: 21, rolls: [6, 4, 3], modifier: 8, context: {
            targetName: 'AberrantSorcerer',
            damageType: 'Force',
            attackerName: 'Balor 1',
            hitClause: buildHitConditionClause(LIGHTNING_BLADE_ACTION),
        } });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'AberrantSorcerer',
            reason: "Lightning Blade — until the start of Balor 1's next turn",
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'AberrantSorcerer', 'activeConditions', expect.anything(), 'test-campaign'
        );
    });

    it('grants nothing when the Lightning Blade attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Lightning Blade', formula: '3d8 + 8', total: 21, rolls: [6, 4, 3], modifier: 8, context: {
            targetName: 'AberrantSorcerer',
            damageType: 'Force',
            attackerName: 'Balor 1',
        } });

        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const BARBED_DEVIL = monsters.find(m => m.index === 'barbed-devil');
const BARBED_DEVIL_CLAWS_ACTION = BARBED_DEVIL.actions[1];

describe('MA-0354 Barbed Devil Claws grapple-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Barbed Devil 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Barbed Devil 1', computedStats: { armorClass: 15 } },
            { name: 'HexWarlock', computedStats: { armorClass: 9 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 63, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'HexWarlock', type: 'player', size: 'Medium', ac: 9, currentHp: 73, maxHp: 73 }],
        });
    });

    it('MA-0354 data-lock: authors hit_conditions:["grappled"] + escape_dc:13 on the Claws row', () => {
        expect(BARBED_DEVIL_CLAWS_ACTION.name).toBe('Claws');
        expect(BARBED_DEVIL_CLAWS_ACTION.attack_bonus).toBe(6);
        expect(BARBED_DEVIL_CLAWS_ACTION.reach).toBe('5 ft.');
        expect(BARBED_DEVIL_CLAWS_ACTION.damage_dice_primary).toBe('2d6 + 3');
        expect(BARBED_DEVIL_CLAWS_ACTION.damage_type_primary).toBe('Piercing');
        expect(BARBED_DEVIL_CLAWS_ACTION.hit_conditions).toEqual(['grappled']);
        expect(BARBED_DEVIL_CLAWS_ACTION.escape_dc).toBe(13);
    });

    it('builds the grappled clause with escape DC 13', () => {
        expect(buildHitConditionClause(BARBED_DEVIL_CLAWS_ACTION)).toEqual({
            conditions: ['grappled'],
            escapeDc: 13,
            attackName: 'Claws',
            targetEffect: null,
        });
    });

    it('applies Grappled + escape-meta + condition log on a resolved Claws hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Claws', formula: '2d6 + 3', total: 10, rolls: [4, 3], modifier: 3, context: {
            targetName: 'HexWarlock',
            damageType: 'Piercing',
            attackerName: 'Barbed Devil 1',
            hitClause: buildHitConditionClause(BARBED_DEVIL_CLAWS_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['grappled']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({
            grappled: { dc: 13, ability: 'str', source: 'Barbed Devil 1' },
        });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'HexWarlock',
            condition: 'Grappled',
            reason: 'Claws (escape DC 13)',
        }));
    });

    it('writes no condition when the Claws attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Claws', formula: '2d6 + 3', total: 10, rolls: [4, 3], modifier: 3, context: {
            targetName: 'HexWarlock',
            damageType: 'Piercing',
            attackerName: 'Barbed Devil 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'HexWarlock', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'HexWarlock', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const BEARDED_DEVIL = monsters.find(m => m.index === 'bearded-devil');
const BEARDED_DEVIL_BEARD_ACTION = BEARDED_DEVIL.actions[1];

describe('MA-0366 Bearded Devil Beard poisoned + no_healing hit-clause', () => {
    const deps = {
        characterName: 'Bearded Devil 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Bearded Devil 1', computedStats: { armorClass: 13 } },
            { name: 'HexWarlock', computedStats: { armorClass: 9 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 63, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'HexWarlock', type: 'player', size: 'Medium', ac: 9, currentHp: 73, maxHp: 73 }],
        });
    });

    it('MA-0366 data-lock: authors hit_conditions:["poisoned"] + hit_target_effect:"no_healing" on the Beard row', () => {
        expect(BEARDED_DEVIL_BEARD_ACTION.name).toBe('Beard');
        expect(BEARDED_DEVIL_BEARD_ACTION.attack_bonus).toBe(5);
        expect(BEARDED_DEVIL_BEARD_ACTION.reach).toBe('5 ft.');
        expect(BEARDED_DEVIL_BEARD_ACTION.damage_dice_primary).toBe('1d8 + 3');
        expect(BEARDED_DEVIL_BEARD_ACTION.damage_type_primary).toBe('Piercing');
        expect(BEARDED_DEVIL_BEARD_ACTION.hit_conditions).toEqual(['poisoned']);
        expect(BEARDED_DEVIL_BEARD_ACTION.hit_target_effect).toBe('no_healing');
        expect(BEARDED_DEVIL_BEARD_ACTION.escape_dc).toBeUndefined();
    });

    it('builds the combined poisoned + no_healing clause from the Beard row', () => {
        expect(buildHitConditionClause(BEARDED_DEVIL_BEARD_ACTION)).toEqual({
            conditions: ['poisoned'],
            escapeDc: null,
            attackName: 'Beard',
            targetEffect: 'no_healing',
        });
    });

    it('applies Poisoned + attacker-source meta on a resolved Beard hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Beard', formula: '1d8 + 3', total: 10, rolls: [7], modifier: 3, context: {
            targetName: 'HexWarlock',
            damageType: 'Piercing',
            attackerName: 'Bearded Devil 1',
            hitClause: buildHitConditionClause(BEARDED_DEVIL_BEARD_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['poisoned']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ poisoned: { source: 'Bearded Devil 1' } });
        expect(metaCall[2].poisoned.dc).toBeUndefined();
    });

    it('registers the no_healing te on the target, sourced from the devil, on a resolved Beard hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Beard', formula: '1d8 + 3', total: 10, rolls: [7], modifier: 3, context: {
            targetName: 'HexWarlock',
            damageType: 'Piercing',
            attackerName: 'Bearded Devil 1',
            hitClause: buildHitConditionClause(BEARDED_DEVIL_BEARD_ACTION),
        } });

        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'HexWarlock',
            'no_healing',
            'Bearded Devil 1',
            { duration: 'until_start_of_next_turn' }
        );
    });

    it('expires the te anchored on the devil (until its next turn start, MA-0016 clock)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Beard', formula: '1d8 + 3', total: 10, rolls: [7], modifier: 3, context: {
            targetName: 'HexWarlock',
            damageType: 'Piercing',
            attackerName: 'Bearded Devil 1',
            hitClause: buildHitConditionClause(BEARDED_DEVIL_BEARD_ACTION),
        } });

        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Bearded Devil 1',
            targetName: 'HexWarlock',
            effects: [{ type: 'remove_target_effect', effectKey: 'no_healing', source: 'Bearded Devil 1', target: 'HexWarlock' }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'Bearded Devil 1',
        });
    });

    it('logs condition-applied entries for both the Poisoned grant and the heal-block te', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Beard', formula: '1d8 + 3', total: 10, rolls: [7], modifier: 3, context: {
            targetName: 'HexWarlock',
            damageType: 'Piercing',
            attackerName: 'Bearded Devil 1',
            hitClause: buildHitConditionClause(BEARDED_DEVIL_BEARD_ACTION),
        } });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'HexWarlock',
            condition: 'Poisoned',
            reason: 'Beard (escape DC —)',
        }));
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'HexWarlock',
            reason: "Beard — until the start of Bearded Devil 1's next turn",
        }));
    });

    it('grants nothing when the Beard attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Beard', formula: '1d8 + 3', total: 10, rolls: [7], modifier: 3, context: {
            targetName: 'HexWarlock',
            damageType: 'Piercing',
            attackerName: 'Bearded Devil 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'HexWarlock', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'HexWarlock', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const DEATH_CULTIST = monsters.find(m => m.index === 'death-cultist');
const DEATH_CULTIST_SCYTHE_ACTION = DEATH_CULTIST.actions.find(a => a.name === 'Dread Scythe');

describe('MA-0556 Death Cultist Dread Scythe no_healing hit-clause', () => {
    const deps = {
        characterName: 'Death Cultist 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Death Cultist 1', computedStats: { armorClass: 17 } },
            { name: 'Knight 1', computedStats: { armorClass: 18 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 979, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Knight 1', type: 'monster', size: 'Medium', ac: 18, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0556 data-lock: authors hit_target_effect:"no_healing" on the Dread Scythe row', () => {
        expect(DEATH_CULTIST_SCYTHE_ACTION.attack_bonus).toBe(7);
        expect(DEATH_CULTIST_SCYTHE_ACTION.reach).toBe('10 ft.');
        expect(DEATH_CULTIST_SCYTHE_ACTION.damage_dice_primary).toBe('1d10 + 4');
        expect(DEATH_CULTIST_SCYTHE_ACTION.damage_type_primary).toBe('Slashing');
        expect(DEATH_CULTIST_SCYTHE_ACTION.damage_dice_secondary).toBe('2d10');
        expect(DEATH_CULTIST_SCYTHE_ACTION.damage_type_secondary).toBe('Necrotic');
        expect(DEATH_CULTIST_SCYTHE_ACTION.hit_target_effect).toBe('no_healing');
        expect(DEATH_CULTIST_SCYTHE_ACTION.hit_conditions).toBeUndefined();
        expect(DEATH_CULTIST_SCYTHE_ACTION.save_dc).toBeUndefined();
    });

    it('builds the target-effect-only clause from the Dread Scythe row', () => {
        expect(buildHitConditionClause(DEATH_CULTIST_SCYTHE_ACTION)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Dread Scythe',
            targetEffect: 'no_healing',
        });
    });

    it('registers the no_healing te on the target, sourced from the cultist, on a resolved hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Dread Scythe', formula: '1d10 + 4', total: 9, rolls: [5], modifier: 4, context: {
            targetName: 'Knight 1',
            damageType: 'Slashing',
            attackerName: 'Death Cultist 1',
            hitClause: buildHitConditionClause(DEATH_CULTIST_SCYTHE_ACTION),
        } });

        expect(registerTargetEffect).toHaveBeenCalledTimes(1);
        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Knight 1',
            'no_healing',
            'Death Cultist 1',
            { duration: 'until_start_of_next_turn' }
        );
    });

    it('expires the te with ONE clock anchored on the cultist (MA-0016 single-clock rule)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Dread Scythe', formula: '1d10 + 4', total: 9, rolls: [5], modifier: 4, context: {
            targetName: 'Knight 1',
            damageType: 'Slashing',
            attackerName: 'Death Cultist 1',
            hitClause: buildHitConditionClause(DEATH_CULTIST_SCYTHE_ACTION),
        } });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Death Cultist 1',
            targetName: 'Knight 1',
            effects: [{ type: 'remove_target_effect', effectKey: 'no_healing', source: 'Death Cultist 1', target: 'Knight 1' }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'Death Cultist 1',
        });
    });

    it('logs the heal-block condition-applied entry with the cultist-anchored reason', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Dread Scythe', formula: '1d10 + 4', total: 9, rolls: [5], modifier: 4, context: {
            targetName: 'Knight 1',
            damageType: 'Slashing',
            attackerName: 'Death Cultist 1',
            hitClause: buildHitConditionClause(DEATH_CULTIST_SCYTHE_ACTION),
        } });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Knight 1',
            reason: "Dread Scythe — until the start of Death Cultist 1's next turn",
        }));
    });

    it('heal-block consumer context: the granted te shape is the shape isHealingBlocked reads', async () => {
        getRuntimeValue.mockImplementation((char, key) => {
            if (char === 'campaign' && key === 'targetEffects') {
                return [{ target: 'Knight 1', effect: 'no_healing', source: 'Death Cultist 1', duration: 'until_start_of_next_turn' }];
            }
            return null;
        });
        const { getHealingBlockEffect, isHealingBlocked } = await import('../../../services/rules/combat/healingBlock.js');
        expect(getHealingBlockEffect('Knight 1', 'test-campaign')).toMatchObject({ effect: 'no_healing', source: 'Death Cultist 1' });
        expect(isHealingBlocked('Knight 1', 'test-campaign', 5)).toMatchObject({ effect: 'no_healing' });
    });

    it('grants nothing when the Dread Scythe attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Dread Scythe', formula: '1d10 + 4', total: 9, rolls: [5], modifier: 4, context: {
            targetName: 'Knight 1',
            damageType: 'Slashing',
            attackerName: 'Death Cultist 1',
        } });

        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const BROWN_BEAR = monsters.find(m => m.index === 'brown-bear');
const BROWN_BEAR_CLAW_ACTION = BROWN_BEAR.actions[2];

describe('MA-0434 Brown Bear Claw prone-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Brown Bear 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Brown Bear 1', computedStats: { armorClass: 11 } },
            { name: 'AasimarTest', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 138, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'AasimarTest', type: 'player', size: 'Medium', ac: 12, currentHp: 143, maxHp: 143 }],
        });
    });

    it('MA-0434 data-lock: authors hit_conditions:["prone"] with no escape_dc on the Claw row', () => {
        expect(BROWN_BEAR_CLAW_ACTION.name).toBe('Claw');
        expect(BROWN_BEAR_CLAW_ACTION.attack_bonus).toBe(5);
        expect(BROWN_BEAR_CLAW_ACTION.reach).toBe('5 ft.');
        expect(BROWN_BEAR_CLAW_ACTION.damage_dice_primary).toBe('1d4 + 3');
        expect(BROWN_BEAR_CLAW_ACTION.damage_type_primary).toBe('Slashing');
        expect(BROWN_BEAR_CLAW_ACTION.hit_conditions).toEqual(['prone']);
        expect(BROWN_BEAR_CLAW_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a prone-only clause with no escape DC', () => {
        expect(buildHitConditionClause(BROWN_BEAR_CLAW_ACTION)).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Claw',
            targetEffect: null,
        });
    });

    it('applies Prone + attacker-source meta + condition log on a resolved Claw hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Claw', formula: '1d4 + 3', total: 5, rolls: [2], modifier: 3, context: {
            targetName: 'AasimarTest',
            damageType: 'Slashing',
            attackerName: 'Brown Bear 1',
            hitClause: buildHitConditionClause(BROWN_BEAR_CLAW_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['prone']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ prone: { source: 'Brown Bear 1' } });
        expect(metaCall[2].prone.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'AasimarTest',
            condition: 'Prone',
            reason: 'Claw (escape DC —)',
        }));
    });

    it('writes no condition when the Claw attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Claw', formula: '1d4 + 3', total: 5, rolls: [2], modifier: 3, context: {
            targetName: 'AasimarTest',
            damageType: 'Slashing',
            attackerName: 'Brown Bear 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'AasimarTest', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'AasimarTest', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const CENTAUR_WARDEN = monsters.find(m => m.index === 'centaur-warden');
const SUN_RAY_ACTION = CENTAUR_WARDEN.actions[2];

describe('MA-0477 Centaur Warden Sun Ray blinded-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Centaur Warden 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Centaur Warden 1', computedStats: { armorClass: 16 } },
            { name: 'AasimarTest', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 14, newHp: 129, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'AasimarTest', type: 'player', size: 'Medium', ac: 12, currentHp: 143, maxHp: 143 }],
        });
    });

    it('MA-0477 data-lock: authors hit_conditions:["blinded"] with no escape_dc on the Sun Ray row', () => {
        expect(SUN_RAY_ACTION.name).toBe('Sun Ray');
        expect(SUN_RAY_ACTION.attack_bonus).toBe(7);
        expect(SUN_RAY_ACTION.range).toBe('90 ft.');
        expect(SUN_RAY_ACTION.damage_dice_primary).toBe('3d6 + 4');
        expect(SUN_RAY_ACTION.damage_type_primary).toBe('Radiant');
        expect(SUN_RAY_ACTION.hit_conditions).toEqual(['blinded']);
        expect(SUN_RAY_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a blinded-only clause with no escape DC', () => {
        expect(buildHitConditionClause(SUN_RAY_ACTION)).toEqual({
            conditions: ['blinded'],
            escapeDc: null,
            attackName: 'Sun Ray',
            targetEffect: null,
        });
    });

    it('applies Blinded + attacker-source meta + condition log on a resolved Sun Ray hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Sun Ray', formula: '3d6 + 4', total: 14, rolls: [4, 3, 3], modifier: 4, context: {
            targetName: 'AasimarTest',
            damageType: 'Radiant',
            attackerName: 'Centaur Warden 1',
            hitClause: buildHitConditionClause(SUN_RAY_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['blinded']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ blinded: { source: 'Centaur Warden 1' } });
        expect(metaCall[2].blinded.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'AasimarTest',
            condition: 'Blinded',
            reason: 'Sun Ray (escape DC —)',
        }));
    });

    it('writes no condition when the Sun Ray attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Sun Ray', formula: '3d6 + 4', total: 14, rolls: [4, 3, 3], modifier: 4, context: {
            targetName: 'AasimarTest',
            damageType: 'Radiant',
            attackerName: 'Centaur Warden 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'AasimarTest', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'AasimarTest', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const CHAIN_DEVIL = monsters.find(m => m.index === 'chain-devil');
const CHAIN_ACTION = CHAIN_DEVIL.actions[1];

describe('MA-0480 Chain Devil Chain grappled+restrained-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Chain Devil 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Chain Devil 1', computedStats: { armorClass: 15 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 11, newHp: 988, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0480 data-lock: authors hit_conditions:["grappled","restrained"] + escape_dc:14 on the Chain row', () => {
        expect(CHAIN_ACTION.name).toBe('Chain');
        expect(CHAIN_ACTION.attack_bonus).toBe(7);
        expect(CHAIN_ACTION.reach).toBe('10 ft.');
        expect(CHAIN_ACTION.damage_dice_primary).toBe('2d6 + 4');
        expect(CHAIN_ACTION.damage_type_primary).toBe('Slashing');
        expect(CHAIN_ACTION.hit_conditions).toEqual(['grappled', 'restrained']);
        expect(CHAIN_ACTION.escape_dc).toBe(14);
        expect(CHAIN_ACTION.save_effect).toContain('Grappled');
    });

    it('builds the dual-condition clause with escape DC 14 (statblock STR 18/+4 + PB 3 — MA-0522: save_effect decoy inert, hit_conditions arms path)', () => {
        expect(CHAIN_DEVIL.ability_score_modifiers.str).toBe(4);
        expect(CHAIN_DEVIL.proficiency_bonus).toBe(3);
        expect(buildHitConditionClause(CHAIN_ACTION)).toEqual({
            conditions: ['grappled', 'restrained'],
            escapeDc: 14,
            attackName: 'Chain',
            targetEffect: null,
        });
    });

    it('applies Grappled+Restrained + escape-meta dc14 STR + condition log on a resolved Chain hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Chain', formula: '2d6 + 4', total: 11, rolls: [6, 5], modifier: 4, context: {
            targetName: 'Bandit 1',
            damageType: 'Slashing',
            attackerName: 'Chain Devil 1',
            hitClause: buildHitConditionClause(CHAIN_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['grappled', 'restrained']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({
            grappled: { dc: 14, ability: 'str', source: 'Chain Devil 1' },
            restrained: { dc: 14, ability: 'str', source: 'Chain Devil 1' },
        });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Grappled, Restrained',
            reason: 'Chain (escape DC 14)',
        }));
    });

    it('writes no condition when the Chain attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Chain', formula: '2d6 + 4', total: 11, rolls: [6, 5], modifier: 4, context: {
            targetName: 'Bandit 1',
            damageType: 'Slashing',
            attackerName: 'Chain Devil 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const CHIMERA = monsters.find(m => m.index === 'chimera');
const RAM_ACTION = CHIMERA.actions[3];

describe('MA-0487 Chimera Ram prone-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Chimera 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Chimera 1', computedStats: { armorClass: 14 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 9, newHp: 990, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0487 data-lock: authors hit_conditions:["prone"] on the Ram row (byte-mirrors Brown Bear Claw)', () => {
        expect(RAM_ACTION.name).toBe('Ram');
        expect(RAM_ACTION.attack_bonus).toBe(7);
        expect(RAM_ACTION.reach).toBe('5 ft.');
        expect(RAM_ACTION.damage_dice_primary).toBe('1d12 + 4');
        expect(RAM_ACTION.damage_type_primary).toBe('Bludgeoning');
        expect(RAM_ACTION.hit_conditions).toEqual(['prone']);
    });

    it('builds the prone clause with no escape DC (Ram prose has no escape save)', () => {
        expect(buildHitConditionClause(RAM_ACTION)).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Ram',
            targetEffect: null,
        });
    });

    it('applies Prone + provenance-meta + condition log on a resolved Ram hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Ram', formula: '1d12 + 4', total: 9, rolls: [5], modifier: 4, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Chimera 1',
            hitClause: buildHitConditionClause(RAM_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['prone']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ prone: { source: 'Chimera 1' } });
        expect(metaCall[2].prone.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Prone',
            reason: 'Ram (escape DC —)',
        }));
    });

    it('writes no condition when the Ram attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Ram', formula: '1d12 + 4', total: 9, rolls: [5], modifier: 4, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Chimera 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const CHUUL = monsters.find(m => m.index === 'chuul');
const CHUUL_PINCER_ACTION = CHUUL.actions[1];

describe('MA-0490 Chuul Pincer grapple-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Chuul 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Chuul 1', computedStats: { armorClass: 16 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 12, newHp: 987, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0490 data-lock: authors hit_conditions:["grappled"] + escape_dc:14 on the Pincer row', () => {
        expect(CHUUL_PINCER_ACTION.name).toBe('Pincer');
        expect(CHUUL_PINCER_ACTION.attack_bonus).toBe(6);
        expect(CHUUL_PINCER_ACTION.reach).toBe('10 ft.');
        expect(CHUUL_PINCER_ACTION.damage_dice_primary).toBe('1d10 + 4');
        expect(CHUUL_PINCER_ACTION.damage_type_primary).toBe('Bludgeoning');
        expect(CHUUL_PINCER_ACTION.hit_conditions).toEqual(['grappled']);
        expect(CHUUL_PINCER_ACTION.escape_dc).toBe(14);
        expect(CHUUL_PINCER_ACTION.save_effect).toContain('Grappled');
    });

    it('builds the grappled clause with escape DC 14 (statblock STR 19/+4 + PB 2 + 8; save_effect decoy inert, hit_conditions arms path)', () => {
        expect(CHUUL.ability_score_modifiers.str).toBe(4);
        expect(CHUUL.proficiency_bonus).toBe(2);
        expect(buildHitConditionClause(CHUUL_PINCER_ACTION)).toEqual({
            conditions: ['grappled'],
            escapeDc: 14,
            attackName: 'Pincer',
            targetEffect: null,
        });
    });

    it('applies Grappled + escape-meta dc14 STR + condition log on a resolved Pincer hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Pincer', formula: '1d10 + 4', total: 12, rolls: [8], modifier: 4, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Chuul 1',
            hitClause: buildHitConditionClause(CHUUL_PINCER_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['grappled']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({
            grappled: { dc: 14, ability: 'str', source: 'Chuul 1' },
        });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Grappled',
            reason: 'Pincer (escape DC 14)',
        }));
    });

    it('writes no condition when the Pincer attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Pincer', formula: '1d10 + 4', total: 12, rolls: [8], modifier: 4, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Chuul 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });

    it('writes no condition on a hit against a Huge victim (Large-or-smaller gate)', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Huge', ac: 12, currentHp: 999, maxHp: 999 }],
        });
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Pincer', formula: '1d10 + 4', total: 12, rolls: [8], modifier: 4, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Chuul 1',
            hitClause: buildHitConditionClause(CHUUL_PINCER_ACTION),
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const CLOUD_GIANT = monsters.find(m => m.index === 'cloud-giant');
const THUNDERCLOUD_ACTION = CLOUD_GIANT.actions[2];

describe('MA-0499 Cloud Giant Thundercloud incapacitated-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Cloud Giant 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Cloud Giant 1', computedStats: { armorClass: 14 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 15, newHp: 984, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0499 data-lock: authors hit_conditions:["incapacitated"] with no escape_dc on the Thundercloud row', () => {
        expect(THUNDERCLOUD_ACTION.name).toBe('Thundercloud');
        expect(THUNDERCLOUD_ACTION.attack_bonus).toBe(12);
        expect(THUNDERCLOUD_ACTION.range).toBe('240 ft.');
        expect(THUNDERCLOUD_ACTION.damage_dice_primary).toBe('3d6 + 8');
        expect(THUNDERCLOUD_ACTION.damage_type_primary).toBe('Thunder');
        expect(THUNDERCLOUD_ACTION.hit_conditions).toEqual(['incapacitated']);
        expect(THUNDERCLOUD_ACTION.escape_dc).toBeUndefined();
    });

    it('builds an incapacitated-only clause with no escape DC', () => {
        expect(buildHitConditionClause(THUNDERCLOUD_ACTION)).toEqual({
            conditions: ['incapacitated'],
            escapeDc: null,
            attackName: 'Thundercloud',
            targetEffect: null,
        });
    });

    it('applies Incapacitated + attacker-source meta + condition log on a resolved Thundercloud hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Thundercloud', formula: '3d6 + 8', total: 15, rolls: [2, 2, 3], modifier: 8, context: {
            targetName: 'Bandit 1',
            damageType: 'Thunder',
            attackerName: 'Cloud Giant 1',
            hitClause: buildHitConditionClause(THUNDERCLOUD_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['incapacitated']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ incapacitated: { source: 'Cloud Giant 1' } });
        expect(metaCall[2].incapacitated.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Incapacitated',
            reason: 'Thundercloud (escape DC —)',
        }));
    });

    it('writes no condition when the Thundercloud attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Thundercloud', formula: '3d6 + 8', total: 15, rolls: [2, 2, 3], modifier: 8, context: {
            targetName: 'Bandit 1',
            damageType: 'Thunder',
            attackerName: 'Cloud Giant 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const COLOSSUS = monsters.find(m => m.index === 'colossus');
const RADIANT_RAY_ACTION = COLOSSUS.actions[2];

describe('MA-0508 Colossus Radiant Ray prone-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Colossus 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Colossus 1', computedStats: { armorClass: 23 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 22, newHp: 977, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0508 data-lock: authors hit_conditions:["prone"] on the Radiant Ray row (byte-mirrors Brown Bear Claw)', () => {
        expect(RADIANT_RAY_ACTION.name).toBe('Radiant Ray');
        expect(RADIANT_RAY_ACTION.attack_bonus).toBe(18);
        expect(RADIANT_RAY_ACTION.range).toBe('300 ft.');
        expect(RADIANT_RAY_ACTION.damage_dice_primary).toBe('4d10');
        expect(RADIANT_RAY_ACTION.damage_type_primary).toBe('Radiant');
        expect(RADIANT_RAY_ACTION.hit_conditions).toEqual(['prone']);
        expect(RADIANT_RAY_ACTION.escape_dc).toBeUndefined();
    });

    it('builds the prone clause with no escape DC (Radiant Ray prose has no escape save)', () => {
        expect(buildHitConditionClause(RADIANT_RAY_ACTION)).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Radiant Ray',
            targetEffect: null,
        });
    });

    it('applies Prone + provenance-meta + condition log on a resolved Radiant Ray hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Radiant Ray', formula: '4d10', total: 22, rolls: [7], modifier: 0, context: {
            targetName: 'Bandit 1',
            damageType: 'Radiant',
            attackerName: 'Colossus 1',
            hitClause: buildHitConditionClause(RADIANT_RAY_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['prone']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ prone: { source: 'Colossus 1' } });
        expect(metaCall[2].prone.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Prone',
            reason: 'Radiant Ray (escape DC —)',
        }));
    });

    it('writes no condition when the Radiant Ray attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Radiant Ray', formula: '4d10', total: 22, rolls: [7], modifier: 0, context: {
            targetName: 'Bandit 1',
            damageType: 'Radiant',
            attackerName: 'Colossus 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const COUATL = monsters.find(m => m.index === 'couatl');
const COUATL_BITE_ACTION = COUATL.actions[0];

describe('MA-0522 Couatl Bite poisoned-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Couatl 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Couatl 1', computedStats: { armorClass: 19 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 15, newHp: 984, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0522 data-lock: authors hit_conditions:["poisoned"] with no escape_dc on the Bite row', () => {
        expect(COUATL_BITE_ACTION.name).toBe('Bite');
        expect(COUATL_BITE_ACTION.attack_bonus).toBe(7);
        expect(COUATL_BITE_ACTION.damage_dice_primary).toBe('1d12 + 5');
        expect(COUATL_BITE_ACTION.damage_type_primary).toBe('Piercing');
        expect(COUATL_BITE_ACTION.hit_conditions).toEqual(['poisoned']);
        expect(COUATL_BITE_ACTION.escape_dc).toBeUndefined();
    });

    it('builds the poisoned clause with no escape DC (Bite prose has no escape save)', () => {
        expect(buildHitConditionClause(COUATL_BITE_ACTION)).toEqual({
            conditions: ['poisoned'],
            escapeDc: null,
            attackName: 'Bite',
            targetEffect: null,
        });
    });

    it('applies Poisoned + provenance-meta + condition log on a resolved Bite hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '1d12 + 5', total: 15, rolls: [10], modifier: 5, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Couatl 1',
            hitClause: buildHitConditionClause(COUATL_BITE_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['poisoned']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ poisoned: { source: 'Couatl 1' } });
        expect(metaCall[2].poisoned.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Poisoned',
            reason: 'Bite (escape DC —)',
        }));
    });

    it('writes no condition when the Bite attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '1d12 + 5', total: 15, rolls: [10], modifier: 5, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Couatl 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const CROCODILE = monsters.find(m => m.index === 'crocodile');
const CROCODILE_BITE_ACTION = CROCODILE.actions[0];

describe('MA-0527 Crocodile Bite grapple/restrain hit-clause rider', () => {
    const deps = {
        characterName: 'Crocodile 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Crocodile 1', computedStats: { armorClass: 12 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 991, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('authors hit_conditions:["grappled","restrained"] + escape_dc:12 on the Bite row', () => {
        expect(CROCODILE_BITE_ACTION.name).toBe('Bite');
        expect(CROCODILE_BITE_ACTION.attack_bonus).toBe(4);
        expect(CROCODILE_BITE_ACTION.damage_dice_primary).toBe('1d8 + 2');
        expect(CROCODILE_BITE_ACTION.damage_type_primary).toBe('Piercing');
        expect(CROCODILE_BITE_ACTION.hit_conditions).toEqual(['grappled', 'restrained']);
        expect(CROCODILE_BITE_ACTION.escape_dc).toBe(12);
        // escape_dc derivation: 8 + STR mod (15 -> +2) + PB (+2) = 12
        expect(CROCODILE.ability_score_modifiers.str + CROCODILE.proficiency_bonus + 8).toBe(12);
    });

    it('builds a grappled+restrained clause with escape DC 12', () => {
        expect(buildHitConditionClause(CROCODILE_BITE_ACTION)).toEqual({
            conditions: ['grappled', 'restrained'],
            escapeDc: 12,
            attackName: 'Bite',
            targetEffect: null,
        });
    });

    it('applies Grappled + Restrained with escape-meta and condition log on a resolved Bite hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '1d8 + 2', total: 8, rolls: [6], modifier: 2, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Crocodile 1',
            hitClause: buildHitConditionClause(CROCODILE_BITE_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['grappled', 'restrained']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall[2]).toMatchObject({
            grappled: { dc: 12, ability: 'str', source: 'Crocodile 1' },
            restrained: { dc: 12, ability: 'str', source: 'Crocodile 1' },
        });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Grappled, Restrained',
            reason: 'Bite (escape DC 12)',
        }));
    });
});

const CYCLOPS_ORACLE = monsters.find(m => m.index === 'cyclops-oracle');
const FLASH_OF_LIGHT_ACTION = CYCLOPS_ORACLE.actions.find(a => a.name === 'Flash of Light');

describe('MA-0542 Cyclops Oracle Flash of Light disadvantage_attack_rolls hit-clause', () => {
    const deps = {
        characterName: 'Cyclops Oracle 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Cyclops Oracle 1', computedStats: { armorClass: 16 } },
            { name: 'Knight 1', computedStats: { armorClass: 18 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getEffectDefinition.mockImplementation((key) => ({
            effect: key,
            label: 'Attack Disadvantage',
            description: 'Disadvantage on attack rolls until the end of the source\'s next turn.',
            group: 'Attack',
        }));
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 11, newHp: 189, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Knight 1', type: 'player', size: 'Medium', ac: 18, currentHp: 200, maxHp: 200 }],
        });
    });

    it('MA-0542 data-lock: Flash of Light row authors hit_target_effect:"disadvantage_attack_rolls" (+10 ranged 120 ft., 2d10 + 6 Radiant)', () => {
        expect(FLASH_OF_LIGHT_ACTION.attack_bonus).toBe(10);
        expect(FLASH_OF_LIGHT_ACTION.range).toBe('120 ft.');
        expect(FLASH_OF_LIGHT_ACTION.damage_dice_primary).toBe('2d10 + 6');
        expect(FLASH_OF_LIGHT_ACTION.damage_type_primary).toBe('Radiant');
        expect(FLASH_OF_LIGHT_ACTION.hit_target_effect).toBe('disadvantage_attack_rolls');
        expect(FLASH_OF_LIGHT_ACTION.hit_conditions).toBeUndefined();
        expect(FLASH_OF_LIGHT_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a targetEffect-only clause from the Flash of Light row', () => {
        expect(buildHitConditionClause(FLASH_OF_LIGHT_ACTION)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Flash of Light',
            targetEffect: 'disadvantage_attack_rolls',
        });
    });

    it('registers the disadvantage_attack_rolls te on the victim, sourced from the cyclops, on a resolved hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Flash of Light', formula: '2d10 + 6', total: 11, rolls: [5], modifier: 6, context: {
            targetName: 'Knight 1',
            damageType: 'Radiant',
            attackerName: 'Cyclops Oracle 1',
            hitClause: buildHitConditionClause(FLASH_OF_LIGHT_ACTION),
        } });

        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Knight 1',
            'disadvantage_attack_rolls',
            'Cyclops Oracle 1',
            { duration: 'until_start_of_next_turn' }
        );
    });

    it('MA-0542 clock-lock: grants ONE addExpiration clock anchored on the cyclops (MA-0030/§38 anchor leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Flash of Light', formula: '2d10 + 6', total: 11, rolls: [5], modifier: 6, context: {
            targetName: 'Knight 1',
            damageType: 'Radiant',
            attackerName: 'Cyclops Oracle 1',
            hitClause: buildHitConditionClause(FLASH_OF_LIGHT_ACTION),
        } });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Cyclops Oracle 1',
            targetName: 'Knight 1',
            effects: [{ type: 'remove_target_effect', effectKey: 'disadvantage_attack_rolls', source: 'Cyclops Oracle 1', target: 'Knight 1' }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'Cyclops Oracle 1',
        });
    });

    it('logs condition-applied with the registry label and writes no raw activeConditions', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Flash of Light', formula: '2d10 + 6', total: 11, rolls: [5], modifier: 6, context: {
            targetName: 'Knight 1',
            damageType: 'Radiant',
            attackerName: 'Cyclops Oracle 1',
            hitClause: buildHitConditionClause(FLASH_OF_LIGHT_ACTION),
        } });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Knight 1',
            condition: 'Attack Disadvantage',
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Knight 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
    });
});

const DARKMANTLE = monsters.find(m => m.index === 'darkmantle');
const CRUSH_ACTION = DARKMANTLE.actions[0];

describe('MA-0553 Darkmantle Crush attached hit-clause (stamp + advisory, no fabricated Blinded)', () => {
    const deps = {
        characterName: 'Darkmantle 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Darkmantle 1', computedStats: { armorClass: 11 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getEffectDefinition.mockImplementation((key) => ({
            effect: key,
            label: 'Attached (Darkmantle)',
            description: 'A darkmantle is attached: Speed 0, moves with the target, attacks only it with Advantage. Blinded + suffocating only while covering on an Advantage hit; detach with a DC 13 Strength (Athletics) action — GM-enforced.',
            group: 'Movement',
        }));
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 991, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'player', size: 'Medium or Small', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0553 data-lock: Crush row authors hit_target_effect:"attached", damage legs exact, NO hit_conditions (no blinded fabrication)', () => {
        expect(CRUSH_ACTION.name).toBe('Crush');
        expect(CRUSH_ACTION.attack_bonus).toBe(5);
        expect(CRUSH_ACTION.reach).toBe('5 ft.');
        expect(CRUSH_ACTION.damage_dice_primary).toBe('1d6 + 3');
        expect(CRUSH_ACTION.damage_type_primary).toBe('Bludgeoning');
        expect(CRUSH_ACTION.hit_target_effect).toBe('attached');
        expect(CRUSH_ACTION.hit_conditions).toBeUndefined();
        expect(CRUSH_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a targetEffect-only clause from the Crush row', () => {
        expect(buildHitConditionClause(CRUSH_ACTION)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Crush',
            targetEffect: 'attached',
        });
    });

    it('registers the attached te on the victim, sourced from the darkmantle, on a resolved hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Crush', formula: '1d6 + 3', total: 8, rolls: [5], modifier: 3, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Darkmantle 1',
            hitClause: buildHitConditionClause(CRUSH_ACTION),
        } });

        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Bandit 1',
            'attached',
            'Darkmantle 1',
            { duration: 'until_start_of_next_turn' }
        );
    });

    it('MA-0553 clock-lock: grants ONE addExpiration anchored on the darkmantle (MA-0016/MA-0542 anchor leg; attach-until-detached RAW is advisory per MA-0434)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Crush', formula: '1d6 + 3', total: 8, rolls: [5], modifier: 3, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Darkmantle 1',
            hitClause: buildHitConditionClause(CRUSH_ACTION),
        } });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Darkmantle 1',
            targetName: 'Bandit 1',
            effects: [{ type: 'remove_target_effect', effectKey: 'attached', source: 'Darkmantle 1', target: 'Bandit 1' }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'Darkmantle 1',
        });
    });

    it('logs condition-applied with registry label + DC 13 detach advisory; never fabricates a blinded activeConditions write', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Crush', formula: '1d6 + 3', total: 8, rolls: [5], modifier: 3, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Darkmantle 1',
            hitClause: buildHitConditionClause(CRUSH_ACTION),
        } });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Attached (Darkmantle)',
        }));
        const conditionLog = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.type === 'condition' && e.action === 'applied');
        expect(conditionLog.note).toMatch(/DC 13/);
        expect(conditionLog.note).toMatch(/GM-enforced/);
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        const condWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeConditions');
        expect(JSON.stringify(condWrites)).not.toMatch(/blinded/i);
    });
});

const CYCLOPS_SENTRY = monsters.find(m => m.index === 'cyclops-sentry');
const STONE_CLUB_ACTION = CYCLOPS_SENTRY.actions[1];

describe('MA-0546 Cyclops Sentry Stone Club prone-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Cyclops Sentry 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Cyclops Sentry 1', computedStats: { armorClass: 14 } },
            { name: 'Knight 1', computedStats: { armorClass: 18 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 11, newHp: 189, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Knight 1', type: 'npc', size: 'Medium', ac: 18, currentHp: 200, maxHp: 200 }],
        });
    });

    it('MA-0546 data-lock: authors hit_conditions:["prone"] with no escape_dc on the Stone Club row', () => {
        expect(STONE_CLUB_ACTION.name).toBe('Stone Club');
        expect(STONE_CLUB_ACTION.attack_bonus).toBe(9);
        expect(STONE_CLUB_ACTION.reach).toBe('10 ft.');
        expect(STONE_CLUB_ACTION.damage_dice_primary).toBe('3d6 + 6');
        expect(STONE_CLUB_ACTION.damage_type_primary).toBe('Bludgeoning');
        expect(STONE_CLUB_ACTION.hit_conditions).toEqual(['prone']);
        expect(STONE_CLUB_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a prone-only clause with no escape DC', () => {
        expect(buildHitConditionClause(STONE_CLUB_ACTION)).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Stone Club',
            targetEffect: null,
        });
    });

    it('applies Prone + attacker-source meta + condition log on a resolved Stone Club hit (Medium victim passes size gate)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Stone Club', formula: '3d6 + 6', total: 11, rolls: [5], modifier: 6, context: {
            targetName: 'Knight 1',
            damageType: 'Bludgeoning',
            attackerName: 'Cyclops Sentry 1',
            hitClause: buildHitConditionClause(STONE_CLUB_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['prone']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ prone: { source: 'Cyclops Sentry 1' } });
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Knight 1',
            condition: 'Prone',
            reason: 'Stone Club (escape DC —)',
        }));
    });

    it('MA-0546 size-gate note-lock: RAW "Huge or smaller" vs code gate Tiny/Small/Medium/Large — Huge victim stays untripped (accepted residual)', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Frostmooth', type: 'npc', size: 'Huge', ac: 18, currentHp: 200, maxHp: 200 }],
        });
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Stone Club', formula: '3d6 + 6', total: 11, rolls: [5], modifier: 6, context: {
            targetName: 'Frostmooth',
            damageType: 'Bludgeoning',
            attackerName: 'Cyclops Sentry 1',
            hitClause: buildHitConditionClause(STONE_CLUB_ACTION),
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Frostmooth', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

describe('MA-0542 disadvantage_attack_rolls te consumer', () => {
    it('bumps attackDisadvantageCount for the holder via the pesky_swarm channel (no ability-check leg)', () => {
        const effects = computeConditionEffects({
            targetEffects: [{ effect: 'disadvantage_attack_rolls', target: 'Knight 1', source: 'Cyclops Oracle 1' }],
        });
        expect(effects.attackDisadvantageCount).toBeGreaterThanOrEqual(1);
        expect(effects.abilityCheckDisadvantage).toBe(false);
        expect(combineAttackModes(effects, computeConditionEffects({}), null, 'Cyclops Oracle 1')).toBe('disadvantage');
    });
});

const DAO = monsters.find(m => m.index === 'dao');
const EARTHEN_MAUL_ACTION = DAO.actions.find(a => a.name === 'Earthen Maul');

describe('MA-0550 Dao Earthen Maul prone rider inert', () => {
    const deps = {
        characterName: 'Dao 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Dao 1', computedStats: { armorClass: 18 } },
            { name: 'Knight 1', computedStats: { armorClass: 18 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 20, newHp: 979, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Knight 1', type: 'monster', size: 'Medium', ac: 18, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0550 data-lock: authors lowercase hit_conditions:["prone"] on the Earthen Maul row', () => {
        expect(EARTHEN_MAUL_ACTION.attack_bonus).toBe(10);
        expect(EARTHEN_MAUL_ACTION.damage_dice_primary).toBe('4d6 + 6');
        expect(EARTHEN_MAUL_ACTION.damage_type_primary).toBe('Bludgeoning');
        expect(EARTHEN_MAUL_ACTION.hit_conditions).toEqual(['prone']);
        expect(EARTHEN_MAUL_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a prone-only clause with no escape DC', () => {
        expect(buildHitConditionClause(EARTHEN_MAUL_ACTION)).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Earthen Maul',
            targetEffect: null,
        });
    });

    it('applies Prone + attacker-source meta + condition log on a resolved Earthen Maul hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Earthen Maul', formula: '4d6 + 6', total: 20, rolls: [6, 1, 1, 6], modifier: 6, context: {
            targetName: 'Knight 1',
            damageType: 'Bludgeoning',
            attackerName: 'Dao 1',
            hitClause: buildHitConditionClause(EARTHEN_MAUL_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['prone']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall[2]).toMatchObject({ prone: { source: 'Dao 1' } });
        expect(metaCall[2].prone.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Knight 1',
            condition: 'Prone',
            reason: 'Earthen Maul (escape DC —)',
        }));
    });

    it('skips the prone clause for Huge or larger targets', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Knight 1', type: 'monster', size: 'Huge', ac: 18, currentHp: 999, maxHp: 999 }],
        });
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Earthen Maul', formula: '4d6 + 6', total: 20, rolls: [6, 1, 1, 6], modifier: 6, context: {
            targetName: 'Knight 1',
            damageType: 'Bludgeoning',
            attackerName: 'Dao 1',
            hitClause: buildHitConditionClause(EARTHEN_MAUL_ACTION),
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Knight 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const DIRE_WOLF = monsters.find(m => m.index === 'dire-wolf');
const DIRE_WOLF_BITE_ACTION = DIRE_WOLF.actions.find(a => a.name === 'Bite');

describe('MA-0600 Dire Wolf Bite prone hit-clause', () => {
    const deps = {
        characterName: 'Dire Wolf 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Dire Wolf 1', computedStats: { armorClass: 14 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 8, newHp: 991, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'monster', size: 'Medium or Small', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0600 data-lock: authors hit_conditions:["prone"] with no escape_dc on the Bite row', () => {
        expect(DIRE_WOLF_BITE_ACTION.attack_bonus).toBe(5);
        expect(DIRE_WOLF_BITE_ACTION.damage_dice_primary).toBe('1d10 + 3');
        expect(DIRE_WOLF_BITE_ACTION.damage_type_primary).toBe('Piercing');
        expect(DIRE_WOLF_BITE_ACTION.hit_conditions).toEqual(['prone']);
        expect(DIRE_WOLF_BITE_ACTION.escape_dc).toBeUndefined();
        expect(DIRE_WOLF_BITE_ACTION.description).toContain('Prone');
    });

    it('builds a prone-only clause with no escape DC', () => {
        expect(buildHitConditionClause(DIRE_WOLF_BITE_ACTION)).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Bite',
            targetEffect: null,
        });
    });

    it('applies Prone + attacker-source meta + condition log on a resolved Bite hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '1d10 + 3', total: 8, rolls: [5], modifier: 3, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Dire Wolf 1',
            hitClause: buildHitConditionClause(DIRE_WOLF_BITE_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['prone']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall[2]).toMatchObject({ prone: { source: 'Dire Wolf 1' } });
        expect(metaCall[2].prone.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Prone',
            reason: 'Bite (escape DC —)',
        }));
    });

    it('skips the prone clause for Huge or larger targets', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Hill Giant 1', type: 'monster', size: 'Huge', ac: 13, currentHp: 999, maxHp: 999 }],
        });
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '1d10 + 3', total: 8, rolls: [5], modifier: 3, context: {
            targetName: 'Hill Giant 1',
            damageType: 'Piercing',
            attackerName: 'Dire Wolf 1',
            hitClause: buildHitConditionClause(DIRE_WOLF_BITE_ACTION),
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Hill Giant 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const DIRE_WORG = monsters.find(m => m.index === 'dire-worg');
const DIRE_WORG_BITE_ACTION = DIRE_WORG.actions.find(a => a.name === 'Bite');

describe('MA-0602 Dire Worg Bite poisoned + no_healing hit-clause', () => {
    afterEach(() => { rollExpression.mockReset(); });

    const deps = {
        characterName: 'Dire Worg 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Dire Worg 1', computedStats: { armorClass: 16 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 13, newHp: 983, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'monster', size: 'Medium or Small', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0602 data-lock: authors hit_conditions:["poisoned"] + hit_target_effect:"no_healing" on the Bite row', () => {
        expect(DIRE_WORG_BITE_ACTION.attack_bonus).toBe(10);
        expect(DIRE_WORG_BITE_ACTION.damage_dice_primary).toBe('2d8 + 6');
        expect(DIRE_WORG_BITE_ACTION.damage_type_primary).toBe('Piercing');
        expect(DIRE_WORG_BITE_ACTION.damage_dice_secondary).toBe('2d6');
        expect(DIRE_WORG_BITE_ACTION.damage_type_secondary).toBe('Poison');
        expect(DIRE_WORG_BITE_ACTION.hit_conditions).toEqual(['poisoned']);
        expect(DIRE_WORG_BITE_ACTION.hit_target_effect).toBe('no_healing');
        expect(DIRE_WORG_BITE_ACTION.escape_dc).toBeUndefined();
        expect(DIRE_WORG.actions[0].hit_conditions).toBeUndefined();
    });

    it('builds the combined poisoned + no_healing clause from the Bite row', () => {
        expect(buildHitConditionClause(DIRE_WORG_BITE_ACTION)).toEqual({
            conditions: ['poisoned'],
            escapeDc: null,
            attackName: 'Bite',
            targetEffect: 'no_healing',
        });
    });

    it('applies Poisoned + attacker-source meta on a resolved Bite hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '2d8 + 6', total: 13, rolls: [7], modifier: 6, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Dire Worg 1',
            hitClause: buildHitConditionClause(DIRE_WORG_BITE_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[0]).toBe('Bandit 1');
        expect(condCall[2]).toEqual(['poisoned']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ poisoned: { source: 'Dire Worg 1' } });
        expect(metaCall[2].poisoned.dc).toBeUndefined();
    });

    it('registers the no_healing te on the target, sourced from the worg, on a resolved Bite hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '2d8 + 6', total: 13, rolls: [7], modifier: 6, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Dire Worg 1',
            hitClause: buildHitConditionClause(DIRE_WORG_BITE_ACTION),
        } });

        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Bandit 1',
            'no_healing',
            'Dire Worg 1',
            { duration: 'until_start_of_next_turn' }
        );
    });

    it('expires the te anchored on the worg (until its next turn start, MA-0016 clock)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '2d8 + 6', total: 13, rolls: [7], modifier: 6, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Dire Worg 1',
            hitClause: buildHitConditionClause(DIRE_WORG_BITE_ACTION),
        } });

        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Dire Worg 1',
            targetName: 'Bandit 1',
            effects: [{ type: 'remove_target_effect', effectKey: 'no_healing', source: 'Dire Worg 1', target: 'Bandit 1' }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'Dire Worg 1',
        });
    });

    it('logs condition-applied entries for both the Poisoned grant and the heal-block te', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '2d8 + 6', total: 13, rolls: [7], modifier: 6, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Dire Worg 1',
            hitClause: buildHitConditionClause(DIRE_WORG_BITE_ACTION),
        } });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Poisoned',
            reason: 'Bite (escape DC —)',
        }));
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            reason: "Bite — until the start of Dire Worg 1's next turn",
        }));
    });

    it('still applies normal damage on the Bite hit (combined primary + secondary leg)', async () => {
        rollExpression.mockImplementation((f) => (f === '2d6' ? { total: 5, rolls: [2, 3], modifier: 0 } : null));
        applyDamageToTarget.mockImplementation(async (cs, name, dmg, types) => (
            types[0] === 'Poison'
                ? { finalDamage: 5, newHp: 978, damageReduced: false }
                : { finalDamage: dmg, newHp: 983, damageReduced: false }
        ));
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '2d8 + 6', total: 13, rolls: [7], modifier: 6, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Dire Worg 1',
            autoDamageSecondaryFormula: '2d6',
            autoDamageSecondaryType: 'Poison',
            hitClause: buildHitConditionClause(DIRE_WORG_BITE_ACTION),
        } });

        expect(applyDamageToTarget).toHaveBeenCalled();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'roll',
            rollType: 'damage',
            characterName: 'Dire Worg 1',
            finalDamage: 13,
            note: 'combined_damage_roll',
            secondaryFinalDamage: 5,
        }));
    });

    it('grants nothing when the Bite attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '2d8 + 6', total: 13, rolls: [7], modifier: 6, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Dire Worg 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const DISPLACER_BEAST = monsters.find(m => m.index === 'displacer-beast');
const DISPLACER_BEAST_REND_ACTION = DISPLACER_BEAST.actions[1];

describe('MA-0605 Displacer Beast Rend prone hit-clause', () => {
    const deps = {
        characterName: 'Displacer Beast 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Displacer Beast 1', computedStats: { armorClass: 13 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 989, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'monster', size: 'Medium or Small', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0605 data-lock: authors hit_conditions:["prone"] with no escape_dc on the Rend row', () => {
        expect(DISPLACER_BEAST_REND_ACTION.name).toBe('Rend');
        expect(DISPLACER_BEAST_REND_ACTION.attack_bonus).toBe(6);
        expect(DISPLACER_BEAST_REND_ACTION.reach).toBe('5 feet');
        expect(DISPLACER_BEAST_REND_ACTION.damage_dice_primary).toBe('1d10 + 4');
        expect(DISPLACER_BEAST_REND_ACTION.damage_type_primary).toBe('Slashing');
        expect(DISPLACER_BEAST_REND_ACTION.hit_conditions).toEqual(['prone']);
        expect(DISPLACER_BEAST_REND_ACTION.escape_dc).toBeUndefined();
        expect(DISPLACER_BEAST_REND_ACTION.description).toContain('Prone');
    });

    it('builds a prone-only clause with no escape DC', () => {
        expect(buildHitConditionClause(DISPLACER_BEAST_REND_ACTION)).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Rend',
            targetEffect: null,
        });
    });

    it('applies Prone + attacker-source meta + condition log on a resolved Rend hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Rend', formula: '1d10 + 4', total: 10, rolls: [6], modifier: 4, context: {
            targetName: 'Bandit 1',
            damageType: 'Slashing',
            attackerName: 'Displacer Beast 1',
            hitClause: buildHitConditionClause(DISPLACER_BEAST_REND_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[0]).toBe('Bandit 1');
        expect(condCall[2]).toEqual(['prone']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ prone: { source: 'Displacer Beast 1' } });
        expect(metaCall[2].prone.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Prone',
            reason: 'Rend (escape DC —)',
        }));
    });

    it('skips the prone clause for Huge or larger targets', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Hill Giant 1', type: 'monster', size: 'Huge', ac: 13, currentHp: 999, maxHp: 999 }],
        });
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Rend', formula: '1d10 + 4', total: 10, rolls: [6], modifier: 4, context: {
            targetName: 'Hill Giant 1',
            damageType: 'Slashing',
            attackerName: 'Displacer Beast 1',
            hitClause: buildHitConditionClause(DISPLACER_BEAST_REND_ACTION),
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Hill Giant 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });

    it('grants nothing when the Rend attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Rend', formula: '1d10 + 4', total: 10, rolls: [6], modifier: 4, context: {
            targetName: 'Bandit 1',
            damageType: 'Slashing',
            attackerName: 'Displacer Beast 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const DJINNI = monsters.find(m => m.index === 'djinni');
const DJINNI_STORM_BOLT_ACTION = DJINNI.actions[2];

describe('MA-0609 Djinni Storm Bolt prone hit-clause', () => {
    const deps = {
        characterName: 'Djinni 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Djinni 1', computedStats: { armorClass: 17 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 11, newHp: 988, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'monster', size: 'Medium or Small', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0609 data-lock: authors hit_conditions:["prone"] with no escape_dc on the Storm Bolt row', () => {
        expect(DJINNI_STORM_BOLT_ACTION.name).toBe('Storm Bolt');
        expect(DJINNI_STORM_BOLT_ACTION.attack_bonus).toBe(9);
        expect(DJINNI_STORM_BOLT_ACTION.range).toBe('120 feet');
        expect(DJINNI_STORM_BOLT_ACTION.damage_dice_primary).toBe('3d8');
        expect(DJINNI_STORM_BOLT_ACTION.damage_type_primary).toBe('Thunder');
        expect(DJINNI_STORM_BOLT_ACTION.hit_conditions).toEqual(['prone']);
        expect(DJINNI_STORM_BOLT_ACTION.escape_dc).toBeUndefined();
        expect(DJINNI_STORM_BOLT_ACTION.save_dc).toBeUndefined();
        expect(DJINNI_STORM_BOLT_ACTION.description).toContain('Prone');
        // §115 decoy save_effect retained byte-identical per house pattern
        // (verified twins MA-0480 Chain Devil / MA-0522 Couatl / MA-0527 Crocodile keep theirs)
        expect(DJINNI_STORM_BOLT_ACTION.save_effect).toBe('If the target is a Large or smaller creature, it has the Prone condition.');
    });

    it('builds a prone-only clause with no escape DC', () => {
        expect(buildHitConditionClause(DJINNI_STORM_BOLT_ACTION)).toEqual({
            conditions: ['prone'],
            escapeDc: null,
            attackName: 'Storm Bolt',
            targetEffect: null,
        });
    });

    it('applies Prone + attacker-source meta + condition log on a resolved Storm Bolt hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Storm Bolt', formula: '3d8', total: 11, rolls: [3, 6, 2], modifier: 0, context: {
            targetName: 'Bandit 1',
            damageType: 'Thunder',
            attackerName: 'Djinni 1',
            hitClause: buildHitConditionClause(DJINNI_STORM_BOLT_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[0]).toBe('Bandit 1');
        expect(condCall[2]).toEqual(['prone']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ prone: { source: 'Djinni 1' } });
        expect(metaCall[2].prone.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Prone',
            reason: 'Storm Bolt (escape DC —)',
        }));
    });

    it('skips the prone clause for Huge or larger targets', async () => {
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Hill Giant 1', type: 'monster', size: 'Huge', ac: 13, currentHp: 999, maxHp: 999 }],
        });
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Storm Bolt', formula: '3d8', total: 11, rolls: [3, 6, 2], modifier: 0, context: {
            targetName: 'Hill Giant 1',
            damageType: 'Thunder',
            attackerName: 'Djinni 1',
            hitClause: buildHitConditionClause(DJINNI_STORM_BOLT_ACTION),
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Hill Giant 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });

    it('grants nothing when Storm Bolt misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Storm Bolt', formula: '3d8', total: 11, rolls: [3, 6, 2], modifier: 0, context: {
            targetName: 'Bandit 1',
            damageType: 'Thunder',
            attackerName: 'Djinni 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const EMPYREAN = monsters.find(m => m.index === 'empyrean');
const SACRED_WEAPON_ACTION = EMPYREAN.actions[1];

describe('MA-0691 Empyrean Sacred Weapon stunned hit-clause', () => {
    const deps = {
        characterName: 'Empyrean 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Empyrean 1', computedStats: { armorClass: 22 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 31, newHp: 968, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'monster', size: 'Medium or Small', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0691 data-lock: authors hit_conditions:["stunned"] with no escape_dc on the Sacred Weapon row', () => {
        expect(SACRED_WEAPON_ACTION.name).toBe('Sacred Weapon');
        expect(SACRED_WEAPON_ACTION.attack_bonus).toBe(17);
        expect(SACRED_WEAPON_ACTION.reach).toBe('10 ft.');
        expect(SACRED_WEAPON_ACTION.damage_dice_primary).toBe('6d6 + 10');
        expect(SACRED_WEAPON_ACTION.damage_type_primary).toBe('Force');
        expect(SACRED_WEAPON_ACTION.hit_conditions).toEqual(['stunned']);
        expect(SACRED_WEAPON_ACTION.escape_dc).toBeUndefined();
        expect(SACRED_WEAPON_ACTION.save_dc).toBeUndefined();
        expect(SACRED_WEAPON_ACTION.description).toContain('Stunned');
        // MA-0621 byte-shape twin: no save in prose, so no escape_dc / save_dc.
        // Opt-out extra-21 clause is design-ticket advisory (§107) — no structured
        // opt-out transport authored; the row pins only the base stunned grant.
        expect(SACRED_WEAPON_ACTION.opt_out_clause).toBeUndefined();
    });

    it('builds a stunned-only clause with no escape DC', () => {
        expect(buildHitConditionClause(SACRED_WEAPON_ACTION)).toEqual({
            conditions: ['stunned'],
            escapeDc: null,
            attackName: 'Sacred Weapon',
            targetEffect: null,
        });
    });

    it('applies Stunned + attacker-source meta + condition log on a resolved Sacred Weapon hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Sacred Weapon', formula: '6d6 + 10', total: 21, rolls: [4, 5, 1, 6, 3, 2], modifier: 10, context: {
            targetName: 'Bandit 1',
            damageType: 'Force',
            attackerName: 'Empyrean 1',
            hitClause: buildHitConditionClause(SACRED_WEAPON_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[0]).toBe('Bandit 1');
        expect(condCall[2]).toEqual(['stunned']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ stunned: { source: 'Empyrean 1' } });
        expect(metaCall[2].stunned.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Stunned',
            reason: 'Sacred Weapon (escape DC —)',
        }));
    });

    it('grants nothing when Sacred Weapon misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Sacred Weapon', formula: '6d6 + 10', total: 21, rolls: [1, 5, 1, 6, 3, 2], modifier: 10, context: {
            targetName: 'Bandit 1',
            damageType: 'Force',
            attackerName: 'Empyrean 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const ETTERCAP = monsters.find(m => m.index === 'ettercap');
const ETTERCAP_BITE_ACTION = ETTERCAP.actions[1];

describe('MA-0704 Ettercap Bite poisoned hit-clause', () => {
    const deps = {
        characterName: 'Ettercap 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Ettercap 1', computedStats: { armorClass: 13 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 9, newHp: 990, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'monster', size: 'Medium or Small', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0704 data-lock: authors hit_conditions:["poisoned"] appended after damage fields on the Bite row', () => {
        expect(ETTERCAP_BITE_ACTION.name).toBe('Bite');
        expect(ETTERCAP_BITE_ACTION.attack_bonus).toBe(4);
        expect(ETTERCAP_BITE_ACTION.reach).toBe('5 ft.');
        expect(ETTERCAP_BITE_ACTION.damage_dice_primary).toBe('1d6 + 2');
        expect(ETTERCAP_BITE_ACTION.damage_type_primary).toBe('Piercing');
        expect(ETTERCAP_BITE_ACTION.damage_dice_secondary).toBe('1d4');
        expect(ETTERCAP_BITE_ACTION.damage_type_secondary).toBe('Poison');
        expect(ETTERCAP_BITE_ACTION.hit_conditions).toEqual(['poisoned']);
        expect(ETTERCAP_BITE_ACTION.escape_dc).toBeUndefined();
        expect(ETTERCAP_BITE_ACTION.save_dc).toBeUndefined();
        expect(ETTERCAP_BITE_ACTION.description).toContain('Poisoned');
        // MA-0621 byte-shape twin: save_effect prose stays (decoy field), hit_conditions
        // appended after damage fields; attack chip rides no save.
        expect(ETTERCAP.actions[0].hit_conditions).toBeUndefined();
        expect(ETTERCAP.actions[2].hit_conditions).toBeUndefined();
    });

    it('builds a poisoned-only clause with no escape DC', () => {
        expect(buildHitConditionClause(ETTERCAP_BITE_ACTION)).toEqual({
            conditions: ['poisoned'],
            escapeDc: null,
            attackName: 'Bite',
            targetEffect: null,
        });
    });

    it('applies Poisoned + attacker-source meta + condition log on a resolved Bite hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '1d6 + 2', total: 6, rolls: [4], modifier: 2, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Ettercap 1',
            hitClause: buildHitConditionClause(ETTERCAP_BITE_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[0]).toBe('Bandit 1');
        expect(condCall[2]).toEqual(['poisoned']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[2]).toMatchObject({ poisoned: { source: 'Ettercap 1' } });
        expect(metaCall[2].poisoned.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Poisoned',
            reason: 'Bite (escape DC —)',
        }));
    });

    it('keeps combined primary + secondary damage legs intact alongside the Poisoned grant', async () => {
        rollExpression.mockImplementation((f) => (f === '1d4' ? { total: 3, rolls: [3], modifier: 0 } : null));
        applyDamageToTarget.mockImplementation(async (cs, name, dmg, types) => (
            types[0] === 'Poison'
                ? { finalDamage: 3, newHp: 990, damageReduced: false }
                : { finalDamage: dmg, newHp: 993, damageReduced: false }
        ));
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '1d6 + 2', total: 6, rolls: [4], modifier: 2, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Ettercap 1',
            autoDamageSecondaryFormula: '1d4',
            autoDamageSecondaryType: 'Poison',
            hitClause: buildHitConditionClause(ETTERCAP_BITE_ACTION),
        } });

        expect(applyDamageToTarget).toHaveBeenCalled();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'roll',
            rollType: 'damage',
            characterName: 'Ettercap 1',
            finalDamage: 6,
            note: 'combined_damage_roll',
            secondaryFinalDamage: 3,
        }));
        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[2]).toEqual(['poisoned']);
    });

    it('grants nothing when the Bite attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Bite', formula: '1d6 + 2', total: 6, rolls: [1], modifier: 2, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Ettercap 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const FIRE_GIANT = monsters.find(m => m.index === 'fire-giant');
const HAMMER_THROW_ACTION = FIRE_GIANT.actions.find(a => a.name === 'Hammer Throw');

describe('MA-0733 Fire Giant Hammer Throw disadvantage_next_attack hit-clause', () => {
    const deps = {
        characterName: 'Fire Giant 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Fire Giant 1', computedStats: { armorClass: 18 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getEffectDefinition.mockImplementation((key) => ({
            effect: key,
            label: 'Disadv Next Attack',
            description: 'Disadvantage on the next attack roll.',
            group: 'Attack',
        }));
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 16, newHp: 983, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'player', size: 'Medium', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0733 data-lock: Hammer Throw row authors hit_target_effect:"disadvantage_next_attack" (+11 ranged 60/240 ft., 3d10 + 7 Bludgeoning + 1d8 Fire)', () => {
        expect(HAMMER_THROW_ACTION.attack_bonus).toBe(11);
        expect(HAMMER_THROW_ACTION.range).toBe('60/240 ft.');
        expect(HAMMER_THROW_ACTION.damage_dice_primary).toBe('3d10 + 7');
        expect(HAMMER_THROW_ACTION.damage_type_primary).toBe('Bludgeoning');
        expect(HAMMER_THROW_ACTION.damage_dice_secondary).toBe('1d8');
        expect(HAMMER_THROW_ACTION.damage_type_secondary).toBe('Fire');
        expect(HAMMER_THROW_ACTION.hit_target_effect).toBe('disadvantage_next_attack');
        expect(HAMMER_THROW_ACTION.hit_conditions).toBeUndefined();
        expect(HAMMER_THROW_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a targetEffect-only clause from the Hammer Throw row', () => {
        expect(buildHitConditionClause(HAMMER_THROW_ACTION)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Hammer Throw',
            targetEffect: 'disadvantage_next_attack',
        });
    });

    it('registers the disadvantage_next_attack te on the victim, sourced from the giant, on a resolved hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Hammer Throw', formula: '3d10 + 7', total: 16, rolls: [1, 7, 1], modifier: 7, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Fire Giant 1',
            hitClause: buildHitConditionClause(HAMMER_THROW_ACTION),
        } });

        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Bandit 1',
            'disadvantage_next_attack',
            'Fire Giant 1',
            { duration: 'until_start_of_next_turn' }
        );
    });

    it('MA-0733 clock-lock: grants ONE addExpiration clock anchored on the giant (MA-0016/MA-0542 anchor leg; RAW end-of-turn anchor advisory)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Hammer Throw', formula: '3d10 + 7', total: 16, rolls: [1, 7, 1], modifier: 7, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Fire Giant 1',
            hitClause: buildHitConditionClause(HAMMER_THROW_ACTION),
        } });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Fire Giant 1',
            targetName: 'Bandit 1',
            effects: [{ type: 'remove_target_effect', effectKey: 'disadvantage_next_attack', source: 'Fire Giant 1', target: 'Bandit 1' }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'Fire Giant 1',
        });
    });

    it('logs condition-applied with the registry label and writes no raw activeConditions', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Hammer Throw', formula: '3d10 + 7', total: 16, rolls: [1, 7, 1], modifier: 7, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Fire Giant 1',
            hitClause: buildHitConditionClause(HAMMER_THROW_ACTION),
        } });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Disadv Next Attack',
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
    });

    it('keeps combined primary + secondary damage legs intact alongside the te grant', async () => {
        rollExpression.mockImplementation((f) => (f === '1d8' ? { total: 5, rolls: [5], modifier: 0 } : null));
        applyDamageToTarget.mockImplementation(async (cs, name, dmg, types) => (
            types[0] === 'Fire'
                ? { finalDamage: 5, newHp: 978, damageReduced: false }
                : { finalDamage: dmg, newHp: 983, damageReduced: false }
        ));
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Hammer Throw', formula: '3d10 + 7', total: 16, rolls: [1, 7, 1], modifier: 7, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Fire Giant 1',
            autoDamageSecondaryFormula: '1d8',
            autoDamageSecondaryType: 'Fire',
            hitClause: buildHitConditionClause(HAMMER_THROW_ACTION),
        } });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'roll',
            rollType: 'damage',
            characterName: 'Fire Giant 1',
            formula: '3d10 + 7',
            finalDamage: 16,
            note: 'combined_damage_roll',
            secondaryFormula: '1d8',
            secondaryFinalDamage: 5,
        }));
        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Bandit 1',
            'disadvantage_next_attack',
            'Fire Giant 1',
            { duration: 'until_start_of_next_turn' }
        );
    });

    it('grants nothing when the Hammer Throw attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Hammer Throw', formula: '3d10 + 7', total: 16, rolls: [1, 7, 1], modifier: 7, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Fire Giant 1',
        } });

        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

describe('MA-0733 disadvantage_next_attack te consumer', () => {
    it('bumps attackDisadvantageCount for the holder — one-shot channel feeding combineAttackModes', () => {
        const effects = computeConditionEffects({
            targetEffects: [{ effect: 'disadvantage_next_attack', target: 'Bandit 1', source: 'Fire Giant 1' }],
        });
        expect(effects.attackDisadvantageCount).toBeGreaterThanOrEqual(1);
        expect(combineAttackModes(effects, computeConditionEffects({}), null, 'Bandit 1')).toBe('disadvantage');
    });
});

const HILL_GIANT = monsters.find(m => m.index === 'hill-giant');
const TRASH_LOB_ACTION = HILL_GIANT.actions[2];

describe('MA-0984 Hill Giant Trash Lob poisoned-on-hit hit-clause', () => {
    const deps = {
        characterName: 'Hill Giant 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Hill Giant 1', computedStats: { armorClass: 13 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 9, newHp: 990, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0984 data-lock: Trash Lob authors hit_conditions:["poisoned"] and NO save_effect decoy (§410 wrong-slot fix)', () => {
        expect(TRASH_LOB_ACTION.name).toBe('Trash Lob');
        expect(TRASH_LOB_ACTION.attack_bonus).toBe(8);
        expect(TRASH_LOB_ACTION.range).toBe('60/240 ft.');
        expect(TRASH_LOB_ACTION.damage_dice_primary).toBe('2d10 + 5');
        expect(TRASH_LOB_ACTION.damage_type_primary).toBe('Bludgeoning');
        expect(TRASH_LOB_ACTION.hit_conditions).toEqual(['poisoned']);
        expect(TRASH_LOB_ACTION.save_effect).toBeUndefined();
        expect(TRASH_LOB_ACTION.save_dc).toBeUndefined();
        expect(TRASH_LOB_ACTION.save_type).toBeUndefined();
        expect(TRASH_LOB_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a poisoned-only clause with no escape DC', () => {
        expect(buildHitConditionClause(TRASH_LOB_ACTION)).toEqual({
            conditions: ['poisoned'],
            escapeDc: null,
            attackName: 'Trash Lob',
            targetEffect: null,
        });
    });

    it('applies Poisoned + attacker-source meta + condition log on a resolved Trash Lob hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Trash Lob', formula: '2d10 + 5', total: 9, rolls: [1, 3], modifier: 5, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Hill Giant 1',
            hitClause: buildHitConditionClause(TRASH_LOB_ACTION),
        } });

        const condCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditions');
        expect(condCall).toBeTruthy();
        expect(condCall[0]).toBe('Bandit 1');
        expect(condCall[2]).toEqual(['poisoned']);
        const metaCall = setRuntimeValue.mock.calls.find(c => c[1] === 'activeConditionMeta');
        expect(metaCall).toBeTruthy();
        expect(metaCall[0]).toBe('Bandit 1');
        expect(metaCall[2]).toMatchObject({ poisoned: { source: 'Hill Giant 1' } });
        expect(metaCall[2].poisoned.dc).toBeUndefined();
        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Poisoned',
            reason: 'Trash Lob (escape DC —)',
        }));
    });

    it('writes no condition when the Trash Lob attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Trash Lob', formula: '2d10 + 5', total: 9, rolls: [1, 3], modifier: 5, context: {
            targetName: 'Bandit 1',
            damageType: 'Bludgeoning',
            attackerName: 'Hill Giant 1',
        } });

        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditionMeta', expect.anything(), 'test-campaign'
        );
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});

const HOBGOBLIN_WARLORD = monsters.find(m => m.index === 'hobgoblin-warlord');
const JAVELIN_ACTION = HOBGOBLIN_WARLORD.actions[1];

describe('MA-0995 Hobgoblin Warlord Javelin speed_reduction hit-clause passthrough', () => {
    const deps = {
        characterName: 'Hobgoblin Warlord 1',
        campaignName: 'test-campaign',
        characters: [
            { name: 'Hobgoblin Warlord 1', computedStats: { armorClass: 17 } },
            { name: 'Bandit 1', computedStats: { armorClass: 12 } },
        ],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        pendingSaves: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getEffectDefinition.mockImplementation((key) => ({
            effect: key,
            label: 'Speed Reduced',
            description: 'The creature\'s Speed is reduced by N feet.',
            group: 'Movement',
        }));
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockReturnValue({ finalDamage: 11, newHp: 988, damageReduced: false });
        loadCombatSummary.mockResolvedValue({
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium', ac: 12, currentHp: 999, maxHp: 999 }],
        });
    });

    it('MA-0995 data-lock: Javelin authors hit_target_effect:"speed_reduction" and NO save_effect decoy (§410 wrong-slot fix; attack core exact)', () => {
        expect(JAVELIN_ACTION.attack_bonus).toBe(6);
        expect(JAVELIN_ACTION.reach).toBe('5 ft.');
        expect(JAVELIN_ACTION.range).toBe('30/120 ft.');
        expect(JAVELIN_ACTION.damage_dice_primary).toBe('2d6 + 4');
        expect(JAVELIN_ACTION.damage_type_primary).toBe('Piercing');
        expect(JAVELIN_ACTION.hit_target_effect).toBe('speed_reduction');
        expect(JAVELIN_ACTION.save_effect).toBeUndefined();
        expect(JAVELIN_ACTION.save_dc).toBeUndefined();
        expect(JAVELIN_ACTION.save_type).toBeUndefined();
        expect(JAVELIN_ACTION.escape_dc).toBeUndefined();
    });

    it('builds a targetEffect-only clause from the Javelin row', () => {
        expect(buildHitConditionClause(JAVELIN_ACTION)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Javelin',
            targetEffect: 'speed_reduction',
        });
    });

    it('registers the speed_reduction te on the victim, sourced from the hobgoblin, on a resolved hit', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Javelin', formula: '2d6 + 4', total: 11, rolls: [3, 4], modifier: 4, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Hobgoblin Warlord 1',
            hitClause: buildHitConditionClause(JAVELIN_ACTION),
        } });

        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Bandit 1',
            'speed_reduction',
            'Hobgoblin Warlord 1',
            { duration: 'until_start_of_next_turn' }
        );
    });

    it('MA-0995 clock-lock: grants ONE addExpiration anchored on the hobgoblin — RAW "until the start of the hobgoblin\'s next turn" (§37 single-clock, no invented expiry)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Javelin', formula: '2d6 + 4', total: 11, rolls: [3, 4], modifier: 4, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Hobgoblin Warlord 1',
            hitClause: buildHitConditionClause(JAVELIN_ACTION),
        } });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith({
            attackerName: 'Hobgoblin Warlord 1',
            targetName: 'Bandit 1',
            effects: [{ type: 'remove_target_effect', effectKey: 'speed_reduction', source: 'Hobgoblin Warlord 1', target: 'Bandit 1' }],
            campaignName: 'test-campaign',
            rounds: undefined,
            expireOnCreatureName: 'Hobgoblin Warlord 1',
        });
    });

    it('logs condition-applied with the registry label, writes no raw activeConditions, and pays damage exactly once (no double-pay)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Javelin', formula: '2d6 + 4', total: 11, rolls: [3, 4], modifier: 4, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Hobgoblin Warlord 1',
            hitClause: buildHitConditionClause(JAVELIN_ACTION),
        } });

        expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
            type: 'condition',
            action: 'applied',
            characterName: 'Bandit 1',
            condition: 'Speed Reduced',
            reason: "Javelin — until the start of Hobgoblin Warlord 1's next turn",
        }));
        expect(setRuntimeValue).not.toHaveBeenCalledWith(
            'Bandit 1', 'activeConditions', expect.anything(), 'test-campaign'
        );
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    });

    it('grants nothing when the Javelin attack misses (no clause reaches the damage leg)', async () => {
        const fn = createLogDamageAndShow(deps);
        await fn({ name: 'Javelin', formula: '2d6 + 4', total: 11, rolls: [3, 4], modifier: 4, context: {
            targetName: 'Bandit 1',
            damageType: 'Piercing',
            attackerName: 'Hobgoblin Warlord 1',
        } });

        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'condition' }));
    });
});
