// CLA-118 regression: the sheet Speed line must fold in the Elfish Lineage
// ladder grant (Wood Elf speedBonus 5 from races.json) — race JSON alone
// renders Wood Elf at 30 ft.
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

const elfishRow = {
    type: 'elfish_lineage',
    options: [
        { name: 'Drow', spellcastingAbility: 'CHA', cantrip: 'Dancing Lights', darkvisionRange: '120' },
        { name: 'High Elf', spellcastingAbility: 'INT', cantrip: 'Prestidigitation', wizardCantripSwap: true },
        { name: 'Wood Elf', spellcastingAbility: 'WIS', cantrip: 'Druidcraft', speedBonus: 5 },
    ],
};

const elfStats = (subraceName, overrides = {}) => ({
    name: 'ElfTest',
    level: 1,
    rules: '2024',
    race: { name: 'Elf', speed: 30, subrace: { name: subraceName } },
    class: { name: 'Fighter' },
    abilities: [{ name: 'Dexterity', bonus: 2 }],
    inventory: { equipped: [] },
    equipment: [],
    automation: { passives: [], specialActions: [elfishRow] },
    immunities: [],
    resistances: [],
    ...overrides,
});

const ctxFor = (playerStats) => computeCharSummaryContext({
    playerStats, campaignName, characters: [], conditionEffects: {}, auraComboEffects: {}, exhaustionLevel: 0,
});

describe('charSummaryCalc — CLA-118 Elfish Lineage speed lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('shows Wood Elf at 35 ft via the subrace channel with no runtime key', () => {
        expect(ctxFor(elfStats('Wood Elf')).totalSpeedWithBuff).toBe(35);
    });

    it('shows Wood Elf at 35 ft when the runtime chooser selection is the only channel', () => {
        getRuntimeValue.mockImplementation((name, key) => (key === '_elfishLineageSelection' ? 'Wood Elf' : null));
        const stats = elfStats(undefined);
        delete stats.race.subrace;
        expect(ctxFor(stats).totalSpeedWithBuff).toBe(35);
    });

    it('keeps Drow at 30 ft even when a stale runtime key says Wood Elf', () => {
        getRuntimeValue.mockImplementation((name, key) => (key === '_elfishLineageSelection' ? 'Wood Elf' : null));
        expect(ctxFor(elfStats('Drow')).totalSpeedWithBuff).toBe(30);
    });

    it('leaves non-elven subrace JSON speeds untouched', () => {
        const stats = elfStats('Wood Elf');
        stats.race = { name: 'Dwarf', speed: 25, subrace: { name: 'Hill Dwarf', speed: 25 } };
        expect(ctxFor(stats).totalSpeedWithBuff).toBe(25);
    });
});
