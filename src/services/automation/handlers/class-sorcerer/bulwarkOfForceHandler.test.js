import { handle, handleAddTarget } from './bulwarkOfForceHandler.js';
import * as runtimeState from '../../../../hooks/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const makePlayerStats = (overrides = {}) => ({
    name: 'Test Fighter',
    level: 15,
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    ...overrides,
});

const makeAction = (auto = {}) => ({
    name: 'Bulwark of Force',
    automation: {
        type: 'bulwark_of_force',
        range: '30_ft',
        duration: '1_round',
        casting_time: '1 bonus action',
        ...auto,
    },
});

describe('bulwarkOfForceHandler', () => {
    beforeEach(() => {
        runtimeState.getRuntimeValue.mockReset();
        runtimeState.setRuntimeValue.mockReset();
        expirations.addExpiration.mockReset();
        logService.addEntry.mockReset();
    });

    describe('handle', () => {
        it('activates bulwark when not already active', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(false) // bulwark not active
                .mockReturnValueOnce([]); // targets empty

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'bulwarkOfForceActive',
                true,
                'test-campaign'
            );
            expect(expirations.addExpiration).toHaveBeenCalledWith(
                'Test Fighter',
                'Test Fighter',
                [{ type: 'remove_bulwark_of_force' }],
                'test-campaign',
                1
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Max targets: 3');
        });

        it('returns error popup when already active', async () => {
            runtimeState.getRuntimeValue.mockReturnValueOnce(true);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Bulwark of Force is already active.');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('uses minimum 1 target when INT modifier is 0', async () => {
            const stats = makePlayerStats({
                abilities: [{ name: 'Intelligence', bonus: 0 }],
            });

            runtimeState.getRuntimeValue
                .mockReturnValueOnce(false)
                .mockReturnValueOnce([]);

            const result = await handle(makeAction(), stats, 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('Max targets: 1');
        });

        it('handles negative INT modifier as minimum 1 target', async () => {
            const stats = makePlayerStats({
                abilities: [{ name: 'Intelligence', bonus: -2 }],
            });

            runtimeState.getRuntimeValue
                .mockReturnValueOnce(false)
                .mockReturnValueOnce([]);

            const result = await handle(makeAction(), stats, 'test-campaign', 'test-map');

            expect(result.payload.description).toContain('Max targets: 1');
        });
    });

    describe('handleAddTarget', () => {
        it('adds target when bulwark is active and under limit', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(true) // bulwark active
                .mockReturnValueOnce([]); // no targets yet

            const result = await handleAddTarget(makeAction(), makePlayerStats(), 'Ally Joe', 'test-campaign');

            expect(result.success).toBe(true);
            expect(result.targetName).toBe('Ally Joe');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'bulwarkOfForceTargets',
                ['Ally Joe'],
                'test-campaign'
            );
        });

        it('adds multiple targets up to INT modifier limit', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(true) // bulwark active
                .mockReturnValueOnce(['Ally Joe']); // one target already

            const result = await handleAddTarget(makeAction(), makePlayerStats(), 'Ally Sue', 'test-campaign');

            expect(result.success).toBe(true);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'bulwarkOfForceTargets',
                ['Ally Joe', 'Ally Sue'],
                'test-campaign'
            );
        });

        it('returns error when bulwark is not active', async () => {
            runtimeState.getRuntimeValue.mockReturnValueOnce(false);

            const result = await handleAddTarget(makeAction(), makePlayerStats(), 'Ally Joe', 'test-campaign');

            expect(result.error).toBe('Bulwark of Force is not active.');
        });

        it('returns error when max targets reached', async () => {
            // INT modifier is 3, so max 3 targets
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(true) // bulwark active
                .mockReturnValueOnce(['A', 'B', 'C']); // 3 targets already

            const result = await handleAddTarget(makeAction(), makePlayerStats(), 'D', 'test-campaign');

            expect(result.error).toBe('Maximum targets reached (3).');
        });

        it('returns error when target already has cover', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(true) // bulwark active
                .mockReturnValueOnce(['Ally Joe']); // Ally Joe already has cover

            const result = await handleAddTarget(makeAction(), makePlayerStats(), 'Ally Joe', 'test-campaign');

            expect(result.error).toBe('Ally Joe is already granted Half Cover.');
        });
    });
});
