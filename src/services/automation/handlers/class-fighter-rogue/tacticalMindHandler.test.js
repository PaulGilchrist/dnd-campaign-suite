// @maintained-by-ai
// Deterministic contract tests for tacticalMindHandler: mocked runtime store +
// log service, RNG pinned via mockRandom. Stable unless the handler's refusal
// strings, +1d10 bonus formula, or Second Wind spend semantics change.
import { handle } from './tacticalMindHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

const mockRandom = (value) => vi.spyOn(Math, 'random').mockReturnValue((value - 1) / 10);

const makeAction = (overrides = {}) => ({
    name: 'Tactical Mind',
    automation: {
        type: 'tactical_mind',
        trigger: 'failed_ability_check',
        target: 'ability_check',
        bonusExpression: '1d10',
        resourceCost: 'second_wind',
        casting_time: 'passive',
        ...overrides,
    },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestFighter',
    level: 2,
    class: {
        class_levels: [{ level: 2, second_wind: 2 }],
    },
    ...overrides,
});

const mockCheck = (overrides = {}) => ({
    rollType: 'check',
    attackerName: 'TestFighter',
    d20: 8,
    bonus: 3,
    checkName: 'Insight',
    ...overrides,
});

// The handler composes its own popup + refusal-log strings; pin them in full.
const expectRefusal = (result, reason) => {
    expect(result).toEqual({
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: 'Tactical Mind',
            description: reason,
            automation: makeAction().automation,
        },
    });
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
        type: 'ability_use',
        characterName: 'TestFighter',
        abilityName: 'Tactical Mind',
        description: `TestFighter attempted Tactical Mind — refused: ${reason}`,
        timestamp: expect.any(Number),
    });
};

describe('tacticalMindHandler.handle', () => {
    describe('early exit — no valid ability check', () => {
        it.each([
            { name: 'no check (attack roll)', lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 15, bonus: 3, targetAc: 15, hit: true } },
            { name: 'null lastAttack', lastAttack: null },
            { name: 'different character', lastAttack: { rollType: 'check', attackerName: 'Goblin', d20: 15, bonus: 2, checkName: 'Stealth' } },
        ])('returns popup when %s', async ({ lastAttack }) => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return lastAttack;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expectRefusal(result, 'No recent ability check found for TestFighter. This feature can only be used shortly after an ability check.');
        });
    });

    describe('early exit — natural 20', () => {
        it('refuses without spending a Second Wind use', async () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return mockCheck({ d20: 20 });
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expectRefusal(result, 'Tactical Mind: Natural 20 — no bonus needed.');
        });
    });

    describe('CLA-352 early exit — secondWindUses exhausted or null (no phantom refill)', () => {
        it.each([0, -1, null, undefined])('refuses, spends nothing and writes nothing when secondWindUses is %s', async (uses) => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return mockCheck({ d20: 8 });
                if (name === 'TestFighter' && key === 'secondWindUses') return uses;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expectRefusal(result, 'Tactical Mind: No Second Wind uses remaining.');
        });
    });

    describe('successful application', () => {
        it.each([
            { label: 'two uses remain', uses: 2, spent: 1, d20: 5, d10: 7 },
            { label: 'only the last use remains', uses: 1, spent: 0, d20: 8, d10: 1 },
        ])('returns popup with original and modified totals and spends one Second Wind use when $label', async ({ uses, spent, d20, d10 }) => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return mockCheck({ d20 });
                if (name === 'TestFighter' && key === 'secondWindUses') return uses;
                return undefined;
            });
            const randomSpy = mockRandom(d10);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const originalTotal = d20 + 3;
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Tactical Mind',
                    description: `<b>Tactical Mind</b><br/>Insight: d20(${d20}) + 3 = ${originalTotal} → +1d10(${d10}) = <b>${originalTotal + d10}</b>`,
                    automation: makeAction().automation,
                },
            });
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'secondWindUses', spent, 'test-campaign');

            randomSpy.mockRestore();
        });

        it('logs an ability_use entry to the campaign log', async () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return mockCheck({ d20: 5 });
                if (name === 'TestFighter' && key === 'secondWindUses') return 2;
                return undefined;
            });
            const randomSpy = mockRandom(7);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Tactical Mind',
                description: 'TestFighter used Tactical Mind: +7 to Insight (d20 5 + 3 = 8 → 15). Second Wind use expended; if the check still fails the GM restores the use.',
                d10Roll: 7,
                timestamp: expect.any(Number),
            });

            randomSpy.mockRestore();
        });

        it('still spends the use and returns popup when addEntry rejects', async () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return mockCheck({ d20: 5 });
                if (name === 'TestFighter' && key === 'secondWindUses') return 2;
                return undefined;
            });
            const testError = new Error('log failed');
            addEntry.mockRejectedValueOnce(testError);
            const randomSpy = mockRandom(7);
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'secondWindUses', 1, 'test-campaign');
            expect(consoleSpy).toHaveBeenCalledWith('[tacticalMind] Error:', testError);

            randomSpy.mockRestore();
            consoleSpy.mockRestore();
        });
    });

    describe('roll type acceptance', () => {
        it('accepts rollType "skill" in addition to "check"', async () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return mockCheck({ rollType: 'skill', d20: 12, checkName: 'Athletics' });
                if (name === 'TestFighter' && key === 'secondWindUses') return 2;
                return undefined;
            });
            const randomSpy = mockRandom(10);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toBe('<b>Tactical Mind</b><br/>Athletics: d20(12) + 3 = 15 → +1d10(10) = <b>25</b>');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'secondWindUses', 1, 'test-campaign');

            randomSpy.mockRestore();
        });
    });
});
