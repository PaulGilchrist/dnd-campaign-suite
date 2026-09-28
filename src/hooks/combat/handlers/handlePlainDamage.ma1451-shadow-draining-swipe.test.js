// MA-1451: Shadow "Draining Swipe" Strength-drain rider — the fix that made
// the promised numeric drain LAND (was FAIL(a) zero-state, §942: zero producers
// AND zero consumers app-wide). Locks: (1) shadow.actions[0] carries the
// structured hit_ability_drain key (byte-shape); (2) parseHitAbilityDrain is
// structured-key-only (byte-inert null elsewhere); (3) on every resolved hit
// the consumer rolls the die, registers the ability_score_drain te ledger
// {baseScore, drained, score}, logs the roll + the grant, and never touches
// HP via the drain itself; (4) cumulative accumulation across hits; (5) the
// RAW death clause clamps lethal via the canonical applyDamageToTarget choke
// point (MA-0352 twin); (6) no addExpiration clock — long-rest restore is the
// te convention (restRules-longRest LR filter).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn((formula) => formula === '1d4' ? { rolls: [3], total: 3 } : { rolls: [5], total: 7 }),
    rollExpressionDoubled: vi.fn(),
    parseConstant: vi.fn(),
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
    setRuntimeObject: vi.fn(() => Promise.resolve()),
    getAllStoreKeys: vi.fn(() => []),
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

vi.mock('../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../../../services/npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
}));

vi.mock('../../../services/combat/conditions/targetEffectDefinitions.js', () => ({
    registerTargetEffect: vi.fn(),
    getActiveTargetEffect: vi.fn(() => null),
    getEffectDefinition: vi.fn((key) => key === 'ability_score_drain'
        ? { effect: key, label: 'Ability Score Drain', description: 'Ability score reduced by the drained total; returns on a long rest.', group: 'Saves & Checks' }
        : { effect: key, label: key, group: 'Defensive' }),
}));

