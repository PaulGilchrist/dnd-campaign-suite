// @improved-by-ai
import { handle, applyTelekineticLeap } from './telekineticLeapHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as buffToggle from '../../common/buffToggle.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
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
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Telekinetic Leap');
            expect(result.payload.automationType).toBe('telekinetic_leap');
            expect(result.payload.description).toContain('activated');
            expect(result.payload.description).toContain('Fly Speed 60');
            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'TestHero',
                'Telekinetic Leap',
                expect.objectContaining({ effect: 'telekinetic_leap', flySpeed: 60 }),
                'campaign',
                'TestHero'
            );
        });

        it('should deactivate buff and return popup when already active', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toMatch(/deactivated/);
            expect(result.payload.automationType).toBe('telekinetic_leap');
        });

        it('should compute fly speed as 2x player base speed when flySpeed is 2x_speed', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'TestHero',
                'Telekinetic Leap',
                expect.objectContaining({ flySpeed: 60 }),
                'campaign',
                'TestHero'
            );
        });

        it('should compute fly speed using custom base speed when playerStats.speed differs', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), { name: 'TestHero', speed: 40 }, 'campaign', 'map');

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'TestHero',
                'Telekinetic Leap',
                expect.objectContaining({ flySpeed: 80 }),
                'campaign',
                'TestHero'
            );
        });

        it('should default to 30 base speed when playerStats.speed is missing', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), { name: 'TestHero' }, 'campaign', 'map');

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'TestHero',
                'Telekinetic Leap',
                expect.objectContaining({ flySpeed: 60 }),
                'campaign',
                'TestHero'
            );
        });

        it('should use custom flySpeed value directly when not 2x_speed', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeActionCustomSpeed(), makePlayerStats(), 'campaign', 'map');

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'TestHero',
                'Telekinetic Leap',
                expect.objectContaining({ flySpeed: 60 }),
                'campaign',
                'TestHero'
            );
        });

        it('should default to 30 base speed when playerStats.speed is 0', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            await handle(makeAction(), { name: 'TestHero', speed: 0 }, 'campaign', 'map');

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'TestHero',
                'Telekinetic Leap',
                expect.objectContaining({ flySpeed: 60 }),
                'campaign',
                'TestHero'
            );
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
            // Verify the other buff is still present
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
