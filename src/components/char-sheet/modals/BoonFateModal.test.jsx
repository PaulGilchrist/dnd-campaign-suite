import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import BoonFateModal from './BoonFateModal.jsx';

// BoonFateModal — component-only unit tests (2d4 bonus/penalty chooser + result screen).
//
// Shared lane, separate files: BendFateModal.jsx is a near-clone but NOT a shared base —
// each modal imports its own apply wrapper (applyBoonFateChoice / applyBendFateChoice),
// both of which converge on applyD20Modifier in reactionBonusHandler.js.
//
// Caller seam deferred elsewhere (deliberately NOT covered here):
// - boonFateChoice → boonFateModal routing map and onClose wiring: CharReactions.jsx
//   (BoonFateModal is mocked across the CharReactions.*.test.jsx suites).
// - handle() pre-flight gates (boonOfFateUsed once-per-initiative check, range,
//   lastAttack lookup) and applyBoonFateChoice behavior itself (runtime-store writes,
//   campaign log): boonOfFateHandler.test.js — this file only pins the modal's
//   exact call payload with same-object identity for the pass-through props.
//
// Resource gating: none in the modal — the once-per-initiative use limit is enforced
// upstream in handle() via the boonOfFateUsed runtime value BEFORE the modal opens,
// so the apply buttons here are never disabled. If gating ever moves into the modal,
// pin it here.
//
// KNOWN GAP (flagged, not tested): unlike BendFateModal, this component has no
// try/catch around applyBoonFateChoice — a rejection surfaces as an unhandled
// promise rejection with no error message in the chooser. Recommend adding the same
// error lane as BendFateModal, then mirror its retry-after-error test here.
//
// Conventions: makeProps returns a fresh onClose vi.fn per call (no cross-test bleed);
// afterEach mockReset on the module mock so per-test mockResolved implementations never
// leak (clearAllMocks would NOT strip mockResolvedValue); findBy idiom for async result
// screens; role-scoped queries throughout. Result-view header is pinned to action.name
// with a payload.name that deliberately differs, so source is distinguishable.
// No inline styles in the component (sp-* classes from SavePromptModal.css).

vi.mock('../../../services/automation/handlers/reactions/boonOfFateHandler.js', () => ({
    applyBoonFateChoice: vi.fn(),
}));

import * as boonOfFateHandler from '../../../services/automation/handlers/reactions/boonOfFateHandler.js';

// ── Fixtures ──

const baseAction = {
    name: 'Boon of Fate',
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

const baseRoll2d4 = { total: 5 };

// payload.name deliberately differs from action.name so result-view header
// assertions prove they read action.name, not payload.name.
const resolvedResult = {
    type: 'popup',
    payload: {
        type: 'automation_info',
        name: 'Boon Result Info',
        description: 'Attack: d20(14) + 6+5 = <strong>25</strong> vs AC 17 → HIT',
    },
};

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName: 'test-campaign',
        roll2d4: baseRoll2d4,
        lastAttack: baseLastAttack,
        attackerName: baseLastAttack.attackerName,
        eventLabel: 'Attack by Goblin1',
        hitStatus: 'Hit',
        saveStatus: null,
        isAttack: true,
        isSave: false,
        isCheck: false,
        onClose: vi.fn(),
        ...overrides,
    };
}

function renderModal(overrides = {}) {
    const props = makeProps(overrides);
    return { props, ...render(<BoonFateModal {...props} />) };
}

function bodyText(container) {
    return container.querySelector('.sp-body').textContent;
}

afterEach(() => {
    boonOfFateHandler.applyBoonFateChoice.mockReset();
});

// ── Chooser rendering ──

