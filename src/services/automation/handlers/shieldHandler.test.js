// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './shieldHandler.js';
import * as buffToggle from '../common/buffToggle.js';
import * as expirations from '../../rules/effects/expirations.js';
import * as damageUtils from '../../rules/combat/damageUtils.js';
import * as damageRollback from '../common/damageRollback.js';
import * as logService from '../../ui/logService.js';

vi.mock('../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));

vi.mock('../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../common/damageRollback.js', () => ({
    findAttackRollAgainstTarget: vi.fn(),
    rollbackDamage: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const mockPlayerStats = { name: 'TestCharacter' };
const mockCampaignName = 'test-campaign';

function makeAction(overrides = {}) {
    return {
        name: 'Shield',
        automation: { type: 'shield' },
        ...overrides,
    };
}

describe('shieldHandler', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(console, 'error').mockReturnValue();
    });

    describe('toggleBuff', () => {
        it('should call toggleBuff with playerName, buffName, merged options, and campaignName', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({
                name: 'Arcane Ward',
                automation: { type: 'shield', acBonus: 3 },
            });

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'TestCharacter',
                'Arcane Ward',
                { type: 'shield', acBonus: 3, effect: 'shield' },
                mockCampaignName
            );
        });

        it('should always merge effect:shield into the automation options', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            const action = makeAction({ automation: { type: 'shield', duration: '1_round', extra: true } });

            await handle(action, mockPlayerStats, mockCampaignName, null);

            const options = buffToggle.toggleBuff.mock.calls[0][2];
            expect(options.effect).toBe('shield');
            expect(options.duration).toBe('1_round');
            expect(options.extra).toBe(true);
            expect(options.type).toBe('shield');
        });
    });

    describe('deactivation (wasActive: true)', () => {
        it('should skip addExpiration, getCombatContext, and return expired popup', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            const result = await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
            expect(result).toEqual({
                type: 'popup',
                payload: expect.objectContaining({
                    type: 'automation_info',
                    name: 'Shield',
                    automationType: 'shield',
                    description: 'Shield expired',
                    automation: { type: 'shield' },
                }),
            });
        });

        it('should use the actual buff name in the expired description', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            const result = await handle(makeAction({ name: 'Mage Shield' }), mockPlayerStats, mockCampaignName, null);

            expect(result.payload.description).toBe('Mage Shield expired');
            expect(result.payload.name).toBe('Mage Shield');
        });
    });

    describe('activation — no combat context', () => {
        it('should call addExpiration with correct args and skip all combat logic when getCombatContext is falsy', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(expirations.addExpiration).toHaveBeenCalledWith(
                'TestCharacter',
                'TestCharacter',
                [{ type: 'remove_active_buff', buffName: 'Shield' }],
                mockCampaignName,
                1
            );
            expect(damageRollback.findAttackRollAgainstTarget).not.toHaveBeenCalled();
            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should skip combat logic for any falsy getCombatContext result', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(undefined);

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.findAttackRollAgainstTarget).not.toHaveBeenCalled();
        });
    });

    describe('activation — attack event filtering', () => {
        it('should skip rollback when no attackEvent is found', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: null, attackerName: null });

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should skip rollback when the attack would not miss with shield', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 18, bonus: 5, targetAc: 17, rawDamage: 10 },
                attackerName: 'Goblin',
            });
            // rollTotal=23, targetAc+5=22, 23 >= 22 so shield doesn't cause a miss

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });

        it('should skip rollback when rollTotal exactly equals targetAc + 5', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 13, bonus: 5, targetAc: 13, rawDamage: 10 },
                attackerName: 'Goblin',
            });
            // rollTotal=18, targetAc+5=18

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });

        it('should skip rollback when targetAc is null or missing', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 5, bonus: 3, rawDamage: 10 },
                attackerName: 'Goblin',
            });

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });

        it('should skip rollback when attackerName is missing', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 2, bonus: 3, targetAc: 15, rawDamage: 10 },
                attackerName: null,
            });

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });

        it('should skip rollback when rawDamage is zero, missing, or negative', async () => {
            const falsyDamages = [0, undefined, -5];

            for (const rawDamage of falsyDamages) {
                buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
                damageUtils.getCombatContext.mockResolvedValue({});
                damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                    attackEvent: { d20: 2, bonus: 3, targetAc: 15, rawDamage },
                    attackerName: 'Goblin',
                });

                await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

                expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
                vi.restoreAllMocks();
                vi.spyOn(console, 'error').mockReturnValue();
            }
        });
    });

    describe('activation — rollback with healing', () => {
        it('should call rollbackDamage with attackerName, playerName, campaignName, and buffName', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 2, bonus: 3, targetAc: 15, rawDamage: 10 },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).toHaveBeenCalledWith(
                'Goblin',
                'TestCharacter',
                mockCampaignName,
                'Shield'
            );
        });

        it('should call addEntry with ability_use log when healing is positive', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 2, bonus: 3, targetAc: 15, rawDamage: 10 },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(logService.addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Shield',
                description: 'Shield retroactively negates Goblin\'s attack — TestCharacter is healed for 10 HP.',
                timestamp: expect.any(Number),
            });
        });

        it('should use the buff name and attacker name in the log description', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 2, bonus: 3, targetAc: 15, rawDamage: 7 },
                attackerName: 'Orc',
            });
            damageRollback.rollbackDamage.mockResolvedValue(7);

            await handle(makeAction({ name: 'Arcane Shield' }), mockPlayerStats, mockCampaignName, null);

            expect(logService.addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
                description: 'Arcane Shield retroactively negates Orc\'s attack — TestCharacter is healed for 7 HP.',
            }));
        });

        it('should use the character name from playerStats in the log entry', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 2, bonus: 3, targetAc: 15, rawDamage: 5 },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(5);

            const customStats = { name: 'CustomHero' };

            await handle(makeAction(), customStats, mockCampaignName, null);

            expect(logService.addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
                characterName: 'CustomHero',
                description: expect.stringContaining('CustomHero is healed for 5 HP'),
            }));
        });

        it('should skip addEntry when rollbackDamage returns 0 or negative', async () => {
            const negativeValues = [0, -1];

            for (const healResult of negativeValues) {
                buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
                damageUtils.getCombatContext.mockResolvedValue({});
                damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                    attackEvent: { d20: 2, bonus: 3, targetAc: 15, rawDamage: 10 },
                    attackerName: 'Goblin',
                });
                damageRollback.rollbackDamage.mockResolvedValue(healResult);

                await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

                expect(logService.addEntry).not.toHaveBeenCalled();
                vi.restoreAllMocks();
                vi.spyOn(console, 'error').mockReturnValue();
            }
        });
    });

    describe('activation — addEntry rejection', () => {
        it('should not throw and should still return the popup when addEntry rejects', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 2, bonus: 3, targetAc: 15, rawDamage: 10 },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);
            logService.addEntry.mockRejectedValue(new Error('Network error'));

            const result = await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });
    });

    describe('return value', () => {
        it('should return a popup with automation_info payload on activation', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Shield');
            expect(result.payload.automationType).toBe('shield');
            expect(result.payload.automation).toEqual({ type: 'shield' });
        });

        it('should include the full automation object in the payload', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const auto = { type: 'shield', acBonus: 5, duration: '1_round' };
            const result = await handle(makeAction({ automation: auto }), mockPlayerStats, mockCampaignName, null);

            expect(result.payload.automation).toEqual(auto);
        });

        it('should include the activation description with +5 AC and Magic Missile immunity', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction({ name: 'Ward Shield' }), mockPlayerStats, mockCampaignName, null);

            expect(result.payload.description).toBe(
                'Ward Shield activated — +5 AC until start of your next turn, immune to Magic Missile'
            );
        });
    });

    describe('roll calculation — shield causes a miss', () => {
        it('should trigger rollback when rollTotal < targetAc + 5', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 1, bonus: 0, targetAc: 10, rawDamage: 10 },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).toHaveBeenCalled();
        });

        it('should pass rawDamage from attackEvent to rollbackDamage', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 1, bonus: 0, targetAc: 10, rawDamage: 42 },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(42);

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).toHaveBeenCalledWith(
                'Goblin',
                'TestCharacter',
                mockCampaignName,
                'Shield'
            );
        });
    });
});
