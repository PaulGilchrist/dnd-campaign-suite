// MA-1728: Wraith "Life Drain" HP-max-drain rider — FAIL(a)/DATA fixed at
// the data layer: the row now authors hit_hp_max_reduce:{equal_to:"damage"},
// the Specter actions[0] byte-twin (MA-1489), so the LIVE attack-hit-path
// drain seam (parseHitHpMaxReduce → buildHitConditionClause.hpMaxReduce →
// handlePlainDamage.maybeApplyHitClause → applyHitHpMaxReduce →
// hpMaxReduceService.applyHpMaxReduce) arms on this row: every resolved hit
// reduces the victim's cs maxHp by exactly the necrotic damage applied,
// accumulates the hp_max_reduce te ledger {baseMax, reduced, max}, and logs
// each leg — previously byte-inert (key ABSENT on wraith.actions[0],
// structured-key-only parser never armed). Consumer suite byte-identical to
// the MA-1489 twin harness; only the row bytes (attack_bonus 6,
// "4d8 + 3") differ.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn((_formula) => ({ rolls: [6, 7, 7, 7], total: 27 })),
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

vi.mock('../../../services/ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

vi.mock('../../../services/combat/conditions/targetEffectDefinitions.js', async (importActual) => ({
    ...(await importActual()),
    registerTargetEffect: vi.fn(),
}));

vi.mock('../../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { registerTargetEffect } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import storage from '../../../services/ui/storage.js';
import { createPlainDamageHandler } from './handlePlainDamage.js';
import { buildHitConditionClause, parseHitHpMaxReduce } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const WRAITH = monsters.find(m => m.index === 'wraith');
const LIFE_DRAIN = WRAITH.actions[0];
const SPECTER_DRAIN = monsters.find(m => m.index === 'specter').actions[0];

describe('MA-1728 Wraith Life Drain hp_max_reduce producer', () => {
    const deps = {
        characterName: 'Wraith 1',
        campaignName: 'test-campaign',
        characters: [{ name: 'Bandit 1', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    function freshCs() {
        return {
            round: 1,
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium or Small', ac: 12, currentHp: 999, maxHp: 11 }],
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    async function resolveHit({ cs = freshCs(), targetName = 'Bandit 1', finalDamage = 7 } = {}) {
        applyDamageToTarget.mockResolvedValue({ finalDamage, newHp: 999 - finalDamage, damageReduced: false });
        await createPlainDamageHandler(deps)({
            name: 'Life Drain', formula: '4d8 + 3', total: 7, rolls: [1, 1, 1, 1], modifier: 3,
            adjustedTotal: 7, combatSummary: cs,
            context: { targetName, damageType: 'Necrotic', attackerName: 'Wraith 1', hitClause: buildHitConditionClause(LIFE_DRAIN) },
        });
        return cs.creatures.find(c => c.name === targetName);
    }

    it('DATA: wraith.actions[0] authors the structured HP-max rider as the specter byte-twin; existing bytes byte-pinned', () => {
        expect(LIFE_DRAIN.hit_hp_max_reduce).toEqual({ equal_to: 'damage' });
        expect(LIFE_DRAIN.attack_bonus).toBe(6);
        expect(LIFE_DRAIN.reach).toBe('5 ft.');
        expect(LIFE_DRAIN.damage_dice_primary).toBe('4d8 + 3');
        expect(LIFE_DRAIN.damage_type_primary).toBe('Necrotic');
        expect(LIFE_DRAIN.description).toBe('Melee Attack Roll: +6, reach 5 ft. Hit: 21 (4d8 + 3) Necrotic damage. If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.');
        expect(SPECTER_DRAIN.hit_hp_max_reduce).toEqual({ equal_to: 'damage' });
        const keys = Object.keys(LIFE_DRAIN);
        expect(keys.indexOf('hit_hp_max_reduce')).toBe(keys.indexOf('damage_type_primary') + 1);
    });

    it('PARSER: parseHitHpMaxReduce arms the wraith row; buildHitConditionClause carries hpMaxReduce', () => {
        expect(parseHitHpMaxReduce(LIFE_DRAIN)).toEqual({ equalTo: 'damage' });
        expect(buildHitConditionClause(LIFE_DRAIN)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Life Drain',
            targetEffect: null,
            hpMaxReduce: { equalTo: 'damage' },
        });
    });

    it('HIT: cs maxHp drops by exactly the necrotic damage applied, te ledger {baseMax,reduced,max} + drain log land, NO clock', async () => {
        const bandit = await resolveHit();

        expect(bandit.maxHp).toBe(4);
        expect(bandit.currentHp).toBe(4);
        expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({ round: 1 }), 'test-campaign');
        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Bandit 1',
            'hp_max_reduce',
            'Wraith 1',
            { baseMax: 11, reduced: 7, max: 4, duration: 'until_long_rest' },
        );
        const grant = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Max HP Reduced');
        expect(grant.reason).toBe('Life Drain — max HP 11 → 4 (−7, equal to damage taken)');
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('ACCUMULATE: standing ledger reduces within max and sums the drain', async () => {
        const standing = { target: 'Bandit 1', effect: 'hp_max_reduce', baseMax: 999, reduced: 30, max: 969, source: 'Wraith 1', duration: 'until_long_rest' };
        getRuntimeValue.mockImplementation((name, key) => (key === 'targetEffects' ? [standing] : null));

        const bandit = await resolveHit({ finalDamage: 12 });

        expect(bandit.maxHp).toBe(957);
        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Bandit 1',
            'hp_max_reduce',
            'Wraith 1',
            { baseMax: 999, reduced: 42, max: 957, duration: 'until_long_rest' },
        );
        const grant = deps.logEntry.mock.calls.map(c => c[0]).find(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Max HP Reduced');
        expect(grant.reason).toBe('Life Drain — max HP 969 → 957 (−12, equal to damage taken)');
    });

    it('BYTE-INERT: wraith Create Specter row and clauseless rows arm nothing — zero writes, zero drain logs', async () => {
        expect(parseHitHpMaxReduce(WRAITH.actions[1])).toBeNull();
        expect(buildHitConditionClause(WRAITH.actions[1])).toBeNull();

        await createPlainDamageHandler(deps)({
            name: 'Scimitar', formula: '1d6 + 1', total: 6, rolls: [5], modifier: 1,
            adjustedTotal: 6, combatSummary: freshCs(),
            context: { targetName: 'Bandit 1', damageType: 'Slashing', attackerName: 'Wraith 1' },
        });

        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(storage.set).not.toHaveBeenCalled();
        expect(deps.logEntry.mock.calls.map(c => c[0]).some(e => (e.automationType || '').startsWith('hp_max_reduce') || e.condition === 'Max HP Reduced')).toBe(false);
    });
});
