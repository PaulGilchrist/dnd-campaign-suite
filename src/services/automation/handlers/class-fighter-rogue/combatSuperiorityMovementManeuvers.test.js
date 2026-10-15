// @maintained-by-ai: 2026-10-15
// executeActionManeuvers.js — executeMovementManeuver lane (the ONLY lane for the
// movement executor: Bait and Switch modal building on the executeActionManeuvers side,
// the unknown-movement-effect popup fallback, and the pre-roll dice gates).
// The executeManeuver.js baitAndSwitchChoice twin is pinned in
// combatSuperiorityHandlerManeuver-modals.test.js; the confirm side of this modal
// (executeBaitAndSwitchChoice) is owned by combatSuperiorityChoices.test.js.
// Source dup flags (continuation only, NOT fixed here): buildRallyModal /
// buildBaitAndSwitchModal twins in executeManeuver.js vs executeActionManeuvers.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeMovementManeuver } from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../../services/dice/diceRoller.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async (_rules) => [
        { name: 'Bait and Switch', effect: 'ac_bonus_and_swap', actionType: 'movement' },
        { name: 'Roving Strike', effect: 'move_and_attack', actionType: 'movement' },
    ]),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'Goblin' }] }),
}));

vi.mock('../../../../services/automation/common/targetResolver.js', () => ({
    resolveTarget: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn().mockReturnValue({ total: 4 }),
}));

vi.mock('../../../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((expr) => {
        if (expr === 'superiority_die') return 8;
        if (expr === '1d6') return 6;
        return expr;
    }),
    playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../../../services/automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 15),
    createSaveListener: vi.fn(() => ({
        promise: Promise.resolve({ success: false }),
    })),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(async () => {}),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(() => ({ finalDamage: 4 })),
}));

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(() => 5),
    rangeToFeet: vi.fn((range) => {
        if (range === '5_ft') return 5;
        if (range === '8_ft') return 8;
        return 5;
    }),
}));

vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../../services/automation/handlers/buffs/tempHpService.js', () => ({
    setTempHp: vi.fn(async () => {}),
}));

const makePlayerStats = (overrides = {}) => ({
    name: 'TestFighter',
    proficiency: 3,
    abilities: [
        { name: 'STR', bonus: 4 },
        { name: 'DEX', bonus: 2 },
        { name: 'CON', bonus: 1 },
        { name: 'INT', bonus: 0 },
        { name: 'WIS', bonus: 0 },
        { name: 'CHA', bonus: 0 },
    ],
    level: 5,
    rules: '2024',
    attacks: [{ name: 'Longsword', weaponType: 'melee', damage: '1d8+4', damageType: 'slashing' }],
    automation: { passives: [], actions: [], bonusActions: [], reactions: [], specialActions: [] },
    ...overrides,
});

// Routes runtime reads by 'Name.key'; superiority Dice defaults to 4.
const mockRuntime = (overrides = {}) => {
    getRuntimeValue.mockImplementation((name, key) => {
        const routed = overrides[`${name}.${key}`];
        if (routed !== undefined) return routed;
        if (key === 'superiorityDice') return 4;
        return undefined;
    });
};

// ── executeMovementManeuver ──────────────────────────────────────────────

describe('executeMovementManeuver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRuntime();
    });

    // ── ac_bonus_and_swap → baitAndSwitchChoice modal (picker deferred to choices lane)

    it('builds baitAndSwitchChoice modal with self + ally options, spends exactly one die and applies nothing', async () => {
        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue({
            creatures: [{ name: 'TestFighter' }, { name: 'Ally1' }],
        });

        const result = await executeMovementManeuver(
            { name: 'Bait and Switch', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Bait and Switch'
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('baitAndSwitchChoice');
        expect(result.payload.dieValue).toBe(4);
        expect(result.payload.maneuverName).toBe('Bait and Switch');
        expect(result.payload.campaignName).toBe('test-campaign');
        expect(result.payload.options).toEqual([
            { label: 'Myself (TestFighter)', value: 'TestFighter' },
            { label: 'Ally1', value: 'Ally1' },
        ]);
        expect(result.payload.description).toBe('<b>Bait and Switch</b><br/>Rolled d8 for 4. You or an ally gains +4 AC until the start of your next turn.');
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].type).toBe('ability_use');
        expect(result.logEntries[0].abilityName).toBe('Bait and Switch');
        expect(result.logEntries[0].description).toBe('Used Bait and Switch. Rolled d8 for 4. You or the ally gains +4 AC until the start of your next turn.');
        // Expend exactly one die and write NOTHING else — AC application / swap
        // belongs to executeBaitAndSwitchChoice (choices lane), not this builder.
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 3, 'test-campaign');
    });

    it('builds baitAndSwitchChoice with self-only options when no allies are in combat', async () => {
        const damageUtils = await import('../../../../services/rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValue({
            creatures: [{ name: 'TestFighter' }],
        });

        const result = await executeMovementManeuver(
            { name: 'Bait and Switch', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Bait and Switch'
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('baitAndSwitchChoice');
        expect(result.payload.options).toHaveLength(1);
        expect(result.payload.options[0]).toEqual({ label: 'Myself (TestFighter)', value: 'TestFighter' });
    });

    // ── unknown movement effect → automation_info popup fallback (Roving Strike)

    it('returns automation_info popup with AC wording tail for a movement effect with no modal branch', async () => {
        const result = await executeMovementManeuver(
            { name: 'Roving Strike', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Roving Strike'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Roving Strike');
        expect(result.payload.description).toBe('<b>Roving Strike</b><br/>Rolled d8 for 4. You or the ally gains +4 AC until the start of your next turn.');
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].description).toBe('Used Roving Strike. Rolled d8 for 4. You or the ally gains +4 AC until the start of your next turn.');
        // The popup fallback still rolls and pays for the maneuver.
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 3, 'test-campaign');
    });

    // ── pre-roll gates: refuse without rolling or spending (no-side-effect guards)

    it('returns maneuver-not-found popup before any roll or expenditure', async () => {
        const result = await executeMovementManeuver(
            { name: 'Nonexistent Maneuver', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Nonexistent Maneuver'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('Maneuver "Nonexistent Maneuver" not found.');
        expect(result.logEntries).toBeUndefined();
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns no-dice-remaining popup before any roll or expenditure', async () => {
        mockRuntime({ 'TestFighter.superiorityDice': 0 });

        const result = await executeMovementManeuver(
            { name: 'Bait and Switch', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Bait and Switch'
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toBe('Bait and Switch: No Superiority Dice remaining. Recharges on a Short or Long Rest.');
        expect(result.logEntries).toBeUndefined();
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});