describe('BoonFateModal - chooser rendering', () => {
    it('renders header, event label, roll breakdown, AC line, 2d4 value, prompt, and enabled buttons', () => {
        const { container } = renderModal();
        expect(screen.getByText('Boon of Fate')).toBeInTheDocument();
        expect(screen.getByText('Attack by Goblin1')).toBeInTheDocument();
        expect(bodyText(container)).toContain('Original roll: d20(14) + 6 = 20');
        expect(screen.getByText(/vs AC/)).toHaveTextContent('vs AC 17 → Hit');
        expect(screen.getByText(/Rolled 2d4:/)).toHaveTextContent('Rolled 2d4: 5');
        expect(screen.getByText('Choose how to apply the modifier:')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Apply +5 (Bonus)' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Apply -5 (Penalty)' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    });

    it('falls back to the "Improve Fate" header when action.name is missing', () => {
        renderModal({ action: { ...baseAction, name: null } });
        expect(screen.getByText('Improve Fate')).toBeInTheDocument();
    });

    it.each([
        ['numeric bonus', { bonus: 6 }, 'd20(14) + 6 = 20'],
        ['zero numeric bonus', { bonus: 0 }, 'd20(14) + 0 = 14'],
        ['bonus object with modifier', { bonus: { modifier: 5, total: 8 } }, 'd20(14) + 5 = 19'],
        ['zero modifier falls back to total', { bonus: { modifier: 0, total: 8 } }, 'd20(14) + 8 = 22'],
        ['bonus object with total only', { bonus: { total: 7 } }, 'd20(14) + 7 = 21'],
        ['empty bonus object counts as 0', { bonus: {} }, 'd20(14) + 0 = 14'],
        ['missing d20 renders blank with bonus total', { d20: undefined }, 'd20() + 6 = 6'],
    ])('resolves the original roll line for %s', (_case, attackOverride, expected) => {
        const { container } = renderModal({ lastAttack: { ...baseLastAttack, ...attackOverride } });
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
        expect(screen.getByText(/vs DC/)).toHaveTextContent('vs DC 15 → Failure');
        expect(screen.queryByText(/vs AC/)).not.toBeInTheDocument();
    });

    it('renders an em dash DC when saveDc is missing', () => {
        renderModal({
            isAttack: false,
            isSave: true,
            hitStatus: null,
            saveStatus: 'Failure',
            lastAttack: { ...baseLastAttack, saveDc: null },
        });
        expect(screen.getByText(/vs DC/)).toHaveTextContent('vs DC — → Failure');
    });

    it('omits both outcome lines when neither attack nor save applies', () => {
        renderModal({ isAttack: false, isSave: false, hitStatus: null, saveStatus: null });
        expect(screen.queryByText(/vs (AC|DC)/)).not.toBeInTheDocument();
    });

    it.each([2, 8])('reflects 2d4 total %i in both apply button labels', (total) => {
        renderModal({ roll2d4: { total } });
        expect(screen.getByRole('button', { name: `Apply +${total} (Bonus)` })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: `Apply -${total} (Penalty)` })).toBeInTheDocument();
    });
});

// ── Apply contract and result screen ──

describe('BoonFateModal - apply contract', () => {
    it.each([
        ['bonus', 'Apply +5 (Bonus)'],
        ['penalty', 'Apply -5 (Penalty)'],
    ])('Apply %s calls applyBoonFateChoice once with the exact props and mode, then swaps to the result view', async (mode, label) => {
        boonOfFateHandler.applyBoonFateChoice.mockResolvedValue(resolvedResult);
        const { props } = renderModal();

        fireEvent.click(screen.getByRole('button', { name: label }));
        await screen.findByRole('button', { name: 'Done' });

        expect(boonOfFateHandler.applyBoonFateChoice).toHaveBeenCalledTimes(1);
        const arg = boonOfFateHandler.applyBoonFateChoice.mock.calls[0][0];
        expect(arg).toEqual({
            action: baseAction,
            playerStats: basePlayerStats,
            campaignName: 'test-campaign',
            roll2d4: baseRoll2d4,
            lastAttack: baseLastAttack,
            mode,
        });
        expect(arg.action).toBe(props.action);
        expect(arg.playerStats).toBe(props.playerStats);
        expect(arg.roll2d4).toBe(props.roll2d4);
        expect(arg.lastAttack).toBe(props.lastAttack);

        expect(screen.getByText(/Attack: d20/)).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument();
        // Header must come from action.name, not the differing payload.name.
        expect(screen.getByText('Boon of Fate')).toBeInTheDocument();
        expect(screen.queryByText('Boon Result Info')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Apply [+-]5/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
        expect(screen.queryByText('Choose how to apply the modifier:')).not.toBeInTheDocument();
    });

    it('Done closes the modal and does not re-apply', async () => {
        boonOfFateHandler.applyBoonFateChoice.mockResolvedValue(resolvedResult);
        const { props } = renderModal();

        fireEvent.click(screen.getByRole('button', { name: 'Apply +5 (Bonus)' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Done' }));

        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(boonOfFateHandler.applyBoonFateChoice).toHaveBeenCalledTimes(1);
    });
});

// ── Cancel and inertness ──

describe('BoonFateModal - cancel and inertness', () => {
    it('Cancel closes without invoking applyBoonFateChoice', () => {
        const { props } = renderModal();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(boonOfFateHandler.applyBoonFateChoice).not.toHaveBeenCalled();
    });

    it('overlay and modal-shell clicks are inert in the chooser', () => {
        const { props } = renderModal();
        fireEvent.click(document.querySelector('.sp-overlay'));
        fireEvent.click(document.querySelector('.sp-modal'));
        expect(props.onClose).not.toHaveBeenCalled();
        expect(boonOfFateHandler.applyBoonFateChoice).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('overlay click stays inert in the result view', async () => {
        boonOfFateHandler.applyBoonFateChoice.mockResolvedValue(resolvedResult);
        const { props } = renderModal();

        fireEvent.click(screen.getByRole('button', { name: 'Apply +5 (Bonus)' }));
        await screen.findByRole('button', { name: 'Done' });

        fireEvent.click(document.querySelector('.sp-overlay'));
        expect(props.onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
});
