// @maintained-by-ai
// DB 2026-11-06 backlog: feat damage-reduction (Heavy Armor Master) folded into
// the hp_change damageBreakdown as a sibling 'reduced' entry. buildDamageBreakdownEntry
// (resistance entries, byte-frozen) and the array twin buildDamageBreakdownEntries
// own the entry SHAPE here; producer lanes (handlePlainDamage / save-damage /
// NPC-save) just spread the twin. applyResult.featReduction itself is authored by
// applyDamage.js and pinned end-to-end in applyDamage.heavyArmorMaster.test.js.
import { describe, it, expect, vi } from 'vitest';

// The helpers under test are pure; stub the runtime/automation edges the module
// imports so the lane stays a shape unit-test.
vi.mock('../../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => 0),
}));
vi.mock('../../../services/combat/automation/automationService.js', () => ({
    hasGreatWeaponFighting: vi.fn(() => false),
    applyGreatWeaponFightingToDamage: vi.fn(rolls => rolls),
}));

import { buildDamageBreakdownEntry, buildDamageBreakdownEntries } from './damageHandlerUtils.js';

const HAM_REDUCTION = {
    damageType: 'Bludgeoning',
    source: 'Heavy Armor Master',
    reducedBy: 6,
    reducedFrom: 7,
    amount: 1,
};

describe('buildDamageBreakdownEntries (feat-reduction breakdown seam)', () => {
    it('appends a reduced entry shaped like the resistance entries, naming the feat and exposing pre/post amounts', () => {
        const applyResult = {
            featureReduction: HAM_REDUCTION,
            resistanceDetails: [{ damageType: 'Bludgeoning', status: 'resistant' }],
        };

        const entries = buildDamageBreakdownEntries(applyResult, 'Bludgeoning', 1);

        // Primary entry keeps the exact resistance-entry shape (byte-frozen sibling).
        expect(entries[0]).toEqual(buildDamageBreakdownEntry(applyResult, 'Bludgeoning', 1));
        expect(entries[0]).toEqual({
            damageType: 'Bludgeoning',
            amount: 1,
            resisted: true,
            status: 'resistant',
        });
        // Reduction sibling: same damageType/amount/resisted/status field pattern,
        // amount = post-reduction (resistance scaling convention), reducedFrom = pre.
        expect(entries[1]).toEqual({
            damageType: 'Bludgeoning',
            amount: 1,
            resisted: false,
            status: 'reduced',
            source: 'Heavy Armor Master',
            reducedFrom: 7,
            reducedBy: 6,
        });
    });

    it('non-reduced hits stay byte-identical to the old inline single-entry array', () => {
        const resistanceOnly = { resistanceDetails: [{ damageType: 'Fire', status: 'resistant' }] };
        expect(buildDamageBreakdownEntries(resistanceOnly, 'Fire', 4)).toEqual([
            { damageType: 'Fire', amount: 4, resisted: true, status: 'resistant' },
        ]);

        const noDetails = { resistanceDetails: [] };
        expect(buildDamageBreakdownEntries(noDetails, 'Slashing', 8)).toEqual([
            { damageType: 'Slashing', amount: 8, resisted: false, status: null },
        ]);

        // Interception/legacy results without the key at all: no empty entry springs up.
        expect(buildDamageBreakdownEntries(null, 'Poison', 5)).toEqual([
            { damageType: 'Poison', amount: 5, resisted: false, status: null },
        ]);
        expect(buildDamageBreakdownEntries({ featureReduction: null }, 'Poison', 5)).toHaveLength(1);
        expect(buildDamageBreakdownEntries({ featureReduction: { reducedBy: 0 } }, 'Poison', 5)).toHaveLength(1);
    });

    it('falls back to the call damageType when the reduction record omits its own', () => {
        const entries = buildDamageBreakdownEntries(
            { featureReduction: { ...HAM_REDUCTION, damageType: undefined } },
            'Piercing',
            1
        );
        expect(entries[1].damageType).toBe('Piercing');
    });
});
