// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TargetWithTypePopup from './TargetWithTypePopup.jsx';

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
        icon: 'fa-solid fa-shield-halved',
        title: 'Protection from Energy',
        school: 'Abjuration',
        defaultLevel: 3,
        description: 'Choose a creature within range. Until the spell ends, the creature has resistance to the chosen damage type.',
        confirmLabel: 'Cast Protection from Energy',
        ...(overrides || {}),
    };
}

// ── Tests ──

describe('TargetWithTypePopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Initial render ──

    it('renders the popup with shield icon and title', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        const icon = document.querySelector('.fa-solid.fa-shield-halved');
        expect(icon).toBeInTheDocument();
        expect(document.querySelector('h3')).toHaveTextContent('Protection from Energy');
    });

    it('renders spell name and level in the spell name section', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        const spellNameEl = document.querySelector('.metamagic-spell-name');
        expect(spellNameEl).toHaveTextContent('Protection from Energy');
        expect(spellNameEl).toHaveTextContent(/Level 3/);
        expect(spellNameEl).toHaveTextContent(/Abjuration/);
    });

    it('renders description paragraph', () => {
        render(<TargetWithTypePopup {...makeProps({ range: 60 })} />);
        expect(screen.getByText(/Choose a creature within range/)).toBeInTheDocument();
    });

    it('renders Target label', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        expect(screen.getByText('Target:')).toBeInTheDocument();
    });

    it('renders all creature targets', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        mockCreatureTargets.forEach(target => {
            expect(screen.getByText(target)).toBeInTheDocument();
        });
    });

    it('renders Damage Type label', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        expect(screen.getByText('Damage Type:')).toBeInTheDocument();
    });

    it('renders all damage types', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        mockDamageTypes.forEach(type => {
            expect(screen.getByText(type)).toBeInTheDocument();
        });
    });

    it('renders Cancel and Cast buttons', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Cast Protection from Energy')).toBeInTheDocument();
    });

    // ── CSS classes ──

    it('renders with popup-overlay class', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
    });

    it('renders with popup-modal class', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        expect(document.querySelector('.popup-modal')).toBeInTheDocument();
    });

    it('renders with metamagic-popup class', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-popup')).toBeInTheDocument();
    });

    it('renders with metamagic-popup-inner class', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-popup-inner')).toBeInTheDocument();
    });

    it('renders with metamagic-spell-name class', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-spell-name')).toBeInTheDocument();
    });

    it('renders with metamagic-twin-target class', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-twin-target')).toBeInTheDocument();
    });

    it('renders with metamagic-actions class', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-actions')).toBeInTheDocument();
    });

    it('renders btn-secondary class on Cancel button', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        expect(screen.getByText('Cancel')).toHaveClass('btn-secondary');
    });

    it('renders btn class on Cast button', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        expect(screen.getByText('Cast Protection from Energy')).toHaveClass('btn');
    });

    // ── Spell prop edge cases ──

    it('shows fallback text when spell is null', () => {
        render(<TargetWithTypePopup {...makeProps({ spell: null })} />);
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    });

    it('shows fallback text when spell has no name', () => {
        render(<TargetWithTypePopup {...makeProps({ spell: {} })} />);
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    });

    it('shows spell name with default level when spell has no level', () => {
        render(<TargetWithTypePopup {...makeProps({ spell: { name: 'Test' } })} />);
        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    });

    // ── Target selection ──

    it('does not show checkmark next to targets before any selection', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        const targetItems = Array.from(document.querySelectorAll('.metamagic-twin-target div div'));
        targetItems.forEach(item => {
            expect(item.textContent).not.toMatch(/^\u2713/);
        });
    });

    it('shows checkmark prefix when a target is selected', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Ally 1'));
        expect(screen.getByText('✓ Ally 1')).toBeInTheDocument();
    });

    it('hides checkmark for unselected targets after selecting another', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Ally 1'));
        expect(screen.queryByText('✓ Ally 2')).not.toBeInTheDocument();
        expect(screen.queryByText('✓ Ally 3')).not.toBeInTheDocument();
    });

    it('updates selected target when clicking a different creature', () => {
        const onConfirm = vi.fn();
        render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);

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
        render(<TargetWithTypePopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Acid'));
        expect(screen.getByText('✓ Acid')).toBeInTheDocument();
    });

    it('updates selected damage type when clicking a different type', () => {
        const onConfirm = vi.fn();
        render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);

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
        render(<TargetWithTypePopup {...makeProps()} />);
        expect(screen.getByText('Cast Protection from Energy')).toBeDisabled();
    });

    it('disables Cast button when only target is selected', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Ally 1'));
        expect(screen.getByText('Cast Protection from Energy')).toBeDisabled();
    });

    it('disables Cast button when only damage type is selected', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Acid'));
        expect(screen.getByText('Cast Protection from Energy')).toBeDisabled();
    });

    it('enables Cast button when both target and damage type are selected', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Ally 1'));
        fireEvent.click(screen.getByText('Acid'));
        expect(screen.getByText('Cast Protection from Energy')).toBeEnabled();
    });

    // ── Confirm behavior ──

    it('calls onConfirm with selected target and damage type when Cast is clicked', () => {
        const onConfirm = vi.fn();
        render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);

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
        render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);

        fireEvent.click(screen.getByText('Acid'));
        fireEvent.click(screen.getByText('Cast Protection from Energy'));

        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('does not call onConfirm when no damage type is selected', () => {
        const onConfirm = vi.fn();
        render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);

        fireEvent.click(screen.getByText('Ally 1'));
        fireEvent.click(screen.getByText('Cast Protection from Energy'));

        expect(onConfirm).not.toHaveBeenCalled();
    });

    // ── Skip behavior ──

    it('calls onSkip when Cancel button is clicked', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when clicking the overlay background', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        const overlay = document.querySelector('.popup-overlay');
        fireEvent.click(overlay);
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when modal content is clicked', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        const modal = document.querySelector('.metamagic-popup');
        fireEvent.click(modal);
        expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('does not call onSkip when modal inner content is clicked', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        const inner = document.querySelector('.metamagic-popup-inner');
        fireEvent.click(inner);
        expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('does not call onSkip when Escape key is not pressed', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('calls onSkip when Escape key is pressed', () => {
        render(<TargetWithTypePopup {...makeProps()} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip without calling onConfirm when skipped after selections', () => {
        const onConfirm = vi.fn();
        const onSkip = vi.fn();
        render(<TargetWithTypePopup {...makeProps({ onConfirm, onSkip })} />);

        fireEvent.click(screen.getByText('Ally 1'));
        fireEvent.click(screen.getByText('Acid'));
        fireEvent.click(screen.getByText('Cancel'));

        expect(onSkip).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    // ── Keyboard listener cleanup ──

    it('removes keydown listener on unmount', () => {
        const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
        const { unmount } = render(<TargetWithTypePopup {...makeProps()} />);
        unmount();
        expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    // ── Empty lists ──

    it('renders with empty creature targets list', () => {
        render(<TargetWithTypePopup {...makeProps({ creatureTargets: [] })} />);
        expect(screen.getByText('Target:')).toBeInTheDocument();
        expect(screen.queryByText('Ally 1')).not.toBeInTheDocument();
    });

    it('renders with empty damage types list', () => {
        render(<TargetWithTypePopup {...makeProps({ damageTypes: [] })} />);
        expect(screen.getByText('Damage Type:')).toBeInTheDocument();
        expect(screen.queryByText('Acid')).not.toBeInTheDocument();
    });
});
