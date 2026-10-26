// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventDialog from './EventDialog.jsx';

const baseEvent = {
    type: 'combat',
    title: 'Goblin Ambush',
    description: 'A group of goblins ambushes the party.',
    terrain: 'Forest',
};

const eventWithEncounter = {
    ...baseEvent,
    encounter: {
        difficultyLabel: 'Hard',
        totalXP: 400,
        monsters: [
            { qty: 3, name: 'Goblin' },
            { qty: 1, name: 'Goblin Boss' },
        ],
    },
};

describe('EventDialog', () => {
    let onAccept, onSkip, onReroll;

    beforeEach(() => {
        onAccept = vi.fn();
        onSkip = vi.fn();
        onReroll = vi.fn();
    });

    const renderDialog = (event, rerollsRemaining = 2) =>
        render(
            <EventDialog
                event={event}
                rerollsRemaining={rerollsRemaining}
                onAccept={onAccept}
                onSkip={onSkip}
                onReroll={onReroll}
            />
        );

    it('renders nothing when there is no event', () => {
        const { container } = renderDialog(null, 0);
        expect(container.firstChild).toBeNull();
    });

    it('renders the event title, description, and terrain', () => {
        renderDialog(baseEvent);
        expect(screen.getByText('Goblin Ambush')).toBeInTheDocument();
        expect(screen.getByText('A group of goblins ambushes the party.')).toBeInTheDocument();
        expect(screen.getByText('Terrain: Forest')).toBeInTheDocument();
    });

    it.each`
        buttonName    | expectedCall      | notCalled
        ${/accept/i}  | ${'onAccept'}     | ${['onSkip', 'onReroll']}
        ${/skip/i}    | ${'onSkip'}       | ${['onAccept', 'onReroll']}
        ${/re-roll/i} | ${'onReroll'}     | ${['onAccept', 'onSkip']}
    `('clicking $buttonName fires only $expectedCall', ({ buttonName, expectedCall, notCalled }) => {
        renderDialog(baseEvent);
        fireEvent.click(screen.getByRole('button', { name: buttonName }));
        const callMap = { onAccept: onAccept, onSkip: onSkip, onReroll: onReroll };
        expect(callMap[expectedCall]).toHaveBeenCalledTimes(1);
        notCalled.forEach(fnName => {
            expect(callMap[fnName]).not.toHaveBeenCalled();
        });
    });

    it.each`
        type               | typeName            | iconClass
        ${'combat'}        | ${'Combat Encounter'} | ${'fa-crosshairs'}
        ${'discovery'}     | ${'Discovery'}        | ${'fa-gem'}
        ${'hazard'}        | ${'Hazard'}           | ${'fa-triangle-exclamation'}
        ${'npc'}           | ${'NPC Encounter'}    | ${'fa-handshake'}
        ${'weatherChange'} | ${'Weather Change'}   | ${'fa-cloud-rain'}
        ${'navigation'}    | ${'Navigation'}       | ${'fa-compass'}
        ${'bogus'}         | ${'Event'}            | ${'fa-circle'}
    `('maps event type $type to "$typeName" with the $iconClass icon', ({ type, typeName, iconClass }) => {
        const { container } = renderDialog({ ...baseEvent, type });
        expect(screen.getByText(typeName)).toBeInTheDocument();
        expect(container.querySelector(`.${iconClass}`)).toBeInTheDocument();
    });

    it('omits the encounter block when the event has no encounter', () => {
        renderDialog(baseEvent);
        expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
    });

    it('renders encounter difficulty, XP, and a row per monster', () => {
        renderDialog(eventWithEncounter);
        expect(screen.getByText('Hard')).toBeInTheDocument();
        expect(screen.getByText('400 XP')).toBeInTheDocument();
        expect(screen.getByText('3x')).toBeInTheDocument();
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('1x')).toBeInTheDocument();
        expect(screen.getByText('Goblin Boss')).toBeInTheDocument();
    });

    // #790 regression: pendingEvent rides the persisted campaign runtime store
    // ('travel-pendingEvent'), and a combat event WITHOUT encounter.monsters is a
    // legal shape — HexMap.jsx's accept lane already guards it (evt.encounter?.monsters,
    // pinned by HexMap.additional.test.jsx "starts a bare encounter when the event has
    // no monsters"). The dialog must render its own empty state, never throw.
    const monstersAbsentArms = {
        'monsters key absent': { difficultyLabel: 'Hard', totalXP: 400 },
        'monsters null': { difficultyLabel: 'Hard', totalXP: 400, monsters: null },
        'monsters empty': { difficultyLabel: 'Hard', totalXP: 400, monsters: [] },
    };

    it.each(Object.entries(monstersAbsentArms))(
        'completes the render with an empty monster list when %s', (_arm, encounter) => {
            const { container } = renderDialog({ ...baseEvent, encounter });
            expect(screen.getByText('Hard')).toBeInTheDocument();
            expect(screen.getByText('400 XP')).toBeInTheDocument();
            expect(screen.getByText('Goblin Ambush')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /accept/i })).toBeEnabled();
            const list = container.querySelector('.event-monster-list');
            expect(list).toBeInTheDocument();
            expect(list.innerHTML).toBe('');
        },
    );

    it('renders the populated monster rows unchanged alongside the guard', () => {
        const { container } = renderDialog(eventWithEncounter);
        const rows = container.querySelectorAll('.event-monster-item');
        expect(rows).toHaveLength(2);
        expect(rows[0].textContent).toContain('3x');
        expect(rows[1].textContent).toContain('Goblin Boss');
    });

    // Backlog 2026-10-25 (pm): the budget is per-day (reset by Camp, 3/day in
    // useTravelManagement) — the tooltip must say so, not just the raw count.
    it('keeps re-roll enabled with count and per-day tooltip while re-rolls remain', () => {
        renderDialog(baseEvent, 2);
        const reroll = screen.getByRole('button', { name: /re-roll/i });
        expect(reroll).not.toBeDisabled();
        expect(reroll).toHaveTextContent(/Re-roll\s*\(2\)/);
        expect(reroll).toHaveAttribute('title', 'Re-roll (2 left today; resets when you Camp)');
    });

    it('disables re-roll with no count and an explanatory per-day tooltip when none remain', () => {
        renderDialog(baseEvent, 0);
        const reroll = screen.getByRole('button', { name: /re-roll/i });
        expect(reroll).toBeDisabled();
        expect(reroll).toHaveTextContent(/^Re-roll$/);
        expect(reroll).toHaveAttribute('title', 'No re-rolls left today — Camp to start a new day');
    });

    // Backlog 2026-10-25 (eve): accepting a non-combat npc event only logs
    // travel/event_accept (advisory-only), while combat spawns an arena +
    // monsters — the dialog must tell the GM the difference.
    it('shows the GM-adjudicates-off-map hint on npc events with both clauses', () => {
        const { container } = renderDialog({ ...baseEvent, type: 'npc' });
        const hint = container.querySelector('.event-dialog-hint');
        expect(hint).toBeInTheDocument();
        // Clause 1: accepting only records it — the GM adjudicates off-map.
        expect(hint.textContent).toMatch(/accepting only records/i);
        expect(hint.textContent).toMatch(/GM adjudicates .*off-map/i);
        // Clause 2: nothing spawns automatically.
        expect(hint.textContent).toMatch(/nothing spawns automatically/i);
        expect(hint.querySelector('.fa-circle-info')).toBeInTheDocument();
    });

    it('does not show the off-map hint on combat events (they spawn an arena on Accept)', () => {
        const { container } = renderDialog(baseEvent);
        expect(container.querySelector('.event-dialog-hint')).toBeNull();
    });

    it('does not show the off-map hint on weatherChange events (they regenerate weather on Accept)', () => {
        const { container } = renderDialog({ ...baseEvent, type: 'weatherChange' });
        expect(container.querySelector('.event-dialog-hint')).toBeNull();
    });
});
