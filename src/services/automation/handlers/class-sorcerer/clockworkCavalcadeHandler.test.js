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
const { spendSorceryPoints } = await import('../../../../hooks/combat/useMetamagic.js');
const { getClassFeatures } = await import('../../../character/classFeatures.js');
const { addEntry } = await import('../../../ui/logService.js');

beforeEach(() => {
    vi.clearAllMocks();
});

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
    describe('active use (uses available)', () => {
        it('returns popup with feature description when uses available', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Clockwork Cavalcade');
            expect(result.payload.description).toContain('30-foot Cube');
            expect(result.payload.description).toContain('Heal');
            expect(result.payload.description).toContain('Up to 100 HP');
            expect(result.payload.description).toContain('Repair');
            expect(result.payload.description).toContain('Damaged objects repaired instantly');
            expect(result.payload.description).toContain('Dispel');
            expect(result.payload.description).toContain('level 6 and lower');
        });

        it('decrements uses on activation from null (default 1 -> 0)', async () => {
            getRuntimeValue.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                expect.stringContaining('clockworkCavalcadeUses'),
                0,
                'test-campaign'
            );
        });

        it('decrements uses from stored value (2 -> 1)', async () => {
            getRuntimeValue.mockReturnValue('2');

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const useCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] && c[1].includes('clockworkCavalcadeUses')
            );
            expect(useCalls.length).toBeGreaterThan(0);
            expect(useCalls[0][2]).toBe(1);
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

        it('uses maxSP from getClassFeatures when resources exist', async () => {
            getRuntimeValue.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(getClassFeatures).toHaveBeenCalledWith(expect.objectContaining({
                name: 'TestSorcerer',
            }));
        });

        it('uses maxSP from getClassFeatures fallback when resources.sorcery_points missing', async () => {
            getRuntimeValue.mockReturnValue(null);

            const stats = makePlayerStats({ resources: { other: 'value' } });

            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(getClassFeatures).toHaveBeenCalledWith(stats);
            expect(result.type).toBe('popup');
        });

        it('uses action name as feature name', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Clockwork Cavalcade');
        });

        it('uses custom action name when provided', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(
                makeAction({ name: 'Custom Clockwork' }),
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.name).toBe('Custom Clockwork');
            expect(result.payload.description).toContain('Custom Clockwork');
        });

        it('uses default feature name when action name is undefined', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(
                { automation: { type: 'clockwork_cavalcade' } },
                makePlayerStats(),
                'test-campaign',
                null
            );

            expect(result.payload.name).toBe('Clockwork Cavalcade');
        });

        it('includes automation in payload', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.automation).toEqual(makeAction().automation);
        });
    });

    describe('SP restoration flow', () => {
        it('restores 1 use by spending 7 SP when no uses and SP >= 7', async () => {
            getRuntimeValue.mockReturnValue('0');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 7, 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('clockworkCavalcadeUses'),
                1,
                'test-campaign'
            );

            const useCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] && c[1].includes('clockworkCavalcadeUses')
            );
            expect(useCalls.length).toBeGreaterThan(0);
            expect(useCalls[useCalls.length - 1][2]).toBe(0);
        });

        it('logs restoration when spending SP to restore', async () => {
            getRuntimeValue.mockReturnValue('0');

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestSorcerer',
                abilityName: 'Clockwork Cavalcade',
            }));
        });

        it('does not restore when SP < 7', async () => {
            getRuntimeValue.mockReturnValue('0');

            const lowSPStats = makePlayerStats({ resources: { sorcery_points: { current: 5 } } });

            const result = await handle(makeAction(), lowSPStats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('7 Sorcery Points');
            expect(spendSorceryPoints).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not restore when SP exactly 6', async () => {
            getRuntimeValue.mockReturnValue('0');

            const stats = makePlayerStats({ resources: { sorcery_points: { current: 6 } } });

            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('does not restore when SP is 0', async () => {
            getRuntimeValue.mockReturnValue('0');

            const stats = makePlayerStats({ resources: { sorcery_points: { current: 0 } } });

            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(spendSorceryPoints).not.toHaveBeenCalled();
        });

        it('reads currentSP from resources.sorcery_points.current', async () => {
            getRuntimeValue.mockReturnValue('0');

            const stats = makePlayerStats({ resources: { sorcery_points: { current: 10 } } });

            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 7, 'test-campaign');
        });

        it('uses maxSP from getClassFeatures when sorcery_points resource missing', async () => {
            getRuntimeValue.mockReturnValue('0');

            const stats = makePlayerStats({ resources: {} });

            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(getClassFeatures).toHaveBeenCalledWith(stats);
            expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 7, 'test-campaign');
        });

        it('uses maxSP from getClassFeatures when entire resources object missing', async () => {
            getRuntimeValue.mockReturnValue('0');

            const stats = makePlayerStats({ resources: null });

            const result = await handle(makeAction(), stats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(getClassFeatures).toHaveBeenCalledWith(stats);
            expect(spendSorceryPoints).toHaveBeenCalledWith('TestSorcerer', 7, 'test-campaign');
        });
    });

    describe('uses tracking', () => {
        it('uses playerName-based runtime key', async () => {
            getRuntimeValue.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(getRuntimeValue).toHaveBeenCalledWith(
                'TestSorcerer',
                expect.stringContaining('clockworkCavalcadeUses'),
                'test-campaign'
            );
        });

        it('strips spaces from player name in runtime key', async () => {
            getRuntimeValue.mockReturnValue(null);

            const stats = makePlayerStats({ name: 'Test Sorcerer' });

            await handle(makeAction(), stats, 'test-campaign', null);

            expect(getRuntimeValue).toHaveBeenCalledWith(
                'Test Sorcerer',
                'testsorcerer_clockworkCavalcadeUses',
                'test-campaign'
            );
        });

        it('stores uses count as number after decrement', async () => {
            getRuntimeValue.mockReturnValue('3');

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const useCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] && c[1].includes('clockworkCavalcadeUses')
            );
            expect(useCalls.length).toBeGreaterThan(0);
            expect(typeof useCalls[0][2]).toBe('number');
        });

        it('stores uses count as number after SP restoration', async () => {
            getRuntimeValue.mockReturnValue('0');

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const useCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] && c[1].includes('clockworkCavalcadeUses')
            );
            expect(useCalls.length).toBeGreaterThan(0);
            expect(typeof useCalls[0][2]).toBe('number');
        });
    });

    describe('description formatting', () => {
        it('shows uses remaining when multiple uses available', async () => {
            getRuntimeValue.mockReturnValue('3');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('2 uses remaining');
        });

        it('shows uses remaining singular when 2 uses available', async () => {
            getRuntimeValue.mockReturnValue('2');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('1 use remaining');
        });

        it('shows no uses remaining when 1 use available', async () => {
            getRuntimeValue.mockReturnValue('1');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('No uses remaining');
        });

        it('shows no uses remaining after SP restoration (1 -> 0)', async () => {
            getRuntimeValue.mockReturnValue('0');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('No uses remaining');
        });
    });
});
