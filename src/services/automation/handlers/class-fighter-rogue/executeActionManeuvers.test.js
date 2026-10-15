// @maintained-by-ai
// Evasive Footwork / bonus-action executor lane — direct-import suite for
// executeBonusActionManeuver (executeActionManeuvers.js) happy path: exact-key
// runtime pins (baitAndSwitch* trio, superiorityDice expend), bait_and_switch_clear
// expiration shape, log-envelope contract (logEntries returned to the runner,
// never POSTed via addEntry), plus zero-spend guards (no-dice, maneuver-not-found,
// bonus targetless popup rule for BONUS_TARGETLESS_EFFECTS).
// Canonical popup strings live in combatSuperiorityUtils.test.js — contain-checks
// only here. Die-size fallback (rollExpression null) is owned by
// combatSuperiorityActionManeuvers.test.js; Rally (buildRallyModal/gateRallyAllies
// in this source) is owned by executeActionManeuvers.rally.test.js (the twin copy
// in executeManeuver.js is pinned by combatSuperiorityHandlerManeuver-modals —
// neither is covered here); Riposte canon is executeActionManeuvers.riposte.test.js;
// Parry lane is executeActionManeuvers.parry.mn013.test.js.
// Deterministic: mock runtime router, fixed rollExpression returns, turn-based rounds.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeBonusActionManeuver } from './executeActionManeuvers.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { loadManeuvers } from '../../../ui/dataLoader.js';
import { resolveTarget } from '../../common/targetResolver.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async () => [
        { name: 'Evasive Footwork', description: 'As a Bonus Action, take the Disengage action and gain AC.', actionType: 'bonus_action', effect: 'ac_bonus_disengage', dieExpression: 'superiority_die' },
    ]),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [] }),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn().mockReturnValue({ total: 5 }),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => 8),
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

const makePlayerStats = () => ({
    name: 'EvasiveFighter',
    level: 5,
    rules: '2024',
    automation: { passives: [] },
});

const mockRuntime = (overrides = {}) => {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (overrides[key] !== undefined) return overrides[key];
        return null;
    });
};

describe('executeBonusActionManeuver — MN-007 Evasive Footwork', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRuntime({ superiorityDice: 4 });
    });

    it('expend one superiority die and sets AC bonus runtime state', async () => {
        const playerStats = makePlayerStats();
        const result = await executeBonusActionManeuver({ name: 'Evasive Footwork' }, playerStats, 'test-campaign', 'Evasive Footwork');

        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', 3, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'baitAndSwitchActive', true, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'baitAndSwitchBonus', 5, 'test-campaign');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'baitAndSwitchSource', 'Evasive Footwork', 'test-campaign');
        expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'EvasiveFighter', targetName: 'EvasiveFighter', effects: [{ type: 'bait_and_switch_clear' }], campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: 'EvasiveFighter' });
        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('You take the Disengage action and gain +5 AC until the start of your next turn.');
    });

    it('returns the log entry for the runner and does not POST it directly (no duplicate log)', async () => {
        const playerStats = makePlayerStats();
        const result = await executeBonusActionManeuver({ name: 'Evasive Footwork' }, playerStats, 'test-campaign', 'Evasive Footwork');

        expect(addEntry).not.toHaveBeenCalled();
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0]).toMatchObject({
            type: 'ability_use',
            characterName: 'EvasiveFighter',
            abilityName: 'Evasive Footwork',
        });
        expect(result.logEntries[0].description).toContain('Used Evasive Footwork as a bonus action. Rolled d8 for 5.');
    });

    it('omits "Target:" from popup and log even when a target is selected (targetless effect)', async () => {
        resolveTarget.mockResolvedValueOnce({ target: { name: 'Goblin' } });
        const playerStats = makePlayerStats();
        const result = await executeBonusActionManeuver({ name: 'Evasive Footwork' }, playerStats, 'test-campaign', 'Evasive Footwork');

        expect(result.type).toBe('popup');
        expect(result.payload.description).not.toContain('Target:');
        expect(result.logEntries[0].description).not.toContain('Target:');
    });

    it('does not expend a die or set state when no superiority dice remain', async () => {
        mockRuntime({ superiorityDice: 0 });
        const playerStats = makePlayerStats();
        const result = await executeBonusActionManeuver({ name: 'Evasive Footwork' }, playerStats, 'test-campaign', 'Evasive Footwork');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('No Superiority Dice remaining');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('returns the not-found popup without rolling or spending when the maneuver is not in the loaded list', async () => {
        loadManeuvers.mockResolvedValueOnce([]);
        const playerStats = makePlayerStats();
        const result = await executeBonusActionManeuver({ name: 'Evasive Footwork' }, playerStats, 'test-campaign', 'Evasive Footwork');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('not found');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});
