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
import { getCombatSummary } from '../../../../services/encounters/combatData.js';

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
        onClose: vi.fn(),
        ...overrides,
    };
}

// Helper: select a target row by index (clicks the label, not raw checkbox)
function selectTarget(index) {
    const labels = document.querySelectorAll('.secondary-target-row');
    fireEvent.click(labels[index]);
}

// Helper: get the confirm button
function getConfirmButton() {
    return screen.getByRole('button', { name: /Tasha's Hideous Laughter/ });
}

// Helper: get the skip button
function clickSkip() {
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
});

describe('TashasLaughterModal - UI Tests', () => {
    describe('initial render', () => {
        it('renders the modal with title and target list', () => {
            render(<TashasLaughterModal {...makeProps()} />);
            expect(screen.getByText("Tasha's Hideous Laughter")).toBeInTheDocument();
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.getByText('Orc')).toBeInTheDocument();
            expect(screen.getByText('PlayerAlly')).toBeInTheDocument();
        });

        it('renders the description with save type and DC', () => {
            render(<TashasLaughterModal {...makeProps()} />);
            expect(screen.getByText(/Select up to/)).toBeInTheDocument();
            expect(screen.getByText(/WIS/)).toBeInTheDocument();
            expect(screen.getByText(/DC 14/)).toBeInTheDocument();
        });

        it('renders the note about prone and incapacitated conditions', () => {
            render(<TashasLaughterModal {...makeProps()} />);
            // Use a unique substring from the note to avoid matching multiple elements
            expect(screen.getByText(/On a failed save/)).toBeInTheDocument();
            expect(screen.getByText(/can't end the Prone condition/)).toBeInTheDocument();
            expect(screen.getByText(/Concentration/)).toBeInTheDocument();
        });

        it('disables the confirm button when no target is selected', () => {
            render(<TashasLaughterModal {...makeProps()} />);
            expect(getConfirmButton()).toBeDisabled();
        });

        it('renders skip button', () => {
            render(<TashasLaughterModal {...makeProps()} />);
            expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
        });

        it('renders with music icon in the header', () => {
            render(<TashasLaughterModal {...makeProps()} />);
            const header = document.querySelector('.sp-header');
            expect(header.querySelector('.fa-solid.fa-music')).toBeInTheDocument();
        });
    });

    describe('maxTargets based on spell slot level', () => {
        it.each([
            { slot: 1, expected: 1 },
            { slot: 3, expected: 3 },
            { slot: 5, expected: 5 },
        ])('renders description with maxTargets = spellSlotLevel ($slot)', ({ slot, expected }) => {
            render(<TashasLaughterModal {...makeProps({ spellSlotLevel: slot })} />);
            expect(screen.getByText(new RegExp(`Select up to ${expected} creature`))).toBeInTheDocument();
        });

        it('enforces maxTargets limit when selecting', () => {
            render(<TashasLaughterModal {...makeProps({ spellSlotLevel: 2 })} />);
            selectTarget(0);
            selectTarget(1);
            expect(getConfirmButton()).toHaveTextContent('(2)');
            const checkboxes = screen.getAllByRole('checkbox');
            expect(checkboxes[2]).toBeDisabled();
        });
    });

    describe('target selection', () => {
        it('selects a target when its row is clicked and enables confirm', () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            const checkboxes = screen.getAllByRole('checkbox');
            expect(checkboxes[0]).toBeChecked();
            expect(getConfirmButton()).toBeEnabled();
        });

        it('allows selecting multiple targets when spellSlotLevel > 1', () => {
            render(<TashasLaughterModal {...makeProps({ spellSlotLevel: 3 })} />);
            selectTarget(0);
            selectTarget(1);
            const checkboxes = screen.getAllByRole('checkbox');
            expect(checkboxes[0]).toBeChecked();
            expect(checkboxes[1]).toBeChecked();
            expect(getConfirmButton()).toHaveTextContent('(2)');
        });

        it('toggles a target off when its row is clicked again', () => {
            render(<TashasLaughterModal {...makeProps()} />);
            selectTarget(0);
            const checkboxes = screen.getAllByRole('checkbox');
            expect(checkboxes[0]).toBeChecked();
            selectTarget(0);
            expect(checkboxes[0]).not.toBeChecked();
            expect(getConfirmButton()).toBeDisabled();
        });
    });

    describe('close/skip behavior', () => {
        it('closes when Skip is clicked', () => {
            const onClose = vi.fn();
            render(<TashasLaughterModal {...makeProps({ onClose })} />);
            clickSkip();
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('empty targets', () => {
        it('renders empty target list when no creatures in combat', () => {
            getCombatSummary.mockReturnValue({ creatures: [] });
            render(<TashasLaughterModal {...makeProps()} />);
            expect(screen.getByText('No targets available.')).toBeInTheDocument();
            expect(getConfirmButton()).toBeDisabled();
        });

        it('renders the caster as a target when caster is the only creature', () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Wizard1', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { wis: 4 } },
                ],
            });
            render(<TashasLaughterModal {...makeProps()} />);
            expect(screen.getByText('Wizard1')).toBeInTheDocument();
        });
    });

    describe('metamagic heighten rendering', () => {
        it('shows heighten note and radio buttons when metamagicHeighten is true', () => {
            render(<TashasLaughterModal {...makeProps({ metamagicHeighten: true })} />);
            expect(screen.getByText(/Heightened Spell/)).toBeInTheDocument();
            expect(screen.getByText(/one target will have disadvantage/)).toBeInTheDocument();
            const heightenRadios = document.querySelectorAll('input[name="heightenTarget"]');
            expect(heightenRadios).toHaveLength(baseCombatSummary.creatures.length);
        });

        it('does not show heighten note or radio buttons when metamagicHeighten is false', () => {
            render(<TashasLaughterModal {...makeProps({ metamagicHeighten: false })} />);
            expect(screen.queryByText(/Heightened Spell/)).not.toBeInTheDocument();
            expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(0);
        });
    });

    describe('edge cases', () => {
        it('shows heighten radios when there is only one creature', () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'SoloEnemy', type: 'npc', currentHp: 10, maxHp: 10, saveBonuses: { wis: 3 } },
                ],
            });
            render(<TashasLaughterModal {...makeProps({ metamagicHeighten: true })} />);
            expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(1);
        });

        it('shows heighten radios when there are no creatures', () => {
            getCombatSummary.mockReturnValue({ creatures: [] });
            render(<TashasLaughterModal {...makeProps({ metamagicHeighten: true })} />);
            expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(0);
            expect(screen.getByText('No targets available.')).toBeInTheDocument();
        });

        it('shows no targets when combat summary has no creatures array', () => {
            getCombatSummary.mockReturnValue({});
            render(<TashasLaughterModal {...makeProps()} />);
            expect(screen.getByText('No targets available.')).toBeInTheDocument();
        });
    });
});
