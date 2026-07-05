// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AttackRiderManeuverPrompt from './AttackRiderManeuverPrompt.jsx';

const baseManeuvers = [
    { name: 'Disarming Attack', damageBonus: true, saveType: 'STR', effect: 'disarm' },
    { name: 'Distracting Strike', damageBonus: true, saveType: null, effect: 'distracting_strike_advantage' },
    { name: 'Goading Attack', damageBonus: true, saveType: 'WIS', effect: 'goad', conditionInflicted: 'goaded' },
    { name: 'Trip Attack', damageBonus: true, saveType: 'STR', effect: 'prone' },
];

const baseAttack = {
    name: 'Longsword',
    weaponType: 'melee',
};

const basePopupHtml = {
    hit: true,
    isCrit: false,
    targetName: 'Orc',
};

function makeProps(overrides = {}) {
    return {
        maneuvers: baseManeuvers,
        attack: baseAttack,
        popupHtml: basePopupHtml,
        onUse: vi.fn(),
        onSkip: vi.fn(),
        ...overrides,
    };
}

function renderPrompt(overrides = {}) {
    return render(<AttackRiderManeuverPrompt {...makeProps(overrides)} />);
}

// ── Initial rendering ──

describe('AttackRiderManeuverPrompt - initial rendering', () => {
    it('renders the overlay, modal, header, and instruction text', () => {
        renderPrompt();
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        expect(screen.getByText(/Battle Master — Attack Rider Maneuver/)).toBeInTheDocument();
        expect(screen.getByText(/Choose an attack rider maneuver to use on this hit/)).toBeInTheDocument();
    });

    it('renders all maneuvers with their descriptors', () => {
        renderPrompt();
        expect(screen.getByText('Disarming Attack')).toBeInTheDocument();
        expect(screen.getByText('Distracting Strike')).toBeInTheDocument();
        expect(screen.getByText('Goading Attack')).toBeInTheDocument();
        expect(screen.getByText('Trip Attack')).toBeInTheDocument();
        // saveType descriptors appear next to maneuver names
        const disarmLabel = screen.getByText('Disarming Attack').closest('label');
        expect(disarmLabel.textContent).toContain('STR save');
        const goadLabel = screen.getByText('Goading Attack').closest('label');
        expect(goadLabel.textContent).toContain('WIS save');
        const distractLabel = screen.getByText('Distracting Strike').closest('label');
        expect(distractLabel.textContent).not.toContain('save');
    });

    it('has Use Maneuver button disabled and Skip button present when no selection', () => {
        renderPrompt();
        expect(screen.getByRole('button', { name: /Use Maneuver/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Skip/ })).toBeInTheDocument();
    });
});

// ── Selection behavior ──

describe('AttackRiderManeuverPrompt - selection behavior', () => {
    it('selects a maneuver and enables the Use Maneuver button', () => {
        renderPrompt();
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        expect(radios[0].checked).toBe(true);
        expect(screen.getByRole('button', { name: /Use Maneuver/ })).not.toBeDisabled();
    });

    it('deselects previous radio when different one is selected', () => {
        renderPrompt();
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(radios[2]);
        expect(radios[0].checked).toBe(false);
        expect(radios[2].checked).toBe(true);
    });
});

// ── Use maneuver flow ──

