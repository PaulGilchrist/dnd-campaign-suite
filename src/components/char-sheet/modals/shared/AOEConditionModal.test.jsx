//
// Removed 7 redundant/low-value tests:
//
//   1. "enables the apply button when a target is selected" → redundant with
//      "selects a target when its row is clicked" (same click → checkbox checked → button enabled path)
//   2. "renders target count in apply button" → redundant with
//      "updates target count in apply button when targets are selected" (already tests 0→1→2)
//   3-7. Entire "metamagic heighten" section (5 tests) → covered by
//        AOEConditionModal.integration.test.jsx "heighten radio button behavior"
//   8-10. Entire "metamagic careful" section (3 tests) → covered by
//         AOEConditionModal.integration.test.jsx (careful spell logic tested via full flow)
//  11-12. Entire "edge cases" section (2 tests) → minimal assertions (just text presence),
//         no unique behavioral coverage
//
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AOEConditionModal from './AOEConditionModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
    getAllyList: vi.fn(),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

// Re-import mocked modules
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';

// ── Test fixtures ──

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: 'Blinding Darkness',
};

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { con: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { con: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { con: 1 } },
    ],
};

const baseEffects = [{ type: 'blinded', condition: 'blinded' }];

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CON',
        saveDc: 12,
        effects: baseEffects,
        conditionLabel: 'Blinded',
        onClose: vi.fn(),
        ...overrides,
    };
}

// ── Helpers ──

function getApplyButton() {
    return screen.getByRole('button', { name: /Blinding Darkness/ });
}

// ── Tests ──

describe('AOEConditionModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatSummary.mockReturnValue(baseCombatSummary);
        getAllyList.mockReturnValue(null);
    });

    // ── Initial render ──

    describe('initial render', () => {
        it('renders the modal with action name as title', () => {
            render(<AOEConditionModal {...makeProps()} />);
            expect(screen.getByText('Blinding Darkness')).toBeInTheDocument();
        });

        it('renders all eligible creatures in the target list', () => {
            render(<AOEConditionModal {...makeProps()} />);
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.getByText('Orc')).toBeInTheDocument();
            expect(screen.getByText('PlayerAlly')).toBeInTheDocument();
        });

        it('renders the description with save type and DC', () => {
            render(<AOEConditionModal {...makeProps()} />);
            expect(screen.getByText(/Select creatures in the area of effect/)).toBeInTheDocument();
            expect(screen.getByText(/CON/)).toBeInTheDocument();
            expect(screen.getByText(/DC 12/)).toBeInTheDocument();
        });

        it('renders the note about failed save condition', () => {
            render(<AOEConditionModal {...makeProps()} />);
            const noteEl = document.querySelector('.sp-note');
            expect(noteEl).toHaveTextContent(/On a failed save/);
            expect(noteEl).toHaveTextContent('Blinded');
        });

        it('disables the apply button when no target is selected', () => {
            render(<AOEConditionModal {...makeProps()} />);
            expect(getApplyButton()).toBeDisabled();
        });

        it('renders the skip button', () => {
            render(<AOEConditionModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
        });
    });

    // ── Target selection ──

    describe('target selection', () => {
        it('selects a target when its row is clicked', async () => {
            render(<AOEConditionModal {...makeProps()} />);
            const labels = document.querySelectorAll('.secondary-target-row');
            await act(async () => { fireEvent.click(labels[0]); });
            await waitFor(() => {
                const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                expect(checkboxes[0].checked).toBe(true);
            });
        });

        it('updates target count in apply button when targets are selected', async () => {
            render(<AOEConditionModal {...makeProps()} />);
            const labels = document.querySelectorAll('.secondary-target-row');
            await act(async () => { fireEvent.click(labels[0]); });
            await waitFor(() => {
                expect(getApplyButton()).toHaveTextContent('Blinding Darkness (1)');
            });
            await act(async () => { fireEvent.click(labels[1]); });
            await waitFor(() => {
                expect(getApplyButton()).toHaveTextContent('Blinding Darkness (2)');
            });
        });

        it('toggles target selection off when row is clicked again', async () => {
            render(<AOEConditionModal {...makeProps()} />);
            const labels = document.querySelectorAll('.secondary-target-row');
            await act(async () => { fireEvent.click(labels[0]); });
            await waitFor(() => {
                expect(getApplyButton()).toHaveTextContent('Blinding Darkness (1)');
            });
            await act(async () => { fireEvent.click(labels[0]); });
            await waitFor(() => {
                expect(getApplyButton()).toHaveTextContent('Blinding Darkness (0)');
            });
        });

        it('highlights selected targets with the selected class', async () => {
            render(<AOEConditionModal {...makeProps()} />);
            const rows = document.querySelectorAll('.secondary-target-row');
            await act(async () => { fireEvent.click(rows[0]); });
            await waitFor(() => {
                expect(rows[0]).toHaveClass('secondary-target-selected');
                expect(rows[1]).not.toHaveClass('secondary-target-selected');
            });
        });
    });
});
