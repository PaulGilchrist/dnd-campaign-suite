// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './peerlessAthleteHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');
const { addEntry } = await import('../../../ui/logService.js');

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestCleric',
        level: 6,
        class: {
            class_levels: [
                { level: 1 },
                { level: 2 },
                { level: 3 },
                { level: 4 },
                { level: 5 },
                { level: 6, channel_divinity: 2 },
            ],
            ...overrides.class,
        },
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Peerless Athlete',
        automation: {
            type: 'peerless_athlete',
            duration: '1_hour',
            ...overrides.automation,
        },
        ...overrides,
    };
}

function mockActive() {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'peerlessAthleteActive') return true;
        if (key === 'activeBuffs') return [{ name: 'Peerless Athlete', effect: 'peerless_athlete' }];
        return null;
    });
}

function mockInactive(charges = 2, activeBuffs = []) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'peerlessAthleteActive') return false;
        if (key === 'activeBuffs') return activeBuffs;
        if (key === 'channelDivinityCharges') return charges;
        return null;
    });
}

describe('peerlessAthleteHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('already active', () => {
        it('returns popup indicating ability is already active without clearing state', async () => {
            mockActive();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Peerless Athlete is already active.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('does not modify activeBuffs when already active', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return true;
                if (key === 'activeBuffs') return [
                    { name: 'Peerless Athlete', effect: 'peerless_athlete' },
                    { name: 'Other Buff', effect: 'other' },
                ];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

    });

    describe('activation', () => {
        it('returns popup with activation description when not active', async () => {
            mockInactive();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBeDefined();
            expect(typeof result.payload.description).toBe('string');
            expect(result.payload.description.length).toBeGreaterThan(0);
        });

        it('spends a channel divinity charge and activates the buff', async () => {
            mockInactive(2);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'channelDivinityCharges',
                1,
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'peerlessAthleteActive',
                true,
                campaignName,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Peerless Athlete',
                        effect: 'peerless_athlete',
                        duration: '1_hour',
                    }),
                ]),
                campaignName,
            );
            expect(addExpiration).toHaveBeenCalledWith(
                'TestCleric',
                'TestCleric',
                [{ type: 'peerless_athlete_end' }],
                campaignName,
                6,
            );
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestCleric',
                abilityName: 'Peerless Athlete',
                description: expect.stringContaining('activated Peerless Athlete'),
            }));
        });

        it('appends buff to existing activeBuffs', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [{ name: 'Existing Buff', effect: 'existing' }];
                if (key === 'channelDivinityCharges') return 2;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Existing Buff' }),
                    expect.objectContaining({ name: 'Peerless Athlete' }),
                ]),
                campaignName,
            );
        });

        it('uses automation duration when provided', async () => {
            mockInactive(2, []);

            await handle(makeAction({ automation: { duration: 'until_end_of_turn' } }), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: 'until_end_of_turn' }),
                ]),
                campaignName,
            );
        });
    });

    describe('no charges remaining', () => {
        it('returns popup when charges are 0', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'channelDivinityCharges') return 0;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('charge fallback logic', () => {
        it('uses channel_divinity_charges from class_specific when channel_divinity is not set', async () => {
            const stats = makePlayerStats({
                class: {
                    class_levels: [
                        { level: 1 },
                        { level: 2 },
                        { level: 3 },
                        { level: 4 },
                        { level: 5 },
                        { level: 6, class_specific: { channel_divinity_charges: 4 } },
                    ],
                },
            });
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                return null;
            });

            await handle(makeAction(), stats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'channelDivinityCharges',
                3,
                campaignName,
            );
        });
    });
});
