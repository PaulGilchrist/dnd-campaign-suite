// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MageArmorTargetPopup from './MageArmorTargetPopup.jsx';

// ── Test fixtures ──

const baseSpell = { name: 'Mage Armor', level: 1 };

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
    // ── Rendering ──

    describe('rendering', () => {
        it('displays the spell name and level from the spell prop', () => {
            renderPopup();
            expect(screen.getByRole('heading', { name: /Mage Armor/ })).toBeInTheDocument();
            expect(screen.getByText(/Level 1 Abjuration/)).toBeInTheDocument();
        });

        it('displays the spell description with range and AC formula', () => {
            renderPopup();
            expect(screen.getByText(/30 ft/)).toBeInTheDocument();
            expect(screen.getByText(/base AC becomes 13 \+ Dexterity modifier/)).toBeInTheDocument();
        });

        it('displays the target label', () => {
            renderPopup();
            expect(screen.getByText('Target:')).toBeInTheDocument();
        });

        it('displays all creature targets in the list', () => {
            renderPopup();
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.getByText('Skeleton')).toBeInTheDocument();
            expect(screen.getByText('Orc')).toBeInTheDocument();
        });

        it('hides creature targets when creatureTargets is empty', () => {
            renderPopup({ creatureTargets: [] });
            expect(screen.queryByText('Goblin')).not.toBeInTheDocument();
        });

        it('uses fallback values when spell is null', () => {
            renderPopup({ spell: null });
            expect(screen.getByText(/Spell/)).toBeInTheDocument();
            expect(screen.getByText(/Level 1/)).toBeInTheDocument();
        });

        it('uses fallback values when spell is undefined', () => {
            renderPopup({ spell: undefined });
            expect(screen.getByText(/Spell/)).toBeInTheDocument();
            expect(screen.getByText(/Level 1/)).toBeInTheDocument();
        });

        it('renders Cancel and Cast buttons', () => {
            renderPopup();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
            expect(screen.getByText('Cast Mage Armor')).toBeInTheDocument();
        });
    });

    // ── Target selection behavior ──

    describe('target selection', () => {
        it('disables the Cast button before any target is selected', () => {
            renderPopup();
            expect(screen.getByText('Cast Mage Armor')).toBeDisabled();
        });

        it('enables the Cast button after selecting a target', () => {
            renderPopup();
            fireEvent.click(screen.getByText('Goblin'));
            expect(screen.getByText('Cast Mage Armor')).not.toBeDisabled();
        });

        it('marks the selected target with a checkmark prefix', () => {
            renderPopup();
            fireEvent.click(screen.getByText('Goblin'));
            expect(screen.getByText('✓ Goblin')).toBeInTheDocument();
        });

        it('switches selection when a different target is clicked', () => {
            renderPopup();
            fireEvent.click(screen.getByText('Goblin'));
            expect(screen.getByText('✓ Goblin')).toBeInTheDocument();
            fireEvent.click(screen.getByText('Skeleton'));
            expect(screen.queryByText('✓ Goblin')).not.toBeInTheDocument();
            expect(screen.getByText('✓ Skeleton')).toBeInTheDocument();
        });

        it('does not change selection when the same target is clicked again', () => {
            renderPopup();
            fireEvent.click(screen.getByText('Goblin'));
            expect(screen.getByText('✓ Goblin')).toBeInTheDocument();
            fireEvent.click(screen.getByText('✓ Goblin'));
            expect(screen.getByText('✓ Goblin')).toBeInTheDocument();
        });

        it('calls onConfirm with the selected target when Cast is clicked', () => {
            const onConfirm = vi.fn();
            renderPopup({ onConfirm });
            fireEvent.click(screen.getByText('Goblin'));
            fireEvent.click(screen.getByText('Cast Mage Armor'));
            expect(onConfirm).toHaveBeenCalledTimes(1);
            expect(onConfirm).toHaveBeenCalledWith(['Goblin']);
        });

        it('does not call onConfirm when Cast is clicked without a selection', () => {
            const onConfirm = vi.fn();
            renderPopup({ onConfirm });
            fireEvent.click(screen.getByText('Cast Mage Armor'));
            expect(onConfirm).not.toHaveBeenCalled();
        });

        it('passes the last selected target to onConfirm when switched', () => {
            const onConfirm = vi.fn();
            renderPopup({ onConfirm });
            fireEvent.click(screen.getByText('Goblin'));
            fireEvent.click(screen.getByText('Skeleton'));
            fireEvent.click(screen.getByText('Cast Mage Armor'));
            expect(onConfirm).toHaveBeenCalledWith(['Skeleton']);
        });
    });

    // ── Skip / Cancel behavior ──

    describe('skip / cancel', () => {
        it('calls onSkip when the Cancel button is clicked', () => {
            const onSkip = vi.fn();
            renderPopup({ onSkip });
            fireEvent.click(screen.getByText('Cancel'));
            expect(onSkip).toHaveBeenCalledTimes(1);
        });

        it('calls onSkip when the overlay is clicked', () => {
            const onSkip = vi.fn();
            renderPopup({ onSkip });
            const overlay = document.querySelector('.popup-overlay');
            fireEvent.click(overlay);
            expect(onSkip).toHaveBeenCalledTimes(1);
        });

        it('does not call onSkip when modal content is clicked', () => {
            const onSkip = vi.fn();
            renderPopup({ onSkip });
            fireEvent.click(screen.getByText(/30 ft/));
            expect(onSkip).not.toHaveBeenCalled();
        });

        it('does not call onSkip for non-Escape key presses', () => {
            const onSkip = vi.fn();
            renderPopup({ onSkip });
            fireEvent.keyDown(document, { key: 'Enter' });
            expect(onSkip).not.toHaveBeenCalled();
        });

        it('calls onSkip when the Escape key is pressed', () => {
            const onSkip = vi.fn();
            renderPopup({ onSkip });
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onSkip).toHaveBeenCalledTimes(1);
        });
    });

    // ── Edge cases ──

    describe('edge cases', () => {
        it('throws when creatureTargets is null', () => {
            expect(() => renderPopup({ creatureTargets: null })).toThrow();
        });

        it('throws when creatureTargets is undefined', () => {
            expect(() => renderPopup({ creatureTargets: undefined })).toThrow();
        });

        it('uses custom spell name when provided', () => {
            renderPopup({ spell: { name: 'Custom Spell', level: 3 } });
            expect(screen.getByText('Custom Spell')).toBeInTheDocument();
            expect(screen.getByText(/Level 3 Abjuration/)).toBeInTheDocument();
        });

        it('calls onConfirm with the correct target after switching selections', () => {
            const onConfirm = vi.fn();
            renderPopup({ onConfirm });
            fireEvent.click(screen.getByText('Orc'));
            expect(screen.getByText('✓ Orc')).toBeInTheDocument();
            fireEvent.click(screen.getByText('Cast Mage Armor'));
            expect(onConfirm).toHaveBeenCalledWith(['Orc']);
        });
    });

    // ── CSS classes ──

    describe('CSS classes', () => {
        it('renders with popup-overlay class', () => {
            renderPopup();
            expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
        });

        it('renders with popup-modal class', () => {
            renderPopup();
            expect(document.querySelector('.popup-modal')).toBeInTheDocument();
        });

        it('renders with metamagic-popup class', () => {
            renderPopup();
            expect(document.querySelector('.metamagic-popup')).toBeInTheDocument();
        });

        it('renders with metamagic-popup-inner class', () => {
            renderPopup();
            expect(document.querySelector('.metamagic-popup-inner')).toBeInTheDocument();
        });

        it('renders with metamagic-spell-name class', () => {
            renderPopup();
            expect(document.querySelector('.metamagic-spell-name')).toBeInTheDocument();
        });

        it('renders with metamagic-twin-target class', () => {
            renderPopup();
            expect(document.querySelector('.metamagic-twin-target')).toBeInTheDocument();
        });

        it('renders with metamagic-actions class', () => {
            renderPopup();
            expect(document.querySelector('.metamagic-actions')).toBeInTheDocument();
        });

        it('renders btn-secondary class on Cancel button', () => {
            renderPopup();
            expect(screen.getByText('Cancel')).toHaveClass('btn-secondary');
        });

        it('renders btn class on Cast Mage Armor button', () => {
            renderPopup();
            expect(screen.getByText('Cast Mage Armor')).toHaveClass('btn');
        });

        it('renders shield-halved icon in heading', () => {
            renderPopup();
            const icon = document.querySelector('.fa-solid.fa-shield-halved');
            expect(icon).toBeInTheDocument();
        });
    });

    // ── Keyboard listener cleanup ──

    describe('keyboard listener cleanup', () => {
        it('removes keydown listener on unmount', () => {
            const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
            const { unmount } = renderPopup();
            unmount();
            expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        });
    });

    // ── Defensive guard coverage ──

    describe('defensive guard', () => {
        it('returns early from handleConfirm when needsTarget is true (no selection)', () => {
            const onConfirm = vi.fn();
            renderPopup({ onConfirm });
            // Click the disabled button - the onClick handler still fires
            fireEvent.click(screen.getByText('Cast Mage Armor'));
            expect(onConfirm).not.toHaveBeenCalled();
        });
    });
});
