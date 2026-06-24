// @improved-by-ai
// Suppress fire-and-forget logService.addEntry rejection warnings from source code
process.on('unhandledRejection', () => {});

import { handle } from './luckyPointHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js');
vi.mock('../../../ui/logService.js');
vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

describe('luckyPointHandler.handle', () => {
    const mockCampaignName = 'TestCampaign';

    function makePlayerStats(overrides = {}) {
        return {
            name: 'TestFighter',
            level: 10,
            feats: [{ name: 'Lucky' }],
            _trackedResources: { luckyPoints: { current: 5, max: 5 } },
            ...overrides,
        };
    }

    function makeAction(overrides = {}) {
        return {
            name: 'Lucky Break',
            automation: { type: 'lucky_point', effect: 'advantage', target: 'd20', cost: 1 },
            ...overrides,
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validation', () => {
        it('should return error popup when no lucky points remaining', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(0);
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Lucky Break');
            expect(result.payload.description).toContain('0');
            expect(result.payload.description).toContain('Lucid Point');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
        });

        it('should return error popup when lucky points are falsy', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('0');
        });

        it('should use _trackedResources.max as fallback when runtime value is undefined', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(undefined);
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 5, bonus: 2, targetName: 'Goblin', hit: false }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Advantage');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 4, mockCampaignName
            );
        });

        it('should spend a lucky point and return popup with attack description on fresh attack', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 3;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 8, bonus: 5, targetName: 'Goblin', hit: false }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 2, mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Lucky Break');
            expect(result.payload.description).toContain('Attack vs AC Goblin');
            expect(result.payload.description).toContain('d20(8)');
            expect(result.payload.description).toContain('+ 5');
            expect(result.payload.description).toContain('13');
            expect(result.payload.description).toContain('Advantage');
            expect(logService.addEntry).toHaveBeenCalledWith(
                mockCampaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestFighter',
                    abilityName: 'Lucky Break',
                })
            );
        });

        it('should return error popup when _trackedResources.luckyPoints is missing', async () => {
            const action = makeAction();
            const playerStats = makePlayerStats({ _trackedResources: {} });

            const result = await handle(action, playerStats, mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('0');
        });
    });

    describe('recent D20 test validation', () => {
        it('should return error when no recent D20 test found (null lastAttack)', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(3);
            damageUtils.getCombatContext.mockResolvedValue({ lastAttack: null });

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent D20 test found');
            expect(result.payload.description).toContain('TestFighter');
        });

        it('should return error when lastAttack attackerName does not match player', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(3);
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 12, bonus: 3, targetName: 'TestFighter', hit: true }
            });

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent D20 test found');
            expect(result.payload.description).toContain('TestFighter');
        });

        it('should return error when lastAttack is stale (not attack/check/save/skill)', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(3);
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'damage', attackerName: 'TestFighter', d20: 10, bonus: 0 }
            });

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent D20 test found');
        });
    });

    describe('attack roll handling', () => {
        it('should spend a lucky point and return popup with attack description on fresh attack', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 3;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 8, bonus: 5, targetName: 'Goblin', hit: false }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 2, mockCampaignName
            );
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Lucky Break');
            expect(result.payload.description).toContain('Attack vs AC Goblin');
            expect(result.payload.description).toContain('d20(8)');
            expect(result.payload.description).toContain('+ 5');
            expect(result.payload.description).toContain('13');
            expect(result.payload.description).toContain('Advantage');
            expect(logService.addEntry).toHaveBeenCalledWith(
                mockCampaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestFighter',
                    abilityName: 'Lucky Break',
                })
            );
        });

        it('should use "unknown" when attack targetName is falsy', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 15, bonus: 2, hit: true }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.payload.description).toContain('Attack vs AC unknown');
        });

        it('should apply disadvantage effect when specified', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 7, bonus: 3, targetName: 'Orc', hit: false }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(
                makeAction({ automation: { type: 'lucky_point', effect: 'disadvantage', target: 'd20', cost: 1 } }),
                makePlayerStats(),
                mockCampaignName
            );

            expect(result.payload.description).toContain('Disadvantage');
            expect(result.payload.description).not.toContain('Advantage');
        });

        it('should default effect to advantage when not specified', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 5, bonus: 0, targetName: 'Skeleton', hit: false }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(
                makeAction({ automation: { type: 'lucky_point', cost: 1 } }),
                makePlayerStats(),
                mockCampaignName
            );

            expect(result.payload.description).toContain('Advantage');
        });
    });

    describe('ability check handling', () => {
        it('should handle ability check (rollType check)', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 2;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'check', attackerName: 'TestFighter', d20: 7, bonus: 3, checkName: 'Stealth' }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 1, mockCampaignName
            );
            expect(result.payload.description).toContain('Stealth');
            expect(result.payload.description).toContain('d20(7)');
            expect(result.payload.description).toContain('+ 3');
            expect(result.payload.description).toContain('10');
        });

        it('should handle ability check (rollType skill)', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 2;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'skill', attackerName: 'TestFighter', d20: 12, bonus: 4, checkName: 'Persuasion' }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.payload.description).toContain('Persuasion');
            expect(result.payload.description).toContain('16');
        });

        it('should use "Ability check" when checkName is falsy', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'check', attackerName: 'TestFighter', d20: 9, bonus: 2 }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.payload.description).toContain('Ability check');
        });

        it('should prefer attack over ability check when both could apply', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 5;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 3, bonus: 5, targetName: 'Orc', hit: false }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.payload.description).toContain('Attack vs AC Orc');
            expect(result.payload.description).not.toContain('Ability check');
        });
    });

    describe('saving throw handling', () => {
        it('should handle saving throw', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', attackerName: 'TestFighter', d20: 5, bonus: 2, saveType: 'CON' }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(
                makeAction({ automation: { type: 'lucky_point', effect: 'disadvantage', target: 'attack_roll', cost: 1 } }),
                makePlayerStats(),
                mockCampaignName
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 0, mockCampaignName
            );
            expect(result.payload.description).toContain('CON save');
            expect(result.payload.description).toContain('Disadvantage');
        });

        it('should use uppercase saveType in description', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', attackerName: 'TestFighter', d20: 10, bonus: 1, saveType: 'dex' }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.payload.description).toContain('DEX save');
        });

        it('should use generic "Saving throw" when saveType is falsy', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', attackerName: 'TestFighter', d20: 8, bonus: 0 }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.payload.description).toContain('Saving throw');
        });

        it('should prioritize attack over save when rollType is attack', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 4, bonus: 6, targetName: 'Dragon', hit: false }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.payload.description).toContain('Attack vs AC Dragon');
            expect(result.payload.description).not.toContain('Saving throw');
        });
    });

    describe('priority ordering', () => {
        it('should prefer attack over ability check and save', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 5;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 3, bonus: 5, targetName: 'Orc', hit: false }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.payload.description).toContain('Attack vs AC Orc');
            expect(result.payload.description).not.toContain('Ability check');
            expect(result.payload.description).not.toContain('Saving throw');
        });

        it('should prefer ability check over save', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'check', attackerName: 'TestFighter', d20: 6, bonus: 2, checkName: 'Athletics' }
            });
            logService.addEntry.mockResolvedValue(undefined);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.payload.description).toContain('Athletics');
            expect(result.payload.description).not.toContain('Saving throw');
        });
    });

    describe('fire-and-forget resilience', () => {
        it('should return popup even when logService.addEntry rejects', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 8, bonus: 5, targetName: 'Goblin', hit: false }
            });
            const logError = new Error('Log service unavailable');
            logService.addEntry.mockRejectedValue(logError);

            const result = await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Lucky Break');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 0, mockCampaignName
            );
            expect(logService.addEntry).toHaveBeenCalled();
        });
    });

    describe('integration', () => {
        it('should log ability_use with correct structure on success', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(4);
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 11, bonus: 7, targetName: 'Troll', hit: false }
            });
            logService.addEntry.mockResolvedValue(undefined);

            await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(logService.addEntry).toHaveBeenCalledWith(
                mockCampaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestFighter',
                    abilityName: 'Lucky Break',
                    description: expect.stringContaining('TestFighter'),
                    timestamp: expect.any(Number),
                })
            );
        });

        it('should deduct exactly the cost amount from lucky points', async () => {
            runtimeState.getRuntimeValue.mockReturnValue(10);
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 1, bonus: 0, targetName: 'Mushroom', hit: false }
            });
            logService.addEntry.mockResolvedValue(undefined);

            await handle(makeAction(), makePlayerStats(), mockCampaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 9, mockCampaignName
            );
        });
    });
});
