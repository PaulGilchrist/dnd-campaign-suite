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

describe('shieldHandler', () => {
    const mockPlayerStats = { name: 'TestCharacter' };
    const mockCampaignName = 'test-campaign';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('buff toggle behavior', () => {
        it('should call toggleBuff with correct arguments on activation', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'TestCharacter',
                'Shield',
                expect.objectContaining({ effect: 'shield' }),
                mockCampaignName
            );
        });

        it('should call toggleBuff with correct arguments on deactivation', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'TestCharacter',
                'Shield',
                expect.objectContaining({ effect: 'shield' }),
                mockCampaignName
            );
        });

        it('should use the buff name from action.name', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            const action = {
                name: 'My Custom Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'TestCharacter',
                'My Custom Shield',
                expect.anything(),
                mockCampaignName
            );
        });

        it('should use the automation object from action.automation', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });

            const action = {
                name: 'Shield',
                automation: { type: 'shield', acBonus: 5 },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
                'TestCharacter',
                'Shield',
                expect.objectContaining({ acBonus: 5 }),
                mockCampaignName
            );
        });
    });

    describe('deactivation (wasActive: true)', () => {
        it('should not call addExpiration when deactivating', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(expirations.addExpiration).not.toHaveBeenCalled();
        });

        it('should not call getCombatContext when deactivating', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
        });

        it('should return popup with expired description when deactivating', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Shield',
                    automationType: 'shield',
                    description: 'Shield expired',
                    automation: { type: 'shield' },
                },
            });
        });

        it('should use the correct buff name in expired description', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: true });

            const action = {
                name: 'My Shield',
                automation: { type: 'shield' },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(result.payload.description).toBe('My Shield expired');
        });
    });

    describe('activation (wasActive: false) — no combat context', () => {
        it('should skip combat logic when getCombatContext returns null', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

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

        it('should skip combat logic when getCombatContext returns undefined', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(undefined);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.findAttackRollAgainstTarget).not.toHaveBeenCalled();
        });

        it('should skip combat logic when getCombatContext returns falsey value', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(0);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.findAttackRollAgainstTarget).not.toHaveBeenCalled();
        });
    });

    describe('activation — no attack event found', () => {
        it('should skip rollback when findAttackRollAgainstTarget returns no attackEvent', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({ attackEvent: null, attackerName: null });

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should skip rollback when attack targets a different character', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
            });

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });
    });

    describe('activation — attack would not miss with shield', () => {
        it('should skip rollback when rollTotal >= targetAc + 5 (would hit even with shield)', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 20,
                    bonus: 5,
                    targetAc: 18,
                    rawDamage: 10,
                },
                attackerName: 'Goblin',
            });
            // rollTotal = 25, targetAc + 5 = 23, 25 >= 23 so wouldMissWithShield is false

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should skip rollback when rollTotal exactly equals targetAc + 5 (hit with shield)', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 15,
                    bonus: 3,
                    targetAc: 13,
                    rawDamage: 10,
                },
                attackerName: 'Goblin',
            });
            // rollTotal = 18, targetAc + 5 = 18, 18 >= 18 so wouldMissWithShield is false

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });

        it('should skip rollback when targetAc is null', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 10,
                    bonus: 3,
                    targetAc: null,
                    rawDamage: 10,
                },
                attackerName: 'Goblin',
            });

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });

        it('should skip rollback when attackEvent has no targetAc', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 10,
                    bonus: 3,
                    rawDamage: 10,
                },
                attackerName: 'Goblin',
            });

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });
    });

    describe('activation — attack would miss with shield but no attacker', () => {
        it('should skip rollback when attackerName is missing', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                    rawDamage: 10,
                },
                attackerName: null,
            });
            // rollTotal = 5, targetAc + 5 = 20, 5 < 20 so wouldMissWithShield is true, but no attacker

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });
    });

    describe('activation — attack would miss with shield but no damage', () => {
        it('should skip rollback when rawDamage is 0', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                    rawDamage: 0,
                },
                attackerName: 'Goblin',
            });

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should skip rollback when rawDamage is undefined (defaulting to 0)', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                },
                attackerName: 'Goblin',
            });

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });

        it('should skip rollback when rawDamage is negative', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                    rawDamage: -5,
                },
                attackerName: 'Goblin',
            });

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
        });
    });

    describe('activation — rollback returns 0 (no healing)', () => {
        it('should skip log entry when rollbackDamage returns 0', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                    rawDamage: 10,
                },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(0);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).toHaveBeenCalledWith(
                'Goblin',
                'TestCharacter',
                mockCampaignName,
                'Shield'
            );
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('should skip log entry when rollbackDamage returns negative', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                    rawDamage: 10,
                },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(-1);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(logService.addEntry).not.toHaveBeenCalled();
        });
    });

    describe('activation — rollback succeeds with healing', () => {
        it('should call rollbackDamage with correct arguments', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                    rawDamage: 10,
                },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).toHaveBeenCalledWith(
                'Goblin',
                'TestCharacter',
                mockCampaignName,
                'Shield'
            );
        });

        it('should call addEntry with ability_use type when healing > 0', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                    rawDamage: 10,
                },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(logService.addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Shield',
                description: 'Shield retroactively negates Goblin\'s attack — TestCharacter is healed for 10 HP.',
                timestamp: expect.any(Number),
            });
        });

        it('should use the correct buff name in the log entry description', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                    rawDamage: 7,
                },
                attackerName: 'Orc',
            });
            damageRollback.rollbackDamage.mockResolvedValue(7);

            const action = {
                name: 'My Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(logService.addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Shield',
                description: 'My Shield retroactively negates Orc\'s attack — TestCharacter is healed for 7 HP.',
                timestamp: expect.any(Number),
            });
        });

        it('should use the correct character name in the log entry', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                    rawDamage: 5,
                },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(5);

            const customPlayerStats = { name: 'CustomHero' };

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, customPlayerStats, mockCampaignName, null);

            expect(logService.addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'ability_use',
                characterName: 'CustomHero',
                abilityName: 'Shield',
                description: 'Shield retroactively negates Goblin\'s attack — CustomHero is healed for 5 HP.',
                timestamp: expect.any(Number),
            });
        });

        it('should use the attacker name in the log entry', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                    rawDamage: 5,
                },
                attackerName: 'Red Dragon',
            });
            damageRollback.rollbackDamage.mockResolvedValue(5);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(logService.addEntry).toHaveBeenCalledWith(mockCampaignName, {
                type: 'ability_use',
                characterName: 'TestCharacter',
                abilityName: 'Shield',
                description: 'Shield retroactively negates Red Dragon\'s attack — TestCharacter is healed for 5 HP.',
                timestamp: expect.any(Number),
            });
        });

        it('should include timestamp in the log entry', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                    rawDamage: 5,
                },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(5);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(logService.addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
                timestamp: expect.any(Number),
            }));
        });
    });

    describe('activation — addEntry rejection', () => {
        it('should not throw when addEntry rejects', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                    rawDamage: 10,
                },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);
            logService.addEntry.mockRejectedValue(new Error('Network error'));

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.payload).toBeUndefined();
        });

        it('should not throw when addEntry rejects with undefined error', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 2,
                    bonus: 3,
                    targetAc: 15,
                    rawDamage: 10,
                },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(10);
            logService.addEntry.mockRejectedValue(undefined);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(result.type).toBe('popup');
        });
    });

    describe('activation — return popup', () => {
        it('should return popup type with automation_info payload on activation', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
        });

        it('should include the buff name in the payload', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const action = {
                name: 'Arcane Shield',
                automation: { type: 'shield' },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(result.payload.name).toBe('Arcane Shield');
        });

        it('should include the automation type in the payload', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(result.payload.automationType).toBe('shield');
        });

        it('should include the activation description on activation', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(result.payload.description).toBe(
                'Shield activated — +5 AC until start of your next turn, immune to Magic Missile'
            );
        });

        it('should include the automation object in the payload', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const action = {
                name: 'Shield',
                automation: { type: 'shield', acBonus: 5 },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(result.payload.automation).toEqual({ type: 'shield', acBonus: 5 });
        });

        it('should include the full automation object even with extra fields', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue(null);

            const action = {
                name: 'Shield',
                automation: { type: 'shield', acBonus: 5, duration: '1_round' },
            };

            const result = await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(result.payload.automation).toEqual({
                type: 'shield',
                acBonus: 5,
                duration: '1_round',
            });
        });
    });

    describe('edge cases — roll calculation', () => {
        it('should detect a miss with shield when rollTotal < targetAc + 5', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 1,
                    bonus: 0,
                    targetAc: 10,
                    rawDamage: 10,
                },
                attackerName: 'Goblin',
            });
            // rollTotal = 1, targetAc + 5 = 15, 1 < 15 so wouldMissWithShield is true
            damageRollback.rollbackDamage.mockResolvedValue(10);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).toHaveBeenCalled();
        });

        it('should detect a miss with shield when rollTotal = targetAc + 4', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 10,
                    bonus: 4,
                    targetAc: 15,
                    rawDamage: 10,
                },
                attackerName: 'Goblin',
            });
            // rollTotal = 14, targetAc + 5 = 20, 14 < 20 so wouldMissWithShield is true

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).toHaveBeenCalled();
        });

        it('should use rawDamage from attackEvent when present', async () => {
            buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
            damageUtils.getCombatContext.mockResolvedValue({});
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: {
                    d20: 1,
                    bonus: 0,
                    targetAc: 10,
                    rawDamage: 42,
                },
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(42);

            const action = {
                name: 'Shield',
                automation: { type: 'shield' },
            };

            await handle(action, mockPlayerStats, mockCampaignName, null);

            expect(damageRollback.rollbackDamage).toHaveBeenCalledWith(
                'Goblin',
                'TestCharacter',
                mockCampaignName,
                'Shield'
            );
        });
    });
});
