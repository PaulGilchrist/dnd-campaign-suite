// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasMinDamage: vi.fn(),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { getRuntimeValue } from '../runtime/useRuntimeState.js';
import { hasMinDamage } from '../../services/combat/automation/automationService.js';
import { loadMapData } from '../../services/maps/mapsService.js';
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
} from './loggedDiceRollUtils.js';

describe('dispatchUnbreakableMajestySave', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('sends a CHA save prompt from defender to attacker with the given DC', () => {
        dispatchUnbreakableMajestySave('test-campaign', 'Defender', 'Attacker', 15, 'prompt-1');
        expect(sendSavePrompt).toHaveBeenCalledWith('test-campaign', {
            promptId: 'prompt-1',
            targetName: 'Attacker',
            saveType: 'CHA',
            saveDc: 15,
            sourceName: 'Defender',
        });
    });

    it('passes empty strings when names and promptId are omitted', () => {
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

describe('readAoeContext', () => {
    const mockOverlayData = {
        overlays: [{ id: 'aoe-1', name: 'Fireball' }],
    };
    const mockActiveMap = { activeMapName: 'dungeon-1' };
    const mockMapData = { players: [], placedItems: [] };

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns null when campaignName is empty', async () => {
        const result = await readAoeContext('', 'aoe-1');
        expect(result).toBeNull();
    });

    it('returns null when overlayId is empty', async () => {
        const result = await readAoeContext('test-campaign', '');
        expect(result).toBeNull();
    });

    it('returns null when overlay fetch fails', async () => {
        globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false }));
        const result = await readAoeContext('test-campaign', 'aoe-1');
        expect(result).toBeNull();
    });

    it('returns null when overlay is not found', async () => {
        globalThis.fetch = vi.fn((url) => {
            if (url.includes('spell-overlay')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockOverlayData),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ overlays: [] }) });
        });
        const result = await readAoeContext('test-campaign', 'nonexistent');
        expect(result).toBeNull();
    });

    it('returns null when active map fetch fails', async () => {
        globalThis.fetch = vi.fn((url) => {
            if (url.includes('spell-overlay')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockOverlayData),
                });
            }
            return Promise.resolve({ ok: false });
        });
        const result = await readAoeContext('test-campaign', 'aoe-1');
        expect(result).toBeNull();
    });

    it('returns null when active map name is missing', async () => {
        globalThis.fetch = vi.fn((url) => {
            if (url.includes('spell-overlay')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockOverlayData),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });
        const result = await readAoeContext('test-campaign', 'aoe-1');
        expect(result).toBeNull();
    });

    it('returns null when loadMapData fails', async () => {
        globalThis.fetch = vi.fn((url) => {
            if (url.includes('spell-overlay')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockOverlayData),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockActiveMap) });
        });
        loadMapData.mockResolvedValue(null);
        const result = await readAoeContext('test-campaign', 'aoe-1');
        expect(result).toBeNull();
    });

    it('returns overlay context with players and NPCs when all fetches succeed', async () => {
        globalThis.fetch = vi.fn((url) => {
            if (url.includes('spell-overlay')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockOverlayData),
                });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockActiveMap) });
        });
        loadMapData.mockResolvedValue(mockMapData);
        const result = await readAoeContext('test-campaign', 'aoe-1');
        expect(result).toEqual({
            overlay: { id: 'aoe-1', name: 'Fireball' },
            players: [],
            npcs: [],
        });
    });

    it('encodes campaign name in URLs', async () => {
        globalThis.fetch = vi.fn((url) => {
            expect(url).toContain(encodeURIComponent('my test campaign'));
            return Promise.resolve({ ok: false });
        });
        await readAoeContext('my test campaign', 'aoe-1');
    });

    it('returns null on network error', async () => {
        globalThis.fetch = vi.fn(() => Promise.reject(new Error('network failure')));
        const result = await readAoeContext('test-campaign', 'aoe-1');
        expect(result).toBeNull();
    });
});

