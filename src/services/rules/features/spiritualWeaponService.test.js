// SP-112: Spiritual Weapon force record + duration clock + later-turn move/attack.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../effects/expirations.js', () => ({
    addExpiration: vi.fn(),
    KEY: 'pendingExpirations',
}));
vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn().mockResolvedValue(null),
}));
vi.mock('../combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

import {
    activateSpiritualWeaponForce,
    getSpiritualWeaponForce,
    buildSpiritualWeaponForceAttack,
    resolveSpiritualWeaponMoveAndAttack,
} from './spiritualWeaponService.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../effects/expirations.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { isWithinRange } from '../combat/rangeCheck.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { addEntry } from '../../ui/logService.js';

const campaignName = 'test-campaign';
const playerStats = {
    name: 'Divine_Cleric',
    level: 17,
    proficiency: 6,
    spellAbilities: { toHit: 9, saveDc: 17, modifier: 3, spellCastingAbility: 'Wisdom' },
    abilities: [{ name: 'Wisdom', bonus: 3 }],
};
const spell2024 = {
    index: 'spiritual-weapon',
    name: 'Spiritual Weapon',
    level: 2,
    school: 'Evocation',
    concentration: true,
    duration: 'Concentration, up to 1 minute',
    damage: { damage_type: 'Force', damage_at_slot_level: { 2: '1d8 + 3' } },
};

function buffStore(force) {
    getRuntimeValue.mockImplementation((key, prop) => {
        if (prop === 'activeBuffs') return force ? [force] : [];
        return null;
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    getCombatContext.mockResolvedValue(null);
    isWithinRange.mockResolvedValue(true);
    getCurrentCombatRound.mockReturnValue(1);
});

describe('activateSpiritualWeaponForce', () => {
    it('writes a spiritual_weapon_force buff with exact Force 1d8 + 3 and registers a 10-round clock', async () => {
        const buff = await activateSpiritualWeaponForce(spell2024, playerStats, campaignName, { slotLevel: 2, formula: '1d8 + 3' });

        expect(buff.effect).toBe('spiritual_weapon_force');
        expect(buff.damageFormula).toBe('1d8 + 3');
        expect(buff.damageType).toBe('Force');
        expect(buff.concentration).toBe(true);
        expect(buff.moveRangeFt).toBe(20);
        expect(buff.attackRangeFt).toBe(5);
        expect(buff.appearsRangeFt).toBe(60);

        expect(setRuntimeValue).toHaveBeenCalledWith('Divine_Cleric', 'activeBuffs', expect.arrayContaining([expect.objectContaining({ effect: 'spiritual_weapon_force' })]), campaignName);
        // CLA-334 rounds recipe: 1 minute = 10 rounds remove_active_buff.
        expect(addExpiration).toHaveBeenCalledWith('Divine_Cleric', 'Divine_Cleric', [{ type: 'remove_active_buff', buffName: 'Spiritual Weapon' }], campaignName, 10);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({ type: 'summons' }));
    });

    it('drops the prior queued expiry before re-arming (recast-safe)', async () => {
        getRuntimeValue.mockImplementation((key, prop) => {
            if (prop === 'pendingExpirations') return [{ target: 'Divine_Cleric', effects: [{ type: 'remove_active_buff', buffName: 'Spiritual Weapon' }], expiryRounds: 10 }];
            if (prop === 'activeBuffs') return [];
            return null;
        });
        await activateSpiritualWeaponForce(spell2024, playerStats, campaignName, { slotLevel: 2, formula: '1d8 + 3' });
        expect(setRuntimeValue).toHaveBeenCalledWith('Divine_Cleric', 'pendingExpirations', [], campaignName);
    });
});

describe('getSpiritualWeaponForce', () => {
    it('returns null when no force active', () => {
        buffStore(null);
        expect(getSpiritualWeaponForce(playerStats, campaignName)).toBeNull();
    });

    it('returns the force buff', () => {
        const f = { name: 'Spiritual Weapon', effect: 'spiritual_weapon_force', damageFormula: '1d8 + 3' };
        buffStore(f);
        expect(getSpiritualWeaponForce(playerStats, campaignName)).toBe(f);
    });
});

describe('buildSpiritualWeaponForceAttack', () => {
    it('builds a force-only Force spell attack with the spell attack bonus, weaponType/attackType spell', () => {
        const atk = buildSpiritualWeaponForceAttack(playerStats, { damageFormula: '1d8 + 3' });
        expect(atk.attackType).toBe('spell');
        expect(atk.school).toBe('Evocation');
        expect(atk.hitBonus).toBe(9);
        expect(atk.damageType).toBe('Force');
        expect(atk.autoDamageFormula).toBe('1d8 + 3');
        expect(atk.autoDamageFormula).not.toContain('radiant');
        expect(atk.actionType).toBe('Bonus Action');
    });
});

describe('resolveSpiritualWeaponMoveAndAttack', () => {
    it('refuses with spiritual_weapon_refused when no force active', async () => {
        buffStore(null);
        const res = await resolveSpiritualWeaponMoveAndAttack(playerStats, campaignName);
        expect(res.refused).toBe(true);
    });

    it('refuses on the activation round (later turns only)', async () => {
        buffStore({ name: 'Spiritual Weapon', effect: 'spiritual_weapon_force', damageFormula: '1d8 + 3', activatedRound: 1 });
        getCurrentCombatRound.mockReturnValue(1);
        const res = await resolveSpiritualWeaponMoveAndAttack(playerStats, campaignName);
        expect(res.refused).toBe(true);
    });

    it('refuses when no target armed', async () => {
        buffStore({ name: 'Spiritual Weapon', effect: 'spiritual_weapon_force', damageFormula: '1d8 + 3', activatedRound: 1 });
        getCombatContext.mockResolvedValue({ creatures: [{ name: 'Divine_Cleric', targetName: null }] });
        const res = await resolveSpiritualWeaponMoveAndAttack(playerStats, campaignName);
        expect(res.refused).toBe(true);
    });

    it('honors the 5ft-from-force gate via isWithinRange and refuses when out of range', async () => {
        buffStore({ name: 'Spiritual Weapon', effect: 'spiritual_weapon_force', damageFormula: '1d8 + 3', attackRangeFt: 5, forceMarkerName: 'Spiritual Weapon (Divine_Cleric)', activatedRound: 1 });
        getCombatContext.mockResolvedValue({ creatures: [{ name: 'Divine_Cleric', targetName: 'Thug 1' }, { name: 'Thug 1', currentHp: 32 }] });
        isWithinRange.mockResolvedValue(false);
        const res = await resolveSpiritualWeaponMoveAndAttack(playerStats, campaignName);
        expect(res.refused).toBe(true);
        expect(isWithinRange).toHaveBeenCalledWith('Thug 1', 'Spiritual Weapon (Divine_Cleric)', 5);
    });

    it('resolves a move & repeat attack on a later turn (gridless lenient), logging the 20ft move', async () => {
        buffStore({ name: 'Spiritual Weapon', effect: 'spiritual_weapon_force', damageFormula: '1d8 + 3', attackRangeFt: 5, moveRangeFt: 20, forceMarkerName: 'Spiritual Weapon (Divine_Cleric)', activatedRound: 1 });
        getCombatContext.mockResolvedValue({ creatures: [{ name: 'Divine_Cleric', targetName: 'Thug 1' }, { name: 'Thug 1', currentHp: 32 }] });
        isWithinRange.mockResolvedValue(true);
        getCurrentCombatRound.mockReturnValue(2);

        const res = await resolveSpiritualWeaponMoveAndAttack(playerStats, campaignName);
        expect(res.refused).toBeUndefined();
        expect(res.attack.attackType).toBe('spell');
        expect(res.attack.damageType).toBe('Force');
        expect(res.attack.hitBonus).toBe(9);
        expect(res.targetName).toBe('Thug 1');
        expect(isWithinRange).toHaveBeenCalledWith('Thug 1', 'Spiritual Weapon (Divine_Cleric)', 5);
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({ type: 'ability_use' }));
    });

    it('refuses twice in the same round', async () => {
        buffStore({ name: 'Spiritual Weapon', effect: 'spiritual_weapon_force', damageFormula: '1d8 + 3', attackRangeFt: 5, forceMarkerName: 'Spiritual Weapon (Divine_Cleric)', activatedRound: 1, lastMoveRound: 2 });
        getCombatContext.mockResolvedValue({ creatures: [{ name: 'Divine_Cleric', targetName: 'Thug 1' }, { name: 'Thug 1', currentHp: 32 }] });
        getCurrentCombatRound.mockReturnValue(2);
        const res = await resolveSpiritualWeaponMoveAndAttack(playerStats, campaignName);
        expect(res.refused).toBe(true);
    });
});
