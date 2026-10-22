// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useInitiativeEffects from './useInitiativeEffects.js';

// Lane: LIVE-store POST broadcast contract for the campaign targetEffects seam
// (clearCampaignEffectsWith / restoreCalmEmotions strip, useInitiativeEffects.js).
// Unlike the sibling lanes (#350/#351/#352 family) which mock useRuntimeState and
// pin the call tuple, this lane runs the REAL store (useRuntimeState.js) with a
// fetch spy, so it pins what is OBSERVABLE on the network — the only skipSync
// mechanism in this store is setRuntimeObject's 4th param (:137); setRuntimeValue's
// signature is 4 params (:78) and always POSTs. The initiative-rolled seam clears
// effects ORIGINATING on this client (owner rolled initiative locally — detail-
// bearing dispatches come only from initiativeProcessing.js/CharSheet.handlers.js),
// so the server does NOT already hold the cleared array: every clear MUST POST to
// persist and broadcast. A 5th "skipSync" arg at the call site was dead code
// (silently ignored); it was removed 2026-10-22 and must never reappear.
// Project rule honored: seam-driven only, no wall-clock gates.

// All collaborator services mocked EXCEPT useRuntimeState.js — the live store is
// the system under test here (edgeCases #352 mock set otherwise, minus the store).
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
    },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        set: vi.fn(),
    },
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibility: vi.fn(),
    endGreaterInvisibility: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/polymorphService.js', () => ({
    revertPolymorph: vi.fn(),
}));

vi.mock('../../services/automation/handlers/spells/shapechangeService.js', () => ({
    revertShapechange: vi.fn(),
}));

import {
    getStore,
    clearRuntimeState,
    setRuntimeValue,
} from '../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';

const campaignName = 'test-campaign';
const TE = 'targetEffects';
// useRuntimeState.js:107-108: characterKey === 'campaign' posts the property
// directly to its own URL — the filter that isolates this seam's traffic from
// the per-character full-store POSTs the same handler also emits.
const TE_URL = `/api/campaigns/${campaignName}/${TE}`;

const playerStats = {
    name: 'TestMonk',
    level: 15,
    class: {
        name: 'Monk',
        class_levels: [{ level: 15, focus_points: 6 }],
    },
    abilities: [{ name: 'Wisdom', bonus: 4 }],
    automation: {
        passives: [],
        actions: [],
    },
    actions: [],
};

const tePosts = () => global.fetch.mock.calls.filter(([url]) => url === TE_URL);

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
    clearRuntimeState('campaign');
    clearRuntimeState('TestMonk');
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function rollInitiative(characterName = 'TestMonk') {
    window.dispatchEvent(
        new CustomEvent('initiative-rolled', {
            detail: { characterName, roll: 15 },
        })
    );
}

describe('useInitiativeEffects - live-store POST broadcast of campaign targetEffects', () => {
    it('callee arity: the store setRuntimeValue takes exactly 4 args (no skipSync slot)', () => {
        // Runtime byte check (useRuntimeState.js:78). skipSync lives ONLY on
        // setRuntimeObject (4th param, :137). Any call-site arg past position 4
        // is silently dropped — so this seam must get its POST semantics right
        // in 4 args, not via an ignored flag.
        expect(setRuntimeValue.length).toBe(4);
    });

    it('owner initiative roll POSTs the caster-sourced clear exactly once, byte-exact, to the campaign URL', () => {
        // TestMonk breaks Bane concentration at the initiative seam: only
        // TestMonk-sourced bane_penalty falls; ally and bystander entries and
        // bytes survive into the posted value.
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'TestMonk', concentration: { spell: 'Bane' }, hp: 30 }],
        });
        const ownBane = { effect: 'bane_penalty', source: 'TestMonk', target: 'Goblin1' };
        const allyBane = { effect: 'bane_penalty', source: 'AllyCaster', target: 'Goblin2' };
        const bystander = { effect: 'other_effect', source: 'Ally' };
        const survivors = [allyBane, bystander];
        getStore('campaign').set(TE, [ownBane, allyBane, bystander]);

        renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
        rollInitiative();

        // Arm (a) of the adjudication: local-origin clear => MUST POST.
        expect(tePosts()).toHaveLength(1);
        const [url, init] = tePosts()[0];
        expect(url).toBe(TE_URL);
        expect(init.method).toBe('POST');
        expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
        // Byte-exact broadcast body: the server receives precisely the survivors.
        expect(JSON.parse(init.body)).toEqual({ value: survivors });
        expect(getStore('campaign').get(TE)).toEqual(survivors);
    });

    it('writes NO campaign targetEffects POST when no swept or sourced entry matches (length guard)', () => {
        // Absence is guarded by the filter-length check (no mutation => no
        // broadcast), not by a dead skipSync arg: positive legs below prove the
        // seam fired.
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'TestMonk', concentration: { spell: 'Bane' }, hp: 30 }],
        });
        const allyBane = { effect: 'bane_penalty', source: 'AllyCaster', target: 'Goblin2' };
        getStore('campaign').set(TE, [allyBane]);

        renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
        rollInitiative();

        expect(tePosts()).toHaveLength(0);
        expect(getStore('campaign').get(TE)).toEqual([allyBane]);
    });

    it('another character rolling initiative triggers no campaign targetEffects POST', () => {
        // The handler is owner-gated (rollingName !== myName => return), so a
        // remote-initiative echo never makes this client re-broadcast a clear.
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'TestMonk', concentration: { spell: 'Bane' }, hp: 30 }],
        });
        const ownBane = { effect: 'bane_penalty', source: 'TestMonk', target: 'Goblin1' };
        getStore('campaign').set(TE, [ownBane]);

        renderHook(() => useInitiativeEffects(playerStats, campaignName, vi.fn()));
        rollInitiative('OtherCharacter');

        expect(tePosts()).toHaveLength(0);
        expect(getStore('campaign').get(TE)).toEqual([ownBane]);
    });
});
