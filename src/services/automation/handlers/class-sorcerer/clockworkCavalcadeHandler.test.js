import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './clockworkCavalcadeHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    spendSorceryPoints: vi.fn(),
}));

vi.mock('../../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(() => ({ maxSorceryPoints: 8 })),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { getClassFeatures } = await import('../../../character/classFeatures.js');
const { addEntry } = await import('../../../ui/logService.js');

beforeEach(() => {
    vi.clearAllMocks();
});

let frozenTime = 1000000;
vi.spyOn(Date, 'now').mockImplementation(() => frozenTime);

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        resources: { sorcery_points: { current: 7 } },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Clockwork Cavalcade',
        automation: {
            type: 'clockwork_cavalcade',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('clockworkCavalcadeHandler', () => {
    describe('long rest check', () => {
        it('has uses available after long rest', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Clockwork Cavalcade');

            const useCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] && c[1].includes('clockworkCavalcadeUses')
            );
            expect(useCalls.length).toBeGreaterThan(0);
            expect(useCalls[0][2]).toBe(0);
        });

        it('has uses available when last rest is old', async () => {
            frozenTime = 186400000;
            getRuntimeValue.mockReturnValue(1000000);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Clockwork Cavalcade');
        });


    });

    describe('uses decrement', () => {
        it('decrements uses on activation', async () => {
            getRuntimeValue.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const useCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] && c[1].includes('clockworkCavalcadeUses')
            );
            expect(useCalls.length).toBeGreaterThan(0);
        });

        it('logs the ability use', async () => {
            getRuntimeValue.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Clockwork Cavalcade',
            }));
        });
    });

    describe('result format', () => {
        it('returns popup with correct description', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Clockwork Cavalcade');
            expect(result.payload.description).toContain('30-foot Cube');
            expect(result.payload.description).toContain('Heal');
            expect(result.payload.description).toContain('Repair');
            expect(result.payload.description).toContain('Dispel');
        });

        it('includes automation in payload', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('uses action name as feature name', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Clockwork Cavalcade');
        });

        it('uses custom action name when provided', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(
                makeAction({ name: 'Custom Feature' }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.name).toBe('Custom Feature');
            expect(result.payload.description).toContain('Custom Feature');
        });

        it('uses maxSP from getClassFeatures when resources missing', async () => {
            getRuntimeValue.mockReturnValue(null);

            const stats = makePlayerStats({ resources: null });
            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(getClassFeatures).toHaveBeenCalledWith(stats);
        });
    });
});
