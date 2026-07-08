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
        vi.spyOn(console, 'error').mockReturnValue();
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

        it('should use the actual buff name in the expired popup', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            const result = await handle(makeAction({ name: 'Mage Shield' }), mockPlayerStats, mockCampaignName, null);

            expect(result.payload.description).toBe('Mage Shield expired');
            expect(result.payload.name).toBe('Mage Shield');
        });
    });

    describe('activation', () => {
        it('should add expiration and skip combat logic when there is no combat context', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), mockPlayerStats, mockCampaignName, null);

            expect(expirations.addExpiration).toHaveBeenCalledWith(
                'TestCharacter',
                'TestCharacter',
                [{ type: 'remove_active_buff', buffName: 'Shield' }],
                mockCampaignName,
                undefined,
                'TestCharacter'
            );
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

        it('should skip logging when rollbackDamage returns 0 or negative', async () => {
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

        it('should return an activation popup with +5 AC and Magic Missile immunity description', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction({ name: 'Ward Shield' }), mockPlayerStats, mockCampaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Ward Shield');
            expect(result.payload.automationType).toBe('shield');
            expect(result.payload.automation).toEqual({ type: 'shield' });
            expect(result.payload.description).toBe(
                'Ward Shield activated — +5 AC until start of your next turn, immune to Magic Missile'
            );
        });
    });
});
