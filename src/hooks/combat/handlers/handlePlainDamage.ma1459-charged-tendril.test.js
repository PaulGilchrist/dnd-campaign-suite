// @maintained-by-ai: 2026-10-14
// MA-1459: Shambling Mound "Charged Tendril" size-conditional pull rider —
// the fix that made the promised transport clause LAND (§944: pull clauses
// grep-zero-inert on attack rows). Locks: (1) the data↔parser seam —
// shambling-mound.actions[1] authors structured hit_pull:{distance_ft:5,
// size_limit:'Medium'} which buildHitConditionClause carries onto the
// hit-clause payload, parseHitPull being structured-key-only; (2) on a
// resolved hit a Medium-or-smaller victim (incl. MA-0553 range sizes like
// "Medium or Small", which pass on their LARGEST named size) gets the
// registered pulled_toward te {duration:'instant', value:5} — the PC Warping
// Implosion pull-marker convention (SaveAttackAoeModal:191/:1485), NO
// addExpiration clock — plus ONE grant log carrying the RAW pull sentence +
// the §42 GM token-move advisory; (3) a Large victim is refused with a
// pull_refused log and zero te (the Medium gate is stricter than the family
// Large-or-smaller gate, so it must run BEFORE it); (4) zero-state lanes —
// rows without the key and unresolved hits (miss) never touch pull state.
// Registry shape of pulled_toward is pinned in targetEffectDefinitions.test.js.
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

    // "Medium or Small" range size doubles as the MA-0553 largest-named-size
    // gate-pass fixture.
    const BANDIT = { name: 'Bandit 1', type: 'npc', size: 'Medium or Small', ac: 12, currentHp: 982, maxHp: 999 };
    const TITAN = { name: 'Fire Giant 1', type: 'npc', size: 'Large', ac: 15, currentHp: 76, maxHp: 162 };

    const csWith = (creature) => ({ round: 1, creatures: [creature] });

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
    const loggedPull = () => logged().some(e => JSON.stringify(e).toLowerCase().includes('pull'));

    it('SEAM: data row authors hit_pull; clause carries {5, Medium}; parser is strict + byte-inert', () => {
        expect(TENDRIL.hit_pull).toEqual({ distance_ft: 5, size_limit: 'Medium' });
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

    it('HIT on Medium-or-smaller victim: pulled_toward {instant, value 5} + grant log, no clock', async () => {
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
        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
    });

    it('ZERO-STATE LANES: keyless row and miss produce no pull registration or logs', async () => {
        const inertRow = { name: 'Bite', attack_bonus: 5, damage_dice_primary: '1d6 + 1', damage_type_primary: 'Piercing' };
        expect(buildHitConditionClause(inertRow)).toBeNull();

        await resolveHit({ action: inertRow });
        await resolveHit({ targetName: 'Nobody' });

        expect(registerTargetEffect).not.toHaveBeenCalled();
        expect(loggedPull()).toBe(false);
    });
});
