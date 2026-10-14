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
        it('returns popup when uses are 0', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return 0;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Tireless');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Regains all on a Long Rest');
        });

        it('returns popup when uses are negative', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return -2;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('does not decrement uses or roll dice when no uses remaining', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return 0;
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('uses calculation', () => {
        it('uses stored runtime value when available', async () => {
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

        it('falls back to Wisdom bonus when stored uses is undefined', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return undefined;
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

        it('uses trackedMax from _trackedResources when available', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return undefined;
                return undefined;
            });

            const playerStats = makePlayerStats({
                _trackedResources: {
                    tirelessUses: { current: 5 },
                },
            });

            await handle(makeAction(), playerStats, 'test-campaign', null);
        });

        it('uses trackedMax from _trackedResources when available', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return undefined;
                return undefined;
            });

            const playerStats = makePlayerStats({
                _trackedResources: {
                    tirelessUses: { current: 5 },
                },
            });

            await handle(makeAction(), playerStats, 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'tirelessUses',
                4,
                'test-campaign'
            );
        });

        it('uses trackedMax over Wisdom bonus', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return undefined;
                return undefined;
            });

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

        it('uses max(wisdom bonus, 1) as minimum default', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return undefined;
                return undefined;
            });

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

        it('handles string numeric stored uses', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return '3';
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
        it('uses default tempHpExpression when not specified', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(resolveDiceExpression).toHaveBeenCalledWith(
                '1d8 + WIS modifier',
                expect.any(Object)
            );
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
        });

        it('passes resolved expression to rollExpression', async () => {
            rollExpression.mockReturnValue({ total: 8, rolls: [5, 3] });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(resolveDiceExpression).toHaveBeenCalledWith(
                '1d8 + WIS modifier',
                expect.any(Object)
            );
            expect(rollExpression).toHaveBeenCalledWith('1d8 + WIS modifier');
        });

        it('rolls temp HP and stores the result', async () => {
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
            expect(result.payload.description).toContain('Could not calculate temp HP');
        });

        it('returns popup when rollResult has no total', async () => {
            rollExpression.mockReturnValue({ rolls: [1] });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Could not calculate temp HP');
        });

        it('returns popup when rollResult total is 0', async () => {
            rollExpression.mockReturnValue({ total: 0, rolls: [0] });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Could not calculate temp HP');
        });

        it('returns popup when rollResult total is negative', async () => {
            rollExpression.mockReturnValue({ total: -1, rolls: [-1] });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Could not calculate temp HP');
        });

        it('does not set tempHp on invalid roll', async () => {
            rollExpression.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'RangerGirl',
                'tempHp',
                expect.any(Number),
                'test-campaign'
            );
        });

        it('does not log ability_use on invalid roll', async () => {
            rollExpression.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('success: popup result', () => {
        it('returns automation_info popup with correct name', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Tireless');
        });

        it('includes temp HP amount in description', async () => {
            rollExpression.mockReturnValue({ total: 6, rolls: [5, 1] });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('6');
            expect(result.payload.description).toContain('temporary hit points');
        });

        it('includes uses remaining in description', async () => {
            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return 2;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Uses remaining: 1');
        });

        it('includes flavor text in description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('push beyond your limits');
        });

        it('uses custom feature name from action', async () => {
            const result = await handle(makeAction({ name: 'Enduring Stride' }), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Enduring Stride');
            expect(result.payload.description).toContain('Enduring Stride');
        });

        it('bolds feature name in description', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('<b>Tireless</b>');
        });
    });

    describe('logging', () => {
        it('logs ability_use with correct type and character', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'RangerGirl',
                abilityName: 'Tireless',
            }));
        });

        it('logs description with temp HP amount and uses remaining', async () => {
            rollExpression.mockReturnValue({ total: 4, rolls: [3, 1] });

            getRuntimeValue.mockImplementation((_playerName, key) => {
                if (key === 'tirelessUses') return 2;
                return undefined;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: expect.stringContaining('gained 4 temporary hit points'),
            }));

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: expect.stringContaining('Uses remaining: 1'),
            }));
        });

        it('logs with custom feature name', async () => {
            await handle(makeAction({ name: 'Steady Pace' }), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                abilityName: 'Steady Pace',
            }));
        });

        it('uses campaign name for logging', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.any(Object));
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

        it('passes campaignName to setRuntimeValue for uses', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'tirelessUses',
                expect.any(Number),
                'test-campaign'
            );
        });

        it('passes campaignName to setRuntimeValue for tempHp', async () => {
            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'RangerGirl',
                'tempHp',
                expect.any(Number),
                'test-campaign'
            );
        });
    });

    describe('automation payload', () => {
        it('includes automation object in popup payload', async () => {
            const auto = makeAction().automation;
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.automation).toEqual(auto);
        });
    });
});
