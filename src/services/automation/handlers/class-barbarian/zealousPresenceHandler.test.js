// @maintained-by-ai 2026-11-26
// Handler-only lane for zealousPresenceHandler.js (producer seam): handle() gating
// (already-active refusal, uses/rage resource management, 60-ft range-gated chooser
// modal) and confirmZealousPresence() (activation marker, toggleBuff producer shape,
// expiration registration, campaign-log entry, confirmation popup). Consumer seam
// (per-target buff attribution through the real buffToggle lookup) lives in
// handlePlayerSaveDamage.zealousPresence.test.js — not duplicated here.
// NOTE (family divergence, pinned honestly): like encouragingSongHandler, this
// handler's refusal popups (already-active, exhausted) do NOT log to the campaign
// log — the zero-write censuses below pin that vs. the every-automation-logs rule.
// Duration policy: the handler forwards authored combat-scoped duration strings
// verbatim to toggleBuff (no minutes×10 clock); expiration carries no rounds field
// and is keyed to the barbarian's next turn via expireOnCreatureName.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ─────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock('../../common/buffToggle.js', () => ({
    toggleBuff: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn(async () => true),
}));

// ── Imports ──────────────────────────────────────────────────────

import { handle, confirmZealousPresence } from './zealousPresenceHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addEntry } from '../../../ui/logService.js';
import { toggleBuff } from '../../common/buffToggle.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const playerName = 'TestBarbarian';

function makeAction(overrides = {}) {
    return {
        name: 'Zealous Presence',
        automation: {
            type: 'passive_rule',
            effect: 'zealous_presence',
            targets: 10,
            duration: 'until_start_of_next_turn',
            ...overrides,
        },
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 10,
        automation: { passives: [], actions: [] },
        ...overrides,
    };
}

// Runtime reads are keyed lookups; missing keys resolve undefined (falsy
// zealousPresenceActive, so handle() proceeds past the already-active gate).
function mockRuntime(values = {}) {
    useRuntimeState.getRuntimeValue.mockImplementation((_name, key) => values[key]);
}

const EXHAUSTED_POPUP = (action) => ({
    type: 'popup',
    payload: {
        type: 'automation_info',
        name: 'Zealous Presence',
        description: 'Zealous Presence has been used and cannot be used again until a long rest.',
        automation: action.automation,
    },
});

// ── handle() ─────────────────────────────────────────────────────

