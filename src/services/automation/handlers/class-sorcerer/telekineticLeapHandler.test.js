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
        it('should activate buff when not already active', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
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

        it('should deactivate buff when already active', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('deactivated');
        });

        it('should use 2x_speed multiplier when flySpeed is 2x_speed', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('Fly Speed 60');
        });

        it('should use custom flySpeed when specified', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeActionCustomSpeed(), makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('Fly Speed 60');
        });

        it('should use playerStats.speed when 2x_speed and speed is custom', async () => {
            const playerStats = { name: 'TestHero', speed: 40 };
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('Fly Speed 80');
        });

        it('should default to 30 base speed when playerStats.speed is not set', async () => {
            const playerStats = { name: 'TestHero' };
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            const result = await handle(makeAction(), playerStats, 'campaign', 'map');

            expect(result.payload.description).toContain('Fly Speed 60');
        });
    });

    describe('applyTelekineticLeap', () => {
        it('should add buff to activeBuffs when none exists', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await applyTelekineticLeap(makeAction(), makePlayerStats(), 'campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('activated');
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

        it('should update existing buff when already present', async () => {
            const existingBuffs = [
                { name: 'Telekinetic Leap', effect: 'telekinetic_leap', flySpeed: 30 },
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
                    }),
                ]),
                'campaign'
            );
        });

        it('should use custom flySpeed from action', async () => {
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

        it('should default duration to until_end_of_turn', async () => {
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
    });
});
