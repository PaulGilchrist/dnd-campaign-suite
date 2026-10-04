// @improved-by-ai
// FT-105 regression: the Charger (Improved Dash) speed_boost stamp written by
// buffHandler.handleDashSpeedBonus (CLA-067 shape) must fold into the
// displayed Speed via charSummaryCalc's buffEffectHandlers ['speed_boost'].
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

describe('charSummaryCalc — FT-105 Charger Improved Dash speed_boost fold', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('displays base 30 ft with no dash stamp', () => {
        getRuntimeValue.mockImplementation((name, key) => (key === 'activeBuffs' ? [] : null));
        const ctx = computeCharSummaryContext({
            playerStats: baseStats, campaignName, characters: [], conditionEffects: {}, auraComboEffects: {}, exhaustionLevel: 0,
        });
        expect(ctx.totalSpeedWithBuff).toBe(30);
        expect(ctx.buffSpeedBonus).toBe(0);
    });

    it('folds the speed_boost stamp into displayed Speed (30 → 40)', () => {
        getRuntimeValue.mockImplementation((name, key) => (
            key === 'activeBuffs'
                ? [{ name: 'Improved Dash', effect: 'speed_boost', speedBonus: 10, duration: 'same_action' }]
                : null
        ));
        const ctx = computeCharSummaryContext({
            playerStats: baseStats, campaignName, characters: [], conditionEffects: {}, auraComboEffects: {}, exhaustionLevel: 0,
        });
        expect(ctx.buffSpeedBonus).toBe(10);
        expect(ctx.totalSpeedWithBuff).toBe(40);
    });

    it('does NOT fold the old pre-fix unconsumed shape (regression guard)', () => {
        getRuntimeValue.mockImplementation((name, key) => (
            key === 'activeBuffs'
                ? [{ name: 'Improved Dash', tempBuff: true, speedBonus: 10, duration: 'same_action' }]
                : null
        ));
        const ctx = computeCharSummaryContext({
            playerStats: baseStats, campaignName, characters: [], conditionEffects: {}, auraComboEffects: {}, exhaustionLevel: 0,
        });
        expect(ctx.buffSpeedBonus).toBe(0);
        expect(ctx.totalSpeedWithBuff).toBe(30);
    });
});
