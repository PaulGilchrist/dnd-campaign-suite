import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MageArmorTargetPopup from './MageArmorTargetPopup.jsx';

// ── Test fixtures ──

const baseSpell = {
    name: 'Mage Armor',
    level: 1,
};

const creatureTargets = ['Goblin', 'Skeleton', 'Orc'];

function renderPopup(overrides = {}) {
    const props = {
        spell: baseSpell,
        _playerStats: {},
        _campaignName: 'test-campaign',
        range: '30 ft',
        _rangeFt: 30,
        creatureTargets,
        _maxTargets: 1,
        _attackerPos: null,
        onConfirm: vi.fn(),
        onSkip: vi.fn(),
        ...overrides,
    };
    return render(<MageArmorTargetPopup {...props} />);
}

// ── Tests ──

describe('MageArmorTargetPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default rendering ──

    it('renders the popup overlay and modal', () => {
        renderPopup();
        expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
        expect(document.querySelector('.popup-modal')).toBeInTheDocument();
    });

    it('renders the Mage Armor title with shield icon', () => {
        renderPopup();
        const titleH3 = document.querySelector('h3');
        expect(titleH3).toHaveTextContent('Mage Armor');
        const icon = document.querySelector('.fa-shield-halved');
        expect(icon).toBeInTheDocument();
    });

    it('displays spell name and level in spell name section', () => {
        renderPopup();
        const spellNameEl = document.querySelector('.metamagic-spell-name');
        expect(spellNameEl).toBeInTheDocument();
        expect(spellNameEl).toHaveTextContent('Mage Armor');
    });

    it('displays spell level and school', () => {
        renderPopup();
        expect(screen.getByText(/Level 1 Abjuration/)).toBeInTheDocument();
    });

    it('disables the Cast button when no target is selected', () => {
        renderPopup();
        const castBtn = screen.getByText('Cast Mage Armor');
        expect(castBtn).toBeDisabled();
    });

    it('shows Cancel button', () => {
        renderPopup();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('does not show creature targets when creatureTargets is empty', () => {
        renderPopup({ creatureTargets: [] });
        expect(screen.queryByText('Goblin')).not.toBeInTheDocument();
    });

    it('shows all creature targets in the list', () => {
        renderPopup();
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Skeleton')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
    });

    it('displays the range in the description', () => {
        renderPopup();
        expect(screen.getByText(/30 ft/)).toBeInTheDocument();
    });

    it('renders the AC explanation text', () => {
        renderPopup();
        expect(screen.getByText(/base AC becomes 13 \+ Dexterity modifier/)).toBeInTheDocument();
    });

    // ── Target selection ──

    it('selects a target when clicked', () => {
        renderPopup();
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.getByText('✓ Goblin')).toBeInTheDocument();
    });

    it('enables the Cast button after selecting a target', () => {
        renderPopup();
        fireEvent.click(screen.getByText('Goblin'));
        const castBtn = screen.getByText('Cast Mage Armor');
        expect(castBtn).not.toBeDisabled();
    });

    it('highlights the selected target visually', () => {
        renderPopup();
        fireEvent.click(screen.getByText('Goblin'));
        const selectedEl = screen.getByText('✓ Goblin');
        const selectedStyle = selectedEl.getAttribute('style');
        expect(selectedStyle).toContain('rgba(76, 175, 80, 0.3)');
        expect(selectedStyle).toContain('1px solid');
    });

    it('deselects previous selection when a different target is clicked', () => {
        renderPopup();
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.getByText('✓ Goblin')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Skeleton'));
        expect(screen.queryByText('✓ Goblin')).not.toBeInTheDocument();
        expect(screen.getByText('✓ Skeleton')).toBeInTheDocument();
    });

    it('calls onConfirm with selected target when Cast button is clicked', () => {
        const onConfirm = vi.fn();
        renderPopup({ onConfirm });
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Cast Mage Armor'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith(['Goblin']);
    });

    // ── Skip / Cancel ──

    it('calls onSkip when Cancel button is clicked', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.click(screen.getByText('Cancel'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when overlay is clicked', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.click(document.querySelector('.popup-overlay'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when modal content is clicked', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.click(document.querySelector('.popup-modal'));
        expect(onSkip).not.toHaveBeenCalled();
    });

    it('does not call onSkip when modal inner is clicked', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.click(document.querySelector('.metamagic-popup-inner'));
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Keyboard interaction ──

    it('calls onSkip when Escape key is pressed', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip for non-Escape keys', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onSkip).not.toHaveBeenCalled();
    });

    it('removes keydown listener on unmount', () => {
        const onSkip = vi.fn();
        const { unmount } = renderPopup({ onSkip });
        const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
        unmount();
        expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    // ── Edge cases ──

    it('handles null spell gracefully', () => {
        renderPopup({ spell: null });
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 1/)).toBeInTheDocument();
    });

    it('uses spell name from spell prop when available', () => {
        renderPopup({ spell: { name: 'Custom Spell', level: 3 } });
        expect(screen.getByText(/Custom Spell/)).toBeInTheDocument();
    });

    it('does not call onConfirm when no target is selected and Cast is clicked', () => {
        const onConfirm = vi.fn();
        renderPopup({ onConfirm });
        fireEvent.click(screen.getByText('Cast Mage Armor'));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('renders with metamagic-popup class', () => {
        renderPopup();
        expect(document.querySelector('.metamagic-popup')).toBeInTheDocument();
    });

    it('renders with metamagic-popup-inner class', () => {
        renderPopup();
        expect(document.querySelector('.metamagic-popup-inner')).toBeInTheDocument();
    });

    it('renders with metamagic-actions class', () => {
        renderPopup();
        expect(document.querySelector('.metamagic-actions')).toBeInTheDocument();
    });

    it('renders with metamagic-twin-target class', () => {
        renderPopup();
        expect(document.querySelector('.metamagic-twin-target')).toBeInTheDocument();
    });

    it('renders target label', () => {
        renderPopup();
        expect(screen.getByText('Target:')).toBeInTheDocument();
    });
});
