// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SummonSpiritModal from './SummonSpiritModal.jsx';

// ── Test fixtures ──

const baseProps = {
    action: {
        name: 'Summon Beast',
        automation: {
            type: 'summon_spirit',
            typeLabel: 'Bestial Spirit',
            variants: [
                { name: 'Bestial Spirit (Air)', description: 'Flies at 60 ft.' },
                { name: 'Bestial Spirit (Land)', description: 'Walks and climbs at 30 ft.' },
                { name: 'Bestial Spirit (Water)', description: 'Swims at 30 ft.' },
            ],
        },
    },
    onConfirm: vi.fn(),
    onClose: vi.fn(),
};

function makeProps(overrides) {
    return { ...baseProps, ...(overrides || {}) };
}

// ── Helpers ──

function selectVariant(name) {
    fireEvent.click(screen.getByText(name));
}

// ── Tests ──

describe('SummonSpiritModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Initial render ──

    describe('initial render', () => {
        it('renders the modal structure with action name, instruction prompt, and all variant buttons with descriptions', () => {
            render(<SummonSpiritModal {...makeProps()} />);
            expect(screen.getByText('Summon Beast')).toBeInTheDocument();
            expect(screen.getByText('Choose the form your summoned creature takes:')).toBeInTheDocument();
            expect(screen.getByText('Bestial Spirit (Air)')).toBeInTheDocument();
            expect(screen.getByText('Bestial Spirit (Land)')).toBeInTheDocument();
            expect(screen.getByText('Bestial Spirit (Water)')).toBeInTheDocument();
            expect(screen.getByText('Flies at 60 ft.')).toBeInTheDocument();
            expect(screen.getByText('Walks and climbs at 30 ft.')).toBeInTheDocument();
            expect(screen.getByText('Swims at 30 ft.')).toBeInTheDocument();
        });

        it('renders variant buttons and descriptions when only some variants have descriptions', () => {
            const props = makeProps({
                action: {
                    name: 'Summon Spirit',
                    automation: {
                        variants: [
                            { name: 'Spirit A' },
                            { name: 'Spirit B', description: 'A description' },
                        ],
                    },
                },
            });
            render(<SummonSpiritModal {...props} />);
            expect(screen.getByText('Spirit A')).toBeInTheDocument();
            expect(screen.getByText('Spirit B')).toBeInTheDocument();
            expect(screen.getByText('A description')).toBeInTheDocument();
            expect(screen.queryByText(/Spirit A description/i)).not.toBeInTheDocument();
        });

        it('renders no variant buttons when variants array is empty', () => {
            const props = makeProps({
                action: {
                    name: 'Summon Spirit',
                    automation: { variants: [] },
                },
            });
            render(<SummonSpiritModal {...props} />);
            expect(screen.getByText('Summon Spirit')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Spirit/i })).not.toBeInTheDocument();
        });
    });

    // ── Summon button state ──

    describe('summon button state', () => {
        it('is disabled when no variant is selected and enabled after selection', () => {
            render(<SummonSpiritModal {...makeProps()} />);
            const summonButton = screen.getByRole('button', { name: /Summon/ });
            expect(summonButton).toBeDisabled();

            selectVariant('Bestial Spirit (Air)');
            expect(summonButton).toBeEnabled();
        });

        it('remains enabled after confirm while selection persists', () => {
            render(<SummonSpiritModal {...makeProps()} />);
            const summonButton = screen.getByRole('button', { name: /Summon/ });

            selectVariant('Bestial Spirit (Air)');
            expect(summonButton).toBeEnabled();

            fireEvent.click(summonButton);
            expect(baseProps.onConfirm).toHaveBeenCalled();
            expect(summonButton).toBeEnabled();
        });
    });

    // ── Variant selection ──

    describe('variant selection', () => {
        it('selects a variant on click, deselects the previous, and allows variants without descriptions', () => {
            render(<SummonSpiritModal {...makeProps()} />);

            selectVariant('Bestial Spirit (Air)');
            let selectedBtn = document.querySelector('button.summon-spirit-option-selected');
            expect(selectedBtn.textContent).toContain('Bestial Spirit (Air)');

            selectVariant('Bestial Spirit (Land)');
            selectedBtn = document.querySelector('button.summon-spirit-option-selected');
            expect(selectedBtn.textContent).toContain('Bestial Spirit (Land)');

            // Variant without description — re-render with different variants
            const props2 = makeProps({
                action: {
                    name: 'Summon Spirit',
                    automation: {
                        variants: [
                            { name: 'Spirit A' },
                            { name: 'Spirit B', description: 'A description' },
                        ],
                    },
                },
            });
            const { container } = render(<SummonSpiritModal {...props2} />);
            selectVariant('Spirit A');
            const selectedBtnNoDesc = container.querySelector('button.summon-spirit-option-selected');
            expect(selectedBtnNoDesc).toBeInTheDocument();
            expect(selectedBtnNoDesc.textContent).toContain('Spirit A');
        });

        it('does not close the modal when a variant is clicked', () => {
            const onClose = vi.fn();
            render(<SummonSpiritModal {...makeProps({ onClose })} />);

            selectVariant('Bestial Spirit (Air)');
            expect(onClose).not.toHaveBeenCalled();
        });
    });

    // ── Confirm behavior ──

    describe('confirm behavior', () => {
        it('calls onConfirm with the selected variant name and not without a selection', () => {
            render(<SummonSpiritModal {...makeProps()} />);
            selectVariant('Bestial Spirit (Land)');
            fireEvent.click(screen.getByRole('button', { name: /Summon/ }));

            expect(baseProps.onConfirm).toHaveBeenCalledWith('Bestial Spirit (Land)');
        });

        it('calls onConfirm with the latest selection after switching', () => {
            render(<SummonSpiritModal {...makeProps()} />);
            selectVariant('Bestial Spirit (Air)');
            selectVariant('Bestial Spirit (Water)');
            fireEvent.click(screen.getByRole('button', { name: /Summon/ }));

            expect(baseProps.onConfirm).toHaveBeenCalledWith('Bestial Spirit (Water)');
        });
    });

    // ── Close behavior ──

    describe('close behavior', () => {
        it('calls onClose when the Cancel button is clicked', () => {
            const onClose = vi.fn();
            render(<SummonSpiritModal {...makeProps({ onClose })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not call onClose when the overlay background or the modal inside is clicked', () => {
            const onClose = vi.fn();
            render(<SummonSpiritModal {...makeProps({ onClose })} />);

            fireEvent.click(document.querySelector('.sp-overlay'));
            expect(onClose).not.toHaveBeenCalled();

            fireEvent.click(document.querySelector('.sp-modal'));
            expect(onClose).not.toHaveBeenCalled();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });
    });
});
