import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

beforeEach(() => {
    vi.resetAllMocks();
    getCombatSummary.mockReturnValue(baseCombatSummary);
    getRuntimeValue.mockReturnValue([]);
    setRuntimeValue.mockReturnValue(undefined);
    getAllyList.mockReturnValue(null);
});

describe('FearModal', () => {
    // ── Rendering ──

    describe('initial render', () => {
        it('renders the modal with title, target list, description, and controls', () => {
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
    });

    // ── Metamagic Heighten ──

    describe('metamagic heighten rendering', () => {
        it('does not show heighten note when metamagicHeighten is false', () => {
            render(<FearModal {...makeProps({ metamagicHeighten: false })} />);
            const noteEl = document.querySelector('.sp-note');
            expect(noteEl.textContent).not.toContain('Heightened Spell');
        });

        it('shows heighten note when metamagicHeighten is true', () => {
            render(<FearModal {...makeProps({ metamagicHeighten: true })} />);
            expect(screen.getByText(/Heightened Spell/)).toBeInTheDocument();
            expect(screen.getByText(/one target will have disadvantage/)).toBeInTheDocument();
        });
    });

    // ── Metamagic Careful ──

    describe('metamagic careful rendering', () => {
        it('does not show careful spell protection when metamagicCareful is false', () => {
            render(<FearModal {...makeProps({ metamagicCareful: false })} />);
            const rows = document.querySelectorAll('.secondary-target-row');
            rows.forEach(row => {
                expect(row.textContent).not.toContain('Careful Spell');
            });
        });

        it('shows careful spell protection when metamagicCareful is true and ally is in list', () => {
            getAllyList.mockReturnValue(['PlayerAlly']);
            render(<FearModal {...makeProps({ metamagicCareful: true })} />);
            const rows = document.querySelectorAll('.secondary-target-row');
            const playerRow = [...rows].find(row => row.textContent.includes('PlayerAlly'));
            expect(playerRow.textContent).toContain('Careful Spell protected');
        });

        it('does not show careful spell protection for non-ally', () => {
            getAllyList.mockReturnValue(['OtherAlly']);
            render(<FearModal {...makeProps({ metamagicCareful: true })} />);
            const rows = document.querySelectorAll('.secondary-target-row');
            const playerRow = [...rows].find(row => row.textContent.includes('PlayerAlly'));
            expect(playerRow.textContent).not.toContain('Careful Spell Protected');
        });
    });

    // ── Target selection ──

    describe('target selection', () => {
        it('selects a target when its row is clicked and enables confirm', async () => {
            render(<FearModal {...makeProps()} />);
            const labels = document.querySelectorAll('.secondary-target-row');
            await fireEvent.click(labels[0]);
            await waitFor(() => {
                const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                expect(checkboxes[0].checked).toBe(true);
            });
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Bane \(1\)/ })).toBeEnabled();
            });
        });

        it('allows selecting multiple targets', async () => {
            render(<FearModal {...makeProps()} />);
            const labels = document.querySelectorAll('.secondary-target-row');
            await fireEvent.click(labels[0]);
            await fireEvent.click(labels[1]);
            await waitFor(() => {
                const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                expect(checkboxes[0].checked).toBe(true);
                expect(checkboxes[1].checked).toBe(true);
            });
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Bane \(2\)/ })).toBeEnabled();
            });
        });

        it('toggles target selection off when row is clicked again', async () => {
            render(<FearModal {...makeProps()} />);
            const labels = document.querySelectorAll('.secondary-target-row');
            await fireEvent.click(labels[0]);
            await waitFor(() => {
                const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                expect(checkboxes[0].checked).toBe(true);
            });
            await fireEvent.click(labels[0]);
            await waitFor(() => {
                const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                expect(checkboxes[0].checked).toBe(false);
            });
        });

        it('highlights selected targets with the selected class', async () => {
            render(<FearModal {...makeProps()} />);
            const rows = document.querySelectorAll('.secondary-target-row');
            await fireEvent.click(rows[0]);
            await waitFor(() => {
                expect(rows[0]).toHaveClass('secondary-target-selected');
                expect(rows[1]).not.toHaveClass('secondary-target-selected');
            });
        });
    });

    // ── Heighten target selection ──

    describe('heighten target selection', () => {
        it('renders heighten radio buttons when metamagicHeighten is true', async () => {
            render(<FearModal {...makeProps({ metamagicHeighten: true })} />);
            const heightenRadios = document.querySelectorAll('input[name="heightenTarget"]');
            expect(heightenRadios.length).toBeGreaterThan(0);
        });

        it('does not show heighten target radios when metamagicHeighten is false', () => {
            render(<FearModal {...makeProps({ metamagicHeighten: false })} />);
            const heightenRadios = document.querySelectorAll('input[name="heightenTarget"]');
            expect(heightenRadios).toHaveLength(0);
        });

        it('renders heighten radio buttons for each target when metamagicHeighten is true', () => {
            render(<FearModal {...makeProps({ metamagicHeighten: true })} />);
            const heightenRadios = document.querySelectorAll('input[name="heightenTarget"]');
            const rows = document.querySelectorAll('.secondary-target-row');
            expect(heightenRadios.length).toBe(rows.length);
        });
    });

    // ── Close behavior ──

    describe('close behavior', () => {
        it('closes when Skip is clicked', () => {
            const onClose = vi.fn();
            render(<FearModal {...makeProps({ onClose })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not apply any effects when skipped without selection', () => {
            const onClose = vi.fn();
            render(<FearModal {...makeProps({ onClose })} />);
            fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                expect.any(String),
                'activeConditions',
                expect.any(Array),
                expect.any(String)
            );
        });
    });

    // ── Empty targets ──

    describe('empty targets', () => {
        it('renders empty target list when no creatures in combat', () => {
            getCombatSummary.mockReturnValue({ creatures: [] });
            render(<FearModal {...makeProps()} />);
            expect(screen.getByText('No targets available.')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Bane \(0\)/ })).toBeDisabled();
        });

        it('renders the caster as a target when caster is the only creature', () => {
            getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Wizard1', type: 'player', currentHp: 30, maxHp: 30, saveBonuses: { cha: 4 } },
                ],
            });
            render(<FearModal {...makeProps()} />);
            expect(screen.getByText('Wizard1')).toBeInTheDocument();
        });
    });

    // ── Null/missing combat summary ──

    describe('null combat summary handling', () => {
        it('renders normally when combat summary is null or missing creatures', () => {
            getCombatSummary.mockReturnValue(null);
            render(<FearModal {...makeProps()} />);
            expect(screen.getByText('Bane')).toBeInTheDocument();
        });

        it('renders normally when combat summary has no creatures property', () => {
            getCombatSummary.mockReturnValue({});
            render(<FearModal {...makeProps()} />);
            expect(screen.getByText('Bane')).toBeInTheDocument();
        });
    });
});
