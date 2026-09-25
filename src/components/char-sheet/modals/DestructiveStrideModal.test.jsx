// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DestructiveStrideModal from './DestructiveStrideModal.jsx';
import { applyDamageTypeChoice, skipTargetChoice } from '../../../services/automation/handlers/combat/destructiveStrideHandler.js';

// Mock the handler functions that the modal calls
vi.mock('../../../services/automation/handlers/combat/destructiveStrideHandler.js', () => ({
    applyDamageTypeChoice: vi.fn(),
    skipTargetChoice: vi.fn(),
}));

// ── Test fixtures ──

const mockAction = { name: 'Destructive Stride' };
const mockPlayerStats = { name: 'TestMonk', level: 5 };
const mockOnClose = vi.fn();
const mockOnConfirm = vi.fn();

const baseProps = {
    action: mockAction,
    playerStats: mockPlayerStats,
    campaignName: 'test-campaign',
    onConfirm: mockOnConfirm,
    onClose: mockOnClose,
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

// ── Helpers ──

function selectDamageType(type) {
    const label = screen.getByRole('radio', { name: new RegExp(`^\\s*${type}\\s*`, 'i') })?.closest('label')
        || screen.getByText(type).closest('label');
    const radio = label.querySelector('input[type="radio"]');
    fireEvent.click(radio);
}

// ── Tests ──

describe('DestructiveStrideModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Initial render ──

    describe('initial render', () => {
        it('renders the instruction text and all five damage type options with descriptions', () => {
            render(<DestructiveStrideModal {...makeProps()} />);
            expect(screen.getByText('Choose the damage type for Destructive Stride:')).toBeInTheDocument();
            const damageTypes = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];
            for (const type of damageTypes) {
                expect(screen.getByText(type)).toBeInTheDocument();
            }
            expect(screen.getByText(/Corrosive acid damage/)).toBeInTheDocument();
            expect(screen.getByText(/Biting cold damage/)).toBeInTheDocument();
            expect(screen.getByText(/Searing fire damage/)).toBeInTheDocument();
            expect(screen.getByText(/Crackling lightning damage/)).toBeInTheDocument();
            expect(screen.getByText(/Deafening thunder damage/)).toBeInTheDocument();
        });

        it('disables the Choose Type button and shows the proximity note on initial render', () => {
            render(<DestructiveStrideModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: /Choose Type/ })).toBeDisabled();
            expect(screen.getByText(/Choose a creature only if the monk comes within 5 ft/)).toBeInTheDocument();
        });

        it('displays custom action name when provided', () => {
            render(<DestructiveStrideModal {...makeProps({ action: { name: 'Custom Stride' } })} />);
            expect(screen.getByText('Custom Stride')).toBeInTheDocument();
        });
    });

    // ── Radio selection ──

    describe('radio selection', () => {
        it('enables the Choose Type button after selecting a damage type', () => {
            render(<DestructiveStrideModal {...makeProps()} />);
            const chooseBtn = screen.getByRole('button', { name: /Choose Type/ });
            expect(chooseBtn).toBeDisabled();
            selectDamageType('Fire');
            expect(chooseBtn).not.toBeDisabled();
        });

        it('switches selection when a different option is clicked', () => {
            render(<DestructiveStrideModal {...makeProps()} />);
            selectDamageType('Acid');
            const acidRadio = screen.getByRole('radio', { name: /Acid/ });
            expect(acidRadio).toBeChecked();
            selectDamageType('Fire');
            const fireRadio = screen.getByRole('radio', { name: /Fire/ });
            expect(fireRadio).toBeChecked();
            expect(acidRadio).not.toBeChecked();
        });
    });

    // ── Confirm flow (handleApply) ──

    describe('confirm flow', () => {
        it('calls applyDamageTypeChoice and onConfirm when a type is selected and Choose Type is clicked', async () => {
            applyDamageTypeChoice.mockResolvedValue({ type: 'modal', modalName: 'destructiveStrideTarget' });

            render(<DestructiveStrideModal {...makeProps()} />);
            selectDamageType('Fire');
            fireEvent.click(screen.getByRole('button', { name: /Choose Type/ }));

            await waitFor(() => {
                expect(applyDamageTypeChoice).toHaveBeenCalledWith(
                    mockAction,
                    mockPlayerStats,
                    'test-campaign',
                    'Fire',
                );
                expect(mockOnConfirm).toHaveBeenCalledWith({ type: 'modal', modalName: 'destructiveStrideTarget' });
            });
        });

        it('does not call onConfirm when applyDamageTypeChoice returns null', async () => {
            applyDamageTypeChoice.mockResolvedValue(null);

            render(<DestructiveStrideModal {...makeProps()} />);
            selectDamageType('Fire');
            fireEvent.click(screen.getByRole('button', { name: /Choose Type/ }));

            await waitFor(() => {
                expect(mockOnConfirm).not.toHaveBeenCalled();
            });
        });

        it('does not call applyDamageTypeChoice when no option is selected', async () => {
            render(<DestructiveStrideModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Choose Type/ }));
            await Promise.resolve();

            expect(applyDamageTypeChoice).not.toHaveBeenCalled();
        });
    });

    // ── Skip flow (handleSkip) ──

    describe('skip flow', () => {
        it('calls skipTargetChoice with correct args and onConfirm when result is popup', async () => {
            skipTargetChoice.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            render(<DestructiveStrideModal {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: /Skip Target/ }));

            await waitFor(() => {
                expect(skipTargetChoice).toHaveBeenCalledWith(
                    mockAction,
                    mockPlayerStats,
                    'test-campaign',
                );
                expect(mockOnConfirm).toHaveBeenCalledWith({ type: 'popup', payload: { type: 'automation_info' } });
            });
        });
    });

    // ── Overlay click behavior ──

    describe('overlay click behavior', () => {
        it('does not call skipTargetChoice or onClose when the overlay background is clicked', () => {
            skipTargetChoice.mockResolvedValue({ type: 'popup', payload: { type: 'automation_info' } });

            render(<DestructiveStrideModal {...makeProps()} />);
            fireEvent.click(document.querySelector('.sp-overlay'));

            expect(skipTargetChoice).not.toHaveBeenCalled();
            expect(mockOnClose).not.toHaveBeenCalled();
            expect(screen.getByRole('button', { name: /Skip Target/ })).toBeInTheDocument();
        });
    });
});
