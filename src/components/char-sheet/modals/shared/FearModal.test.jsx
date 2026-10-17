// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FearModal from './FearModal.jsx';

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
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';

const campaignName = 'test-campaign';

const basePlayerStats = {
    name: 'Wizard1',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Intelligence', bonus: 4 }],
};

const baseAction = {
    name: 'Bane',
    automation: { type: 'bane' },
};

const baseCombatSummary = {
    creatures: [
        { name: 'Goblin', type: 'npc', currentHp: 5, maxHp: 7, saveBonuses: { cha: 0 } },
        { name: 'Orc', type: 'npc', currentHp: 15, maxHp: 22, saveBonuses: { cha: 2 } },
        { name: 'PlayerAlly', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 1 } },
    ],
};

function makeProps(overrides = {}) {
    return {
        action: baseAction,
        playerStats: basePlayerStats,
        campaignName,
        saveType: 'CHA',
        saveDc: 14,
        onClose: vi.fn(),
        ...overrides,
    };
}

function targetRowFor(name) {
    return [...document.querySelectorAll('.secondary-target-row')]
        .find(row => row.textContent.includes(name));
}

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    getAllyList.mockReturnValue(null);
});

// Render/UI lane only: save resolution, aura immunity, NPC/player prompt
// routing, and careful-save skipping are owned by the aura-immunity,
// npc-saves, and player-saves sibling suites.
describe('FearModal', () => {
    it('renders title, every combat creature as a target row, description, note, and a disabled confirm until a target is picked', () => {
        render(<FearModal {...makeProps()} />);
        expect(screen.getByText('Bane')).toBeInTheDocument();
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
        expect(screen.getByText('PlayerAlly')).toBeInTheDocument();
        expect(screen.getByText(/Select creatures in the 30-foot cone/)).toBeInTheDocument();
        expect(screen.getByText(/CHA/)).toBeInTheDocument();
        expect(screen.getByText(/DC 14/)).toBeInTheDocument();
        expect(screen.getByText(/On a failed save, target drops what it is holding/)).toBeInTheDocument();
        expect(screen.getByText(/Frightened/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Bane \(0\)/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });

    it('adds the Heightened Spell note and exactly one disadvantage radio per target row when heightened', () => {
        render(<FearModal {...makeProps({ metamagicHeighten: true })} />);
        expect(screen.getByText(/Heightened Spell/)).toBeInTheDocument();
        expect(screen.getByText(/one target will have disadvantage/)).toBeInTheDocument();
        const rows = document.querySelectorAll('.secondary-target-row');
        expect(rows.length).toBeGreaterThan(0);
        expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(rows.length);
    });

    it('shows no heighten note text and no radios when not heightened', () => {
        render(<FearModal {...makeProps({ metamagicHeighten: false })} />);
        expect(screen.getByText(/drops what it is holding/).textContent).not.toContain('Heightened Spell');
        expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(0);
    });

    it('shows the Careful Spell badge only on listed allies, and on nobody when careful is off', () => {
        getAllyList.mockReturnValue(['PlayerAlly']);
        const view = render(<FearModal {...makeProps({ metamagicCareful: true })} />);
        expect(targetRowFor('PlayerAlly').textContent).toContain('Careful Spell protected');
        expect(targetRowFor('Goblin').textContent).not.toContain('Careful Spell protected');
        expect(targetRowFor('Orc').textContent).not.toContain('Careful Spell protected');

        view.unmount();
        render(<FearModal {...makeProps({ metamagicCareful: false })} />);
        document.querySelectorAll('.secondary-target-row').forEach(row => {
            expect(row.textContent).not.toContain('Careful Spell protected');
        });
    });

    it('row clicks toggle selection, highlight selected rows, and drive the confirm button count', () => {
        render(<FearModal {...makeProps()} />);
        const rows = [...document.querySelectorAll('.secondary-target-row')];
        const checkboxOf = row => row.querySelector('input[type="checkbox"]');

        fireEvent.click(rows[0]);
        expect(checkboxOf(rows[0]).checked).toBe(true);
        expect(rows[0]).toHaveClass('secondary-target-selected');
        expect(rows[1]).not.toHaveClass('secondary-target-selected');
        expect(screen.getByRole('button', { name: /Bane \(1\)/ })).toBeEnabled();

        fireEvent.click(rows[1]);
        expect(checkboxOf(rows[1]).checked).toBe(true);
        expect(screen.getByRole('button', { name: /Bane \(2\)/ })).toBeEnabled();

        fireEvent.click(rows[0]);
        expect(checkboxOf(rows[0]).checked).toBe(false);
        expect(rows[0]).not.toHaveClass('secondary-target-selected');
        expect(screen.getByRole('button', { name: /Bane \(1\)/ })).toBeEnabled();

        fireEvent.click(rows[1]);
        expect(screen.getByRole('button', { name: /Bane \(0\)/ })).toBeDisabled();
    });

    it('Skip closes the modal without applying conditions or writing any state', () => {
        const onClose = vi.fn();
        render(<FearModal {...makeProps({ onClose })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addTargetResult).not.toHaveBeenCalled();
        expect(persistAndNotify).not.toHaveBeenCalled();
    });

    it('shows an empty state with confirm disabled when no creatures are in combat', () => {
        getCombatSummary.mockReturnValue({ creatures: [] });
        render(<FearModal {...makeProps()} />);
        expect(screen.getByText('No targets available.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Bane \(0\)/ })).toBeDisabled();
    });

    it('lists the caster as a selectable target when they are the only creature in combat', () => {
        getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'Wizard1', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 4 } },
            ],
        });
        render(<FearModal {...makeProps()} />);
        const rows = document.querySelectorAll('.secondary-target-row');
        expect(rows).toHaveLength(1);
        expect(targetRowFor('Wizard1').querySelector('input[type="checkbox"]')).toBeInTheDocument();
        expect(screen.queryByText('No targets available.')).not.toBeInTheDocument();
    });
});
