// @maintained-by-ai
// telekineticLeapHandler — Psionic Shift: Telekinetic Leap (sorcerer lane).
// handle() is the automation/index.js registry entry for type 'telekinetic_leap';
// applyTelekineticLeap() is a direct export currently referenced ONLY by this
// suite (dead-export candidate in source — if it is deleted there, delete that
// block here too; its flySpeed/duration/popup logic is a near-copy of handle()).
// Deterministic: runtime store fully mocked; popup payloads and buff arrays are
// pinned exact (full-string own-composition). Turn-based only — no game timers.
import { handle, applyTelekineticLeap } from './telekineticLeapHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

const campaignName = 'test-campaign';
const playerName = 'TestHero';

function makeAction(auto = {}) {
    return {
        name: 'Telekinetic Leap',
        automation: { type: 'telekinetic_leap', flySpeed: '2x_speed', ...auto },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        speed: 30,
        ...overrides,
    };
}

// Exact buff shape written to activeBuffs (defaults per handle/applyTelekineticLeap).
function leapBuff(overrides = {}) {
    return {
        name: 'Telekinetic Leap',
        effect: 'telekinetic_leap',
        flySpeed: 60,
        duration: 'until_end_of_turn',
        leapEffect: true,
        ...overrides,
    };
}

const activatedDescription = 'Telekinetic Leap activated — Fly Speed 60 ft until end of turn.';

