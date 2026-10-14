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

    describe('no event', () => {
        it.each`
            value         | label
            ${null}       | ${'null'}
            ${undefined}  | ${'undefined'}
        `('renders nothing when event is $label', ({ value }) => {
            const { container } = renderDialog(value, 0);
            expect(container.firstChild).toBeNull();
        });
    });

    describe('content rendering', () => {
        it('renders the title, description, and terrain', () => {
            renderDialog(baseEvent);
            expect(screen.getByText('Goblin Ambush')).toBeInTheDocument();
            expect(screen.getByText('A group of goblins ambushes the party.')).toBeInTheDocument();
            expect(screen.getByText('Terrain: Forest')).toBeInTheDocument();
        });
    });

    describe('action buttons', () => {
        it('renders accept, skip, and reroll buttons', () => {
            renderDialog(baseEvent);
            expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /re-roll/i })).toBeInTheDocument();
        });

        it.each`
            buttonName    | expectedCall      | notCalled
            ${/accept/i}  | ${'onAccept'}     | ${['onSkip', 'onReroll']}
            ${/skip/i}    | ${'onSkip'}       | ${['onAccept', 'onReroll']}
            ${/re-roll/i} | ${'onReroll'}     | ${['onAccept', 'onSkip']}
        `('calls $expectedCall when $buttonName is clicked', ({ buttonName, expectedCall, notCalled }) => {
            renderDialog(baseEvent);
            fireEvent.click(screen.getByRole('button', { name: buttonName }));
            const callMap = { onAccept: onAccept, onSkip: onSkip, onReroll: onReroll };
            expect(callMap[expectedCall]).toHaveBeenCalledTimes(1);
            notCalled.forEach(fnName => {
                expect(callMap[fnName]).not.toHaveBeenCalled();
            });
        });
    });

    describe('reroll button state', () => {
        it.each`
            rerollsRemaining
            ${0}
            ${-1}
        `('is disabled when rerollsRemaining is $rerollsRemaining', ({ rerollsRemaining }) => {
            renderDialog(baseEvent, rerollsRemaining);
            expect(screen.getByRole('button', { name: /re-roll/i })).toBeDisabled();
        });

        it('is enabled when re-rolls remain', () => {
            renderDialog(baseEvent, 1);
            expect(screen.getByRole('button', { name: /re-roll/i })).not.toBeDisabled();
        });

        it.each`
            rerollsRemaining | expectedPattern
            ${3}             | ${/Re-roll\s*\(3\)/}
            ${0}             | ${/^Re-roll$/}
        `('shows count in button text when rerollsRemaining is $rerollsRemaining', ({ rerollsRemaining, expectedPattern }) => {
            renderDialog(baseEvent, rerollsRemaining);
            expect(screen.getByRole('button', { name: /re-roll/i })).toHaveTextContent(expectedPattern);
        });

        it.each`
            rerollsRemaining | expectedTitle
            ${2}             | ${'Re-roll (2 remaining)'}
            ${0}             | ${'No re-rolls remaining'}
        `('sets the reroll tooltip to "$expectedTitle" when $rerollsRemaining re-rolls remain', ({ rerollsRemaining, expectedTitle }) => {
            renderDialog(baseEvent, rerollsRemaining);
            expect(screen.getByRole('button', { name: /re-roll/i })).toHaveAttribute('title', expectedTitle);
        });
    });

    describe('event type icons', () => {
        it.each`
            type             | iconClass
            ${'combat'}      | ${'fa-crosshairs'}
            ${'discovery'}   | ${'fa-gem'}
            ${'hazard'}      | ${'fa-triangle-exclamation'}
            ${'npc'}         | ${'fa-handshake'}
            ${'weatherChange'} | ${'fa-cloud-rain'}
            ${'navigation'}  | ${'fa-compass'}
            ${'unknown'}     | ${'fa-circle'}
        `('renders the $type icon for a $type event', ({ type, iconClass }) => {
            const { container } = renderDialog({ ...baseEvent, type });
            expect(container.querySelector(`.${iconClass}`)).toBeInTheDocument();
        });
    });

    describe('event type names', () => {
        it.each`
            type             | expectedName
            ${'combat'}      | ${'Combat Encounter'}
            ${'discovery'}   | ${'Discovery'}
            ${'hazard'}      | ${'Hazard'}
            ${'npc'}         | ${'NPC Encounter'}
            ${'weatherChange'} | ${'Weather Change'}
            ${'navigation'}  | ${'Navigation'}
            ${'unknown'}     | ${'Event'}
        `('renders "$expectedName" for a $type event', ({ type, expectedName }) => {
            renderDialog({ ...baseEvent, type });
            expect(screen.getByText(expectedName)).toBeInTheDocument();
        });
    });

    describe('encounter info', () => {
        it('does not render encounter info when the event has no encounter', () => {
            const { container } = renderDialog(baseEvent);
            expect(container.querySelector('.event-encounter-info')).not.toBeInTheDocument();
        });

        it('renders the difficulty, XP, and each monster row when an encounter is present', () => {
            renderDialog(eventWithEncounter);
            expect(screen.getByText('Hard')).toBeInTheDocument();
            expect(screen.getByText('400 XP')).toBeInTheDocument();
            expect(screen.getByText('3x')).toBeInTheDocument();
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.getByText('1x')).toBeInTheDocument();
            expect(screen.getByText('Goblin Boss')).toBeInTheDocument();
        });

        it('renders difficulty and XP but no monster rows for an empty monster list', () => {
            const event = {
                ...baseEvent,
                encounter: {
                    difficultyLabel: 'Easy',
                    totalXP: 0,
                    monsters: [],
                },
            };
            const { container } = renderDialog(event);
            expect(screen.getByText('Easy')).toBeInTheDocument();
            expect(screen.getByText('0 XP')).toBeInTheDocument();
            expect(container.querySelector('.event-monster-item')).not.toBeInTheDocument();
        });
    });
});
