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

    it('keeps re-roll enabled with count and tooltip while re-rolls remain', () => {
        renderDialog(baseEvent, 2);
        const reroll = screen.getByRole('button', { name: /re-roll/i });
        expect(reroll).not.toBeDisabled();
        expect(reroll).toHaveTextContent(/Re-roll\s*\(2\)/);
        expect(reroll).toHaveAttribute('title', 'Re-roll (2 remaining)');
    });

    it('disables re-roll with no count and an explanatory tooltip when none remain', () => {
        renderDialog(baseEvent, 0);
        const reroll = screen.getByRole('button', { name: /re-roll/i });
        expect(reroll).toBeDisabled();
        expect(reroll).toHaveTextContent(/^Re-roll$/);
        expect(reroll).toHaveAttribute('title', 'No re-rolls remaining');
    });
});
