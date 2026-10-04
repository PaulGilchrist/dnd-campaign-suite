// @improved-by-ai
// @cleaned-by-ai
//
// Removed redundant tests (covered by other AOEConditionModal test files):
//   - "skip button" (×2) → covered in AOEConditionModal.test.jsx "initial render" (skip button rendering)
//                          and AOEConditionModal.save-flow.test.jsx (condition application behavior)
//   - "apply button count display" (×5) → covered in AOEConditionModal.test.jsx
//                                         "target selection" (count 0→1→2, toggle)
//   - "results summary after NPC resolution" (×1) → brittle UI text assertion ("targets saved");
//                                                   save flow covered in AOEConditionModal.save-flow.test.jsx
//   - "all creatures blocked by effects" (×2) → covered in AOEConditionModal.results.test.jsx
//                                               "blocking effects" (all 4: forcecage, maze, banishment, imprisonment)
//   - "single target scenario" (×2) → covered in AOEConditionModal.test.jsx "target selection"
//   - "full apply flow with logging verification" (×2) → covered in AOEConditionModal.save-flow.test.jsx
//                                                        (storeSpellLastAttack, ability_use, persistAndNotify
//                                                         with precise assertions)
//
// Kept tests (unique behavioral coverage):
//   - "heighten radio button behavior" (×3) → radio state management not tested in other files
//   - "multiple creature types with mixed save outcomes" (×1) → mixed NPC/player apply path

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

// SP-024: mock the expirations barrel — fail grants now stamp ONE addExpiration
// clock per failing target; assertable here, real expirationQueue stays inert.
vi.mock('../../../../services/rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// Re-import mocked modules
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';
import { persistAndNotify } from './AreaEffectTargetModalBase.utils.jsx';
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

function getApplyButton() {
    return screen.getByRole('button', { name: /Blinding Darkness/ });
}

// ── Tests ──

describe('AOEConditionModal - Integration', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getCombatSummary.mockReturnValue(baseCombatSummary);
        getRuntimeValue.mockReturnValue([]);
        setRuntimeValue.mockReturnValue(undefined);
        addEntry.mockResolvedValue(undefined);
        persistAndNotify.mockReturnValue(undefined);
        getAllyList.mockReturnValue(null);
    });

    // ── Heighten radio button behavior ──

    describe('heighten radio button behavior', () => {
        it('renders one heighten radio button per eligible target when heighten is enabled', () => {
            render(<AOEConditionModal {...makeProps({ metamagicHeighten: true })} />);
            const radios = document.querySelectorAll('input[name="heightenTarget"]');
            expect(radios).toHaveLength(3);
        });

        it('does not render heighten radio buttons when heighten is disabled', () => {
            render(<AOEConditionModal {...makeProps({ metamagicHeighten: false })} />);
            const radios = document.querySelectorAll('input[name="heightenTarget"]');
            expect(radios).toHaveLength(0);
        });

        it('selects a heighten target when its radio is clicked', async () => {
            render(<AOEConditionModal {...makeProps({ metamagicHeighten: true })} />);
            const radios = document.querySelectorAll('input[name="heightenTarget"]');
            await act(async () => { fireEvent.click(radios[0]); });
            await waitFor(() => {
                expect(radios[0]).toBeChecked();
            });
        });
    });

    // ── Multiple creature types with mixed save outcomes ──

    describe('multiple creature types with mixed save outcomes', () => {
        it('applies conditions to NPCs that fail and sends prompts for player targets in a single apply', async () => {
            vi.spyOn(Math, 'random').mockReturnValue(0.01);
            try {
                getRuntimeValue.mockReturnValue([]);
                render(<AOEConditionModal {...makeProps()} />);
                const labels = document.querySelectorAll('.secondary-target-row');
                await act(async () => { fireEvent.click(labels[0]); });
                await act(async () => { fireEvent.click(labels[2]); });
                await act(async () => {
                    fireEvent.click(getApplyButton());
                });

                // NPC should have condition applied
                await waitFor(() => {
                    const goblinConditions = setRuntimeValue.mock.calls.filter(
                        call => call[1] === 'activeConditions' && call[0] === 'Goblin'
                    );
                    expect(goblinConditions.length).toBeGreaterThan(0);
                });

                // Player should have prompt sent (not condition applied yet)
                expect(sendSavePrompt).toHaveBeenCalledWith(
                    campaignName,
                    expect.objectContaining({ targetName: 'PlayerAlly' })
                );
            } finally {
                vi.restoreAllMocks();
            }
        });
    });
});
