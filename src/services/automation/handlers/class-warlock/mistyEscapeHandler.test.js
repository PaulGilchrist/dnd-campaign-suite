import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './mistyEscapeHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    getLastDamageEvent: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { getLastDamageEvent } = await import('../../../../hooks/combat/useMetamagic.js');
const { addEntry } = await import('../../../ui/logService.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');
const { buildSaveDc } = await import('../../common/savePrompt.js');

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'WarlockGirl',
        abilities: [{ name: 'CHA', bonus: 4 }],
        proficiency: 3,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Misty Escape',
        automation: {
            type: 'misty_escape',
            saveDc: 15,
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('mistyEscapeHandler', () => {
    describe('no recent damage', () => {
        it('returns popup when no damage event exists', async () => {
            getLastDamageEvent.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent damage taken');
        });

        it('returns popup when damage event is stale (> 60 seconds)', async () => {
            const oldTimestamp = Date.now() - 120000;
            getLastDamageEvent.mockReturnValue({ timestamp: oldTimestamp });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent damage taken');
        });

        it('accepts non-stale damage event', async () => {
            const recentTimestamp = Date.now() - 30000;
            getLastDamageEvent.mockReturnValue({ timestamp: recentTimestamp });

            getRuntimeValue.mockReturnValue([]);
            buildSaveDc.mockReturnValue(15);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Misty Escape');
        });
    });

    describe('disappearing step (invisible condition)', () => {
        it('adds invisible condition when not already present', async () => {
            const recentTimestamp = Date.now() - 30000;
            getLastDamageEvent.mockReturnValue({ timestamp: recentTimestamp });
            getRuntimeValue.mockReturnValue([]);
            buildSaveDc.mockReturnValue(15);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WarlockGirl',
                'activeConditions',
                ['invisible'],
                'test-campaign'
            );
        });

        it('does not duplicate invisible when already present', async () => {
            const recentTimestamp = Date.now() - 30000;
            getLastDamageEvent.mockReturnValue({ timestamp: recentTimestamp });
            getRuntimeValue.mockReturnValue(['invisible']);
            buildSaveDc.mockReturnValue(15);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'WarlockGirl',
                'activeConditions',
                expect.anything(),
                'test-campaign'
            );
        });

        it('preserves other conditions when adding invisible', async () => {
            const recentTimestamp = Date.now() - 30000;
            getLastDamageEvent.mockReturnValue({ timestamp: recentTimestamp });
            getRuntimeValue.mockReturnValue(['fatigued']);
            buildSaveDc.mockReturnValue(15);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'WarlockGirl',
                'activeConditions',
                ['fatigued', 'invisible'],
                'test-campaign'
            );
        });

        it('adds expiration for invisible condition after 1 round', async () => {
            const recentTimestamp = Date.now() - 30000;
            getLastDamageEvent.mockReturnValue({ timestamp: recentTimestamp });
            getRuntimeValue.mockReturnValue([]);
            buildSaveDc.mockReturnValue(15);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith(
                'WarlockGirl',
                'WarlockGirl',
                [{ type: 'condition', condition: 'invisible' }],
                'test-campaign',
                1
            );
        });
    });

    describe('popup result', () => {
        it('returns popup with Misty Step info', async () => {
            const recentTimestamp = Date.now() - 30000;
            getLastDamageEvent.mockReturnValue({ timestamp: recentTimestamp });
            getRuntimeValue.mockReturnValue([]);
            buildSaveDc.mockReturnValue(15);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Misty Escape');
            expect(result.payload.saveType).toBe('WIS');
            expect(result.payload.saveDc).toBe(15);
            expect(result.payload.damageType).toBe('Psychic');
            expect(result.payload.damageExpression).toBe('2d10');
            expect(result.payload.aoeRange).toBe('5_ft');
            expect(result.payload.triggerMistyStep).toBe(true);
        });

        it('includes Dreadful Step description in popup', async () => {
            const recentTimestamp = Date.now() - 30000;
            getLastDamageEvent.mockReturnValue({ timestamp: recentTimestamp });
            getRuntimeValue.mockReturnValue([]);
            buildSaveDc.mockReturnValue(15);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.payload.description).toContain('Misty Step');
            expect(result.payload.description).toContain('Invisible condition');
            expect(result.payload.description).toContain('Dreadful Step');
            expect(result.payload.description).toContain('2d10 Psychic damage');
        });

        it('uses custom saveType from automation', async () => {
            const recentTimestamp = Date.now() - 30000;
            getLastDamageEvent.mockReturnValue({ timestamp: recentTimestamp });
            getRuntimeValue.mockReturnValue([]);
            buildSaveDc.mockReturnValue(15);

            const action = makeAction({ automation: { saveType: 'CHA' } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.saveType).toBe('CHA');
        });

        it('uses default feature name when not provided', async () => {
            const recentTimestamp = Date.now() - 30000;
            getLastDamageEvent.mockReturnValue({ timestamp: recentTimestamp });
            getRuntimeValue.mockReturnValue([]);
            buildSaveDc.mockReturnValue(15);

            const action = makeAction({ name: '' });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.name).toBe('Misty Escape');
        });

        it('logs ability use', async () => {
            const recentTimestamp = Date.now() - 30000;
            getLastDamageEvent.mockReturnValue({ timestamp: recentTimestamp });
            getRuntimeValue.mockReturnValue([]);
            buildSaveDc.mockReturnValue(15);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'WarlockGirl',
                abilityName: 'Misty Escape',
            }));
        });
    });

    describe('event staleness', () => {
        it('treats event without timestamp as stale', async () => {
            getLastDamageEvent.mockReturnValue({});

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent damage taken');
        });

        it('treats event with null timestamp as stale', async () => {
            getLastDamageEvent.mockReturnValue({ timestamp: null });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent damage taken');
        });
    });
});
