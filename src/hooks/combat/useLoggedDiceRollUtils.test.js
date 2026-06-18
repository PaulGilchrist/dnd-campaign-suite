import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasMinDamage: vi.fn(),
}));

import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { hasMinDamage } from '../../services/combat/automation/automationService.js';
import {
    dispatchUnbreakableMajestySave,
    readAoeContext,
    hasPotentCantrip,
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    isMagicMissileImmune,
    getSoulstitchProtectedCreatures,
    hasSoulstitchProtection,
    applyMinDamageAdjustment,
} from './useLoggedDiceRollUtils.js';

describe('useLoggedDiceRollUtils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('dispatchUnbreakableMajestySave', () => {
        it('sends save prompt with CHA save type', () => {
            dispatchUnbreakableMajestySave('test-campaign', 'Defender', 'Attacker', 15, 'majesty-123');
            expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', {
                promptId: 'majesty-123',
                targetName: 'Attacker',
                saveType: 'CHA',
                saveDc: 15,
                sourceName: 'Defender',
            });
        });
    });

    describe('readAoeContext', () => {
        it('returns null — AOE context is now managed via server/SSE only', () => {
            const result = readAoeContext('test-campaign');
            expect(result).toBeNull();
        });
    });

    describe('hasPotentCantrip', () => {
        it('returns true when playerStats has potent_cantrip passive', () => {
            const playerStats = {
                automation: {
                    passives: [{ type: 'potent_cantrip' }],
                },
            };
            expect(hasPotentCantrip(playerStats)).toBe(true);
        });

        it('returns false when no passives', () => {
            const playerStats = {};
            expect(hasPotentCantrip(playerStats)).toBe(false);
        });

        it('returns false when playerStats is null', () => {
            expect(hasPotentCantrip(null)).toBe(false);
        });

        it('returns false when playerStats is undefined', () => {
            expect(hasPotentCantrip(undefined)).toBe(false);
        });

        it('returns false when potent_cantrip not in passives', () => {
            const playerStats = {
                automation: {
                    passives: [{ type: 'other_passive' }],
                },
            };
            expect(hasPotentCantrip(playerStats)).toBe(false);
        });
    });

    describe('getShieldAcBonus', () => {
        it('returns 5 when shield buff is active', () => {
            getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);
            expect(getShieldAcBonus('TestFighter', 'test-campaign')).toBe(5);
        });

        it('returns 0 when shield buff is not active', () => {
            getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
            expect(getShieldAcBonus('TestFighter', 'test-campaign')).toBe(0);
        });

        it('returns 0 when activeBuffs is empty', () => {
            getRuntimeValue.mockReturnValue([]);
            expect(getShieldAcBonus('TestFighter', 'test-campaign')).toBe(0);
        });

        it('returns 0 when activeBuffs is null', () => {
            getRuntimeValue.mockReturnValue(null);
            expect(getShieldAcBonus('TestFighter', 'test-campaign')).toBe(0);
        });
    });

    describe('getShieldOfFaithAcBonus', () => {
        it('returns 2 when shield_of_faith buff is active', () => {
            getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
            expect(getShieldOfFaithAcBonus('TestFighter', 'test-campaign')).toBe(2);
        });

        it('returns 0 when shield_of_faith buff is not active', () => {
            getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);
            expect(getShieldOfFaithAcBonus('TestFighter', 'test-campaign')).toBe(0);
        });

        it('returns 0 when activeBuffs is empty', () => {
            getRuntimeValue.mockReturnValue([]);
            expect(getShieldOfFaithAcBonus('TestFighter', 'test-campaign')).toBe(0);
        });
    });

    describe('isMagicMissileImmune', () => {
        it('returns true when shield buff is active', () => {
            getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);
            expect(isMagicMissileImmune('TestFighter', 'test-campaign')).toBe(true);
        });

        it('returns false when shield buff is not active', () => {
            getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
            expect(isMagicMissileImmune('TestFighter', 'test-campaign')).toBe(false);
        });

        it('returns false when activeBuffs is empty', () => {
            getRuntimeValue.mockReturnValue([]);
            expect(isMagicMissileImmune('TestFighter', 'test-campaign')).toBe(false);
        });
    });

    describe('getSoulstitchProtectedCreatures', () => {
        it('returns protected creatures list', () => {
            getRuntimeValue.mockReturnValue(['Goblin', 'Orc']);
            expect(getSoulstitchProtectedCreatures('TestWizard', 'test-campaign')).toEqual(['Goblin', 'Orc']);
        });

        it('returns empty array when stored is not an array', () => {
            getRuntimeValue.mockReturnValue('not-an-array');
            expect(getSoulstitchProtectedCreatures('TestWizard', 'test-campaign')).toEqual([]);
        });

        it('returns empty array when stored is null', () => {
            getRuntimeValue.mockReturnValue(null);
            expect(getSoulstitchProtectedCreatures('TestWizard', 'test-campaign')).toEqual([]);
        });

        it('replaces spaces with underscores in player name', () => {
            getRuntimeValue.mockReturnValue(['Goblin']);
            getSoulstitchProtectedCreatures('Test Wizard', 'test-campaign');
            expect(getRuntimeValue).toHaveBeenCalledWith('Test Wizard', '_Test_Wizard_Soulstitch_Spells_active', 'test-campaign');
        });
    });

    describe('hasSoulstitchProtection', () => {
        it('returns true when target is in protected list', () => {
            getRuntimeValue.mockReturnValue(['Goblin', 'Orc']);
            expect(hasSoulstitchProtection('Goblin', 'TestWizard', 'test-campaign')).toBe(true);
        });

        it('returns false when target is not in protected list', () => {
            getRuntimeValue.mockReturnValue(['Goblin', 'Orc']);
            expect(hasSoulstitchProtection('Troll', 'TestWizard', 'test-campaign')).toBe(false);
        });

        it('returns false when protected list is empty', () => {
            getRuntimeValue.mockReturnValue([]);
            expect(hasSoulstitchProtection('Goblin', 'TestWizard', 'test-campaign')).toBe(false);
        });
    });

    describe('applyMinDamageAdjustment', () => {
        it('returns rawDamage when playerStats is null', () => {
            expect(applyMinDamageAdjustment(10, [1, 3], null, 'fire')).toBe(10);
        });

        it('returns rawDamage when damageType is missing', () => {
            expect(applyMinDamageAdjustment(10, [1, 3], {}, null)).toBe(10);
        });

        it('returns rawDamage when rolls is not an array', () => {
            expect(applyMinDamageAdjustment(10, '1,3', {}, 'fire')).toBe(10);
        });

        it('returns rawDamage when rolls is empty', () => {
            expect(applyMinDamageAdjustment(10, [], {}, 'fire')).toBe(10);
        });

        it('returns rawDamage when no ones are present', () => {
            hasMinDamage.mockReturnValue(true);
            expect(applyMinDamageAdjustment(10, [3, 4, 5], {}, 'fire')).toBe(10);
        });

        it('returns rawDamage when hasMinDamage is false', () => {
            hasMinDamage.mockReturnValue(false);
            expect(applyMinDamageAdjustment(10, [1, 1, 3], {}, 'fire')).toBe(10);
        });

        it('adds ones count to rawDamage when ones are present', () => {
            hasMinDamage.mockReturnValue(true);
            expect(applyMinDamageAdjustment(8, [1, 1, 3, 3], {}, 'fire')).toBe(10);
        });

        it('adds correct count for mixed rolls', () => {
            hasMinDamage.mockReturnValue(true);
            expect(applyMinDamageAdjustment(6, [1, 2, 1, 1, 4], {}, 'fire')).toBe(9);
        });
    });
});
