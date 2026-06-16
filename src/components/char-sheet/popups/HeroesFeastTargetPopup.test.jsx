import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HeroesFeastTargetPopup from './HeroesFeastTargetPopup.jsx';

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
};

// ── Tests ──

describe('HeroesFeastTargetPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default rendering ──

    it('renders the popup with spell title and utensils icon', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        const icon = document.querySelector('.fa-utensils');
        expect(icon).toBeInTheDocument();
        expect(document.querySelector('h3')).toHaveTextContent('Heroes\' Feast');
    });

    it('renders spell name and level in metamagic-spell-name', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        const spellNameEl = document.querySelector('.metamagic-spell-name');
        expect(spellNameEl).toHaveTextContent('Heroes\' Feast');
        expect(spellNameEl).toHaveTextContent('Level 6');
        expect(spellNameEl).toHaveTextContent('Conjuration');
    });

    it('renders with default spell values when spell is undefined', () => {
        render(<HeroesFeastTargetPopup {...baseProps} spell={undefined} />);
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 6/)).toBeInTheDocument();
    });

    it('displays range and max targets info', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        const infoP = document.querySelectorAll('p')[1];
        expect(infoP.textContent).toContain('Choose up to');
        expect(infoP.textContent).toContain('3');
        expect(infoP.textContent).toContain('creatures');
        expect(infoP.textContent).toContain('30 ft');
    });

    it('displays hpIncrease information', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        const infoP = document.querySelectorAll('p')[1];
        expect(infoP.textContent).toContain('11');
        expect(infoP.textContent).toContain('Hit Point maximum');
        expect(infoP.textContent).toContain('Resistance to Poison damage');
        expect(infoP.textContent).toContain('Immunity to the Frightened and Poisoned conditions');
    });

    // ── Target list rendering ──

    it('renders all creature targets in the target list', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        creatureTargets.forEach(name => {
            expect(screen.getByText(name)).toBeInTheDocument();
        });
    });

    it('shows target counter as 0/maxTargets initially', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        expect(screen.getByText(/Targets \(0\/3\):/)).toBeInTheDocument();
    });

    it('renders target items with clickable divs', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        const targetItems = document.querySelectorAll('[style*="cursor: pointer"]');
        expect(targetItems).toHaveLength(creatureTargets.length);
    });

    // ── Selecting targets ──

    it('selects a target when clicking on it', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.getByText(/Targets \(1\/3\):/)).toBeInTheDocument();
    });

    it('shows checkmark for selected target', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        fireEvent.click(screen.getByText('Goblin'));
        const goblinLine = screen.getByText(/Goblin/);
        expect(goblinLine.textContent).toContain('\u2713');
    });

    it('deselects a target when clicking on it again', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        const goblinItem = document.querySelectorAll('[style*="cursor: pointer"]')[0];
        fireEvent.click(goblinItem);
        expect(screen.getByText(/Targets \(1\/3\):/)).toBeInTheDocument();
        fireEvent.click(goblinItem);
        expect(screen.getByText(/Targets \(0\/3\):/)).toBeInTheDocument();
    });

    it('does not select more than maxTargets', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Troll'));
        expect(screen.getByText(/Targets \(3\/3\):/)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Dragon'));
        expect(screen.getByText(/Targets \(3\/3\):/)).toBeInTheDocument();
    });

    it('respects different maxTargets values', () => {
        render(<HeroesFeastTargetPopup {...baseProps} maxTargets={1} />);
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.getByText(/Targets \(1\/1\):/)).toBeInTheDocument();
        fireEvent.click(screen.getByText('Orc'));
        expect(screen.getByText(/Targets \(1\/1\):/)).toBeInTheDocument();
    });

    // ── Confirm button state ──

    it('disables confirm button when no targets selected', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        const confirmBtn = screen.getByText('Cast Heroes\' Feast');
        expect(confirmBtn).toBeDisabled();
    });

    it('enables confirm button when at least one target selected', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        fireEvent.click(screen.getByText('Goblin'));
        const confirmBtn = screen.getByText('Cast Heroes\' Feast');
        expect(confirmBtn).toBeEnabled();
    });

    it('calls onConfirm with selected targets when confirm button is clicked', () => {
        const onConfirm = vi.fn();
        render(<HeroesFeastTargetPopup {...baseProps} onConfirm={onConfirm} />);
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Cast Heroes\' Feast'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith(['Goblin', 'Orc']);
    });

    it('does not call onConfirm when confirm clicked with no targets', () => {
        const onConfirm = vi.fn();
        render(<HeroesFeastTargetPopup {...baseProps} onConfirm={onConfirm} />);
        fireEvent.click(screen.getByText('Cast Heroes\' Feast'));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    // ── Cancel / skip actions ──

    it('calls onSkip when Cancel button is clicked', () => {
        const onSkip = vi.fn();
        render(<HeroesFeastTargetPopup {...baseProps} onSkip={onSkip} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when overlay is clicked', () => {
        const onSkip = vi.fn();
        render(<HeroesFeastTargetPopup {...baseProps} onSkip={onSkip} />);
        fireEvent.click(document.querySelector('.popup-overlay'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when modal content is clicked', () => {
        const onSkip = vi.fn();
        render(<HeroesFeastTargetPopup {...baseProps} onSkip={onSkip} />);
        fireEvent.click(document.querySelector('.popup-modal'));
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Keyboard interaction ──

    it('calls onSkip when Escape key is pressed', () => {
        const onSkip = vi.fn();
        render(<HeroesFeastTargetPopup {...baseProps} onSkip={onSkip} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when other keys are pressed', () => {
        const onSkip = vi.fn();
        render(<HeroesFeastTargetPopup {...baseProps} onSkip={onSkip} />);
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onSkip).not.toHaveBeenCalled();
    });

    it('removes keydown listener on unmount', () => {
        const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
        const { unmount } = render(<HeroesFeastTargetPopup {...baseProps} onSkip={vi.fn()} />);
        unmount();
        expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        removeListenerSpy.mockRestore();
    });

    // ── CSS classes ──

    it('renders popup-overlay class', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
    });

    it('renders popup-modal class', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        expect(document.querySelector('.popup-modal')).toBeInTheDocument();
    });

    it('renders metamagic-popup class', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        expect(document.querySelector('.metamagic-popup')).toBeInTheDocument();
    });

    it('renders metamagic-popup-inner class', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        expect(document.querySelector('.metamagic-popup-inner')).toBeInTheDocument();
    });

    it('renders btn and btn-secondary classes on cancel button', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        const cancelBtn = screen.getByText('Cancel');
        expect(cancelBtn.className).toContain('btn');
        expect(cancelBtn.className).toContain('btn-secondary');
    });

    it('renders btn class on confirm button', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        const confirmBtn = screen.getByText('Cast Heroes\' Feast');
        expect(confirmBtn.className).toContain('btn');
    });

    // ── Empty creature targets ──

    it('renders empty target list when creatureTargets is empty', () => {
        render(<HeroesFeastTargetPopup {...baseProps} creatureTargets={[]} />);
        expect(screen.getByText(/Targets \(0\/3\):/)).toBeInTheDocument();
    });

    it('keeps confirm button disabled when creatureTargets is empty', () => {
        render(<HeroesFeastTargetPopup {...baseProps} creatureTargets={[]} />);
        const confirmBtn = screen.getByText('Cast Heroes\' Feast');
        expect(confirmBtn).toBeDisabled();
    });

    // ── Multiple target selection ──

    it('tracks multiple selected targets correctly', () => {
        render(<HeroesFeastTargetPopup {...baseProps} />);
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Troll'));
        expect(screen.getByText(/Targets \(3\/3\):/)).toBeInTheDocument();
    });

    it('calls onConfirm with all selected targets in order', () => {
        const onConfirm = vi.fn();
        render(<HeroesFeastTargetPopup {...baseProps} onConfirm={onConfirm} />);
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Troll'));
        fireEvent.click(screen.getByText('Cast Heroes\' Feast'));
        expect(onConfirm).toHaveBeenCalledWith(['Goblin', 'Orc', 'Troll']);
    });
});
