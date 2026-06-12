import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MultiTargetPopup from './MultiTargetPopup.jsx';

// ── Test fixtures ──

const mockSpell = { name: 'Create Water', level: 1 };
const mockRange = '30 ft';
const mockCreatureTargets = ['Goblin', 'Skeleton', 'Orc'];
const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

function makeProps(overrides) {
    return {
        spell: mockSpell,
        _playerStats: { name: 'Throg' },
        _campaignName: 'test-campaign',
        range: mockRange,
        creatureTargets: mockCreatureTargets,
        onConfirm: mockOnConfirm,
        onSkip: mockOnSkip,
        ...(overrides || {}),
    };
}

// ── Tests ──

describe('MultiTargetPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Initial render ──

    it('renders the popup overlay and modal', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
        expect(document.querySelector('.popup-modal')).toBeInTheDocument();
    });

    it('renders the metamagic-popup class on the modal', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-popup')).toBeInTheDocument();
    });

    it('renders the popup-inner wrapper', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-popup-inner')).toBeInTheDocument();
    });

    it('renders the "Words of Creation" header with users icon', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(screen.getByText('Words of Creation')).toBeInTheDocument();
        const icon = document.querySelector('.fa-solid.fa-users');
        expect(icon).toBeInTheDocument();
    });

    it('displays the spell name in the spell-name line', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(screen.getByText('Create Water')).toBeInTheDocument();
    });

    it('displays "Spread to Second Target" subtitle', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(screen.getByText(/Spread to Second Target/)).toBeInTheDocument();
    });

    it('displays the range in the instruction text', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(screen.getByText(/30 ft/)).toBeInTheDocument();
    });

    it('shows "Select a second creature within" instruction', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(screen.getByText(/Select a second creature within/)).toBeInTheDocument();
    });

    // ── Creature targets dropdown ──

    it('renders a select dropdown for second target', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        const select = document.querySelector('select');
        expect(select).toBeInTheDocument();
    });

    it('renders an empty placeholder option', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(screen.getByText('-- Select target --')).toBeInTheDocument();
    });

    it('renders all creature targets as options', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Skeleton')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
    });

    it('renders the "Second Target:" label', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(screen.getByText('Second Target:')).toBeInTheDocument();
    });

    it('renders the metamagic-twin-target wrapper', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-twin-target')).toBeInTheDocument();
    });

    // ── Action buttons ──

    it('renders "Cast on First Target Only" button', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(screen.getByText('Cast on First Target Only')).toBeInTheDocument();
    });

    it('renders "Cast on Both Targets" button', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(screen.getByText('Cast on Both Targets')).toBeInTheDocument();
    });

    it('renders the metamagic-actions wrapper', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-actions')).toBeInTheDocument();
    });

    it('disables "Cast on Both Targets" button when no second target selected', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        expect(screen.getByText('Cast on Both Targets')).toBeDisabled();
    });

    it('enables "Cast on Both Targets" button after selecting a target', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        const select = document.querySelector('select');
        fireEvent.change(select, { target: { value: 'Goblin' } });
        expect(screen.getByText('Cast on Both Targets')).not.toBeDisabled();
    });

    // ── Confirm behavior ──

    it('calls onConfirm with second target when confirmed', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        const select = document.querySelector('select');
        fireEvent.change(select, { target: { value: 'Goblin' } });
        fireEvent.click(screen.getByText('Cast on Both Targets'));
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).toHaveBeenCalledWith({ secondTarget: 'Goblin' });
    });

    it('calls onConfirm with the selected creature name', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        const select = document.querySelector('select');
        fireEvent.change(select, { target: { value: 'Orc' } });
        fireEvent.click(screen.getByText('Cast on Both Targets'));
        expect(mockOnConfirm).toHaveBeenCalledWith({ secondTarget: 'Orc' });
    });

    it('does not call onConfirm when confirmed without a target selected', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Cast on Both Targets'));
        expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    // ── Skip behavior ──

    it('calls onSkip when "Cast on First Target Only" is clicked', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Cast on First Target Only'));
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when clicking the overlay background', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        const overlay = document.querySelector('.popup-overlay');
        fireEvent.click(overlay);
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onSkip when clicking inside the modal content', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        const modal = document.querySelector('.popup-modal');
        fireEvent.click(modal);
        expect(mockOnSkip).not.toHaveBeenCalled();
    });

    // ── Keyboard: Escape ──

    it('calls onSkip when Escape key is pressed', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip for other keys', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('removes keydown listener on unmount', () => {
        const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
        const { unmount } = render(<MultiTargetPopup {...makeProps()} />);
        unmount();
        expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    // ── Missing / optional spell name ──

    it('shows "Spell" fallback when spell prop is null', () => {
        render(<MultiTargetPopup {...makeProps({ spell: null })} />);
        expect(screen.getByText(/— Spread to Second Target/)).toBeInTheDocument();
        // The text will be "Spell — Spread to Second Target" since null?.name is undefined
        // and the fallback 'Spell' is used
    });

    it('shows "Spell" fallback when spell has no name', () => {
        render(<MultiTargetPopup {...makeProps({ spell: {} })} />);
        expect(screen.getByText(/— Spread to Second Target/)).toBeInTheDocument();
    });

    // ── Empty creature targets ──

    it('renders select with only the placeholder when creatureTargets is empty', () => {
        render(<MultiTargetPopup {...makeProps({ creatureTargets: [] })} />);
        const select = document.querySelector('select');
        expect(select).toBeInTheDocument();
        const options = select.querySelectorAll('option');
        expect(options).toHaveLength(1);
        expect(options[0].value).toBe('');
    });

    // ── Selecting different targets updates state ──

    it('updates secondTarget state when a different option is selected', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        const select = document.querySelector('select');
        fireEvent.change(select, { target: { value: 'Goblin' } });
        expect(select.value).toBe('Goblin');
        fireEvent.change(select, { target: { value: 'Skeleton' } });
        expect(select.value).toBe('Skeleton');
    });

    // ── Re-selecting empty option disables confirm button ──

    it('disables confirm button when target selection is cleared', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        const select = document.querySelector('select');
        fireEvent.change(select, { target: { value: 'Goblin' } });
        expect(screen.getByText('Cast on Both Targets')).not.toBeDisabled();
        fireEvent.change(select, { target: { value: '' } });
        expect(screen.getByText('Cast on Both Targets')).toBeDisabled();
    });

    // ── CSS class structure ──

    it('popup-overlay click triggers onSkip', () => {
        render(<MultiTargetPopup {...makeProps()} />);
        const overlay = document.querySelector('.popup-overlay');
        fireEvent.click(overlay);
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });
});
