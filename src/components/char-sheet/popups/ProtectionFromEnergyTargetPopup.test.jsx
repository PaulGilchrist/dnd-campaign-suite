import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProtectionFromEnergyTargetPopup from './ProtectionFromEnergyTargetPopup.jsx';

// ── Test fixtures ──

const baseSpell = {
    name: 'Protection from Energy',
    level: 3,
};

const creatureTargets = ['Ally 1', 'Ally 2', 'Ally 3'];
const damageTypes = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

function makeProps(overrides = {}) {
    return {
        spell: baseSpell,
        _playerStats: {},
        _campaignName: 'test-campaign',
        range: 30,
        creatureTargets,
        damageTypes,
        onConfirm: vi.fn(),
        onSkip: vi.fn(),
        ...overrides,
    };
}

// ── Tests ──

describe('ProtectionFromEnergyTargetPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Default rendering ──

    it('renders the popup with shield icon and title', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        const icon = document.querySelector('.fa-solid.fa-shield-halved');
        expect(icon).toBeInTheDocument();
        expect(document.querySelector('h3')).toHaveTextContent('Protection from Energy');
    });

    it('displays spell name and level in spell name section', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-spell-name strong')).toHaveTextContent('Protection from Energy');
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
        expect(document.querySelector('.metamagic-spell-name')).toHaveTextContent(/Abjuration/);
    });

    it('displays range in the description', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(screen.getByText(/30/)).toBeInTheDocument();
    });

    it('renders creature target list', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(screen.getByText('Target:')).toBeInTheDocument();
        creatureTargets.forEach(target => {
            expect(screen.getByText(target)).toBeInTheDocument();
        });
    });

    it('renders damage type list', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(screen.getByText('Damage Type:')).toBeInTheDocument();
        damageTypes.forEach(type => {
            expect(screen.getByText(type)).toBeInTheDocument();
        });
    });

    it('renders Cancel and Cast buttons', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Cast Protection from Energy')).toBeInTheDocument();
    });

    it('renders with popup-overlay class', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        const overlay = document.querySelector('.popup-overlay');
        expect(overlay).toBeInTheDocument();
    });

    it('renders with metamagic-popup class', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        const modal = document.querySelector('.metamagic-popup');
        expect(modal).toBeInTheDocument();
    });

    // ── Null/undefined spell handling ──

    it('shows fallback text when spell is null', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ spell: null })} />);
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    });

    it('shows fallback text when spell name is undefined', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ spell: {} })} />);
        expect(screen.getByText(/Spell/)).toBeInTheDocument();
        expect(screen.getByText(/Level 3/)).toBeInTheDocument();
    });

    // ── Target selection ──

    it('does not show checkmark next to targets before selection', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        creatureTargets.forEach(target => {
            expect(screen.getByText(target)).toBeInTheDocument();
        });
        // The checkmark character is '\u2713' which appears before the name
        // Since no target is selected, no item should start with the checkmark
        const allItems = Array.from(document.querySelectorAll('.metamagic-twin-target div div'));
        allItems.forEach(item => {
            expect(item.textContent).not.toMatch(/^\u2713/);
        });
    });

    it('calls onConfirm with selected target and damage type when both are selected', () => {
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

    // ── Cancel / skip ──

    it('calls onSkip when Cancel button is clicked', () => {
        const onSkip = vi.fn();
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ onSkip })} />);

        fireEvent.click(screen.getByText('Cancel'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when overlay is clicked', () => {
        const onSkip = vi.fn();
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ onSkip })} />);

        const overlay = document.querySelector('.popup-overlay');
        fireEvent.click(overlay);
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when modal content is clicked', () => {
        const onSkip = vi.fn();
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ onSkip })} />);

        const modal = document.querySelector('.metamagic-popup');
        fireEvent.click(modal);
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Keyboard interactions ──

    it('calls onSkip when Escape key is pressed', () => {
        const onSkip = vi.fn();
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ onSkip })} />);

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip for other keys', () => {
        const onSkip = vi.fn();
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ onSkip })} />);

        fireEvent.keyDown(document, { key: 'Enter' });
        expect(onSkip).not.toHaveBeenCalled();
    });

    // ── Button disabled state ──

    it('has disabled Cast button when no selections made', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        const castButton = screen.getByText('Cast Protection from Energy');
        expect(castButton).toBeDisabled();
    });

    it('has disabled Cast button when only target selected', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Ally 1'));
        const castButton = screen.getByText('Cast Protection from Energy');
        expect(castButton).toBeDisabled();
    });

    it('has disabled Cast button when only damage type selected', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Acid'));
        const castButton = screen.getByText('Cast Protection from Energy');
        expect(castButton).toBeDisabled();
    });

    it('has enabled Cast button when both target and damage type selected', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Ally 1'));
        fireEvent.click(screen.getByText('Acid'));
        const castButton = screen.getByText('Cast Protection from Energy');
        expect(castButton).toBeEnabled();
    });

    // ── Empty lists ──

    it('renders with empty creature targets list', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ creatureTargets: [] })} />);
        expect(screen.getByText('Target:')).toBeInTheDocument();
    });

    it('renders with empty damage types list', () => {
        render(<ProtectionFromEnergyTargetPopup {...makeProps({ damageTypes: [] })} />);
        expect(screen.getByText('Damage Type:')).toBeInTheDocument();
    });
});
