// @maintained-by-ai
// TashasLaughterModal BASE lane: initial render/copy, maxTargets header math,
// target selection/toggle, empty states, pre-confirm inertness, and skip/close.
// NPC auto-roll resolution lives in TashasLaughterModal.npc-saves.test.jsx;
// player save-prompt resolution lives in TashasLaughterModal.player-saves.test.jsx;
// Heighten radio internals live in CreatureSelectionModal.test.jsx — not repeated here.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TashasLaughterModal from './TashasLaughterModal.jsx';

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

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('./AreaEffectTargetModalBase.utils.jsx', () => ({
    persistAndNotify: vi.fn(),
}));

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { addExpiration } from '../../../../services/rules/effects/expirations.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: "Tasha's Hideous Laughter",
    automation: { type: 'tashas_hideous_laughter' },
};

// saveBonuses are read with fully-lowercase keys (rollNpcSave lowercases saveType).
const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { wis: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { wis: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { wis: 1 } },
    ],
};

// spellSlotLevel defaults to a sane 1 — missing/non-finite levels bind at the lawful default (1).
function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'WIS',
        saveDc: 14,
        spellSlotLevel: 1,
        onClose: vi.fn(),
        ...overrides,
    };
}

// Click a target row by index (the row label, not the raw checkbox).
function selectTarget(index) {
    fireEvent.click(document.querySelectorAll('.secondary-target-row')[index]);
}

