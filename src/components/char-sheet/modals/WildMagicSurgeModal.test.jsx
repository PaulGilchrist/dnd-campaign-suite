import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WildMagicSurgeModal from './WildMagicSurgeModal.jsx';
import * as handler from '../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js';

vi.mock('../../../services/automation/handlers/class-sorcerer/wildMagicSurgeHandler.js', () => ({
    onSurgeSelected: vi.fn(),
    onDoubleRollSelected: vi.fn(),
    onTamedSurgeSelected: vi.fn(),
}));

const surgeTable = [
    { min: 1, max: 4, effect: 'Effect 1' },
    { min: 5, max: 8, effect: 'Effect 2' },
    { min: 9, max: 12, effect: 'Effect 3' },
    { min: 13, max: 16, effect: 'Effect 4' },
    { min: 17, max: 20, effect: 'Effect 5' },
    { min: 21, max: 24, effect: 'Effect 6' },
    { min: 25, max: 28, effect: 'Effect 7' },
    { min: 29, max: 32, effect: 'Effect 8' },
    { min: 33, max: 36, effect: 'Effect 9' },
    { min: 37, max: 40, effect: 'Effect 10' },
    { min: 41, max: 44, effect: 'Effect 11' },
    { min: 45, max: 48, effect: 'Effect 12' },
    { min: 49, max: 52, effect: 'Effect 13' },
    { min: 53, max: 56, effect: 'Effect 14' },
    { min: 57, max: 60, effect: 'Effect 15' },
    { min: 61, max: 64, effect: 'Effect 16' },
    { min: 65, max: 68, effect: 'Effect 17' },
    { min: 69, max: 72, effect: 'Effect 18' },
    { min: 73, max: 76, effect: 'Effect 19' },
    { min: 77, max: 80, effect: 'Effect 20' },
    { min: 81, max: 84, effect: 'Effect 21' },
    { min: 85, max: 88, effect: 'Effect 22' },
    { min: 89, max: 92, effect: 'Effect 23' },
    { min: 93, max: 96, effect: 'Effect 24' },
    { min: 97, max: 100, effect: 'Effect 25' },
];

const defaultProps = {
    featureName: 'Wild Magic Surge',
    surgeTable,
    campaignName: 'test-campaign',
    playerStats: { name: 'TestSorcerer' },
    mode: 'roll',
    onClose: vi.fn(),
    roll: 42,
};

describe('WildMagicSurgeModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('roll mode', () => {
        it('displays all surge table entries', () => {
            render(<WildMagicSurgeModal {...defaultProps} />);
            expect(screen.getByText(/Effect 25/)).toBeInTheDocument();
            const entries = document.querySelectorAll('.wms-entry-effect');
            expect(entries.length).toBe(25);
        });

        it('highlights the rolled entry', () => {
            render(<WildMagicSurgeModal {...defaultProps} />);
            const highlightedEntries = document.querySelectorAll('.wms-entry--highlighted');
            expect(highlightedEntries.length).toBe(1);
        });

        it('shows the rolled number', () => {
            render(<WildMagicSurgeModal {...defaultProps} />);
            expect(screen.getByText(/Rolled: 42/)).toBeInTheDocument();
        });

        it('shows Done button', () => {
            render(<WildMagicSurgeModal {...defaultProps} />);
            const doneBtn = screen.getByRole('button', { name: 'Done' });
            expect(doneBtn).toBeInTheDocument();
            fireEvent.click(doneBtn);
            expect(defaultProps.onClose).toHaveBeenCalled();
        });
    });

    describe('controlledChaos mode', () => {
        it('displays both rolls', () => {
            render(<WildMagicSurgeModal {...defaultProps} mode="controlledChaos" roll1={15} roll2={87} />);
            expect(screen.getByText(/Roll 1: 15/)).toBeInTheDocument();
            expect(screen.getByText(/Roll 2: 87/)).toBeInTheDocument();
        });

        it('highlights both rolled entries', () => {
            render(<WildMagicSurgeModal {...defaultProps} mode="controlledChaos" roll1={15} roll2={87} />);
            const highlightedEntries = document.querySelectorAll('.wms-entry--highlighted');
            expect(highlightedEntries.length).toBe(2);
        });

        it('allows selecting a roll', async () => {
            handler.onDoubleRollSelected.mockResolvedValue({ type: 'popup', payload: {} });
            render(<WildMagicSurgeModal {...defaultProps} mode="controlledChaos" roll1={15} roll2={87} />);
            const allEntries = document.querySelectorAll('.wms-entry');
            const entry15 = allEntries[3]; // index 3 = min 13, max 16
            fireEvent.click(entry15);
            await waitFor(() => {
                expect(handler.onDoubleRollSelected).toHaveBeenCalled();
            });
        });
    });

    describe('tamedSurge mode', () => {
        it('displays all entries except the last', () => {
            render(<WildMagicSurgeModal {...defaultProps} mode="tamedSurge" />);
            const entries = document.querySelectorAll('.wms-entry-effect');
            expect(entries.length).toBe(24);
        });

        it('allows selecting an effect', async () => {
            handler.onTamedSurgeSelected.mockResolvedValue({ type: 'popup', payload: {} });
            render(<WildMagicSurgeModal {...defaultProps} mode="tamedSurge" />);
            const entries = document.querySelectorAll('.wms-entry');
            expect(entries.length).toBe(24); // All except last
            const firstEntry = entries[0];
            fireEvent.click(firstEntry);
            const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
            expect(confirmBtn).not.toBeDisabled();
            fireEvent.click(confirmBtn);
            await waitFor(() => {
                expect(handler.onTamedSurgeSelected).toHaveBeenCalled();
            });
        });

        it('Confirm button is disabled when no selection', () => {
            render(<WildMagicSurgeModal {...defaultProps} mode="tamedSurge" />);
            const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
            expect(confirmBtn).toBeDisabled();
        });
    });
});
