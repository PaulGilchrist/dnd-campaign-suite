// @maintained-by-ai 2026-11-26
// Roadmap Item 10 (sensory cues) — the log-lane outcome consumer.
// subscribeToSSE is the only seam mocked (the shared-singleton law is its own
// suite's job); the cueForLogEntry decode runs for real through the wiring —
// per-branch decoder truth-tables live in audioCues.test.js, the App-level
// one-instance mount law in App.combat-cues.test.jsx. What THIS file pins:
// mount lifecycle (one subscription per campaign, no initial GET — mounts
// never replay a backlog, clean unsubscribe), the live-append → cue wiring
// for each moment family, the component's own key/data guards, PER-ROW
// idempotence via alreadyCued (dup delivery cues once, the module-level
// seen-guard survives a remount, distinct ids always win the bounded FIFO),
// and the Nat flourish: fires only for the two table-moments, replaces on a
// fresh row, never re-flourishes a duplicate, self-removes on animation end.
// Row fixtures carry a server-style id because every log.js append stamps one.
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CombatCues from './CombatCues.jsx';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import { playCue, resetAudioCues } from '../../services/ui/audioCues.js';

vi.mock('../../services/ui/sseClient.js', () => ({
    subscribeToSSE: vi.fn(() => vi.fn()),
}));

vi.mock('../../services/ui/audioCues.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, playCue: vi.fn() };
});

const handlers = () => subscribeToSSE.mock.calls.map(([, handler]) => handler);

const emit = (event) => {
    handlers().forEach((handler) => handler(event));
};

const logEvent = (data) => ({ key: 'log-test-campaign', data });

const cuesPlayed = () => playCue.mock.calls.map(([cue]) => cue);

beforeEach(() => {
    subscribeToSSE.mockClear();
    playCue.mockClear();
    resetAudioCues(); // cold audio module, incl. the cued-row seen-set
});

