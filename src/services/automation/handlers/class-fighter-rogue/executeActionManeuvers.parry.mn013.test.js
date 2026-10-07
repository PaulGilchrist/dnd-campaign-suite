// MN-013: Parry reaction economy latch + server-fresh heal read-modify-write
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeReactionManeuver } from './executeActionManeuvers.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { findLastAttack } from '../../common/damageRollback.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async () => [
        { name: 'Parry', description: 'When another creature damages you with a melee attack roll, you can use your Reaction and expend one Superiority Die to reduce the damage by the die + STR or DEX mod.', actionType: 'reaction', trigger: 'melee_damage_taken', effect: 'damage_reduction', dieExpression: 'superiority_die' },
    ]),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'EvasiveFighter' }, { name: 'Wight 1' }], round: 1, activeCreatureName: 'Wight 1' }),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn().mockReturnValue({ total: 4 }),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 12),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

const makePlayerStats = () => ({
    name: 'EvasiveFighter',
    level: 18,
    rules: '2024',
    abilities: [{ name: 'Strength', bonus: 2 }, { name: 'Dexterity', bonus: 4 }],
    automation: { passives: [] },
});

// Qualifying trigger: Wight 1 melee hit damaging EvasiveFighter (damageApplied:true).
const hitTrigger = {
    attackEvent: { attackerName: 'Wight 1', targetName: 'EvasiveFighter', hit: true, damageApplied: true, weaponType: 'melee', d20: 16, bonus: 4, total: 20, primaryDamage: 8 },
    attackerName: 'Wight 1',
    targetName: 'EvasiveFighter',
    totalDamage: 8,
};

function mockKeys(extra = {}) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key in extra) return extra[key];
        if (key === 'superiorityDice') return 6;
        if (key === 'hitPoints') return 112;
        if (key === 'currentHitPoints') return 89;
        return null;
    });
}

function stubServerHp(entry) {
    vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        json: async () => ({ EvasiveFighter: entry }),
    })));
}