function getConfirmButton() {
    return screen.getByRole('button', { name: /Tasha's Hideous Laughter/ });
}

function targetCheckboxes() {
    return screen.getAllByRole('checkbox');
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
});

describe('TashasLaughterModal - base rendering and selection', () => {
    it('renders title, save/DC copy, rules note, every creature in combat, and a disabled confirm', () => {
        render(<TashasLaughterModal {...makeProps()} />);

        expect(screen.getByText("Tasha's Hideous Laughter")).toBeInTheDocument();
        expect(screen.getByText(/Select up to 1 creature/)).toBeInTheDocument();
        expect(screen.getByText(/WIS/)).toBeInTheDocument();
        expect(screen.getByText(/DC 14/)).toBeInTheDocument();
        expect(screen.getByText(/On a failed save/)).toBeInTheDocument();
        expect(screen.getByText(/can't end the Prone condition/)).toBeInTheDocument();
        expect(screen.getByText(/Concentration/)).toBeInTheDocument();

        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
        expect(screen.getByText('PlayerAlly')).toBeInTheDocument();

        expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
        expect(getConfirmButton()).toBeDisabled();
    });

    it.each([
        { slot: 3, expected: 3 },
        { slot: 5, expected: 5 },
    ])('shows maxTargets = $expected in the description for spell slot level $slot', ({ slot, expected }) => {
        render(<TashasLaughterModal {...makeProps({ spellSlotLevel: slot })} />);
        expect(screen.getByText(new RegExp(`Select up to ${expected} creature`))).toBeInTheDocument();
    });

    // FIXED (TashasLaughterModal.jsx:91, fix#39/#121 NaN-guard law): Math.max(1, undefined)
    // used to be NaN, rendering "Select up to NaN" and leaving CreatureSelectionModal's
    // NaN-tolerant guards (:54/:88) unbound — unlimited selection. A missing/non-finite
    // spellSlotLevel now binds at the spell's minimum slot (1; disk: spells.json:5422 and
    // 2024/spells.json:13307 are both level 1), same floor as tashasHideousLaughterService.js:3.
    it.each([
        { label: 'omitted', level: undefined },
        { label: 'explicit undefined', level: undefined },
        { label: 'NaN', level: NaN },
        { label: 'null', level: null },
        { label: 'non-numeric string', level: 'two' },
        { label: 'zero slot', level: 0 },
        { label: 'negative slot', level: -2 },
    ])('caps at 1 target (lawful default) when spellSlotLevel is $label', ({ label, level }) => {
        const props = makeProps();
        if (label === 'omitted') delete props.spellSlotLevel;
        else props.spellSlotLevel = level;
        render(<TashasLaughterModal {...props} />);

        expect(screen.getByText(/Select up to 1 creature/)).toBeInTheDocument();
        expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();

        // The cap actually binds: first row selects, second row disables at max.
        selectTarget(0);
        expect(targetCheckboxes()[0]).toBeChecked();
        expect(getConfirmButton()).toHaveTextContent('(1)');
        selectTarget(1);
        expect(targetCheckboxes()[1]).not.toBeChecked();
        expect(getConfirmButton()).toHaveTextContent('(1)');
    });

    it('leaves a finite slot level intact through the guard (level 3 caps at 3)', () => {
        render(<TashasLaughterModal {...makeProps({ spellSlotLevel: 3 })} />);
        expect(screen.getByText(/Select up to 3 creature/)).toBeInTheDocument();

        selectTarget(0);
        selectTarget(1);
        selectTarget(2);
        expect(getConfirmButton()).toHaveTextContent('(3)');
        expect(targetCheckboxes()).toHaveLength(3);
    });

    it('checks a target row on click and enables confirm, then untoggles back to disabled', () => {
        render(<TashasLaughterModal {...makeProps()} />);

        selectTarget(0);
        expect(targetCheckboxes()[0]).toBeChecked();
        expect(getConfirmButton()).toBeEnabled();

        selectTarget(0);
        expect(targetCheckboxes()[0]).not.toBeChecked();
        expect(getConfirmButton()).toBeDisabled();
    });

    it('caps selection at maxTargets: with slot 2 both rows check, the third disables, and clicking it does nothing', () => {
        render(<TashasLaughterModal {...makeProps({ spellSlotLevel: 2 })} />);

        selectTarget(0);
        selectTarget(1);
        expect(targetCheckboxes()[0]).toBeChecked();
        expect(targetCheckboxes()[1]).toBeChecked();
        expect(getConfirmButton()).toHaveTextContent('(2)');
        expect(targetCheckboxes()[2]).toBeDisabled();

        selectTarget(2);
        expect(targetCheckboxes()[2]).not.toBeChecked();
        expect(getConfirmButton()).toHaveTextContent('(2)');
    });

    it('stays completely inert through selection — nothing rolls, logs, or writes until confirm', () => {
        render(<TashasLaughterModal {...makeProps()} />);
        selectTarget(0);
        selectTarget(1);

        expect(addEntry).not.toHaveBeenCalled();
        expect(sendSavePrompt).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(storeSpellLastAttack).not.toHaveBeenCalled();
        expect(addTargetResult).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(persistAndNotify).not.toHaveBeenCalled();
        expect(getConfirmButton()).toBeEnabled();
    });

    it('closes without side effects when Skip is clicked', () => {
        const onClose = vi.fn();
        render(<TashasLaughterModal {...makeProps({ onClose })} />);

        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(addEntry).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it.each([
        { label: 'no creatures array', summary: {} },
        { label: 'empty creatures array', summary: { creatures: [] } },
    ])('shows the empty-state copy and blocks confirm with $label', ({ summary }) => {
        getCombatSummary.mockReturnValue(summary);
        render(<TashasLaughterModal {...makeProps()} />);

        expect(screen.getByText('No targets available.')).toBeInTheDocument();
        expect(document.querySelectorAll('.secondary-target-row')).toHaveLength(0);
        expect(getConfirmButton()).toBeDisabled();
    });

    it('lists the caster as a selectable target when they are the only creature in combat', () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Wizard1', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { wis: 4 } }],
        });
        render(<TashasLaughterModal {...makeProps()} />);

        expect(targetCheckboxes()).toHaveLength(1);
        selectTarget(0);
        expect(getConfirmButton()).toBeEnabled();
    });

    it('appends the Heightened Spell note only when metamagicHeighten is set', () => {
        const { unmount } = render(<TashasLaughterModal {...makeProps({ metamagicHeighten: true })} />);
        expect(screen.getByText(/Heightened Spell: one target will have disadvantage\./)).toBeInTheDocument();
        // Radios mirror every target — wiring only; radio behavior is CreatureSelectionModal's lane.
        expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(baseCombatSummary.creatures.length);

        unmount();
        render(<TashasLaughterModal {...makeProps({ metamagicHeighten: false })} />);
        expect(screen.queryByText(/Heightened Spell/)).not.toBeInTheDocument();
        expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(0);
    });
});
