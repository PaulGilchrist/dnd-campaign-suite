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
    hasPotentCantrip,
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    isMagicMissileImmune,
    getSoulstitchProtectedCreatures,
    hasSoulstitchProtection,
    applyMinDamageAdjustment,
} from './useLoggedDiceRollUtils.js';

describe('dispatchUnbreakableMajestySave', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
    });

    afterAll(() => {
        vi.unstubAllGlobals();
    });

    it('calls sendSavePrompt with correct parameters', () => {
        dispatchUnbreakableMajestySave('test-campaign', 'Defender', 'Attacker', 15, 'prompt-1');
        expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', {
            promptId: 'prompt-1',
            targetName: 'Attacker',
            saveType: 'CHA',
            saveDc: 15,
            sourceName: 'Defender',
        });
    });

    it('uses empty strings for missing names', () => {
        dispatchUnbreakableMajestySave('', '', '', 0, '');
        expect(sendSavePrompt).toHaveBeenCalledWith('', {
            promptId: '',
            targetName: '',
            saveType: 'CHA',
            saveDc: 0,
            sourceName: '',
        });
    });
});

describe('hasPotentCantrip', () => {
    it('returns true when playerStats has potent_cantrip in passives', () => {
        const playerStats = {
            automation: {
                passives: [{ type: 'potent_cantrip' }],
            },
        };
        expect(hasPotentCantrip(playerStats)).toBe(true);
    });

    it('returns false when passives array does not contain potent_cantrip', () => {
        const playerStats = {
            automation: {
                passives: [{ type: 'other_passive' }],
            },
        };
        expect(hasPotentCantrip(playerStats)).toBe(false);
    });

    it('returns false when passives is empty array', () => {
        const playerStats = {
            automation: {
                passives: [],
            },
        };
        expect(hasPotentCantrip(playerStats)).toBe(false);
    });

    it('returns false when automation is missing', () => {
        const playerStats = {};
        expect(hasPotentCantrip(playerStats)).toBe(false);
    });

    it('returns false when passives is missing', () => {
        const playerStats = { automation: {} };
        expect(hasPotentCantrip(playerStats)).toBe(false);
    });

    it('returns false when playerStats is null', () => {
        expect(hasPotentCantrip(null)).toBe(false);
    });

    it('returns false when playerStats is undefined', () => {
        expect(hasPotentCantrip(undefined)).toBe(false);
    });

    it('returns true when potent_cantrip is among multiple passives', () => {
        const playerStats = {
            automation: {
                passives: [
                    { type: 'other_passive' },
                    { type: 'potent_cantrip' },
                    { type: 'another_passive' },
                ],
            },
        };
        expect(hasPotentCantrip(playerStats)).toBe(true);
    });

    it('uses optional chaining on playerStats to prevent crash', () => {
        const playerStats = { automation: null };
        expect(hasPotentCantrip(playerStats)).toBe(false);
    });
});

describe('getShieldAcBonus', () => {
    beforeEach(() => {
        getRuntimeValue.mockReturnValue([]);
    });

    it('returns 5 when shield buff is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);
        expect(getShieldAcBonus('TestCharacter', 'test-campaign')).toBe(5);
    });

    it('returns 0 when shield buff is not active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
        expect(getShieldAcBonus('TestCharacter', 'test-campaign')).toBe(0);
    });

    it('returns 0 when activeBuffs is empty array', () => {
        getRuntimeValue.mockReturnValue([]);
        expect(getShieldAcBonus('TestCharacter', 'test-campaign')).toBe(0);
    });

    it('returns 0 when getRuntimeValue returns null', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(getShieldAcBonus('TestCharacter', 'test-campaign')).toBe(0);
    });

    it('returns 0 when activeBuffs is not an array', () => {
        getRuntimeValue.mockReturnValue('not-an-array');
        expect(getShieldAcBonus('TestCharacter', 'test-campaign')).toBe(0);
    });

    it('calls getRuntimeValue with correct arguments', () => {
        getRuntimeValue.mockReturnValue([]);
        getShieldAcBonus('MyCharacter', 'my-campaign');
        expect(getRuntimeValue).toHaveBeenCalledWith('MyCharacter', 'activeBuffs', 'my-campaign');
    });

    it('returns 5 when shield is among multiple buffs', () => {
        getRuntimeValue.mockReturnValue([
            { effect: 'shield_of_faith' },
            { effect: 'shield' },
            { effect: 'bless' },
        ]);
        expect(getShieldAcBonus('TestCharacter', 'test-campaign')).toBe(5);
    });
});

