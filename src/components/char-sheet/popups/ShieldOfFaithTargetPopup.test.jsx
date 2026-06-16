import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ShieldOfFaithTargetPopup from './ShieldOfFaithTargetPopup.jsx';

// ── Test fixtures ──

const creatureTargets = ['Goblin', 'Skeleton', 'Orc'];

const spell = {
    name: 'Shield of Faith',
    level: 2,
};

function renderPopup(overrides = {}) {
    const {
        spell: spellProp,
        creatureTargets: targets,
        range: rangeProp,
        onConfirm,
        onSkip,
    } = {
        spell: spell,
        creatureTargets: creatureTargets,
        range: 15,
        onConfirm: vi.fn(),
        onSkip: vi.fn(),
        ...overrides,
    };
    return render(
        <ShieldOfFaithTargetPopup
            spell={spellProp}
            creatureTargets={targets}
            range={rangeProp}
            onConfirm={onConfirm}
            onSkip={onSkip}
        />
    );
}

// ── Tests ──

describe('ShieldOfFaithTargetPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default rendering ──

    it('renders the popup with shield icon and title', () => {
        renderPopup();
        expect(document.querySelector('h3')).toHaveTextContent('Shield of Faith');
        const icon = document.querySelector('.fa-shield-halved');
        expect(icon).toBeInTheDocument();
    });

    it('renders spell name and level info', () => {
        renderPopup();
        expect(document.querySelector('.metamagic-spell-name')).toHaveTextContent('Shield of Faith');
        expect(document.querySelector('.metamagic-spell-name')).toHaveTextContent(/Level 2 Abjuration/);
    });

    it('renders description with range', () => {
        renderPopup({ range: 30 });
        expect(
            screen.getByText((content, node) => {
                if (!node) return false;
                return node.tagName === 'P' && node.textContent.includes('Choose a creature within') && node.textContent.includes('30');
            })
        ).toBeInTheDocument();
    });

    it('renders target label', () => {
        renderPopup();
        expect(screen.getByText('Target:')).toBeInTheDocument();
    });

    it('renders all creature targets', () => {
        renderPopup();
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Skeleton')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
    });

    it('renders Cancel and Cast buttons', () => {
        renderPopup();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Cast Shield of Faith')).toBeInTheDocument();
    });

    it('disables the Cast button when no target is selected', () => {
        renderPopup();
        const castButton = screen.getByText('Cast Shield of Faith');
        expect(castButton).toBeDisabled();
    });

    // ── Target selection ──

    it('shows checkmark before selected target name', () => {
        renderPopup();
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.getByText('✓ Goblin')).toBeInTheDocument();
    });

    it('hides checkmark for unselected targets', () => {
        renderPopup();
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.queryByText('✓ Skeleton')).not.toBeInTheDocument();
        expect(screen.queryByText('✓ Orc')).not.toBeInTheDocument();
    });

    it('enables the Cast button after a target is selected', () => {
        renderPopup();
        fireEvent.click(screen.getByText('Skeleton'));
        const castButton = screen.getByText('Cast Shield of Faith');
        expect(castButton).toBeEnabled();
    });

    it('calls onConfirm with selected target when Cast is clicked', () => {
        const onConfirm = vi.fn();
        renderPopup({ onConfirm });
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Cast Shield of Faith'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith(['Orc']);
    });

    it('calls onConfirm with the most recently selected target', () => {
        const onConfirm = vi.fn();
        renderPopup({ onConfirm });
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Skeleton'));
        fireEvent.click(screen.getByText('Cast Shield of Faith'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith(['Skeleton']);
    });

    // ── Cancel / Skip ──

    it('calls onSkip when Cancel button is clicked', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.click(screen.getByText('Cancel'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when overlay background is clicked', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        const overlay = document.querySelector('.popup-overlay');
        fireEvent.click(overlay);
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when modal content is clicked', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        const modal = document.querySelector('.popup-modal');
        fireEvent.click(modal);
        expect(onSkip).not.toHaveBeenCalled();
    });

    it('calls onSkip when Escape key is pressed', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip for non-Escape key press', () => {
        const onSkip = vi.fn();
        renderPopup({ onSkip });
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Edge cases ──

    it('renders default spell name when spell prop is null', () => {
        renderPopup({ spell: null });
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
    });

    it('renders default level when spell level is missing', () => {
        renderPopup({ spell: { name: 'Shield of Faith' } });
        expect(screen.getByText(/Level 1 Abjuration/)).toBeInTheDocument();
    });

    it('renders empty target list when creatureTargets is empty', () => {
        renderPopup({ creatureTargets: [] });
        expect(screen.getByText('Target:')).toBeInTheDocument();
        expect(screen.queryByText('Goblin')).not.toBeInTheDocument();
    });

    it('renders Cast button disabled when creatureTargets is empty', () => {
        renderPopup({ creatureTargets: [] });
        const castButton = screen.getByText('Cast Shield of Faith');
        expect(castButton).toBeDisabled();
    });

    // ── CSS classes ──

    it('renders with popup-overlay class', () => {
        renderPopup();
        const overlay = document.querySelector('.popup-overlay');
        expect(overlay).toBeInTheDocument();
    });

    it('renders with popup-modal class', () => {
        renderPopup();
        const modal = document.querySelector('.popup-modal');
        expect(modal).toBeInTheDocument();
    });

    it('renders with metamagic-popup class', () => {
        renderPopup();
        const metamagicPopup = document.querySelector('.metamagic-popup');
        expect(metamagicPopup).toBeInTheDocument();
    });

    it('renders with metamagic-popup-inner class', () => {
        renderPopup();
        const inner = document.querySelector('.metamagic-popup-inner');
        expect(inner).toBeInTheDocument();
    });

    it('renders with metamagic-spell-name class', () => {
        renderPopup();
        const spellName = document.querySelector('.metamagic-spell-name');
        expect(spellName).toBeInTheDocument();
    });

    it('renders with metamagic-twin-target class', () => {
        renderPopup();
        const twinTarget = document.querySelector('.metamagic-twin-target');
        expect(twinTarget).toBeInTheDocument();
    });

    it('renders with metamagic-actions class', () => {
        renderPopup();
        const actions = document.querySelector('.metamagic-actions');
        expect(actions).toBeInTheDocument();
    });

    it('renders btn-secondary class on Cancel button', () => {
        renderPopup();
        const cancelButton = screen.getByText('Cancel');
        expect(cancelButton).toHaveClass('btn-secondary');
    });

    it('renders btn class on Cast button', () => {
        renderPopup();
        const castButton = screen.getByText('Cast Shield of Faith');
        expect(castButton).toHaveClass('btn');
    });
});