describe('zealousPresenceHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRuntime();
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Enemy1' }, { name: 'Enemy2' }, { name: 'Ally1' }],
        });
    });

    it('already active: returns the already-active popup and consults nothing else (no uses read, no write, no combat context, no log)', async () => {
        mockRuntime({ zealousPresenceActive: true });
        const action = makeAction();

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Zealous Presence',
                description: 'Zealous Presence is already active.',
                automation: action.automation,
            },
        });
        // Only the activation flag was read — the uses/rage lane never runs.
        expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([
            [playerName, 'zealousPresenceActive', campaignName],
        ]);
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it.each([
        {
            label: 'decrements tracked uses (runtime hit)',
            automation: { uses: 1 },
            runtime: { zealousPresenceUses: 1 },
            expectedWrite: [playerName, 'zealousPresenceUses', 0, campaignName],
        },
        {
            label: 'defaults a missing runtime use counter to automation uses',
            automation: { uses: 1 },
            runtime: {},
            expectedWrite: [playerName, 'zealousPresenceUses', 0, campaignName],
        },
        {
            label: 'resolves maxUses from usesMax when uses is absent',
            automation: { usesMax: 2 },
            runtime: {},
            expectedWrite: [playerName, 'zealousPresenceUses', 1, campaignName],
        },
        {
            label: 'routes reads and writes through a custom resourceKey',
            automation: { uses: 1, resourceKey: 'customUsesKey' },
            runtime: { customUsesKey: 1 },
            expectedWrite: [playerName, 'customUsesKey', 0, campaignName],
        },
        {
            label: 'expend_rage recharge: spends rage when uses are exhausted',
            automation: { uses: 1, recharge: 'long_rest_or_expend_rage' },
            runtime: { zealousPresenceUses: 0, ragePoints: 3 },
            expectedWrite: [playerName, 'ragePoints', 2, campaignName],
        },
        {
            label: 'expend_rage recharge: falls back to _trackedResources.ragePoints when runtime rage is null',
            automation: { uses: 1, recharge: 'long_rest_or_expend_rage' },
            runtime: { zealousPresenceUses: 0, ragePoints: null },
            stats: { _trackedResources: { ragePoints: { current: 2 } } },
            expectedWrite: [playerName, 'ragePoints', 1, campaignName],
        },
    ])('$label: opens the chooser modal after exactly one resource write', async ({ automation, runtime, stats, expectedWrite }) => {
        mockRuntime(runtime);
        const action = makeAction(automation);

        const result = await handle(action, makePlayerStats(stats), campaignName, null);

        expect(result.type).toBe('modal');
        expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([expectedWrite]);
    });

    it.each([
        { label: 'no recharge config', automation: { uses: 1 }, runtime: { zealousPresenceUses: 0 } },
        { label: 'recharge on_long_rest', automation: { uses: 1, recharge: 'on_long_rest' }, runtime: { zealousPresenceUses: 0 } },
        {
            label: 'expend_rage recharge with zero rage (runtime and tracked)',
            automation: { uses: 1, recharge: 'long_rest_or_expend_rage' },
            runtime: { zealousPresenceUses: 0, ragePoints: 0 },
        },
    ])('exhausted ($label): returns the used-up popup with a zero-write census (and, family divergence, no log)', async ({ automation, runtime }) => {
        mockRuntime(runtime);
        const action = makeAction(automation);

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result).toEqual(EXHAUSTED_POPUP(action));
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('opens the chooser modal with the full payload: untracked (maxUses 0) writes nothing, lenient non-self targets pass the 60-ft gate, default maxTargets 10', async () => {
        const action = makeAction();
        const playerStats = makePlayerStats();

        const result = await handle(action, playerStats, campaignName, null);

        expect(result).toEqual({
            type: 'modal',
            modalName: 'zealousPresenceTarget',
            payload: {
                action,
                playerStats,
                campaignName,
                // Gridless mode resolves lenient, but the gate is consulted
                // for every non-self creature (none of the default set is self).
                creatureTargets: [{ name: 'Enemy1' }, { name: 'Enemy2' }, { name: 'Ally1' }],
                maxTargets: 10,
            },
        });
        // No uses/usesMax configured → the resource lane reads and writes nothing.
        expect(useRuntimeState.getRuntimeValue.mock.calls).toEqual([
            [playerName, 'zealousPresenceActive', campaignName],
        ]);
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(isWithinRange.mock.calls).toEqual([
            [playerName, 'Enemy1', 60],
            [playerName, 'Enemy2', 60],
            [playerName, 'Ally1', 60],
        ]);
        expect(addEntry).not.toHaveBeenCalled();
    });

    it.each([
        { label: 'automation.targets passed through', targets: 5, expected: 5 },
        { label: 'missing automation.targets falls back to 10', targets: undefined, expected: 10 },
    ])('maxTargets ($label)', async ({ targets, expected }) => {
        const action = makeAction();
        if (targets === undefined) {
            delete action.automation.targets;
        } else {
            action.automation.targets = targets;
        }

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result.payload.maxTargets).toBe(expected);
    });

    it('CLA-394: range-gates chooser targets at 60 ft, excluding self before the gate is even consulted', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'TestBarbarian' }, { name: 'AllyNear' }, { name: 'AllyFar' }],
        });
        isWithinRange.mockImplementation(async (_src, target) => target !== 'AllyFar');

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('modal');
        expect(result.payload.creatureTargets).toEqual([{ name: 'AllyNear' }]);
        // Self is never range-checked; every other creature is, exactly once, at 60 ft.
        expect(isWithinRange.mock.calls).toEqual([
            [playerName, 'AllyNear', 60],
            [playerName, 'AllyFar', 60],
        ]);
    });
});

// ── confirmZealousPresence() ─────────────────────────────────────

