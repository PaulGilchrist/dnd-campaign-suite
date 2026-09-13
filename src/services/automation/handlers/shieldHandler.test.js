// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
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
    });

    describe('deactivation (wasActive: true)', () => {
        it('should return an expired popup without calling combat logic', async () => {
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
    });

    describe('activation', () => {
        it('should add expiration and skip combat logic when there is no combat context', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCharacter', targetName: 'TestCharacter', effects: [{ type: 'remove_active_buff', buffName: 'Shield' }], campaignName: mockCampaignName, rounds: undefined, expireOnCreatureName: 'TestCharacter' });
            expect(damageUtils.getCombatContext).toHaveBeenCalled();
            expect(damageRollback.findAttackRollAgainstTarget).not.toHaveBeenCalled();
            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('activated');
        });

        it('should skip rollback when no attackEvent is found', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: null, attackerName: null });

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
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

        it('should skip rollback when attack would not miss with +5 AC', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 15, bonus: 5, targetAc: 15, rawDamage: 10 },
                attackerName: 'Goblin',
            });

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });

        it('should skip rollback when targetAc is undefined', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 2, bonus: 3, targetAc: undefined, rawDamage: 10 },
                attackerName: 'Goblin',
            });

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });

        it('should rollback damage and log when attack would miss with +5 AC', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 2, bonus: 3, targetAc: 15, rawDamage: 10 },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);

            const result = await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).toHaveBeenCalledWith(
                'Goblin',
                'TestCharacter',
                mockCampaignName,
                'Shield'
            );
            expect(logService.addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Shield',
                description: 'Shield retroactively negates Goblin\'s attack — TestCharacter is healed for 10 HP.',
                timestamp: expect.any(Number),
            });
            expect(result.payload.type).toBe('automation_info');
        });

        it('should use custom buff name, attacker name, and character name in the log description', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 2, bonus: 3, targetAc: 15, rawDamage: 7 },
                attackerName: 'Orc',
            });
            damageRollback.rollbackDamage.mockResolvedValue(7);

            const customStats = { name: 'CustomHero' };

            await handle(makeAction({ name: 'Arcane Shield' }), customStats, mockCampaignName, null);

            expect(logService.addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
                characterName: 'CustomHero',
                description: 'Arcane Shield retroactively negates Orc\'s attack — CustomHero is healed for 7 HP.',
            }));
        });

        it('should skip logging when rollbackDamage returns non-positive value', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 2, bonus: 3, targetAc: 15, rawDamage: 10 },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(0);

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should skip rollback when rawDamage is undefined', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 2, bonus: 3, targetAc: 15, rawDamage: undefined },
                attackerName: 'Goblin',
            });

            await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should catch and log errors from addEntry without throwing', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: { d20: 2, bonus: 3, targetAc: 15, rawDamage: 10 },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);
            logService.addEntry.mockRejectedValue(new Error('log failure'));

            const result = await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('activated');
        });
    });
});
