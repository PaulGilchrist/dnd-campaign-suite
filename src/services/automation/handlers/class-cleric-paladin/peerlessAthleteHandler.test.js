// @maintained-by-ai
// Peerless Athlete self-buff activation contract: already-active guard, Channel Divinity
// charge spending (with maxCharges fallback), activeBuffs append, expiration, and logging.
// Deterministic — all dependencies mocked, no timers, no DOM.
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

function mockRuntime({ active = false, charges = 2, activeBuffs = [] } = {}) {
    getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'peerlessAthleteActive') return active;
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
        it('returns info popup without touching runtime state', async () => {
            mockRuntime({
                active: true,
                activeBuffs: [
                    { name: 'Peerless Athlete', effect: 'peerless_athlete' },
                    { name: 'Other Buff', effect: 'other' },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Peerless Athlete is already active.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('no charges remaining', () => {
        it('returns info popup without spending or activating when charges are 0', async () => {
            mockRuntime({ charges: 0 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('activation', () => {
        it('spends a charge, activates the buff, schedules expiration, and logs', async () => {
            mockRuntime();

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe(
                'Peerless Athlete activated! You have Advantage on Strength (Athletics) and Dexterity (Acrobatics) checks, and Long/High Jump distance +10 feet for 1 hour.'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'channelDivinityCharges', 1, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'peerlessAthleteActive', true, campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                [expect.objectContaining({ name: 'Peerless Athlete', effect: 'peerless_athlete', duration: '1_hour' })],
                campaignName,
            );
            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: 'TestCleric',
                targetName: 'TestCleric',
                effects: [{ type: 'peerless_athlete_end' }],
                campaignName,
                rounds: 6,
            });
            expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestCleric',
                abilityName: 'Peerless Athlete',
                description: expect.stringContaining('activated Peerless Athlete'),
            }));
        });

        it('appends the buff to existing activeBuffs instead of replacing them', async () => {
            mockRuntime({ activeBuffs: [{ name: 'Existing Buff', effect: 'existing' }] });

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

        it('uses automation duration on the buff when provided', async () => {
            mockRuntime();

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

        it('defaults buff duration to 1_hour when automation duration is falsy', async () => {
            mockRuntime();

            await handle(makeAction({ automation: { duration: null } }), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '1_hour' }),
                ]),
                campaignName,
            );
        });

        it('treats a non-array activeBuffs runtime value as empty', async () => {
            mockRuntime({ activeBuffs: 'not-an-array' });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'TestCleric',
                'activeBuffs',
                [expect.objectContaining({ name: 'Peerless Athlete' })],
                campaignName,
            );
        });
    });

    describe('channel divinity charge sourcing', () => {
        it('reads charges from channel_divinity on the current class level', async () => {
            mockRuntime({ charges: 3 });

            await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'channelDivinityCharges', 2, campaignName);
        });

        it('falls back to class_specific.channel_divinity_charges when channel_divinity is not set', async () => {
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
            mockRuntime({ charges: null });

            await handle(makeAction(), stats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'channelDivinityCharges', 3, campaignName);
        });

        it('defaults to 2 max charges when the class level provides none and stored charges are null', async () => {
            const stats = makePlayerStats({ class: { class_levels: [{ level: 1 }] } });
            mockRuntime({ charges: null });

            await handle(makeAction(), stats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestCleric', 'channelDivinityCharges', 1, campaignName);
        });
    });

    describe('logging error handling', () => {
        it('still returns the activation popup when addEntry rejects', async () => {
            mockRuntime();
            addEntry.mockRejectedValue(new Error('log failed'));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated!');
        });
    });
});
