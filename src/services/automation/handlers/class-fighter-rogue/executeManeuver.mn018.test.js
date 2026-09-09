// MN-018: executeManeuver (the LIVE pending-prompt executor for Sweeping Attack)
// must open a secondary-target chooser, stash pendingSweepingAttack (RAW combatants),
// and never claim phantom damage on the second creature.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeManeuver } from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async () => [
        { name: 'Sweeping Attack', actionType: 'attack_rider', trigger: 'melee_weapon_attack_hit', effect: 'secondary_damage', damageBonus: false, dieExpression: 'superiority_die' },
    ]),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({
        creatures: [
            { name: 'EvasiveFighter', type: 'player', ac: 18 },
            { name: 'Thug 1', type: 'monster', ac: 11 },
            { name: 'Thug 2', type: 'monster', ac: 11 },
        ],
    }),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 12, newHp: 20 })),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 12, rolls: [12] })),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn().mockResolvedValue({ target: { name: 'Thug 1' } }),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((expr) => (expr === 'superiority_die' ? 12 : expr)),
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 10),
    createSaveListener: vi.fn(() => ({ promise: Promise.resolve({ success: false }) })),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(async () => null),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

const CAMPAIGN = 'test-campaign';

const stats = () => ({
    name: 'EvasiveFighter',
    level: 18,
    rules: '2024',
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
});

describe('executeManeuver — MN-018 Sweeping Attack chooser + stash', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'superiorityDice') return 4;
            if (key === 'BattleMasterManeuvers_selection') return ['Sweeping Attack'];
            if (key === 'lastAttack') return { hit: true, damageType: 'slashing', targetName: 'Thug 1', d20Roll: 15, bonus: 7, total: 22 };
            return undefined;
        });
    });

    it('returns a sweepingAttackTarget chooser modal (not a phantom popup)', async () => {
        const result = await executeManeuver(
            { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
            stats(), CAMPAIGN, 'Sweeping Attack'
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('sweepingAttackTarget');
    });

    it('stashes pendingSweepingAttack with original roll + raw combatants + real damageType', async () => {
        await executeManeuver(
            { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
            stats(), CAMPAIGN, 'Sweeping Attack'
        );

        const stash = setRuntimeValue.mock.calls.find(c => c[1] === 'pendingSweepingAttack');
        expect(stash).toBeTruthy();
        const pending = stash[2];
        expect(pending.primaryTarget).toBe('Thug 1');
        expect(pending.damageType).toBe('slashing');
        expect(pending.originalTotal).toBe(22);
        expect(pending.dieValue).toBe(12);
        expect(pending.secondaryTargets.map(t => t.name)).toEqual(['Thug 2']);
        // RAW combatants (no [undefined] — CLA-326 crash lesson)
        expect(pending.secondaryTargets[0].ac).toBe(11);
    });

    it('chooser wording is conditional (no definitive phantom damage claim)', async () => {
        const result = await executeManeuver(
            { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
            stats(), CAMPAIGN, 'Sweeping Attack'
        );
        // Chooser says "would hit" (conditional), NOT a definitive past-tense claim,
        // and does NOT apply damage at selection time (executeSweepingAttack does).
        expect(result.payload.description).toMatch(/would hit/i);
        expect(result.payload.description).toMatch(/Choose a creature within 5 feet/i);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('returns a popup (no chooser) when no creature is within 5 feet', async () => {
        isWithinRange.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
        const result = await executeManeuver(
            { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
            stats(), CAMPAIGN, 'Sweeping Attack'
        );
        expect(result.type).toBe('popup');
        expect(result.payload.description).toMatch(/within 5 feet/);
        const stash = setRuntimeValue.mock.calls.find(c => c[1] === 'pendingSweepingAttack');
        expect(stash).toBeFalsy();
    });
});
