import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import ConditionChoiceModal from './ConditionChoiceModal.jsx';

describe('ConditionChoiceModal', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function showModal(detail) {
        act(() => {
            window.dispatchEvent(new CustomEvent('condition-choice-show', { detail }));
        });
    }

    it('renders nothing when no event received', () => {
        const { container } = render(<ConditionChoiceModal />);
        expect(container.innerHTML).toBe('');
    });

    it('displays condition buttons matching the event detail', () => {
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

    it('dispatches condition-choice-selected with chosen condition on button click', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'test-id',
            targetName: 'Goblin',
            conditions: ['charmed', 'frightened'],
        });

        fireEvent.click(screen.getByText('Frightened'));

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'condition-choice-selected',
                detail: { promptId: 'test-id', condition: 'frightened' },
            })
        );
    });

    it('removes modal after choice is made', () => {
        render(<ConditionChoiceModal />);

        showModal({
            promptId: 'test-id',
            targetName: 'Goblin',
            conditions: ['charmed', 'frightened'],
        });

        expect(screen.getByText('Charmed')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Charmed'));

        expect(screen.queryByText('Charmed')).not.toBeInTheDocument();
    });
});
