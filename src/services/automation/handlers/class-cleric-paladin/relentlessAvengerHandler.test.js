// @maintained-by-ai: 2026-10-15
// Unit lane for the Relentless Avenger handler (paladin Oath of Vengeance reaction).
// Pins the full contract of handle(): the ability_use log entry (exact description,
// with ' against <target>' suffix or bare when no target), the campaign targetEffects
// append (exact new-effect shape, duration passthrough vs 'until_end_of_current_turn'
// default, preserved ordering of stored effects), the target's activeConditions stamp of
// 'speed_zero' and its already-applied guard (no second write when speed_zero is live),
// and the automation_info popup payload for both branches.
// The automationInfoBuilder display defaults and collector typing registrations for this
// automation type are covered in their own suites (core-handlers.test.js,
// automationCollector.types.test.js) — canonical there, not duplicated here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './relentlessAvengerHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { getCombatContext, getTargetFromAttacker } = await import('../../../rules/combat/damageUtils.js');

const CAMPAIGN_NAME = 'test-campaign';
const TARGET_NAME = 'Goblin';

const SPEED_ZERO_EFFECT = {
    target: TARGET_NAME,
    source: 'Relentless Avenger',
    option: 'Relentless Avenger',
    effect: 'speed_zero',
    value: null,
    duration: 'until_end_of_current_turn',
};

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestPaladin',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Relentless Avenger',
        automation: {
            type: 'relentless_avenger',
            duration: 'until_end_of_current_turn',
            ...overrides.automation,
        },
        ...overrides,
    };
}

// getRuntimeValue router: serves the two reads this handler performs
// (campaign targetEffects, target activeConditions) independently.
function mockRuntime({ targetEffects = [], activeConditions = [] } = {}) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'targetEffects') return targetEffects;
        if (key === 'activeConditions') return activeConditions;
        return null;
    });
}

function targetEffectWrites() {
    return setRuntimeValue.mock.calls.filter((c) => c[1] === 'targetEffects');
}

function conditionWrites() {
    return setRuntimeValue.mock.calls.filter((c) => c[1] === 'activeConditions');
}

describe('relentlessAvengerHandler', () => {
    describe('no target', () => {
        it('logs ability use and returns info popup without writing any state', async () => {
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
                type: 'ability_use',
                characterName: 'TestPaladin',
                abilityName: 'Relentless Avenger',
                description: 'Relentless Avenger used',
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Relentless Avenger',
                    automationType: 'relentless_avenger',
                    description: 'Relentless Avenger — <i>No target selected — effect noted for manual application.</i>',
                    automation: makeAction().automation,
                },
            });
        });
    });

    describe('with target', () => {
        beforeEach(() => {
            getCombatContext.mockResolvedValue({});
            getTargetFromAttacker.mockReturnValue({ name: TARGET_NAME });
        });

        it('logs the log entry, appends speed_zero target effect, stamps condition, returns popup', async () => {
            mockRuntime();

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
                type: 'ability_use',
                characterName: 'TestPaladin',
                abilityName: 'Relentless Avenger',
                description: 'Relentless Avenger used against Goblin',
            });
            expect(setRuntimeValue).toHaveBeenCalledTimes(2);
            expect(targetEffectWrites()).toEqual([
                ['campaign', 'targetEffects', [SPEED_ZERO_EFFECT], CAMPAIGN_NAME],
            ]);
            expect(conditionWrites()).toEqual([
                ['Goblin', 'activeConditions', ['speed_zero'], CAMPAIGN_NAME],
            ]);
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Relentless Avenger',
                    automationType: 'relentless_avenger',
                    description: "Goblin's Speed is reduced to 0 until end of current turn. You may move up to half your Speed as part of this Reaction.",
                    automation: action.automation,
                },
            });
        });

        it('skips the activeConditions write when target already has speed_zero', async () => {
            mockRuntime({ activeConditions: ['speed_zero'] });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(conditionWrites()).toEqual([]);
            expect(targetEffectWrites()).toEqual([
                ['campaign', 'targetEffects', [SPEED_ZERO_EFFECT], CAMPAIGN_NAME],
            ]);
            expect(result.payload.description).toBe(
                "Goblin's Speed is reduced to 0 until end of current turn. You may move up to half your Speed as part of this Reaction."
            );
        });

        it('passes a custom duration through to the stored effect', async () => {
            mockRuntime();

            await handle(
                makeAction({ automation: { duration: '1_round' } }),
                makePlayerStats(),
                CAMPAIGN_NAME,
                null
            );

            expect(targetEffectWrites()).toEqual([
                ['campaign', 'targetEffects', [{ ...SPEED_ZERO_EFFECT, duration: '1_round' }], CAMPAIGN_NAME],
            ]);
        });

        it('appends the new effect after existing stored target effects', async () => {
            const previous = { target: 'PreviousTarget', effect: 'blinded' };
            mockRuntime({ targetEffects: [previous] });

            await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(targetEffectWrites()).toEqual([
                ['campaign', 'targetEffects', [previous, SPEED_ZERO_EFFECT], CAMPAIGN_NAME],
            ]);
        });
    });
});
