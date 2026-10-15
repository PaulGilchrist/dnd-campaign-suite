// @maintained-by-ai: 2026-10-15
// MN-016 Rally lane for executeActionManeuvers.js ONLY — the executeBonusActionManeuver
// temp_hp path: gateRallyAllies refusal (popup + refusal log, zero roll/spend/stamp),
// buildRallyModal payload (allyOptions, extraHp via extraHpExpression, totalHp), the
// rallyChoice envelope, die expend, and Relentless free-roll wiring through this executor.
// Source-dup flags (continuation only, NOT fixed here): buildRallyModal/gateRallyAllies
// twins live in executeManeuver.js — pinned by combatSuperiorityHandlerManeuver-modals;
// the confirm side (executeRallyChoice) is owned by combatSuperiorityChoices — no
// confirm-side coverage here by design. Relentless latch internals are canonical in
// combatSuperiorityUtils.test.js — this lane pins the caller-side wiring only.
// Deterministic: mock runtime router, fixed rollExpression returns, turn-based rounds.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeBonusActionManeuver } from './executeActionManeuvers.js';
import { addEntry } from '../../../ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { rollExpression } from '../../../dice/diceRoller.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(async () => [
        { name: 'Rally', description: 'Choose an ally to gain temporary hit points.', actionType: 'bonus_action', effect: 'temp_hp', dieExpression: 'superiority_die', extraHpExpression: 'fighter_level / 2' },
    ]),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'EvasiveFighter' }, { name: 'HexWarlock' }] }),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveTarget: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn().mockReturnValue({ total: 7 }),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn((expression) => (expression === 'fighter_level / 2' ? 9 : 12)),
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

const makePlayerStats = (passives = []) => ({
    name: 'EvasiveFighter',
    level: 18,
    rules: '2024',
    automation: { passives },
});

describe('executeBonusActionManeuver — MN-016 Rally', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockImplementation((_name, key) => {
            if (key === 'superiorityDice') return 6;
            return null;
        });
    });

    it('returns rallyChoice modal with ally options and die + fighter_level/2 temp HP, expending a die', async () => {
        const playerStats = makePlayerStats();
        const result = await executeBonusActionManeuver({ name: 'Rally' }, playerStats, 'test-campaign', 'Rally');

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('rallyChoice');
        expect(result.payload.allyOptions).toEqual([{ label: 'HexWarlock', value: 'HexWarlock' }]);
        expect(result.payload.dieValue).toBe(7);
        expect(result.payload.extraHp).toBe(9);
        expect(result.payload.totalHp).toBe(16);
        expect(rollExpression).toHaveBeenCalledWith('1d12');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', 5, 'test-campaign');
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].description).toBe('Rally: Choose an ally to gain temporary hit points.');
        expect(result.payload.description).toBe('<b>Rally</b> (Bonus Action)<br/>Rolled d12 for 7.');
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('rolls a free Relentless d8 without expending a die and still returns the picker', async () => {
        rollExpression.mockReturnValue({ total: 5 });
        const playerStats = makePlayerStats([{ type: 'passive_rule', effect: 'relentless' }]);
        const result = await executeBonusActionManeuver({ name: 'Rally' }, playerStats, 'test-campaign', 'Rally');

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('rallyChoice');
        expect(rollExpression).toHaveBeenCalledWith('1d8');
        expect(result.payload.dieValue).toBe(5);
        expect(result.payload.description).toBe('<b>Rally</b> (Bonus Action)<br/>Rolled d8 for 5 (Relentless).');
        expect(setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', 'relentlessUsedRound', 1, 'test-campaign');
        expect(setRuntimeValue).not.toHaveBeenCalledWith('EvasiveFighter', 'superiorityDice', 5, 'test-campaign');
    });

    it('with no allies: no roll, no die spend, no Relentless latch — popup + refusal log entry only', async () => {
        const damageUtils = await import('../../../rules/combat/damageUtils.js');
        damageUtils.getCombatContext.mockResolvedValueOnce({ creatures: [{ name: 'EvasiveFighter' }] });
        const playerStats = makePlayerStats([{ type: 'passive_rule', effect: 'relentless' }]);
        const result = await executeBonusActionManeuver({ name: 'Rally' }, playerStats, 'test-campaign', 'Rally');

        expect(result.type).toBe('popup');
        expect(result.payload).toMatchObject({ type: 'automation_info', name: 'Rally' });
        expect(result.payload.description).toBe('Rally: No allies available to receive Rally.');
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(result.logEntries).toHaveLength(1);
        expect(result.logEntries[0].description).toBe('Rally: No allies available to receive Rally.');
    });
});
