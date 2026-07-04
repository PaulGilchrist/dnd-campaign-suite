import { handle, applyTelekineticLeap } from './telekineticLeapHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

const makeAction = (auto = {}) => ({
    name: 'Telekinetic Leap',
    automation: { type: 'telekinetic_leap', flySpeed: '2x_speed', ...auto },
});

const makeActionCustomSpeed = (auto = {}) => ({
    name: 'Telekinetic Leap',
    automation: { type: 'telekinetic_leap', flySpeed: 60, ...auto },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestHero',
    speed: 30,
    ...overrides,
});

describe('telekineticLeapHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should activate buff and return popup with fly speed description when not already active', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Telekinetic Leap');
            expect(result.payload.automationType).toBe('telekinetic_leap');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('Fly Speed 60');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Telekinetic Leap',
                        effect: 'telekinetic_leap',
                        flySpeed: 60,
                        leapEffect: true,
                    }),
                ]),
                'campaign'
            );
        });

        it('should compute fly speed as 2x player base speed when base speed differs', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), { name: 'TestHero', speed: 40 }, 'campaign', 'map');

            expect(result.payload.description).toContain('Fly Speed 80');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ flySpeed: 80 }),
                ]),
                'campaign'
            );
        });

        it('should default to 30 base speed when playerStats.speed is missing or zero', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            await handle(makeAction(), { name: 'TestHero', speed: 0 }, 'campaign', 'map');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ flySpeed: 60 }),
                ]),
                'campaign'
            );
        });

        it('should use custom flySpeed value directly when not 2x_speed', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeActionCustomSpeed(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('Fly Speed 60');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ flySpeed: 60 }),
                ]),
                'campaign'
            );
        });

        it('should show popup when already active and no psionic energy remaining', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce([
                    { name: 'Telekinetic Leap', effect: 'telekinetic_leap', leapEffect: true },
                ])
                .mockReturnValueOnce(0);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('already active');
            expect(result.payload.description).toContain('Psionic Energy Die');
        });

        it('should spend a psionic energy die and show refresh popup when already active with energy available', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce([
                    { name: 'Telekinetic Leap', effect: 'telekinetic_leap', leapEffect: true },
                ])
                .mockReturnValueOnce(3);

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('refreshed');
            expect(result.payload.description).toContain('spent 1 Psionic Energy Die');
            expect(result.payload.description).toContain('Fly Speed 60');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestHero', 'psionicEnergy', 2, 'campaign');
        });

        it('should fallback to _trackedResources max when getRuntimeValue returns undefined for psionicEnergy', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce([
                    { name: 'Telekinetic Leap', effect: 'telekinetic_leap', leapEffect: true },
                ])
                .mockReturnValueOnce(undefined);

            const playerStats = {
                name: 'TestHero',
                _trackedResources: { psionicEnergy: { max: 8 } },
            };

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('refreshed');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestHero', 'psionicEnergy', 7, 'campaign');
        });

        it('should default max psionic energy to 6 when no tracked resources', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce([
                    { name: 'Telekinetic Leap', effect: 'telekinetic_leap', leapEffect: true },
                ])
                .mockReturnValueOnce(undefined);

            const playerStats = { name: 'TestHero' };

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('refreshed');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('TestHero', 'psionicEnergy', 5, 'campaign');
        });
    });

    describe('applyTelekineticLeap', () => {
        it('should add new buff to activeBuffs when none exists', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await applyTelekineticLeap(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('Fly Speed 60');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Telekinetic Leap',
                        effect: 'telekinetic_leap',
                        flySpeed: 60,
                        leapEffect: true,
                        duration: 'until_end_of_turn',
                    }),
                ]),
                'campaign'
            );
        });

        it('should replace existing Telekinetic Leap buff with updated values', async () => {
            const existingBuffs = [
                { name: 'Telekinetic Leap', effect: 'telekinetic_leap', flySpeed: 30, leapEffect: true },
                { name: 'Other Buff', effect: 'other' },
            ];
            runtimeState.getRuntimeValue.mockReturnValue(existingBuffs);

            const result = await applyTelekineticLeap(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Telekinetic Leap',
                        effect: 'telekinetic_leap',
                        flySpeed: 60,
                        leapEffect: true,
                        duration: 'until_end_of_turn',
                    }),
                ]),
                'campaign'
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Other Buff' }),
                ]),
                'campaign'
            );
        });

        it('should handle non-array stored value by treating it as empty', async () => {
            runtimeState.getRuntimeValue.mockReturnValue('not-an-array');

            const result = await applyTelekineticLeap(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Telekinetic Leap',
                        leapEffect: true,
                    }),
                ]),
                'campaign'
            );
        });

        it('should use custom flySpeed from action when not 2x_speed', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            await applyTelekineticLeap(makeActionCustomSpeed(), makePlayerStats(), 'campaign');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ flySpeed: 60 }),
                ]),
                'campaign'
            );
        });

        it('should use duration from automation when specified', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);
            const action = makeAction({ duration: '1_minute' });

            await applyTelekineticLeap(action, makePlayerStats(), 'campaign');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: '1_minute' }),
                ]),
                'campaign'
            );
        });

        it('should default duration to until_end_of_turn when not specified', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            await applyTelekineticLeap(makeAction(), makePlayerStats(), 'campaign');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ duration: 'until_end_of_turn' }),
                ]),
                'campaign'
            );
        });

        it('should compute flySpeed from playerStats when action uses 2x_speed', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            await applyTelekineticLeap(makeAction(), { name: 'TestHero', speed: 40 }, 'campaign');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ flySpeed: 80 }),
                ]),
                'campaign'
            );
        });
    });
});

// @cleaned-by-ai
