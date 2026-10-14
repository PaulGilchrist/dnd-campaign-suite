// @improved-by-ai
// FT-105 regression: the Charger (Improved Dash) speed_boost stamp written by
// buffHandler.handleDashSpeedBonus (CLA-067 shape) must fold into the
// displayed Speed via charSummaryCalc's buffEffectHandlers ['speed_boost'].
//
// Calc seam only: the stamp-WRITING behavior (upgrade from the old tempBuff
// shape, once-per-turn latch, refusal logs) is covered by
// buffHandler.basic-effects.test.js — these tests pin what the SPEED LINE
// computes once the stamps are in the store.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/rules/rulesFactory.js', () => ({
    default: {
        getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 0) } })),
    },
    getRules: vi.fn(() => ({ classRules: { getUnarmoredMovementIncrease: vi.fn(() => 0) } })),
}));

vi.mock('../../../services/rules/core/attackCalc.js', () => ({
    parseMagicItemName: (name) => ({ baseName: name }),
}));

vi.mock('../../../services/automation/handlers/buffs/protectionFromEnergyHandler.js', () => ({
    getProtectionFromEnergyDamageType: vi.fn(() => null),
}));

vi.mock('../../../services/automation/handlers/buffs/resistanceHandler.js', () => ({
    getResistanceDamageType: vi.fn(() => null),
}));

vi.mock('../../../services/automation/handlers/buffs/stoneSkinHandler.js', () => ({
    getStoneSkinDamageTypes: vi.fn(() => []),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

import { computeCharSummaryContext } from './charSummaryCalc.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';

const campaignName = 'test-campaign';

const baseStats = {
    name: 'EvasiveFighter',
    level: 18,
    rules: '2024',
    race: { name: 'Human', speed: 30 },
    class: { name: 'Fighter' },
    abilities: [{ name: 'Dexterity', bonus: 2 }],
    inventory: { equipped: [] },
    equipment: [],
    automation: { passives: [] },
    immunities: [],
    resistances: [],
};

const ctxFor = (playerStats = baseStats) => computeCharSummaryContext({
    playerStats, campaignName, characters: [], conditionEffects: {}, auraComboEffects: {}, exhaustionLevel: 0,
});

// Seed only the runtime activeBuffs lane; every other runtime key reads null.
const seedRuntimeBuffs = (buffs) => {
    getRuntimeValue.mockImplementation((name, key) => (key === 'activeBuffs' ? buffs : null));
};

// The exact CLA-067 shape handleDashSpeedBonus persists (buffHandler.js:370).
const dashStamp = (speedBonus = 10) => ({
    name: 'Improved Dash', effect: 'speed_boost', speedBonus, duration: 'same_action',
});

describe('charSummaryCalc — FT-105 Charger Improved Dash speed_boost fold', () => {
    beforeEach(() => {
        // mockReturnValue replaces any per-test mockImplementation, so each
        // test starts from a clean, empty store on BOTH buff supply lanes.
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        getActiveBuffs.mockReturnValue([]);
    });

    it('displays base 30 ft with no dash stamp', () => {
        const ctx = ctxFor();
        expect(ctx.totalSpeedWithBuff).toBe(30);
        expect(ctx.buffSpeedBonus).toBe(0);
    });

    it('folds the CLA-067 speed_boost stamp into displayed Speed (30 → 40)', () => {
        seedRuntimeBuffs([dashStamp()]);
        const ctx = ctxFor();
        expect(ctx.buffSpeedBonus).toBe(10);
        expect(ctx.totalSpeedWithBuff).toBe(40);
    });

    it('does NOT fold the old pre-fix unconsumed tempBuff shape (regression guard)', () => {
        seedRuntimeBuffs([{ name: 'Improved Dash', tempBuff: true, speedBonus: 10, duration: 'same_action' }]);
        const ctx = ctxFor();
        expect(ctx.buffSpeedBonus).toBe(0);
        expect(ctx.totalSpeedWithBuff).toBe(30);
    });

    it('folds a speed_boost arriving on the buffService lane when the runtime lane is empty', () => {
        // computeCharSummaryContext prefers runtime activeBuffs and falls back
        // to buffService — FT-105 dashes must fold via whichever lane carries
        // the stamp (buffStore-vs-runtime divergence seen live).
        getActiveBuffs.mockReturnValue([dashStamp()]);
        const ctx = ctxFor();
        expect(ctx.buffSpeedBonus).toBe(10);
        expect(ctx.totalSpeedWithBuff).toBe(40);
    });

    it('stacks multiple speed_boost stamps additively (Charger + Longstrider)', () => {
        seedRuntimeBuffs([
            dashStamp(10),
            { name: 'Longstrider', effect: 'speed_boost', speedBonus: 10, duration: 'concentration' },
        ]);
        const ctx = ctxFor();
        expect(ctx.buffSpeedBonus).toBe(20);
        expect(ctx.totalSpeedWithBuff).toBe(50);
    });

    it('never leaks NaN into the speed line when a speed_boost stamp is missing speedBonus', () => {
        seedRuntimeBuffs([{ name: 'Improved Dash', effect: 'speed_boost', duration: 'same_action' }]);
        const ctx = ctxFor();
        expect(ctx.buffSpeedBonus).toBe(0);
        expect(ctx.totalSpeedWithBuff).toBe(30);
    });
});
