// @maintained-by-ai
// Roadmap Item 10 (sensory cues) — the log-lane attack-outcome consumer.
// subscribeToSSE is the only seam mocked (the shared-singleton law is its own
// suite's job); the cueForRollEntry decode runs for real, only playCue is
// spied. Pins: one subscription per campaign, cue per live attack append
// (crit/hit/miss/fumble through the real decoder), silence for everything
// else (damage entries, notes, log-clear data:null, other keys), and clean
// unsubscribe on unmount. There is deliberately NO initial GET — mounts
// never replay a backlog.
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CombatCues from './CombatCues.jsx';
import { subscribeToSSE } from '../../services/ui/sseClient.js';
import { playCue } from '../../services/ui/audioCues.js';

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
        emit(logEvent({ type: 'roll', rollType: 'attack', hit: true }));
        emit(logEvent({ type: 'roll', rollType: 'attack', hit: true, isCrit: true, isNatural20: true }));
        emit(logEvent({ type: 'roll', rollType: 'attack', hit: false, isNatural1: true }));
        emit(logEvent({ type: 'roll', rollType: 'attack', hit: false }));
        expect(playCue.mock.calls.map(([cue]) => cue)).toEqual(['hit', 'crit', 'fumble', 'miss']);
    });

    it('stays silent on damage/save entries, notes, log-clears and foreign keys', () => {
        render(<CombatCues campaignName='test-campaign' />);
        emit(logEvent({ type: 'roll', rollType: 'damage', isCrit: true, hit: true }));
        emit(logEvent({ type: 'roll', rollType: 'save' }));
        emit(logEvent({ type: 'note' }));
        emit(logEvent(null));
        emit({ key: 'combatSummary-test-campaign', data: { type: 'roll', rollType: 'attack', hit: true } });
        emit({ data: null });
        expect(playCue).not.toHaveBeenCalled();
    });
});