describe('zealousPresenceHandler.confirmZealousPresence', () => {
    const ACTIVE_WRITE = [playerName, 'zealousPresenceActive', true, campaignName];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('commits two targets: exact activation write, per-target toggleBuff and expiration shapes, exact log entry, full confirmation popup', async () => {
        const action = makeAction();

        const result = await confirmZealousPresence(action, makePlayerStats(), campaignName, ['Enemy1', 'Enemy2']);

        expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([ACTIVE_WRITE]);
        // CLA-394: barbarian is the source argument so buff attribution reads
        // sourceCharacter=<barbarian>, not the target.
        expect(toggleBuff.mock.calls).toEqual([
            [playerName, 'Zealous Presence', { effect: 'advantage_attacks_and_saves', duration: 'until_start_of_next_turn' }, campaignName, 'Enemy1'],
            [playerName, 'Zealous Presence', { effect: 'advantage_attacks_and_saves', duration: 'until_start_of_next_turn' }, campaignName, 'Enemy2'],
        ]);
        // No rounds field: expiration is keyed to the barbarian's next turn.
        expect(addExpiration.mock.calls).toEqual([
            [{
                attackerName: playerName,
                targetName: 'Enemy1',
                effects: [
                    { type: 'remove_active_buff', buffName: 'Zealous Presence' },
                    { type: 'clear_runtime_value', creatureName: playerName, key: 'zealousPresenceActive' },
                ],
                campaignName,
                expireOnCreatureName: playerName,
            }],
            [{
                attackerName: playerName,
                targetName: 'Enemy2',
                effects: [
                    { type: 'remove_active_buff', buffName: 'Zealous Presence' },
                    { type: 'clear_runtime_value', creatureName: playerName, key: 'zealousPresenceActive' },
                ],
                campaignName,
                expireOnCreatureName: playerName,
            }],
        ]);
        expect(addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: playerName,
            abilityName: 'Zealous Presence',
            description: `${playerName} activated Zealous Presence, granting Advantage on attack rolls and saving throws to Enemy1, Enemy2 until the start of their next turn.`,
            timestamp: expect.any(Number),
        });
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Zealous Presence',
                automationType: 'passive_rule',
                description: 'Zealous Presence activated! Granting Advantage on attack rolls and saving throws to 2 target(s) (Enemy1, Enemy2).',
                automation: action.automation,
            },
        });
    });

    it('caps the commit at automation.targets: first two survive, third is dropped everywhere', async () => {
        const action = makeAction({ targets: 2 });

        const result = await confirmZealousPresence(action, makePlayerStats(), campaignName, ['Enemy1', 'Enemy2', 'Enemy3']);

        expect(toggleBuff.mock.calls.map((c) => c[4])).toEqual(['Enemy1', 'Enemy2']);
        expect(addExpiration.mock.calls.map((c) => [c[0].targetName])).toEqual([['Enemy1'], ['Enemy2']]);
        expect(result.payload.description).toBe(
            'Zealous Presence activated! Granting Advantage on attack rolls and saving throws to 2 target(s) (Enemy1, Enemy2).',
        );
    });

    it.each([
        ['empty array', []],
        ['undefined', undefined],
    ])('a commit with %s selected targets still activates the marker and grants nothing', async (_label, selected) => {
        const result = await confirmZealousPresence(makeAction(), makePlayerStats(), campaignName, selected);

        expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([ACTIVE_WRITE]);
        expect(toggleBuff).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            description: expect.stringContaining('to no one until the start of their next turn.'),
        }));
        expect(result.payload.description).toBe(
            'Zealous Presence activated! Granting Advantage on attack rolls and saving throws to 0 target(s) (none).',
        );
    });

    it.each([
        { label: 'custom automation.duration is forwarded verbatim', patch: (a) => { a.automation.duration = 'one_round'; }, expected: 'one_round' },
        { label: 'missing automation.duration falls back to until_start_of_next_turn', patch: (a) => { delete a.automation.duration; }, expected: 'until_start_of_next_turn' },
    ])('duration policy ($label): no clock conversion, the string rides to toggleBuff untouched', async ({ patch, expected }) => {
        const action = makeAction();
        patch(action);

        await confirmZealousPresence(action, makePlayerStats(), campaignName, ['Enemy1']);

        expect(toggleBuff.mock.calls).toEqual([
            [playerName, 'Zealous Presence', { effect: 'advantage_attacks_and_saves', duration: expected }, campaignName, 'Enemy1'],
        ]);
    });

    it('a rejected campaign log is caught and error-logged without breaking the commit', async () => {
        const failure = new Error('Log service unavailable');
        addEntry.mockRejectedValueOnce(failure);
        const consoleSpy = vi.spyOn(console, 'error').mockReturnValue(undefined);
        try {
            const result = await confirmZealousPresence(makeAction(), makePlayerStats(), campaignName, ['Enemy1']);

            expect(consoleSpy).toHaveBeenCalledWith('[zealousPresence] Error:', failure);
            expect(result.type).toBe('popup');
            expect(useRuntimeState.setRuntimeValue.mock.calls).toEqual([ACTIVE_WRITE]);
        } finally {
            consoleSpy.mockRestore();
        }
    });
});