describe('executeReactionManeuver — MN-013 Parry reaction economy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findLastAttack.mockResolvedValue({ ...hitTrigger });
        getCombatContext.mockResolvedValue({ creatures: [], round: 1, activeCreatureName: 'Wight 1' });
        mockKeys();
        stubServerHp({ currentHitPoints: 89, hitPoints: 112 });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('accepted parry: die spent, _Parry_usedRound latched, server-fresh HP restored, hit marked parryResolved, ability_use logged', async () => {
        const result = await executeReactionManeuver({ name: 'Parry' }, makePlayerStats(), 'test-campaign', 'Parry');

        expect(result.type).toBe('popup');
        // d12 rolled 4 + DEX 4 (auto Math.max STR/DEX, accepted model) = 8 reduction.
        expect(result.payload.description).toContain('Damage reduced by 8 (4 + 4 from STR/DEX modifier).');
        expect(result.payload.description).toContain('HP restored: 89 → 97.');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', 5, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_Parry_usedRound', 1, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'currentHitPoints', 97, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', expect.objectContaining({ parryResolved: true, parriedBy: 'EvasiveFighter' }), 'test-campaign');
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].description).toContain('Used Parry as a reaction.');
    });

    it('second press in the SAME round refuses zero-spend with parry_refused (already_used_this_round)', async () => {
        mockKeys({ _Parry_usedRound: 1 });

        const result = await executeReactionManeuver({ name: 'Parry' }, makePlayerStats(), 'test-campaign', 'Parry');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('already used Parry this round');
        expect(result.logEntries[0]).toMatchObject({ type: 'automation', automationType: 'parry_refused', reason: 'already_used_this_round' });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses with no pending hit (no lastAttack): parry_refused (no_qualifying_hit), zero spend', async () => {
        findLastAttack.mockResolvedValue({ attackEvent: null, attackerName: null, targetName: null, totalDamage: 0 });

        const result = await executeReactionManeuver({ name: 'Parry' }, makePlayerStats(), 'test-campaign', 'Parry');

        expect(result.payload.description).toContain('No pending hit is damaging you');
        expect(result.logEntries[0]).toMatchObject({ type: 'automation', automationType: 'parry_refused', reason: 'no_qualifying_hit' });
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses when holder was not the target of the last attack', async () => {
        findLastAttack.mockResolvedValue({ ...hitTrigger, attackEvent: { ...hitTrigger.attackEvent, targetName: 'HexWarlock' }, targetName: 'HexWarlock' });

        const result = await executeReactionManeuver({ name: 'Parry' }, makePlayerStats(), 'test-campaign', 'Parry');

        expect(result.logEntries[0]).toMatchObject({ automationType: 'parry_refused', reason: 'no_qualifying_hit' });
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses a lastAttack that missed (hit !== true)', async () => {
        findLastAttack.mockResolvedValue({ ...hitTrigger, attackEvent: { ...hitTrigger.attackEvent, hit: false, damageApplied: false } });

        const result = await executeReactionManeuver({ name: 'Parry' }, makePlayerStats(), 'test-campaign', 'Parry');

        expect(result.logEntries[0]).toMatchObject({ automationType: 'parry_refused', reason: 'no_qualifying_hit' });
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses while damage is not yet applied (damageApplied !== true)', async () => {
        findLastAttack.mockResolvedValue({ ...hitTrigger, attackEvent: { ...hitTrigger.attackEvent, damageApplied: false } });

        const result = await executeReactionManeuver({ name: 'Parry' }, makePlayerStats(), 'test-campaign', 'Parry');

        expect(result.logEntries[0]).toMatchObject({ automationType: 'parry_refused', reason: 'no_qualifying_hit' });
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses an already-parried triggering hit (parryResolved identity)', async () => {
        findLastAttack.mockResolvedValue({ ...hitTrigger, attackEvent: { ...hitTrigger.attackEvent, parryResolved: true } });

        const result = await executeReactionManeuver({ name: 'Parry' }, makePlayerStats(), 'test-campaign', 'Parry');

        expect(result.payload.description).toContain('already parried that attack');
        expect(result.logEntries[0]).toMatchObject({ automationType: 'parry_refused', reason: 'already_parry_this_attack' });
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('re-arms on the next round (latch cleared at round wrap)', async () => {
        getCombatContext.mockResolvedValue({ creatures: [], round: 2, activeCreatureName: 'Wight 1' });
        mockKeys({ _Parry_usedRound: 1 });

        const result = await executeReactionManeuver({ name: 'Parry' }, makePlayerStats(), 'test-campaign', 'Parry');

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_Parry_usedRound', 2, 'test-campaign');
    });

    it('exhaustion refusal stays verbatim and consults no trigger data', async () => {
        mockKeys({ superiorityDice: 0 });

        const result = await executeReactionManeuver({ name: 'Parry' }, makePlayerStats(), 'test-campaign', 'Parry');

        expect(result.payload.description).toBe('Parry: No Superiority Dice remaining. Recharges on a Short or Long Rest.');
        expect(findLastAttack).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('heal read-modify-write rides SERVER-FRESH change-data HP, not the stale local store', async () => {
        // Local store is stale at 108 (pre-hit); server truth is 89 post-hit.
        mockKeys({ currentHitPoints: 108 });
        stubServerHp({ currentHitPoints: 89, hitPoints: 112 });

        const result = await executeReactionManeuver({ name: 'Parry' }, makePlayerStats(), 'test-campaign', 'Parry');

        expect(result.payload.description).toContain('HP restored: 89 → 97.');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'currentHitPoints', 97, 'test-campaign');
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/campaigns/test-campaign/change-data'));
    });

    it('heal falls back to the local store with a logged error when the server read fails', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));

        const result = await executeReactionManeuver({ name: 'Parry' }, makePlayerStats(), 'test-campaign', 'Parry');

        expect(result.payload.description).toContain('HP restored: 89 → 97.');
        expect(errSpy).toHaveBeenCalledWith('[MN-013 Parry] server-fresh HP read failed:', expect.any(Error));
        errSpy.mockRestore();
    });

    it('unknown reaction effect spends nothing', async () => {
        const loader = await import('../../../ui/dataLoader.js');
        loader.loadManeuvers.mockResolvedValueOnce([
            { name: 'Mystery', actionType: 'reaction', effect: 'no_such_effect' },
        ]);

        const result = await executeReactionManeuver({ name: 'Mystery' }, makePlayerStats(), 'test-campaign', 'Mystery');

        expect(result.type).toBe('popup');
        expect(result.logEntries[0]).toMatchObject({ automationType: 'parry_refused', reason: 'no_executor' });
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});
