// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
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

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Tactical Mind');
            expect(result.payload.description).toContain('No recent ability check found');
            expect(result.payload.description).toContain('TestFighter');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                description: expect.stringContaining('refused'),
            }));
        });
    });

    describe('early exit — natural 20', () => {
        it('returns popup indicating natural 20 needs no bonus', async () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return { rollType: 'check', attackerName: 'TestFighter', d20: 20, bonus: 3, checkName: 'Insight' };
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Tactical Mind');
            expect(result.payload.description).toContain('Natural 20');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: expect.stringContaining('refused'),
            }));
        });
    });

    describe('CLA-352 early exit — secondWindUses exhausted or null (no phantom refill)', () => {
        it.each([0, -1, null])('refuses, spends nothing and writes nothing when secondWindUses is %s', async (uses) => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return mockCheck({ d20: 8 });
                if (name === 'TestFighter' && key === 'secondWindUses') return uses;
                return undefined;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Second Wind uses remaining');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: expect.stringContaining('refused'),
            }));
        });
    });

    describe('successful application', () => {
        it('returns popup with original and modified totals and expends one Second Wind use', async () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return mockCheck({ d20: 5 });
                if (name === 'TestFighter' && key === 'secondWindUses') return 2;
                return undefined;
            });
            const randomSpy = mockRandom(7);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Tactical Mind');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Tactical Mind');
            expect(result.payload.description).toContain('Insight');
            expect(result.payload.description).toContain('5');
            expect(result.payload.description).toContain('15');
            expect(result.payload.description).toContain('7');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'secondWindUses', 1, 'test-campaign');

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

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Tactical Mind',
                timestamp: expect.any(Number),
                description: expect.stringContaining('+7'),
                d10Roll: 7,
            }));

            randomSpy.mockRestore();
        });

        it('returns popup even when addEntry rejects', async () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return mockCheck({ d20: 5 });
                if (name === 'TestFighter' && key === 'secondWindUses') return 2;
                return undefined;
            });
            const testError = new Error('log failed');
            addEntry.mockRejectedValue(testError);
            const randomSpy = mockRandom(7);
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith('[tacticalMind] Error:', testError);

            randomSpy.mockRestore();
            consoleSpy.mockRestore();
        });
    });

    describe('edge cases', () => {
        it('uses level 1 as default when playerStats.level is falsy', async () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return mockCheck({ d20: 5 });
                if (name === 'TestFighter' && key === 'secondWindUses') return 1;
                return undefined;
            });
            const randomSpy = mockRandom(1);

            const stats = makePlayerStats({ level: undefined });

            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'secondWindUses', 0, 'test-campaign');

            randomSpy.mockRestore();
        });

        it('handles skill rollType in addition to check', async () => {
            getRuntimeValue.mockImplementation((name, key, _campaign) => {
                if (name === 'campaign' && key === 'lastAttack') return { rollType: 'skill', attackerName: 'TestFighter', d20: 12, bonus: 3, checkName: 'Athletics' };
                if (name === 'TestFighter' && key === 'secondWindUses') return 2;
                return undefined;
            });
            const randomSpy = mockRandom(6);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Athletics');
            expect(result.payload.description).toContain('21');

            randomSpy.mockRestore();
        });
    });
});
