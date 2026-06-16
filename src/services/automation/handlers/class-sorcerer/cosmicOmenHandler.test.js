import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, clearCosmicOmenEffect } from './cosmicOmenHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { rollExpression } = await import('../../../dice/diceRoller.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');
const { evaluateAutoExpression } = await import('../../../combat/automation/automationService.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Cosmic Omen',
        automation: {
            type: 'cosmic_omen',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('cosmicOmenHandler', () => {
    describe('uses checks', () => {
        it('skips uses check when usesMax is 0', async () => {
            getRuntimeValue.mockReturnValue(0);

            const action = makeAction({ automation: { usesMax: 0 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).not.toContain('no uses remaining');
        });

        it('evaluates uses_expression when usesMax is 0', async () => {
            evaluateAutoExpression.mockReturnValue(2);
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({ automation: { uses_expression: '2d4' } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(evaluateAutoExpression).toHaveBeenCalledWith('2d4', expect.any(Object));
            expect(result.payload.description).not.toContain('no uses remaining');
        });

        it('evaluates uses_expression when usesMax is falsy', async () => {
            evaluateAutoExpression.mockReturnValue(1);
            getRuntimeValue.mockReturnValue(null);

            const action = makeAction({ automation: { usesMax: 0, uses_expression: '1d6' } });
            await handle(action, makePlayerStats(), 'test-campaign');

            expect(evaluateAutoExpression).toHaveBeenCalledWith('1d6', expect.any(Object));
        });

        it('uses usesMax directly when provided', async () => {
            getRuntimeValue.mockReturnValue(1);

            const action = makeAction({ automation: { usesMax: 3 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(evaluateAutoExpression).not.toHaveBeenCalled();
            expect(result.type).toBe('popup');
        });
    });

    describe('star map roll', () => {
        it('returns error when roll fails', async () => {
            getRuntimeValue.mockReturnValue(1);
            rollExpression.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Star Map roll failed');
        });

        it('generates even result (Weal)', async () => {
            getRuntimeValue.mockReturnValue(1);
            rollExpression.mockImplementation((expr) => {
                if (expr === '1d20') return { total: 10 };
                if (expr === '1d6') return { total: 4 };
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.cosmicOmenResult.type).toBe('Weal');
            expect(result.payload.cosmicOmenResult.isEven).toBe(true);
            expect(result.payload.cosmicOmenResult.d6Value).toBe(4);
            expect(result.payload.cosmicOmenResult.starMapRoll).toBe(10);
            expect(result.payload.description).toContain('Even');
            expect(result.payload.description).toContain('Weal');
            expect(result.payload.description).toContain('Allies add 4');
        });

        it('generates odd result (Woe)', async () => {
            getRuntimeValue.mockReturnValue(1);
            rollExpression.mockImplementation((expr) => {
                if (expr === '1d20') return { total: 7 };
                if (expr === '1d6') return { total: 3 };
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.cosmicOmenResult.type).toBe('Woe');
            expect(result.payload.cosmicOmenResult.isEven).toBe(false);
            expect(result.payload.description).toContain('Odd');
            expect(result.payload.description).toContain('Woe');
            expect(result.payload.description).toContain('Enemies subtract 3');
        });

        it('handles d6Roll returning null', async () => {
            getRuntimeValue.mockReturnValue(1);
            rollExpression.mockImplementation((expr) => {
                if (expr === '1d20') return { total: 12 };
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.cosmicOmenResult.d6Value).toBe(0);
        });
    });

    describe('state updates', () => {
        it('sets cosmicOmenEffect runtime value', async () => {
            getRuntimeValue.mockReturnValue(1);
            rollExpression.mockImplementation((expr) => {
                if (expr === '1d20') return { total: 8 };
                if (expr === '1d6') return { total: 5 };
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'cosmicOmenEffect',
                expect.stringContaining('"type":"Weal"'),
                'test-campaign'
            );
        });

        it('adds expiration effect', async () => {
            getRuntimeValue.mockReturnValue(1);
            rollExpression.mockReturnValue({ total: 10 });

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(addExpiration).toHaveBeenCalledWith(
                'TestSorcerer',
                'TestSorcerer',
                [{ type: 'remove_cosmic_omen' }],
                'test-campaign',
                100
            );
        });

    });

    describe('result format', () => {
        it('returns popup with correct fields', async () => {
            getRuntimeValue.mockReturnValue(1);
            rollExpression.mockImplementation((expr) => {
                if (expr === '1d20') return { total: 15 };
                if (expr === '1d6') return { total: 2 };
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Cosmic Omen');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('uses action name as feature name', async () => {
            getRuntimeValue.mockReturnValue(1);
            rollExpression.mockReturnValue({ total: 10 });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.name).toBe('Cosmic Omen');
        });

        it('uses default feature name when action name missing', async () => {
            getRuntimeValue.mockReturnValue(1);
            rollExpression.mockReturnValue({ total: 10 });

            const result = await handle(
                { automation: { type: 'cosmic_omen' } },
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.payload.name).toBe('Cosmic Omen');
        });
    });

    describe('clearCosmicOmenEffect', () => {
        it('clears cosmicOmenEffect', async () => {
            await clearCosmicOmenEffect('TestSorcerer', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'cosmicOmenEffect',
                null,
                'test-campaign'
            );
        });
    });
});
