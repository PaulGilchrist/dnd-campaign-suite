// @maintained-by-ai: 2026-10-15
// MN-012 lane — executeManeuver.js applyDamageBonusRider landing path with
// lastAttack SET (the ONLY place in this cluster that arms lastAttack through
// executeManeuver): hit-landing exact-call pin, the miss guard, the no-target
// guard, the actionType guard (bonus-action maneuver must never land damage
// immediately even with a landed lastAttack), the damageType fallback chain
// (lastAttack → maneuver → 'force'), and the finalDamage=0 text suppression.
// NOT duplicated here: chooser/stash canon (executeManeuver.mn018), the
// utils-copy hit/miss (combatSuperiorityUtils.sweeping), RUNNER_STEPS texts
// (combatSuperiorityHandlerManeuver-attack — its lane never SETS lastAttack),
// and executeAttackRiderManeuver's own rider landing (combatSuperiorityAttackRider).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeManeuver } from './combatSuperiorityHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { resolveTarget } from '../../common/targetResolver.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async (_rules) => [
        { name: 'Menacing Attack', effect: 'frightened', trigger: 'weapon_attack_hit', saveType: 'WIS', damageBonus: true, dieExpression: 'superiority_die', actionType: 'attack_rider' },
        { name: 'Precision Attack', effect: 'attack_roll_bonus', trigger: 'attack_roll_miss', damageBonus: false, actionType: 'attack_rider' },
        { name: 'Lunging Attack', effect: 'dash_and_damage', damageBonus: true, actionType: 'bonus_action' },
    ]),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'monster' }] }),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 4, newHp: 23 })),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 4, rolls: [4] })),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn().mockResolvedValue({ target: { name: 'Goblin' } }),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((expr) => (expr === 'superiority_die' ? 8 : expr)),
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 10),
    createSaveListener: vi.fn(() => ({ promise: Promise.resolve({ success: false }) })),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

const makePlayerStats = () => ({
    name: 'TestFighter',
    proficiency: 3,
    abilities: [
        { name: 'STR', bonus: -1 },
        { name: 'DEX', bonus: -1 },
    ],
    level: 5,
    rules: '2024',
    attacks: [{ name: 'Longsword', weaponType: 'melee', damage: '1d8-1', damageType: 'slashing' }],
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
});

describe('executeManeuver — MN-012 pending-prompt rider die lands in damage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'superiorityDice') return 4;
            if (key === 'BattleMasterManeuvers_selection') return ['Menacing Attack'];
            if (key === 'activeConditions') return [];
            if (key === 'lastAttack') return { hit: true, damageType: 'slashing', targetName: 'Goblin' };
            return undefined;
        });
    });

    it('applies the superiority die via awaited applyDamageToTarget on a hit attack_rider', async () => {
        const result = await executeManeuver(
            { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Menacing Attack'
        );

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        const call = applyDamageToTarget.mock.calls[0];
        expect(call[1]).toBe('Goblin');
        expect(call[2]).toBe(4);
        expect(call[3]).toEqual(['slashing']);
        expect(call[4].campaignName).toBe('test-campaign');
        expect(call[4].attackerName).toBe('TestFighter');
        expect(result.payload.description).toContain('Added 4 to the damage roll');
        expect(result.payload.description).toContain('Goblin takes 4 slashing damage');
        expect(result.logEntries[0].description).toContain('Added 4 to the damage roll');
    });

    it('does NOT apply die damage when last attack missed', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'superiorityDice') return 4;
            if (key === 'lastAttack') return { hit: false, damageType: 'slashing' };
            return undefined;
        });

        await executeManeuver(
            { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Menacing Attack'
        );

        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('does NOT apply die damage immediately for bonus-action maneuvers (future-hit storage)', async () => {
        const result = await executeManeuver(
            { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Lunging Attack'
        );

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(result.payload.description).toContain('Added 4 to the damage roll');
    });

    it('does NOT apply die damage when no target resolves (attack_rider with landed lastAttack)', async () => {
        resolveTarget.mockResolvedValueOnce(null);

        const result = await executeManeuver(
            { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Menacing Attack'
        );

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(result.payload.description).toContain('Added 4 to the damage roll');
        expect(result.payload.description).not.toContain('takes');
    });

    it('falls back to force damage when neither lastAttack nor maneuver declares a damageType', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'superiorityDice') return 4;
            if (key === 'lastAttack') return { hit: true };
            return undefined;
        });

        const result = await executeManeuver(
            { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            // Menacing Attack declares no damageType in this mock — chain ends at 'force'
            'Menacing Attack'
        );

        const call = applyDamageToTarget.mock.calls[0];
        expect(call[3]).toEqual(['force']);
        expect(result.payload.description).toContain('Goblin takes 4 force damage');
    });

    it('suppresses the damage sentence when finalDamage is 0', async () => {
        applyDamageToTarget.mockReturnValueOnce({ finalDamage: 0, newHp: 27 });

        const result = await executeManeuver(
            { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Menacing Attack'
        );

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(result.payload.description).toContain('Added 4 to the damage roll');
        expect(result.payload.description).not.toContain('takes');
    });
});
