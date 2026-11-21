// @maintained-by-ai
// Roadmap Item 10 (sensory cues) — the log-lane outcome consumer.
// subscribeToSSE is the only seam mocked (the shared-singleton law is its own
// suite's job); the cueForLogEntry decode runs for real, only playCue is
// spied. Pins: one subscription per campaign, cue per live attack/save/death
// append (crit/hit/miss/fumble, save success/failure, monster-death,
// player-down, player-death through the real decoder), silence for everything
// else (damage entries, concentration saves, notes, log-clear data:null,
// other keys), PER-ROW idempotence (a duplicate delivery of the same row id
// cues once, and the module-level seen-guard survives a remount), and clean
// unsubscribe on unmount. There is deliberately NO initial GET — mounts never
// replay a backlog. Row fixtures carry a server-style id because every log.js
// append stamps one on the wire.
import { render } from '@testing-library/react';
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

beforeEach(() => {
    subscribeToSSE.mockClear();
    playCue.mockClear();
    resetAudioCues(); // cold audio module, incl. the cued-row seen-set
});

describe('CombatCues', () => {
    it('renders nothing and never fetches on mount (SSE-only, no backlog replay)', () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const { container } = render(<CombatCues campaignName='test-campaign' />);
        expect(container).toBeEmptyDOMElement();
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });

    it('subscribes to the shared lane per campaign and unsubscribes on unmount', () => {
        const cleanup = vi.fn();
        subscribeToSSE.mockReturnValueOnce(cleanup);
        const view = render(<CombatCues campaignName='test-campaign' />);
        expect(subscribeToSSE).toHaveBeenCalledWith('test-campaign', expect.any(Function));
        view.unmount();
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('does not subscribe without a campaign', () => {
        render(<CombatCues campaignName={null} />);
        expect(subscribeToSSE).not.toHaveBeenCalled();
    });

    it('cues attack outcomes off live log appends', () => {
        render(<CombatCues campaignName='test-campaign' />);
        emit(logEvent({ id: 'a1', type: 'roll', rollType: 'attack', hit: true }));
        emit(logEvent({ id: 'a2', type: 'roll', rollType: 'attack', hit: true, isCrit: true, isNatural20: true }));
        emit(logEvent({ id: 'a3', type: 'roll', rollType: 'attack', hit: false, isNatural1: true }));
        emit(logEvent({ id: 'a4', type: 'roll', rollType: 'attack', hit: false }));
        expect(playCue.mock.calls.map(([cue]) => cue)).toEqual(['hit', 'crit', 'fumble', 'miss']);
    });

    it('cues save outcomes and deaths off live log appends', () => {
        render(<CombatCues campaignName='test-campaign' />);
        emit(logEvent({ id: 's1', type: 'roll', rollType: 'save', saveResult: 'success' }));
        emit(logEvent({ id: 's2', type: 'roll', rollType: 'save', saveResult: 'failure' }));
        emit(logEvent({ id: 'd1', type: 'hp_change', threshold: 'dead', targetName: 'Goblin' }));
        emit(logEvent({ id: 'd2', type: 'hp_change', threshold: 'dead', targetName: 'Thorin', isPlayer: true }));
        emit(logEvent({ id: 'd3', type: 'death_save', characterName: 'Thorin', result: 'dead' }));
        expect(playCue.mock.calls.map(([cue]) => cue)).toEqual([
            'save-success', 'save-failure', 'monster-death', 'player-down', 'player-death',
        ]);
    });

    it('cues each distinct row id exactly once across a barrage (never suppressed)', () => {
        render(<CombatCues campaignName='test-campaign' />);
        const ids = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'];
        ids.forEach((id) => emit(logEvent({ id, type: 'roll', rollType: 'attack', hit: true })));
        expect(playCue.mock.calls.map(([cue]) => cue)).toEqual(Array(7).fill('hit'));
    });

    it('a duplicate delivery of the same row id cues at most once', () => {
        render(<CombatCues campaignName='test-campaign' />);
        const critRow = { id: 'dup-1', type: 'roll', rollType: 'attack', hit: true, isCrit: true, isNatural20: true };
        emit(logEvent(critRow));
        emit(logEvent(critRow)); // exact SSE resend
        emit(logEvent({ ...critRow })); // byte-identical twin object
        // A distinct row still voices right after the suppressed dups.
        emit(logEvent({ id: 'dup-2', type: 'roll', rollType: 'attack', hit: true }));
        expect(playCue.mock.calls.map(([cue]) => cue)).toEqual(['crit', 'hit']);
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
        expect(playCue.mock.calls.map(([cue]) => cue)).toEqual(['crit']);

        // Fresh rows after the remount cue normally.
        emit(logEvent({ id: 'remount-2', type: 'hp_change', threshold: 'dead', targetName: 'Goblin' }));
        expect(playCue.mock.calls.map(([cue]) => cue)).toEqual(['crit', 'monster-death']);
    });

    it('the seen-set is a bounded FIFO — distinct ids always win over stale memory', () => {
        render(<CombatCues campaignName='test-campaign' />);
        // Flood past MAX_CUED_ROW_IDS: every distinct row cues (N cues for N rows).
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

    it('stays silent on damage entries, concentration saves, notes, log-clears and foreign keys', () => {
        render(<CombatCues campaignName='test-campaign' />);
        emit(logEvent({ type: 'roll', rollType: 'damage', isCrit: true, hit: true }));
        emit(logEvent({ type: 'roll', rollType: 'save', name: 'Concentration Save', saveResult: 'success' }));
        emit(logEvent({ type: 'roll', rollType: 'save' }));
        emit(logEvent({ type: 'hp_change', threshold: 'bloodied', targetName: 'Goblin' }));
        emit(logEvent({ type: 'death_save', characterName: 'Thorin', success: true }));
        emit(logEvent({ type: 'note' }));
        emit(logEvent(null));
        emit({ key: 'combatSummary-test-campaign', data: { type: 'roll', rollType: 'attack', hit: true } });
        emit({ data: null });
        expect(playCue).not.toHaveBeenCalled();
    });
});
