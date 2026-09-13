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
