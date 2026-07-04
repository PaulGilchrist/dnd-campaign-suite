import { handle, activateBulwarkOfForce } from './bulwarkOfForceHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';

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

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
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
        it('returns modal with creature targets when not already active', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(false);
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Test Fighter' },
                    { name: 'Ally Joe' },
                    { name: 'Ally Sue' },
                ],
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bulwarkOfForceTarget');
            expect(result.payload.maxTargets).toBe(3);
            expect(result.payload.creatureTargets).toEqual([
                { name: 'Ally Joe' },
                { name: 'Ally Sue' },
            ]);
        });

        it('returns modal with empty targets list when no combat context', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(false);
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('bulwarkOfForceTarget');
            expect(result.payload.creatureTargets).toEqual([]);
        });

        it('returns error popup when bulwark is already active', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(true);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Bulwark of Force is already active.');
        });

        it.each([
            [0, 1],
            [-5, 1],
            [10, 10],
        ])('uses max(1, INT modifier) for maxTargets: INT bonus=%i -> maxTargets=%i', async (intBonus, expectedMax) => {
            runtimeState.getRuntimeValue.mockReturnValue(false);

            const stats = makePlayerStats({
                abilities: [{ name: 'Intelligence', bonus: intBonus }],
            });

            const result = await handle(makeAction(), stats, campaignName, 'test-map');

            expect(result.payload.maxTargets).toBe(expectedMax);
        });

        it('uses minimum 1 target when Intelligence ability is missing', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(false);

            const stats = makePlayerStats({
                abilities: [],
            });

            const result = await handle(makeAction(), stats, campaignName, 'test-map');

            expect(result.payload.maxTargets).toBe(1);
        });
    });

    describe('activateBulwarkOfForce', () => {
        it('activates bulwark and sets targets', async () => {
            const result = await activateBulwarkOfForce(
                makeAction(),
                makePlayerStats(),
                campaignName,
                ['Ally Joe', 'Ally Sue']
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Ally Joe, Ally Sue');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'bulwarkOfForceActive',
                true,
                campaignName
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'bulwarkOfForceTargets',
                ['Ally Joe', 'Ally Sue'],
                campaignName
            );
        });

        it('clamps targets to max allowed', async () => {
            const stats = makePlayerStats({
                abilities: [{ name: 'Intelligence', bonus: 1 }],
            });

            await activateBulwarkOfForce(
                makeAction(),
                stats,
                campaignName,
                ['Ally A', 'Ally B', 'Ally C']
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'bulwarkOfForceTargets',
                ['Ally A'],
                campaignName
            );
        });

        it('sets expiration when activating bulwark', async () => {
            await activateBulwarkOfForce(
                makeAction(),
                makePlayerStats(),
                campaignName,
                ['Ally Joe']
            );

            expect(expirations.addExpiration).toHaveBeenCalledWith(
                'Test Fighter',
                'Test Fighter',
                [{ type: 'remove_bulwark_of_force' }],
                campaignName,
                1
            );
        });

        it('logs the ability use when activating bulwark', async () => {
            await activateBulwarkOfForce(
                makeAction(),
                makePlayerStats(),
                campaignName,
                ['Ally Joe']
            );

            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: 'Test Fighter',
                abilityName: 'Bulwark of Force',
                description: expect.stringContaining('Ally Joe'),
                timestamp: expect.any(Number),
            });
        });

        it('handles empty targets list', async () => {
            const result = await activateBulwarkOfForce(
                makeAction(),
                makePlayerStats(),
                campaignName,
                []
            );

            expect(result.payload.description).toContain('0 target(s)');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'Test Fighter',
                'bulwarkOfForceTargets',
                [],
                campaignName
            );
        });
    });
});

// @cleaned-by-ai
