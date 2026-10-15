// @maintained-by-ai: 2026-10-15 — deterministic: handle() is pure over mocked
// findLastAttack/getRuntimeValue/evaluateAutoExpression/getCombatContext/buildSaveDc/
// addEntry; every test pins a distinct branch (3-clause reaction-damage guard with
// no-side-effect refusal, full modal payload own-composition, null-context grace,
// buildSaveDc delegation, full truth table for the Steps-of-the-Fey count read
// Number(runtime ?? (eval || 1)) — runtime wins, usesMax when unset, 1 when both
// falsy, 0 respected (?? not ||; unlike stepsOfTheFeyHandler's 0-guard, escape
// defers exhaustion to the taunt modal), log pin + log-failure grace).
// Seam: this is the 'mistyEscape' producer of the shared stepsOfTheFeyTaunt modal
// (stepsOfTheFey/bewitchingMagic modes pinned in their own files; modal-side render
// in StepsOfTheFeyTauntModal.render.test.jsx). It READS _Steps_of_the_Fey_freeCastCount
// only — the write/decrement lives in the taunt-modal confirm lane. mistyWanderer
// owns the separate _Misty_Wanderer_freeCastCount pool (mistyWandererHandler.test.js).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './mistyEscapeHandler.js';

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

const { findLastAttack } = await import('../../common/damageRollback.js');
const { addEntry } = await import('../../../ui/logService.js');
const { buildSaveDc } = await import('../../common/savePrompt.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
const { getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { evaluateAutoExpression } = await import('../../../combat/automation/automationExpressions.js');

const campaignName = 'test-campaign';
const playerName = 'WarlockGirl';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        abilities: [{ name: 'CHA', bonus: 4 }],
        proficiency: 3,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Misty Escape',
        automation: {
            type: 'misty_escape',
            saveDc: 15,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makeRecentAttack(overrides = {}) {
    return {
        attackEvent: { round: 3 },
        attackerName: 'Goblin',
        targetName: playerName,
        totalDamage: 10,
        ...overrides,
    };
}

// Neutral happy-path baseline. Count mocks are set so runtime count and usesMax
// are distinguishable (runtime 2 vs usesMax 5) unless a test overrides them.
function setupModalMocks(overrides = {}) {
    findLastAttack.mockResolvedValue(makeRecentAttack(overrides.attack));
    buildSaveDc.mockReturnValue(15);
    evaluateAutoExpression.mockReturnValue(overrides.usesMax !== undefined ? overrides.usesMax : 5);
    getRuntimeValue.mockReturnValue(overrides.runtimeCount !== undefined ? overrides.runtimeCount : 2);
    getCombatContext.mockResolvedValue(overrides.combatContext !== undefined ? overrides.combatContext : {
        creatures: [
            { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 },
            { name: playerName, type: 'player', currentHp: 20, maxHp: 20 },
            { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 20 },
        ],
    });
}

beforeEach(() => {
    vi.resetAllMocks();
});

describe('mistyEscapeHandler', () => {
    describe('guard: no recent damage taken', () => {
        const refusals = [
            { attack: { attackEvent: null, targetName: null, totalDamage: 0 }, description: 'no attackEvent' },
            { attack: { targetName: 'OtherPlayer' }, description: 'damage taken by a different target' },
            { attack: { totalDamage: 0 }, description: 'zero totalDamage' },
        ];

        for (const { attack, description } of refusals) {
            it(`returns popup and performs no side effects when ${description}`, async () => {
                findLastAttack.mockResolvedValue(makeRecentAttack(attack));

                const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Misty Escape');
                expect(result.payload.description).toContain('No recent damage taken');
                expect(findLastAttack).toHaveBeenCalledWith(campaignName);
                expect(buildSaveDc).not.toHaveBeenCalled();
                expect(getCombatContext).not.toHaveBeenCalled();
                expect(addEntry).not.toHaveBeenCalled();
            });
        }
    });

    describe('modal return', () => {
        it('returns mistyEscape taunt modal with full payload, filtering the player from targets', async () => {
            setupModalMocks();
            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('stepsOfTheFeyTaunt');
            expect(result.payload.mode).toBe('mistyEscape');
            expect(result.payload.title).toBe('Misty Step');
            expect(result.payload.featureName).toBe('Misty Escape');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.freeCastCountKey).toBe('_Steps_of_the_Fey_freeCastCount');
            expect(result.payload.newCount).toBe(2); // runtime count wins over usesMax (5)
            expect(result.payload.campaignName).toBe(campaignName);
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(playerStats);
            expect(result.payload.targets.map(t => t.name)).toEqual(['Goblin', 'Orc']);
            expect(findLastAttack).toHaveBeenCalledWith(campaignName);
            expect(getRuntimeValue).toHaveBeenCalledWith(playerName, '_Steps_of_the_Fey_freeCastCount', campaignName);
            expect(buildSaveDc).toHaveBeenCalledWith(action.automation, playerStats);
        });

        it('returns modal with empty targets when combat context is null', async () => {
            setupModalMocks({ combatContext: null });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.payload.targets).toEqual([]);
        });

        it('delegates saveDc to buildSaveDc and featureName to action.name', async () => {
            setupModalMocks();
            buildSaveDc.mockReturnValue(17);

            const result = await handle(
                makeAction({ name: 'Shadow Blink' }),
                makePlayerStats(),
                campaignName,
                null
            );

            expect(result.payload.featureName).toBe('Shadow Blink');
            expect(result.payload.saveDc).toBe(17);
            expect(buildSaveDc).toHaveBeenCalledWith({ type: 'misty_escape', saveDc: 15 }, makePlayerStats());
        });
    });

    describe('Steps of the Fey free-cast count read', () => {
        it('evaluates custom uses_expression and falls back to usesMax when runtime count is unset', async () => {
            setupModalMocks();
            getRuntimeValue.mockReturnValue(undefined);
            evaluateAutoExpression.mockReturnValue(3);

            const result = await handle(
                makeAction({ automation: { type: 'misty_escape', uses_expression: '2d4' } }),
                makePlayerStats(),
                campaignName,
                null
            );

            expect(evaluateAutoExpression).toHaveBeenCalledWith('2d4', expect.any(Object));
            expect(result.payload.newCount).toBe(3);
        });

        it('defaults count to 1 when expression and runtime count are both falsy', async () => {
            setupModalMocks();
            getRuntimeValue.mockReturnValue(undefined);
            evaluateAutoExpression.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.newCount).toBe(1);
        });

        it('respects a runtime count of 0 instead of substituting usesMax', async () => {
            // ?? not ||: exhaustion is shown to the taunt modal, which owns the
            // 0-uses presentation (stepsOfTheFeyHandler guards with a popup instead).
            setupModalMocks();
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.payload.newCount).toBe(0);
        });
    });

    describe('logging', () => {
        it('logs ability_use with character, feature, and misty step description', async () => {
            setupModalMocks();

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Misty Escape',
            }));
            const entry = addEntry.mock.calls[0][1];
            expect(entry.description).toContain(playerName);
            expect(entry.description).toContain('Misty Step');
            expect(entry.description).toContain('Dreadful Step');
        });

        it('still returns the modal when logging fails', async () => {
            setupModalMocks();
            addEntry.mockRejectedValueOnce(new Error('log failed'));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
        });
    });
});
