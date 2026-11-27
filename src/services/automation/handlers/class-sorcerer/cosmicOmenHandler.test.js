// @maintained-by-ai 2026-11-26
// Producer-lane unit tests for cosmicOmenHandler: uses gate (incl. usesMax
// resolution and the ?? usesMax first-use default), omen parsing (incl. the
// corrupted-JSON refusal), exact popup/log composition, and ordered commit
// censuses — all behind mocked runtime/dice/log deps with a frozen Date.now.
// Canonical pending-store routing and {value,type} consumer shape are covered
// against the REAL store in cosmicOmenHandler.pending-store.test.js (CLA-065
// lens); this file keeps the mock-call-args pins the real-store lens cannot
// see: the campaign argument on the pending write (fetch is inert there) and
// the uses-decrement write ORDER.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle } from './cosmicOmenHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
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

const CAMPAIGN = 'test-campaign';
const FROZEN_NOW = 1700000000000;
const WEAL = { type: 'Weal', isEven: true, starMapRoll: 10 };
const WOE = { type: 'Woe', isEven: false, starMapRoll: 7 };

function makePlayerStats(overrides = {}) {
    return { name: 'TestSorcerer', ...overrides };
}

function makeAction(automation = {}, name = 'Cosmic Omen') {
    return { name, automation: { type: 'cosmic_omen', ...automation } };
}

// Exact-key router over the handler's two runtime reads. Any *Uses key routes
// to `uses` so feature-name→uses-key derivation stays observable.
function mockRuntime({ uses = null, omen = JSON.stringify(WEAL) } = {}) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key.endsWith('Uses')) return uses;
        if (key === 'cosmicOmenEffect') return omen;
        return null;
    });
}

function pendingWrite(value, type) {
    return ['cosmicOmen', 'cosmicOmenPendingBonus', JSON.stringify({ value, type }), CAMPAIGN];
}

