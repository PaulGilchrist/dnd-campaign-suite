// @maintained-by-ai
// Roadmap Item 5 (TV shared dice) unit lanes: the panel projects ONLY rolls
// that land after the log lane initializes (baseline), decodes them through
// the log's own RollEntry (HIT/MISS vs AC, dice faces, NAT 20/FUMBLE/
// advantage flair, damage), and replaces oldest-out on rapid rolls — a bounded
// newest-first row of TV_ROLL_PANEL_SIZE slots, never a stack. useLog is the
// only seam mocked; the RollEntry decode runs for real (it is the reuse).
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TvRollPanel, { TV_ROLL_PANEL_SIZE } from './TvRollPanel.jsx';

let mockLog;
vi.mock('../../hooks/runtime/useLog.js', () => ({
    default: () => mockLog,
}));

const roll = (id, overrides = {}) => ({
    id,
    type: 'roll',
    rollType: 'attack',
    characterName: 'Alice',
    name: 'Longsword',
    timestamp: 1763500000000,
    rolls: [17],
    total: 17,
    bonus: 5,
    mode: 'normal',
    targetName: 'Goblin',
    targetAc: 15,
    hit: true,
    ...overrides,
});

const setLog = (view, logEntries, initialized = true) => {
    mockLog = { logEntries, initialized, addEntry: vi.fn() };
    act(() => { view.rerender(<TvRollPanel tvMode campaignName='test-campaign' />); });
};

describe('TvRollPanel', () => {
    let view;

    beforeEach(() => {
        mockLog = { logEntries: [], initialized: false, addEntry: vi.fn() };
        view = render(<TvRollPanel tvMode campaignName='test-campaign' />);
    });

    it('off-TV the live panel never mounts (no log subscription, no projection)', () => {
        // With rolls READY in the lane, a non-TV screen still shows nothing:
        // the gate returns before the live child (where useLog runs) mounts.
        mockLog = { logEntries: [roll('r1')], initialized: true, addEntry: vi.fn() };
        const off = render(<TvRollPanel tvMode={false} campaignName='test-campaign' />);
        expect(document.querySelector('.tv-roll-panel')).toBeNull();
        off.unmount();
    });

    it('projects an attack that lands after init with its full breakdown; pre-existing rolls stay silent', () => {
        // Pre-existing rolls in the initial log load are baseline, never shown.
        setLog(view, [roll('old', { characterName: 'Stale Steve' })]);
        expect(document.querySelector('.tv-roll-panel')).toBeNull();

        // A fresh SSE-delivered roll entry replaces the baseline window.
        setLog(view, [
            roll('old', { characterName: 'Stale Steve' }),
            roll('new', { characterName: 'Alice', name: 'Longsword' }),
        ]);
        const panel = document.querySelector('.tv-roll-panel');
        expect(panel).not.toBeNull();
        expect(screen.getByRole('log', { name: 'Recent roll results' })).toBeInTheDocument();
        expect(panel).toHaveTextContent('Alice');
        expect(panel).toHaveTextContent('Longsword');
        expect(panel).toHaveTextContent('→ Goblin');
        expect(panel).toHaveTextContent('HIT (AC 15)');
        expect(panel).toHaveTextContent('17+5'); // die total + modifier, per the log skin
        expect(panel).not.toHaveTextContent('Stale Steve');
    });

    it('maps crit/fumble/advantage flair through the shared log decode', () => {
        setLog(view, []); // init completes on an empty log
        setLog(view, [
            roll('crit', { characterName: 'Critty', isCrit: true, isNatural20: true, mode: 'advantage', rolls: [8, 20], total: 20 }),
            roll('fumble', { id: 'fumble', characterName: 'Fumbles', hit: false, isNatural1: true, total: 1, rolls: [1] }),
            roll('adv', { characterName: 'AdvAntage', mode: 'advantage', rolls: [8, 19], total: 19 }),
        ]);
        const slots = document.querySelectorAll('.tv-roll-slot');
        expect(slots).toHaveLength(3);

        // Newest first: the adv roll is leftmost, then fumble, then crit.
        expect(slots[0]).toHaveTextContent('AdvAntage');
        expect(slots[0]).toHaveTextContent('ADVANTAGE');
        // Dice faces where sensible: both d20 faces with the kept one selected.
        expect(slots[0]).toHaveTextContent('(19 selected)');
        expect(slots[0]).toHaveTextContent('(8 discarded)');
        expect(slots[1]).toHaveTextContent('FUMBLE');
        expect(slots[1]).toHaveTextContent('Critical Miss!');
        expect(slots[1].querySelector('.log-entry')).toHaveClass('log-nat1');
        expect(slots[2].querySelector('.log-entry')).toHaveClass('log-nat20');
        expect(slots[2]).toHaveTextContent('NAT 20');
        expect(slots[2]).toHaveTextContent('Critical Hit!');
    });

    it('bounds the panel: rapid rolls replace the oldest, newest-first, never a stack', () => {
        setLog(view, []);
        const many = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id, i) =>
            roll(id, { characterName: `Roller${i + 1}` })
        );
        setLog(view, many);
        const slots = document.querySelectorAll('.tv-roll-slot');
        expect(slots).toHaveLength(TV_ROLL_PANEL_SIZE);
        expect(slots[0]).toHaveTextContent('Roller5'); // newest leftmost
        expect(slots[1]).toHaveTextContent('Roller4');
        expect(slots[2]).toHaveTextContent('Roller3');
        const panel = document.querySelector('.tv-roll-panel');
        expect(panel).not.toHaveTextContent('Roller1');
        expect(panel).not.toHaveTextContent('Roller2');
    });

    it('ignores non-roll log entries and unmounts when nothing rolls landed', () => {
        setLog(view, []);
        setLog(view, [{ id: 'n1', type: 'note', characterName: 'GM', noteText: 'goblins at the door', timestamp: 1763500000000 }]);
        expect(document.querySelector('.tv-roll-panel')).toBeNull();

        setLog(view, [
            { id: 'n1', type: 'note', characterName: 'GM', noteText: 'goblins at the door', timestamp: 1763500000000 },
            roll('r1', { characterName: 'Alice' }),
        ]);
        expect(document.querySelectorAll('.tv-roll-slot')).toHaveLength(1);
    });

    it('emptying the log (clear event) empties the panel', () => {
        setLog(view, []);
        setLog(view, [roll('r1')]);
        expect(document.querySelectorAll('.tv-roll-slot')).toHaveLength(1);
        setLog(view, []);
        expect(document.querySelector('.tv-roll-panel')).toBeNull();
    });
});
