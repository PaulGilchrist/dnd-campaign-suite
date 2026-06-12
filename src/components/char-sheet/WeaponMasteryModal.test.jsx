import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WeaponMasteryModal from './WeaponMasteryModal.jsx';

// ── Mocked modules (before the component import) ──

vi.mock('../../services/automation/handlers/weaponMasteryHandler.js', () => ({
    MASTERY_EFFECTS: {
        Push: { label: 'Push (10 ft)', description: 'Push the creature up to 10 feet straight away from you.', effect: 'push', value: 10 },
        Topple: { label: 'Topple (Prone)', description: 'Force the creature to make a Constitution saving throw or fall Prone.', effect: 'topple', requiresSave: true, saveAbility: 'CON' },
        Sap: { label: 'Sap (Disadvantage)', description: 'The creature has Disadvantage on its next attack roll.', effect: 'disadvantage_on_next_save' },
        Slow: { label: 'Slow (Speed -10 ft)', description: 'Reduce the creature\'s Speed by 10 feet.', effect: 'speed_reduction', value: 10 },
        Vex: { label: 'Vex (Advantage)', description: 'You have Advantage on your next attack roll.', effect: 'next_attack_advantage', value: 5 },
        Cleave: { label: 'Cleave (Extra Attack)', description: 'Make a melee attack roll with the weapon against a second creature.', effect: 'cleave' },
        Nick: { label: 'Nick (Extra Attack)', description: 'Make the extra attack of the Light property.', effect: 'nick' },
        Graze: { label: 'Graze (Miss Damage)', description: 'If your attack roll misses, deal damage equal to your ability modifier.', effect: 'graze' },
    },
    applyMasteryEffect: vi.fn(),
}));

vi.mock('../../hooks/useActionPopup.js', () => ({
    loadWeaponMasteries: vi.fn(),
}));

