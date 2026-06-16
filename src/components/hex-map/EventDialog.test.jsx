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

    it('should return null when event is null', () => {
        const { container } = render(
            <EventDialog event={null} rerollsRemaining={0} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('should return null when event is undefined', () => {
        const { container } = render(
            <EventDialog rerollsRemaining={0} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('should render the event dialog overlay', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-dialog-overlay')).toBeInTheDocument();
    });

    it('should render the event dialog container', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-dialog')).toBeInTheDocument();
    });

    it('should render the event dialog header', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-dialog-header')).toBeInTheDocument();
    });

    it('should render the event dialog body', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-dialog-body')).toBeInTheDocument();
    });

    it('should render the event dialog actions', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-dialog-actions')).toBeInTheDocument();
    });

    it('should render the correct icon for combat type', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const icon = document.querySelector('.event-dialog-icon .fa-crosshairs');
        expect(icon).toBeInTheDocument();
    });

    it('should render the correct icon for discovery type', () => {
        const event = { ...baseEvent, type: 'discovery' };
        render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const icon = document.querySelector('.event-dialog-icon .fa-gem');
        expect(icon).toBeInTheDocument();
    });

    it('should render the correct icon for hazard type', () => {
        const event = { ...baseEvent, type: 'hazard' };
        render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const icon = document.querySelector('.event-dialog-icon .fa-triangle-exclamation');
        expect(icon).toBeInTheDocument();
    });

    it('should render the correct icon for npc type', () => {
        const event = { ...baseEvent, type: 'npc' };
        render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const icon = document.querySelector('.event-dialog-icon .fa-handshake');
        expect(icon).toBeInTheDocument();
    });

    it('should render the correct icon for weatherChange type', () => {
        const event = { ...baseEvent, type: 'weatherChange' };
        render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const icon = document.querySelector('.event-dialog-icon .fa-cloud-rain');
        expect(icon).toBeInTheDocument();
    });

    it('should render the correct icon for navigation type', () => {
        const event = { ...baseEvent, type: 'navigation' };
        render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const icon = document.querySelector('.event-dialog-icon .fa-compass');
        expect(icon).toBeInTheDocument();
    });

    it('should render a default circle icon for unknown type', () => {
        const event = { ...baseEvent, type: 'unknown' };
        render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const icon = document.querySelector('.event-dialog-icon .fa-circle');
        expect(icon).toBeInTheDocument();
    });

    it('should apply correct color for combat type', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const header = container.querySelector('.event-dialog-header');
        expect(header.style.borderLeftColor).toMatch(/rgb\(204,\s*68,\s*68\)/);
    });

    it('should apply correct color for discovery type', () => {
        const event = { ...baseEvent, type: 'discovery' };
        const { container } = render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const header = container.querySelector('.event-dialog-header');
        expect(header.style.borderLeftColor).toMatch(/rgb\(255,\s*215,\s*0\)/);
    });

    it('should apply correct color for npc type', () => {
        const event = { ...baseEvent, type: 'npc' };
        const { container } = render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const header = container.querySelector('.event-dialog-header');
        expect(header.style.borderLeftColor).toMatch(/rgb\(91,\s*160,\s*217\)/);
    });

    it('should apply default color for unknown type', () => {
        const event = { ...baseEvent, type: 'unknown' };
        const { container } = render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const header = container.querySelector('.event-dialog-header');
        expect(header.style.borderLeftColor).toMatch(/rgb\(136,\s*136,\s*136\)/);
    });

    it('should render the event type name', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('Combat Encounter')).toBeInTheDocument();
    });

    it('should render the event title', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('Goblin Ambush')).toBeInTheDocument();
    });

    it('should render the event description', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('A group of goblins ambushes the party.')).toBeInTheDocument();
    });

    it('should render the terrain', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('Terrain: Forest')).toBeInTheDocument();
    });

    it('should render the accept button', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    });

    it('should render the skip button', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
    });

    it('should render the reroll button', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByRole('button', { name: /re-r?o?l?l/i })).toBeInTheDocument();
    });

    it('should call onAccept when accept button is clicked', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        fireEvent.click(screen.getByRole('button', { name: /accept/i }));
        expect(onAccept).toHaveBeenCalled();
    });

    it('should call onSkip when skip button is clicked', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        fireEvent.click(screen.getByRole('button', { name: /skip/i }));
        expect(onSkip).toHaveBeenCalled();
    });

    it('should call onReroll when reroll button is clicked', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        fireEvent.click(screen.getByRole('button', { name: /re-r?o?l?l/i }));
        expect(onReroll).toHaveBeenCalled();
    });

    it('should show reroll count when rerolls remaining > 0', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={3} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('(3)')).toBeInTheDocument();
    });

    it('should show reroll count when rerolls remaining = 1', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={1} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('(1)')).toBeInTheDocument();
    });

    it('should not show reroll count when rerolls remaining = 0', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={0} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.queryByText('(0)')).not.toBeInTheDocument();
    });

    it('should disable reroll button when rerolls remaining = 0', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={0} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const rerollBtn = screen.getByRole('button', { name: /re-r?o?l?l/i });
        expect(rerollBtn).toBeDisabled();
    });

    it('should not disable reroll button when rerolls remaining > 0', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={1} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const rerollBtn = screen.getByRole('button', { name: /re-r?o?l?l/i });
        expect(rerollBtn).not.toBeDisabled();
    });

    it('should show correct title when rerolls remaining > 0', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const rerollBtn = screen.getByRole('button', { name: /re-r?o?l?l/i });
        expect(rerollBtn).toHaveAttribute('title', 'Re-roll (2 remaining)');
    });

    it('should show correct title when rerolls remaining = 0', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={0} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const rerollBtn = screen.getByRole('button', { name: /re-r?o?l?l/i });
        expect(rerollBtn).toHaveAttribute('title', 'No re-rolls remaining');
    });

    it('should not render encounter info when encounter is absent', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-encounter-info')).not.toBeInTheDocument();
    });

    it('should render encounter info when encounter is present', () => {
        const { container } = render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-encounter-info')).toBeInTheDocument();
    });

    it('should render encounter difficulty label', () => {
        render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('Hard')).toBeInTheDocument();
    });

    it('should render encounter XP', () => {
        render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('400 XP')).toBeInTheDocument();
    });

    it('should render the shield icon in encounter header', () => {
        render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const shield = document.querySelector('.fa-shield-halved');
        expect(shield).toBeInTheDocument();
    });

    it('should render monster list when encounter is present', () => {
        const { container } = render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-monster-list')).toBeInTheDocument();
    });

    it('should render each monster item', () => {
        const { container } = render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const monsterItems = container.querySelectorAll('.event-monster-item');
        expect(monsterItems.length).toBe(2);
    });

    it('should render monster quantity', () => {
        render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('3x')).toBeInTheDocument();
        expect(screen.getByText('1x')).toBeInTheDocument();
    });

    it('should render monster names', () => {
        render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Goblin Boss')).toBeInTheDocument();
    });

    it('should render a skull icon for each monster', () => {
        const { container } = render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const skulls = container.querySelectorAll('.fa-skull');
        expect(skulls.length).toBe(2);
    });

    it('should render the correct type name for discovery', () => {
        const event = { ...baseEvent, type: 'discovery' };
        render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('Discovery')).toBeInTheDocument();
    });

    it('should render the correct type name for hazard', () => {
        const event = { ...baseEvent, type: 'hazard' };
        render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('Hazard')).toBeInTheDocument();
    });

    it('should render the correct type name for npc', () => {
        const event = { ...baseEvent, type: 'npc' };
        render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('NPC Encounter')).toBeInTheDocument();
    });

    it('should render the correct type name for weatherChange', () => {
        const event = { ...baseEvent, type: 'weatherChange' };
        render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('Weather Change')).toBeInTheDocument();
    });

    it('should render the correct type name for navigation', () => {
        const event = { ...baseEvent, type: 'navigation' };
        render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('Navigation')).toBeInTheDocument();
    });

    it('should render default type name for unknown type', () => {
        const event = { ...baseEvent, type: 'unknown' };
        render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(screen.getByText('Event')).toBeInTheDocument();
    });

    it('should render the accept button with correct class', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-btn-accept')).toBeInTheDocument();
    });

    it('should render the skip button with correct class', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-btn-skip')).toBeInTheDocument();
    });

    it('should render the reroll button with correct class', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-btn-reroll')).toBeInTheDocument();
    });

    it('should render Font Awesome icons in accept button', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const checkIcon = document.querySelector('.fa-check');
        expect(checkIcon).toBeInTheDocument();
    });

    it('should render Font Awesome icons in skip button', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const xmarkIcon = document.querySelector('.fa-xmark');
        expect(xmarkIcon).toBeInTheDocument();
    });

    it('should render Font Awesome icons in reroll button', () => {
        render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const diceIcon = document.querySelector('.fa-dice');
        expect(diceIcon).toBeInTheDocument();
    });

    it('should render reroll count span inside reroll button', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const rerollBtn = container.querySelector('.event-btn-reroll');
        const countSpan = rerollBtn.querySelector('.reroll-count');
        expect(countSpan).toBeInTheDocument();
        expect(countSpan.textContent).toBe('(2)');
    });

    it('should not render reroll count span when rerolls remaining = 0', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={0} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const rerollBtn = container.querySelector('.event-btn-reroll');
        const countSpan = rerollBtn.querySelector('.reroll-count');
        expect(countSpan).not.toBeInTheDocument();
    });

    it('should render the encounter difficulty attribute', () => {
        render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const difficulty = document.querySelector('[data-difficulty="Hard"]');
        expect(difficulty).toBeInTheDocument();
    });

    it('should render the event-dialog-icon element', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-dialog-icon')).toBeInTheDocument();
    });

    it('should render the event-dialog-title-group element', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-dialog-title-group')).toBeInTheDocument();
    });

    it('should render the event-dialog-type element', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-dialog-type')).toBeInTheDocument();
    });

    it('should render the event-dialog-title element', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-dialog-title')).toBeInTheDocument();
    });

    it('should render the event-dialog-description element', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-dialog-description')).toBeInTheDocument();
    });

    it('should render the event-dialog-terrain element', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-dialog-terrain')).toBeInTheDocument();
    });

    it('should render the event-encounter-header element', () => {
        const { container } = render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-encounter-header')).toBeInTheDocument();
    });

    it('should render the event-encounter-difficulty element', () => {
        const { container } = render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-encounter-difficulty')).toBeInTheDocument();
    });

    it('should render the event-encounter-xp element', () => {
        const { container } = render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-encounter-xp')).toBeInTheDocument();
    });

    it('should render the event-monster-qty element', () => {
        const { container } = render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-monster-qty')).toBeInTheDocument();
    });

    it('should render the event-monster-name element', () => {
        const { container } = render(
            <EventDialog event={eventWithEncounter} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        expect(container.querySelector('.event-monster-name')).toBeInTheDocument();
    });

    it('should render all three action buttons', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const buttons = container.querySelectorAll('.event-btn');
        expect(buttons.length).toBe(3);
    });

    it('should have the icon color matching the event type', () => {
        const event = { ...baseEvent, type: 'discovery' };
        const { container } = render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const icon = container.querySelector('.event-dialog-icon');
        expect(icon.style.color).toMatch(/rgb\(255,\s*215,\s*0\)/);
    });

    it('should have the icon color matching combat type', () => {
        const { container } = render(
            <EventDialog event={baseEvent} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const icon = container.querySelector('.event-dialog-icon');
        expect(icon.style.color).toMatch(/rgb\(204,\s*68,\s*68\)/);
    });

    it('should have the icon color default for unknown type', () => {
        const event = { ...baseEvent, type: 'unknown' };
        const { container } = render(
            <EventDialog event={event} rerollsRemaining={2} onAccept={onAccept} onSkip={onSkip} onReroll={onReroll} />
        );
        const icon = container.querySelector('.event-dialog-icon');
        expect(icon.style.color).toMatch(/rgb\(136,\s*136,\s*136\)/);
    });
});
