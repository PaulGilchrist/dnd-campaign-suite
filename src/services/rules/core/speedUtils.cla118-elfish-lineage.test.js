// @maintained-by-ai
// CLA-118 unit lane for speedUtils.applyElfisLineageSpeed ONLY: the seed
// arithmetic (base = playerStats.speed ?? race.speed), the zero-bonus
// passthrough, and the no-base error branch.
// Cited-by / ownership split:
// - elfishLineageHandler.test.js — resolveElfishLineage precedence
//   (subrace > stale runtime; runtime fallback) and every
//   elfishLineageSpeedBonus() guard (trait gating, non-Wood-Elf,
//   5e absolute subrace speed, missing speedBonus).
// - speedUtils.cla201-race-speed-fold.test.js — applySpeedIncreasePassives
//   fold + no-base guard, resolveHalfSpeedFeet.
// - rules-playerStats-senses-speed.test.js (#1259) — the +5 grant
//   end-to-end through rules.getPlayerStats (handler mocked there;
//   real handler runs here so the 30 → 35 seam is pinned unmocked).
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeObject: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

import { applyElfisLineageSpeed } from './speedUtils.js';

const woodElfTraitRow = {
    type: 'elfish_lineage',
    options: [
        { name: 'Drow', spellcastingAbility: 'CHA', cantrip: 'Dancing Lights', level3Spell: 'Faerie Fire', level5Spell: 'Darkness', darkvisionRange: '120' },
        { name: 'High Elf', spellcastingAbility: 'INT', cantrip: 'Prestidigitation', level3Spell: 'Detect Magic', level5Spell: 'Misty Step', wizardCantripSwap: true },
        { name: 'Wood Elf', spellcastingAbility: 'WIS', cantrip: 'Druidcraft', level3Spell: 'Longstrider', level5Spell: 'Pass Without Trace', speedBonus: 5 },
    ],
};

const elfStats = (overrides = {}) => ({
    name: 'ElfTest',
    speed: undefined,
    race: { name: 'Elf', speed: 30, subrace: { name: 'Wood Elf' } },
    automation: { passives: [], specialActions: [woodElfTraitRow] },
    ...overrides,
});

describe('applyElfisLineageSpeed (CLA-118)', () => {

    it('seeds the +5 grant from the race JSON base when the summary carries no speed', () => {
        expect(applyElfisLineageSpeed(elfStats(), { campaignName: 'test-campaign' })).toBe(35);
    });

    it('seeds from the summary speed when present, not the race JSON base', () => {
        // speed 40 (e.g. magic-item layer) must outrank race.speed 30 —
        // reading the wrong side of `??` here would show 35, not 45.
        const stats = elfStats({ speed: 40 });
        expect(applyElfisLineageSpeed(stats, { campaignName: 'test-campaign' })).toBe(45);
    });

    it('passes speed through unchanged when the bonus guard denies the grant', () => {
        // Guard truth table lives in elfishLineageHandler.test.js; here only
        // the speedUtils `!bonus` passthrough matters: 30 stays 30, never 35.
        const stats = elfStats({ speed: 30, race: { name: 'Elf', speed: 30, subrace: { name: 'Drow' } } });
        expect(applyElfisLineageSpeed(stats, { campaignName: 'test-campaign' })).toBe(30);
    });

    it('logs an error and leaves speed undefined when there is no base speed to grant onto', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const stats = elfStats({ race: { name: 'Elf', subrace: { name: 'Wood Elf' } } });
        expect(applyElfisLineageSpeed(stats, { campaignName: 'test-campaign' })).toBeUndefined();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
