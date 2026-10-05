// CLA-118 regression: the Wood Elf lineage speed grant must seed from the
// race JSON base when the loaded summary carries no speed, and race.subrace
// must outrank a stale runtime _elfishLineageSelection.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeObject: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { applyElfisLineageSpeed, applySpeedIncreasePassives } from './speedUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const elfishRow = {
    type: 'elfish_lineage',
    options: [
        { name: 'Drow', spellcastingAbility: 'CHA', cantrip: 'Dancing Lights', level3Spell: 'Faerie Fire', level5Spell: 'Darkness', darkvisionRange: '120' },
        { name: 'High Elf', spellcastingAbility: 'INT', cantrip: 'Prestidigitation', level3Spell: 'Detect Magic', level5Spell: 'Misty Step', wizardCantripSwap: true },
        { name: 'Wood Elf', spellcastingAbility: 'WIS', cantrip: 'Druidcraft', level3Spell: 'Longstrider', level5Spell: 'Pass Without Trace', speedBonus: 5 },
    ],
};

const woodElfStats = (overrides = {}) => ({
    name: 'ElfTest',
    speed: undefined,
    race: { name: 'Elf', speed: 30, subrace: { name: 'Wood Elf' } },
    automation: { passives: [], specialActions: [elfishRow] },
    ...overrides,
});

describe('applyElfisLineageSpeed (CLA-118)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
    });

    it('grants +5 onto the race JSON base when the summary has no speed (Wood Elf, no runtime key)', () => {
        const stats = woodElfStats();
        expect(applyElfisLineageSpeed(stats, { campaignName: 'test-campaign' })).toBe(35);
    });

    it('keeps the summary speed as the base when present', () => {
        const stats = woodElfStats({ speed: 30 });
        expect(applyElfisLineageSpeed(stats, { campaignName: 'test-campaign' })).toBe(35);
    });

    it('ignores a stale runtime Wood Elf selection when subrace is Drow', () => {
        getRuntimeValue.mockImplementation((name, key) => (key === '_elfishLineageSelection' ? 'Wood Elf' : null));
        const stats = woodElfStats({ race: { name: 'Elf', speed: 30, subrace: { name: 'Drow' } } });
        expect(applyElfisLineageSpeed(stats, { campaignName: 'test-campaign' })).toBeUndefined();
    });

    it('applies the runtime selection when no subrace is persisted', () => {
        getRuntimeValue.mockImplementation((name, key) => (key === '_elfishLineageSelection' ? 'Wood Elf' : null));
        const stats = woodElfStats({ race: { name: 'Elf', speed: 30 } });
        expect(applyElfisLineageSpeed(stats, { campaignName: 'test-campaign' })).toBe(35);
    });

    it('does not stack the bonus onto a 5e subrace absolute speed (no elfish_lineage trait row)', () => {
        const stats = woodElfStats({
            race: { name: 'Elf', speed: 30, subrace: { name: 'Wood Elf', speed: 35 } },
            automation: { passives: [], specialActions: [] },
        });
        expect(applyElfisLineageSpeed(stats, { campaignName: 'test-campaign' })).toBeUndefined();
    });

    it('still applies passive speed_increase after the lineage grant', () => {
        const stats = woodElfStats({ speed: applyElfisLineageSpeed(woodElfStats(), { campaignName: 'test-campaign' }) });
        stats.automation.passives = [{ type: 'passive_buff', effect: 'speed_increase', bonusExpression: '10' }];
        expect(applySpeedIncreasePassives(stats)).toBe(45);
    });
});
