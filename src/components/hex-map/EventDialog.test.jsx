// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventDialog from './EventDialog.jsx';

describe('EventDialog', () => {
    let onAccept, onSkip, onReroll;

    beforeEach(() => {
        onAccept = vi.fn();
        onSkip = vi.fn();
        onReroll = vi.fn();
    });

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

    describe('null/undefined event', () => {
        it('returns null when event is null', () => {
            const { container } = render(
                <EventDialog event={null} rerollsRemaining={0} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
            );
            expect(container.firstChild).toBeNull();
        });

        it('returns null when event is undefined', () => {
            const { container } = render(
                <EventDialog rerollsRemaining={0} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
            );
            expect(container.firstChild).toBeNull();
        });
    });

    describe('content rendering', () => {
        it('renders the event type name, title, and description', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            expect(screen.getByText('Combat Encounter')).toBeInTheDocument();
            expect(screen.getByText('Goblin Ambush')).toBeInTheDocument();
            expect(screen.getByText('A group of goblins ambushes the party.')).toBeInTheDocument();
        });

        it('renders the terrain', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            expect(screen.getByText('Terrain: Forest')).toBeInTheDocument();
        });

        it('renders empty title when title is empty string', () => {
            const event = { ...baseEvent, title: '' };
            const { container } = render(<EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            const titleEl = container.querySelector('.event-dialog-title');
            expect(titleEl).toHaveTextContent('');
        });

        it('renders empty description when description is empty string', () => {
            const event = { ...baseEvent, description: '' };
            const { container } = render(<EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            const descEl = container.querySelector('.event-dialog-description');
            expect(descEl).toHaveTextContent('');
        });

        it('renders long title and description without truncation', () => {
            const longText = 'A'.repeat(500);
            const event = { ...baseEvent, title: longText, description: longText };
            const { container } = render(<EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            const titleEl = container.querySelector('.event-dialog-title');
            const descEl = container.querySelector('.event-dialog-description');
            expect(titleEl.textContent).toBe(longText);
            expect(descEl.textContent).toBe(longText);
        });

        it('renders terrain label when terrain is empty string', () => {
            const event = { ...baseEvent, terrain: '' };
            const { container } = render(<EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            const terrainEl = container.querySelector('.event-dialog-terrain');
            expect(terrainEl.textContent).toContain('Terrain:');
        });
    });

    describe('action buttons', () => {
        it('renders accept, skip, and reroll buttons', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /re-r?o?l?l/i })).toBeInTheDocument();
        });

        it('calls onAccept when accept button is clicked', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            fireEvent.click(screen.getByRole('button', { name: /accept/i }));
            expect(onAccept).toHaveBeenCalled();
        });

        it('calls onSkip when skip button is clicked', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            fireEvent.click(screen.getByRole('button', { name: /skip/i }));
            expect(onSkip).toHaveBeenCalled();
        });

        it('calls onReroll when reroll button is clicked', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            fireEvent.click(screen.getByRole('button', { name: /re-r?o?l?l/i }));
            expect(onReroll).toHaveBeenCalled();
        });
    });

    describe('reroll button state', () => {
        it('is disabled when rerolls remaining = 0', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={0} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            const rerollBtn = screen.getByRole('button', { name: /re-r?o?l?l/i });
            expect(rerollBtn).toBeDisabled();
        });

        it('is enabled when rerolls remaining > 0', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={1} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            const rerollBtn = screen.getByRole('button', { name: /re-r?o?l?l/i });
            expect(rerollBtn).not.toBeDisabled();
        });

        it('shows reroll count when rerolls remaining > 0', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={3} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            expect(screen.getByText('(3)')).toBeInTheDocument();
        });

        it('does not show reroll count when rerolls remaining = 0', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={0} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            expect(screen.queryByText('(0)')).not.toBeInTheDocument();
        });

        it('shows correct title when rerolls remaining > 0', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            const rerollBtn = screen.getByRole('button', { name: /re-r?o?l?l/i });
            expect(rerollBtn).toHaveAttribute('title', 'Re-roll (2 remaining)');
        });

        it('shows correct title when rerolls remaining = 0', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={0} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            const rerollBtn = screen.getByRole('button', { name: /re-r?o?l?l/i });
            expect(rerollBtn).toHaveAttribute('title', 'No re-rolls remaining');
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
        `('renders the correct icon for $type type', ({ type, iconClass }) => {
            const event = { ...baseEvent, type };
            render(<EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            const icon = document.querySelector(`.${iconClass}`);
            expect(icon).toBeInTheDocument();
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
        `('renders the correct type name for $type type', ({ type, expectedName }) => {
            const event = { ...baseEvent, type };
            render(<EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            expect(screen.getByText(expectedName)).toBeInTheDocument();
        });
    });

    describe('encounter info', () => {
        it('does not render encounter info when encounter is absent', () => {
            const { container } = render(
                <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
            );
            expect(container.querySelector('.event-encounter-info')).not.toBeInTheDocument();
        });

        it('renders encounter info when encounter is present', () => {
            render(<EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            expect(screen.getByText('Hard')).toBeInTheDocument();
            expect(screen.getByText('400 XP')).toBeInTheDocument();
            expect(screen.getByText('3x')).toBeInTheDocument();
            expect(screen.getByText('1x')).toBeInTheDocument();
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.getByText('Goblin Boss')).toBeInTheDocument();
        });

        it('renders encounter difficulty attribute', () => {
            const { container } = render(
                <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
            );
            const difficulty = container.querySelector('[data-difficulty="Hard"]');
            expect(difficulty).toBeInTheDocument();
        });

        it('renders zero XP correctly', () => {
            const event = {
                ...baseEvent,
                encounter: { ...eventWithEncounter.encounter, totalXP: 0 },
            };
            render(<EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            expect(screen.getByText('0 XP')).toBeInTheDocument();
        });

        it('renders many monsters correctly', () => {
            const event = {
                ...baseEvent,
                encounter: {
                    ...eventWithEncounter.encounter,
                    monsters: [
                        { qty: 5, name: 'Skeleton' },
                        { qty: 3, name: 'Zombie' },
                        { qty: 2, name: 'Wight' },
                    ],
                },
            };
            render(<EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            expect(screen.getByText('5x')).toBeInTheDocument();
            expect(screen.getByText('Skeleton')).toBeInTheDocument();
            expect(screen.getByText('3x')).toBeInTheDocument();
            expect(screen.getByText('Zombie')).toBeInTheDocument();
            expect(screen.getByText('2x')).toBeInTheDocument();
            expect(screen.getByText('Wight')).toBeInTheDocument();
        });
    });

    describe('button icons', () => {
        it.each`
            buttonName      | iconClass
            ${'accept'}     | ${'fa-check'}
            ${'skip'}       | ${'fa-xmark'}
            ${'reroll'}     | ${'fa-dice'}
        `('renders Font Awesome icon $iconClass in $buttonName button', ({ iconClass }) => {
            render(<EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            const icon = document.querySelector(`.${iconClass}`);
            expect(icon).toBeInTheDocument();
        });
    });

    describe('color styling', () => {
        it.each`
            type             | expectedColor
            ${'combat'}      | ${'rgb(204, 68, 68)'}
            ${'discovery'}   | ${'rgb(255, 215, 0)'}
            ${'npc'}         | ${'rgb(91, 160, 217)'}
            ${'unknown'}     | ${'rgb(136, 136, 136)'}
        `('applies correct color for $type type', ({ type, expectedColor }) => {
            const event = { ...baseEvent, type };
            const { container } = render(
                <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
            );
            const icon = container.querySelector('.event-dialog-icon');
            expect(icon.style.color).toBe(expectedColor);
        });
    });
});