describe('getShieldOfFaithAcBonus', () => {
    beforeEach(() => {
        getRuntimeValue.mockReturnValue([]);
    });

    it('returns 2 when shield_of_faith buff is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
        expect(getShieldOfFaithAcBonus('TestCharacter', 'test-campaign')).toBe(2);
    });

    it('returns 0 when shield_of_faith buff is not active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);
        expect(getShieldOfFaithAcBonus('TestCharacter', 'test-campaign')).toBe(0);
    });

    it('returns 0 when activeBuffs is empty array', () => {
        getRuntimeValue.mockReturnValue([]);
        expect(getShieldOfFaithAcBonus('TestCharacter', 'test-campaign')).toBe(0);
    });

    it('returns 0 when getRuntimeValue returns null', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(getShieldOfFaithAcBonus('TestCharacter', 'test-campaign')).toBe(0);
    });

    it('returns 0 when activeBuffs is not an array', () => {
        getRuntimeValue.mockReturnValue(42);
        expect(getShieldOfFaithAcBonus('TestCharacter', 'test-campaign')).toBe(0);
    });

    it('calls getRuntimeValue with correct arguments', () => {
        getRuntimeValue.mockReturnValue([]);
        getShieldOfFaithAcBonus('MyCharacter', 'my-campaign');
        expect(getRuntimeValue).toHaveBeenCalledWith('MyCharacter', 'activeBuffs', 'my-campaign');
    });

    it('returns 2 when shield_of_faith is among multiple buffs', () => {
        getRuntimeValue.mockReturnValue([
            { effect: 'shield' },
            { effect: 'shield_of_faith' },
        ]);
        expect(getShieldOfFaithAcBonus('TestCharacter', 'test-campaign')).toBe(2);
    });
});

describe('isMagicMissileImmune', () => {
    beforeEach(() => {
        getRuntimeValue.mockReturnValue([]);
    });

    it('returns true when shield buff is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);
        expect(isMagicMissileImmune('TestCharacter', 'test-campaign')).toBe(true);
    });

    it('returns false when shield buff is not active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
        expect(isMagicMissileImmune('TestCharacter', 'test-campaign')).toBe(false);
    });

    it('returns false when activeBuffs is empty array', () => {
        getRuntimeValue.mockReturnValue([]);
        expect(isMagicMissileImmune('TestCharacter', 'test-campaign')).toBe(false);
    });

    it('returns false when getRuntimeValue returns null', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(isMagicMissileImmune('TestCharacter', 'test-campaign')).toBe(false);
    });

    it('returns false when activeBuffs is not an array', () => {
        getRuntimeValue.mockReturnValue('not-an-array');
        expect(isMagicMissileImmune('TestCharacter', 'test-campaign')).toBe(false);
    });

    it('calls getRuntimeValue with correct arguments', () => {
        getRuntimeValue.mockReturnValue([]);
        isMagicMissileImmune('MyCharacter', 'my-campaign');
        expect(getRuntimeValue).toHaveBeenCalledWith('MyCharacter', 'activeBuffs', 'my-campaign');
    });

    it('returns true when shield is among multiple buffs', () => {
        getRuntimeValue.mockReturnValue([
            { effect: 'bless' },
            { effect: 'shield' },
        ]);
        expect(isMagicMissileImmune('TestCharacter', 'test-campaign')).toBe(true);
    });
});

describe('getSoulstitchProtectedCreatures', () => {
    beforeEach(() => {
        getRuntimeValue.mockReturnValue([]);
    });

    it('returns the stored array when it is an array', () => {
        getRuntimeValue.mockReturnValue(['CreatureA', 'CreatureB']);
        expect(getSoulstitchProtectedCreatures('PlayerName', 'test-campaign')).toEqual(['CreatureA', 'CreatureB']);
    });

    it('returns empty array when stored value is not an array', () => {
        getRuntimeValue.mockReturnValue('not-an-array');
        expect(getSoulstitchProtectedCreatures('PlayerName', 'test-campaign')).toEqual([]);
    });

    it('returns empty array when stored value is null', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(getSoulstitchProtectedCreatures('PlayerName', 'test-campaign')).toEqual([]);
    });

    it('uses underscored player name with Soulstitch_Spells suffix as key', () => {
        getRuntimeValue.mockReturnValue([]);
        getSoulstitchProtectedCreatures('PlayerName', 'test-campaign');
        expect(getRuntimeValue).toHaveBeenCalledWith('PlayerName', '_PlayerName_Soulstitch_Spells_active', 'test-campaign');
    });

    it('handles player names with spaces by replacing with underscores', () => {
        getRuntimeValue.mockReturnValue([]);
        getSoulstitchProtectedCreatures('Player Name', 'test-campaign');
        expect(getRuntimeValue).toHaveBeenCalledWith('Player Name', '_Player_Name_Soulstitch_Spells_active', 'test-campaign');
    });

    it('handles player names with multiple spaces by replacing them with single underscore', () => {
        getRuntimeValue.mockReturnValue([]);
        getSoulstitchProtectedCreatures('Player  Name', 'test-campaign');
        expect(getRuntimeValue).toHaveBeenCalledWith('Player  Name', '_Player_Name_Soulstitch_Spells_active', 'test-campaign');
    });
});

