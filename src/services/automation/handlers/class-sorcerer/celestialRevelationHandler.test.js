import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, confirmCelestialRevelation } from './celestialRevelationHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');
const { toggleBuff } = await import('../../common/buffToggle.js');

beforeEach(() => {
    vi.clearAllMocks();
});

function makePlayerStats(overrides = {}) {
    return {
        name: 'SorcererBoy',
        level: 3,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Celestial Revelation',
        automation: {
            type: 'celestial_revelation',
            minLevel: 3,
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('celestialRevelationHandler', () => {
    describe('handle', () => {
        it('returns popup when below minimum level', async () => {
            const lowLevelStats = makePlayerStats({ level: 1 });

            const result = await handle(makeAction(), lowLevelStats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('requires character level 3');
        });

        it('returns modal when level gate passes', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('celestialRevelation');
            expect(result.payload.action).toBeInstanceOf(Object);
            expect(result.payload.playerStats).toBeInstanceOf(Object);
            expect(result.payload.campaignName).toBe('test-campaign');
        });

        it('returns popup when uses are depleted', async () => {
            const action = makeAction({ automation: { uses: 1, usesMax: 1 } });
            getRuntimeValue.mockReturnValue(0);

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('cannot be used again');
        });

        it('returns modal when uses are available', async () => {
            const action = makeAction({ automation: { uses: 1, usesMax: 1 } });
            getRuntimeValue.mockReturnValue(1);

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
        });

        it('uses default maxUses of 1 when neither uses nor usesMax is set', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('modal');
        });

        it('uses custom resourceKey when provided', async () => {
            const action = makeAction({ automation: { resourceKey: 'customUsesKey', uses: 1 } });
            getRuntimeValue.mockReturnValue(1);

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(getRuntimeValue).toHaveBeenCalledWith('SorcererBoy', 'customUsesKey', 'test-campaign');
        });

        it('uses default key when no resourceKey provided', async () => {
            getRuntimeValue.mockReturnValue(1);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(getRuntimeValue).toHaveBeenCalledWith('SorcererBoy', '_celestialRevelationUses', 'test-campaign');
        });
    });

    describe('confirmCelestialRevelation', () => {
        it('returns popup when below minimum level', async () => {
            const lowLevelStats = makePlayerStats({ level: 1 });

            const result = await confirmCelestialRevelation(lowLevelStats, 'Heavenly Wings', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('requires character level 3');
        });

        it('decrements uses when uses exist', async () => {
            getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Heavenly Wings', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith('SorcererBoy', '_celestialRevelationUses', 0, 'test-campaign');
        });

        it('skips decrement when maxUses is 0', async () => {
            getRuntimeValue.mockReturnValue(0);

            const result = await confirmCelestialRevelation(makePlayerStats(), 'Heavenly Wings', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('SorcererBoy', '_celestialRevelationUses', expect.any(Number), 'test-campaign');
        });

        it('stores chosen transformation option', async () => {
            getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Inner Radiance', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith('SorcererBoy', '_celestialRevelationOption', 'Inner Radiance', 'test-campaign');
        });

        it('adds expiration for chosen buff after 10 rounds', async () => {
            getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Necrotic Shroud', 'test-campaign');

            expect(addExpiration).toHaveBeenCalledWith(
                'SorcererBoy',
                'SorcererBoy',
                [{ type: 'remove_active_buff', buffName: 'Necrotic Shroud' }],
                'test-campaign',
                10
            );
        });

        it('calls toggleBuff with correct effect for Heavenly Wings', async () => {
            getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Heavenly Wings', 'test-campaign');

            expect(toggleBuff).toHaveBeenCalledWith(
                'SorcererBoy',
                'Heavenly Wings',
                { effect: 'fly_speed_equals_walk_speed', duration: '1_minute' },
                'test-campaign',
                'SorcererBoy'
            );
        });

        it('calls toggleBuff with correct effect for Inner Radiance', async () => {
            getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Inner Radiance', 'test-campaign');

            expect(toggleBuff).toHaveBeenCalledWith(
                'SorcererBoy',
                'Inner Radiance',
                { effect: 'inner_radiance', duration: '1_minute' },
                'test-campaign',
                'SorcererBoy'
            );
        });

        it('calls toggleBuff with correct effect for Necrotic Shroud', async () => {
            getRuntimeValue.mockReturnValue(1);

            await confirmCelestialRevelation(makePlayerStats(), 'Necrotic Shroud', 'test-campaign');

            expect(toggleBuff).toHaveBeenCalledWith(
                'SorcererBoy',
                'Necrotic Shroud',
                { effect: 'necrotic_shroud', duration: '1_minute' },
                'test-campaign',
                'SorcererBoy'
            );
        });

        it('returns popup with transformation description', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await confirmCelestialRevelation(makePlayerStats(), 'Heavenly Wings', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Celestial Revelation');
            expect(result.payload.description).toContain('Transforming into Heavenly Wings');
            expect(result.payload.description).toContain('Fly Speed equal to your Speed');
        });

        it('handles unknown option with empty description', async () => {
            getRuntimeValue.mockReturnValue(1);

            const result = await confirmCelestialRevelation(makePlayerStats(), 'Unknown Option', 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Transforming into Unknown Option');
        });
    });
});
