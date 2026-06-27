// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MultiTargetCountPopup from './MultiTargetCountPopup.jsx';

// ── Test fixtures ──

const creatureTargets = ['Goblin', 'Orc', 'Troll', 'Dragon'];

const baseProps = {
    spell: { name: 'Heroes\' Feast', level: 6 },
    _playerStats: {},
    _campaignName: 'test-campaign',
    range: '30 ft.',
    _rangeFt: 30,
    creatureTargets,
    maxTargets: 3,
    _attackerPos: {},
    onConfirm: vi.fn(),
    onSkip: vi.fn(),
    icon: 'fa-solid fa-utensils',
    title: 'Heroes\' Feast',
    school: 'Conjuration',
    defaultLevel: 6,
    description: "Choose up to 3 creatures within 30 ft. Each target's Hit Point maximum increases by 11, and they gain Resistance to Poison damage and Immunity to the Frightened and Poisoned conditions.",
    confirmLabel: "Cast Heroes' Feast",
};

function renderPopup(props) {
    return render(<MultiTargetCountPopup {...baseProps} {...props} />);
}

// ── Tests ──

describe('MultiTargetCountPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default rendering ──

    it('renders the popup with spell title and utensils icon', () => {
        renderPopup({});
        const icon = document.querySelector('.fa-utensils');
        expect(icon).toBeInTheDocument();
        expect(document.querySelector('h3')).toHaveTextContent('Heroes\' Feast');
    });

    it('renders spell name and level in metamagic-spell-name', () => {
        renderPopup({});
        const spellNameEl = document.querySelector('.metamagic-spell-name');
        expect(spellNameEl).toHaveTextContent('Heroes\' Feast');
        expect(spellNameEl).toHaveTextContent('Level 6');
        expect(spellNameEl).toHaveTextContent('Conjuration');
    });

    it('displays default spell name and level when spell is undefined', () => {
        renderPopup({ spell: undefined });
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 6/)).toBeInTheDocument();
    });

    it('displays default spell name and level when spell has no name or level', () => {
        renderPopup({ spell: {} });
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 6/)).toBeInTheDocument();
    });

    it('displays range and max targets info', () => {
        renderPopup({});
        const infoP = document.querySelectorAll('p')[1];
        expect(infoP.textContent).toContain('Choose up to');
        expect(infoP.textContent).toContain('3');
        expect(infoP.textContent).toContain('creatures');
        expect(infoP.textContent).toContain('30 ft.');
    });

    it('displays hpIncrease information', () => {
        renderPopup({});
        const infoP = document.querySelectorAll('p')[1];
        expect(infoP.textContent).toContain('11');
        expect(infoP.textContent).toContain('Hit Point maximum');
        expect(infoP.textContent).toContain('Resistance to Poison damage');
        expect(infoP.textContent).toContain('Immunity to the Frightened and Poisoned conditions');
    });

    // ── Target list rendering ──

    it('renders all creature targets in the target list', () => {
        renderPopup({});
        creatureTargets.forEach(name => {
            expect(screen.getByText(name)).toBeInTheDocument();
        });
    });

    it('shows target counter as 0/maxTargets initially', () => {
        renderPopup({});
        expect(screen.getByText(/Targets \(0\/3\):/)).toBeInTheDocument();
    });

    it('renders target items with clickable divs', () => {
        renderPopup({});
        const targetItems = document.querySelectorAll('[style*="cursor: pointer"]');
        expect(targetItems).toHaveLength(creatureTargets.length);
    });

    // ── Selecting targets ──

    it('selects a target when clicking on it', () => {
        renderPopup({});
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.getByText(/Targets \(1\/3\):/)).toBeInTheDocument();
    });

    it('shows checkmark for selected target', () => {
        renderPopup({});
        fireEvent.click(screen.getByText('Goblin'));
        const goblinLine = screen.getByText(/Goblin/);
        expect(goblinLine.textContent).toContain('\u2713');
    });

    it('deselects a target when clicking on it again', () => {
        renderPopup({});
        const goblinItem = document.querySelectorAll('[style*="cursor: pointer"]')[0];
        fireEvent.click(goblinItem);
        expect(screen.getByText(/Targets \(1\/3\):/)).toBeInTheDocument();
        fireEvent.click(goblinItem);
        expect(screen.getByText(/Targets \(0\/3\):/)).toBeInTheDocument();
    });

    it('does not select more than maxTargets', () => {
        renderPopup({});
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Troll'));
        expect(screen.getByText(/Targets \(3\/3\):/)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Dragon'));
        expect(screen.getByText(/Targets \(3\/3\):/)).toBeInTheDocument();
    });

    it('respects different maxTargets values', () => {
        renderPopup({ maxTargets: 1 });
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.getByText(/Targets \(1\/1\):/)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Orc'));
        expect(screen.getByText(/Targets \(1\/1\):/)).toBeInTheDocument();
    });

    // ── Confirm button state ──

    it('disables confirm button when no targets selected', () => {
        renderPopup({});
        const confirmBtn = screen.getByText('Cast Heroes\' Feast');
        expect(confirmBtn).toBeDisabled();
    });

    it('enables confirm button when at least one target selected', () => {
        renderPopup({});
        fireEvent.click(screen.getByText('Goblin'));
        const confirmBtn = screen.getByText('Cast Heroes\' Feast');
        expect(confirmBtn).toBeEnabled();
    });

    it('calls onConfirm with selected targets when confirm button is clicked', () => {
        const onConfirm = vi.fn();
        renderPopup({ onConfirm });
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Cast Heroes\' Feast'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith(['Goblin', 'Orc']);
    });

    it('does not call onConfirm when confirm clicked with no targets', () => {
        const onConfirm = vi.fn();
        renderPopup({ onConfirm });
        fireEvent.click(screen.getByText('Cast Heroes\' Feast'));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    // ── Cancel / skip actions ──

    it('calls onSkip when Cancel button is clicked', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.click(screen.getByText('Cancel'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when overlay is clicked', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        const overlay = document.querySelector('.popup-overlay');
        expect(overlay).not.toBeNull();
        fireEvent.click(overlay);
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when modal content is clicked', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        const modal = document.querySelector('.popup-modal');
        expect(modal).not.toBeNull();
        fireEvent.click(modal);
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Keyboard interaction ──

    it('calls onSkip when Escape key is pressed', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when other keys are pressed', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Empty creature targets ──

    it('renders empty target list when creatureTargets is empty', () => {
        renderPopup({ creatureTargets: [] });
        expect(screen.getByText(/Targets \(0\/3\):/)).toBeInTheDocument();
    });

    it('keeps confirm button disabled when creatureTargets is empty', () => {
        renderPopup({ creatureTargets: [] });
        const confirmBtn = screen.getByText('Cast Heroes\' Feast');
        expect(confirmBtn).toBeDisabled();
    });

    // ── Multiple target selection ──

    it('tracks multiple selected targets correctly', () => {
        renderPopup({});
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Troll'));
        expect(screen.getByText(/Targets \(3\/3\):/)).toBeInTheDocument();
    });

    it('calls onConfirm with all selected targets in order', () => {
        const onConfirm = vi.fn();
        renderPopup({ onConfirm });
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Troll'));
        fireEvent.click(screen.getByText('Cast Heroes\' Feast'));
        expect(onConfirm).toHaveBeenCalledWith(['Goblin', 'Orc', 'Troll']);
    });

    // ── Toggle behavior edge cases ──

    it('toggles individual targets independently', () => {
        renderPopup({});
        fireEvent.click(screen.getByText(/Goblin/));
        expect(screen.getByText(/Targets \(1\/3\):/)).toBeInTheDocument();
        fireEvent.click(screen.getByText(/Orc/));
        expect(screen.getByText(/Targets \(2\/3\):/)).toBeInTheDocument();
        fireEvent.click(screen.getByText(/Goblin/));
        expect(screen.getByText(/Targets \(1\/3\):/)).toBeInTheDocument();
        expect(screen.getByText(/Orc/)).toBeInTheDocument();
    });

    it('prevents selection when at max but allows deselection then reselection', () => {
        renderPopup({});
        fireEvent.click(screen.getByText(/Goblin/));
        fireEvent.click(screen.getByText(/Orc/));
        fireEvent.click(screen.getByText(/Troll/));
        expect(screen.getByText(/Targets \(3\/3\):/)).toBeInTheDocument();
        // Should not add Dragon
        fireEvent.click(screen.getByText(/Dragon/));
        expect(screen.getByText(/Targets \(3\/3\):/)).toBeInTheDocument();
        // Deselect one, then add another
        fireEvent.click(screen.getByText(/Goblin/));
        expect(screen.getByText(/Targets \(2\/3\):/)).toBeInTheDocument();
        fireEvent.click(screen.getByText(/Dragon/));
        expect(screen.getByText(/Targets \(3\/3\):/)).toBeInTheDocument();
    });

    // ── Spell name display ──

    it('renders custom spell name when provided', () => {
        renderPopup({ spell: { name: 'Custom Spell', level: 3 } });
        expect(screen.getByText(/Custom Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    });

    // ── Unmount cleanup ──

    it('removes keydown listener on unmount', () => {
        const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
        const { unmount } = renderPopup({ onSkip: vi.fn() });
        unmount();
        expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        removeListenerSpy.mockRestore();
    });
});