describe('hasPotentCantrip', () => {
    it('returns true when potent_cantrip passive is present', () => {
        const playerStats = {
            automation: {
                passives: [{ type: 'potent_cantrip' }],
            },
        };
        expect(hasPotentCantrip(playerStats)).toBe(true);
    });

    it('returns false when potent_cantrip passive is absent', () => {
        const playerStats = {
            automation: {
                passives: [{ type: 'other_passive' }],
            },
        };
        expect(hasPotentCantrip(playerStats)).toBe(false);
    });

    it('returns false when passives array is empty', () => {
        expect(hasPotentCantrip({ automation: { passives: [] } })).toBe(false);
    });

    it('returns false when automation or passives are missing', () => {
        expect(hasPotentCantrip({})).toBe(false);
        expect(hasPotentCantrip({ automation: {} })).toBe(false);
    });

    it('returns false when playerStats is null or undefined', () => {
        expect(hasPotentCantrip(null)).toBe(false);
        expect(hasPotentCantrip(undefined)).toBe(false);
    });

    it('returns false when automation is null', () => {
        expect(hasPotentCantrip({ automation: null })).toBe(false);
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
});

describe('getShieldAcBonus', () => {
    const characterName = 'TestCharacter';
    const campaignName = 'test-campaign';

    beforeEach(() => {
        getRuntimeValue.mockReturnValue([]);
    });

    it('returns 5 AC bonus when shield buff is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);
        expect(getShieldAcBonus(characterName, campaignName)).toBe(5);
    });

    it('returns 0 AC bonus when shield buff is not active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
        expect(getShieldAcBonus(characterName, campaignName)).toBe(0);
    });

    it('returns 0 when activeBuffs is empty', () => {
        expect(getShieldAcBonus(characterName, campaignName)).toBe(0);
    });

    it('returns 0 when activeBuffs is null', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(getShieldAcBonus(characterName, campaignName)).toBe(0);
    });

    it('returns 0 when activeBuffs is not an array', () => {
        getRuntimeValue.mockReturnValue('not-an-array');
        expect(getShieldAcBonus(characterName, campaignName)).toBe(0);
    });

    it('returns 5 when shield is among other buffs', () => {
        getRuntimeValue.mockReturnValue([
            { effect: 'shield_of_faith' },
            { effect: 'shield' },
            { effect: 'bless' },
        ]);
        expect(getShieldAcBonus(characterName, campaignName)).toBe(5);
    });
});

describe('getShieldOfFaithAcBonus', () => {
    const characterName = 'TestCharacter';
    const campaignName = 'test-campaign';

    beforeEach(() => {
        getRuntimeValue.mockReturnValue([]);
    });

    it('returns 2 AC bonus when shield_of_faith buff is active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
        expect(getShieldOfFaithAcBonus(characterName, campaignName)).toBe(2);
    });

    it('returns 0 when shield_of_faith buff is not active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);
        expect(getShieldOfFaithAcBonus(characterName, campaignName)).toBe(0);
    });

    it('returns 0 when activeBuffs is empty', () => {
        expect(getShieldOfFaithAcBonus(characterName, campaignName)).toBe(0);
    });

    it('returns 0 when activeBuffs is null', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(getShieldOfFaithAcBonus(characterName, campaignName)).toBe(0);
    });

    it('returns 0 when activeBuffs is not an array', () => {
        getRuntimeValue.mockReturnValue(42);
        expect(getShieldOfFaithAcBonus(characterName, campaignName)).toBe(0);
    });

    it('returns 2 when shield_of_faith is among other buffs', () => {
        getRuntimeValue.mockReturnValue([
            { effect: 'shield' },
            { effect: 'shield_of_faith' },
        ]);
        expect(getShieldOfFaithAcBonus(characterName, campaignName)).toBe(2);
    });
});

describe('isMagicMissileImmune', () => {
    const characterName = 'TestCharacter';
    const campaignName = 'test-campaign';

    beforeEach(() => {
        getRuntimeValue.mockReturnValue([]);
    });

    it('returns true when shield buff grants immunity', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);
        expect(isMagicMissileImmune(characterName, campaignName)).toBe(true);
    });

    it('returns false when shield buff is not active', () => {
        getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
        expect(isMagicMissileImmune(characterName, campaignName)).toBe(false);
    });

    it('returns false when activeBuffs is empty', () => {
        expect(isMagicMissileImmune(characterName, campaignName)).toBe(false);
    });

    it('returns false when activeBuffs is null', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(isMagicMissileImmune(characterName, campaignName)).toBe(false);
    });

    it('returns false when activeBuffs is not an array', () => {
        getRuntimeValue.mockReturnValue('not-an-array');
        expect(isMagicMissileImmune(characterName, campaignName)).toBe(false);
    });

    it('returns true when shield is among other buffs', () => {
        getRuntimeValue.mockReturnValue([
            { effect: 'bless' },
            { effect: 'shield' },
        ]);
        expect(isMagicMissileImmune(characterName, campaignName)).toBe(true);
    });
});