vi.mock('../../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { getMonsterData } from '../../../services/npcs/monsterUtils.js';
import { registerTargetEffect } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import { createPlainDamageHandler } from './handlePlainDamage.js';
import { buildHitConditionClause, parseHitAbilityDrain } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const SHADOW = monsters.find(m => m.index === 'shadow');
const SWIPE = SHADOW.actions[0];

describe('MA-1451 Shadow Draining Swipe ability_score_drain producer', () => {
    const deps = {
        characterName: 'Shadow 1',
        campaignName: 'test-campaign',
        characters: [{ name: 'Bandit 1', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };
    const combatSummary = {
        round: 1,
        creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium or Small', ac: 12, currentHp: 991, maxHp: 999 }],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 7, newHp: 984, damageReduced: false });
        getMonsterData.mockResolvedValue({ name: 'Bandit', ability_scores: { str: 11, dex: 12, con: 12, int: 10, wis: 11, cha: 10 } });
    });

    function hitContext(size) {
        return {
            targetName: size ? undefined : 'Bandit 1',
            damageType: 'Necrotic',
            attackerName: 'Shadow 1',
            hitClause: buildHitConditionClause(SWIPE),
        };
    }

    async function resolveHit({ cs = combatSummary, targetName = 'Bandit 1', size } = {}) {
        const handler = createPlainDamageHandler(deps);
        await handler({
            name: 'Draining Swipe', formula: '1d6 + 2', total: 7, rolls: [5], modifier: 2,
            adjustedTotal: 7, combatSummary: cs,
            context: { ...hitContext(size), targetName },
        });
    }

    it('DATA: shadow.actions[0] authors the structured drain rider (byte-shape pin)', () => {
        expect(SWIPE.hit_ability_drain).toEqual({ ability: 'str', dice: '1d4' });
        expect(SWIPE.attack_bonus).toBe(4);
        expect(SWIPE.damage_dice_primary).toBe('1d6 + 2');
    });

    it('PARSER: buildHitConditionClause carries abilityDrain; every other row stays byte-inert', () => {
        expect(buildHitConditionClause(SWIPE)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Draining Swipe',
            targetEffect: null,
            abilityDrain: { ability: 'str', dice: '1d4' },
        });
        expect(parseHitAbilityDrain({})).toBeNull();
        expect(parseHitAbilityDrain({ hit_ability_drain: { ability: 'xyz', dice: '1d4' } })).toBeNull();
        expect(parseHitAbilityDrain({ hit_ability_drain: { ability: 'str', dice: 'd4' } })).toBeNull();
        const banditRow = monsters.find(m => m.name === 'Bandit').actions.find(a => a.attack_bonus != null);
        expect(parseHitAbilityDrain(banditRow)).toBeNull();
        expect(buildHitConditionClause(banditRow)).toBeNull();
    });

    it('HIT: rolls the die, registers the te ledger, logs roll + grant — HP legs untouched by the drain', async () => {
        await resolveHit();

        expect(getMonsterData).toHaveBeenCalledWith('Bandit 1', null);
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);

        const drainRoll = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.type === 'roll' && e.rollType === 'ability-drain');
        expect(drainRoll).toMatchObject({
            characterName: 'Shadow 1',
            formula: '1d4',
            rolls: [3],
            total: 3,
            targetName: 'Bandit 1',
        });
        const grant = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Strength Drain');
        expect(grant.reason).toContain('Strength 11 → 8 (−3)');
        expect(registerTargetEffect).toHaveBeenCalledTimes(1);
    });

    it('LEDGER: te payload carries baseScore/drained/score until_long_rest (no combat clock)', async () => {
        await resolveHit();

        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Bandit 1',
            'ability_score_drain',
            'Shadow 1',
            { ability: 'str', baseScore: 11, drained: 3, score: 8, duration: 'until_long_rest' },
        );
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('ACCUMULATE: a standing ledger accumulates the delta without re-fetching the statblock', async () => {
        const standing = { target: 'Bandit 1', effect: 'ability_score_drain', ability: 'str', baseScore: 11, drained: 4, score: 7, source: 'Shadow 1', duration: 'until_long_rest' };
        getRuntimeValue.mockImplementation((name, key) => (key === 'targetEffects' ? [standing] : null));

        await resolveHit();

        expect(getMonsterData).not.toHaveBeenCalled();
        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Bandit 1',
            'ability_score_drain',
            'Shadow 1',
            { ability: 'str', baseScore: 11, drained: 7, score: 4, duration: 'until_long_rest' },
        );
    });

    it('DEATH CLAUSE: score reaching 0 clamps lethal via applyDamageToTarget + logs ability_drain_lethal', async () => {
        const standing = { target: 'Bandit 1', effect: 'ability_score_drain', ability: 'str', baseScore: 11, drained: 9, score: 2, source: 'Shadow 1', duration: 'until_long_rest' };
        getRuntimeValue.mockImplementation((name, key) => (key === 'targetEffects' ? [standing] : null));

        await resolveHit();

        const lethalCall = applyDamageToTarget.mock.calls.find(c => c[2] === 991);
        expect(lethalCall).toBeTruthy();
        expect(lethalCall[3]).toEqual(['Necrotic']);
        expect(lethalCall[4]).toMatchObject({ campaignName: 'test-campaign', ignoreResistance: true, attackerName: 'Shadow 1' });
        const lethalLog = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.automationType === 'ability_drain_lethal');
        expect(lethalLog.description).toContain('dies');
    });

    it('SIZE-INDEPENDENT: a Huge target is drained (no RAW size gate) — clause size gate stays for the other legs', async () => {
        const csHuge = {
            round: 1,
            creatures: [{ name: 'Ogre 1', type: 'npc', size: 'Huge', ac: 11, currentHp: 59, maxHp: 59 }],
        };
        getMonsterData.mockResolvedValue({ name: 'Ogre', ability_scores: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 } });

        await resolveHit({ cs: csHuge, targetName: 'Ogre 1' });

        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Ogre 1',
            'ability_score_drain',
            'Shadow 1',
            { ability: 'str', baseScore: 19, drained: 3, score: 16, duration: 'until_long_rest' },
        );
    });

    it('BYTE-INERT PIPELINE: a damage row without the drain rider registers nothing and logs no drain', async () => {
        const clause = buildHitConditionClause({ name: 'Scimitar', attack_bonus: 5, damage_dice_primary: '1d6 + 1' });
        expect(clause).toBeNull();

        await createPlainDamageHandler(deps)({
            name: 'Scimitar', formula: '1d6 + 1', total: 6, rolls: [5], modifier: 1,
            adjustedTotal: 6, combatSummary,
            context: { targetName: 'Bandit 1', damageType: 'Slashing', attackerName: 'Shadow 1', hitClause: clause },
        });

        expect(deps.logEntry.mock.calls.map(c => c[0]).some(e => e.rollType === 'ability-drain')).toBe(false);
        expect(getMonsterData).not.toHaveBeenCalled();
    });
});
