// @maintained-by-ai: 2026-10-14
// Core unit lane for loggedDiceRollUtils.js — the only place these getter
// implementations run unmocked (every useLoggedDiceRollAttack/Damage wrapper
// lane mocks this module and tests only its own consumption seam).
// Owned here: dispatchUnbreakableMajestySave, readAoeContext, hasPotentCantrip,
// the activeBuffs AC getters (shield / shield_of_faith / parry / guardian_protection),
// isMagicMissileImmune, the soulstitch stamp trio, applyMinDamageAdjustment.
// NOT owned here (dedicated producer-side lanes): getWardingBondAcBonus,
// getSlowAcPenalty, getBaitAndSwitchAcBonus — see the .warding-bond / .slow /
// .bait-and-switch siblings; don't re-test them here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasMinDamage: vi.fn(),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

import { sendSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { hasMinDamage } from '../../services/combat/automation/automationService.js';
import { loadMapData } from '../../services/maps/mapsService.js';
import {
    dispatchUnbreakableMajestySave,
    readAoeContext,
    hasPotentCantrip,
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    getParryAcBonus,
    getGuardianProtectionAcBonus,
    isMagicMissileImmune,
    soulstitchStampKey,
    getSoulstitchProtectedCreatures,
    hasSoulstitchProtection,
    clearSoulstitchStamp,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';

const campaign = 'test-campaign';
const okJson = (body) => ({ ok: true, json: () => Promise.resolve(body) });

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('dispatchUnbreakableMajestySave', () => {
    // 2024 classes.json Unbreakable Majesty lv14: attacker makes a Charisma
    // save vs the defender's spell save DC or the hit becomes a miss.
    it('sends a CHA save prompt from defender to attacker with the given DC', () => {
        dispatchUnbreakableMajestySave(campaign, 'Defender', 'Attacker', 15, 'prompt-1');
        expect(sendSavePrompt).toHaveBeenCalledWith(campaign, {
            promptId: 'prompt-1',
            targetName: 'Attacker',
            saveType: 'CHA',
            saveDc: 15,
            sourceName: 'Defender',
        });
    });
});

describe('readAoeContext', () => {
    const overlay = { id: 'aoe-1', name: 'Fireball' };

    it('assembles overlay + map players/npcs when every hop succeeds', async () => {
        fetch.mockImplementation((url) => {
            if (url.includes('spell-overlay')) return Promise.resolve(okJson({ overlays: [overlay] }));
            return Promise.resolve(okJson({ activeMapName: 'dungeon-1' }));
        });
        loadMapData.mockResolvedValue({ players: ['A'], placedItems: ['torch'] });

        expect(await readAoeContext(campaign, 'aoe-1')).toEqual({
            overlay,
            players: ['A'],
            npcs: ['torch'],
        });
        expect(fetch).toHaveBeenCalledWith(`/spell-overlay?campaign=${campaign}`);
        expect(fetch).toHaveBeenCalledWith(`/api/campaigns/${campaign}/active-map`);
        expect(loadMapData).toHaveBeenCalledWith(campaign, 'dungeon-1');
    });

    it('returns null on every failure path — missing args, non-ok, missing overlay/map, network error', async () => {
        // Missing args short-circuit before any fetch.
        expect(await readAoeContext('', 'aoe-1')).toBeNull();
        expect(await readAoeContext(campaign, '')).toBeNull();
        expect(fetch).not.toHaveBeenCalled();

        // Overlay fetch non-ok → stops before the active-map fetch.
        fetch.mockImplementation(() => Promise.resolve({ ok: false }));
        expect(await readAoeContext(campaign, 'aoe-1')).toBeNull();
        expect(fetch).toHaveBeenCalledTimes(1);
        fetch.mockClear();

        // Overlay id not present in the overlay list.
        fetch.mockImplementation((url) => Promise.resolve(
            okJson(url.includes('spell-overlay') ? { overlays: [] } : { activeMapName: 'dungeon-1' })
        ));
        expect(await readAoeContext(campaign, 'aoe-1')).toBeNull();

        // No active map selected.
        fetch.mockImplementation((url) => Promise.resolve(
            okJson(url.includes('spell-overlay') ? { overlays: [overlay] } : {})
        ));
        expect(await readAoeContext(campaign, 'aoe-1')).toBeNull();

        // Map data unavailable.
        fetch.mockImplementation((url) => Promise.resolve(
            okJson(url.includes('spell-overlay') ? { overlays: [overlay] } : { activeMapName: 'dungeon-1' })
        ));
        loadMapData.mockResolvedValue(null);
        expect(await readAoeContext(campaign, 'aoe-1')).toBeNull();

        // Network error is caught, not thrown.
        fetch.mockRejectedValue(new Error('network failure'));
        expect(await readAoeContext(campaign, 'aoe-1')).toBeNull();
    });
});

describe('hasPotentCantrip', () => {
    it('detects the potent_cantrip passive and tolerates missing automation data', () => {
        expect(hasPotentCantrip({ automation: { passives: [{ type: 'potent_cantrip' }] } })).toBe(true);
        expect(hasPotentCantrip({ automation: { passives: [{ type: 'other_passive' }] } })).toBe(false);
        for (const shape of [null, undefined, {}, { automation: {} }, { automation: null }, { automation: { passives: [] } }]) {
            expect(hasPotentCantrip(shape)).toBe(false);
        }
    });
});

describe('activeBuffs AC getters', () => {
    // Each getter reads the defender's activeBuffs and claims ONLY its own
    // effect stamp (spells.json / monsters.json automation).
    const acGetters = [
        { effect: 'shield', getter: getShieldAcBonus, bonus: 5 },
        { effect: 'shield_of_faith', getter: getShieldOfFaithAcBonus, bonus: 2 },
        // MA-0341 Bandit Captain Parry (+2) and MA-1463 Shield Guardian
        // Protection (+5) ride the stamped acBonus, not a hardcoded value.
        { effect: 'parry', getter: getParryAcBonus, bonus: 2, stamped: true },
        { effect: 'guardian_protection', getter: getGuardianProtectionAcBonus, bonus: 5, stamped: true },
    ];

    it('returns each bonus only for its own effect stamp and 0 for every other shape', () => {
        for (const { effect, getter, bonus, stamped } of acGetters) {
            const stamp = stamped ? { effect, acBonus: bonus } : { effect };
            // Foreign buffs (other getters' stamps, even with an acBonus) never leak.
            const foreign = acGetters
                .filter((a) => a.effect !== effect)
                .map((a) => (a.stamped ? { effect: a.effect, acBonus: a.bonus } : { effect: a.effect }));
            getRuntimeValue.mockReturnValue([]);
            expect(getter('TestCharacter', campaign)).toBe(0);
            getRuntimeValue.mockReturnValue(foreign);
            expect(getter('TestCharacter', campaign)).toBe(0);
            // Stamped getters ignore their own effect when the acBonus is missing.
            if (stamped) {
                getRuntimeValue.mockReturnValue([{ effect }]);
                expect(getter('TestCharacter', campaign)).toBe(0);
            }
            getRuntimeValue.mockReturnValue([stamp]);
            expect(getter('TestCharacter', campaign)).toBe(bonus);
            expect(getRuntimeValue).toHaveBeenLastCalledWith('TestCharacter', 'activeBuffs', campaign);

            // Unusable store values fall back to no bonus.
            getRuntimeValue.mockReturnValue(null);
            expect(getter('TestCharacter', campaign)).toBe(0);
            getRuntimeValue.mockReturnValue('not-an-array');
            expect(getter('TestCharacter', campaign)).toBe(0);
            getRuntimeValue.mockClear();
        }
    });

    // spells.json "shield": "you take no damage from magic missile".
    it('isMagicMissileImmune is true only while a shield stamp is active', () => {
        expect(isMagicMissileImmune('TestCharacter', campaign)).toBe(false);
        getRuntimeValue.mockReturnValue([{ effect: 'shield' }]);
        expect(isMagicMissileImmune('TestCharacter', campaign)).toBe(true);
        getRuntimeValue.mockReturnValue([{ effect: 'shield_of_faith' }]);
        expect(isMagicMissileImmune('TestCharacter', campaign)).toBe(false);
        getRuntimeValue.mockReturnValue('not-an-array');
        expect(isMagicMissileImmune('TestCharacter', campaign)).toBe(false);
    });
});

describe('soulstitch stamp', () => {
    const playerName = 'Test Wizard';
    // Key format mirrors the producer contract in aoeService.js.
    it('stamps the protected list under the space-normalized player key and passes arrays through', () => {
        expect(soulstitchStampKey(playerName)).toBe('_Test_Wizard_Soulstitch_Spells_active');

        getRuntimeValue.mockReturnValue(['CreatureA', 'CreatureB']);
        expect(getSoulstitchProtectedCreatures(playerName, campaign)).toEqual(['CreatureA', 'CreatureB']);
        expect(getRuntimeValue).toHaveBeenCalledWith(playerName, '_Test_Wizard_Soulstitch_Spells_active', campaign);

        for (const junk of [null, 'not-an-array']) {
            getRuntimeValue.mockReturnValue(junk);
            expect(getSoulstitchProtectedCreatures(playerName, campaign)).toEqual([]);
        }
    });

    it('hasSoulstitchProtection reports membership of the protected list', () => {
        getRuntimeValue.mockReturnValue(['Goblin', 'Orc']);
        expect(hasSoulstitchProtection('Goblin', playerName, campaign)).toBe(true);
        expect(hasSoulstitchProtection('Troll', playerName, campaign)).toBe(false);
        getRuntimeValue.mockReturnValue([]);
        expect(hasSoulstitchProtection('Goblin', playerName, campaign)).toBe(false);
    });

    // CLA-321: per-cast consumption — clear once, no-op when already empty.
    it('clearSoulstitchStamp writes an empty list once and skips the write when empty', () => {
        getRuntimeValue.mockReturnValue(['Goblin']);
        clearSoulstitchStamp(playerName, campaign);
        expect(setRuntimeValue).toHaveBeenCalledWith(playerName, '_Test_Wizard_Soulstitch_Spells_active', [], campaign);

        setRuntimeValue.mockClear();
        getRuntimeValue.mockReturnValue([]);
        clearSoulstitchStamp(playerName, campaign);
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});

describe('applyMinDamageAdjustment', () => {
    it('returns rawDamage unchanged when inputs are invalid or hasMinDamage does not apply', () => {
        for (const args of [
            [10, [3, 4], null, 'fire'],
            [10, [3, 4], {}, ''],
            [10, null, {}, 'fire'],
            [10, 'not-array', {}, 'fire'],
            [10, [], {}, 'fire'],
        ]) {
            expect(applyMinDamageAdjustment(...args)).toBe(args[0]);
        }
        hasMinDamage.mockReturnValue(false);
        expect(applyMinDamageAdjustment(10, [1, 3, 4], {}, 'fire')).toBe(10);
    });

    it('adds one point per rolled 1 when the feature applies, rawDamage when no ones', () => {
        hasMinDamage.mockReturnValue(true);
        const playerStats = { automation: {} };
        expect(applyMinDamageAdjustment(10, [1, 3, 1, 5], playerStats, 'fire')).toBe(12);
        expect(hasMinDamage).toHaveBeenCalledWith(playerStats, 'fire');
        expect(applyMinDamageAdjustment(5, [2, 3, 4], playerStats, 'cold')).toBe(5);
    });
});
