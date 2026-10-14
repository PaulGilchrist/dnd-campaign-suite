// @maintained-by-ai
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

    it.each([
        ['the runtime lane', buffs => seedRuntimeBuffs(buffs)],
        // FT-105 dashes must fold via whichever lane carries the stamp
        // (buffStore-vs-runtime divergence seen live), and a stamp present
        // on BOTH lanes must fold exactly once, not double.
        ['the buffService lane when runtime is empty', buffs => getActiveBuffs.mockReturnValue(buffs)],
        ['both lanes at once', buffs => { seedRuntimeBuffs(buffs); getActiveBuffs.mockReturnValue(buffs); }],
    ])('folds one CLA-067 speed_boost stamp on %s into displayed Speed (30 → 40)', (_lane, seed) => {
        seed([dashStamp()]);
        const ctx = ctxFor();
        expect(ctx.buffSpeedBonus).toBe(10);
        expect(ctx.totalSpeedWithBuff).toBe(40);
    });

    it.each([
        ['the old pre-fix unconsumed tempBuff shape', { name: 'Improved Dash', tempBuff: true, speedBonus: 10, duration: 'same_action' }],
        ['a malformed speed_boost stamp missing speedBonus', { name: 'Improved Dash', effect: 'speed_boost', duration: 'same_action' }],
    ])('ignores %s — speed stays a clean 30 ft (never folded, never NaN)', (_shape, buff) => {
        seedRuntimeBuffs([buff]);
        const ctx = ctxFor();
        expect(ctx.buffSpeedBonus).toBe(0);
        expect(ctx.totalSpeedWithBuff).toBe(30);
    });

    it('stacks multiple speed_boost stamps additively (Charger dash + Longstrider)', () => {
        seedRuntimeBuffs([
            dashStamp(10),
            { name: 'Longstrider', effect: 'speed_boost', speedBonus: 10, duration: 'concentration' },
        ]);
        const ctx = ctxFor();
        expect(ctx.buffSpeedBonus).toBe(20);
        expect(ctx.totalSpeedWithBuff).toBe(50);
    });
});