describe('AttackRiderManeuverPrompt - use maneuver', () => {
    it('calls onUse with selected maneuver, attack, and popupHtml when Use Maneuver is clicked', async () => {
        const onUse = vi.fn().mockResolvedValue(null);
        renderPrompt({ onUse });
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        await waitFor(() => {
            expect(onUse).toHaveBeenCalledWith(baseManeuvers[0], baseAttack, basePopupHtml);
        });
    });

    it('does not call onUse when Use Maneuver is clicked with no selection', async () => {
        const onUse = vi.fn();
        renderPrompt({ onUse });
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        expect(onUse).not.toHaveBeenCalled();
    });

    it('renders result state after onUse resolves with payload', async () => {
        const onUse = vi.fn().mockResolvedValue({
            payload: { name: 'Disarming Attack', description: 'Weapon dropped!' },
        });
        renderPrompt({ onUse });
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        await waitFor(() => {
            expect(screen.getByText('Disarming Attack')).toBeInTheDocument();
            expect(screen.getByText('Done')).toBeInTheDocument();
        });
    });

    it('renders result description via dangerouslySetInnerHTML', async () => {
        const onUse = vi.fn().mockResolvedValue({
            payload: { name: 'Disarming Attack', description: '<strong>Dropped!</strong>' },
        });
        renderPrompt({ onUse });
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        await waitFor(() => {
            const bodyDiv = document.querySelector('.sp-body');
            expect(bodyDiv.innerHTML).toContain('<strong>Dropped!</strong>');
        });
    });

    it('renders result with fallback name when payload.name is missing', async () => {
        const onUse = vi.fn().mockResolvedValue({
            payload: { description: 'No name description.' },
        });
        renderPrompt({ onUse });
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        await waitFor(() => {
            expect(screen.getByText('Maneuver')).toBeInTheDocument();
        });
    });

    it('calls onSkip when Done button is clicked in result state', async () => {
        const onSkip = vi.fn();
        const onUse = vi.fn().mockResolvedValue({
            payload: { name: 'Disarming Attack', description: 'Desc.' },
        });
        renderPrompt({ onSkip, onUse });
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        await waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Done'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });
});

// ── Skip / cancel flow ──

describe('AttackRiderManeuverPrompt - skip and cancel', () => {
    it('calls onSkip when Skip button is clicked', () => {
        const onSkip = vi.fn();
        renderPrompt({ onSkip });
        fireEvent.click(screen.getByRole('button', { name: /Skip/ }));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when overlay is clicked', () => {
        const onSkip = vi.fn();
        renderPrompt({ onSkip });
        const overlay = document.querySelector('.sp-overlay');
        fireEvent.click(overlay);
        expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside modal', () => {
        const onSkip = vi.fn();
        renderPrompt({ onSkip });
        const modal = document.querySelector('.sp-modal');
        fireEvent.click(modal);
        expect(onSkip).not.toHaveBeenCalled();
    });
});

// ── isMiss path ──

describe('AttackRiderManeuverPrompt - isMiss path', () => {
    it('renders Precision Attack header and instruction text when isMiss is true', () => {
        renderPrompt({ isMiss: true });
        expect(screen.getByText('Battle Master — Precision Attack')).toBeInTheDocument();
        expect(screen.getByText(/The attack missed/)).toBeInTheDocument();
    });

    it('renders isMissResult state with Precision Attack header', async () => {
        const onUse = vi.fn().mockResolvedValue({
            isMissResult: true,
            description: '<strong>Turned miss into hit!</strong>',
        });
        renderPrompt({ isMiss: true, onUse });
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        await waitFor(() => {
            expect(screen.getByText('Precision Attack')).toBeInTheDocument();
            expect(screen.getByText('Done')).toBeInTheDocument();
        });
    });

    it('renders isMissResult description via dangerouslySetInnerHTML', async () => {
        const onUse = vi.fn().mockResolvedValue({
            isMissResult: true,
            description: '<em>Success!</em>',
        });
        renderPrompt({ isMiss: true, onUse });
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        await waitFor(() => {
            const bodyDiv = document.querySelector('.sp-body');
            expect(bodyDiv.innerHTML).toContain('<em>Success!</em>');
        });
    });

    it('calls onSkip when Done button clicked in isMissResult state', async () => {
        const onSkip = vi.fn();
        const onUse = vi.fn().mockResolvedValue({
            isMissResult: true,
            description: 'Miss turned into hit.',
        });
        renderPrompt({ isMiss: true, onSkip, onUse });
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        await waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Done'));
        expect(onSkip).toHaveBeenCalledTimes(1);
    });
});

// ── Edge cases ──

describe('AttackRiderManeuverPrompt - edge cases', () => {
    it('renders empty maneuver list without crash', () => {
        renderPrompt({ maneuvers: [] });
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        expect(screen.getByText(/Choose an attack rider maneuver/)).toBeInTheDocument();
    });
});
