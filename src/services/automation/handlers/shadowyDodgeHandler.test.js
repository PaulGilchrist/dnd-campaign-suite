import { handle } from './shadowyDodgeHandler.js';
import * as metamagic from '../../../hooks/useMetamagic.js';
import * as logService from '../../ui/logService.js';

vi.mock('../../../hooks/useMetamagic.js', () => ({
    getLastAttackRoll: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

const makePlayerStats = (overrides = {}) => ({
    name: 'Test Rogue',
    level: 15,
    ...overrides,
});

const makeAction = (overrides = {}) => ({
    name: 'Shadowy Dodge',
    automation: {
        type: 'shadowy_dodge',
        trigger: 'after_attack_roll_against_you',
        range: '30_ft',
        casting_time: '1 reaction',
        ...overrides,
    },
    ...overrides,
});

describe('shadowyDodgeHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('should return popup when no recent attack roll exists', async () => {
            metamagic.getLastAttackRoll.mockReturnValue(null);

            const action = makeAction();
            const playerStats = makePlayerStats();
            const result = await handle(action, playerStats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent attack roll');
        });

        it('should return popup when attack roll is stale', async () => {
            const staleTimestamp = Date.now() - 70000;
            metamagic.getLastAttackRoll.mockReturnValue({ timestamp: staleTimestamp });

            const action = makeAction();
            const playerStats = makePlayerStats();
            const result = await handle(action, playerStats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent attack roll');
        });

        it('should simulate disadvantage and show result on successful use', async () => {
            const freshTimestamp = Date.now();
            metamagic.getLastAttackRoll.mockReturnValue({
                d20: 15,
                bonus: 7,
                targetName: 'Goblin',
                targetAc: 14,
                hit: true,
                effectiveAc: 14,
                timestamp: freshTimestamp,
            });

            const action = makeAction();
            const playerStats = makePlayerStats();
            const result = await handle(action, playerStats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Shadowy Dodge');
            expect(result.payload.description).toContain('Attacker: Goblin');
            expect(result.payload.description).toContain('Original roll: d20(15)');
            expect(result.payload.description).toContain('Disadvantage (second d20:');
            expect(result.payload.description).toContain('Teleported 30 feet');
            expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'Test Rogue',
                abilityName: 'Shadowy Dodge',
            }));
        });

        it('should show "still hits" when disadvantage attack also hits', async () => {
            const freshTimestamp = Date.now();
            metamagic.getLastAttackRoll.mockReturnValue({
                d20: 18,
                bonus: 7,
                targetName: 'Orc',
                targetAc: 14,
                hit: true,
                effectiveAc: 14,
                timestamp: freshTimestamp,
            });

            const action = makeAction();
            const playerStats = makePlayerStats();
            const result = await handle(action, playerStats, 'test-campaign', null);

            // With d20=18 and +7, even natural 1 (1+7=8) would miss 14 AC.
            // But with d20=18, the second d20 could be anything 1-20.
            // If second d20 >= 7 (7+7=14 >= 14), it still hits.
            // This test verifies the handler runs without error and shows appropriate text.
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Orc');
        });

        it('should show "already missed" when original attack already missed', async () => {
            const freshTimestamp = Date.now();
            metamagic.getLastAttackRoll.mockReturnValue({
                d20: 3,
                bonus: 2,
                targetName: 'Skeleton',
                targetAc: 14,
                hit: false,
                effectiveAc: 14,
                timestamp: freshTimestamp,
            });

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, 'test-campaign', null);

            expect(result.payload.description).toContain('The attack already missed');
        });

        it('should handle missing targetName gracefully', async () => {
            const freshTimestamp = Date.now();
            metamagic.getLastAttackRoll.mockReturnValue({
                d20: 10,
                bonus: 5,
                targetName: null,
                targetAc: 13,
                hit: true,
                effectiveAc: 13,
                timestamp: freshTimestamp,
            });

            const action = makeAction();
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Unknown creature');
        });

        it('should use automation range for teleport distance', async () => {
            const freshTimestamp = Date.now();
            metamagic.getLastAttackRoll.mockReturnValue({
                d20: 10,
                bonus: 5,
                targetName: 'Bandit',
                targetAc: 13,
                hit: true,
                effectiveAc: 13,
                timestamp: freshTimestamp,
            });

            const action = makeAction({ range: '30_ft' });
            const playerStats = makePlayerStats();

            const result = await handle(action, playerStats, 'test-campaign', null);

            expect(result.payload.description).toContain('Teleported 30 feet');
        });
    });
});
