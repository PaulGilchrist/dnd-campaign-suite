// @maintained-by-ai: 2026-10-15
// combatSuperiorityHandler.js barrel — executeActionManeuvers.js executor contracts.
// This suite is the ONLY executor lane for the bonus-action die-size fallback
// (rollExpression null → die size pays) and both executeSkillCheckManeuver
// description branches (Tactical Assessment, Ambush). Riposte / Parry / Rally /
// Evasive-Footwork happy path / Grant Attack / Movement / Commanding Presence
// executors are pinned in their dedicated suites (executeActionManeuvers.riposte,
// executeActionManeuvers.parry.mn013, executeActionManeuvers.rally,
// executeActionManeuvers.test, combatSuperiorityGrantAttack.mn003,
// combatSuperiorityMovementManeuvers, commandingPresenceReaction.mn004) and are
// deliberately NOT duplicated here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    executeBonusActionManeuver,
    executeGrantAttackManeuver,
    executeMovementManeuver,
    executeSkillCheckManeuver,
    executeReactionManeuver,
    executeCommandingPresenceReaction,
} from './combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../../services/dice/diceRoller.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
    setRuntimeBatch: vi.fn(),
}));

vi.mock('../../../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async (_rules) => [
        { name: 'Evasive Footwork', description: 'Take the Disengage action and gain a bonus to AC.', effect: 'ac_bonus_disengage', actionType: 'bonus_action', dieExpression: 'superiority_die' },
        { name: 'Tactical Assessment', description: 'Add the die to a Wisdom check.', actionType: 'skill_check', skills: ['Insight'], ability: 'Wisdom', dieExpression: 'superiority_die' },
        { name: 'Ambush', description: 'Add the die to an Initiative or Stealth check.', actionType: 'skill_check', skills: ['Stealth'], initiativeBonus: true, dieExpression: 'superiority_die' },
    ]),
    loadWildMagicSurgeTable: vi.fn(async () => []),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'Goblin' }] }),
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

// playerIsImmuneToCondition is required by conditionSaveService (real, loaded
// via combatSuperiorityUtils) importing from the mocked automationService.
vi.mock('../../../../services/combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((expr) => {
        if (expr === 'superiority_die') return 8;
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
    rangeToFeet: vi.fn(() => 30),
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

const makePlayerStats = () => ({
    name: 'TestFighter',
    level: 5,
    rules: '2024',
    automation: { passives: [] },
});

const mockRuntime = (overrides = {}) => {
    getRuntimeValue.mockImplementation((name, key) => {
        const routed = overrides[`${name}.${key}`];
        if (routed !== undefined) return routed;
        if (key === 'superiorityDice') return 4;
        return null;
    });
};

// ── Barrel contract ──────────────────────────────────────────────────────

describe('combatSuperiorityHandler barrel', () => {
    it('re-exports every action-maneuver executor through the compat barrel', () => {
        [
            executeBonusActionManeuver,
            executeGrantAttackManeuver,
            executeMovementManeuver,
            executeSkillCheckManeuver,
            executeReactionManeuver,
            executeCommandingPresenceReaction,
        ].forEach(fn => expect(typeof fn).toBe('function'));
    });
});

// ── executeBonusActionManeuver — die-size fallback ─────────────────────

describe('executeBonusActionManeuver — die-size fallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRuntime();
    });

    it('falls back to the die size when rollExpression returns null — value pays the state writes, not just the text', async () => {
        // dieExpression 'superiority_die' evaluates to d8 (evaluateAutoExpression);
        // a null roll must fall back to 8 for dieValue AND every runtime write.
        rollExpression.mockReturnValueOnce(null);

        const result = await executeBonusActionManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Evasive Footwork'
        );

        expect(result.type).toBe('popup');
        expect(rollExpression).toHaveBeenCalledWith('1d8');
        expect(result.payload.description).toBe('<b>Evasive Footwork</b> (Bonus Action)<br/>Rolled d8 for 8. You take the Disengage action and gain +8 AC until the start of your next turn.');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 3, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'baitAndSwitchBonus', 8, 'test-campaign');
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].description).toBe('Used Evasive Footwork as a bonus action. Rolled d8 for 8. Take the Disengage action and gain a bonus to AC.');
    });
});

// ── executeSkillCheckManeuver ────────────────────────────────────────────

describe('executeSkillCheckManeuver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRuntime();
    });

    it('non-initiative arms pendingSkillCheckBonus and names ability + skill in popup and log', async () => {
        const result = await executeSkillCheckManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Tactical Assessment'
        );

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', 4, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 3, 'test-campaign');
        expect(result.payload.description).toBe('<b>Tactical Assessment</b><br/>Rolled d8 for 4. Add 4 to your next Wisdom (Insight).');
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].description).toBe('Used Tactical Assessment. Rolled d8 for 4. Added 4 to the next Insight check.');
    });

    it('initiativeBonus variant uses the Initiative-or-Stealth wording (no ability prefix)', async () => {
        const result = await executeSkillCheckManeuver(
            { name: 'Test', automation: { type: 'combat_superiority' } },
            makePlayerStats(),
            'test-campaign',
            'Ambush'
        );

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'pendingSkillCheckBonus', 4, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'superiorityDice', 3, 'test-campaign');
        expect(result.payload.description).toBe('<b>Ambush</b><br/>Rolled d8 for 4. Add 4 to your next Initiative roll or Dexterity (Stealth) check.');
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].description).toBe('Used Ambush. Rolled d8 for 4. Added 4 to the next Initiative or Stealth check.');
    });
});
