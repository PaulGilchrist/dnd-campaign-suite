import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default rendering ──

    it('renders the popup with resistance title and shield icon', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        expect(screen.getByText('Resistance')).toBeInTheDocument();
        const icon = document.querySelector('.fa-shield-halved');
        expect(icon).toBeInTheDocument();
    });

    it('displays spell name and level', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        expect(screen.getByText('Shield')).toBeInTheDocument();
        expect(screen.getByText(/Level 1 Abjuration/)).toBeInTheDocument();
    });

    it('displays description text', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        expect(screen.getByText(/Choose a willing creature within/)).toBeInTheDocument();
        expect(screen.getByText(/reduces the damage by 1d4/)).toBeInTheDocument();
        expect(screen.getByText(/This can only happen once per turn/)).toBeInTheDocument();
    });

    it('displays the range value', () => {
        render(<ResistanceTargetPopup {...makeProps({ range: 60 })} />);
        expect(screen.getByText(/60/)).toBeInTheDocument();
    });

    it('renders with popup-overlay class', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        const overlay = document.querySelector('.popup-overlay');
        expect(overlay).toBeInTheDocument();
    });

    it('renders with popup-modal and metamagic-popup classes', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        const modal = document.querySelector('.popup-modal.metamagic-popup');
        expect(modal).toBeInTheDocument();
    });

    // ── Creature targets section ──

    it('renders all creature targets', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        creatureTargets.forEach(name => {
            expect(screen.getByText(name)).toBeInTheDocument();
        });
    });

    it('renders damage types', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        damageTypes.forEach(type => {
            expect(screen.getByText(type)).toBeInTheDocument();
        });
    });

    it('highlights selected creature target with checkmark and green styling', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        const alric = screen.getByText('Alric');
        fireEvent.click(alric);
        expect(alric.textContent).toContain('\u2713');
    });

    it('highlights selected damage type with checkmark and green styling', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        const fire = screen.getByText('Fire');
        fireEvent.click(fire);
        expect(fire.textContent).toContain('\u2713');
    });

    it('calls onConfirm with selected target and damage type when both are selected', () => {
        const onConfirm = vi.fn();
        render(<ResistanceTargetPopup {...makeProps({ onConfirm })} />);
        const alric = screen.getByText('Alric');
        const fire = screen.getByText('Fire');
        fireEvent.click(alric);
        fireEvent.click(fire);
        const confirmBtn = screen.getByText('Cast Resistance');
        fireEvent.click(confirmBtn);
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Alric', damageType: 'Fire' });
    });

    it('does not call onConfirm when target is not selected', () => {
        const onConfirm = vi.fn();
        render(<ResistanceTargetPopup {...makeProps({ onConfirm })} />);
        const fire = screen.getByText('Fire');
        fireEvent.click(fire);
        const confirmBtn = screen.getByText('Cast Resistance');
        fireEvent.click(confirmBtn);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('does not call onConfirm when damage type is not selected', () => {
        const onConfirm = vi.fn();
        render(<ResistanceTargetPopup {...makeProps({ onConfirm })} />);
        const alric = screen.getByText('Alric');
        fireEvent.click(alric);
        const confirmBtn = screen.getByText('Cast Resistance');
        fireEvent.click(confirmBtn);
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('disables confirm button when target is not selected', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        const fire = screen.getByText('Fire');
        fireEvent.click(fire);
        const confirmBtn = screen.getByText('Cast Resistance');
        expect(confirmBtn).toBeDisabled();
    });

    it('disables confirm button when damage type is not selected', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        const alric = screen.getByText('Alric');
        fireEvent.click(alric);
        const confirmBtn = screen.getByText('Cast Resistance');
        expect(confirmBtn).toBeDisabled();
    });

    it('enables confirm button when both target and damage type are selected', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        const alric = screen.getByText('Alric');
        const fire = screen.getByText('Fire');
        fireEvent.click(alric);
        fireEvent.click(fire);
        const confirmBtn = screen.getByText('Cast Resistance');
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
        const confirmBtn = screen.getByText('Cast Resistance');
        fireEvent.click(confirmBtn);
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
        const confirmBtn = screen.getByText('Cast Resistance');
        fireEvent.click(confirmBtn);
        expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Alric', damageType: 'Fire' });
    });

    // ── Cancel / skip ──

    it('calls onSkip when Cancel button is clicked', () => {
        const onSkip = vi.fn();
        render(<ResistanceTargetPopup {...makeProps({ onSkip })} />);
        const cancelBtn = screen.getByText('Cancel');
        fireEvent.click(cancelBtn);
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

    // ── Keyboard handling ──

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

    // ── Null/missing spell ──

    it('renders fallback text when spell is null', () => {
        render(<ResistanceTargetPopup {...makeProps({ spell: null })} />);
        expect(screen.getByText('Spell')).toBeInTheDocument();
        expect(screen.getByText(/Level 0 Abjuration/)).toBeInTheDocument();
    });

    // ── CSS classes ──

    it('renders metamagic-popup-inner class', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        const inner = document.querySelector('.metamagic-popup-inner');
        expect(inner).toBeInTheDocument();
    });

    it('renders metamagic-spell-name class', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        const spellName = document.querySelector('.metamagic-spell-name');
        expect(spellName).toBeInTheDocument();
    });

    it('renders metamagic-twin-target class', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        const targets = document.querySelectorAll('.metamagic-twin-target');
        expect(targets.length).toBeGreaterThan(0);
    });

    it('renders metamagic-actions class', () => {
        render(<ResistanceTargetPopup {...makeProps()} />);
        const actions = document.querySelector('.metamagic-actions');
        expect(actions).toBeInTheDocument();
    });
});