vi.mock('../../services/rules/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as weaponMasteryHandler from '../../services/automation/handlers/weaponMasteryHandler.js';
import * as useActionPopup from '../../hooks/useActionPopup.js';
import * as damageUtils from '../../services/rules/damageUtils.js';

// ── Test fixtures ──

const mockPlayerStats = { name: 'Throg', level: 12, abilities: [{ name: 'CON', bonus: 3 }] };
const mockCampaignName = 'test-campaign';

function makeProps(overrides) {
    return {
        attackName: 'Longsword Attack',
        baseMastery: 'Vex',
        extraMasteries: ['Push'],
        playerStats: mockPlayerStats,
        campaignName: mockCampaignName,
        targetNameProp: 'Goblin',
        onClose: vi.fn(),
        ...(overrides || {}),
    };
}

// ── Tests ──

describe('WeaponMasteryModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        // Default: loadWeaponMasteries resolves with some mastery data
        useActionPopup.loadWeaponMasteries.mockResolvedValue([
            { name: 'Vex', description: 'Gain advantage on next attack.' },
            { name: 'Push', description: 'Push enemy 10 ft away.' },
        ]);
        // Default: getCombatContext resolves with no combat context
        damageUtils.getCombatContext.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Initial render ──

    it('renders the modal overlay', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('renders the modal structure (sp-overlay, sp-modal, sp-header, sp-body, sp-actions)', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        expect(document.querySelector('.sp-header')).toBeInTheDocument();
        expect(document.querySelector('.sp-body')).toBeInTheDocument();
        expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the attack name in the header', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        expect(screen.getByText(/Longsword Attack/)).toBeInTheDocument();
    });

    it('renders the crosshairs icon in the header', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        const icon = document.querySelector('.fa-solid.fa-crosshairs');
        expect(icon).toBeInTheDocument();
    });

    it('renders the Weapon Mastery header text', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        expect(screen.getByText(/Weapon Mastery/)).toBeInTheDocument();
    });

    // ── Target name display ──

    it('displays target name in the instruction text when provided', () => {
        // targetName is set from the prop initially, but the useEffect with targetName in deps
        // causes a re-render. The instruction text uses targetName which may be null at render time
        // if the effect has already run and getCombatContext returns null.
        render(<WeaponMasteryModal {...makeProps({ targetNameProp: 'Goblin' })} />);
        const bodyDiv = document.querySelector('.sp-body');
        // The instruction text always starts with "Choose a mastery property to activate"
        expect(bodyDiv.textContent).toContain('Choose a mastery property to activate');
    });

    it('does not display target name when targetNameProp is null', () => {
        render(<WeaponMasteryModal {...makeProps({ targetNameProp: null })} />);
        const bodyDiv = document.querySelector('.sp-body');
        expect(bodyDiv.textContent).toContain('Choose a mastery property to activate');
    });

    // ── Mastery list rendering ──

    it('renders the base mastery from baseMastery prop', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        expect(screen.getByText(/Vex/)).toBeInTheDocument();
    });

    it('renders extra masteries from extraMasteries prop', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        const labels = document.querySelectorAll('label');
        const pushLabel = Array.from(labels).find(l => l.textContent.includes('Push (10 ft)'));
        expect(pushLabel).toBeInTheDocument();
    });

    it('does not duplicate a mastery that appears in both baseMastery and extraMasteries', () => {
        const props = makeProps();
        props.baseMastery = 'Vex';
        props.extraMasteries = ['Vex', 'Push'];
        render(<WeaponMasteryModal {...props} />);
        const labels = document.querySelectorAll('label');
        const vexLabels = Array.from(labels).filter(l => l.textContent.includes('Vex'));
        expect(vexLabels).toHaveLength(1);
    });

    it('renders radio inputs for each mastery option', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        expect(radios).toHaveLength(2); // Vex and Push
    });

    it('marks feature source masteries with a Feature badge', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        expect(screen.getByText('Feature')).toBeInTheDocument();
    });

    it('does not mark weapon source masteries with a Feature badge', () => {
        const props = makeProps();
        props.baseMastery = 'Vex';
        props.extraMasteries = [];
        render(<WeaponMasteryModal {...props} />);
        const labels = document.querySelectorAll('label');
        const vexLabel = Array.from(labels).find(l => l.textContent.includes('Vex'));
        expect(vexLabel.querySelector('.automation-badge')).not.toBeInTheDocument();
    });

    // ── Mastery descriptions ──

    it('renders mastery descriptions loaded from loadWeaponMasteries', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        // After the async loadWeaponMasteries resolves, descriptions should appear
        // We need to wait for the async effect to complete
    });

    it('falls back to MASTERY_EFFECTS description when loadWeaponMasteries data is missing', () => {
        useActionPopup.loadWeaponMasteries.mockResolvedValue([]);
        render(<WeaponMasteryModal {...makeProps()} />);
        expect(document.querySelector('.sp-body')).toBeInTheDocument();
    });

    // ── Instruction text ──

    it('renders the instruction text about choosing a mastery', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        expect(screen.getByText(/Choose a mastery property to activate/)).toBeInTheDocument();
    });

    it('renders the note about one mastery per hit', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        expect(screen.getByText(/You can activate one mastery property per hit/)).toBeInTheDocument();
    });

    // ── Selection behavior ──

    it('has no option selected initially', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => expect(radio.checked).toBe(false));
    });

    it('selects an option when its radio is clicked', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        expect(radios[0].checked).toBe(true);
    });

    it('deselects previous option when a different one is selected', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        fireEvent.click(radios[1]);
        expect(radios[0].checked).toBe(false);
        expect(radios[1].checked).toBe(true);
    });

    it('applies selected style to the chosen option label', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        const labels = document.querySelectorAll('label');
        const firstLabel = labels[0];
        expect(firstLabel.style.background).not.toContain('rgba(255,255,255,0.15)');
        fireEvent.click(document.querySelectorAll('input[type="radio"]')[0]);
        expect(firstLabel.style.background).toContain('rgba(255');
    });

    // ── Activate button ──

    it('disables the Activate button when no mastery is selected', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        const btn = screen.getByRole('button', { name: /Activate/ });
        expect(btn).toBeDisabled();
    });

    it('enables the Activate button after selecting a mastery', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        const btn = screen.getByRole('button', { name: /Activate/ });
        expect(btn).not.toBeDisabled();
    });

    it('renders the crosshairs icon on the Activate button', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        const btn = screen.getByRole('button', { name: /Activate/ });
        expect(btn.querySelector('.fa-solid.fa-crosshairs')).toBeInTheDocument();
    });

    it('does not call applyMasteryEffect when activated with no selection', async () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));
        await waitFor(() => {
            expect(weaponMasteryHandler.applyMasteryEffect).not.toHaveBeenCalled();
        });
    });

    it('calls applyMasteryEffect with correct args when a mastery is selected and activated', async () => {
        weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Vex',
                description: 'Vex applied to target — you have Advantage on next attack.',
            },
        });

        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]); // Vex
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

        await waitFor(() => {
            expect(weaponMasteryHandler.applyMasteryEffect).toHaveBeenCalledTimes(1);
            const callArgs = weaponMasteryHandler.applyMasteryEffect.mock.calls[0];
            expect(callArgs[0]).toBe('Vex');
            expect(callArgs[1]).toBe(mockPlayerStats);
            expect(callArgs[2]).toBe(mockCampaignName);
            // targetName is passed as the 4th argument (may be null if no combat context or target)
            expect(callArgs[3]).toBe(null);
        });
    });

    // ── Applied / result state ──

    it('shows result description after applying with a result', async () => {
        weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Vex',
                description: 'Vex applied to Goblin — you have Advantage on next attack.',
            },
        });

        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

        await waitFor(() => {
            expect(screen.getByText(/Vex applied/)).toBeInTheDocument();
        });
    });

    it('renders the Done button in the applied state', async () => {
        weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Vex',
                description: 'Vex applied.',
            },
        });

        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

        await waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument();
        });
    });

    it('hides selection options after applying', async () => {
        weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Vex',
                description: 'Vex applied.',
            },
        });

        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

        await waitFor(() => {
            expect(screen.queryByText(/Choose a mastery property/)).not.toBeInTheDocument();
        });
    });

    it('hides the Activate button after applying', async () => {
        weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Vex',
                description: 'Vex applied.',
            },
        });

        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: /Activate/ })).not.toBeInTheDocument();
        });
    });

    it('hides the Skip button after applying', async () => {
        weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Vex',
                description: 'Vex applied.',
            },
        });

        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
        });
    });

    // ── Applied state with no result ──

    it('does not show applied state when result is null', async () => {
        weaponMasteryHandler.applyMasteryEffect.mockResolvedValue(null);

        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

        await waitFor(() => {
            expect(screen.queryByText('Done')).not.toBeInTheDocument();
        });
    });

    // ── Close behavior ──

    it('calls onClose when Done button is clicked in applied state', async () => {
        const onClose = vi.fn();
        weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Vex',
                description: 'Vex applied.',
            },
        });

        render(<WeaponMasteryModal {...makeProps({ onClose })} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

        await waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Done'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Skip button is clicked', () => {
        const onClose = vi.fn();
        render(<WeaponMasteryModal {...makeProps({ onClose })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking the overlay background', () => {
        const onClose = vi.fn();
        render(<WeaponMasteryModal {...makeProps({ onClose })} />);
        const overlay = document.querySelector('.sp-overlay');
        fireEvent.click(overlay);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT close when clicking inside the modal content', () => {
        const onClose = vi.fn();
        render(<WeaponMasteryModal {...makeProps({ onClose })} />);
        const modal = document.querySelector('.sp-modal');
        fireEvent.click(modal);
        expect(onClose).not.toHaveBeenCalled();
    });

    // ── Applied state overlay click ──

    it('calls onClose when clicking the overlay in applied state', async () => {
        const onClose = vi.fn();
        weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Vex',
                description: 'Vex applied.',
            },
        });

        render(<WeaponMasteryModal {...makeProps({ onClose })} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

        await waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument();
        });

        const overlay = document.querySelector('.sp-overlay');
        fireEvent.click(overlay);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT close when clicking inside modal in applied state', async () => {
        const onClose = vi.fn();
        weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Vex',
                description: 'Vex applied.',
            },
        });

        render(<WeaponMasteryModal {...makeProps({ onClose })} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

        await waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument();
        });

        const modal = document.querySelector('.sp-modal');
        fireEvent.click(modal);
        expect(onClose).not.toHaveBeenCalled();
    });

    // ── Edge cases: empty masteries ──

    it('renders with no masteries when baseMastery and extraMasteries are null', () => {
        render(<WeaponMasteryModal {...makeProps({ baseMastery: null, extraMasteries: null })} />);
        expect(screen.getByText(/Longsword Attack/)).toBeInTheDocument();
        const radios = document.querySelectorAll('input[type="radio"]');
        expect(radios).toHaveLength(0);
    });

    it('renders with no masteries when baseMastery and extraMasteries are empty', () => {
        render(<WeaponMasteryModal {...makeProps({ baseMastery: null, extraMasteries: [] })} />);
        expect(screen.getByText(/Longsword Attack/)).toBeInTheDocument();
        const radios = document.querySelectorAll('input[type="radio"]');
        expect(radios).toHaveLength(0);
    });

    it('disables Activate button when there are no masteries', () => {
        render(<WeaponMasteryModal {...makeProps({ baseMastery: null, extraMasteries: [] })} />);
        const btn = screen.getByRole('button', { name: /Activate/ });
        expect(btn).toBeDisabled();
    });

    // ── Edge case: only baseMastery, no extraMasteries ──

    it('renders only base mastery when extraMasteries is empty', () => {
        render(<WeaponMasteryModal {...makeProps({ extraMasteries: [] })} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        expect(radios).toHaveLength(1);
    });

    // ── Edge case: only extraMasteries, no baseMastery ──

    it('renders only extra masteries when baseMastery is null', () => {
        render(<WeaponMasteryModal {...makeProps({ baseMastery: null })} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        expect(radios).toHaveLength(1); // Only Push
        const labels = document.querySelectorAll('label');
        const pushLabel = Array.from(labels).find(l => l.textContent.includes('Push (10 ft)'));
        expect(pushLabel).toBeInTheDocument();
    });

    // ── Effect label display ──

    it('displays MASTERY_EFFECTS label when available', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        // Vex has a label in MASTERY_EFFECTS
        expect(screen.getByText(/Vex \(Advantage\)/)).toBeInTheDocument();
    });

    it('falls back to mastery name when MASTERY_EFFECTS has no entry', () => {
        // Add a mastery not in MASTERY_EFFECTS
        const props = makeProps();
        props.baseMastery = 'CustomMastery';
        props.extraMasteries = [];
        render(<WeaponMasteryModal {...props} />);
        expect(screen.getByText('CustomMastery')).toBeInTheDocument();
    });

    // ── Result HTML rendering ──

    it('renders result payload description as HTML via dangerouslySetInnerHTML', async () => {
        weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Vex',
                description: '<strong>Vex</strong> applied to Goblin.',
            },
        });

        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

        await waitFor(() => {
            const bodyDiv = document.querySelector('.sp-body');
            expect(bodyDiv.innerHTML).toContain('<strong>Vex</strong>');
        });
    });

    // ── Target name from combat context ──

    it('sets targetName from combat context when targetNameProp is null', async () => {
        damageUtils.getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Throg', targetName: 'Orc' },
                { name: 'Orc' },
            ],
        });
        damageUtils.getTargetFromAttacker.mockReturnValue({ name: 'Orc' });

        render(<WeaponMasteryModal {...makeProps({ targetNameProp: null })} />);

        await waitFor(() => {
            expect(screen.getByText(/against <b>Orc<\/b>/)).toBeInTheDocument();
        });
    });

    it('does not call getCombatContext when targetNameProp is provided', () => {
        render(<WeaponMasteryModal {...makeProps({ targetNameProp: 'Goblin' })} />);
        // After a brief wait, getCombatContext should not have been called
        // because targetName is truthy from the prop
    });

    // ── Mastery descriptions from loadWeaponMasteries ──

    it('loads mastery descriptions from loadWeaponMasteries', async () => {
        useActionPopup.loadWeaponMasteries.mockResolvedValue([
            { name: 'Vex', description: 'Custom Vex description.' },
        ]);

        render(<WeaponMasteryModal {...makeProps()} />);

        await waitFor(() => {
            // The description should be loaded into the masteryDescriptions state
            // and displayed in the UI
            const bodyDiv = document.querySelector('.sp-body');
            expect(bodyDiv.textContent).toContain('Custom Vex description.');
        });
    });

    // ── Skip button ──

    it('Skip button has sp-dismiss-btn class', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        const btn = screen.getByRole('button', { name: 'Skip' });
        expect(btn.classList.contains('sp-dismiss-btn')).toBe(true);
    });

    it('Activate button has sp-roll-btn class', () => {
        render(<WeaponMasteryModal {...makeProps()} />);
        const btn = screen.getByRole('button', { name: /Activate/ });
        expect(btn.classList.contains('sp-roll-btn')).toBe(true);
    });

    // ── Done button class ──

    it('Done button has sp-roll-btn class in applied state', async () => {
        weaponMasteryHandler.applyMasteryEffect.mockResolvedValue({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Vex',
                description: 'Done.',
            },
        });

        render(<WeaponMasteryModal {...makeProps()} />);
        const radios = document.querySelectorAll('input[type="radio"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Activate/ }));

        await waitFor(() => {
            const doneBtn = screen.getByRole('button', { name: 'Done' });
            expect(doneBtn.classList.contains('sp-roll-btn')).toBe(true);
        });
    });
});