describe('cosmicOmenHandler.handle', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Re-pin stable impls after the reset (handler chains .catch on addEntry).
        setRuntimeValue.mockResolvedValue(undefined);
        addEntry.mockResolvedValue(undefined);
        rollExpression.mockReturnValue({ total: 4 });
        getRuntimeValue.mockImplementation(() => null);
        vi.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
    });

    afterEach(() => {
        Date.now.mockRestore();
    });

    it.each([
        {
            label: 'exhausted uses (number)',
            automation: { usesMax: 3 }, uses: 0, omen: JSON.stringify(WEAL),
            description: 'Cosmic Omen has no uses remaining. Recharges on a Long Rest.',
        },
        {
            label: 'exhausted uses (string-coerced "0")',
            automation: { usesMax: 3 }, uses: '0', omen: JSON.stringify(WEAL),
            description: 'Cosmic Omen has no uses remaining. Recharges on a Long Rest.',
        },
        {
            label: 'no omen active',
            automation: {}, uses: 2, omen: null,
            description: 'Cosmic Omen has no omen active. Consult your Star Map on Long Rest.',
        },
        {
            label: 'corrupted omen JSON',
            automation: {}, uses: 2, omen: '{broken',
            description: 'Cosmic Omen has corrupted omen data.',
        },
    ])('refuses ($label) with the exact info popup and a zero-write census', async (c) => {
        mockRuntime({ uses: c.uses, omen: c.omen });

        const action = makeAction(c.automation);
        const result = await handle(action, makePlayerStats(), CAMPAIGN);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Cosmic Omen',
                description: c.description,
                automation: { type: 'cosmic_omen', ...c.automation },
            },
        });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('refuses a failed d6 roll after the gates with the exact popup and zero writes', async () => {
        mockRuntime({ uses: 1, omen: JSON.stringify(WEAL) });
        rollExpression.mockReturnValue(null);

        const action = makeAction({ usesMax: 3 });
        const result = await handle(action, makePlayerStats(), CAMPAIGN);

        expect(rollExpression).toHaveBeenCalledWith('1d6');
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Cosmic Omen',
                description: 'Cosmic Omen roll failed.',
                automation: { type: 'cosmic_omen', usesMax: 3 },
            },
        });
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it.each([
        {
            label: 'Weal (Even) arms +pending',
            omen: WEAL, value: 4,
            description: '<b>Cosmic Omen</b><br/>Star Map result: <b>Weal (Even)</b>, Star Map roll: <b>10</b><br/>1d6: <b>4</b><br/>Next d20 test: <b>+4</b>',
            logDescription: 'TestSorcerer used Cosmic Omen (Weal). Rolled 1d6: 4. Next d20 test modified +4.',
        },
        {
            label: 'Woe (Odd) arms -pending',
            omen: WOE, value: 3,
            description: '<b>Cosmic Omen</b><br/>Star Map result: <b>Woe (Odd)</b>, Star Map roll: <b>7</b><br/>1d6: <b>3</b><br/>Next d20 test: <b>-3</b>',
            logDescription: 'TestSorcerer used Cosmic Omen (Woe). Rolled 1d6: 3. Next d20 test modified -3.',
        },
    ])('commits a $label with exact popup, ordered write census, and frozen log entry', async (c) => {
        mockRuntime({ uses: 3, omen: JSON.stringify(c.omen) });
        rollExpression.mockReturnValue({ total: c.value });

        const action = makeAction({ usesMax: 3 });
        const result = await handle(action, makePlayerStats(), CAMPAIGN);

        expect(rollExpression).toHaveBeenCalledWith('1d6');
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Cosmic Omen',
                description: c.description,
                automation: { type: 'cosmic_omen', usesMax: 3 },
            },
        });
        // Exact census in write order: uses decrement first, then the canonical
        // global pending store. The mock-args lens is the only place the
        // campaign argument is visible (real-store cache ignores it).
        expect(setRuntimeValue.mock.calls).toEqual([
            ['TestSorcerer', 'cosmicOmenUses', 2, CAMPAIGN],
            pendingWrite(c.value, c.omen.type),
        ]);
        expect(addEntry).toHaveBeenCalledWith(CAMPAIGN, {
            type: 'ability_use',
            characterName: 'TestSorcerer',
            abilityName: 'Cosmic Omen',
            description: c.logDescription,
            timestamp: FROZEN_NOW,
        });
    });

    it.each([
        {
            label: 'usesMax 0 is unlimited',
            automation: { usesMax: 0 }, exprValue: undefined, uses: 5,
            expectedCalls: [pendingWrite(4, 'Weal')],
        },
        {
            label: 'uses_expression evaluating to 0 is unlimited',
            automation: { uses_expression: 'proficiency_bonus' }, exprValue: 0, uses: null,
            expectedCalls: [pendingWrite(4, 'Weal')],
        },
        {
            label: 'uses_expression evaluating to 2 spends from the counter',
            automation: { uses_expression: 'proficiency_bonus' }, exprValue: 2, uses: 2,
            expectedCalls: [['TestSorcerer', 'cosmicOmenUses', 1, CAMPAIGN], pendingWrite(4, 'Weal')],
        },
    ])('$label — zero uses spend for unlimited lanes', async (c) => {
        mockRuntime({ uses: c.uses });
        evaluateAutoExpression.mockReturnValue(c.exprValue);
        const stats = makePlayerStats();

        await handle(makeAction(c.automation), stats, CAMPAIGN);

        expect(setRuntimeValue.mock.calls).toEqual(c.expectedCalls);
        if (c.automation.uses_expression) {
            expect(evaluateAutoExpression).toHaveBeenCalledWith(c.automation.uses_expression, stats);
        } else {
            expect(evaluateAutoExpression).not.toHaveBeenCalled();
        }
    });

    it('defaults a missing runtime uses counter to max and spends one', async () => {
        mockRuntime({ uses: null }); // ?? usesMax at both the gate and the spend

        await handle(makeAction({ usesMax: 3 }), makePlayerStats(), CAMPAIGN);

        expect(setRuntimeValue.mock.calls).toEqual([
            ['TestSorcerer', 'cosmicOmenUses', 2, CAMPAIGN],
            pendingWrite(4, 'Weal'),
        ]);
    });

    it.each([
        { actionName: 'Stellar Augury', expected: 'Stellar Augury', usesKey: 'stellarAuguryUses' },
        { actionName: undefined, expected: 'Cosmic Omen', usesKey: 'cosmicOmenUses' },
    ])('derives feature name and uses key from the action ($expected)', async ({ actionName, expected, usesKey }) => {
        mockRuntime({ uses: 3 });

        const result = await handle(makeAction({ usesMax: 3 }, actionName), makePlayerStats(), CAMPAIGN);

        expect(result.payload.name).toBe(expected);
        expect(setRuntimeValue.mock.calls).toEqual([
            ['TestSorcerer', usesKey, 2, CAMPAIGN],
            pendingWrite(4, 'Weal'),
        ]);
        expect(addEntry.mock.calls[0][1]).toMatchObject({ abilityName: expected });
    });
});
