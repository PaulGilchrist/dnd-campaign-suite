// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProtectionFromEnergyTargetPopup from './ProtectionFromEnergyTargetPopup.jsx';

// ── Test fixtures ──

const mockSpell = { name: 'Protection from Energy', level: 3 };
const mockRange = 30;
const mockCreatureTargets = ['Ally 1', 'Ally 2', 'Ally 3'];
const mockDamageTypes = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];
const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

function makeProps(overrides) {
    return {
        spell: mockSpell,
        _playerStats: {},
        _campaignName: 'test-campaign',
        range: mockRange,
        creatureTargets: mockCreatureTargets,
        damageTypes: mockDamageTypes,
        onConfirm: mockOnConfirm,
        onSkip: mockOnSkip,
        ...(overrides || {}),
    };
}

// ── Tests ──

describe('ProtectionFromEnergyTargetPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Initial render ──

    it('renders the popup with shield icon and title', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        const icon = document.querySelector('.fa-solid.fa-shield-halved');
        expect(icon).toBeInTheDocument();
        expect(document.querySelector('h3')).toHaveTextContent('Protection from Energy');
    });

    it('renders spell name and level in the spell name section', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        const spellNameEl = document.querySelector('.metamagic-spell-name');
        expect(spellNameEl).toHaveTextContent('Protection from Energy');
        expect(spellNameEl).toHaveTextContent(/Level 3/);
        expect(spellNameEl).toHaveTextContent(/Abjuration/);
    });

    it('renders description paragraph with range value', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ range: 60 })} />);
        expect(screen.getByText(/60/)).toBeInTheDocument();
    });

    it('renders Target label', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(screen.getByText('Target:')).toBeInTheDocument();
    });

    it('renders all creature targets', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        mockCreatureTargets.forEach(target => {
            expect(screen.getByText(target)).toBeInTheDocument();
        });
    });

    it('renders Damage Type label', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(screen.getByText('Damage Type:')).toBeInTheDocument();
    });

    it('renders all damage types', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        mockDamageTypes.forEach(type => {
            expect(screen.getByText(type)).toBeInTheDocument();
        });
    });

    it('renders Cancel and Cast buttons', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Cast Protection from Energy')).toBeInTheDocument();
    });

    // ── CSS classes ──

    it('renders with popup-overlay class', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
    });

    it('renders with popup-modal class', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(document.querySelector('.popup-modal')).toBeInTheDocument();
    });

    it('renders with metamagic-popup class', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-popup')).toBeInTheDocument();
    });

    it('renders with metamagic-popup-inner class', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-popup-inner')).toBeInTheDocument();
    });

    it('renders with metamagic-spell-name class', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-spell-name')).toBeInTheDocument();
    });

    it('renders with metamagic-twin-target class', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-twin-target')).toBeInTheDocument();
    });

    it('renders with metamagic-actions class', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-actions')).toBeInTheDocument();
    });

    it('renders btn-secondary class on Cancel button', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(screen.getByText('Cancel')).toHaveClass('btn-secondary');
    });

    it('renders btn class on Cast button', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(screen.getByText('Cast Protection from Energy')).toHaveClass('btn');
    });

    // ── Spell prop edge cases ──

    it('shows fallback text when spell is null', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ spell: null })} />);
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    });

    it('shows fallback text when spell has no name', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ spell: {} })} />);
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    });

    it('shows spell name with default level when spell has no level', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ spell: { name: 'Test' } })} />);
        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    });

    // ── Target selection ──

    it('does not show checkmark next to targets before any selection', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        const targetItems = Array.from(document.querySelectorAll('.metamagic-twin-target div div'));
        targetItems.forEach(item => {
            expect(item.textContent).not.toMatch(/^\u2713/);
        });
    });

    it('shows checkmark prefix when a target is selected', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Ally 1'));
        expect(screen.getByText('✓ Ally 1')).toBeInTheDocument();
    });

    it('hides checkmark for unselected targets after selecting another', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Ally 1'));
        expect(screen.queryByText('✓ Ally 2')).not.toBeInTheDocument();
        expect(screen.queryByText('✓ Ally 3')).not.toBeInTheDocument();
    });

    it('updates selected target when clicking a different creature', () => {
        const onConfirm = vi.fn();
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ onConfirm })} />);

        fireEvent.click(screen.getByText('Ally 1'));
        fireEvent.click(screen.getByText('Ally 2'));
        fireEvent.click(screen.getByText('Acid'));
        fireEvent.click(screen.getByText('Cast Protection from Energy'));

        expect(onConfirm).toHaveBeenCalledWith({
            targetName: 'Ally 2',
            damageType: 'Acid',
        });
    });

    it('shows checkmark prefix when a damage type is selected', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Acid'));
        expect(screen.getByText('✓ Acid')).toBeInTheDocument();
    });

    it('updates selected damage type when clicking a different type', () => {
        const onConfirm = vi.fn();
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ onConfirm })} />);

        fireEvent.click(screen.getByText('Ally 1'));
        fireEvent.click(screen.getByText('Cold'));
        fireEvent.click(screen.getByText('Fire'));
        fireEvent.click(screen.getByText('Cast Protection from Energy'));

        expect(onConfirm).toHaveBeenCalledWith({
            targetName: 'Ally 1',
            damageType: 'Fire',
        });
    });

    // ── Button disabled state ──

    it('disables Cast button when no selections made', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(screen.getByText('Cast Protection from Energy')).toBeDisabled();
    });

    it('disables Cast button when only target is selected', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Ally 1'));
        expect(screen.getByText('Cast Protection from Energy')).toBeDisabled();
    });

    it('disables Cast button when only damage type is selected', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Acid'));
        expect(screen.getByText('Cast Protection from Energy')).toBeDisabled();
    });

    it('enables Cast button when both target and damage type are selected', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Ally 1'));
        fireEvent.click(screen.getByText('Acid'));
        expect(screen.getByText('Cast Protection from Energy')).toBeEnabled();
    });

    // ── Confirm behavior ──

    it('calls onConfirm with selected target and damage type when Cast is clicked', () => {
        const onConfirm = vi.fn();
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ onConfirm })} />);

        fireEvent.click(screen.getByText('Ally 1'));
        fireEvent.click(screen.getByText('Acid'));
        fireEvent.click(screen.getByText('Cast Protection from Energy'));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith({
            targetName: 'Ally 1',
            damageType: 'Acid',
        });
    });

    it('does not call onConfirm when no target is selected', () => {
        const onConfirm = vi.fn();
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ onConfirm })} />);

        fireEvent.click(screen.getByText('Acid'));
        fireEvent.click(screen.getByText('Cast Protection from Energy'));

        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('does not call onConfirm when no damage type is selected', () => {
        const onConfirm = vi.fn();
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ onConfirm })} />);

        fireEvent.click(screen.getByText('Ally 1'));
        fireEvent.click(screen.getByText('Cast Protection from Energy'));

        expect(onConfirm).not.toHaveBeenCalled();
    });

    // ── Skip behavior ──

    it('calls onSkip when Cancel button is clicked', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when clicking the overlay background', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        const overlay = document.querySelector('.popup-overlay');
        fireEvent.click(overlay);
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when modal content is clicked', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        const modal = document.querySelector('.metamagic-popup');
        fireEvent.click(modal);
        expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('does not call onSkip when modal inner content is clicked', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        const inner = document.querySelector('.metamagic-popup-inner');
        fireEvent.click(inner);
        expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('does not call onSkip when Escape key is not pressed', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('calls onSkip when Escape key is pressed', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip without calling onConfirm when skipped after selections', () => {
        const onConfirm = vi.fn();
        const onSkip = vi.fn();
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ onConfirm, onSkip })} />);

        fireEvent.click(screen.getByText('Ally 1'));
        fireEvent.click(screen.getByText('Acid'));
        fireEvent.click(screen.getByText('Cancel'));

        expect(onSkip).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    // ── Keyboard listener cleanup ──

    it('removes keydown listener on unmount', () => {
        const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
        const { unmount } = render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        unmount();
        expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    // ── Empty lists ──

    it('renders with empty creature targets list', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ creatureTargets: [] })} />);
        expect(screen.getByText('Target:')).toBeInTheDocument();
        expect(screen.queryByText('Ally 1')).not.toBeInTheDocument();
    });

    it('renders with empty damage types list', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ damageTypes: [] })} />);
        expect(screen.getByText('Damage Type:')).toBeInTheDocument();
        expect(screen.queryByText('Acid')).not.toBeInTheDocument();
    });
});
