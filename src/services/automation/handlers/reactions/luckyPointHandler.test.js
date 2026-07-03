// @cleaned-by-ai
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
        it('should return error popup when no lucky points remaining (runtime zero, null, undefined, or missing max)', async () => {
            // runtime zero
            runtimeState.getRuntimeValue.mockReturnValue(0);
            const action = makeAction();

            let result = await handle(action, makePlayerStats(), mockCampaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Lucky Break');
            expect(result.payload.description).toContain('0');
            expect(result.payload.description).toContain('Lucid Point');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(damageUtils.getCombatContext).not.toHaveBeenCalled();

            // runtime null (falsy)
            runtimeState.getRuntimeValue.mockReturnValue(null);
            result = await handle(action, makePlayerStats(), mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('0');

            // runtime undefined falls back to max from _trackedResources
            runtimeState.getRuntimeValue.mockReturnValue(undefined);
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'TestFighter', d20: 5, bonus: 2, targetName: 'Goblin', hit: false }
            });
            logService.addEntry.mockResolvedValue(undefined);
            result = await handle(action, makePlayerStats(), mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Advantage');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 4, mockCampaignName
            );

            // _trackedResources.luckyPoints missing (max defaults to 0)
            runtimeState.getRuntimeValue.mockReturnValue(undefined);
            damageUtils.getCombatContext.mockReset();
            result = await handle(action, makePlayerStats({ _trackedResources: {} }), mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('0');
        });
    });

    describe('recent D20 test validation', () => {
        it('should return error when no recent D20 test found (null lastAttack, wrong attacker, or stale rollType)', async () => {
            const action = makeAction();
            const stats = makePlayerStats();
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 3;
                return undefined;
            });

            // null lastAttack
            damageUtils.getCombatContext.mockResolvedValue({ lastAttack: null });
            let result = await handle(action, stats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent D20 test found');
            expect(result.payload.description).toContain('TestFighter');

            // attackerName does not match player
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'attack', attackerName: 'Goblin', d20: 12, bonus: 3, targetName: 'TestFighter', hit: true }
            });
            result = await handle(action, stats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent D20 test found');

            // stale rollType (not attack/check/save/skill)
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'damage', attackerName: 'TestFighter', d20: 10, bonus: 0 }
            });
            result = await handle(action, stats, mockCampaignName);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent D20 test found');
        });
    });

    describe('attack roll handling', () => {
        it('should spend a lucky point and return popup with attack description', async () => {
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
        it('should handle ability check (rollType check or skill) with checkName fallback', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 2;
                return undefined;
            });
            logService.addEntry.mockResolvedValue(undefined);

            // rollType check with checkName
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'check', attackerName: 'TestFighter', d20: 7, bonus: 3, checkName: 'Stealth' }
            });
            let result = await handle(makeAction(), makePlayerStats(), mockCampaignName);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 1, mockCampaignName
            );
            expect(result.payload.description).toContain('Stealth');
            expect(result.payload.description).toContain('d20(7)');
            expect(result.payload.description).toContain('+ 3');
            expect(result.payload.description).toContain('10');

            // rollType skill with checkName
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'skill', attackerName: 'TestFighter', d20: 12, bonus: 4, checkName: 'Persuasion' }
            });
            result = await handle(makeAction(), makePlayerStats(), mockCampaignName);
            expect(result.payload.description).toContain('Persuasion');
            expect(result.payload.description).toContain('16');

            // checkName falsy falls back to "Ability check"
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'check', attackerName: 'TestFighter', d20: 9, bonus: 2 }
            });
            result = await handle(makeAction(), makePlayerStats(), mockCampaignName);
            expect(result.payload.description).toContain('Ability check');
        });
    });

    describe('saving throw handling', () => {
        it('should handle saving throw with uppercase saveType and generic fallback', async () => {
            runtimeState.getRuntimeValue.mockImplementation((_charName, key) => {
                if (key === 'luckyPoints') return 1;
                return undefined;
            });
            logService.addEntry.mockResolvedValue(undefined);

            // saveType present — uppercase in description
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', attackerName: 'TestFighter', d20: 10, bonus: 1, saveType: 'dex' }
            });
            let result = await handle(makeAction(), makePlayerStats(), mockCampaignName);
            expect(result.payload.description).toContain('DEX save');

            // saveType falsy — generic "Saving throw"
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', attackerName: 'TestFighter', d20: 8, bonus: 0 }
            });
            result = await handle(makeAction(), makePlayerStats(), mockCampaignName);
            expect(result.payload.description).toContain('Saving throw');

            // disadvantage effect on save
            damageUtils.getCombatContext.mockResolvedValue({
                lastAttack: { rollType: 'save', attackerName: 'TestFighter', d20: 5, bonus: 2, saveType: 'CON' }
            });
            result = await handle(
                makeAction({ automation: { type: 'lucky_point', effect: 'disadvantage', target: 'attack_roll', cost: 1 } }),
                makePlayerStats(),
                mockCampaignName
            );
            expect(result.payload.description).toContain('CON save');
            expect(result.payload.description).toContain('Disadvantage');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                'TestFighter', 'luckyPoints', 0, mockCampaignName
            );
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
