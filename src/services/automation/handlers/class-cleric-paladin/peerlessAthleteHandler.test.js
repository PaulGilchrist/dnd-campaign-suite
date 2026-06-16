import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './peerlessAthleteHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
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

beforeEach(() => {
    vi.clearAllMocks();
});

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

describe('peerlessAthleteHandler', () => {
    describe('toggle off when already active', () => {
        it('returns popup indicating ability ended when already active', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'peerlessAthleteActive') return true;
                if (key === 'activeBuffs') return [{ name: 'Peerless Athlete', effect: 'peerless_athlete' }];
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Peerless Athlete ended.');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'peerlessAthleteActive', false, 'test-campaign');
        });

        it('removes the buff from activeBuffs when toggling off', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'peerlessAthleteActive') return true;
                if (key === 'activeBuffs') return [
                    { name: 'Peerless Athlete', effect: 'peerless_athlete' },
                    { name: 'Other Buff', effect: 'other' },
                ];
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                [{ name: 'Other Buff', effect: 'other' }],
                'test-campaign'
            );
        });
    });

    describe('activation', () => {
        it('returns popup with activation description when not active', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') return 2;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Advantage on Strength');
            expect(result.payload.description).toContain('Dexterity (Acrobatics)');
            expect(result.payload.description).toContain('+10 feet');
        });

        it('spends a channel divinity charge on activation', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') return 2;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'channelDivinityCharges', 1, 'test-campaign');
        });

        it('sets peerlessAthleteActive to true on activation', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') return 2;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'peerlessAthleteActive', true, 'test-campaign');
        });

        it('adds buff to activeBuffs on activation', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') return 2;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

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
                'test-campaign'
            );
        });

        it('adds expiration for peerless_athlete_end after 6 rounds', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') return 2;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith(
                'TestCleric',
                'TestCleric',
                [{ type: 'peerless_athlete_end' }],
                'test-campaign',
                6
            );
        });

        it('logs ability use on activation', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') return 2;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestCleric',
                abilityName: 'Peerless Athlete',
                description: expect.stringContaining('activated Peerless Athlete'),
            }));
        });

        it('defaults to 2 charges when class data is missing', async () => {
            const stats = makePlayerStats({ class: {} });
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') return undefined;
                return null;
            });

            await handle(makeAction(), stats, 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'channelDivinityCharges', 1, 'test-campaign');
        });
    });

    describe('no charges remaining', () => {
        it('returns popup when charges are 0', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'channelDivinityCharges') return 0;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
        });

        it('returns popup when charges are negative', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'channelDivinityCharges') return -1;
                return null;
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
        });
    });

    describe('uses stored charges with fallback', () => {
        it('uses stored charges when available', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') return 1;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'channelDivinityCharges', 0, 'test-campaign');
        });

        it('falls back to maxCharges when stored is null', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'peerlessAthleteActive') return false;
                if (key === 'activeBuffs') return [];
                if (key === 'channelDivinityCharges') null;
                return null;
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'channelDivinityCharges', 1, 'test-campaign');
        });
    });
});