describe('CombatCues', () => {
    it('renders nothing, never fetches, subscribes once per campaign and unsubscribes on unmount', () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const cleanup = vi.fn();
        subscribeToSSE.mockReturnValueOnce(cleanup);
        const view = render(<CombatCues campaignName='test-campaign' />);
        // SSE-only: no backlog GET on mount.
        expect(view.container).toBeEmptyDOMElement();
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
        expect(subscribeToSSE).toHaveBeenCalledTimes(1);
        expect(subscribeToSSE).toHaveBeenCalledWith('test-campaign', expect.any(Function));
        view.unmount();
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('does not subscribe without a campaign', () => {
        render(<CombatCues campaignName={null} />);
        expect(subscribeToSSE).not.toHaveBeenCalled();
    });

    it('cues every outcome family off live log appends through the real decoder', () => {
        render(<CombatCues campaignName='test-campaign' />);
        emit(logEvent({ id: 'a1', type: 'roll', rollType: 'attack', hit: true }));
        emit(logEvent({ id: 'a2', type: 'roll', rollType: 'attack', hit: true, isCrit: true, isNatural20: true }));
        emit(logEvent({ id: 'a3', type: 'roll', rollType: 'attack', hit: false, isNatural1: true }));
        emit(logEvent({ id: 'a4', type: 'roll', rollType: 'attack', hit: false }));
        emit(logEvent({ id: 's1', type: 'roll', rollType: 'save', saveResult: 'success' }));
        emit(logEvent({ id: 's2', type: 'roll', rollType: 'save', saveResult: 'failure' }));
        emit(logEvent({ id: 'd1', type: 'hp_change', threshold: 'dead', targetName: 'Goblin' }));
        emit(logEvent({ id: 'd2', type: 'hp_change', threshold: 'dead', targetName: 'Thorin', isPlayer: true }));
        emit(logEvent({ id: 'd3', type: 'death_save', characterName: 'Thorin', result: 'dead' }));
        expect(cuesPlayed()).toEqual([
            'hit', 'crit', 'fumble', 'miss',
            'save-success', 'save-failure',
            'monster-death', 'player-down', 'player-death',
        ]);
    });

    it('a duplicate delivery of the same row id cues at most once; a distinct row still voices', () => {
        render(<CombatCues campaignName='test-campaign' />);
        const critRow = { id: 'dup-1', type: 'roll', rollType: 'attack', hit: true, isCrit: true, isNatural20: true };
        emit(logEvent(critRow));
        emit(logEvent(critRow)); // exact SSE resend
        emit(logEvent({ ...critRow })); // byte-identical twin object
        emit(logEvent({ id: 'dup-2', type: 'roll', rollType: 'attack', hit: true }));
        expect(cuesPlayed()).toEqual(['crit', 'hit']);
    });

    it('the seen-guard survives a remount — a replayed row id stays silent, new ids still cue', () => {
        const view = render(<CombatCues campaignName='test-campaign' />);
        const critRow = { id: 'remount-1', type: 'roll', rollType: 'attack', hit: true, isCrit: true, isNatural20: true };
        emit(logEvent(critRow));
        view.unmount();

        // Remount: a fresh subscription receives the replayed newest row.
        subscribeToSSE.mockClear();
        render(<CombatCues campaignName='test-campaign' />);
        emit(logEvent(critRow)); // remount replay — must NOT re-cue
        expect(cuesPlayed()).toEqual(['crit']);

        // Fresh rows after the remount cue normally.
        emit(logEvent({ id: 'remount-2', type: 'hp_change', threshold: 'dead', targetName: 'Goblin' }));
        expect(cuesPlayed()).toEqual(['crit', 'monster-death']);
    });

    it('the seen-set is a bounded FIFO — distinct ids always win over stale memory', () => {
        render(<CombatCues campaignName='test-campaign' />);
        // Flood past MAX_CUED_ROW_IDS (200): every distinct row cues.
        for (let i = 0; i < 260; i++) {
            emit(logEvent({ id: `flood-${i}`, type: 'roll', rollType: 'attack', hit: true }));
        }
        expect(playCue).toHaveBeenCalledTimes(260);
        // The very first (long-evicted) id may cue again; the newest stays suppressed.
        emit(logEvent({ id: 'flood-0', type: 'roll', rollType: 'attack', hit: true }));
        expect(playCue).toHaveBeenCalledTimes(261);
        emit(logEvent({ id: 'flood-259', type: 'roll', rollType: 'attack', hit: true }));
        expect(playCue).toHaveBeenCalledTimes(261);
    });

    it('stays silent on foreign keys, key-gaps and log-clears (data:null)', () => {
        render(<CombatCues campaignName='test-campaign' />);
        emit(logEvent(null)); // log-clear event
        emit({ key: 'combatSummary-test-campaign', data: { type: 'roll', rollType: 'attack', hit: true } });
        emit({ data: null }); // no key at all
        // A row that decodes to no cue (damage) still never voices here —
        // HpFeedback owns HP movement, the attack cue already sounded.
        emit(logEvent({ id: 'x1', type: 'roll', rollType: 'damage', isCrit: true, hit: true }));
        expect(playCue).not.toHaveBeenCalled();
    });

    // ── Nat-flourish visual twin (Phase 6) ──
    describe('full-screen Nat flourish', () => {
        // The flourish is React state — an SSE callback firing outside a
        // React event needs act() to flush the render.
        const fire = (row) => act(() => emit(logEvent(row)));

        it('flourishes only the two table-moments, replaces on a fresh row, never re-flourishes a duplicate', () => {
            render(<CombatCues campaignName='test-campaign' />);
            // Ordinary hits and saves are never flourished.
            fire({ id: 'fl-1', type: 'roll', rollType: 'attack', hit: true });
            fire({ id: 'fl-2', type: 'roll', rollType: 'save', saveResult: 'success' });
            expect(document.querySelector('.nat-flourish')).toBeNull();

            // A crit renders the golden flourish, aria-hidden.
            fire({ id: 'fl-3', type: 'roll', rollType: 'attack', hit: true, isCrit: true, isNatural20: true });
            const crit = document.querySelector('.nat-flourish-crit');
            expect(crit).not.toBeNull();
            expect(crit).toHaveAttribute('aria-hidden', 'true');
            expect(crit.textContent).toBe('CRITICAL HIT!');

            // A duplicate delivery of the same row must NOT replace the live flourish.
            fire({ id: 'fl-3', type: 'roll', rollType: 'attack', hit: true, isCrit: true, isNatural20: true });
            expect(document.querySelector('.nat-flourish-crit')).toBe(crit);

            // A fresh fumble row REPLACES it with the red flourish.
            fire({ id: 'fl-4', type: 'roll', rollType: 'attack', hit: false, isNatural1: true });
            expect(document.querySelector('.nat-flourish-crit')).toBeNull();
            const fumble = document.querySelector('.nat-flourish-fumble');
            expect(fumble).not.toBeNull();
            expect(fumble.textContent).toBe('CRITICAL MISS!');
        });

        it('the flourish self-removes when its animation ends (onAnimationEnd → unmount)', () => {
            // jsdom has no animation-event plumbing: neither RTL's
            // animationEnd nor a raw bubbling AnimationEvent dispatch reaches
            // React's delegated listener (re-verified 2026-11-26), so the
            // contract is pinned on the fiber props directly; the browser
            // lifecycle is verified live (Playwright): appear → CSS keyframe →
            // animationend → onDone → removed.
            render(<CombatCues campaignName='test-campaign' />);
            fire({ id: 'fl-5', type: 'roll', rollType: 'attack', hit: true, isCrit: true, isNatural20: true });
            const flourish = document.querySelector('.nat-flourish-crit');
            expect(flourish).not.toBeNull();
            const propsKey = Object.keys(flourish).find((k) => k.startsWith('__reactProps$'));
            expect(typeof flourish[propsKey].onAnimationEnd).toBe('function');
            act(() => flourish[propsKey].onAnimationEnd());
            expect(document.querySelector('.nat-flourish')).toBeNull();
        });
    });
});
