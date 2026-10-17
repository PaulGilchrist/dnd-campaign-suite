// @maintained-by-ai
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RecklessAttackModal from './RecklessAttackModal.jsx';

const defaultAttack = { name: 'Melee Attack', type: 'weapon' };

const brutalStrikeOptions = [
    { name: 'Forceful Blow' },
    { name: 'Hamstring Blow' },
    { name: 'Staggering Blow' },
    { name: 'Sundering Blow' },
];

function makeProps(overrides = {}) {
    return {
        playerStats: { name: 'TestBarbarian', level: 5 },
        campaignName: 'test-campaign',
        attack: { ...defaultAttack },
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
        mode: 'full',
        hasBrutalStrike: false,
        brutalStrikeOptions: [],
        maxEffects: 1,
        ...overrides,
    };
}

function brutalStrikeToggle() {
    return screen.getByRole('checkbox', { name: /Use Brutal Strike/i });
}

function optionInputs() {
    // Option inputs are every input except the "Use Brutal Strike" toggle.
    const toggle = document.querySelector('input[type="checkbox"]');
    return Array.from(document.querySelectorAll('input')).filter(i => i !== toggle);
}

function selectedCountText() {
    const el = screen.queryByText(/\d+\/\d+ selected/);
    const match = el ? el.textContent.match(/(\d+\/\d+)/) : null;
    return match ? match[1] : null;
}

