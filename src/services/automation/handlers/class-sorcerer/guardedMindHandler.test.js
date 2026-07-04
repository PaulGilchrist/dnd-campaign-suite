// @improved-by-ai
import { handle } from './guardedMindHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const makeAction = (auto = {}) => ({
    name: 'Guarded Mind',
    automation: { type: 'guarded_mind', resource: 'psionicEnergy', ...auto },
});

const makePlayerStats = (overrides = {}) => ({
    name: 'TestHero',
    level: 10,
    _trackedResources: { psionicEnergy: { max: 6 } },
    ...overrides,
});

describe('guardedMindHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeState.getRuntimeValue.mockReturnValue(null);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
    });

    describe('handle', () => {
        it('should return error popup when no psionic energy remaining', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No Psionic Energy remaining');
            expect(result.payload.automation).toEqual(makeAction().automation);
        });

        it('should return error popup when psionic energy is negative', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(-1);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No Psionic Energy remaining');
        });

        it('should remove charmed condition and decrement resource', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(['charmed', 'blinded']);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', 'psionicEnergy', 4, 'test-campaign'
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', 'activeConditions', ['blinded'], 'test-campaign'
            );
            expect(result.payload.description).toContain('Ended charmed');
            expect(result.payload.description).toContain('Psionic Energy: 4/6');
        });

        it('should remove frightened condition and decrement resource', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(3)
                .mockReturnValueOnce(['frightened', 'poisoned']);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', 'activeConditions', ['poisoned'], 'test-campaign'
            );
            expect(result.payload.description).toContain('Ended frightened');
            expect(result.payload.description).toContain('Psionic Energy: 2/6');
        });

        it('should remove both charmed and frightened conditions in one call', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(2)
                .mockReturnValueOnce(['charmed', 'frightened', 'poisoned']);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', 'activeConditions', ['poisoned'], 'test-campaign'
            );
            expect(result.payload.description).toContain('Ended charmed and frightened');
        });

        it('should leave non-target conditions intact', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(4)
                .mockReturnValueOnce(['blinded', 'charmed', 'poisoned', 'frightened']);

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', 'activeConditions', ['blinded', 'poisoned'], 'test-campaign'
            );
        });

        it('should report none when no matching conditions are present', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(6)
                .mockReturnValueOnce(['blinded', 'poisoned']);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Ended none');
            expect(result.payload.description).toContain('Psionic Energy: 5/6');
        });

        it('should handle empty or undefined conditions as no matching conditions', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(3)
                .mockReturnValueOnce([]);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Ended none');
            expect(result.payload.description).toContain('Psionic Energy: 2/6');
        });

        it('should use default max resource when resources object or key is missing', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(3)
                .mockReturnValueOnce(['charmed']);

            const result = await handle(makeAction(), makePlayerStats({ _trackedResources: { otherResource: { max: 10 } } }), 'test-campaign');

            expect(result.payload.description).toContain('Psionic Energy: 2/6');
        });

        it('should include automation metadata in result payload', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(['charmed']);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.automationType).toBe('guarded_mind');
            expect(result.payload.automation).toEqual(makeAction().automation);
            expect(result.payload.name).toBe('Guarded Mind');
        });

        it('should use custom resource key from automation config', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(8)
                .mockReturnValueOnce(['charmed']);

            const customAction = makeAction({ resource: 'runeCharge' });

            const result = await handle(customAction, makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Psionic Energy: 7/6');
        });

        it('should call addEntry for campaign logging', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(5)
                .mockReturnValueOnce(['charmed']);

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Guarded Mind',
            }));
        });

        it('should treat case-insensitive conditions correctly', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(4)
                .mockReturnValueOnce(['CHARMED', 'Frightened', 'blinded']);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', 'activeConditions', ['blinded'], 'test-campaign'
            );
            expect(result.payload.description).toContain('CHARMED');
            expect(result.payload.description).toContain('Frightened');
        });

        it('should handle non-array conditions by treating as empty', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(2)
                .mockReturnValueOnce('not-an-array');

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Ended none');
        });

        it('should decrement from runtime value even when it exceeds max', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(10)
                .mockReturnValueOnce(['charmed']);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestHero', 'psionicEnergy', 9, 'test-campaign'
            );
            expect(result.payload.description).toContain('Psionic Energy: 9/6');
        });
    });
});

// @cleaned-by-ai
