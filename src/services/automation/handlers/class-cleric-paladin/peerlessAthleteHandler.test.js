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

    describe('toggle off when already active', () => {
        it('should return popup indicating ability ended', async () => {
            mockActive();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Peerless Athlete ended.');
        });

        it('should set peerlessAthleteActive to false', async () => {
            mockActive();

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'peerlessAthleteActive',
                false,
                campaignName,
            );
        });

        it('should remove the buff from activeBuffs', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return true;
                if (key === 'activeBuffs') return [
                    { name: 'Peerless Athlete', effect: 'peerless_athlete' },
                    { name: 'Other Buff', effect: 'other' },
                ];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                [{ name: 'Other Buff', effect: 'other' }],
                campaignName,
            );
        });

        it('should clear activeBuffs when it is the only buff', async () => {
            mockActive();

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                [],
                campaignName,
            );
        });

        it('should handle non-array activeBuffs on toggle off', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return true;
                if (key === 'activeBuffs') return 'not-an-array';
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                [],
                campaignName,
            );
        });
    });

    describe('activation', () => {
        it('should return popup with activation description when not active', async () => {
            mockInactive();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Advantage on Strength');
            expect(result.payload.description).toContain('Dexterity (Acrobatics)');
            expect(result.payload.description).toContain('+10 feet');
        });

        it('should spend a channel divinity charge on activation', async () => {
            mockInactive(2);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'channelDivinityCharges',
                1,
                campaignName,
            );
        });

        it('should set peerlessAthleteActive to true on activation', async () => {
            mockInactive();

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'peerlessAthleteActive',
                true,
                campaignName,
            );
        });

        it('should add buff to activeBuffs on activation', async () => {
            mockInactive();

            await handle(makeAction(), makePlayerStats(), campaignName, null);

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
        });

        it('should append buff to existing activeBuffs', async () => {
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

        it('should add expiration for peerless_athlete_end after 6 rounds', async () => {
            mockInactive();

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addExpiration).toHaveBeenCalledWith(
                'TestCleric',
                'TestCleric',
                [{ type: 'peerless_athlete_end' }],
                campaignName,
                6,
            );
        });

        it('should log ability use on activation', async () => {
            mockInactive();

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestCleric',
                abilityName: 'Peerless Athlete',
                description: expect.stringContaining('activated Peerless Athlete'),
            }));
        });

        it('should use automation duration when provided', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') return 2;
                return null;
            });

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

        it('should default duration to 1_hour when automation.duration is missing', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') return 2;
                return null;
            });

            await handle(makeAction({ automation: { type: 'peerless_athlete' } }), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '1_hour' }),
                ]),
                campaignName,
            );
        });

        it('should handle non-array activeBuffs on activation', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return 'not-an-array';
                if (key === 'channelDivinityCharges') return 2;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
        });
    });

    describe('no charges remaining', () => {
        it('should return popup when charges are 0', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'channelDivinityCharges') return 0;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
        });

        it('should return popup when charges are negative', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'channelDivinityCharges') return -1;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
        });

        it('should not spend charges or set active state when no charges remain', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'channelDivinityCharges') return 0;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'TestCleric',
                'peerlessAthleteActive',
                true,
                campaignName,
            );
        });
    });

    describe('charge fallback logic', () => {
        it('should use stored charges when available', async () => {
            mockInactive(1);

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'channelDivinityCharges',
                0,
                campaignName,
            );
        });

        it('should fall back to maxCharges when stored charges are null', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') return null;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'channelDivinityCharges',
                1,
                campaignName,
            );
        });

        it('should fall back to maxCharges when stored charges are undefined', async () => {
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') return undefined;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'channelDivinityCharges',
                1,
                campaignName,
            );
        });

        it('should use channel_divinity_charges from class_specific when channel_divinity is not set', async () => {
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

        it('should default to 2 charges when class data is entirely missing', async () => {
            const stats = makePlayerStats({ class: {} });
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') return undefined;
                return null;
            });

            await handle(makeAction(), stats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'channelDivinityCharges',
                1,
                campaignName,
            );
        });

        it('should default to 2 charges when class_levels index is out of range', async () => {
            const stats = makePlayerStats({ level: 100 });
            getRuntimeValue.mockImplementation((_name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                return null;
            });

            await handle(makeAction(), stats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'channelDivinityCharges',
                1,
                campaignName,
            );
        });
    });

    describe('popup payload structure', () => {
        it('should include name in popup payload', async () => {
            mockInactive();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.name).toBe('Peerless Athlete');
        });

        it('should include automationType in popup payload', async () => {
            mockInactive();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.automationType).toBe('peerless_athlete');
        });

        it('should include automation object in popup payload', async () => {
            mockInactive();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('should include type automation_info in popup payload', async () => {
            mockInactive();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.payload.type).toBe('automation_info');
        });
    });
});
