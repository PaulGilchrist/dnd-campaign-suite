// @maintained-by-ai
// CLA-118 regression: the sheet Speed line must fold in the Elfish Lineage
// ladder grant (Wood Elf speedBonus 5 from races.json) — race JSON alone
// renders Wood Elf at 30 ft.
//
// Sheet seam only: lineage channel precedence (race.lineage > subrace >
// legacy runtime key), trait gating, non-Wood-Elf zeroing, and the
// absolute-speed guard are all pinned by elfishLineageSpeedBonus unit tests
// in elfishLineageHandler.test.js — charSummaryCalc delegates to that one
// function, so re-pinning channels here would only re-run the same line.
// What this file owns is the getBaseSpeed arithmetic the SPEED LINE shows:
// subrace.speed ?? race.speed, the +bonus applied to the BASE lane (never
// fabricated as a buff), and the missing-speed guard.
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

const statsWithRace = (race) => ({
    name: 'ElfTest',
    level: 1,
    rules: '2024',
    race,
    class: { name: 'Fighter' },
    abilities: [{ name: 'Dexterity', bonus: 2 }],
    inventory: { equipped: [] },
    equipment: [],
    automation: { passives: [], specialActions: [elfishLineageRow] },
    immunities: [],
    resistances: [],
});

const ctxFor = (playerStats) => computeCharSummaryContext({
    playerStats, campaignName, characters: [], conditionEffects: {}, auraComboEffects: {}, exhaustionLevel: 0,
});

describe('charSummaryCalc — CLA-118 Elfish Lineage speed lane', () => {
    beforeEach(() => {
        // Runtime store reads null for every key (including the legacy
        // _elfishLineageSelection), so each test resolves lineage from race JSON only.
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('shows Wood Elf at 35 ft via the subrace channel (race JSON alone would render 30)', () => {
        const ctx = ctxFor(statsWithRace({ name: 'Elf', speed: 30, subrace: { name: 'Wood Elf' } }));
        expect(ctx.totalSpeedWithBuff).toBe(35);
        // The grant lands in the base-speed lane, not fabricated as a buff bonus.
        expect(ctx.buffSpeedBonus).toBe(0);
    });

    it('does not double-grant when 5e subrace JSON already carries the absolute speed', () => {
        const ctx = ctxFor(statsWithRace({ name: 'Elf', speed: 30, subrace: { name: 'Wood Elf', speed: 35 } }));
        expect(ctx.totalSpeedWithBuff).toBe(35);
        expect(ctx.buffSpeedBonus).toBe(0);
    });

    it('logs and shows 0 ft when the race carries no speed, keeping NaN out of the display', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const ctx = ctxFor(statsWithRace({ name: 'Elf' }));
        expect(ctx.totalSpeedWithBuff).toBe(0);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
