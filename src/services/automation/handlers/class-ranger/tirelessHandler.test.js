// @maintained-by-ai
// Deterministic pure-behaviour contract for tirelessHandler: all boundaries
// (runtime store, dice, log) are mocked; pins are exact strings/values.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './tirelessHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationExpressions.js', () => ({
    resolveDiceExpression: vi.fn((expr) => expr),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { resolveDiceExpression } = await import('../../../combat/automation/automationExpressions.js');
const { rollExpression } = await import('../../../dice/diceRoller.js');

function makePlayerStats(overrides = {}) {
    return {
        name: 'RangerGirl',
        abilities: [{ name: 'Wisdom', bonus: 3 }],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Tireless',
        automation: {
            type: 'tireless',
            resourceKey: 'tirelessUses',
            ...overrides.automation,
        },
        ...overrides,
    };
}

// Defaults: 3 stored uses, roll total 5 → tempHp 5, uses remaining 2.
beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
        if (key === 'tirelessUses') return 3;
        return undefined;
    });
    rollExpression.mockReturnValue({ total: 5, rolls: [4, 1] });
    resolveDiceExpression.mockImplementation((expr) => expr);
});

describe('tirelessHandler', () => {
    describe('guard: no uses remaining', () => {
        it('returns popup when uses are 0 without side effects', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return 0;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Tireless');
            expect(result.payload.description).toBe('Tireless has no uses remaining. Regains all on a Long Rest.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('uses calculation', () => {
        it('decrements stored runtime uses', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return 2;
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'tirelessUses',
                1,
                'test-campaign'
            );
        });

        it('falls back to Wisdom bonus when stored uses is null', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return null;
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'tirelessUses',
                2,
                'test-campaign'
            );
        });

        it('prefers trackedMax from _trackedResources over Wisdom bonus', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const playerStats = makePlayerStats({
                _trackedResources: {
                    tirelessUses: { current: 2 },
                },
            });

            await handle(makeAction(), playerStats, 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'tirelessUses',
                1,
                'test-campaign'
            );
        });

        it('floors max uses at 1 when Wisdom bonus is 0', async () => {
            getRuntimeValue.mockReturnValue(undefined);

            const playerStats = makePlayerStats({
                abilities: [{ name: 'Wisdom', bonus: 0 }],
            });

            await handle(makeAction(), playerStats, 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'tirelessUses',
                0,
                'test-campaign'
            );
        });

        it('uses custom resourceKey from automation', async () => {
            const action = makeAction({
                automation: { resourceKey: 'customTirelessUses' },
            });

            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'customTirelessUses') return 4;
                return undefined;
            });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'customTirelessUses',
                3,
                'test-campaign'
            );
        });
    });

    describe('temp HP calculation', () => {
        it('resolves and rolls the default expression', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(resolveDiceExpression).toHaveBeenCalledWith(
                '1d8 + WIS modifier',
                expect.any(Object)
            );
            expect(rollExpression).toHaveBeenCalledWith('1d8 + WIS modifier');
        });

        it('uses custom tempHpExpression from automation', async () => {
            const action = makeAction({
                automation: { tempHpExpression: '2d6 + WIS modifier' },
            });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(resolveDiceExpression).toHaveBeenCalledWith(
                '2d6 + WIS modifier',
                expect.any(Object)
            );
            expect(rollExpression).toHaveBeenCalledWith('2d6 + WIS modifier');
        });

        it('stores rolled total as tempHp', async () => {
            rollExpression.mockReturnValue({ total: 7, rolls: [6, 1] });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'tempHp',
                7,
                'test-campaign'
            );
        });
    });

    describe('failure: invalid roll result', () => {
        it('returns popup when rollExpression returns null', async () => {
            rollExpression.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Tireless: Could not calculate temp HP (1d8 + WIS modifier).');
        });

        it('returns popup when rollResult has no total', async () => {
            rollExpression.mockReturnValue({ rolls: [1] });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });

        it('returns popup when rollResult total is 0', async () => {
            rollExpression.mockReturnValue({ total: 0, rolls: [0] });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });

        it('does not write tempHp or log on invalid roll', async () => {
            rollExpression.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'RangerGirl',
                'tempHp',
                expect.any(Number),
                'test-campaign'
            );
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('success: popup result', () => {
        it('returns automation_info popup with exact composed description', async () => {
            const auto = makeAction().automation;

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Tireless');
            expect(result.payload.description).toBe(
                '<b>Tireless</b><br/><br/>You push beyond your limits, gaining 5 temporary hit points.<br/><br/>Uses remaining: 2'
            );
            expect(result.payload.automation).toEqual(auto);
        });

        it('flows custom feature name through popup and log', async () => {
            const result = await handle(makeAction({ name: 'Enduring Stride' }), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Enduring Stride');
            expect(result.payload.description).toBe(
                '<b>Enduring Stride</b><br/><br/>You push beyond your limits, gaining 5 temporary hit points.<br/><br/>Uses remaining: 2'
            );
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                abilityName: 'Enduring Stride',
            }));
        });
    });

    describe('logging', () => {
        it('logs ability_use with exact description', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'RangerGirl',
                abilityName: 'Tireless',
                description: 'RangerGirl used Tireless — gained 5 temporary hit points. Uses remaining: 2.',
            });
        });
    });

    describe('campaign name propagation', () => {
        it('passes campaignName to getRuntimeValue', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(getRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'tirelessUses',
                'test-campaign'
            );
        });
    });
});
