// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SingleTargetPopup from './SingleTargetPopup.jsx';

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
        <SingleTargetPopup
            spell={spellProp}
            creatureTargets={targets}
            range={rangeProp}
            onConfirm={onConfirm}
            onSkip={onSkip}
            icon="fa-solid fa-shield-halved"
            title="Shield of Faith"
            school="Abjuration"
            defaultLevel={2}
            description={`Choose a creature within ${rangeProp} ft. The target gains a +2 bonus to AC.`}
            confirmLabel="Cast Shield of Faith"
        />
    );
}

// ── Tests ──

describe('SingleTargetPopup', () => {
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

    it('renders description with default range of 15 feet', () => {
        renderPopup();
        expect(
            screen.getByText((content, node) => {
                if (!node) return false;
                return node.tagName === 'P' && node.textContent.includes('Choose a creature within') && node.textContent.includes('15');
            })
        ).toBeInTheDocument();
    });

    it('renders description with custom range', () => {
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

    it('does not call onConfirm when Cast is clicked without a target', () => {
        const onConfirm = vi.fn();
        renderPopup({ onConfirm });
        fireEvent.click(screen.getByText('Cast Shield of Faith'));
        expect(onConfirm).not.toHaveBeenCalled();
    });

    // ── Target selection ──

    it('shows checkmark before selected target name', () => {
        renderPopup();
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.getByText('\u2713 Goblin')).toBeInTheDocument();
    });

    it('hides checkmark for unselected targets after selection', () => {
        renderPopup();
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.queryByText('\u2713 Skeleton')).not.toBeInTheDocument();
        expect(screen.queryByText('\u2713 Orc')).not.toBeInTheDocument();
    });

    it('enables the Cast button after a target is selected', () => {
        renderPopup();
        fireEvent.click(screen.getByText('Skeleton'));
        const castButton = screen.getByText('Cast Shield of Faith');
        expect(castButton).toBeEnabled();
    });

    it('switches selection when a different target is clicked', () => {
        renderPopup();
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.getByText('\u2713 Goblin')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Skeleton'));
        expect(screen.queryByText('\u2713 Goblin')).not.toBeInTheDocument();
        expect(screen.getByText('\u2713 Skeleton')).toBeInTheDocument();
    });

    it('calls onConfirm with selected target when Cast is clicked', () => {
        const onConfirm = vi.fn();
        renderPopup({ onConfirm });
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Cast Shield of Faith'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith(['Orc']);
    });

    it('calls onConfirm with the most recently selected target when switching', () => {
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
        expect(screen.getByText('Spell')).toBeInTheDocument();
    });

    it('renders default level 1 when spell level is missing', () => {
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

    it('throws when creatureTargets is undefined', () => {
        expect(() => renderPopup({ creatureTargets: undefined })).toThrow();
    });

    it('throws when creatureTargets is null', () => {
        expect(() => renderPopup({ creatureTargets: null })).toThrow();
    });

    it('renders correct spell name and level when spell prop is provided with custom values', () => {
        renderPopup({ spell: { name: 'Custom Spell', level: 5 } });
        expect(
            screen.getByText((content, node) => {
                if (!node) return false;
                return node.tagName === 'P' && node.textContent.includes('Custom Spell') && node.textContent.includes('Level 5');
            })
        ).toBeInTheDocument();
    });
});
