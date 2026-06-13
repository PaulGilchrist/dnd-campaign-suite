import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './useMagicDeviceHandler.js';

// ── Mocks ──────────────────────────────────────────────────────
vi.mock('../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/useRuntimeState.js';

// ── Helpers ────────────────────────────────────────────────────
function makeAction(overrides = {}) {
    return {
        name: 'Use Magic Device',
        automation: {
            type: 'use_magic_device',
            attunementLimit: 4,
            chargeReroll: '1d6',
            chargeRerollSuccess: 6,
            scrollAbility: 'INT',
            scrollCheckDC: '10 + spell_level',
            scrollDisintegratesOnFail: true,
            casting_time: 'passive',
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestRogue',
        level: 13,
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────
describe('useMagicDeviceHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should activate the feature when not already active', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            return undefined;
        });

        const action = makeAction();
        const playerStats = makePlayerStats();
        const campaignName = 'test-campaign';

        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Use Magic Device');
        expect(result.payload.description).toContain('activated');
        expect(result.payload.description).toContain('4 magic items');

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestRogue',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Use Magic Device',
                    effect: 'use_magic_device',
                }),
            ]),
            'test-campaign'
        );
    });

    it('should deactivate the feature when already active', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [
                { name: 'Use Magic Device', effect: 'use_magic_device' },
            ];
            return undefined;
        });

        const action = makeAction();
        const playerStats = makePlayerStats();
        const campaignName = 'test-campaign';

        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Use Magic Device');
        expect(result.payload.description).toContain('ended');

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestRogue',
            'activeBuffs',
            [],
            'test-campaign'
        );
    });

    it('should include all feature details in the activation description', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            return undefined;
        });

        const action = makeAction();
        const playerStats = makePlayerStats();
        const campaignName = 'test-campaign';

        const result = await handle(action, playerStats, campaignName);

        expect(result.payload.description).toContain('Attune to up to 4 magic items');
        expect(result.payload.description).toContain('roll 1d6');
        expect(result.payload.description).toContain('6 use without expending');
        expect(result.payload.description).toContain('Intelligence');
        expect(result.payload.description).toContain('Arcana check DC 10 + spell level');
        expect(result.payload.description).toContain('scroll disintegrates');
    });

    it('should handle missing automation properties with defaults', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [];
            return undefined;
        });

        const action = {
            name: 'Use Magic Device',
            automation: {
                type: 'use_magic_device',
            },
        };
        const playerStats = makePlayerStats();
        const campaignName = 'test-campaign';

        const result = await handle(action, playerStats, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('4 magic items');
    });

    it('should preserve other buffs when activating', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [
                { name: 'Other Buff', effect: 'other' },
            ];
            return undefined;
        });

        const action = makeAction();
        const playerStats = makePlayerStats();
        const campaignName = 'test-campaign';

        await handle(action, playerStats, campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestRogue',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({ name: 'Other Buff' }),
                expect.objectContaining({ name: 'Use Magic Device' }),
            ]),
            'test-campaign'
        );
    });

    it('should preserve other buffs when deactivating', async () => {
        getRuntimeValue.mockImplementation((name, key) => {
            if (key === 'activeBuffs') return [
                { name: 'Other Buff', effect: 'other' },
                { name: 'Use Magic Device', effect: 'use_magic_device' },
            ];
            return undefined;
        });

        const action = makeAction();
        const playerStats = makePlayerStats();
        const campaignName = 'test-campaign';

        await handle(action, playerStats, campaignName);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            'TestRogue',
            'activeBuffs',
            [expect.objectContaining({ name: 'Other Buff' })],
            'test-campaign'
        );
    });
});
