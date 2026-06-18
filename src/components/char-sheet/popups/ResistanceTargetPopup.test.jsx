// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ResistanceTargetPopup from './ResistanceTargetPopup.jsx';

// ── Test fixtures ──

const baseSpell = {
    name: 'Shield',
    level: 1,
};

const creatureTargets = ['Alric', 'Brea', 'Cortesh'];
const damageTypes = ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'];

function makeProps(overrides = {}) {
    return {
        spell: baseSpell,
        _playerStats: {},
        _campaignName: 'test-campaign',
        range: 30,
        creatureTargets: creatureTargets,
        damageTypes: damageTypes,
        onConfirm: vi.fn(),
        onSkip: vi.fn(),
        ...overrides,
    };
}

// ── Tests ──

describe('ResistanceTargetPopup', () => {
    // ── Rendering ──

    describe('rendering', () => {
        it('renders the popup title with shield icon', () => {
            render(<ResistanceTargetPopup {...makeProps()} />);
            expect(screen.getByText('Resistance')).toBeInTheDocument();
        });

        it('displays spell name and level', () => {
            render(<ResistanceTargetPopup {...makeProps()} />);
            expect(screen.getByText('Shield')).toBeInTheDocument();
            expect(screen.getByText(/Level 1 Abjuration/)).toBeInTheDocument();
        });

        it('displays the description text with dynamic range value', () => {
            render(<ResistanceTargetPopup {...makeProps({ range: 60 })} />);
            expect(screen.getByText(/Choose a willing creature within/)).toBeInTheDocument();
            expect(screen.getByText(/60/)).toBeInTheDocument();
            expect(screen.getByText(/reduces the damage by 1d4/)).toBeInTheDocument();
            expect(screen.getByText(/This can only happen once per turn/)).toBeInTheDocument();
        });

        it('renders all creature targets and damage types', () => {
            render(<ResistanceTargetPopup {...makeProps()} />);
            for (const name of creatureTargets) {
                expect(screen.getByText(name)).toBeInTheDocument();
            }
            for (const type of damageTypes) {
                expect(screen.getByText(type)).toBeInTheDocument();
            }
        });

        it('renders cancel and confirm buttons', () => {
            render(<ResistanceTargetPopup {...makeProps()} />);
            expect(screen.getByText('Cancel')).toBeInTheDocument();
            expect(screen.getByText('Cast Resistance')).toBeInTheDocument();
        });

        it('renders fallback text when spell is null', () => {
            render(<ResistanceTargetPopup {...makeProps({ spell: null })} />);
            expect(screen.getByText('Spell')).toBeInTheDocument();
            expect(screen.getByText(/Level 0 Abjuration/)).toBeInTheDocument();
        });

        it('renders fallback text when spell is undefined', () => {
            render(<ResistanceTargetPopup {...makeProps({ spell: undefined })} />);
            expect(screen.getByText('Spell')).toBeInTheDocument();
            expect(screen.getByText(/Level 0 Abjuration/)).toBeInTheDocument();
        });
    });

    // ── Selection behavior ──

    describe('selection', () => {
        it('disables confirm button until both target and damage type are selected', () => {
            render(<ResistanceTargetPopup {...makeProps()} />);
            const confirmBtn = screen.getByText('Cast Resistance');
            expect(confirmBtn).toBeDisabled();

            const alric = screen.getByText('Alric');
            fireEvent.click(alric);
            expect(confirmBtn).toBeDisabled();

            const fire = screen.getByText('Fire');
            fireEvent.click(fire);
            expect(confirmBtn).toBeEnabled();
        });

        it('allows switching target selection', () => {
            const onConfirm = vi.fn();
            render(<ResistanceTargetPopup {...makeProps({ onConfirm })} />);
            const alric = screen.getByText('Alric');
            const brea = screen.getByText('Brea');
            const fire = screen.getByText('Fire');
            fireEvent.click(alric);
            fireEvent.click(brea);
            fireEvent.click(fire);
            fireEvent.click(screen.getByText('Cast Resistance'));
            expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Brea', damageType: 'Fire' });
        });

        it('allows switching damage type selection', () => {
            const onConfirm = vi.fn();
            render(<ResistanceTargetPopup {...makeProps({ onConfirm })} />);
            const alric = screen.getByText('Alric');
            const cold = screen.getByText('Cold');
            const fire = screen.getByText('Fire');
            fireEvent.click(alric);
            fireEvent.click(cold);
            fireEvent.click(fire);
            fireEvent.click(screen.getByText('Cast Resistance'));
            expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Alric', damageType: 'Fire' });
        });

        it('shows checkmark for selected target', () => {
            render(<ResistanceTargetPopup {...makeProps()} />);
            const alric = screen.getByText('Alric');
            fireEvent.click(alric);
            expect(alric.textContent).toContain('\u2713');
        });

        it('shows checkmark for selected damage type', () => {
            render(<ResistanceTargetPopup {...makeProps()} />);
            const fire = screen.getByText('Fire');
            fireEvent.click(fire);
            expect(fire.textContent).toContain('\u2713');
        });
    });

    // ── Confirm behavior ──

    describe('confirm', () => {
        it('calls onConfirm with selected target and damage type', () => {
            const onConfirm = vi.fn();
            render(<ResistanceTargetPopup {...makeProps({ onConfirm })} />);
            fireEvent.click(screen.getByText('Alric'));
            fireEvent.click(screen.getByText('Fire'));
            fireEvent.click(screen.getByText('Cast Resistance'));
            expect(onConfirm).toHaveBeenCalledTimes(1);
            expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Alric', damageType: 'Fire' });
        });

        it('does not call onConfirm when target is not selected', () => {
            const onConfirm = vi.fn();
            render(<ResistanceTargetPopup {...makeProps({ onConfirm })} />);
            fireEvent.click(screen.getByText('Fire'));
            fireEvent.click(screen.getByText('Cast Resistance'));
            expect(onConfirm).not.toHaveBeenCalled();
        });

        it('does not call onConfirm when damage type is not selected', () => {
            const onConfirm = vi.fn();
            render(<ResistanceTargetPopup {...makeProps({ onConfirm })} />);
            fireEvent.click(screen.getByText('Alric'));
            fireEvent.click(screen.getByText('Cast Resistance'));
            expect(onConfirm).not.toHaveBeenCalled();
        });
    });

    // ── Skip/cancel behavior ──

    describe('skip', () => {
        it('calls onSkip when Cancel button is clicked', () => {
            const onSkip = vi.fn();
            render(<ResistanceTargetPopup {...makeProps({ onSkip })} />);
            fireEvent.click(screen.getByText('Cancel'));
            expect(onSkip).toHaveBeenCalledTimes(1);
        });

        it('calls onSkip when overlay is clicked', () => {
            const onSkip = vi.fn();
            render(<ResistanceTargetPopup {...makeProps({ onSkip })} />);
            const overlay = document.querySelector('.popup-overlay');
            fireEvent.click(overlay);
            expect(onSkip).toHaveBeenCalledTimes(1);
        });

        it('does not call onSkip when modal content is clicked', () => {
            const onSkip = vi.fn();
            render(<ResistanceTargetPopup {...makeProps({ onSkip })} />);
            const modal = document.querySelector('.popup-modal');
            fireEvent.click(modal);
            expect(onSkip).not.toHaveBeenCalled();
        });

        it('calls onSkip when Escape key is pressed', () => {
            const onSkip = vi.fn();
            render(<ResistanceTargetPopup {...makeProps({ onSkip })} />);
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onSkip).toHaveBeenCalledTimes(1);
        });

        it('does not call onSkip for other keys', () => {
            const onSkip = vi.fn();
            render(<ResistanceTargetPopup {...makeProps({ onSkip })} />);
            fireEvent.keyDown(document, { key: 'Enter' });
            expect(onSkip).not.toHaveBeenCalled();
        });
    });

    // ── Edge cases ──

    describe('edge cases', () => {
        it('renders with empty creature targets list', () => {
            render(<ResistanceTargetPopup {...makeProps({ creatureTargets: [] })} />);
            expect(screen.getByText('Target:')).toBeInTheDocument();
            expect(screen.queryByText('Alric')).not.toBeInTheDocument();
        });

        it('renders with empty damage types list', () => {
            render(<ResistanceTargetPopup {...makeProps({ damageTypes: [] })} />);
            expect(screen.getByText('Damage Type:')).toBeInTheDocument();
        });

        it('renders with zero range', () => {
            render(<ResistanceTargetPopup {...makeProps({ range: 0 })} />);
            expect(screen.getByText(/0/)).toBeInTheDocument();
        });

        it('renders with negative range', () => {
            render(<ResistanceTargetPopup {...makeProps({ range: -10 })} />);
            expect(screen.getByText(/-10/)).toBeInTheDocument();
        });
    });
});
