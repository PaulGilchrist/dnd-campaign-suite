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