describe('telekineticLeapHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        describe('initial activation (not already active)', () => {
            it('returns the full activation popup contract and writes the default buff', async () => {
                runtimeState.getRuntimeValue.mockReturnValue(null);

                const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

                expect(result).toEqual({
                    type: 'popup',
                    payload: {
                        type: 'automation_info',
                        name: 'Telekinetic Leap',
                        automationType: 'telekinetic_leap',
                        description: activatedDescription,
                        automation: { type: 'telekinetic_leap', flySpeed: '2x_speed' },
                    },
                });
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    [leapBuff()],
                    campaignName,
                );
            });

            it.each([
                ['doubles a normal base speed', 40, 80],
                ['floors at 30 via Math.max when base speed is below 30', 20, 60],
                ['falls back to 30 base speed when speed is 0', 0, 60],
                ['falls back to 30 base speed when speed is undefined', undefined, 60],
            ])('computes 2x_speed flySpeed: %s', async (_label, speed, expectedFlySpeed) => {
                runtimeState.getRuntimeValue.mockReturnValue(null);

                const result = await handle(makeAction(), makePlayerStats({ speed }), campaignName, 'map');

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    [leapBuff({ flySpeed: expectedFlySpeed })],
                    campaignName,
                );
                expect(result.payload.description).toBe(
                    `Telekinetic Leap activated — Fly Speed ${expectedFlySpeed} ft until end of turn.`,
                );
            });

            it.each([
                ['number', 45],
                ['string passed through uncoerced', '75'],
            ])('uses custom flySpeed %s directly', async (_label, flySpeed) => {
                runtimeState.getRuntimeValue.mockReturnValue(null);

                const result = await handle(makeAction({ flySpeed }), makePlayerStats(), campaignName, 'map');

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    [leapBuff({ flySpeed })],
                    campaignName,
                );
                expect(result.payload.description).toBe(
                    `Telekinetic Leap activated — Fly Speed ${flySpeed} ft until end of turn.`,
                );
            });

            it('uses custom duration from automation', async () => {
                runtimeState.getRuntimeValue.mockReturnValue(null);

                await handle(makeAction({ duration: '1_minute' }), makePlayerStats(), campaignName, 'map');

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    [leapBuff({ duration: '1_minute' })],
                    campaignName,
                );
            });

            it('appends the buff and preserves existing buffs', async () => {
                const other = { name: 'Other Buff', effect: 'other' };
                runtimeState.getRuntimeValue.mockReturnValue([other]);

                await handle(makeAction(), makePlayerStats(), campaignName, 'map');

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    [other, leapBuff()],
                    campaignName,
                );
            });

            it('treats non-array stored activeBuffs as empty', async () => {
                runtimeState.getRuntimeValue.mockReturnValue('not-an-array');

                const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

                expect(result.payload.description).toBe(activatedDescription);
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    [leapBuff()],
                    campaignName,
                );
            });
        });

        describe('already active — psionic energy refresh', () => {
            // Positional reads: activeBuffs, then psionicEnergy.
            function mockAlreadyActive(psionicEnergy) {
                runtimeState.getRuntimeValue
                    .mockReturnValueOnce([leapBuff()])
                    .mockReturnValueOnce(psionicEnergy);
            }

            it.each([0, -1])(
                'blocks with no state write when psionic energy is %i',
                async (energy) => {
                    mockAlreadyActive(energy);

                    const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

                    expect(result).toEqual({
                        type: 'popup',
                        payload: {
                            type: 'automation_info',
                            name: 'Telekinetic Leap',
                            automationType: 'telekinetic_leap',
                            description: 'Telekinetic Leap is already active. Spend a Psionic Energy Die to refresh, or wait for end of turn to expire.',
                            automation: { type: 'telekinetic_leap', flySpeed: '2x_speed' },
                        },
                    });
                    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
                },
            );

            it('spends one psionic energy die, rewrites only the energy ledger, and shows the refresh popup', async () => {
                mockAlreadyActive(3);

                const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

                expect(result.payload.description).toBe(
                    'Telekinetic Leap refreshed — spent 1 Psionic Energy Die. Fly Speed 60 ft until end of turn.',
                );
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'psionicEnergy',
                    2,
                    campaignName,
                );
            });

            it.each([
                ['energy is undefined', undefined, {}],
                ['energy is null', null, {}],
                ['tracked max is 0 (falsy || guard)', undefined, { _trackedResources: { psionicEnergy: { max: 0 } } }],
            ])('defaults max psionic energy to 6 when %s', async (_label, energy, statsOverride) => {
                mockAlreadyActive(energy);

                const result = await handle(makeAction(), makePlayerStats(statsOverride), campaignName, 'map');

                expect(result.payload.description).toContain('refreshed');
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'psionicEnergy',
                    5,
                    campaignName,
                );
            });

            it('uses _trackedResources max when available', async () => {
                mockAlreadyActive(undefined);

                await handle(
                    makeAction(),
                    makePlayerStats({ _trackedResources: { psionicEnergy: { max: 8 } } }),
                    campaignName,
                    'map',
                );

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'psionicEnergy',
                    7,
                    campaignName,
                );
            });
        });

        describe('already-active matching predicate (name AND leapEffect)', () => {
            it.each([
                ['leapEffect flag is missing', [{ name: 'Telekinetic Leap', effect: 'telekinetic_leap' }]],
                ['buff name differs', [{ name: 'Other Leap', effect: 'telekinetic_leap', leapEffect: true }]],
            ])('freshly activates when %s', async (_label, buffs) => {
                runtimeState.getRuntimeValue.mockReturnValue(buffs);

                const result = await handle(makeAction(), makePlayerStats(), campaignName, 'map');

                expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
                expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                    playerName,
                    'activeBuffs',
                    [...buffs, leapBuff()],
                    campaignName,
                );
                expect(result.payload.description).toBe(activatedDescription);
            });
        });
    });

    // Direct export currently unused by the app (automation/index.js routes
    // through handle()). Only its unique in-place-replace semantics are pinned;
    // its shared flySpeed/duration/popup logic is covered via handle() above.
    describe('applyTelekineticLeap', () => {
        it('replaces the existing leap buff in place and preserves other buffs', async () => {
            const other = { name: 'Other Buff', effect: 'other' };
            const staleLeap = leapBuff({ flySpeed: 30, duration: 'stale' });
            runtimeState.getRuntimeValue.mockReturnValue([other, staleLeap]);

            const result = await applyTelekineticLeap(makeAction(), makePlayerStats(), campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(activatedDescription);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                [other, leapBuff()],
                campaignName,
            );
        });

        it('appends when no leap buff exists', async () => {
            const other = { name: 'Other Buff', effect: 'other' };
            runtimeState.getRuntimeValue.mockReturnValue([other]);

            await applyTelekineticLeap(makeAction(), makePlayerStats(), campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'activeBuffs',
                [other, leapBuff()],
                campaignName,
            );
        });
    });
});
