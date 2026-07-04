// @cleaned-by-ai
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
        it('returns null when event is falsy', () => {
            const { container } = render(
                <EventDialog event={null} rerollsRemaining={0} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
            );
            expect(container.firstChild).toBeNull();
        });
    });

    describe('content rendering', () => {
        it('renders the event title and description', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            expect(screen.getByText('Goblin Ambush')).toBeInTheDocument();
            expect(screen.getByText('A group of goblins ambushes the party.')).toBeInTheDocument();
        });

        it('renders the terrain', () => {
            render(<EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />);
            expect(screen.getByText('Terrain: Forest')).toBeInTheDocument();
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
            expect(screen.getByText('Goblin')).toBeInTheDocument();
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
            expect(screen.getByText('Skeleton')).toBeInTheDocument();
            expect(screen.getByText('Zombie')).toBeInTheDocument();
            expect(screen.getByText('Wight')).toBeInTheDocument();
            expect(screen.getByText('5x')).toBeInTheDocument();
            expect(screen.getByText('3x')).toBeInTheDocument();
            expect(screen.getByText('2x')).toBeInTheDocument();
        });
    });
});
