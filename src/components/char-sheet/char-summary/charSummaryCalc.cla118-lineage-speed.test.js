// @improved-by-ai
// CLA-118 regression: the sheet Speed line must fold in the Elfish Lineage
// ladder grant (Wood Elf speedBonus 5 from races.json) — race JSON alone
// renders Wood Elf at 30 ft.
//
// Sheet seam only: handler-unit behavior (resolveElfishLineage precedence,
// option lookups, missing-speedBonus logging) is covered by
// elfishLineageHandler.test.js — these tests pin what the SPEED LINE shows.
// Lineage resolution precedence: race.lineage > race.subrace.name > legacy
// runtime _elfishLineageSelection (stale after wizard edits).
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

// The elfish_lineage automation row the 2024 wizard persists from races.json.
const elfishLineageRow = {
    type: 'elfish_lineage',
    options: [
        { name: 'Drow', spellcastingAbility: 'CHA', cantrip: 'Dancing Lights', darkvisionRange: '120' },
        { name: 'High Elf', spellcastingAbility: 'INT', cantrip: 'Prestidigitation', wizardCantripSwap: true },
        { name: 'Wood Elf', spellcastingAbility: 'WIS', cantrip: 'Druidcraft', speedBonus: 5 },
    ],
};

// Character without the elfish_lineage trait — the grant must stay gated on it.
const elfWithoutTraitRow = {
    type: 'other',
    options: elfishLineageRow.options,
};

const statsWithRace = (race, automation = { passives: [], specialActions: [elfishLineageRow] }) => ({
    name: 'ElfTest',
    level: 1,
    rules: '2024',
    race,
    class: { name: 'Fighter' },
    abilities: [{ name: 'Dexterity', bonus: 2 }],
    inventory: { equipped: [] },
    equipment: [],
    automation,
    immunities: [],
    resistances: [],
});

const ctxFor = (playerStats) => computeCharSummaryContext({
    playerStats, campaignName, characters: [], conditionEffects: {}, auraComboEffects: {}, exhaustionLevel: 0,
});

// Seed only the legacy chooser runtime key; every other runtime key reads null.
const seedRuntimeLineage = (selection) => {
    getRuntimeValue.mockImplementation((name, key) => (key === '_elfishLineageSelection' ? selection : null));
};

describe('charSummaryCalc — CLA-118 Elfish Lineage speed lane', () => {
    beforeEach(() => {
        // mockReturnValue also replaces any per-test mockImplementation,
        // so each test starts from a clean, null-reading runtime store.
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('shows Wood Elf at 35 ft via the subrace channel (race JSON alone would render 30)', () => {
        const ctx = ctxFor(statsWithRace({ name: 'Elf', speed: 30, subrace: { name: 'Wood Elf' } }));
        expect(ctx.totalSpeedWithBuff).toBe(35);
        // The grant lands in the base-speed lane, not fabricated as a buff bonus.
        expect(ctx.buffSpeedBonus).toBe(0);
    });

    it('shows Wood Elf at 35 ft via the race.lineage channel with no subrace', () => {
        expect(ctxFor(statsWithRace({ name: 'Elf', speed: 30, lineage: 'Wood Elf' })).totalSpeedWithBuff).toBe(35);
    });

    it('shows Wood Elf at 35 ft when the legacy runtime chooser selection is the only channel', () => {
        seedRuntimeLineage('Wood Elf');
        expect(ctxFor(statsWithRace({ name: 'Elf', speed: 30 })).totalSpeedWithBuff).toBe(35);
    });

    it('keeps Drow at 30 ft even when a stale runtime key says Wood Elf', () => {
        seedRuntimeLineage('Wood Elf');
        const ctx = ctxFor(statsWithRace({ name: 'Elf', speed: 30, subrace: { name: 'Drow' } }));
        expect(ctx.totalSpeedWithBuff).toBe(30);
        expect(ctx.buffSpeedBonus).toBe(0);
    });

    it('does not double-grant when 5e subrace JSON already carries the absolute speed', () => {
        const ctx = ctxFor(statsWithRace({ name: 'Elf', speed: 30, subrace: { name: 'Wood Elf', speed: 35 } }));
        expect(ctx.totalSpeedWithBuff).toBe(35);
        expect(ctx.buffSpeedBonus).toBe(0);
    });

    it('gates the grant on the elfish_lineage trait — traitless Elf stays 30 ft even when runtime says Wood Elf', () => {
        seedRuntimeLineage('Wood Elf');
        expect(ctxFor(statsWithRace({ name: 'Elf', speed: 30 }, elfWithoutTraitRow)).totalSpeedWithBuff).toBe(30);
    });

    it('leaves non-elven speeds untouched even when an elfish_lineage row lingers in automation', () => {
        const ctx = ctxFor(statsWithRace({ name: 'Dwarf', speed: 25, subrace: { name: 'Hill Dwarf', speed: 25 } }));
        expect(ctx.totalSpeedWithBuff).toBe(25);
        expect(ctx.buffSpeedBonus).toBe(0);
    });
});
