// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, clearCosmicOmenEffect } from './cosmicOmenHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { rollExpression } = await import('../../../dice/diceRoller.js');
const { addEntry } = await import('../../../ui/logService.js');
const { evaluateAutoExpression } = await import('../../../combat/automation/automationService.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestDruid',
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

function setupGetRuntimeValue(overrides) {
    getRuntimeValue.mockImplementation((playerName, key) => {
        const cacheKey = `${playerName}::${key}`;
        return overrides[cacheKey] ?? overrides[key] ?? null;
    });
}

describe('cosmicOmenHandler', () => {
    describe('uses check', () => {
        it('returns "no uses remaining" when usesMax > 0 but runtime uses is 0', async () => {
            setupGetRuntimeValue({
                'TestDruid::cosmicomenUses': 0,
                'TestDruid::cosmicOmenEffect': JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });

            const action = makeAction({ automation: { usesMax: 3 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });

        it('proceeds when usesMax > 0 and runtime uses is positive', async () => {
            setupGetRuntimeValue({
                'TestDruid::cosmicomenUses': 2,
                'TestDruid::cosmicOmenEffect': JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });
            rollExpression.mockReturnValue({ total: 4 });

            const action = makeAction({ automation: { usesMax: 3 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('1d6');
        });

        it('evaluates uses_expression when usesMax is 0', async () => {
            evaluateAutoExpression.mockReturnValue(2);
            setupGetRuntimeValue({
                'TestDruid::cosmicomenUses': 2,
                'TestDruid::cosmicOmenEffect': JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });
            rollExpression.mockReturnValue({ total: 3 });

            const action = makeAction({ automation: { uses_expression: 'proficiency_bonus' } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).not.toContain('no uses remaining');
        });

        it('proceeds when usesMax is 0 and no uses_expression, proceeds', async () => {
            setupGetRuntimeValue({
                'TestDruid::cosmicOmenEffect': JSON.stringify({ type: 'Woe', isEven: false, starMapRoll: 7 }),
            });
            rollExpression.mockReturnValue({ total: 2 });

            const action = makeAction({ automation: { usesMax: 0 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('1d6');
        });
    });

    describe('omen effect check', () => {
        it('returns error when no cosmicOmenEffect stored', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no omen active');
        });

        it('returns error when cosmicOmenEffect is corrupted JSON', async () => {
            getRuntimeValue.mockImplementation((playerName, key) => {
                if (key === 'cosmicOmenEffect') return 'not-valid-json';
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('corrupted');
        });
    });

    describe('Weal (Even)', () => {
        it('generates correct popup for Weal with +d6', async () => {
            setupGetRuntimeValue({
                'TestDruid::cosmicomenUses': 1,
                'TestDruid::cosmicOmenEffect': JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });
            rollExpression.mockReturnValue({ total: 4 });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Weal');
            expect(result.payload.description).toContain('Even');
            expect(result.payload.description).toContain('+4');
            expect(result.payload.description).toContain('1d6');
        });

        it('stores cosmicOmenPendingBonus with correct value', async () => {
            setupGetRuntimeValue({
                'TestDruid::cosmicomenUses': 1,
                'TestDruid::cosmicOmenEffect': JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });
            rollExpression.mockReturnValue({ total: 4 });

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            const pendingCall = setRuntimeValue.mock.calls.find(
                (call) => call[1] === 'cosmicOmenPendingBonus'
            );
            expect(pendingCall).toBeDefined();
            const pendingData = JSON.parse(pendingCall[2]);
            expect(pendingData.value).toBe(4);
            expect(pendingData.type).toBe('Weal');
        });
    });

    describe('Woe (Odd)', () => {
        it('generates correct popup for Woe with -d6', async () => {
            setupGetRuntimeValue({
                'TestDruid::cosmicomenUses': 1,
                'TestDruid::cosmicOmenEffect': JSON.stringify({ type: 'Woe', isEven: false, starMapRoll: 7 }),
            });
            rollExpression.mockReturnValue({ total: 3 });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Woe');
            expect(result.payload.description).toContain('Odd');
            expect(result.payload.description).toContain('-3');
        });

        it('stores cosmicOmenPendingBonus with correct type', async () => {
            setupGetRuntimeValue({
                'TestDruid::cosmicomenUses': 1,
                'TestDruid::cosmicOmenEffect': JSON.stringify({ type: 'Woe', isEven: false, starMapRoll: 7 }),
            });
            rollExpression.mockReturnValue({ total: 3 });

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            const pendingCall = setRuntimeValue.mock.calls.find(
                (call) => call[1] === 'cosmicOmenPendingBonus'
            );
            expect(pendingCall).toBeDefined();
            const pendingData = JSON.parse(pendingCall[2]);
            expect(pendingData.type).toBe('Woe');
        });
    });

    describe('state updates', () => {
        it('decrements runtime uses when usesMax > 0', async () => {
            setupGetRuntimeValue({
                'TestDruid::cosmicomenUses': 3,
                'TestDruid::cosmicOmenEffect': JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });
            rollExpression.mockReturnValue({ total: 5 });

            await handle(makeAction({ automation: { usesMax: 3 } }), makePlayerStats(), 'test-campaign');

            const usesCall = setRuntimeValue.mock.calls.find(
                (call) => call[1] === 'cosmicomenUses'
            );
            expect(usesCall).toBeDefined();
            expect(usesCall[2]).toBe(2);
        });

        it('does not decrement uses when usesMax is 0', async () => {
            setupGetRuntimeValue({
                'TestDruid::cosmicOmenEffect': JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });
            rollExpression.mockReturnValue({ total: 5 });

            await handle(makeAction({ automation: { usesMax: 0 } }), makePlayerStats(), 'test-campaign');

            const usesCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'cosmicomenUses'
            );
            expect(usesCalls).toHaveLength(0);
        });

        it('logs to campaign log with correct details', async () => {
            setupGetRuntimeValue({
                'TestDruid::cosmicomenUses': 1,
                'TestDruid::cosmicOmenEffect': JSON.stringify({ type: 'Woe', isEven: false, starMapRoll: 7 }),
            });
            rollExpression.mockReturnValue({ total: 3 });

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestDruid',
                    abilityName: 'Cosmic Omen',
                    description: expect.stringContaining('Woe'),
                })
            );
        });
    });

    describe('result format', () => {
        it('returns popup with correct fields', async () => {
            setupGetRuntimeValue({
                'TestDruid::cosmicomenUses': 1,
                'TestDruid::cosmicOmenEffect': JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 12 }),
            });
            rollExpression.mockReturnValue({ total: 2 });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Cosmic Omen');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('uses default feature name when action name is missing', async () => {
            setupGetRuntimeValue({
                'TestDruid::cosmicOmenEffect': JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });
            rollExpression.mockReturnValue({ total: 1 });

            const result = await handle(
                { automation: { type: 'cosmic_omen' } },
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.payload.name).toBe('Cosmic Omen');
        });
    });

    describe('clearCosmicOmenEffect', () => {
        it('clears cosmicOmenEffect for given player and campaign', async () => {
            await clearCosmicOmenEffect('TestDruid', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestDruid',
                'cosmicOmenEffect',
                null,
                'test-campaign'
            );
        });
    });
});
// @cleaned-by-ai
