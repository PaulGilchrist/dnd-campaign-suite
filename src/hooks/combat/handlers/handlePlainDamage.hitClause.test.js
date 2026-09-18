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

import { getRuntimeValue, setRuntimeValue } from '../../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../../services/encounters/combatData.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { createLogDamageAndShow } from '../useLoggedDiceRollDamage.js';
import { buildHitConditionClause } from '../../../components/encounter/MonsterCardHelpers.js';
import { registerTargetEffect } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
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
