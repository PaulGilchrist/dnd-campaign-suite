// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import BendFateModal from './BendFateModal.jsx';

// BendFateModal — component-only unit tests (bonus/penalty chooser + result screen).
//
// Caller seam deferred elsewhere (deliberately NOT covered here):
// - bendFateChoice → modalState routing: useCharActionsAutomation.test.class-feature-modals.js
// - CharReactions / CharActionModals.SecondaryModals mounting and onClose wiring:
//   CharReactions.handlers.test.jsx, CharReactions.edgeCases.test.jsx,
//   CharReactions.cla034-beguiling-twist.test.jsx (BendFateModal is mocked there).
// - applyBendFateChoice behavior itself (runtime-store writes, description building,
//   campaign log): reactionBonusHandler.test.js — this file only pins the modal's
//   exact call payload with same-object identity for the pass-through props.
//
// Resource gating: none by design — Bend Luck rolls a free 1d4 and consumes no
// sorcery points in this implementation, so the apply buttons are never disabled.
// If a resource cost is ever added, gate and pin it here.
//
// Conventions: makeProps returns a fresh onClose vi.fn per call (no cross-test bleed);
// afterEach mockReset on the module mock so per-test mockResolved/Reject implementations
// never leak; findBy idiom for async result screens; role-scoped queries throughout.
// No inline styles in the component (sp-* classes from SavePromptModal.css).

vi.mock('../../../services/automation/handlers/reactions/reactionBonusHandler.js', () => ({
    applyBendFateChoice: vi.fn(),
}));

import * as reactionBonusHandler from '../../../services/automation/handlers/reactions/reactionBonusHandler.js';

// ── Fixtures ──

const baseAction = {
    name: 'Bend Luck',
    automation: {
        type: 'class_feature',
        effect: 'bonus_or_penalty_choice',
    },
};

const basePlayerStats = { name: 'Paladin1', level: 5 };

const baseLastAttack = {
    d20: 14,
    bonus: 6,
    targetAc: 17,
    effectiveAc: null,
    saveDc: 13,
    saveType: 'Dexterity',
    saveResult: 'success',
    hit: true,
    rollType: 'attack',
    attackerName: 'Goblin1',
};

const baseD4Roll = { total: 3 };

const resolvedResult = {
    type: 'popup',
    payload: {
        type: 'automation_info',
        name: 'Bend Luck',
        description: 'Attack: d20(14) + 6+3 = <strong>23</strong> vs AC 17 → HIT',
    },
};

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName: 'test-campaign',
        d4Roll: baseD4Roll,
        lastAttack: baseLastAttack,
        attackerName: baseLastAttack.attackerName,
        eventLabel: 'Attack by Goblin1',
        hitStatus: 'Hit',
        saveStatus: null,
        isAttack: true,
        isSave: false,
        onClose: vi.fn(),
        ...overrides,
    };
}

function renderModal(overrides = {}) {
    const props = makeProps(overrides);
    return { props, ...render(<BendFateModal {...props} />) };
}

function bodyText(container) {
    return container.querySelector('.sp-body').textContent;
}

afterEach(() => {
    reactionBonusHandler.applyBendFateChoice.mockReset();
});

// ── Chooser rendering ──

describe('BendFateModal - chooser rendering', () => {
    it('renders header, event label, roll breakdown, AC line, d4 value, prompt, and enabled buttons', () => {
        const { container } = renderModal({ action: { ...baseAction, name: 'Bend Fate' } });
        expect(screen.getByText('Bend Fate')).toBeInTheDocument();
        expect(screen.getByText('Attack by Goblin1')).toBeInTheDocument();
        expect(bodyText(container)).toContain('Original roll: d20(14) + 6 = 20');
        expect(screen.getByText(/vs AC 17/)).toHaveTextContent('vs AC 17 → Hit');
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('Choose how to apply the modifier:')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Apply +3 (Bonus)' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Apply -3 (Penalty)' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    });

    it('falls back to the "Bend Luck" header when action.name is missing', () => {
        renderModal({ action: { ...baseAction, name: null } });
        expect(screen.getByText('Bend Luck')).toBeInTheDocument();
    });

    it.each([
        ['numeric bonus', 6, 'd20(14) + 6 = 20'],
        ['bonus object with modifier', { modifier: 5, total: 8 }, 'd20(14) + 5 = 19'],
        ['zero modifier falls back to total', { modifier: 0, total: 8 }, 'd20(14) + 8 = 22'],
        ['bonus object with total only', { total: 8 }, 'd20(14) + 8 = 22'],
        ['missing bonus counts as 0', undefined, 'd20(14) + 0 = 14'],
    ])('resolves the original roll line for %s', (_case, bonus, expected) => {
        const { container } = renderModal({ lastAttack: { ...baseLastAttack, bonus } });
        expect(bodyText(container)).toContain(`Original roll: ${expected}`);
    });

    it.each([
        ['targetAc', { targetAc: 18, effectiveAc: null }, 'vs AC 18 → Hit'],
        ['effectiveAc fallback', { targetAc: null, effectiveAc: 19 }, 'vs AC 19 → Hit'],
        ['no AC at all renders an em dash', { targetAc: null, effectiveAc: null }, 'vs AC — → Hit'],
    ])('resolves the AC line from %s', (_case, acFields, expected) => {
        renderModal({ lastAttack: { ...baseLastAttack, ...acFields } });
        expect(screen.getByText(/vs AC/)).toHaveTextContent(expected);
    });

    it('renders the save line and omits the hit line for saving throws', () => {
        renderModal({
            isAttack: false,
            isSave: true,
            hitStatus: null,
            saveStatus: 'Failure',
            eventLabel: 'Saving Throw by Goblin1',
            lastAttack: { ...baseLastAttack, saveDc: 15 },
        });
        expect(screen.getByText(/vs DC 15/)).toHaveTextContent('vs DC 15 → Failure');
        expect(screen.queryByText(/vs AC/)).not.toBeInTheDocument();
    });

    it('omits both outcome lines when neither attack nor save applies', () => {
        renderModal({ isAttack: false, isSave: false, hitStatus: null, saveStatus: null });
        expect(screen.queryByText(/vs (AC|DC)/)).not.toBeInTheDocument();
    });

    it.each([1, 2])('reflects d4 total %i in both apply button labels', (total) => {
        renderModal({ d4Roll: { total } });
        expect(screen.getByRole('button', { name: `Apply +${total} (Bonus)` })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: `Apply -${total} (Penalty)` })).toBeInTheDocument();
    });
});

