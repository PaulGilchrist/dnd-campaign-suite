import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import ConditionChoiceModal from './ConditionChoiceModal.jsx';

describe('ConditionChoiceModal', () => {
    function showModal(detail) {
        act(() => {
            window.dispatchEvent(new CustomEvent('condition-choice-show', { detail }));
        });
    }

    function listenForEvent(eventName) {
        return new Promise((resolve) => {
            const handler = (event) => {
                resolve(event);
                window.removeEventListener(eventName, handler);
            };
            window.addEventListener(eventName, handler);
        });
    }

    beforeEach(() => {
        window.addEventListener('condition-choice-selected', () => {});
        window.addEventListener('condition-choice-skipped', () => {});
    });

    afterEach(() => {
        window.removeEventListener('condition-choice-selected', () => {});
        window.removeEventListener('condition-choice-skipped', () => {});
        vi.restoreAllMocks();
    });

    it('renders null (nothing) when no event has been received', () => {
        const { container } = render(<ConditionChoiceModal />);
        expect(container.innerHTML).toBe('');
    });

    it('renders condition buttons matching the event detail', () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'test-id',
            targetName: 'Goblin',
            conditions: ['charmed', 'frightened'],
        });

        expect(screen.getByText('Charmed')).toBeInTheDocument();
        expect(screen.getByText('Frightened')).toBeInTheDocument();
        expect(screen.getByText('Goblin')).toBeInTheDocument();
    });

    it('dispatches condition-choice-selected with correct promptId and condition on button click', async () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'prompt-abc',
            targetName: 'Goblin',
            conditions: ['charmed', 'frightened'],
        });

        const selectedEvent = listenForEvent('condition-choice-selected');
        await act(async () => {
            fireEvent.click(screen.getByText('Frightened'));
        });

        const event = await selectedEvent;
        expect(event.detail.promptId).toBe('prompt-abc');
        expect(event.detail.condition).toBe('frightened');
    });

    it('dispatches condition-choice-skipped with correct promptId on skip button click', async () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'prompt-xyz',
            targetName: 'Goblin',
            conditions: ['charmed', 'frightened'],
        });

        const skippedEvent = listenForEvent('condition-choice-skipped');
        await act(async () => {
            fireEvent.click(screen.getByText('Skip (No Effect)'));
        });

        const event = await skippedEvent;
        expect(event.detail.promptId).toBe('prompt-xyz');
    });

    it('deduplicates conditions so each appears only once', () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'test-id',
            targetName: 'Goblin',
            conditions: ['charmed', 'charmed', 'frightened', 'frightened'],
        });

        const buttons = document.querySelectorAll('.cc-choice-btn');
        expect(buttons).toHaveLength(2);
        expect(screen.getByText('Charmed')).toBeInTheDocument();
        expect(screen.getByText('Frightened')).toBeInTheDocument();
    });

    it('displays target name and saving throw message in the body', () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'test-id',
            targetName: 'Dragon',
            conditions: ['frightened'],
        });

        expect(screen.getByText('Dragon')).toBeInTheDocument();
        expect(screen.getByText(/failed the saving throw/)).toBeInTheDocument();
    });

    it('capitalizes the first letter of each condition label', () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'test-id',
            targetName: 'Goblin',
            conditions: ['CHARMED', 'frightened', 'Poisoned'],
        });

        expect(screen.getByText('CHARMED')).toBeInTheDocument();
        expect(screen.getByText('Frightened')).toBeInTheDocument();
        expect(screen.getByText('Poisoned')).toBeInTheDocument();
    });

    it('handles empty conditions array gracefully — shows modal with no choice buttons', () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'test-id',
            targetName: 'Goblin',
            conditions: [],
        });

        expect(document.querySelector('.cc-overlay')).toBeInTheDocument();
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(document.querySelectorAll('.cc-choice-btn')).toHaveLength(0);
    });

    it('passes the correct promptId when multiple selections are made in sequence', async () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'first-prompt',
            targetName: 'Goblin',
            conditions: ['charmed'],
        });

        await act(async () => {
            fireEvent.click(screen.getByText('Charmed'));
        });

        showModal({
            promptId: 'second-prompt',
            targetName: 'Orc',
            conditions: ['frightened'],
        });

        const selectedEvent = listenForEvent('condition-choice-selected');
        await act(async () => {
            fireEvent.click(screen.getByText('Frightened'));
        });

        const event = await selectedEvent;
        expect(event.detail.promptId).toBe('second-prompt');
    });
});