describe('hasSoulstitchProtection', () => {
    it('returns true when target is in protected list', () => {
        getRuntimeValue.mockReturnValue(['Goblin', 'Orc']);
        expect(hasSoulstitchProtection('Goblin', 'PlayerName', 'test-campaign')).toBe(true);
    });

    it('returns false when target is not in protected list', () => {
        getRuntimeValue.mockReturnValue(['Goblin', 'Orc']);
        expect(hasSoulstitchProtection('Troll', 'PlayerName', 'test-campaign')).toBe(false);
    });

    it('returns false when protected list is empty', () => {
        getRuntimeValue.mockReturnValue([]);
        expect(hasSoulstitchProtection('Goblin', 'PlayerName', 'test-campaign')).toBe(false);
    });

    it('delegates to getSoulstitchProtectedCreatures', () => {
        getRuntimeValue.mockReturnValue(['Target']);
        expect(hasSoulstitchProtection('Target', 'PlayerName', 'test-campaign')).toBe(true);
        expect(getRuntimeValue).toHaveBeenCalledWith('PlayerName', '_PlayerName_Soulstitch_Spells_active', 'test-campaign');
    });
});

describe('applyMinDamageAdjustment', () => {
    beforeEach(() => {
        hasMinDamage.mockReturnValue(false);
    });

    it('returns rawDamage when playerStats is null', () => {
        expect(applyMinDamageAdjustment(10, [3, 4], null, 'fire')).toBe(10);
    });

    it('returns rawDamage when damageType is empty', () => {
        expect(applyMinDamageAdjustment(10, [3, 4], {}, '')).toBe(10);
    });

    it('returns rawDamage when rolls is null', () => {
        expect(applyMinDamageAdjustment(10, null, {}, 'fire')).toBe(10);
    });

    it('returns rawDamage when rolls is not an array', () => {
        expect(applyMinDamageAdjustment(10, 'not-array', {}, 'fire')).toBe(10);
    });

    it('returns rawDamage when rolls is empty array', () => {
        expect(applyMinDamageAdjustment(10, [], {}, 'fire')).toBe(10);
    });

    it('returns rawDamage when hasMinDamage returns false', () => {
        hasMinDamage.mockReturnValue(false);
        expect(applyMinDamageAdjustment(10, [1, 3, 4], {}, 'fire')).toBe(10);
    });

    it('returns rawDamage when there are no ones in rolls', () => {
        hasMinDamage.mockReturnValue(true);
        expect(applyMinDamageAdjustment(10, [2, 3, 4], {}, 'fire')).toBe(10);
    });

    it('adds onesCount to rawDamage when hasMinDamage is true and there are ones', () => {
        hasMinDamage.mockReturnValue(true);
        expect(applyMinDamageAdjustment(10, [1, 3, 1, 5], {}, 'fire')).toBe(12);
    });

    it('adds onesCount to rawDamage when all rolls are ones', () => {
        hasMinDamage.mockReturnValue(true);
        expect(applyMinDamageAdjustment(5, [1, 1, 1], {}, 'fire')).toBe(8);
    });

    it('adds onesCount to rawDamage when only some rolls are ones', () => {
        hasMinDamage.mockReturnValue(true);
        expect(applyMinDamageAdjustment(7, [1, 6, 3, 1, 2], {}, 'fire')).toBe(9);
    });

    it('handles single roll of 1', () => {
        hasMinDamage.mockReturnValue(true);
        expect(applyMinDamageAdjustment(3, [1], {}, 'fire')).toBe(4);
    });

    it('handles single roll that is not 1', () => {
        hasMinDamage.mockReturnValue(true);
        expect(applyMinDamageAdjustment(3, [6], {}, 'fire')).toBe(3);
    });
});
