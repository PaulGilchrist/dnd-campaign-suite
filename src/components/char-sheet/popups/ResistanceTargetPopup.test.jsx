// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TargetWithTypePopup from './TargetWithTypePopup.jsx';

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
        icon: 'fa-solid fa-shield-halved',
        title: 'Resistance',
        school: 'Abjuration',
        defaultLevel: 1,
        description: 'Choose a willing creature within range. Until the spell ends, the target reduces the damage by 1d4. This can only happen once per turn.',
        confirmLabel: 'Cast Resistance',
        ...overrides,
    };
}

// ── Tests ──

describe('TargetWithTypePopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Rendering ──

    describe('rendering', () => {
        it('renders the popup title with shield icon', () => {
            render(<TargetWithTypePopup {...makeProps()} />);
            expect(screen.getByText('Resistance')).toBeInTheDocument();
        });

        it('displays spell name and level', () => {
            render(<TargetWithTypePopup {...makeProps()} />);
            expect(screen.getByText('Shield')).toBeInTheDocument();
            expect(screen.getByText(/Level 1 Abjuration/)).toBeInTheDocument();
        });

        it('displays the description text', () => {
            render(<TargetWithTypePopup {...makeProps({ range: 60 })} />);
            expect(screen.getByText(/Choose a willing creature within/)).toBeInTheDocument();
            expect(screen.getByText(/reduces the damage by 1d4/)).toBeInTheDocument();
            expect(screen.getByText(/This can only happen once per turn/)).toBeInTheDocument();
        });

        it('renders all creature targets and damage types', () => {
            render(<TargetWithTypePopup {...makeProps()} />);
            for (const name of creatureTargets) {
                expect(screen.getByText(name)).toBeInTheDocument();
            }
            for (const type of damageTypes) {
                expect(screen.getByText(type)).toBeInTheDocument();
            }
        });

        it('renders cancel and confirm buttons', () => {
            render(<TargetWithTypePopup {...makeProps()} />);
            expect(screen.getByText('Cancel')).toBeInTheDocument();
            expect(screen.getByText('Cast Resistance')).toBeInTheDocument();
        });

        it('renders fallback text when spell is null', () => {
            render(<TargetWithTypePopup {...makeProps({ spell: null })} />);
            expect(screen.getByText('Spell')).toBeInTheDocument();
            expect(screen.getByText(/Level 1 Abjuration/)).toBeInTheDocument();
        });

        it('renders fallback text when spell is undefined', () => {
            render(<TargetWithTypePopup {...makeProps({ spell: undefined })} />);
            expect(screen.getByText('Spell')).toBeInTheDocument();
            expect(screen.getByText(/Level 1 Abjuration/)).toBeInTheDocument();
        });

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

        it('renders btn class on Cast Resistance button', () => {
            render(<TargetWithTypePopup {...makeProps()} />);
            expect(screen.getByText('Cast Resistance')).toHaveClass('btn');
        });

        it('renders shield-halved icon in the title', () => {
            render(<TargetWithTypePopup {...makeProps()} />);
            const icon = document.querySelector('.fa-solid.fa-shield-halved');
            expect(icon).toBeInTheDocument();
        });
    });

    // ── Spell prop edge cases ──

    describe('spell prop edge cases', () => {
        it('shows fallback text when spell has no name', () => {
            render(<TargetWithTypePopup {...makeProps({ spell: {} })} />);
            const spellNameEl = document.querySelector('.metamagic-spell-name strong');
            expect(spellNameEl.textContent).toBe('Spell');
        });

        it('shows default level when spell has no level', () => {
            render(<TargetWithTypePopup {...makeProps({ spell: { name: 'Test' } })} />);
            expect(screen.getByText(/Level 1/)).toBeInTheDocument();
        });
    });

    // ── Selection behavior ──

    describe('selection', () => {
        it('disables confirm button until both target and damage type are selected', () => {
            render(<TargetWithTypePopup {...makeProps()} />);
            const confirmBtn = screen.getByText('Cast Resistance');
            expect(confirmBtn).toBeDisabled();

            const alric = screen.getByText('Alric');
            fireEvent.click(alric);
            expect(confirmBtn).toBeDisabled();

            const fire = screen.getByText('Fire');
            fireEvent.click(fire);
            expect(confirmBtn).toBeEnabled();
        });

        it('allows switching target selection', () => {
            const onConfirm = vi.fn();
            render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);
            const alric = screen.getByText('Alric');
            const brea = screen.getByText('Brea');
            const fire = screen.getByText('Fire');
            fireEvent.click(alric);
            fireEvent.click(brea);
            fireEvent.click(fire);
            fireEvent.click(screen.getByText('Cast Resistance'));
            expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Brea', damageType: 'Fire' });
        });

        it('allows switching damage type selection', () => {
            const onConfirm = vi.fn();
            render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);
            const alric = screen.getByText('Alric');
            const cold = screen.getByText('Cold');
            const fire = screen.getByText('Fire');
            fireEvent.click(alric);
            fireEvent.click(cold);
            fireEvent.click(fire);
            fireEvent.click(screen.getByText('Cast Resistance'));
            expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Alric', damageType: 'Fire' });
        });

        it('shows checkmark for selected target', () => {
            render(<TargetWithTypePopup {...makeProps()} />);
            const alric = screen.getByText('Alric');
            fireEvent.click(alric);
            expect(alric.textContent).toContain('\u2713');
        });

        it('shows checkmark for selected damage type', () => {
            render(<TargetWithTypePopup {...makeProps()} />);
            const fire = screen.getByText('Fire');
            fireEvent.click(fire);
            expect(fire.textContent).toContain('\u2713');
        });
    });

    // ── Confirm behavior ──

    describe('confirm', () => {
        it('calls onConfirm with selected target and damage type', () => {
            const onConfirm = vi.fn();
            render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);
            fireEvent.click(screen.getByText('Alric'));
            fireEvent.click(screen.getByText('Fire'));
            fireEvent.click(screen.getByText('Cast Resistance'));
            expect(onConfirm).toHaveBeenCalledTimes(1);
            expect(onConfirm).toHaveBeenCalledWith({ targetName: 'Alric', damageType: 'Fire' });
        });

        it('does not call onConfirm when target is not selected', () => {
            const onConfirm = vi.fn();
            render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);
            fireEvent.click(screen.getByText('Fire'));
            fireEvent.click(screen.getByText('Cast Resistance'));
            expect(onConfirm).not.toHaveBeenCalled();
        });

        it('does not call onConfirm when damage type is not selected', () => {
            const onConfirm = vi.fn();
            render(<TargetWithTypePopup {...makeProps({ onConfirm })} />);
            fireEvent.click(screen.getByText('Alric'));
            fireEvent.click(screen.getByText('Cast Resistance'));
            expect(onConfirm).not.toHaveBeenCalled();
        });
    });

    // ── Skip/cancel behavior ──

    describe('skip', () => {
        it('calls onSkip when Cancel button is clicked', () => {
            const onSkip = vi.fn();
            render(<TargetWithTypePopup {...makeProps({ onSkip })} />);
            fireEvent.click(screen.getByText('Cancel'));
            expect(onSkip).toHaveBeenCalledTimes(1);
        });

        it('calls onSkip when overlay is clicked', () => {
            const onSkip = vi.fn();
            render(<TargetWithTypePopup {...makeProps({ onSkip })} />);
            const overlay = document.querySelector('.popup-overlay');
            fireEvent.click(overlay);
            expect(onSkip).toHaveBeenCalledTimes(1);
        });

        it('does not call onSkip when modal content is clicked', () => {
            const onSkip = vi.fn();
            render(<TargetWithTypePopup {...makeProps({ onSkip })} />);
            const modal = document.querySelector('.popup-modal');
            fireEvent.click(modal);
            expect(onSkip).not.toHaveBeenCalled();
        });

        it('calls onSkip when Escape key is pressed', () => {
            const onSkip = vi.fn();
            render(<TargetWithTypePopup {...makeProps({ onSkip })} />);
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onSkip).toHaveBeenCalledTimes(1);
        });

        it('does not call onSkip for other keys', () => {
            const onSkip = vi.fn();
            render(<TargetWithTypePopup {...makeProps({ onSkip })} />);
            fireEvent.keyDown(document, { key: 'Enter' });
            expect(onSkip).not.toHaveBeenCalled();
        });

        it('does not call onSkip when modal inner content is clicked', () => {
            const onSkip = vi.fn();
            render(<TargetWithTypePopup {...makeProps({ onSkip })} />);
            const inner = document.querySelector('.metamagic-popup-inner');
            fireEvent.click(inner);
            expect(onSkip).not.toHaveBeenCalled();
        });

        it('calls onSkip without calling onConfirm when skipped after selections', () => {
            const onConfirm = vi.fn();
            const onSkip = vi.fn();
            render(<TargetWithTypePopup {...makeProps({ onConfirm, onSkip })} />);

            fireEvent.click(screen.getByText('Alric'));
            fireEvent.click(screen.getByText('Fire'));
            fireEvent.click(screen.getByText('Cancel'));

            expect(onSkip).toHaveBeenCalledTimes(1);
            expect(onConfirm).not.toHaveBeenCalled();
        });
    });

    // ── Keyboard listener cleanup ──

    describe('keyboard listener cleanup', () => {
        it('removes keydown listener on unmount', () => {
            const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
            const { unmount } = render(<TargetWithTypePopup {...makeProps()} />);
            unmount();
            expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        });
    });

    // ── Edge cases ──

    describe('edge cases', () => {
        it('renders with empty creature targets list', () => {
            render(<TargetWithTypePopup {...makeProps({ creatureTargets: [] })} />);
            expect(screen.getByText('Target:')).toBeInTheDocument();
            expect(screen.queryByText('Alric')).not.toBeInTheDocument();
        });

        it('renders with empty damage types list', () => {
            render(<TargetWithTypePopup {...makeProps({ damageTypes: [] })} />);
            expect(screen.getByText('Damage Type:')).toBeInTheDocument();
        });

    });
});
