// @maintained-by-ai 2026-11-28
// TashasLaughterModal BASE lane: initial render/copy, the spellSlotLevel→maxTargets
// guard (Tashas-owned math), Tasha-specific notes, pre-confirm inertness, skip wiring,
// and caster-inclusive target list. Selection toggling, cap rejection, empty-state UI,
// Heighten radio rendering, and Skip-button mechanics are CreatureSelectionModal's own
// lane (CreatureSelectionModal.test.jsx :267/:301/:324/:213/:355) — not repeated here.
// NPC auto-roll resolution lives in TashasLaughterModal.npc-saves.test.jsx;
// player save-prompt resolution lives in TashasLaughterModal.player-saves.test.jsx;
// dismiss hygiene lives in TashasLaughterModal.save-dismissed.test.jsx.
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

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { wis: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { wis: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { wis: 1 } },
    ],
};

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

describe('TashasLaughterModal - base rendering and the maxTargets guard', () => {
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

    // FIXED (TashasLaughterModal.jsx:105, fix#39/#121 NaN-guard law): Math.max(1, undefined)
    // used to be NaN, rendering "Select up to NaN" and leaving CreatureSelectionModal's
    // NaN-tolerant guards unbound — unlimited selection. Missing/non-finite spellSlotLevel
    // now binds at the spell's minimum slot (1; disk: spells.json:5422 and
    // 2024/spells.json:13307 are both level 1), same floor as tashasHideousLaughterService.js:3,
    // and finite levels pass through intact (2024 "one additional creature per slot above 1").
    // Header text is the maxTargets readout — row-disabling enforcement at the cap is
    // CreatureSelectionModal's lane (its :301 test), so only the value is pinned here.
    it.each([
        { label: 'slot 3', level: 3, expected: 3 },
        { label: 'slot 5', level: 5, expected: 5 },
        { label: 'omitted', level: 'OMIT', expected: 1 },
        { label: 'explicit undefined', level: undefined, expected: 1 },
        { label: 'NaN', level: NaN, expected: 1 },
        { label: 'null', level: null, expected: 1 },
        { label: 'non-numeric string', level: 'two', expected: 1 },
        { label: 'zero slot', level: 0, expected: 1 },
        { label: 'negative slot', level: -2, expected: 1 },
    ])('derives maxTargets $expected when spellSlotLevel is $label', ({ label, level, expected }) => {
        const props = makeProps();
        if (label === 'omitted') delete props.spellSlotLevel;
        else props.spellSlotLevel = level;
        render(<TashasLaughterModal {...props} />);

        expect(screen.getByText(new RegExp(`Select up to ${expected} creature`))).toBeInTheDocument();
        expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    });

    it('stays completely inert through selection — nothing rolls, logs, or writes until confirm', () => {
        render(<TashasLaughterModal {...makeProps()} />);
        fireEvent.click(targetCheckboxes()[0]);
        fireEvent.click(targetCheckboxes()[1]);

        expect(getConfirmButton()).toBeEnabled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(sendSavePrompt).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(storeSpellLastAttack).not.toHaveBeenCalled();
        expect(addTargetResult).not.toHaveBeenCalled();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(persistAndNotify).not.toHaveBeenCalled();
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
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
        expect(getConfirmButton()).toBeDisabled();
    });

    it('lists the caster as a selectable target when they are the only creature in combat', () => {
        getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Wizard1', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { wis: 4 } }],
        });
        render(<TashasLaughterModal {...makeProps()} />);

        expect(targetCheckboxes()).toHaveLength(1);
        fireEvent.click(targetCheckboxes()[0]);
        expect(getConfirmButton()).toBeEnabled();
    });

    it('appends the Heightened Spell note only when metamagicHeighten is set', () => {
        const { unmount } = render(<TashasLaughterModal {...makeProps({ metamagicHeighten: true })} />);
        expect(screen.getByText(/Heightened Spell: one target will have disadvantage\./)).toBeInTheDocument();

        unmount();
        render(<TashasLaughterModal {...makeProps({ metamagicHeighten: false })} />);
        expect(screen.queryByText(/Heightened Spell/)).not.toBeInTheDocument();
    });
});
