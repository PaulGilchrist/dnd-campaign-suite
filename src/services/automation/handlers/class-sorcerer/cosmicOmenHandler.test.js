// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
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

function setupRuntimeValues(overrides) {
    getRuntimeValue.mockImplementation((_playerName, key, _campaignName) => {
        return overrides[key] ?? null;
    });
}

describe('cosmicOmenHandler', () => {
    describe('uses check', () => {
        it('returns popup with "no uses remaining" when current uses is zero or negative', async () => {
            const zeroValues = [0, '0', -1];

            for (const usesValue of zeroValues) {
                vi.clearAllMocks();
                setupRuntimeValues({ cosmicomenUses: usesValue });

                const action = makeAction({ automation: { usesMax: 3 } });
                const result = await handle(action, makePlayerStats(), 'test-campaign');

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('no uses remaining');
                expect(result.payload.description).toContain('Recharges on a Long Rest');
            }
        });

        it('proceeds when usesMax > 0 and current uses is positive', async () => {
            const positiveValues = [2, 1];

            for (const usesValue of positiveValues) {
                vi.clearAllMocks();
                setupRuntimeValues({
                    cosmicomenUses: usesValue,
                    cosmicOmenEffect: JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
                });
                rollExpression.mockReturnValue({ total: 4 });

                const action = makeAction({ automation: { usesMax: 3 } });
                const result = await handle(action, makePlayerStats(), 'test-campaign');

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('1d6');
            }
        });

        it('handles uses_expression evaluation correctly', async () => {
            vi.clearAllMocks();
            evaluateAutoExpression.mockReturnValue(2);
            setupRuntimeValues({
                cosmicomenUses: 2,
                cosmicOmenEffect: JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });
            rollExpression.mockReturnValue({ total: 3 });

            const action = makeAction({ automation: { uses_expression: 'proficiency_bonus' } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).not.toContain('no uses remaining');
            expect(result.payload.description).toContain('1d6');
        });

        it('proceeds without checking uses when usesMax is 0 and no uses_expression (unlimited)', async () => {
            setupRuntimeValues({ cosmicOmenEffect: JSON.stringify({ type: 'Woe', isEven: false, starMapRoll: 7 }) });
            rollExpression.mockReturnValue({ total: 2 });

            const action = makeAction({ automation: { usesMax: 0 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('1d6');
        });
    });

    describe('omen effect check', () => {
        it('returns popup with "no omen active" when cosmicOmenEffect is null', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no omen active');
            expect(result.payload.description).toContain('Star Map');
        });
    });

    describe('d6 roll failure', () => {
        it('returns popup with "roll failed" when rollExpression returns falsy', async () => {
            setupRuntimeValues({
                cosmicomenUses: 1,
                cosmicOmenEffect: JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });
            rollExpression.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('roll failed');
        });
    });

    describe('Weal (Even)', () => {
        it('generates correct popup and stores pending bonus for Weal', async () => {
            const rollValues = [4, 0];

            for (const d6Value of rollValues) {
                vi.clearAllMocks();
                setupRuntimeValues({
                    cosmicomenUses: 1,
                    cosmicOmenEffect: JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
                });
                rollExpression.mockReturnValue({ total: d6Value });

                const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

                expect(result.type).toBe('popup');
                expect(result.payload.description).toContain('Weal');
                expect(result.payload.description).toContain('Even');
                expect(result.payload.description).toContain(`+${d6Value}`);
            }

            const pendingCall = setRuntimeValue.mock.calls.find(
                (call) => call[1] === 'cosmicOmenPendingBonus'
            );
            expect(pendingCall).toBeDefined();
            const pendingData = JSON.parse(pendingCall[2]);
            expect(pendingData.type).toBe('Weal');
        });
    });

    describe('Woe (Odd)', () => {
        it('generates correct popup and stores pending bonus for Woe', async () => {
            setupRuntimeValues({
                cosmicomenUses: 1,
                cosmicOmenEffect: JSON.stringify({ type: 'Woe', isEven: false, starMapRoll: 7 }),
            });
            rollExpression.mockReturnValue({ total: 3 });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Woe');
            expect(result.payload.description).toContain('Odd');
            expect(result.payload.description).toContain('-3');

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
            const scenarios = [
                { initial: 3, expected: 2 },
                { initial: 1, expected: 0 },
            ];

            for (const { initial, expected } of scenarios) {
                vi.clearAllMocks();
                setupRuntimeValues({
                    cosmicomenUses: initial,
                    cosmicOmenEffect: JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
                });
                rollExpression.mockReturnValue({ total: 5 });

                await handle(makeAction({ automation: { usesMax: 3 } }), makePlayerStats(), 'test-campaign');

                const usesCall = setRuntimeValue.mock.calls.find(
                    (call) => call[1] === 'cosmicomenUses'
                );
                expect(usesCall).toBeDefined();
                expect(usesCall[2]).toBe(expected);
            }
        });

        it('does not decrement uses when usesMax is 0 or uses_expression evaluates to 0', async () => {
            setupRuntimeValues({
                cosmicOmenEffect: JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });
            rollExpression.mockReturnValue({ total: 5 });

            await handle(makeAction({ automation: { usesMax: 0 } }), makePlayerStats(), 'test-campaign');

            let usesCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'cosmicomenUses'
            );
            expect(usesCalls).toHaveLength(0);

            vi.clearAllMocks();
            evaluateAutoExpression.mockReturnValue(0);
            setupRuntimeValues({
                cosmicOmenEffect: JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });
            rollExpression.mockReturnValue({ total: 5 });

            const action = makeAction({ automation: { uses_expression: 'proficiency_bonus' } });
            await handle(action, makePlayerStats(), 'test-campaign');

            usesCalls = setRuntimeValue.mock.calls.filter(
                (call) => call[1] === 'cosmicomenUses'
            );
            expect(usesCalls).toHaveLength(0);
        });

        it('logs to campaign log with correct details', async () => {
            setupRuntimeValues({
                cosmicomenUses: 1,
                cosmicOmenEffect: JSON.stringify({ type: 'Woe', isEven: false, starMapRoll: 7 }),
            });
            rollExpression.mockReturnValue({ total: 3 });

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(addEntry).toHaveBeenCalledWith(
                'test-campaign',
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestSorcerer',
                    abilityName: 'Cosmic Omen',
                    description: expect.stringContaining('Woe'),
                })
            );
        });
    });

    describe('result format', () => {
        it('returns popup with correct fields and uses feature name from action', async () => {
            setupRuntimeValues({
                cosmicomenUses: 1,
                cosmicOmenEffect: JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 12 }),
            });
            rollExpression.mockReturnValue({ total: 2 });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Cosmic Omen');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('uses custom feature name when action name is provided', async () => {
            setupRuntimeValues({
                cosmicomenUses: 1,
                cosmicOmenEffect: JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });
            rollExpression.mockReturnValue({ total: 1 });

            const result = await handle(
                { name: 'My Custom Omen', automation: { type: 'cosmic_omen' } },
                makePlayerStats(),
                'test-campaign'
            );

            expect(result.payload.name).toBe('My Custom Omen');
        });
    });

    describe('clearCosmicOmenEffect', () => {
        it('clears cosmicOmenEffect for given player and campaign', async () => {
            await clearCosmicOmenEffect('TestSorcerer', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                'cosmicOmenEffect',
                null,
                'test-campaign'
            );
        });
    });

    describe('canonical store regression (CLA-065)', () => {
        it('sets cosmicOmenPendingBonus under literal "cosmicOmen" not playerName', async () => {
            setupRuntimeValues({
                cosmicomenUses: 1,
                cosmicOmenEffect: JSON.stringify({ type: 'Weal', isEven: true, starMapRoll: 10 }),
            });
            rollExpression.mockReturnValue({ total: 2 });

            const customPlayer = { name: 'CustomPlayerName' };
            await handle(makeAction(), customPlayer, 'test-campaign');

            const pendingCall = setRuntimeValue.mock.calls.find(
                (call) => call[1] === 'cosmicOmenPendingBonus'
            );
            expect(pendingCall).toBeDefined();
            expect(pendingCall[0]).toBe('cosmicOmen');
            expect(pendingCall[0]).not.toBe('CustomPlayerName');
            expect(pendingCall[3]).toBe('test-campaign');
        });

        it('writes the exact JSON shape consumers parse ({value,type})', async () => {
            setupRuntimeValues({
                cosmicomenUses: 1,
                cosmicOmenEffect: JSON.stringify({ type: 'Woe', isEven: false, starMapRoll: 7 }),
            });
            rollExpression.mockReturnValue({ total: 5 });

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            const pendingCall = setRuntimeValue.mock.calls.find(
                (call) => call[0] === 'cosmicOmen' && call[1] === 'cosmicOmenPendingBonus'
            );
            expect(pendingCall).toBeDefined();
            // Consumers: JSON.parse(raw); pending.value number > 0; pending.type === 'Weal'
            const pending = JSON.parse(pendingCall[2]);
            expect(typeof pending.value).toBe('number');
            expect(pending.value).toBe(5);
            expect(pending.type).toBe('Woe');
        });
    });
});