describe('full mode', () => {
    it('renders the Reckless Attack prompt, hides Brutal Strike when the character lacks it', () => {
        render(<RecklessAttackModal {...makeProps()} />);
        const header = document.querySelector('.sp-header');
        expect(header.textContent).toContain('Reckless Attack');
        expect(header.querySelector('.fa-solid.fa-shield-halved')).toBeInTheDocument();
        const body = document.querySelector('.sp-body');
        expect(body.textContent).toContain('Advantage on Strength attack rolls');
        expect(body.textContent).toContain('attack rolls against you also have Advantage');
        expect(screen.getByRole('button', { name: /Attack Recklessly/ })).not.toBeDisabled();
        expect(screen.getByRole('button', { name: 'Normal Attack' })).toBeInTheDocument();
        expect(screen.queryByText(/Use Brutal Strike/)).not.toBeInTheDocument();
    });

    it('reveals effect options when Brutal Strike is toggled on and hides them when toggled off', () => {
        render(<RecklessAttackModal {...makeProps({ hasBrutalStrike: true, brutalStrikeOptions })} />);
        expect(optionInputs()).toHaveLength(0);
        fireEvent.click(brutalStrikeToggle());
        expect(screen.getAllByRole('radio')).toHaveLength(brutalStrikeOptions.length);
        fireEvent.click(brutalStrikeToggle());
        expect(screen.queryAllByRole('radio')).toHaveLength(0);
    });

    it('lists known effects with their rules descriptions and unknown effects name-only', () => {
        render(<RecklessAttackModal {...makeProps({
            hasBrutalStrike: true,
            brutalStrikeOptions: [...brutalStrikeOptions, { name: 'Custom Effect' }],
        })} />);
        fireEvent.click(brutalStrikeToggle());
        expect(screen.getByText(/— Push target 15 ft/)).toBeInTheDocument();
        expect(screen.getByText(/— Reduce target Speed by 15 ft/)).toBeInTheDocument();
        expect(screen.getByText(/— Disadvantage on next save, no Opportunity Attacks/)).toBeInTheDocument();
        expect(screen.getByText(/— \+5 to next attack against target/)).toBeInTheDocument();
        const customLabel = screen.getByText('Custom Effect').closest('label');
        expect(customLabel).not.toHaveTextContent('—');
    });

    it('single select: choose-one prompt with 1d10, radios move selection, confirm gated on selection', () => {
        render(<RecklessAttackModal {...makeProps({ hasBrutalStrike: true, brutalStrikeOptions, maxEffects: 1 })} />);
        fireEvent.click(brutalStrikeToggle());
        expect(screen.getByText(/Choose one effect:/)).toBeInTheDocument();
        expect(document.querySelector('.sp-body').textContent).toContain('1d10');
        const confirm = screen.getByRole('button', { name: /Attack Recklessly/ });
        expect(confirm).toBeDisabled();
        const radios = screen.getAllByRole('radio');
        expect(screen.queryAllByRole('checkbox')).toHaveLength(1); // toggle only
        fireEvent.click(radios[0]);
        expect(radios[0].checked).toBe(true);
        expect(confirm).not.toBeDisabled();
        fireEvent.click(radios[1]);
        expect(radios[0].checked).toBe(false);
        expect(radios[1].checked).toBe(true);
    });

    it('multi select: choose-up-to prompt with 2d10, live count capped at maxEffects, deselect drops count', () => {
        render(<RecklessAttackModal {...makeProps({ hasBrutalStrike: true, brutalStrikeOptions, maxEffects: 2 })} />);
        fireEvent.click(brutalStrikeToggle());
        expect(screen.getByText(/Choose up to 2 effects/)).toBeInTheDocument();
        expect(document.querySelector('.sp-body').textContent).toContain('2d10');
        expect(screen.queryAllByRole('radio')).toHaveLength(0);
        const options = optionInputs();
        expect(options).toHaveLength(brutalStrikeOptions.length);
        fireEvent.click(options[0]);
        expect(selectedCountText()).toBe('1/2');
        fireEvent.click(options[1]);
        expect(selectedCountText()).toBe('2/2');
        fireEvent.click(options[2]);
        expect(selectedCountText()).toBe('2/2');
        expect(options[2].checked).toBe(false);
        fireEvent.click(options[0]);
        expect(selectedCountText()).toBe('1/2');
    });

    it('clears effect selection when Brutal Strike is toggled off and back on', () => {
        render(<RecklessAttackModal {...makeProps({ hasBrutalStrike: true, brutalStrikeOptions, maxEffects: 2 })} />);
        fireEvent.click(brutalStrikeToggle());
        const options = optionInputs();
        fireEvent.click(options[0]);
        fireEvent.click(options[1]);
        expect(selectedCountText()).toBe('2/2');
        fireEvent.click(brutalStrikeToggle());
        fireEvent.click(brutalStrikeToggle());
        expect(selectedCountText()).toBe('0/2');
        expect(optionInputs().every(i => !i.checked)).toBe(true);
    });

    it('confirms with the attack and the current brutal strike choices', () => {
        const onConfirm = vi.fn();
        render(<RecklessAttackModal {...makeProps({ onConfirm })} />);
        fireEvent.click(screen.getByRole('button', { name: /Attack Recklessly/ }));
        expect(onConfirm).toHaveBeenCalledWith(defaultAttack, { useBrutalStrike: false, effectChoices: [] });

        cleanup();
        const onConfirmBS = vi.fn();
        render(<RecklessAttackModal {...makeProps({ onConfirm: onConfirmBS, hasBrutalStrike: true, brutalStrikeOptions, maxEffects: 1 })} />);
        fireEvent.click(brutalStrikeToggle());
        fireEvent.click(screen.getAllByRole('radio')[0]);
        fireEvent.click(screen.getByRole('button', { name: /Attack Recklessly/ }));
        expect(onConfirmBS).toHaveBeenCalledWith(defaultAttack, { useBrutalStrike: true, effectChoices: ['Forceful Blow'] });
    });

    it('cancels with the attack when Normal Attack is clicked', () => {
        const onCancel = vi.fn();
        render(<RecklessAttackModal {...makeProps({ onCancel })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Normal Attack' }));
        expect(onCancel).toHaveBeenCalledWith(defaultAttack);
    });

    it('shows the toggle but no effect picker when brutalStrikeOptions is empty', () => {
        render(<RecklessAttackModal {...makeProps({ hasBrutalStrike: true, brutalStrikeOptions: [] })} />);
        fireEvent.click(brutalStrikeToggle());
        expect(optionInputs()).toHaveLength(0);
    });
});

describe('brutalOnly mode', () => {
    it('renders the Brutal Strike prompt with an enabled Apply button and Skip', () => {
        render(<RecklessAttackModal {...makeProps({ mode: 'brutalOnly' })} />);
        const header = document.querySelector('.sp-header');
        expect(header.textContent).toContain('Brutal Strike');
        expect(header.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument();
        const body = document.querySelector('.sp-body');
        expect(body.textContent).toContain('Reckless Attack is already active');
        expect(body.textContent).toContain('Forgo Advantage');
        expect(screen.getByRole('button', { name: /Apply Brutal Strike/ })).not.toBeDisabled();
        expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });

    it('confirms a payload without the attack, gated on selection when toggled', () => {
        const onConfirm = vi.fn();
        render(<RecklessAttackModal {...makeProps({ mode: 'brutalOnly', onConfirm, hasBrutalStrike: true, brutalStrikeOptions, maxEffects: 1 })} />);
        const apply = screen.getByRole('button', { name: /Apply Brutal Strike/ });
        // Untoggled: forgo brutal strike.
        fireEvent.click(apply);
        expect(onConfirm).toHaveBeenLastCalledWith({ useBrutalStrike: false, effectChoices: [] });
        // Toggled with nothing chosen: confirm is disabled, clicking does nothing.
        fireEvent.click(brutalStrikeToggle());
        expect(apply).toBeDisabled();
        // Toggled with a choice: payload carries the effect.
        fireEvent.click(screen.getAllByRole('radio')[0]);
        expect(apply).not.toBeDisabled();
        fireEvent.click(apply);
        expect(onConfirm).toHaveBeenLastCalledWith({ useBrutalStrike: true, effectChoices: ['Forceful Blow'] });
    });

    it('cancels with an empty brutal strike payload when Skip is clicked', () => {
        const onCancel = vi.fn();
        render(<RecklessAttackModal {...makeProps({ mode: 'brutalOnly', onCancel })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(onCancel).toHaveBeenCalledWith({ useBrutalStrike: false, effectChoices: [] });
    });
});
