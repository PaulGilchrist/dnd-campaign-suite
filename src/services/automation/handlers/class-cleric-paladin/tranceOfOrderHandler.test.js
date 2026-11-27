// @maintained-by-ai 2026-11-26
// Deterministic unit coverage for the Trance of Order handler (CLA-364): the
// runtime-store state machine (free press → uses 0 + active true + refresh
// event, 5 SP restore at the exact >= 5 boundary, refusals with a zero-spend
// census) plus isActive/deactivate contracts. Every popup and log row is
// pinned full-shape (activation payloads carry NO automationType; refusals do)
// with a frozen Date.now on the two refusal rows. Adjacent seams live in
// sibling suites and are NOT duplicated here: modifier rows
// (automationModifiers.test.js), the info-builder card (automationInfoBuilder/
// sorcery.test.js), the never-seeded uses latch (trackedResourcesAdditional),
// Long-Rest null re-arm (restRules-longRest), and initiative clear-down via
// deactivate (useInitiativeEffects.activeStateClearing). No timers or
// wall-clock coupling — durations here are static popup text only.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handle, isActive, deactivate } from './tranceOfOrderHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as metamagic from '../../../../hooks/combat/useMetamagic.js';
import * as classFeatures from '../../../character/classFeatures.js';
import * as logService from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../hooks/combat/useMetamagic.js', () => ({
    spendSorceryPoints: vi.fn(),
    getCurrentSorceryPoints: vi.fn(),
}));

vi.mock('../../../character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const playerName = 'Test Character';
const activeKey = 'tranceOfOrderActive';
const usesKey = 'tranceOfOrderUses';
const AUTO = {
    type: 'trance_of_order',
    action: 'bonus_action',
    duration: '1_minute',
    restoreCost: 5,
};

function makeAction(name = 'Trance of Order') {
    return { name, automation: AUTO };
}

// Strip action.name entirely (exercises the `|| 'Trance of Order'` default).
function makeUnnamedAction() {
    return { automation: AUTO };
}

function makePlayerStats() {
    return {
        name: playerName,
        level: 14,
        class: { name: 'Sorcerer', class_levels: [{ level: 14 }] },
        resources: { sorcery_points: { current: 10 } },
    };
}

// Runtime-store router over the two trance keys.
function mockStore({ active = false, uses = 1 }) {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === activeKey) return active;
        if (key === usesKey) return uses;
        return null;
    });
}

// Activation payloads OMIT automationType; refusal payloads include it —
// full-shape toEqual pins the divergence.
function activationPopup(featureName, description) {
    return {
        type: 'popup',
        payload: { type: 'automation_info', name: featureName, description, automation: AUTO },
    };
}

function refusalPopup(featureName, description) {
    return {
        type: 'popup',
        payload: {
            type: 'automation_info',
            name: featureName,
            automationType: AUTO.type,
            description,
            automation: AUTO,
        },
    };
}

// The shared commit contract of both activation paths: exactly two writes in
// source order (uses → active) and exactly one UI refresh event.
function expectActivationCommit(dispatchSpy) {
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
        [playerName, usesKey, 0, campaignName],
        [playerName, activeKey, true, campaignName],
    ]);
    expect(dispatchSpy.mock.calls.map(([e]) => e.type)).toEqual(['trance-of-order-updated']);
}

