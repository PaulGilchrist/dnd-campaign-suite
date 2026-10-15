// @maintained-by-ai
// gnomishLineageHandler — unit seam map.
//
// This file OWNS:
// - handle() router: modal with {action, playerStats, campaignName} payload when
//   unselected; popup with the full-string "(already selected)" composition when
//   a lineage is stored.
// - confirmGnomishLineage(): the five exact runtime-key write pins
//   (selection/ability/cantrip/level3/level5) in exact order per lineage — the
//   keys other suites mock against live here — plus invalid-input no-write
//   guards. Player name and campaign are varied per lineage row so the write
//   pins prove parameterisation, not hardcoded arguments.
// - restoreUses() + the five getters: API-contract pins (exact-key delegation
//   table). Live production callers today are handle (automation/index.js
//   router) and confirmGnomishLineage (CharSpecialActions.jsx); restoreUses
//   and the getters have no production caller — kept as the handler-lane
//   rest/getter contract (same convention as elfish/fiendish).
//
// Owned ELSEWHERE (do not re-pin here):
// - CharSpecialActions.gnomishLineage.test.jsx — modal open/confirm/cancel
//   routing with the real confirmGnomishLineage over an in-memory store.
// - useCharActionsAutomation.test.class-feature-modals.js — modal-state setter.
// - race-rules/2024.js — summary-line reads of _gnomishLineageSelection.
//
// Deterministic: pure functions over an in-memory runtime-store mock, no
// timers, no DOM, no network. LINEAGE_DATA below intentionally mirrors the
// handler's GNOME_LINEAGES so rule-data edits fail here on purpose.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    handle,
    confirmGnomishLineage,
    restoreUses,
    getGnomishLineageSelection,
    getGnomishLineageAbility,
    getGnomishLineageCantrip,
    getGnomishLineageLevel3Spell,
    getGnomishLineageLevel5Spell,
} from './gnomishLineageHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

const campaignName = 'test-campaign';
const action = { name: 'Gnomish Lineage', automation: { type: 'gnomish_lineage' } };

function makePlayerStats(overrides = {}) {
    return {
        name: 'GnomeBoy',
        ...overrides,
    };
}

// Mirrors handler GNOME_LINEAGES — rule-data edits fail here on purpose.
const LINEAGE_DATA = {
    'Deep Gnome': {
        ability: 'Intelligence',
        cantrip: 'Magic Stone',
        level3: 'Nondetection',
        level5: 'Passwall',
    },
    'Forest Gnome': {
        ability: 'Intelligence',
        cantrip: 'Minor Illusion',
        level3: 'Speak with Animals',
        level5: 'Call Lightning',
    },
    'Rock Gnome': {
        ability: 'Intelligence',
        cantrip: 'Mending',
        level3: 'Prestidigitation',
        level5: 'Protection from Energy',
    },
};

describe('gnomishLineageHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns modal with payload when no lineage selected', async () => {
            getRuntimeValue.mockReturnValue(null);

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('gnomishLineage');
            expect(result.payload).toEqual({
                action,
                playerStats: makePlayerStats(),
                campaignName,
            });
        });

        it('returns popup with stored lineage when already selected, full composition', async () => {
            getRuntimeValue.mockReturnValue('Forest Gnome');

            const result = await handle(action, makePlayerStats(), campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Gnomish Lineage');
            expect(result.payload.description).toBe('Gnomish Lineage: Forest Gnome (already selected).');
            expect(result.payload.automation).toEqual({ type: 'gnomish_lineage' });
        });
    });

    describe('confirmGnomishLineage', () => {
        it.each(Object.entries(LINEAGE_DATA))(
            'stores all five runtime values for %s in exact key order',
            async (legacy, data) => {
                const stats = makePlayerStats({ name: `Gnome-${legacy}` });

                const result = await confirmGnomishLineage(stats, legacy, campaignName);

                expect(result.type).toBe('popup');
                expect(result.payload.type).toBe('automation_info');
                expect(result.payload.name).toBe('Gnomish Lineage');
                expect(result.payload.description).toBe(`Selected ${legacy} lineage. Spellcasting ability: ${data.ability}.`);
                expect(result.payload.automation.type).toBe('gnomish_lineage');
                expect(result.payload.automation.options.map((o) => o.name)).toEqual(Object.keys(LINEAGE_DATA));

                expect(setRuntimeValue).toHaveBeenCalledTimes(5);
                expect(setRuntimeValue.mock.calls).toEqual([
                    [stats.name, '_gnomishLineageSelection', legacy, campaignName],
                    [stats.name, '_gnomishLineageAbility', data.ability, campaignName],
                    [stats.name, '_gnomishLineageCantrip', data.cantrip, campaignName],
                    [stats.name, '_gnomishLineageLevel3', data.level3, campaignName],
                    [stats.name, '_gnomishLineageLevel5', data.level5, campaignName],
                ]);
            }
        );

        it.each(['Nonexistent', '', undefined])('returns error popup and writes nothing for invalid lineage %s', async (legacy) => {
            const result = await confirmGnomishLineage(makePlayerStats(), legacy, campaignName);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Gnomish Lineage');
            expect(result.payload.description).toBe('No lineage selected.');
            expect(result.payload.automation).toEqual({
                type: 'gnomish_lineage',
                options: expect.arrayContaining([
                    expect.objectContaining({ name: 'Deep Gnome' }),
                    expect.objectContaining({ name: 'Forest Gnome' }),
                    expect.objectContaining({ name: 'Rock Gnome' }),
                ]),
            });
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('restoreUses', () => {
        it('clears all five lineage keys to null in exact order', () => {
            restoreUses('GnomeBoy', campaignName);

            const calls = setRuntimeValue.mock.calls;
            expect(calls.map((c) => c[1])).toEqual([
                '_gnomishLineageSelection',
                '_gnomishLineageAbility',
                '_gnomishLineageCantrip',
                '_gnomishLineageLevel3',
                '_gnomishLineageLevel5',
            ]);
            calls.forEach((c) => {
                expect(c).toEqual(['GnomeBoy', c[1], null, campaignName]);
            });
        });
    });

    describe('runtime getters', () => {
        // Each getter is a one-line delegation to getRuntimeValue on its exact
        // key — pinned as a table so a renamed key fails here, once, clearly.
        it.each([
            ['getGnomishLineageSelection', '_gnomishLineageSelection', getGnomishLineageSelection, 'Forest Gnome'],
            ['getGnomishLineageAbility', '_gnomishLineageAbility', getGnomishLineageAbility, 'Intelligence'],
            ['getGnomishLineageCantrip', '_gnomishLineageCantrip', getGnomishLineageCantrip, 'Minor Illusion'],
            ['getGnomishLineageLevel3Spell', '_gnomishLineageLevel3', getGnomishLineageLevel3Spell, 'Speak with Animals'],
            ['getGnomishLineageLevel5Spell', '_gnomishLineageLevel5', getGnomishLineageLevel5Spell, 'Call Lightning'],
        ])('%s reads %s verbatim', (_label, key, getter, value) => {
            getRuntimeValue.mockReturnValue(value);
            expect(getter(makePlayerStats(), campaignName)).toBe(value);
            expect(getRuntimeValue).toHaveBeenCalledWith('GnomeBoy', key, campaignName);
        });
    });
});
