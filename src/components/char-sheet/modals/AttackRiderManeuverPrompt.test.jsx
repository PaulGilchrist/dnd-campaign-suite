// @improved-by-ai
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
    it('renders the overlay and modal', () => {
        renderPrompt();
        expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('renders the header with bolt icon', () => {
        renderPrompt();
        expect(document.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument();
        expect(screen.getByText(/Battle Master — Attack Rider Maneuver/)).toBeInTheDocument();
    });

    it('shows instruction text', () => {
        renderPrompt();
        expect(screen.getByText(/Choose an attack rider maneuver to use on this hit/)).toBeInTheDocument();
    });

    it('renders all maneuvers as selectable options', () => {
        renderPrompt();
        expect(screen.getByText('Disarming Attack')).toBeInTheDocument();
        expect(screen.getByText('Distracting Strike')).toBeInTheDocument();
        expect(screen.getByText('Goading Attack')).toBeInTheDocument();
        expect(screen.getByText('Trip Attack')).toBeInTheDocument();
    });

    it('renders radio inputs for each maneuver', () => {
        renderPrompt();
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        expect(radios.length).toBe(4);
    });

    it('shows damageBonus indicator on maneuvers with damage bonus', () => {
        renderPrompt();
        const labels = document.querySelectorAll('label');
        const firstLabel = labels[0];
        expect(firstLabel.textContent).toContain('adds superiority die to damage');
    });

    it('shows saveType indicator on maneuvers with save type', () => {
        renderPrompt();
        const labels = document.querySelectorAll('label');
        const firstLabel = labels[0];
        expect(firstLabel.textContent).toContain('STR save');
    });

    it('shows no save type indicator on maneuvers without save type', () => {
        renderPrompt();
        const labels = document.querySelectorAll('label');
        const secondLabel = labels[1];
        expect(secondLabel.textContent).not.toContain('save');
    });

    it('has Use Maneuver button disabled when no selection', () => {
        renderPrompt();
        expect(screen.getByRole('button', { name: /Use Maneuver/ })).toBeDisabled();
    });

    it('has Skip button', () => {
        renderPrompt();
        expect(screen.getByRole('button', { name: /Skip/ })).toBeInTheDocument();
    });

    it('has sp-roll-btn class on Use Maneuver button', () => {
        renderPrompt();
        const btn = screen.getByRole('button', { name: /Use Maneuver/ });
        expect(btn.classList.contains('sp-roll-btn')).toBe(true);
    });

    it('has sp-dismiss-btn class on Skip button', () => {
        renderPrompt();
        const btn = screen.getByRole('button', { name: /Skip/ });
        expect(btn.classList.contains('sp-dismiss-btn')).toBe(true);
    });

    it('renders bolt icon inside Use Maneuver button', () => {
        renderPrompt();
        const btn = screen.getByRole('button', { name: /Use Maneuver/ });
        expect(btn.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument();
    });
});

// ── Selection behavior ──

describe('AttackRiderManeuverPrompt - selection behavior', () => {
    it('selects a maneuver radio when clicked', () => {
        renderPrompt();
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        expect(radios[0].checked).toBe(true);
    });

    it('deselects previous radio when different one is selected', () => {
        renderPrompt();
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(radios[2]);
        expect(radios[0].checked).toBe(false);
        expect(radios[2].checked).toBe(true);
    });

    it('enables Use Maneuver button when selection exists', () => {
        renderPrompt();
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        expect(screen.getByRole('button', { name: /Use Maneuver/ })).not.toBeDisabled();
    });

    it('highlights selected maneuver with background and border', () => {
        renderPrompt();
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        const labels = document.querySelectorAll('label');
        expect(labels[0].style.background).toContain('rgba(255');
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

    it('renders result state after onUse resolves', async () => {
        const onUse = vi.fn().mockResolvedValue({
            payload: { name: 'Disarming Attack', description: 'Weapon dropped!' },
        });
        renderPrompt({ onUse });
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        await waitFor(() => {
            expect(screen.getByText('Disarming Attack')).toBeInTheDocument();
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

    it('renders Done button in result state', async () => {
        const onUse = vi.fn().mockResolvedValue({
            payload: { name: 'Disarming Attack', description: 'Desc.' },
        });
        renderPrompt({ onUse });
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        await waitFor(() => {
            expect(screen.getByText('Done')).toBeInTheDocument();
        });
    });

    it('has sp-roll-btn class on Done button', async () => {
        const onUse = vi.fn().mockResolvedValue({
            payload: { name: 'Disarming Attack', description: 'Desc.' },
        });
        renderPrompt({ onUse });
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        await waitFor(() => {
            const doneBtn = screen.getByText('Done');
            expect(doneBtn.classList.contains('sp-roll-btn')).toBe(true);
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

    it('renders bolt icon in result header', async () => {
        const onUse = vi.fn().mockResolvedValue({
            payload: { name: 'Disarming Attack', description: 'Desc.' },
        });
        renderPrompt({ onUse });
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        await waitFor(() => {
            expect(document.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument();
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
});

// ── isMiss path ──

describe('AttackRiderManeuverPrompt - isMiss path', () => {
    it('renders Precision Attack header when isMiss is true', () => {
        renderPrompt({ isMiss: true });
        expect(screen.getByText('Battle Master — Precision Attack')).toBeInTheDocument();
    });

    it('renders miss instruction text when isMiss is true', () => {
        renderPrompt({ isMiss: true });
        expect(screen.getByText(/The attack missed/)).toBeInTheDocument();
    });

    it('renders attack rider maneuver header when isMiss is false', () => {
        renderPrompt({ isMiss: false });
        expect(screen.getByText('Battle Master — Attack Rider Maneuver')).toBeInTheDocument();
    });

    it('renders hit instruction text when isMiss is false', () => {
        renderPrompt({ isMiss: false });
        expect(screen.getByText(/Choose an attack rider maneuver to use on this hit/)).toBeInTheDocument();
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

    it('renders bolt icon in isMissResult header', async () => {
        const onUse = vi.fn().mockResolvedValue({
            isMissResult: true,
            description: 'Miss turned into hit.',
        });
        renderPrompt({ isMiss: true, onUse });
        const radios = document.querySelectorAll('input[name="attackRiderManeuver"]');
        fireEvent.click(radios[0]);
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/ }));
        await waitFor(() => {
            expect(document.querySelector('.fa-solid.fa-bolt')).toBeInTheDocument();
        });
    });
});

// ── Edge cases ──

describe('AttackRiderManeuverPrompt - edge cases', () => {
    it('renders maneuver without damageBonus or saveType cleanly', () => {
        const maneuvers = [
            { name: 'Menacing Attack', damageBonus: true, saveType: 'WIS', effect: 'frightened' },
        ];
        renderPrompt({ maneuvers });
        expect(screen.getByText('Menacing Attack')).toBeInTheDocument();
    });

    it('renders empty maneuver list without crash', () => {
        renderPrompt({ maneuvers: [] });
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
        expect(screen.getByText(/Choose an attack rider maneuver/)).toBeInTheDocument();
    });

    it('renders with empty attack object', () => {
        renderPrompt({ attack: {} });
        expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });
});
