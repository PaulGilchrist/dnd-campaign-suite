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

    it('returns null when campaignName or overlayId is empty', async () => {
        expect(await readAoeContext('', 'aoe-1')).toBeNull();
        expect(await readAoeContext('test-campaign', '')).toBeNull();
    });

    it('returns overlay context when all fetches succeed', async () => {
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

    it('returns null on any failure (fetch error, missing overlay, missing map, bad response)', async () => {
        // fetch returns non-ok
        globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false }));
        expect(await readAoeContext('test-campaign', 'aoe-1')).toBeNull();

        // overlay not found
        globalThis.fetch = vi.fn((url) => {
            if (url.includes('spell-overlay')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ overlays: [] }) });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockActiveMap) });
        });
        expect(await readAoeContext('test-campaign', 'aoe-1')).toBeNull();

        // active map missing
        globalThis.fetch = vi.fn((url) => {
            if (url.includes('spell-overlay')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOverlayData) });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });
        expect(await readAoeContext('test-campaign', 'aoe-1')).toBeNull();

        // loadMapData returns null
        globalThis.fetch = vi.fn((url) => {
            if (url.includes('spell-overlay')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(mockOverlayData) });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockActiveMap) });
        });
        loadMapData.mockResolvedValue(null);
        expect(await readAoeContext('test-campaign', 'aoe-1')).toBeNull();

        // network error
        globalThis.fetch = vi.fn(() => Promise.reject(new Error('network failure')));
        expect(await readAoeContext('test-campaign', 'aoe-1')).toBeNull();
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

    it('returns false for null/undefined inputs or missing automation/passives', () => {
        expect(hasPotentCantrip(null)).toBe(false);
        expect(hasPotentCantrip(undefined)).toBe(false);
        expect(hasPotentCantrip({})).toBe(false);
        expect(hasPotentCantrip({ automation: {} })).toBe(false);
        expect(hasPotentCantrip({ automation: null })).toBe(false);
        expect(hasPotentCantrip({ automation: { passives: [] } })).toBe(false);
    });
});

describe('getShieldAcBonus', () => {
    const characterName = 'TestCharacter';
    const campaignName = 'test-campaign';

    it('returns 5 AC bonus when shield buff is active, 2 when shield_of_faith is active, 0 otherwise', () => {
        expect(getShieldAcBonus(characterName, campaignName)).toBe(0);
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);
        expect(getShieldAcBonus(characterName, campaignName)).toBe(5);
        getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
        expect(getShieldAcBonus(characterName, campaignName)).toBe(0);
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }, { effect: 'shield_of_faith' }]);
        expect(getShieldAcBonus(characterName, campaignName)).toBe(5);
        getRuntimeValue.mockReturnValue(null);
        expect(getShieldAcBonus(characterName, campaignName)).toBe(0);
        getRuntimeValue.mockReturnValue('not-an-array');
        expect(getShieldAcBonus(characterName, campaignName)).toBe(0);
    });

    it('returns 2 AC bonus when shield_of_faith buff is active, 0 otherwise', () => {
        getRuntimeValue.mockReturnValue([]);
        expect(getShieldOfFaithAcBonus(characterName, campaignName)).toBe(0);
        getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
        expect(getShieldOfFaithAcBonus(characterName, campaignName)).toBe(2);
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);
        expect(getShieldOfFaithAcBonus(characterName, campaignName)).toBe(0);
        getRuntimeValue.mockReturnValue(null);
        expect(getShieldOfFaithAcBonus(characterName, campaignName)).toBe(0);
        getRuntimeValue.mockReturnValue(42);
        expect(getShieldOfFaithAcBonus(characterName, campaignName)).toBe(0);
    });

    it('returns true when shield buff grants immunity, false otherwise', () => {
        getRuntimeValue.mockReturnValue([]);
        expect(isMagicMissileImmune(characterName, campaignName)).toBe(false);
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);
        expect(isMagicMissileImmune(characterName, campaignName)).toBe(true);
        getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
        expect(isMagicMissileImmune(characterName, campaignName)).toBe(false);
        getRuntimeValue.mockReturnValue(null);
        expect(isMagicMissileImmune(characterName, campaignName)).toBe(false);
        getRuntimeValue.mockReturnValue('not-an-array');
        expect(isMagicMissileImmune(characterName, campaignName)).toBe(false);
    });
});

describe('getSoulstitchProtectedCreatures', () => {
    const playerName = 'PlayerName';
    const campaignName = 'test-campaign';

    it('returns the stored array when valid, empty array otherwise', () => {
        getRuntimeValue.mockReturnValue(['CreatureA', 'CreatureB']);
        expect(getSoulstitchProtectedCreatures(playerName, campaignName)).toEqual(['CreatureA', 'CreatureB']);
        getRuntimeValue.mockReturnValue(null);
        expect(getSoulstitchProtectedCreatures(playerName, campaignName)).toEqual([]);
        getRuntimeValue.mockReturnValue('not-an-array');
        expect(getSoulstitchProtectedCreatures(playerName, campaignName)).toEqual([]);
    });
});

describe('hasSoulstitchProtection', () => {
    const campaignName = 'test-campaign';

    it('returns true when target is in the protected list, false otherwise', () => {
        getRuntimeValue.mockReturnValue(['Goblin', 'Orc']);
        expect(hasSoulstitchProtection('Goblin', 'PlayerName', campaignName)).toBe(true);
        expect(hasSoulstitchProtection('Troll', 'PlayerName', campaignName)).toBe(false);
        getRuntimeValue.mockReturnValue([]);
        expect(hasSoulstitchProtection('Goblin', 'PlayerName', campaignName)).toBe(false);
    });
});

describe('applyMinDamageAdjustment', () => {
    it('returns rawDamage for null/undefined/invalid inputs or when hasMinDamage fails', () => {
        expect(applyMinDamageAdjustment(10, [3, 4], null, 'fire')).toBe(10);
        expect(applyMinDamageAdjustment(10, [3, 4], {}, '')).toBe(10);
        expect(applyMinDamageAdjustment(10, null, {}, 'fire')).toBe(10);
        expect(applyMinDamageAdjustment(10, 'not-array', {}, 'fire')).toBe(10);
        expect(applyMinDamageAdjustment(10, [], {}, 'fire')).toBe(10);
        hasMinDamage.mockReturnValue(false);
        expect(applyMinDamageAdjustment(10, [1, 3, 4], {}, 'fire')).toBe(10);
    });

    it('adds count of ones to rawDamage when both checks pass', () => {
        hasMinDamage.mockReturnValue(true);
        expect(applyMinDamageAdjustment(10, [1, 3, 1, 5], {}, 'fire')).toBe(12);
        expect(applyMinDamageAdjustment(5, [1, 1, 4], {}, 'lightning')).toBe(7);
    });

    it('returns rawDamage when hasMinDamage passes but no ones in rolls', () => {
        hasMinDamage.mockReturnValue(true);
        expect(applyMinDamageAdjustment(10, [2, 3, 4], {}, 'fire')).toBe(10);
        expect(applyMinDamageAdjustment(5, [2, 3, 4], {}, 'cold')).toBe(5);
    });
});