describe('tranceOfOrderHandler', () => {
    let dispatchSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    });

    afterEach(() => {
        dispatchSpy.mockRestore();
    });

    describe('handle() — free press', () => {
        // The stored-uses state machine, CLA-364 BUG-A (null/unset means the
        // once-per-Long-Rest free use is still available — warpingImplosion
        // null-as-available pattern; even with 20 SP affordable the press is
        // free) — and name derivation in one family. SP stays wealthy in
        // every case so `spendSorceryPoints` never called proves the press
        // cost nothing.
        it.each([
            { title: 'consumes the stored use', uses: 1, action: makeAction(), featureName: 'Trance of Order' },
            { title: 'treats null/unset uses as the free press (first press or Long-Rest re-arm, CLA-364 BUG-A)', uses: null, action: makeAction(), featureName: 'Trance of Order' },
            { title: 'frames popup and log with a custom action name', uses: 1, action: makeAction('Custom Feature'), featureName: 'Custom Feature' },
            { title: "defaults the name to 'Trance of Order' when action.name is absent", uses: 1, action: makeUnnamedAction(), featureName: 'Trance of Order' },
        ])('$title', async (tc) => {
            mockStore({ active: false, uses: tc.uses });
            metamagic.getCurrentSorceryPoints.mockReturnValue(20);
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 20 });

            const result = await handle(tc.action, makePlayerStats(), campaignName, null);

            expect(result).toEqual(activationPopup(
                tc.featureName,
                `${tc.featureName} activated. Attack rolls against you can't benefit from Advantage. D20 tests treat 9 or lower as 10.`,
            ));
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expectActivationCommit(dispatchSpy);
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: tc.featureName,
                description: `${playerName} activated ${tc.featureName} (Bonus Action, 1 minute). Attack rolls against you can't benefit from Advantage. D20 tests treat 9 or lower as 10.`,
            });
        });
    });

    describe('handle() — 5 SP restore', () => {
        // currentSP sits on the exact boundary (=== 5 must spend). The class
        // max flows into both the affordability read and the spend clamp;
        // null class features defend down to 0 (`?.maxSorceryPoints || 0`).
        it.each([
            { title: 'clamps the spend to the class max', features: { maxSorceryPoints: 10 }, maxSP: 10 },
            { title: 'defaults maxSP to 0 on null class features', features: null, maxSP: 0 },
        ])('restores and activates at exactly 5 SP: $title', async (tc) => {
            mockStore({ active: false, uses: 0 });
            metamagic.getCurrentSorceryPoints.mockReturnValue(5);
            classFeatures.getClassFeatures.mockReturnValue(tc.features);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result).toEqual(activationPopup(
                'Trance of Order',
                'Trance of Order activated (5 SP spent). Attack rolls against you can\'t benefit from Advantage. D20 tests treat 9 or lower as 10.',
            ));
            expect(metamagic.getCurrentSorceryPoints).toHaveBeenCalledWith(playerName, tc.maxSP);
            expect(metamagic.spendSorceryPoints).toHaveBeenCalledTimes(1);
            expect(metamagic.spendSorceryPoints).toHaveBeenCalledWith(playerName, 5, campaignName, tc.maxSP);
            expectActivationCommit(dispatchSpy);
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'ability_use',
                characterName: playerName,
                abilityName: 'Trance of Order',
                description: `${playerName} restored and activated Trance of Order by spending 5 Sorcery Points.`,
            });
        });
    });

    describe('handle() — refusals (logged, zero spend)', () => {
        // Each refusal face: exact full-shape popup, one full refusal log row
        // (frozen timestamp), and a zero-spend census — no SP consumed, no
        // runtime write, no refresh event.
        it('refuses no_uses below the 5 SP restore boundary (currentSP 4)', async () => {
            mockStore({ active: false, uses: 0 });
            metamagic.getCurrentSorceryPoints.mockReturnValue(4);
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
            const now = Date.now();
            const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result).toEqual(refusalPopup(
                'Trance of Order',
                'Trance of Order has no uses remaining. Recharges on a Long Rest, or you can spend 5 Sorcery Points to restore.',
            ));
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(dispatchSpy).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'automation',
                characterName: playerName,
                abilityName: 'Trance of Order',
                automationType: AUTO.type,
                description: 'Trance of Order refused: trance_of_order_refused no_uses — not enough Sorcery Points to restore (needs 5). Nothing spent.',
                timestamp: now,
            });
            dateSpy.mockRestore();
        });

        // CLA-364 BUG-B: the already-active gate fires BEFORE any uses/SP
        // read matters — uses=1 available and 20 SP affordable must still
        // refuse with zero writes (mirrors sorceryHandler already_active).
        it('refuses re-press while already active with zero spend (CLA-364 BUG-B)', async () => {
            mockStore({ active: true, uses: 1 });
            metamagic.getCurrentSorceryPoints.mockReturnValue(20);
            classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 20 });
            const now = Date.now();
            const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

            expect(result).toEqual(refusalPopup(
                'Trance of Order',
                'Trance of Order is already active. It lasts 1 minute.',
            ));
            expect(metamagic.spendSorceryPoints).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(dispatchSpy).not.toHaveBeenCalled();
            expect(logService.addEntry).toHaveBeenCalledTimes(1);
            expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'automation',
                characterName: playerName,
                abilityName: 'Trance of Order',
                automationType: AUTO.type,
                description: 'Trance of Order refused: trance_of_order_refused already_active. It lasts 1 minute. Nothing spent.',
                timestamp: now,
            });
            dateSpy.mockRestore();
        });
    });

    // Shared contract of the .catch(e => console.error(...)) guards on all
    // three addEntry sites: a failed log write never breaks the popup or the
    // commit — each branch still completes its state machine.
    it('logs to console and still commits when addEntry rejects (all three paths)', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        logService.addEntry.mockRejectedValue(new Error('log failed'));
        classFeatures.getClassFeatures.mockReturnValue({ maxSorceryPoints: 10 });
        metamagic.getCurrentSorceryPoints.mockReturnValue(5);

        mockStore({ active: true, uses: 0 });
        const refusal = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(refusal.payload.description).toContain('already active');

        mockStore({ active: false, uses: 1 });
        const free = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(free.payload.description).toContain('activated.');

        mockStore({ active: false, uses: 0 });
        const restore = await handle(makeAction(), makePlayerStats(), campaignName, null);
        expect(restore.payload.description).toContain('(5 SP spent)');

        expect(metamagic.spendSorceryPoints).toHaveBeenCalledTimes(1);
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(4);
        expect(dispatchSpy.mock.calls.map(([e]) => e.type)).toEqual([
            'trance-of-order-updated',
            'trance-of-order-updated',
        ]);
        expect(consoleSpy).toHaveBeenCalledTimes(3);
        expect(consoleSpy).toHaveBeenCalledWith('[tranceOfOrder] Error:', expect.any(Error));
        consoleSpy.mockRestore();
    });

    describe('isActive()', () => {
        it('reads the active key and is strictly true-only', () => {
            runtimeState.getRuntimeValue.mockReturnValue(true);
            expect(isActive(playerName)).toBe(true);
            expect(runtimeState.getRuntimeValue).toHaveBeenLastCalledWith(playerName, activeKey, null);

            // `=== true` law: truthy non-booleans are NOT active.
            runtimeState.getRuntimeValue.mockReturnValue(1);
            expect(isActive(playerName)).toBe(false);

            runtimeState.getRuntimeValue.mockReturnValue(null);
            expect(isActive(playerName)).toBe(false);
        });
    });

    describe('deactivate()', () => {
        it('writes exactly one active=false for the given player', () => {
            deactivate(playerName, campaignName);

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                activeKey,
                false,
                campaignName,
            );
        });
    });
});
