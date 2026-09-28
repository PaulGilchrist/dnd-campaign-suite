// MA-1459: Shambling Mound "Charged Tendril" size-conditional pull rider —
// the fix that made the promised transport clause LAND (was FAIL(a) zero-state,
// §944: pull clauses grep-zero-inert on attack rows). Locks: (1) shambling-
// mound.actions[1] carries the structured hit_pull key (byte-shape); (2)
// parseHitPull is structured-key-only (byte-inert null elsewhere); (3) on a
// resolved hit a Medium-or-smaller victim gets the registered pulled_toward te
// {duration:'instant', value:5} — the PC Warping Implosion pull-marker
// convention (SaveAttackAoeModal:191/:1485), NO addExpiration clock — plus ONE
// grant log carrying the RAW pull sentence + the §42 GM token-move advisory;
// (4) a Large victim is refused with a pull_refused log and zero te (the
// Medium gate is stricter than the family Large-or-smaller gate — it must run
// BEFORE it); (5) range sizes ("Medium or Small" — Bandit, MA-0553) pass on
// their LARGEST named size; (6) rows without the key stay byte-inert; (7) no
// resolved hit (miss lane, applyResult absent) produces zero pull state.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn((formula) => formula === '1d6 + 4' ? { rolls: [3], total: 7 } : { rolls: [2, 3], total: 5 }),
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
    getEffectDefinition: vi.fn((key) => ({ effect: key, label: key, group: 'Movement' })),
}));

vi.mock('../../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: vi.fn(),
}));

import { getRuntimeValue } from '../../runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../services/rules/combat/applyDamage.js';
import { registerTargetEffect } from '../../../services/combat/conditions/targetEffectDefinitions.js';
import { addExpiration } from '../../../services/rules/effects/expirationQueue.js';
import { createPlainDamageHandler } from './handlePlainDamage.js';
import { buildHitConditionClause, parseHitPull } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const MOUND = monsters.find(m => m.index === 'shambling-mound');
const TENDRIL = MOUND.actions.find(a => a.name === 'Charged Tendril');

describe('MA-1459 Shambling Mound Charged Tendril pulled_toward producer', () => {
    const deps = {
        characterName: 'Shambling Mound 1',
        campaignName: 'test-campaign',
        characters: [{ name: 'Bandit 1', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
    };

    function csWith(creature) {
        return { round: 1, creatures: [creature] };
    }
    const BANDIT = { name: 'Bandit 1', type: 'npc', size: 'Medium or Small', ac: 12, currentHp: 982, maxHp: 999 };
    const TITAN = { name: 'Fire Giant 1', type: 'npc', size: 'Large', ac: 15, currentHp: 76, maxHp: 162 };

    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 972, damageReduced: false });
    });

    async function resolveHit({ cs = csWith(BANDIT), targetName = 'Bandit 1', action = TENDRIL } = {}) {
        await createPlainDamageHandler(deps)({
            name: action.name, formula: '1d6 + 4', total: 7, rolls: [3], modifier: 4,
            adjustedTotal: 10, combatSummary: cs,
            context: { targetName, damageType: 'Bludgeoning', attackerName: 'Shambling Mound 1', hitClause: buildHitConditionClause(action) },
        });
    }

    const logged = () => deps.logEntry.mock.calls.map(c => c[0]);

    it('DATA: shambling-mound.actions[1] authors the structured pull rider (byte-shape pin)', () => {
        expect(TENDRIL.hit_pull).toEqual({ distance_ft: 5, size_limit: 'Medium' });
        expect(TENDRIL.attack_bonus).toBe(7);
        expect(TENDRIL.damage_dice_primary).toBe('1d6 + 4');
        expect(TENDRIL.damage_dice_secondary).toBe('2d4');
    });

    it('PARSER: buildHitConditionClause carries pull; parseHitPull is structured-key-only', () => {
        expect(buildHitConditionClause(TENDRIL)).toEqual({
            conditions: [],
            escapeDc: null,
            attackName: 'Charged Tendril',
            targetEffect: null,
            pull: { distanceFt: 5, sizeLimit: 'Medium' },
        });
        expect(parseHitPull({})).toBeNull();
        expect(parseHitPull({ hit_pull: { distance_ft: 0, size_limit: 'Medium' } })).toBeNull();
        expect(parseHitPull({ hit_pull: { distance_ft: 5 } })).toBeNull();
        expect(parseHitPull({ hit_pull: { distance_ft: 5, size_limit: 'Gigantic' } })).toBeNull();
        expect(parseHitPull({ hit_pull: { distance_ft: 'five', size_limit: 'Medium' } })).toBeNull();
        const engulf = MOUND.actions.find(a => a.name === 'Engulf');
        expect(parseHitPull(engulf)).toBeNull();
        expect(buildHitConditionClause(engulf)).toBeNull();
    });

    it('HIT on Medium victim: registers pulled_toward {instant, value 5} + pull grant log, no clock', async () => {
        await resolveHit();

        expect(registerTargetEffect).toHaveBeenCalledWith(
            'test-campaign',
            'Bandit 1',
            'pulled_toward',
            'Shambling Mound 1',
            { duration: 'instant', value: 5 },
        );
        expect(addExpiration).not.toHaveBeenCalled();

        const grant = logged().find(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Pulled Toward');
        expect(grant).toBeTruthy();
        expect(grant.reason).toBe('Charged Tendril — pulls Bandit 1 5 feet straight toward Shambling Mound 1');
        expect(grant.note).toMatch(/GM-enforced/);
        expect(grant.note).toMatch(/token/i);
    });

    it('SIZE GATE: a Large victim is refused with pull_refused log, zero te — damage legs still land', async () => {
        applyDamageToTarget.mockResolvedValue({ finalDamage: 10, newHp: 66, damageReduced: false });

        await resolveHit({ cs: csWith(TITAN), targetName: 'Fire Giant 1' });

        expect(registerTargetEffect).not.toHaveBeenCalled();
        const refusal = logged().find(e => e.type === 'automation' && e.automationType === 'pull_refused');
        expect(refusal).toBeTruthy();
        expect(refusal.description).toMatch(/larger than Medium/);
        expect(logged().some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Pulled Toward')).toBe(false);
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    });

    it('MA-0553 RANGE SIZE: "Medium or Small" victim passes the Medium gate on its largest size', async () => {
        await resolveHit();
        expect(registerTargetEffect).toHaveBeenCalledTimes(1);
    });

    it('BYTE-INERT PIPELINE: a row without hit_pull registers nothing and logs no pull', async () => {
        const inertRow = { name: 'Bite', attack_bonus: 5, damage_dice_primary: '1d6 + 1', damage_type_primary: 'Piercing' };
        expect(buildHitConditionClause(inertRow)).toBeNull();

        await resolveHit({ action: inertRow });

        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(logged().some(e => JSON.stringify(e).toLowerCase().includes('pull'))).toBe(false);
    });

    it('MISS LANE: no resolved hit (target absent) yields zero pull state', async () => {
        await createPlainDamageHandler(deps)({
            name: 'Charged Tendril', formula: '1d6 + 4', total: 7, rolls: [3], modifier: 4,
            adjustedTotal: 10, combatSummary: csWith(BANDIT),
            context: { targetName: 'Nobody', damageType: 'Bludgeoning', attackerName: 'Shambling Mound 1', hitClause: buildHitConditionClause(TENDRIL) },
        });

        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(logged().some(e => JSON.stringify(e).toLowerCase().includes('pull'))).toBe(false);
    });
});
