// @improved-by-ai
import { handle, handleAddTarget } from './bulwarkOfForceHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
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
    level: 5,
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

const campaignName = 'test-campaign';

describe('bulwarkOfForceHandler', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('handle', () => {
        it('activates bulwark and sets runtime state when not already active', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(false) // bulwark not active
                .mockReturnValueOnce(undefined); // targets (not read on activation)

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Bulwark of Force');
            expect(result.payload.automationType).toBe('bulwark_of_force');
            expect(result.payload.description).toContain('Max targets: 3');
            expect(result.payload.automation).toEqual(makeAction().automation);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'bulwarkOfForceActive',
                true,
                campaignName
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'bulwarkOfForceTargets',
                [],
                campaignName
            );
        });

        it('sets expiration when activating bulwark', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(undefined);

            await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(expirations.addExpiration).toHaveBeenCalledWith(
                'Test Fighter',
                'Test Fighter',
                [{ type: 'remove_bulwark_of_force' }],
                campaignName,
                1
            );
        });

        it('logs the ability use when activating bulwark', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(undefined);

            await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'Test Fighter',
                abilityName: 'Bulwark of Force',
                description: expect.stringContaining('Allies within 30 feet have Half Cover'),
                timestamp: expect.any(Number),
            });
        });

        it('returns error popup when bulwark is already active', async () => {
            runtimeState.getRuntimeValue.mockReturnValueOnce(true);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Bulwark of Force is already active.');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('uses minimum 1 target when INT modifier is 0', async () => {
            const stats = makePlayerStats({
                abilities: [{ name: 'Intelligence', bonus: 0 }],
            });

            runtimeState.getRuntimeValue
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(undefined);

            const result = await handle(makeAction(), stats, campaignName, 'test-map');

            expect(result.payload.description).toContain('Max targets: 1');
        });

        it('uses minimum 1 target when INT modifier is negative', async () => {
            const stats = makePlayerStats({
                abilities: [{ name: 'Intelligence', bonus: -5 }],
            });

            runtimeState.getRuntimeValue
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(undefined);

            const result = await handle(makeAction(), stats, campaignName, 'test-map');

            expect(result.payload.description).toContain('Max targets: 1');
        });

        it('uses minimum 1 target when Intelligence ability is missing', async () => {
            const stats = makePlayerStats({
                abilities: [],
            });

            runtimeState.getRuntimeValue
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(undefined);

            const result = await handle(makeAction(), stats, campaignName, 'test-map');

            expect(result.payload.description).toContain('Max targets: 1');
        });

        it('respects high INT modifier for max targets', async () => {
            const stats = makePlayerStats({
                abilities: [{ name: 'Intelligence', bonus: 10 }],
            });

            runtimeState.getRuntimeValue
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(undefined);

            const result = await handle(makeAction(), stats, campaignName, 'test-map');

            expect(result.payload.description).toContain('Max targets: 10');
        });
    });

    describe('handleAddTarget', () => {
        it('adds target when bulwark is active and under limit', async () => {
            const stats = makePlayerStats();
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(true) // bulwark active
                .mockReturnValueOnce([]); // no targets yet

            const result = await handleAddTarget(makeAction(), stats, 'Ally Joe', campaignName);

            expect(result.success).toBe(true);
            expect(result.targetName).toBe('Ally Joe');
            expect(result.targets).toEqual(['Ally Joe']);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'bulwarkOfForceTargets',
                ['Ally Joe'],
                campaignName
            );
        });

        it('appends to existing targets list', async () => {
            const stats = makePlayerStats();
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(true) // bulwark active
                .mockReturnValueOnce(['Ally Joe']); // one target already

            const result = await handleAddTarget(makeAction(), stats, 'Ally Sue', campaignName);

            expect(result.success).toBe(true);
            expect(result.targets).toEqual(['Ally Joe', 'Ally Sue']);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'bulwarkOfForceTargets',
                ['Ally Joe', 'Ally Sue'],
                campaignName
            );
        });

        it('returns error when bulwark is not active', async () => {
            runtimeState.getRuntimeValue.mockReturnValueOnce(false);

            const result = await handleAddTarget(makeAction(), makePlayerStats(), 'Ally Joe', campaignName);

            expect(result.error).toBe('Bulwark of Force is not active.');
        });

        it('returns error when max targets reached', async () => {
            // INT modifier is 3, so max 3 targets
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(true) // bulwark active
                .mockReturnValueOnce(['A', 'B', 'C']); // 3 targets already

            const result = await handleAddTarget(makeAction(), makePlayerStats(), 'D', campaignName);

            expect(result.error).toBe('Maximum targets reached (3).');
        });

        it('returns error when target already has cover', async () => {
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(true) // bulwark active
                .mockReturnValueOnce(['Ally Joe']); // Ally Joe already has cover

            const result = await handleAddTarget(makeAction(), makePlayerStats(), 'Ally Joe', campaignName);

            expect(result.error).toBe('Ally Joe is already granted Half Cover.');
        });

        it('handles undefined targets list as empty', async () => {
            const stats = makePlayerStats();
            runtimeState.getRuntimeValue
                .mockReturnValueOnce(true) // bulwark active
                .mockReturnValueOnce(undefined); // targets not yet initialized

            const result = await handleAddTarget(makeAction(), stats, 'Ally Joe', campaignName);

            expect(result.success).toBe(true);
            expect(result.targets).toEqual(['Ally Joe']);
        });
    });
});
