// @maintained-by-ai: 2026-10-15 — deterministic: handle() is pure over mocked
// getRuntimeValue/evaluateAutoExpression/getCombatContext; every test pins a distinct
// branch (free-cast-count popup guard at 0 — deliberate asymmetry vs mistyEscapeHandler,
// which defers exhaustion to the taunt modal showing count 0, while this lane guards
// with a popup; count-read truth table Number(runtime ?? (eval || 1)) — runtime wins
// (including 0, ?? not ||), usesMax when runtime unset, 1 when eval falsy, default
// 'CHA modifier_min_1' expression when uses_expression unset; null-context and
// empty-roster Misty Step popups; single no-eligible-targets popup covering both the
// solo-warlock and all-same-name roster shapes; full modal own-composition pin with
// exact-key freeCastCountKey and warlock-name target filtering (exact + same-name);
// custom action.name drives featureName and the derived _<featureName>_freeCastCount
// key; save-Dc edge table — prof/CHA defaults, Charisma selection among abilities).
// Seam: this is the 'stepsOfTheFey' producer of the shared stepsOfTheFeyTaunt modal
// and OWNS the _Steps_of_the_Fey_freeCastCount write-side pool via the modal payload's
// freeCastCountKey (decrement lives in the taunt-modal confirm lane). mistyEscape pins
// its read-only twin of the counter; bewitchingMagic pins its own mode (no dedupe per
// audit); modal-side render in StepsOfTheFeyTauntModal.*.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './stepsOfTheFeyHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

const { getRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { evaluateAutoExpression } = await import('../../../combat/automation/automationExpressions.js');
const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');

const campaignName = 'TestCampaign';
const playerName = 'TestWarlock';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Charisma', bonus: 2 }],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Steps of the Fey',
        automation: {
            type: 'free_cast',
            uses_expression: 'CHA modifier_min_1',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function setupUses(uses) {
    getRuntimeValue.mockImplementation((_name, key, _campaign) => {
        if (key === '_Steps_of_the_Fey_freeCastCount') return uses;
        return null;
    });
    evaluateAutoExpression.mockReturnValue(1);
}

function setupCombatContext(context) {
    getCombatContext.mockResolvedValue(context);
}

describe('stepsOfTheFeyHandler.handle', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('guard: remaining uses check', () => {
        it('returns popup when no free uses remaining (count is 0)', async () => {
            // ?? not ||: runtime 0 wins over usesMax (1) and is GUARDED here with a
            // popup — the deliberate counterpart to mistyEscapeHandler, which shows
            // count 0 to its modal instead. Do not "unify" the two presentations.
            setupUses(0);
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Steps of the Fey');
            expect(result.payload.description).toBe('No free uses of Steps of the Fey remaining. Finish a Long Rest to regain them.');
            expect(result.payload.automation).toBe(action.automation);
            expect(getRuntimeValue).toHaveBeenCalledWith(playerName, '_Steps_of_the_Fey_freeCastCount', campaignName);
            expect(getCombatContext).not.toHaveBeenCalled();
        });
    });

    describe('free-cast count derivation: Number(runtime ?? (eval || 1))', () => {
        it('uses currentCount from runtime value in newCount (runtime wins over usesMax)', async () => {
            setupUses(3); // evaluateAutoExpression stub returns 1
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.newCount).toBe(3);
        });

        it('uses evaluated expression result for uses when runtime value is null', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(2);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });
            const action = makeAction({ automation: { type: 'free_cast', uses_expression: '2d4' } });

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(evaluateAutoExpression).toHaveBeenCalledWith('2d4', expect.any(Object));
            expect(result.payload.newCount).toBe(2);
        });

        it('defaults usesMax to 1 when expression evaluates falsy and runtime is unset', async () => {
            // || 1 sits on the eval result only — a runtime 0 pops up instead (above).
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(0);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.payload.newCount).toBe(1);
        });

        it('falls back to the default CHA expression when uses_expression is unset', async () => {
            getRuntimeValue.mockReturnValue(null);
            evaluateAutoExpression.mockReturnValue(2);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });
            const action = makeAction({ automation: { type: 'free_cast' } });

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(evaluateAutoExpression).toHaveBeenCalledWith('CHA modifier_min_1', expect.any(Object));
            expect(result.payload.newCount).toBe(2);
        });
    });

    describe('guard: combat context', () => {
        it('returns popup with Misty Step trigger when no creatures in combat', async () => {
            setupUses(1);
            setupCombatContext({ creatures: [] });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.triggerMistyStep).toBe(true);
            expect(result.payload.description).toBe('Steps of the Fey: Cast Misty Step without expending a spell slot (1 remaining).<br/><br/>No creatures in combat for Taunting Step.');
        });

        it.each([
            ['null', null],
            ['missing creatures', {}],
        ])('returns popup when combat context is %s', async (_label, context) => {
            setupUses(1);
            setupCombatContext(context);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.triggerMistyStep).toBe(true);
            expect(result.payload.description).toContain('No creatures in combat');
        });
    });

    describe('guard: eligible targets', () => {
        it('returns popup when no creatures other than the warlock are in combat', async () => {
            // Single eligibleTargets.length === 0 branch — covers both the solo-warlock
            // roster and the same-name-NPC roster shape in one pin.
            setupUses(1);
            setupCombatContext({
                creatures: [
                    { name: playerName, type: 'player', currentHp: 20, maxHp: 20 },
                    { name: playerName, type: 'npc', currentHp: 5, maxHp: 10 },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.triggerMistyStep).toBe(true);
            expect(result.payload.description).toBe('Steps of the Fey: Cast Misty Step without expending a spell slot (1 remaining).<br/><br/>No other creatures in combat for Taunting Step.');
        });
    });

    describe('modal return for creature selection', () => {
        it('returns modal with full payload composition and warlock filtered from targets', async () => {
            setupUses(2);
            setupCombatContext({
                creatures: [
                    { name: playerName, type: 'player', currentHp: 20, maxHp: 20 },
                    { name: playerName, type: 'npc', currentHp: 5, maxHp: 10 },
                    { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 10 },
                    { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 20 },
                ],
            });
            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('stepsOfTheFeyTaunt');
            expect(result.payload.mode).toBe('stepsOfTheFey');
            // exact-name filter: warlock player AND same-name NPC excluded
            expect(result.payload.targets.map(t => t.name)).toEqual(['Goblin', 'Orc']);
            expect(result.payload.saveDc).toBe(13); // 8 + 2 (CHA) + 3 (prof)
            expect(result.payload.featureName).toBe('Steps of the Fey');
            expect(result.payload.newCount).toBe(2);
            expect(result.payload.freeCastCountKey).toBe('_Steps_of_the_Fey_freeCastCount');
            expect(result.payload.campaignName).toBe(campaignName);
            expect(result.payload.action).toBe(action);
            expect(result.payload.playerStats).toBe(playerStats);
        });

        it('uses action.name as featureName and derives freeCastCountKey from it', async () => {
            setupUses(1);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });
            const action = makeAction({ name: 'Custom Feature' });

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.payload.featureName).toBe('Custom Feature');
            expect(result.payload.freeCastCountKey).toBe('_Custom_Feature_freeCastCount');
        });
    });

    describe('save DC calculation', () => {
        it('defaults to 8 when proficiency is missing', async () => {
            setupUses(1);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });

            const result = await handle(makeAction(), makePlayerStats({ proficiency: undefined }), campaignName, null);

            expect(result.payload.saveDc).toBe(10); // 8 + 2 (CHA) + 0
        });

        it('defaults to 8 when Charisma bonus is missing', async () => {
            setupUses(1);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });

            const result = await handle(makeAction(), makePlayerStats({ abilities: [] }), campaignName, null);

            expect(result.payload.saveDc).toBe(11); // 8 + 0 (no CHA) + 3 (prof)
        });

        it('selects the Charisma bonus from the abilities list, ignoring other abilities', async () => {
            setupUses(1);
            setupCombatContext({ creatures: [{ name: 'Goblin', type: 'npc' }] });

            const result = await handle(
                makeAction(),
                makePlayerStats({ abilities: [{ name: 'Strength', bonus: 4 }, { name: 'Charisma', bonus: 5 }] }),
                campaignName,
                null
            );

            expect(result.payload.saveDc).toBe(16); // 8 + 5 (CHA) + 3 (prof)
        });
    });
});
