// @maintained-by-ai: 2026-10-14
// MA-1728: Wraith "Life Drain" HP-max-drain rider — wraith-row twin of the
// MA-1489 Specter lane. The row authors hit_hp_max_reduce:{equal_to:"damage"}
// (previously byte-inert, key ABSENT), so the LIVE attack-hit-path drain seam
// (parseHitHpMaxReduce → buildHitConditionClause.hpMaxReduce →
// handlePlainDamage.maybeApplyHitClause → applyHitHpMaxReduce →
// hpMaxReduceService.applyHpMaxReduce) arms on THIS row: every resolved hit
// reduces the victim's cs maxHp by exactly the necrotic damage applied,
// accumulates the hp_max_reduce te ledger, logs the grant, NO clock.
// This file owns ONLY the wraith-row contract — the shared drain core is
// unit-covered by the MA-1547 save-path suite; parser byte-inert grammar,
// registry spec, accumulation, PC routing, death clamp, zero state, and LR
// clear keys are pinned by the MA-1489 twin; secondary-pool scoping +
// attacker regain by MA-1645.
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
const CREATE_SPECTER = WRAITH.actions[1];

describe('MA-1728 Wraith Life Drain hp_max_reduce producer', () => {
    const deps = {
        characterName: 'Wraith 1',
        campaignName: 'test-campaign',
        characters: [{ name: 'Bandit 1', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    async function resolveHit({ finalDamage = 7 } = {}) {
        const cs = {
            round: 1,
            creatures: [{ name: 'Bandit 1', type: 'npc', size: 'Medium or Small', ac: 12, currentHp: 11, maxHp: 11 }],
        };
        applyDamageToTarget.mockResolvedValue({ finalDamage, newHp: 11 - finalDamage, damageReduced: false });
        await createPlainDamageHandler(deps)({
            name: 'Life Drain', formula: '4d8 + 3', total: 7, rolls: [2, 2, 2, 2], modifier: 3,
            adjustedTotal: 7, combatSummary: cs,
            context: { targetName: 'Bandit 1', damageType: 'Necrotic', attackerName: 'Wraith 1', hitClause: buildHitConditionClause(LIFE_DRAIN) },
        });
        return cs.creatures.find(c => c.name === 'Bandit 1');
    }

    it('DATA & PARSER: wraith.actions[0] authors the structured HP-max rider — bytes byte-pinned, key position pinned, parser arms; Create Specter row byte-inert', () => {
        expect(LIFE_DRAIN.hit_hp_max_reduce).toEqual({ equal_to: 'damage' });
        expect(LIFE_DRAIN.attack_bonus).toBe(6);
        expect(LIFE_DRAIN.reach).toBe('5 ft.');
        expect(LIFE_DRAIN.damage_dice_primary).toBe('4d8 + 3');
        expect(LIFE_DRAIN.damage_type_primary).toBe('Necrotic');
        expect(LIFE_DRAIN.description).toBe('Melee Attack Roll: +6, reach 5 ft. Hit: 21 (4d8 + 3) Necrotic damage. If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.');
        const keys = Object.keys(LIFE_DRAIN);
        expect(keys.indexOf('hit_hp_max_reduce')).toBe(keys.indexOf('damage_type_primary') + 1);

        expect(parseHitHpMaxReduce(LIFE_DRAIN)).toEqual({ equalTo: 'damage' });
        expect(buildHitConditionClause(LIFE_DRAIN)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Life Drain',
            targetEffect: null,
            hpMaxReduce: { equalTo: 'damage' },
        });
        expect(CREATE_SPECTER.hit_hp_max_reduce).toBeUndefined();
        expect(parseHitHpMaxReduce(CREATE_SPECTER)).toBeNull();
        expect(buildHitConditionClause(CREATE_SPECTER)).toBeNull();
    });

    it('HIT: live wraith lane — cs maxHp drops by exactly the necrotic damage applied, currentHp clamps, te ledger {baseMax,reduced,max} + drain log land, NO clock', async () => {
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
});