describe('getSoulstitchProtectedCreatures', () => {
    const playerName = 'PlayerName';
    const campaignName = 'test-campaign';

    beforeEach(() => {
        getRuntimeValue.mockReturnValue([]);
    });

    it('returns the stored array when it is valid', () => {
        getRuntimeValue.mockReturnValue(['CreatureA', 'CreatureB']);
        expect(getSoulstitchProtectedCreatures(playerName, campaignName)).toEqual(['CreatureA', 'CreatureB']);
    });

    it('returns empty array when stored value is not an array', () => {
        getRuntimeValue.mockReturnValue('not-an-array');
        expect(getSoulstitchProtectedCreatures(playerName, campaignName)).toEqual([]);
    });

    it('returns empty array when stored value is null', () => {
        getRuntimeValue.mockReturnValue(null);
        expect(getSoulstitchProtectedCreatures(playerName, campaignName)).toEqual([]);
    });

    it('uses underscored player name with Soulstitch_Spells suffix as key', () => {
        getRuntimeValue.mockReturnValue([]);
        getSoulstitchProtectedCreatures(playerName, campaignName);
        expect(getRuntimeValue).toHaveBeenCalledWith(playerName, '_PlayerName_Soulstitch_Spells_active', campaignName);
    });
});

describe('hasSoulstitchProtection', () => {
    const campaignName = 'test-campaign';

    beforeEach(() => {
        getRuntimeValue.mockReturnValue([]);
    });

    it('returns true when target is in the protected list', () => {
        getRuntimeValue.mockReturnValue(['Goblin', 'Orc']);
        expect(hasSoulstitchProtection('Goblin', 'PlayerName', campaignName)).toBe(true);
    });

    it('returns false when target is not in the protected list', () => {
        getRuntimeValue.mockReturnValue(['Goblin', 'Orc']);
        expect(hasSoulstitchProtection('Troll', 'PlayerName', campaignName)).toBe(false);
    });

    it('returns false when the protected list is empty', () => {
        expect(hasSoulstitchProtection('Goblin', 'PlayerName', campaignName)).toBe(false);
    });

    it('delegates to getSoulstitchProtectedCreatures and checks membership', () => {
        getRuntimeValue.mockReturnValue(['Target']);
        expect(hasSoulstitchProtection('Target', 'PlayerName', campaignName)).toBe(true);
        expect(getRuntimeValue).toHaveBeenCalledWith('PlayerName', '_PlayerName_Soulstitch_Spells_active', campaignName);
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

    it('returns rawDamage when rolls is empty', () => {
        expect(applyMinDamageAdjustment(10, [], {}, 'fire')).toBe(10);
    });

    it('returns rawDamage when hasMinDamage check fails', () => {
        hasMinDamage.mockReturnValue(false);
        expect(applyMinDamageAdjustment(10, [1, 3, 4], {}, 'fire')).toBe(10);
    });

    it('returns rawDamage when no ones are in the rolls', () => {
        hasMinDamage.mockReturnValue(true);
        expect(applyMinDamageAdjustment(10, [2, 3, 4], {}, 'fire')).toBe(10);
    });

    it('adds count of ones to rawDamage when both checks pass', () => {
        hasMinDamage.mockReturnValue(true);
        expect(applyMinDamageAdjustment(10, [1, 3, 1, 5], {}, 'fire')).toBe(12);
    });

    it('handles different damage types', () => {
        hasMinDamage.mockReturnValue(true);
        expect(applyMinDamageAdjustment(5, [1, 1, 4], {}, 'lightning')).toBe(7);
        expect(applyMinDamageAdjustment(5, [2, 3, 4], {}, 'cold')).toBe(5);
    });
});