// ── Apply contract and result screen ──

describe('BendFateModal - apply contract', () => {
    it.each([
        ['bonus', 'Apply +3 (Bonus)'],
        ['penalty', 'Apply -3 (Penalty)'],
    ])('Apply %s calls applyBendFateChoice once with the exact props and mode, then swaps to the result view', async (mode, label) => {
        reactionBonusHandler.applyBendFateChoice.mockResolvedValue(resolvedResult);
        const { props } = renderModal();

        fireEvent.click(screen.getByRole('button', { name: label }));
        await screen.findByRole('button', { name: 'Done' });

        expect(reactionBonusHandler.applyBendFateChoice).toHaveBeenCalledTimes(1);
        const arg = reactionBonusHandler.applyBendFateChoice.mock.calls[0][0];
        expect(arg).toEqual({
            action: baseAction,
            playerStats: basePlayerStats,
            campaignName: 'test-campaign',
            d4Roll: baseD4Roll,
            lastAttack: baseLastAttack,
            mode: mode,
        });
        expect(arg.action).toBe(props.action);
        expect(arg.playerStats).toBe(props.playerStats);
        expect(arg.d4Roll).toBe(props.d4Roll);
        expect(arg.lastAttack).toBe(props.lastAttack);

        expect(screen.getByText(/Attack: d20/)).toBeInTheDocument();
        expect(screen.getByText('23')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Apply [+-]3/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.queryByText('Choose how to apply the modifier:')).not.toBeInTheDocument();
    });

    it('Done closes the modal and does not re-apply', async () => {
        reactionBonusHandler.applyBendFateChoice.mockResolvedValue(resolvedResult);
        const { props } = renderModal();

        fireEvent.click(screen.getByRole('button', { name: 'Apply +3 (Bonus)' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Done' }));

        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(reactionBonusHandler.applyBendFateChoice).toHaveBeenCalledTimes(1);
    });
});

// ── Cancel and inertness ──

describe('BendFateModal - cancel and inertness', () => {
    it('Cancel closes without invoking applyBendFateChoice', () => {
        const { props } = renderModal();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(reactionBonusHandler.applyBendFateChoice).not.toHaveBeenCalled();
    });

    it('overlay and modal-shell clicks are inert', () => {
        const { props } = renderModal();
        fireEvent.click(document.querySelector('.sp-overlay'));
        fireEvent.click(document.querySelector('.sp-modal'));
        expect(props.onClose).not.toHaveBeenCalled();
        expect(reactionBonusHandler.applyBendFateChoice).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
});

// ── Error handling ──

describe('BendFateModal - error handling', () => {
    it('surfaces the error, keeps the chooser, and allows a successful retry', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
        reactionBonusHandler.applyBendFateChoice
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValue(resolvedResult);
        const { props } = renderModal();

        fireEvent.click(screen.getByRole('button', { name: 'Apply +3 (Bonus)' }));
        await screen.findByText(/Failed to apply Bend Luck: Network error/);

        expect(screen.getByRole('button', { name: 'Apply +3 (Bonus)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Apply -3 (Penalty)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
        expect(props.onClose).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Apply +3 (Bonus)' }));
        await screen.findByRole('button', { name: 'Done' });
        expect(reactionBonusHandler.applyBendFateChoice).toHaveBeenCalledTimes(2);

        consoleSpy.mockRestore();
    });
});
