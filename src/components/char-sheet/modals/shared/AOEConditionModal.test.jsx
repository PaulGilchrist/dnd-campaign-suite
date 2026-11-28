// @maintained-by-ai 2026-11-27
// AOEConditionModal — non-overlay selection lane only (render + selection + skip).
// Coverage split across the family (re-verified 2026-11-27):
//   save/apply flow & Careful Spell ......... AOEConditionModal.save-flow.test.jsx
//   Heightened Spell metamagic .............. AOEConditionModal.integration.test.jsx
//   results & condition dedupe .............. AOEConditionModal.results.test.jsx
//   SP-024 expiry clock ..................... AOEConditionModal.expiry.test.jsx
//   overlay targeting lane .................. AOEConditionModal.overlay.test.jsx
//   generic row/checkbox/count internals .... CreatureSelectionModal.test.jsx
// What stays here is the wrapper's OWN wiring: eligible targets sourced from
// getCombatSummary, spell-specific description/note composition, apply gating
// with live count through the real CreatureSelectionModal, and Skip→onClose
// (asserted nowhere else in the family).
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
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';

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

function getRows() {
    return Array.from(document.querySelectorAll('.secondary-target-row'));
}

// ── Tests ──

describe('AOEConditionModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatSummary.mockReturnValue(baseCombatSummary);
        getAllyList.mockReturnValue(null);
    });

    it('composes title, save text, and condition note from props and offers every combat-summary creature as a row', () => {
        render(<AOEConditionModal {...makeProps()} />);

        // Title and spell-specific instructions composed from props
        // (generic row/checkbox rendering is CreatureSelectionModal's own tests)
        expect(screen.getByText('Blinding Darkness')).toBeInTheDocument();
        expect(screen.getByText(/Select creatures in the area of effect/)).toBeInTheDocument();
        expect(screen.getByText('CON')).toBeInTheDocument();
        expect(screen.getByText(/DC 12/)).toBeInTheDocument();
        const noteEl = document.querySelector('.sp-note');
        expect(noteEl).toHaveTextContent(/On a failed save/);
        expect(noteEl).toHaveTextContent('Blinded');

        // Every combat-summary creature is offered as a selectable row
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
        expect(screen.getByText('PlayerAlly')).toBeInTheDocument();
        expect(screen.getAllByRole('checkbox')).toHaveLength(3);

        // Baseline before any selection (the select→enable→deselect→re-disable
        // cycle is the next test; zero-state asserted there)
        expect(getApplyButton()).toBeDisabled();
        expect(getApplyButton()).toHaveTextContent('Blinding Darkness (0)');
    });

    it('enables apply with a live target count as rows are selected and deselected', async () => {
        render(<AOEConditionModal {...makeProps()} />);
        const rows = getRows();
        const checkboxes = screen.getAllByRole('checkbox');

        // Select Goblin → row checked/highlighted, apply enabled with count 1
        await act(async () => { fireEvent.click(rows[0]); });
        await waitFor(() => {
            expect(checkboxes[0]).toBeChecked();
            expect(rows[0]).toHaveClass('secondary-target-selected');
            expect(checkboxes[1]).not.toBeChecked();
            expect(rows[1]).not.toHaveClass('secondary-target-selected');
            expect(getApplyButton()).toBeEnabled();
            expect(getApplyButton()).toHaveTextContent('Blinding Darkness (1)');
        });

        // Select Orc too → count 2, both highlighted
        await act(async () => { fireEvent.click(rows[1]); });
        await waitFor(() => {
            expect(checkboxes[1]).toBeChecked();
            expect(rows[1]).toHaveClass('secondary-target-selected');
            expect(getApplyButton()).toHaveTextContent('Blinding Darkness (2)');
        });

        // Deselect Goblin → count drops to 1, highlight and check removed, still enabled
        await act(async () => { fireEvent.click(rows[0]); });
        await waitFor(() => {
            expect(checkboxes[0]).not.toBeChecked();
            expect(rows[0]).not.toHaveClass('secondary-target-selected');
            expect(getApplyButton()).toHaveTextContent('Blinding Darkness (1)');
            expect(getApplyButton()).toBeEnabled();
        });

        // Back to zero selection → apply disabled again
        await act(async () => { fireEvent.click(rows[1]); });
        await waitFor(() => {
            expect(getApplyButton()).toHaveTextContent('Blinding Darkness (0)');
            expect(getApplyButton()).toBeDisabled();
        });
    });

    it('Skip closes the modal without resolving anything', async () => {
        const props = makeProps();
        render(<AOEConditionModal {...props} />);

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Skip' })); });

        expect(props.onClose).toHaveBeenCalledTimes(1);
        // "without resolving anything": no save prompts sent, no log rows written
        expect(sendSavePrompt).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    // no-inline-styles convention pin (fix#313 recipe): statics live in
    // AOEConditionModal.css / reused sp-* family tokens; the ONLY lawful inline
    // style left in this file's render is the dynamic showResults visibility.
    it('selection wrapper carries only the dynamic display inline — no static inline styles', () => {
        render(<AOEConditionModal {...makeProps()} />);

        const wrapper = document.querySelector('.sp-overlay').parentElement;
        const inline = wrapper.getAttribute('style') || '';
        // At selection time showResults=false → display is undefined → attr empty.
        expect(inline).toMatch(/^$|^display:\s*none;?$/);
        expect(inline).not.toMatch(/margin|padding|background|color|font|cursor|border|opacity/i);
    });
});
